import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import type {
  AdminGrantSummary,
  AdminPermissions,
  AdminTask,
  AgencyHostRecord,
  AuthSession,
  BandEvent,
  BrandDrop,
  ConversationType,
  DirectoryUser,
  InboxConversation,
  InboxMember,
  InboxMessage,
  Livestream,
  UserRole,
} from '../src/types';
import {
  hydrateAuthSession,
  initPlatformStore,
  listExtendedDirectoryUsers,
  listExtendedStreams,
} from './platformStore';

const DB_PATH = path.resolve(process.cwd(), 'stlive.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Session signing key from env or ephemeral in-memory random bytes (never hardcoded)
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

interface TokenPayload {
  uid: string;
  role: UserRole;
  assignedHostUid?: string;
  exp: number;
}

export function signSessionToken(payload: Omit<TokenPayload, 'exp'>): string {
  const full: TokenPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT,
      coins INTEGER NOT NULL DEFAULT 1500,
      diamonds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_uid TEXT NOT NULL,
      admin_uid TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(host_uid, admin_uid)
    );

    CREATE TABLE IF NOT EXISTS admin_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_uid TEXT NOT NULL,
      admin_uid TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS streams (
      id TEXT PRIMARY KEY,
      host_uid TEXT NOT NULL,
      host_name TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'English',
      viewer_count INTEGER NOT NULL DEFAULT 1,
      thumbnail TEXT NOT NULL,
      is_live INTEGER NOT NULL DEFAULT 1,
      max_seats INTEGER NOT NULL DEFAULT 4,
      game_room_id TEXT,
      game_type TEXT
    );

    CREATE TABLE IF NOT EXISTS agency_hosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_uid TEXT NOT NULL,
      host_uid TEXT NOT NULL,
      host_name TEXT NOT NULL,
      live_hours REAL NOT NULL DEFAULT 0,
      target_hours REAL NOT NULL DEFAULT 40,
      diamonds_earned INTEGER NOT NULL DEFAULT 0,
      target_diamonds INTEGER NOT NULL DEFAULT 50000,
      commission_rate REAL NOT NULL DEFAULT 15,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS band_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      band_uid TEXT NOT NULL,
      band_name TEXT NOT NULL,
      title TEXT NOT NULL,
      members TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      stage_mode TEXT NOT NULL DEFAULT 'full_band',
      rsvp_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS brand_drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      band_uid TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      product_title TEXT NOT NULL,
      price_label TEXT NOT NULL,
      stock_count INTEGER NOT NULL DEFAULT 50,
      claimed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'live'
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      creator_uid TEXT NOT NULL,
      invite_code TEXT UNIQUE,
      e2ee_enabled INTEGER NOT NULL DEFAULT 1,
      default_ttl_sec INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL,
      uid TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at INTEGER NOT NULL,
      last_read_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (conversation_id, uid)
    );

    CREATE TABLE IF NOT EXISTS inbox_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_uid TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'text',
      encrypted INTEGER NOT NULL DEFAULT 0,
      ciphertext TEXT,
      iv TEXT,
      view_once INTEGER NOT NULL DEFAULT 0,
      consumed INTEGER NOT NULL DEFAULT 0,
      ttl_sec INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inbox_messages_conv ON inbox_messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_inbox_messages_exp ON inbox_messages(expires_at);
  `);

  seedInitialData();
  initPlatformStore();
}

function seedInitialData(): void {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    // Public directory profiles (no hardcoded passwords — users register or claim with their own password)
    const insertUser = db.prepare(
      'INSERT OR IGNORE INTO users (uid, display_name, role, password_hash, coins, diamonds) VALUES (?, ?, ?, NULL, ?, ?)'
    );
    insertUser.run('ST-1001', 'Maya Lin', 'host', 4200, 18400);
    insertUser.run('ST-1002', 'Alex Chen', 'host', 3100, 12900);
    insertUser.run('ST-1003', 'Rohan Verma', 'host', 2900, 9500);
    insertUser.run('ST-2001', 'Aarav Sharma', 'guest', 1800, 0);
    insertUser.run('ST-2002', 'Sofia Morales', 'guest', 2400, 0);
    insertUser.run('ST-2003', 'Kenji Sato', 'guest', 1650, 0);
    insertUser.run('ST-3001', 'Apex Talent Agency', 'agency', 12000, 96000);
    insertUser.run('ST-4001', 'Velvet Echo Band', 'band', 5400, 24500);
  }

  const streamCount = (db.prepare('SELECT COUNT(*) as c FROM streams').get() as { c: number }).c;
  if (streamCount === 0) {
    const insertStream = db.prepare(
      `INSERT INTO streams (id, host_uid, host_name, title, category, language, viewer_count, thumbnail, is_live, max_seats, game_room_id, game_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    );
    insertStream.run(
      'room-solo-maya',
      'ST-1001',
      'Maya Lin',
      'Late Morning Studio Q&A & Color Grading Live',
      'solo',
      'English',
      4280,
      '/src/assets/images/stream_solo_studio_1795687719501.jpg',
      4,
      'game-ludo-main',
      'ludo'
    );
    insertStream.run(
      'room-multiguest-lounge',
      'ST-1002',
      'Alex Chen',
      '12-Seat Creator Roundtable & Live Debates',
      'multi_guest',
      'English',
      6140,
      '/src/assets/images/stream_multiguest_podcast_1795687722768.jpg',
      12,
      'game-snakes-main',
      'snakes'
    );
    insertStream.run(
      'room-band-velvet',
      'ST-4001',
      'Velvet Echo Band',
      'Unplugged Loft Session — Full Band Live Mix',
      'music_band',
      'English',
      8920,
      '/src/assets/images/stream_band_live_1795687720929.jpg',
      8,
      null,
      null
    );
    insertStream.run(
      'room-gaming-rohan',
      'ST-1003',
      'Rohan Verma',
      'Ranked Arena & Live Viewer Ludo Cup',
      'games',
      'Hindi',
      5310,
      '/src/assets/images/stream_gaming_arena_1795687722196.jpg',
      6,
      'game-ludo-main',
      'ludo'
    );
    insertStream.run(
      'room-pk-clash',
      'ST-1001',
      'Maya Lin',
      '5-Min Studio PK Showdown: Team Crimson vs Cyan',
      'pk',
      'Spanish',
      7450,
      '/src/assets/images/stream_solo_studio_1795687719501.jpg',
      4,
      null,
      null
    );
    insertStream.run(
      'room-brand-aethel',
      'ST-4001',
      'Aethel Audio Drop',
      'Live Hardware Drop: Studio Headphones & Compact Camera',
      'brand_drop',
      'English',
      3890,
      '/src/assets/images/stream_brand_showcase_1795687724180.jpg',
      4,
      null,
      null
    );
    insertStream.run(
      'room-audio-night',
      'ST-1002',
      'Alex Chen',
      'Calm Midnight Audio Lounge — Open Mic & Music',
      'audio',
      'Arabic',
      2940,
      '/src/assets/images/stream_multiguest_podcast_1795687722768.jpg',
      12,
      'game-snakes-main',
      'snakes'
    );
    insertStream.run(
      'room-esports-pro',
      'ST-1003',
      'Rohan Verma',
      'Nova Strike 3D FPS — Host & Followers Live Squad',
      'gaming',
      'Japanese',
      4760,
      '/src/assets/images/stream_gaming_arena_1795687722196.jpg',
      8,
      'game-fps-main',
      'fps'
    );
  }
  // Ensure existing DBs also link room-esports-pro to the live 3D FPS Arena
  db.prepare(
    `UPDATE streams SET title = 'Nova Strike 3D FPS — Host & Followers Live Squad', game_room_id = 'game-fps-main', game_type = 'fps', max_seats = 8 WHERE id = 'room-esports-pro' AND game_room_id IS NULL`
  ).run();

  const agencyCount = (db.prepare('SELECT COUNT(*) as c FROM agency_hosts').get() as { c: number }).c;
  if (agencyCount === 0) {
    const insertAgencyHost = db.prepare(
      `INSERT INTO agency_hosts (agency_uid, host_uid, host_name, live_hours, target_hours, diamonds_earned, target_diamonds, commission_rate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertAgencyHost.run('ST-3001', 'ST-1001', 'Maya Lin', 46.5, 50, 84200, 100000, 18, 'top_tier');
    insertAgencyHost.run('ST-3001', 'ST-1002', 'Alex Chen', 34.0, 40, 52400, 60000, 15, 'active');
    insertAgencyHost.run('ST-3001', 'ST-1003', 'Rohan Verma', 29.5, 40, 41900, 50000, 14, 'active');
    insertAgencyHost.run('ST-3001', 'ST-1008', 'Hana Yoshida', 12.0, 30, 15800, 30000, 12, 'onboarding');
  }

  const bandCount = (db.prepare('SELECT COUNT(*) as c FROM band_events').get() as { c: number }).c;
  if (bandCount === 0) {
    const insertEvent = db.prepare(
      `INSERT INTO band_events (band_uid, band_name, title, members, scheduled_at, stage_mode, rsvp_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertEvent.run(
      'ST-4001',
      'Velvet Echo Band',
      'Rooftop Sunset Acoustic Set',
      'Elena (Vocals), Marcus (Guitar), Sam (Drums), Theo (Synth)',
      'Today · 20:00 UTC',
      'full_band',
      1420
    );
    insertEvent.run(
      'ST-4001',
      'Velvet Echo Band',
      'Open Soundcheck & Fan Song Requests',
      'Elena (Vocals), Theo (Synth)',
      'Tomorrow · 17:30 UTC',
      'soundcheck',
      685
    );
  }

  const dropCount = (db.prepare('SELECT COUNT(*) as c FROM brand_drops').get() as { c: number }).c;
  if (dropCount === 0) {
    const insertDrop = db.prepare(
      `INSERT INTO brand_drops (band_uid, brand_name, product_title, price_label, stock_count, claimed_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertDrop.run('ST-4001', 'Aethel Studio', 'Aethel Matte Wireless Headphones', '$249', 100, 74, 'live');
    insertDrop.run('ST-4001', 'Luna Optics', 'Luna Pocket Creator Camera MK2', '$599', 40, 29, 'live');
    insertDrop.run('ST-4001', 'Velvet Echo Merch', 'Signed Tour Vinyl Limited Press', '$48', 150, 0, 'scheduled');
  }
}

export function getUserByUid(uid: string) {
  return db
    .prepare('SELECT uid, display_name, role, password_hash, coins, diamonds FROM users WHERE uid = ?')
    .get(uid) as
    | {
        uid: string;
        display_name: string;
        role: UserRole;
        password_hash: string | null;
        coins: number;
        diamonds: number;
      }
    | undefined;
}

export function listDirectoryUsers(): DirectoryUser[] {
  return listExtendedDirectoryUsers();
}

export function parsePermissions(json: string): AdminPermissions {
  try {
    const p = JSON.parse(json) as Partial<AdminPermissions>;
    return {
      canModerateChat: Boolean(p.canModerateChat),
      canApproveGames: Boolean(p.canApproveGames),
      canManageSeats: Boolean(p.canManageSeats),
      canRunPK: Boolean(p.canRunPK),
    };
  } catch {
    return {
      canModerateChat: true,
      canApproveGames: true,
      canManageSeats: false,
      canRunPK: false,
    };
  }
}

export function getHostAdmins(hostUid: string): AdminGrantSummary[] {
  const rows = db
    .prepare(
      `SELECT g.id, g.host_uid, g.admin_uid, g.permissions_json, g.active, g.created_at,
              COALESCE(u.display_name, g.admin_uid) AS admin_name
       FROM admin_grants g
       LEFT JOIN users u ON u.uid = g.admin_uid
       WHERE g.host_uid = ?
       ORDER BY g.created_at DESC`
    )
    .all(hostUid) as Array<{
    id: number;
    host_uid: string;
    admin_uid: string;
    permissions_json: string;
    active: number;
    created_at: string;
    admin_name: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    hostUid: r.host_uid,
    adminUid: r.admin_uid,
    adminName: r.admin_name,
    permissions: parsePermissions(r.permissions_json),
    active: Boolean(r.active),
    createdAt: r.created_at,
  }));
}

export function getActiveGrant(hostUid: string, adminUid: string) {
  const row = db
    .prepare(
      `SELECT g.id, g.host_uid, g.admin_uid, g.password_hash, g.permissions_json, g.active,
              COALESCE(h.display_name, g.host_uid) AS host_name
       FROM admin_grants g
       LEFT JOIN users h ON h.uid = g.host_uid
       WHERE g.host_uid = ? AND g.admin_uid = ? AND g.active = 1`
    )
    .get(hostUid, adminUid) as
    | {
        id: number;
        host_uid: string;
        admin_uid: string;
        password_hash: string;
        permissions_json: string;
        active: number;
        host_name: string;
      }
    | undefined;
  return row;
}

export function getTasksForHost(hostUid: string): AdminTask[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.host_uid, t.admin_uid, t.title, t.notes, t.priority, t.status, t.created_at,
              COALESCE(u.display_name, t.admin_uid) AS admin_name
       FROM admin_tasks t
       LEFT JOIN users u ON u.uid = t.admin_uid
       WHERE t.host_uid = ?
       ORDER BY t.id DESC`
    )
    .all(hostUid) as Array<{
    id: number;
    host_uid: string;
    admin_uid: string;
    title: string;
    notes: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
    created_at: string;
    admin_name: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    hostUid: r.host_uid,
    adminUid: r.admin_uid,
    adminName: r.admin_name,
    title: r.title,
    notes: r.notes,
    priority: r.priority,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export function getTasksForAdmin(hostUid: string, adminUid: string): AdminTask[] {
  const rows = db
    .prepare(
      `SELECT id, host_uid, admin_uid, title, notes, priority, status, created_at
       FROM admin_tasks
       WHERE host_uid = ? AND admin_uid = ?
       ORDER BY id DESC`
    )
    .all(hostUid, adminUid) as Array<{
    id: number;
    host_uid: string;
    admin_uid: string;
    title: string;
    notes: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    hostUid: r.host_uid,
    adminUid: r.admin_uid,
    title: r.title,
    notes: r.notes,
    priority: r.priority,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export function buildSessionFromToken(token: string | undefined): AuthSession | null {
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return hydrateAuthSession(token!, payload.uid, payload.role, payload.assignedHostUid);
}

export function listAllStreams(): Omit<Livestream, 'seats' | 'pk'>[] {
  return listExtendedStreams();
}

export function listAgencyHosts(agencyUid: string): AgencyHostRecord[] {
  let rows = db
    .prepare(
      `SELECT id, agency_uid, host_uid, host_name, live_hours, target_hours, diamonds_earned, target_diamonds, commission_rate, status
       FROM agency_hosts
       WHERE agency_uid = ?
       ORDER BY diamonds_earned DESC`
    )
    .all(agencyUid) as Array<{
    id: number;
    agency_uid: string;
    host_uid: string;
    host_name: string;
    live_hours: number;
    target_hours: number;
    diamonds_earned: number;
    target_diamonds: number;
    commission_rate: number;
    status: AgencyHostRecord['status'];
  }>;

  if (rows.length === 0) {
    // Also show sample agency overview if newly created agency has no recruits yet
    rows = db
      .prepare(
        `SELECT id, agency_uid, host_uid, host_name, live_hours, target_hours, diamonds_earned, target_diamonds, commission_rate, status
         FROM agency_hosts
         WHERE agency_uid = 'ST-3001'
         ORDER BY diamonds_earned DESC`
      )
      .all() as typeof rows;
  }

  return rows.map((r) => ({
    id: r.id,
    agencyUid: r.agency_uid,
    hostUid: r.host_uid,
    hostName: r.host_name,
    liveHours: r.live_hours,
    targetHours: r.target_hours,
    diamondsEarned: r.diamonds_earned,
    targetDiamonds: r.target_diamonds,
    commissionRate: r.commission_rate,
    status: r.status,
  }));
}

export function listBandEvents(): BandEvent[] {
  const rows = db
    .prepare(
      `SELECT id, band_uid, band_name, title, members, scheduled_at, stage_mode, rsvp_count
       FROM band_events ORDER BY id DESC`
    )
    .all() as Array<{
    id: number;
    band_uid: string;
    band_name: string;
    title: string;
    members: string;
    scheduled_at: string;
    stage_mode: BandEvent['stageMode'];
    rsvp_count: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    bandUid: r.band_uid,
    bandName: r.band_name,
    title: r.title,
    members: r.members,
    scheduledAt: r.scheduled_at,
    stageMode: r.stage_mode,
    rsvpCount: r.rsvp_count,
  }));
}

export function listBrandDrops(): BrandDrop[] {
  const rows = db
    .prepare(
      `SELECT id, band_uid, brand_name, product_title, price_label, stock_count, claimed_count, status
       FROM brand_drops ORDER BY id DESC`
    )
    .all() as Array<{
    id: number;
    band_uid: string;
    brand_name: string;
    product_title: string;
    price_label: string;
    stock_count: number;
    claimed_count: number;
    status: BrandDrop['status'];
  }>;
  return rows.map((r) => ({
    id: r.id,
    bandUid: r.band_uid,
    brandName: r.brand_name,
    productTitle: r.product_title,
    priceLabel: r.price_label,
    stockCount: r.stock_count,
    claimedCount: r.claimed_count,
    status: r.status,
  }));
}

// ---------------------------------------------------------------------------
// Inbox, Auto-E2EE DMs, Groups, Invites, Live Support & Disappearing Messages
// ---------------------------------------------------------------------------

const SUPPORT_UID = 'ST-SUPPORT';
const SUPPORT_NAME = 'StreamLive Live Support';

function getConversationMembers(conversationId: string): InboxMember[] {
  const rows = db
    .prepare(
      `SELECT uid, display_name, role, joined_at
       FROM conversation_members
       WHERE conversation_id = ?
       ORDER BY joined_at ASC`
    )
    .all(conversationId) as Array<{
    uid: string;
    display_name: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: number;
  }>;
  return rows.map((r) => ({
    uid: r.uid,
    displayName: r.display_name,
    role: r.role,
    joinedAt: r.joined_at,
  }));
}

export function isConversationMember(conversationId: string, uid: string): boolean {
  const row = db
    .prepare('SELECT 1 AS ok FROM conversation_members WHERE conversation_id = ? AND uid = ?')
    .get(conversationId, uid);
  return Boolean(row);
}

export function getConversationMemberUids(conversationId: string): string[] {
  const rows = db
    .prepare('SELECT uid FROM conversation_members WHERE conversation_id = ?')
    .all(conversationId) as Array<{ uid: string }>;
  return rows.map((r) => r.uid);
}

function hydrateConversation(conversationId: string, viewerUid: string): InboxConversation | null {
  const conv = db
    .prepare(
      `SELECT c.id, c.type, c.title, c.creator_uid, c.invite_code, c.e2ee_enabled, c.default_ttl_sec, c.updated_at,
              m.last_read_at
       FROM conversations c
       INNER JOIN conversation_members m ON m.conversation_id = c.id AND m.uid = ?
       WHERE c.id = ?`
    )
    .get(viewerUid, conversationId) as
    | {
        id: string;
        type: ConversationType;
        title: string;
        creator_uid: string;
        invite_code: string | null;
        e2ee_enabled: number;
        default_ttl_sec: number;
        updated_at: number;
        last_read_at: number;
      }
    | undefined;
  if (!conv) return null;

  const members = getConversationMembers(conv.id);
  const now = Date.now();

  const lastMsg = db
    .prepare(
      `SELECT kind, encrypted, ciphertext, view_once, consumed, created_at
       FROM inbox_messages
       WHERE conversation_id = ? AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(conv.id, now) as
    | {
        kind: 'text' | 'image' | 'system';
        encrypted: number;
        ciphertext: string | null;
        view_once: number;
        consumed: number;
        created_at: number;
      }
    | undefined;

  const unreadRow = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM inbox_messages
       WHERE conversation_id = ? AND sender_uid != ? AND created_at > ? AND (expires_at IS NULL OR expires_at > ?)`
    )
    .get(conv.id, viewerUid, conv.last_read_at, now) as { c: number };

  let title = conv.title;
  if (conv.type === 'dm') {
    const other = members.find((m) => m.uid !== viewerUid);
    title = other ? other.displayName : conv.title;
  }

  let preview = 'Start encrypted chat';
  if (lastMsg) {
    if (lastMsg.consumed) preview = '1× View-once opened';
    else if (lastMsg.view_once) preview = lastMsg.kind === 'image' ? '1× View-once photo' : '1× View-once message';
    else if (lastMsg.kind === 'image') preview = lastMsg.encrypted ? 'Encrypted photo' : 'Photo';
    else if (lastMsg.encrypted) preview = 'End-to-end encrypted message';
    else preview = (lastMsg.ciphertext || '').slice(0, 56);
  }

  return {
    id: conv.id,
    type: conv.type,
    title,
    creatorUid: conv.creator_uid,
    inviteCode: conv.invite_code ?? undefined,
    e2eeEnabled: Boolean(conv.e2ee_enabled),
    defaultTtlSec: conv.default_ttl_sec,
    members,
    unreadCount: unreadRow.c,
    lastMessagePreview: preview,
    lastMessageAt: lastMsg?.created_at || conv.updated_at,
    updatedAt: conv.updated_at,
  };
}

export function ensureSupportConversation(uid: string, displayName: string): InboxConversation {
  const convId = `sup-${uid}`;
  const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
  const now = Date.now();

  if (!existing) {
    db.prepare(
      `INSERT INTO conversations (id, type, title, creator_uid, invite_code, e2ee_enabled, default_ttl_sec, created_at, updated_at)
       VALUES (?, 'support', ?, ?, NULL, 0, 0, ?, ?)`
    ).run(convId, SUPPORT_NAME, SUPPORT_UID, now, now);

    db.prepare(
      `INSERT OR IGNORE INTO conversation_members (conversation_id, uid, display_name, role, joined_at, last_read_at)
       VALUES (?, ?, ?, 'member', ?, 0), (?, ?, ?, 'owner', ?, ?)`
    ).run(convId, uid, displayName, now, convId, SUPPORT_UID, SUPPORT_NAME, now, now);

    db.prepare(
      `INSERT INTO inbox_messages (id, conversation_id, sender_uid, sender_name, kind, encrypted, ciphertext, iv, view_once, consumed, ttl_sec, expires_at, created_at)
       VALUES (?, ?, ?, ?, 'text', 0, ?, NULL, 0, 0, 0, NULL, ?)`
    ).run(
      `msg-sup-welcome-${crypto.randomBytes(4).toString('hex')}`,
      convId,
      SUPPORT_UID,
      SUPPORT_NAME,
      'Welcome to StreamLive Live Support! Ask anything about Going Live, Camera Pro/Gimbal, Host Admin setup, Groups, or End-to-End Encrypted Chats — our live desk replies right here.',
      now
    );
  }

  return hydrateConversation(convId, uid)!;
}

export function listUserConversations(uid: string, displayName: string): InboxConversation[] {
  ensureSupportConversation(uid, displayName);
  const rows = db
    .prepare(
      `SELECT c.id
       FROM conversations c
       INNER JOIN conversation_members m ON m.conversation_id = c.id
       WHERE m.uid = ?
       ORDER BY (c.type = 'support') DESC, c.updated_at DESC`
    )
    .all(uid) as Array<{ id: string }>;

  return rows
    .map((r) => hydrateConversation(r.id, uid))
    .filter((c): c is InboxConversation => Boolean(c));
}

export function getOrCreateDmConversation(
  userA: { uid: string; displayName: string },
  targetUid: string
): { conversation?: InboxConversation; error?: string } {
  const cleanTarget = targetUid.trim().toUpperCase();
  if (!cleanTarget || cleanTarget === userA.uid) {
    return { error: 'Enter another user UID to start a 1-on-1 encrypted chat.' };
  }
  const targetUser = getUserByUid(cleanTarget);
  const targetName = targetUser?.display_name || cleanTarget;

  const sorted = [userA.uid, cleanTarget].sort();
  const convId = `dm-${sorted[0]}__${sorted[1]}`;
  const now = Date.now();
  const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);

  if (!existing) {
    db.prepare(
      `INSERT INTO conversations (id, type, title, creator_uid, invite_code, e2ee_enabled, default_ttl_sec, created_at, updated_at)
       VALUES (?, 'dm', ?, ?, NULL, 1, 0, ?, ?)`
    ).run(convId, targetName, userA.uid, now, now);

    db.prepare(
      `INSERT OR IGNORE INTO conversation_members (conversation_id, uid, display_name, role, joined_at, last_read_at)
       VALUES (?, ?, ?, 'member', ?, ?), (?, ?, ?, 'member', ?, 0)`
    ).run(convId, userA.uid, userA.displayName, now, now, convId, cleanTarget, targetName, now);

    db.prepare(
      `INSERT INTO inbox_messages (id, conversation_id, sender_uid, sender_name, kind, encrypted, ciphertext, iv, view_once, consumed, ttl_sec, expires_at, created_at)
       VALUES (?, ?, 'SYSTEM', 'Security', 'system', 0, ?, NULL, 0, 0, 0, NULL, ?)`
    ).run(
      `sys-${crypto.randomBytes(4).toString('hex')}`,
      convId,
      'Messages and photos in this 1-on-1 chat are automatically end-to-end encrypted (AES-256-GCM).',
      now
    );
  }

  return { conversation: hydrateConversation(convId, userA.uid) || undefined };
}

export function createGroupConversation(opts: {
  creatorUid: string;
  creatorName: string;
  title: string;
  memberUids: string[];
  defaultTtlSec?: number;
  e2eeEnabled?: boolean;
}): InboxConversation {
  const convId = `grp-${crypto.randomBytes(5).toString('hex')}`;
  const inviteCode = `GRP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const now = Date.now();
  const safeTtl = Math.max(0, Math.min(60 * 60 * 24 * 30, Math.floor(opts.defaultTtlSec || 0)));
  const e2ee = opts.e2eeEnabled !== false ? 1 : 0;

  db.prepare(
    `INSERT INTO conversations (id, type, title, creator_uid, invite_code, e2ee_enabled, default_ttl_sec, created_at, updated_at)
     VALUES (?, 'group', ?, ?, ?, ?, ?, ?, ?)`
  ).run(convId, opts.title.trim().slice(0, 60), opts.creatorUid, inviteCode, e2ee, safeTtl, now, now);

  const insertMember = db.prepare(
    `INSERT OR IGNORE INTO conversation_members (conversation_id, uid, display_name, role, joined_at, last_read_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertMember.run(convId, opts.creatorUid, opts.creatorName, 'owner', now, now);

  const addedNames: string[] = [];
  for (const raw of opts.memberUids) {
    const uid = raw.trim().toUpperCase();
    if (!uid || uid === opts.creatorUid) continue;
    const u = getUserByUid(uid);
    const name = u?.display_name || uid;
    insertMember.run(convId, uid, name, 'member', now, 0);
    addedNames.push(name);
  }

  db.prepare(
    `INSERT INTO inbox_messages (id, conversation_id, sender_uid, sender_name, kind, encrypted, ciphertext, iv, view_once, consumed, ttl_sec, expires_at, created_at)
     VALUES (?, ?, 'SYSTEM', 'Group', 'system', 0, ?, NULL, 0, 0, 0, NULL, ?)`
  ).run(
    `sys-${crypto.randomBytes(4).toString('hex')}`,
    convId,
    `${opts.creatorName} created the group${addedNames.length ? ` with ${addedNames.join(', ')}` : ''}. Invite code: ${inviteCode}`,
    now
  );

  return hydrateConversation(convId, opts.creatorUid)!;
}

export function inviteGroupMembers(
  conversationId: string,
  inviterUid: string,
  inviterName: string,
  memberUids: string[]
): { conversation?: InboxConversation; added: string[]; error?: string } {
  const conv = db.prepare('SELECT id, type FROM conversations WHERE id = ?').get(conversationId) as
    | { id: string; type: ConversationType }
    | undefined;
  if (!conv || conv.type !== 'group') return { added: [], error: 'Group not found.' };
  if (!isConversationMember(conversationId, inviterUid)) {
    return { added: [], error: 'Only group members can invite others.' };
  }

  const now = Date.now();
  const insertMember = db.prepare(
    `INSERT OR IGNORE INTO conversation_members (conversation_id, uid, display_name, role, joined_at, last_read_at)
     VALUES (?, ?, ?, 'member', ?, 0)`
  );
  const added: string[] = [];
  for (const raw of memberUids) {
    const uid = raw.trim().toUpperCase();
    if (!uid || isConversationMember(conversationId, uid)) continue;
    const u = getUserByUid(uid);
    const name = u?.display_name || uid;
    insertMember.run(conversationId, uid, name, now);
    added.push(name);
  }

  if (added.length > 0) {
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
    db.prepare(
      `INSERT INTO inbox_messages (id, conversation_id, sender_uid, sender_name, kind, encrypted, ciphertext, iv, view_once, consumed, ttl_sec, expires_at, created_at)
       VALUES (?, ?, 'SYSTEM', 'Group', 'system', 0, ?, NULL, 0, 0, 0, NULL, ?)`
    ).run(
      `sys-${crypto.randomBytes(4).toString('hex')}`,
      conversationId,
      `${inviterName} invited ${added.join(', ')} to the group.`,
      now
    );
  }

  return {
    conversation: hydrateConversation(conversationId, inviterUid) || undefined,
    added,
  };
}

export function joinGroupByInviteCode(
  inviteCode: string,
  uid: string,
  displayName: string
): { conversation?: InboxConversation; error?: string } {
  const code = inviteCode.trim().toUpperCase();
  const conv = db
    .prepare("SELECT id FROM conversations WHERE invite_code = ? AND type = 'group'")
    .get(code) as { id: string } | undefined;
  if (!conv) return { error: 'Invalid group invite code.' };

  const now = Date.now();
  if (!isConversationMember(conv.id, uid)) {
    db.prepare(
      `INSERT OR IGNORE INTO conversation_members (conversation_id, uid, display_name, role, joined_at, last_read_at)
       VALUES (?, ?, ?, 'member', ?, ?)`
    ).run(conv.id, uid, displayName, now, now);
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conv.id);
    db.prepare(
      `INSERT INTO inbox_messages (id, conversation_id, sender_uid, sender_name, kind, encrypted, ciphertext, iv, view_once, consumed, ttl_sec, expires_at, created_at)
       VALUES (?, ?, 'SYSTEM', 'Group', 'system', 0, ?, NULL, 0, 0, 0, NULL, ?)`
    ).run(
      `sys-${crypto.randomBytes(4).toString('hex')}`,
      conv.id,
      `${displayName} joined via invite code.`,
      now
    );
  }

  return { conversation: hydrateConversation(conv.id, uid) || undefined };
}

export function updateConversationSettings(
  conversationId: string,
  uid: string,
  opts: { defaultTtlSec?: number; title?: string }
): { conversation?: InboxConversation; error?: string } {
  if (!isConversationMember(conversationId, uid)) return { error: 'Not a member of this chat.' };
  const now = Date.now();
  if (typeof opts.defaultTtlSec === 'number') {
    const safeTtl = Math.max(0, Math.min(60 * 60 * 24 * 30, Math.floor(opts.defaultTtlSec)));
    db.prepare('UPDATE conversations SET default_ttl_sec = ?, updated_at = ? WHERE id = ?').run(
      safeTtl,
      now,
      conversationId
    );
  }
  if (typeof opts.title === 'string' && opts.title.trim().length >= 2) {
    db.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND type = 'group'").run(
      opts.title.trim().slice(0, 60),
      now,
      conversationId
    );
  }
  return { conversation: hydrateConversation(conversationId, uid) || undefined };
}

export function listConversationMessages(conversationId: string, viewerUid: string): InboxMessage[] {
  const now = Date.now();
  db.prepare('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND uid = ?').run(
    now,
    conversationId,
    viewerUid
  );

  const rows = db
    .prepare(
      `SELECT id, conversation_id, sender_uid, sender_name, kind, encrypted, ciphertext, iv, view_once, consumed, ttl_sec, expires_at, created_at
       FROM inbox_messages
       WHERE conversation_id = ? AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at ASC
       LIMIT 160`
    )
    .all(conversationId, now) as Array<{
    id: string;
    conversation_id: string;
    sender_uid: string;
    sender_name: string;
    kind: 'text' | 'image' | 'system';
    encrypted: number;
    ciphertext: string | null;
    iv: string | null;
    view_once: number;
    consumed: number;
    ttl_sec: number;
    expires_at: number | null;
    created_at: number;
  }>;

  return rows.map((r) => {
    const isViewOnceHidden = Boolean(r.view_once) && !r.consumed;
    return {
      id: r.id,
      conversationId: r.conversation_id,
      senderUid: r.sender_uid,
      senderName: r.sender_name,
      kind: r.kind,
      encrypted: Boolean(r.encrypted),
      // Never send view-once payload in list fetches until the user explicitly clicks once to consume!
      ciphertext: r.consumed || isViewOnceHidden ? null : r.ciphertext,
      iv: r.consumed || isViewOnceHidden ? null : r.iv,
      viewOnce: Boolean(r.view_once),
      consumed: Boolean(r.consumed),
      ttlSec: r.ttl_sec,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    };
  });
}

export function insertInboxMessage(opts: {
  conversationId: string;
  senderUid: string;
  senderName: string;
  kind: 'text' | 'image' | 'system';
  encrypted: boolean;
  ciphertext: string;
  iv?: string | null;
  viewOnce?: boolean;
  ttlSec?: number;
}): InboxMessage {
  const id = `msg-${crypto.randomBytes(6).toString('hex')}`;
  const now = Date.now();
  const safeTtl = Math.max(0, Math.min(60 * 60 * 24 * 30, Math.floor(opts.ttlSec || 0)));
  const expiresAt = safeTtl > 0 ? now + safeTtl * 1000 : null;
  const viewOnce = opts.viewOnce ? 1 : 0;

  db.prepare(
    `INSERT INTO inbox_messages (id, conversation_id, sender_uid, sender_name, kind, encrypted, ciphertext, iv, view_once, consumed, ttl_sec, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).run(
    id,
    opts.conversationId,
    opts.senderUid,
    opts.senderName,
    opts.kind,
    opts.encrypted ? 1 : 0,
    opts.ciphertext,
    opts.iv || null,
    viewOnce,
    safeTtl,
    expiresAt,
    now
  );

  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, opts.conversationId);
  db.prepare('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND uid = ?').run(
    now,
    opts.conversationId,
    opts.senderUid
  );

  return {
    id,
    conversationId: opts.conversationId,
    senderUid: opts.senderUid,
    senderName: opts.senderName,
    kind: opts.kind,
    encrypted: opts.encrypted,
    ciphertext: viewOnce ? null : opts.ciphertext,
    iv: viewOnce ? null : opts.iv || null,
    viewOnce: Boolean(viewOnce),
    consumed: false,
    ttlSec: safeTtl,
    expiresAt,
    createdAt: now,
  };
}

/**
 * View-Once ("Auto Disappear After One Click"):
 * Reveals payload exactly once, immediately wipes ciphertext & iv from SQLite so it can never be opened again.
 */
export function consumeViewOnceMessage(
  messageId: string,
  viewerUid: string
): {
  ok: boolean;
  conversationId?: string;
  kind?: 'text' | 'image';
  encrypted?: boolean;
  ciphertext?: string | null;
  iv?: string | null;
  error?: string;
} {
  const row = db
    .prepare(
      `SELECT id, conversation_id, sender_uid, kind, encrypted, ciphertext, iv, view_once, consumed, expires_at
       FROM inbox_messages WHERE id = ?`
    )
    .get(messageId) as
    | {
        id: string;
        conversation_id: string;
        sender_uid: string;
        kind: 'text' | 'image';
        encrypted: number;
        ciphertext: string | null;
        iv: string | null;
        view_once: number;
        consumed: number;
        expires_at: number | null;
      }
    | undefined;

  if (!row) return { ok: false, error: 'Message already vanished.' };
  if (!isConversationMember(row.conversation_id, viewerUid)) {
    return { ok: false, error: 'Access denied.' };
  }
  if (!row.view_once) return { ok: false, error: 'Not a view-once message.' };
  if (row.consumed || !row.ciphertext) {
    return { ok: false, error: 'Already opened and vanished.' };
  }
  if (row.expires_at && row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM inbox_messages WHERE id = ?').run(messageId);
    return { ok: false, error: 'Message expired.' };
  }

  // Permanently wipe payload on first click!
  db.prepare('UPDATE inbox_messages SET consumed = 1, ciphertext = NULL, iv = NULL WHERE id = ?').run(messageId);

  return {
    ok: true,
    conversationId: row.conversation_id,
    kind: row.kind,
    encrypted: Boolean(row.encrypted),
    ciphertext: row.ciphertext,
    iv: row.iv,
  };
}

export function deleteInboxMessage(messageId: string, requesterUid: string): { ok: boolean; conversationId?: string } {
  const row = db.prepare('SELECT conversation_id, sender_uid FROM inbox_messages WHERE id = ?').get(messageId) as
    | { conversation_id: string; sender_uid: string }
    | undefined;
  if (!row || row.sender_uid !== requesterUid) return { ok: false };
  db.prepare('DELETE FROM inbox_messages WHERE id = ?').run(messageId);
  return { ok: true, conversationId: row.conversation_id };
}

export function purgeExpiredInboxMessages(): Array<{ id: string; conversationId: string }> {
  const now = Date.now();
  const expired = db
    .prepare('SELECT id, conversation_id FROM inbox_messages WHERE expires_at IS NOT NULL AND expires_at <= ?')
    .all(now) as Array<{ id: string; conversation_id: string }>;
  if (expired.length > 0) {
    db.prepare('DELETE FROM inbox_messages WHERE expires_at IS NOT NULL AND expires_at <= ?').run(now);
  }
  return expired.map((r) => ({ id: r.id, conversationId: r.conversation_id }));
}

export function buildLiveSupportReply(userText: string): string {
  const q = userText.toLowerCase();
  if (/encrypt|e2ee|whatsapp|privacy|safe|security/.test(q)) {
    return 'All 1-on-1 chats in StreamLive Inbox are automatically protected with AES-256-GCM end-to-end encryption. Tap the Shield icon in any 1-on-1 chat to verify your 60-digit Safety Number, enable Disappearing Timers, or toggle 1× View-Once for photos and messages.';
  }
  if (/group|invite|member/.test(q)) {
    return 'To create a group, tap "New Group" in Inbox and select members from the directory or enter UIDs. Inside any group, tap "Invite" to add more members directly or copy the shareable Group Invite Code (GRP-XXXXXX).';
  }
  if (/admin|host|password|delegate|role/.test(q)) {
    return 'Hosts can promote any user UID to Admin from Workspace → Host Panel and assign a Host-provided password plus granular permissions. That user then signs in under the Admin tab using their own UID + the Host password.';
  }
  if (/camera|gimbal|reel|flash|mic|anc|b-roll|dual/.test(q)) {
    return 'Open the Camera tab for full-screen native capture: switch Auto/Custom/Pro, 480p–8K, Reels formats, Dual Photo/Video with draggable B-Roll, BNC+ANC mics, TTL/BLE/Wi-Fi flash sync, and 3-axis Gimbal stabilization.';
  }
  if (/live|stream|game|fps|ludo|snake/.test(q)) {
    return 'Hosts & Bands can start a broadcast from Workspace or directly inside the Camera tab (LIVE button). You can attach 3D FPS, Ludo, or Snakes right inside your stream and approve Follower join requests live.';
  }
  return 'Thanks for reaching out to StreamLive Live Support! A support specialist has logged your message right in this thread. Ask about Go Live, Camera & Gimbal, Host Admin controls, Groups, or End-to-End Encrypted messaging anytime.';
}

export { hydrateConversation };


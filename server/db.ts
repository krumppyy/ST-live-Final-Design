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
  DirectoryUser,
  Livestream,
  UserRole,
} from '../src/types';

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
  `);

  seedInitialData();
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
  const rows = db
    .prepare('SELECT uid, display_name, role FROM users ORDER BY created_at DESC LIMIT 60')
    .all() as Array<{ uid: string; display_name: string; role: UserRole }>;
  return rows.map((r) => ({
    uid: r.uid,
    displayName: r.display_name,
    role: r.role,
  }));
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
  const user = getUserByUid(payload.uid);
  if (!user) return null;

  if (payload.role === 'admin' && payload.assignedHostUid) {
    const grant = getActiveGrant(payload.assignedHostUid, payload.uid);
    if (!grant) return null;
    return {
      token: token!,
      uid: user.uid,
      displayName: user.display_name,
      role: 'admin',
      coins: user.coins,
      diamonds: user.diamonds,
      assignedHostUid: grant.host_uid,
      assignedHostName: grant.host_name,
      permissions: parsePermissions(grant.permissions_json),
    };
  }

  return {
    token: token!,
    uid: user.uid,
    displayName: user.display_name,
    role: payload.role,
    coins: user.coins,
    diamonds: user.diamonds,
  };
}

export function listAllStreams(): Omit<Livestream, 'seats' | 'pk'>[] {
  const rows = db
    .prepare(
      `SELECT id, host_uid, host_name, title, category, language, viewer_count, thumbnail, is_live, max_seats, game_room_id, game_type
       FROM streams
       WHERE is_live = 1
       ORDER BY viewer_count DESC`
    )
    .all() as Array<{
    id: string;
    host_uid: string;
    host_name: string;
    title: string;
    category: Livestream['category'];
    language: string;
    viewer_count: number;
    thumbnail: string;
    is_live: number;
    max_seats: number;
    game_room_id: string | null;
    game_type: 'ludo' | 'snakes' | 'fps' | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    hostUid: r.host_uid,
    hostName: r.host_name,
    title: r.title,
    category: r.category,
    language: r.language,
    viewerCount: r.viewer_count,
    thumbnail: r.thumbnail,
    isLive: Boolean(r.is_live),
    maxSeats: r.max_seats,
    gameRoomId: r.game_room_id ?? undefined,
    gameType: r.game_type ?? undefined,
  }));
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

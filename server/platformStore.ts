import crypto from 'crypto';
import { db, hashPassword, verifyPassword, signSessionToken, getActiveGrant, parsePermissions } from './db';
import {
  BAN_LADDER_MS,
  CASH_RATE_DIAMONDS_PER_USD,
  GIFTS_CATALOG,
  GLOBAL_DAILY_MINT_CAP,
  LIVE_MONEY_ENABLED,
  MAX_APPEALS,
  MAX_BALANCE_CAP,
  MAX_ROOM_ADMINS,
  MAX_ROOM_BLOCKS,
  MIN_PAYOUT_DIAMONDS,
  PRIVATE_ROOM_TOKEN_COST,
  SHOP_PERKS,
  START_COINS,
  TOPUP_PACKS,
  USER_DAILY_MINT_CAP,
  VIP_PLANS,
  WATCH_TOKEN_DAILY_CAP,
  levelFromXp,
  maskEmail,
  maskPhone,
  maskWallet,
  priceAfterDiscount,
} from './security';
import type {
  AadsStatus,
  AuditLogEntry,
  AuthSession,
  BannerPlacement,
  BannerSize,
  DirectoryUser,
  HostDailyTask,
  Livestream,
  PasswordResetRecord,
  PayoutRecord,
  PublicUserProfile,
  RoomVisitor,
  SafetyAppeal,
  SafetyReport,
  TeamDoorTier,
  UserRole,
  VipTier,
} from '../src/types';

function addColIfMissing(table: string, col: string, defSql: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${defSql}`);
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function initPlatformStore(): void {
  // 1. Additive columns on users
  addColIfMissing('users', 'numeric_id', 'INTEGER');
  addColIfMissing('users', 'email', 'TEXT');
  addColIfMissing('users', 'phone', 'TEXT');
  addColIfMissing('users', 'country_code', "TEXT NOT NULL DEFAULT 'US'");
  addColIfMissing('users', 'tokens', 'INTEGER NOT NULL DEFAULT 20');
  addColIfMissing('users', 'xp', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'vip_tier', "TEXT NOT NULL DEFAULT 'none'");
  addColIfMissing('users', 'vip_until', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'is_pro', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'verified', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'free_pin_trials', 'INTEGER NOT NULL DEFAULT 3');
  addColIfMissing('users', 'daily_streak', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'last_checkin_date', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'watch_tokens_date', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'watch_tokens_today', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'totp_secret', 'TEXT');
  addColIfMissing('users', 'totp_enabled', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'owned_perks_json', "TEXT NOT NULL DEFAULT '[]'");
  addColIfMissing('users', 'monetag_status', "TEXT NOT NULL DEFAULT 'none'");
  addColIfMissing('users', 'monetag_email', 'TEXT');
  addColIfMissing('users', 'monetag_pub_id', 'TEXT');
  addColIfMissing('users', 'monetag_tip_url', 'TEXT');
  addColIfMissing('users', 'bio', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'age', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'gender', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'hobbies', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'show_age', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'show_gender', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'show_followers', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'show_visits', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'allow_dm', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'banner_pos', "TEXT NOT NULL DEFAULT 'lower'");
  addColIfMissing('users', 'banner_size', "TEXT NOT NULL DEFAULT '728x90'");
  addColIfMissing('users', 'banned_until', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'ban_strikes', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'pw_stretched', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'last_payout_at', 'INTEGER NOT NULL DEFAULT 0');
  // Rich Creator Biodata/CV, Avatars/Covers, Visibility Toggles & A-ADS Partner Integration
  addColIfMissing('users', 'avatar_url', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'cover_url', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'headline', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'location', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'languages', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'skills', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'schedule', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'website_url', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('users', 'show_bio', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'show_location', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'show_languages', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'show_skills', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'show_schedule', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'show_hobbies', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'show_website', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('users', 'aads_status', "TEXT NOT NULL DEFAULT 'none'");
  addColIfMissing('users', 'aads_email', 'TEXT');
  addColIfMissing('users', 'aads_unit_id', 'TEXT');
  addColIfMissing('users', 'aads_banner_pos', "TEXT NOT NULL DEFAULT 'below_stage'");
  addColIfMissing('users', 'aads_banner_size', "TEXT NOT NULL DEFAULT '728x90'");
  addColIfMissing('users', 'monetag_checklist_at', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('users', 'aads_checklist_at', 'INTEGER NOT NULL DEFAULT 0');

  // 2. Additive columns on streams
  addColIfMissing('streams', 'country_code', "TEXT NOT NULL DEFAULT 'US'");
  addColIfMissing('streams', 'pin_hash', 'TEXT');
  addColIfMissing('streams', 'is_locked', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('streams', 'consent_verified', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('streams', 'created_at', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('streams', 'total_gifts_coins', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('streams', 'view_minutes', 'INTEGER NOT NULL DEFAULT 0');

  // 3. New persistent tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_keys (
      tier TEXT PRIMARY KEY,
      key_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_uid TEXT NOT NULL,
      host_uid TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (follower_uid, host_uid)
    );
    CREATE INDEX IF NOT EXISTS idx_follows_host ON follows(host_uid);

    CREATE TABLE IF NOT EXISTS room_blocks (
      room_id TEXT NOT NULL,
      host_uid TEXT NOT NULL,
      blocked_uid TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (host_uid, blocked_uid)
    );

    CREATE TABLE IF NOT EXISTS room_admins (
      room_id TEXT NOT NULL,
      host_uid TEXT NOT NULL,
      admin_uid TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (room_id, admin_uid)
    );

    CREATE TABLE IF NOT EXISTS room_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      host_uid TEXT NOT NULL,
      visitor_uid TEXT NOT NULL,
      visitor_name TEXT NOT NULL,
      visited_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_visits_room ON room_visits(room_id, visited_at DESC);

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      target_uid TEXT NOT NULL,
      reporter_uid TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(room_id, reporter_uid)
    );

    CREATE TABLE IF NOT EXISTS appeals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      display_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      staff_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payout_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      display_name TEXT NOT NULL,
      diamonds INTEGER NOT NULL,
      usd_amount REAL NOT NULL,
      method TEXT NOT NULL,
      destination_raw TEXT NOT NULL,
      destination_masked TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      contact_masked TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_uid TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      meta_masked TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mint_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_key TEXT NOT NULL,
      uid TEXT NOT NULL,
      amount INTEGER NOT NULL,
      source TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mint_date ON mint_ledger(date_key, uid);

    CREATE TABLE IF NOT EXISTS topup_claims (
      claim_key TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      coins INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS host_daily_tasks (
      uid TEXT NOT NULL,
      task_date TEXT NOT NULL,
      task_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (uid, task_date, task_id)
    );
  `);

  // 4. Backfill numeric #IDs, countries, verified badges & stream countries on existing seeds
  const usersWithoutId = db
    .prepare('SELECT uid FROM users WHERE numeric_id IS NULL ORDER BY created_at ASC')
    .all() as Array<{ uid: string }>;
  const countryDefaults: Record<string, string> = {
    'ST-1001': 'US',
    'ST-1002': 'CA',
    'ST-1003': 'IN',
    'ST-2001': 'IN',
    'ST-2002': 'ES',
    'ST-2003': 'JP',
    'ST-3001': 'GB',
    'ST-4001': 'US',
  };
  let nextNum = 100100;
  const maxRow = db.prepare('SELECT MAX(numeric_id) as m FROM users').get() as { m: number | null };
  if (maxRow?.m && maxRow.m >= 100100) nextNum = maxRow.m + 1;

  for (const row of usersWithoutId) {
    const cc = countryDefaults[row.uid] || 'US';
    const isVerified = ['ST-1001', 'ST-1002', 'ST-1003', 'ST-4001'].includes(row.uid) ? 1 : 0;
    const starterXp = isVerified ? 2600 : 120;
    db.prepare(
      'UPDATE users SET numeric_id = ?, country_code = ?, verified = ?, xp = CASE WHEN xp = 0 THEN ? ELSE xp END WHERE uid = ?'
    ).run(nextNum++, cc, isVerified, starterXp, row.uid);
  }

  // Assign rich diverse country codes to seeded streams so Explore All Flags shines immediately
  const streamCountries: Array<[string, string, number]> = [
    ['room-solo-maya', 'US', 1850],
    ['room-multiguest-lounge', 'CA', 2400],
    ['room-band-velvet', 'GB', 4100],
    ['room-gaming-rohan', 'IN', 3200],
    ['room-pk-clash', 'ES', 5120],
    ['room-brand-aethel', 'DE', 1600],
    ['room-audio-night', 'AE', 980],
    ['room-esports-pro', 'JP', 2890],
  ];
  const now = Date.now();
  for (let i = 0; i < streamCountries.length; i++) {
    const [sid, cc, gifts] = streamCountries[i];
    db.prepare(
      `UPDATE streams
       SET country_code = CASE WHEN country_code = 'US' AND id != 'room-solo-maya' THEN ? ELSE country_code END,
           created_at = CASE WHEN created_at = 0 THEN ? ELSE created_at END,
           total_gifts_coins = CASE WHEN total_gifts_coins = 0 THEN ? ELSE total_gifts_coins END
       WHERE id = ?`
    ).run(cc, now - (i + 1) * 900_000, gifts, sid);
  }

  // Ensure a staff moderator account exists for Test Mode
  const staffExists = db.prepare("SELECT uid FROM users WHERE uid = 'ST-STAFF'").get();
  if (!staffExists) {
    db.prepare(
      `INSERT OR IGNORE INTO users (uid, display_name, role, password_hash, coins, diamonds, tokens, xp, verified, country_code, numeric_id, vip_tier, vip_until)
       VALUES ('ST-STAFF', 'Safety Desk', 'staff', NULL, 50000, 0, 500, 15000, 1, 'US', 100001, 'lifetime', ?)`
    ).run(Date.now() + 100 * 365 * 24 * 3600 * 1000);
  }

  // Seed default host avatars, cover banners & rich creator biodata/CV on showcase accounts (only if empty)
  const profileSeeds: Array<{
    uid: string;
    avatar: string;
    cover: string;
    headline: string;
    bio: string;
    location: string;
    languages: string;
    skills: string;
    schedule: string;
  }> = [
    {
      uid: 'ST-1001',
      avatar: '/src/assets/images/stream_solo_studio_1795687719501.jpg',
      cover: '/src/assets/images/stream_solo_studio_1795687719501.jpg',
      headline: 'Live Cinema Host & Color Grading Mentor',
      bio: 'Daily studio Q&As, LUT breakdowns, live Ludo matches, and creator monetization coaching.',
      location: 'Los Angeles, USA',
      languages: 'English, Mandarin',
      skills: 'Color Grading, Live Q&A, Dual Camera, Ludo Pro',
      schedule: 'Mon–Sat · 10:00 AM PST',
    },
    {
      uid: 'ST-1002',
      avatar: '/src/assets/images/stream_multiguest_podcast_1795687722768.jpg',
      cover: '/src/assets/images/stream_multiguest_podcast_1795687722768.jpg',
      headline: 'Multi-Guest Podcast Producer & Audio Engineer',
      bio: 'Hosting creator panels, ANC audio workshops, and live roundtable interviews.',
      location: 'Toronto, Canada',
      languages: 'English, French',
      skills: 'Podcasting, Audio Mixing, Panel Hosting, Co-Host',
      schedule: 'Tue–Sun · 6:00 PM EST',
    },
    {
      uid: 'ST-1003',
      avatar: '/src/assets/images/stream_gaming_arena_1795687722196.jpg',
      cover: '/src/assets/images/stream_gaming_arena_1795687722196.jpg',
      headline: 'ST Strike 3D & Co-Op RPG Live Champion',
      bio: 'Interactive viewer game lobbies, 5-floor Realm Quest dungeon runs, and esports shoutcasting.',
      location: 'Bengaluru, India',
      languages: 'English, Hindi',
      skills: 'ST Strike 3D, Realm RPG, Tactics, Speedruns',
      schedule: 'Daily · 8:00 PM IST',
    },
    {
      uid: 'ST-4001',
      avatar: '/src/assets/images/stream_band_live_1795687720929.jpg',
      cover: '/src/assets/images/stream_band_live_1795687720929.jpg',
      headline: 'Indie Synth & Acoustic Live Band',
      bio: 'Full-band rehearsal streams, multi-cam live concerts, and exclusive backstage merch drops.',
      location: 'London, UK',
      languages: 'English',
      skills: 'Live Music, Synth, Vocals, Multi-Cam Stage',
      schedule: 'Fri–Sun · 9:00 PM GMT',
    },
    {
      uid: 'ST-3001',
      avatar: '/src/assets/images/stream_brand_showcase_1795687724180.jpg',
      cover: '/src/assets/images/stream_brand_showcase_1795687724180.jpg',
      headline: 'Creator Talent & Brand Partnerships',
      bio: 'Managing top live hosts, agency recruitment, and sponsor campaigns worldwide.',
      location: 'London, UK',
      languages: 'English, German, Spanish',
      skills: 'Talent Management, Sponsorships, Growth Strategy',
      schedule: 'Mon–Fri · 9:00 AM GMT',
    },
  ];
  for (const seed of profileSeeds) {
    db.prepare(
      `UPDATE users
       SET avatar_url = CASE WHEN avatar_url = '' THEN ? ELSE avatar_url END,
           cover_url = CASE WHEN cover_url = '' THEN ? ELSE cover_url END,
           headline = CASE WHEN headline = '' THEN ? ELSE headline END,
           bio = CASE WHEN bio = '' THEN ? ELSE bio END,
           location = CASE WHEN location = '' THEN ? ELSE location END,
           languages = CASE WHEN languages = '' THEN ? ELSE languages END,
           skills = CASE WHEN skills = '' THEN ? ELSE skills END,
           schedule = CASE WHEN schedule = '' THEN ? ELSE schedule END
       WHERE uid = ?`
    ).run(
      seed.avatar,
      seed.cover,
      seed.headline,
      seed.bio,
      seed.location,
      seed.languages,
      seed.skills,
      seed.schedule,
      seed.uid
    );
  }
}

export function allocateNumericId(): number {
  const row = db.prepare('SELECT MAX(numeric_id) as m FROM users').get() as { m: number | null };
  return Math.max(100100, (row?.m ?? 100099) + 1);
}

export function writeAuditLog(actorUid: string, action: string, target: string, metaMasked = '') {
  db.prepare(
    'INSERT INTO audit_logs (actor_uid, action, target, meta_masked) VALUES (?, ?, ?, ?)'
  ).run(actorUid, action.slice(0, 60), target.slice(0, 80), metaMasked.slice(0, 180));
  // Keep audit ring bounded to 200 entries (G-083)
  db.prepare(
    'DELETE FROM audit_logs WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY id DESC LIMIT 200)'
  ).run();
}

export function listAuditLogs(): AuditLogEntry[] {
  const rows = db
    .prepare('SELECT id, actor_uid, action, target, meta_masked, created_at FROM audit_logs ORDER BY id DESC LIMIT 120')
    .all() as Array<{
    id: number;
    actor_uid: string;
    action: string;
    target: string;
    meta_masked: string;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    actorUid: r.actor_uid,
    action: r.action,
    target: r.target,
    metaMasked: r.meta_masked,
    createdAt: r.created_at,
  }));
}

export function getFullUserRow(uid: string) {
  return db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as Record<string, any> | undefined;
}

export function findUserByIdentifier(identifier: string) {
  const clean = identifier.trim();
  if (!clean) return undefined;
  const lower = clean.toLowerCase();
  const numericMatch = clean.replace(/^#/, '');
  if (/^\d{5,9}$/.test(numericMatch)) {
    const byNum = db.prepare('SELECT * FROM users WHERE numeric_id = ?').get(Number(numericMatch)) as
      | Record<string, any>
      | undefined;
    if (byNum) return byNum;
  }
  return db
    .prepare(
      `SELECT * FROM users
       WHERE LOWER(uid) = ? OR LOWER(email) = ? OR phone = ? OR LOWER(display_name) = ?
       LIMIT 1`
    )
    .get(lower, lower, clean, lower) as Record<string, any> | undefined;
}

export function hydrateAuthSession(
  token: string,
  uid: string,
  roleOverride?: UserRole,
  assignedHostUid?: string,
  isTestMode?: boolean
): AuthSession | null {
  const u = getFullUserRow(uid);
  if (!u) return null;
  const now = Date.now();
  const vipActive = Number(u.vip_until || 0) > now;
  let ownedPerks: string[] = [];
  try {
    ownedPerks = JSON.parse(u.owned_perks_json || '[]');
  } catch {
    ownedPerks = [];
  }

  const monetagVerified = u.monetag_status === 'verified';
  const aadsVerified = u.aads_status === 'verified';
  const partnerVerified = monetagVerified || aadsVerified;

  const base: AuthSession = {
    token,
    uid: u.uid,
    numericId: Number(u.numeric_id || 100100),
    displayName: u.display_name,
    role: (roleOverride || u.role) as UserRole,
    countryCode: u.country_code || 'US',
    emailMasked: u.email ? maskEmail(u.email) : undefined,
    phoneMasked: u.phone ? maskPhone(u.phone) : undefined,
    coins: Number(u.coins || 0),
    diamonds: Number(u.diamonds || 0),
    tokens: Number(u.tokens || 0),
    xp: Number(u.xp || 0),
    level: levelFromXp(Number(u.xp || 0)),
    vipTier: (vipActive ? u.vip_tier || 'monthly' : 'none') as VipTier,
    vipUntil: vipActive ? Number(u.vip_until || 0) : 0,
    isPro: Boolean(u.is_pro),
    verified: Boolean(u.verified) || partnerVerified,
    partnerVerified,
    freePinTrials: Number(u.free_pin_trials ?? 3),
    dailyStreak: Number(u.daily_streak || 0),
    checkedInToday: u.last_checkin_date === todayKey(),
    totpEnabled: Boolean(u.totp_enabled),
    ownedPerks,
    monetagStatus: (u.monetag_status || 'none') as AuthSession['monetagStatus'],
    monetagEmail: u.monetag_email || undefined,
    monetagPublisherId: u.monetag_pub_id || undefined,
    monetagTipUrl: u.monetag_tip_url || undefined,
    aadsStatus: (u.aads_status || 'none') as AadsStatus,
    aadsEmail: u.aads_email || undefined,
    aadsUnitId: u.aads_unit_id || undefined,
    aadsBannerPos: (['top', 'lower', 'corner', 'below_stage'].includes(u.aads_banner_pos)
      ? u.aads_banner_pos
      : 'below_stage') as BannerPlacement,
    aadsBannerSize: (['728x90', '468x60', '300x250', '320x50'].includes(u.aads_banner_size)
      ? u.aads_banner_size
      : '728x90') as BannerSize,
    avatarUrl: u.avatar_url || undefined,
    coverUrl: u.cover_url || undefined,
    headline: u.headline || '',
    location: u.location || '',
    languages: u.languages || '',
    skills: u.skills || '',
    schedule: u.schedule || '',
    websiteUrl: u.website_url || '',
    bio: u.bio || '',
    age: u.age || '',
    gender: u.gender || '',
    hobbies: u.hobbies || '',
    showBio: u.show_bio !== 0,
    showAge: Boolean(u.show_age),
    showGender: Boolean(u.show_gender),
    showLocation: u.show_location !== 0,
    showLanguages: u.show_languages !== 0,
    showSkills: u.show_skills !== 0,
    showSchedule: u.show_schedule !== 0,
    showHobbies: u.show_hobbies !== 0,
    showWebsite: u.show_website !== 0,
    showFollowers: u.show_followers !== 0,
    showVisits: u.show_visits !== 0,
    allowDm: u.allow_dm !== 0,
    bannerPos: (['top', 'lower', 'corner', 'below_stage'].includes(u.banner_pos)
      ? u.banner_pos
      : 'below_stage') as BannerPlacement,
    bannerSize: (['728x90', '468x60', '300x250', '320x50'].includes(u.banner_size)
      ? u.banner_size
      : '728x90') as BannerSize,
    bannedUntil: Number(u.banned_until || 0),
    banStrikes: Number(u.ban_strikes || 0),
    isTestMode: Boolean(isTestMode),
  };

  if (base.role === 'admin' && assignedHostUid) {
    const grant = getActiveGrant(assignedHostUid, uid);
    if (!grant) return null;
    base.assignedHostUid = grant.host_uid;
    base.assignedHostName = grant.host_name;
    base.permissions = parsePermissions(grant.permissions_json);
  }
  return base;
}

export function listExtendedStreams(): Omit<Livestream, 'seats' | 'pk'>[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.host_uid, s.host_name, s.title, s.category, s.language, s.country_code,
              s.viewer_count, s.thumbnail, s.is_live, s.max_seats, s.game_room_id, s.game_type,
              s.is_locked, s.consent_verified, s.created_at, s.total_gifts_coins, s.view_minutes,
              u.numeric_id as host_numeric_id, u.verified as host_verified,
              u.avatar_url as host_avatar_url,
              CASE WHEN u.monetag_status = 'verified' OR u.aads_status = 'verified' THEN 1 ELSE 0 END as host_partner_verified,
              CASE WHEN u.monetag_status = 'verified' THEN u.monetag_tip_url ELSE NULL END as host_tip_url,
              CASE WHEN u.aads_status = 'verified' THEN u.aads_unit_id ELSE NULL END as host_aads_unit_id,
              u.aads_banner_pos as host_aads_banner_pos,
              u.aads_banner_size as host_aads_banner_size,
              (SELECT COUNT(*) FROM follows f WHERE f.host_uid = s.host_uid) as follower_count
       FROM streams s
       LEFT JOIN users u ON u.uid = s.host_uid
       WHERE s.is_live = 1
       ORDER BY s.viewer_count DESC`
    )
    .all() as Array<Record<string, any>>;

  return rows.map((r) => ({
    id: r.id,
    hostUid: r.host_uid,
    hostNumericId: Number(r.host_numeric_id || 100100),
    hostName: r.host_name,
    hostAvatarUrl: r.host_avatar_url || undefined,
    hostVerified: Boolean(r.host_verified) || Boolean(r.host_partner_verified),
    hostPartnerVerified: Boolean(r.host_partner_verified),
    hostMonetagTipUrl: r.host_tip_url || undefined,
    hostAadsUnitId: r.host_aads_unit_id || undefined,
    hostAadsBannerPos: (['top', 'lower', 'corner', 'below_stage'].includes(r.host_aads_banner_pos)
      ? r.host_aads_banner_pos
      : 'below_stage') as BannerPlacement,
    hostAadsBannerSize: (['728x90', '468x60', '300x250', '320x50'].includes(r.host_aads_banner_size)
      ? r.host_aads_banner_size
      : '728x90') as BannerSize,
    countryCode: r.country_code || 'US',
    title: r.title,
    category: r.category,
    language: r.language,
    viewerCount: Math.min(1_000_000, Number(r.viewer_count || 1)),
    thumbnail: r.thumbnail,
    isLive: Boolean(r.is_live),
    isFull: Number(r.viewer_count || 0) >= 1_000_000,
    isLocked: Boolean(r.is_locked),
    consentVerified: r.consent_verified !== 0,
    createdAt: Number(r.created_at || Date.now()),
    totalGiftsCoins: Number(r.total_gifts_coins || 0),
    viewMinutes: Number(r.view_minutes || 0),
    followerCount: Number(r.follower_count || 0),
    maxSeats: Number(r.max_seats || 4),
    gameRoomId: r.game_room_id ?? undefined,
    gameType: r.game_type ?? undefined,
  }));
}

export function addStreamViewMinutesDb(roomId: string, minutes = 1): void {
  const safeMin = Math.max(1, Math.min(5, Math.floor(minutes)));
  db.prepare('UPDATE streams SET view_minutes = view_minutes + ? WHERE id = ? AND is_live = 1').run(
    safeMin,
    roomId
  );
}

export function listExtendedDirectoryUsers(): DirectoryUser[] {
  const rows = db
    .prepare(
      'SELECT uid, numeric_id, display_name, role, country_code, verified, avatar_url FROM users ORDER BY created_at DESC LIMIT 80'
    )
    .all() as Array<Record<string, any>>;
  return rows.map((r) => ({
    uid: r.uid,
    numericId: Number(r.numeric_id || 100100),
    displayName: r.display_name,
    role: r.role as UserRole,
    countryCode: r.country_code || 'US',
    verified: Boolean(r.verified),
    avatarUrl: r.avatar_url || undefined,
  }));
}

// ---------------------------------------------------------------------------
// Public Creator Biodata / CV Profile (Strictly Enforces User Visibility Toggles)
// ---------------------------------------------------------------------------

export function getPublicUserProfileDb(uid: string): PublicUserProfile | null {
  const u = getFullUserRow(uid);
  if (!u) return null;
  const followerCount = (
    db.prepare('SELECT COUNT(*) as c FROM follows WHERE host_uid = ?').get(uid) as { c: number }
  ).c;
  const liveStream = db
    .prepare('SELECT id FROM streams WHERE host_uid = ? AND is_live = 1 ORDER BY viewer_count DESC LIMIT 1')
    .get(uid) as { id: string } | undefined;

  const monetagVerified = u.monetag_status === 'verified';
  const aadsVerified = u.aads_status === 'verified';
  const partnerVerified = monetagVerified || aadsVerified;

  return {
    uid: u.uid,
    numericId: Number(u.numeric_id || 100100),
    displayName: u.display_name,
    role: u.role as UserRole,
    countryCode: u.country_code || 'US',
    level: levelFromXp(Number(u.xp || 0)),
    xp: Number(u.xp || 0),
    verified: Boolean(u.verified) || partnerVerified,
    partnerVerified,
    monetagVerified,
    aadsVerified,
    isVip: Number(u.vip_until || 0) > Date.now(),
    isPro: Boolean(u.is_pro),
    avatarUrl: u.avatar_url || undefined,
    coverUrl: u.cover_url || undefined,
    headline: u.headline || undefined,
    bio: u.show_bio !== 0 && u.bio ? u.bio : undefined,
    age: u.show_age ? u.age || undefined : undefined,
    gender: u.show_gender ? u.gender || undefined : undefined,
    location: u.show_location !== 0 && u.location ? u.location : undefined,
    languages: u.show_languages !== 0 && u.languages ? u.languages : undefined,
    skills: u.show_skills !== 0 && u.skills ? u.skills : undefined,
    schedule: u.show_schedule !== 0 && u.schedule ? u.schedule : undefined,
    hobbies: u.show_hobbies !== 0 && u.hobbies ? u.hobbies : undefined,
    websiteUrl: u.show_website !== 0 && u.website_url ? u.website_url : undefined,
    followerCount: u.show_followers !== 0 ? followerCount : undefined,
    allowDm: u.allow_dm !== 0,
    liveStreamId: liveStream?.id,
  };
}

// ---------------------------------------------------------------------------
// Daily Host Tasks Engine (Progressive XP + Coins + Tokens Rewards)
// ---------------------------------------------------------------------------

interface DailyTaskDef {
  id: string;
  title: string;
  description: string;
  category: HostDailyTask['category'];
  target: number;
  rewardXp: number;
  rewardCoins: number;
  rewardTokens: number;
}

const DAILY_TASK_DEFS: DailyTaskDef[] = [
  {
    id: 'daily_checkin',
    title: 'Daily Host Check-In',
    description: 'Claim your daily check-in streak bonus to keep your creator momentum active.',
    category: 'community',
    target: 1,
    rewardXp: 45,
    rewardCoins: 150,
    rewardTokens: 10,
  },
  {
    id: 'polish_profile',
    title: 'Update Creator Biodata / Avatar',
    description: 'Set your profile picture, cover banner, or public biodata/CV details.',
    category: 'profile',
    target: 1,
    rewardXp: 65,
    rewardCoins: 200,
    rewardTokens: 12,
  },
  {
    id: 'go_live_session',
    title: 'Go Live or Host a Room',
    description: 'Launch a livestream broadcast from Studio or Camera to engage your audience.',
    category: 'stream',
    target: 1,
    rewardXp: 120,
    rewardCoins: 350,
    rewardTokens: 20,
  },
  {
    id: 'engage_chat',
    title: 'Engage Audience in Chat',
    description: 'Send 3 live room chat messages to welcome viewers and boost watch time.',
    category: 'community',
    target: 3,
    rewardXp: 80,
    rewardCoins: 220,
    rewardTokens: 14,
  },
  {
    id: 'host_live_game',
    title: 'Launch an Interactive Live Game',
    description: 'Start ST Strike 3D, Realm Quest RPG, Ludo, or Snakes inside a live broadcast.',
    category: 'game',
    target: 1,
    rewardXp: 110,
    rewardCoins: 300,
    rewardTokens: 18,
  },
  {
    id: 'partner_setup',
    title: 'Activate Free-to-Earn Setup',
    description: 'Connect Monetag Free Tip or A-ADS custom banner placement for verified earning.',
    category: 'monetize',
    target: 1,
    rewardXp: 150,
    rewardCoins: 400,
    rewardTokens: 25,
  },
];

export function incrementHostDailyTaskDb(uid: string, taskId: string, delta = 1): void {
  const def = DAILY_TASK_DEFS.find((t) => t.id === taskId);
  if (!def || !uid) return;
  const dateKey = todayKey();
  const safeDelta = Math.max(1, Math.min(10, Math.floor(delta)));
  db.prepare(
    `INSERT INTO host_daily_tasks (uid, task_date, task_id, progress, claimed, updated_at)
     VALUES (?, ?, ?, MIN(?, ?), 0, ?)
     ON CONFLICT(uid, task_date, task_id) DO UPDATE SET
       progress = MIN(?, host_daily_tasks.progress + ?),
       updated_at = excluded.updated_at`
  ).run(uid, dateKey, taskId, def.target, safeDelta, Date.now(), def.target, safeDelta);
}

export function getHostDailyTasksDb(uid: string): HostDailyTask[] {
  const dateKey = todayKey();
  const u = getFullUserRow(uid);
  const rows = db
    .prepare('SELECT task_id, progress, claimed FROM host_daily_tasks WHERE uid = ? AND task_date = ?')
    .all(uid, dateKey) as Array<{ task_id: string; progress: number; claimed: number }>;
  const map = new Map(rows.map((r) => [r.task_id, r]));

  return DAILY_TASK_DEFS.map((def) => {
    const rec = map.get(def.id);
    let progress = rec ? Number(rec.progress || 0) : 0;

    // Auto-derive live progress from user's verified account state so tasks feel alive immediately
    if (def.id === 'daily_checkin' && u?.last_checkin_date === dateKey) {
      progress = Math.max(progress, 1);
    }
    if (def.id === 'polish_profile' && u && (u.avatar_url || u.headline || u.bio)) {
      progress = Math.max(progress, 1);
    }
    if (
      def.id === 'partner_setup' &&
      u &&
      (u.monetag_status === 'pending' ||
        u.monetag_status === 'verified' ||
        u.aads_status === 'pending' ||
        u.aads_status === 'verified')
    ) {
      progress = Math.max(progress, 1);
    }

    const clamped = Math.min(def.target, progress);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      category: def.category,
      target: def.target,
      progress: clamped,
      completed: clamped >= def.target,
      claimed: Boolean(rec?.claimed),
      rewardXp: def.rewardXp,
      rewardCoins: def.rewardCoins,
      rewardTokens: def.rewardTokens,
    };
  });
}

export function claimHostDailyTaskDb(
  uid: string,
  taskId: string
): {
  ok: boolean;
  error?: string;
  rewardXp?: number;
  rewardCoins?: number;
  rewardTokens?: number;
  tasks?: HostDailyTask[];
} {
  const tasks = getHostDailyTasksDb(uid);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: 'Unknown daily task.' };
  if (task.claimed) return { ok: false, error: 'This daily task reward has already been claimed today.' };
  if (!task.completed) return { ok: false, error: `Complete this task first (${task.progress}/${task.target}).` };

  const dateKey = todayKey();
  const coinsToMint = LIVE_MONEY_ENABLED ? 0 : task.rewardCoins;
  if (coinsToMint > 0) {
    const mint = checkAndReserveMint(uid, coinsToMint, `daily_task:${task.id}`);
    if (!mint.ok) return { ok: false, error: mint.error };
  }

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO host_daily_tasks (uid, task_date, task_id, progress, claimed, updated_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(uid, task_date, task_id) DO UPDATE SET
         progress = MAX(host_daily_tasks.progress, excluded.progress),
         claimed = 1,
         updated_at = excluded.updated_at`
    ).run(uid, dateKey, task.id, task.target, Date.now());

    db.prepare(
      `UPDATE users
       SET xp = xp + ?,
           coins = MIN(?, coins + ?),
           tokens = MIN(?, tokens + ?)
       WHERE uid = ?`
    ).run(task.rewardXp, MAX_BALANCE_CAP, coinsToMint, MAX_BALANCE_CAP, task.rewardTokens, uid);
  });
  tx();

  writeAuditLog(uid, 'daily_task_claim', task.id, `+${task.rewardXp}XP +${coinsToMint}c +${task.rewardTokens}t`);
  return {
    ok: true,
    rewardXp: task.rewardXp,
    rewardCoins: coinsToMint,
    rewardTokens: task.rewardTokens,
    tasks: getHostDailyTasksDb(uid),
  };
}

// ---------------------------------------------------------------------------
// Server-Authoritative Economy Ledger (G-011 .. G-022)
// ---------------------------------------------------------------------------

function checkAndReserveMint(uid: string, amount: number, source: string): { ok: boolean; error?: string } {
  const dateKey = todayKey();
  const userSum =
    (
      db
        .prepare('SELECT COALESCE(SUM(amount), 0) as s FROM mint_ledger WHERE date_key = ? AND uid = ?')
        .get(dateKey, uid) as { s: number }
    )?.s ?? 0;
  if (userSum + amount > USER_DAILY_MINT_CAP) {
    return { ok: false, error: 'Daily per-account coin mint limit reached.' };
  }
  const globalSum =
    (
      db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM mint_ledger WHERE date_key = ?').get(dateKey) as {
        s: number;
      }
    )?.s ?? 0;
  if (globalSum + amount > GLOBAL_DAILY_MINT_CAP) {
    return { ok: false, error: 'Daily platform coin mint limit reached.' };
  }
  db.prepare('INSERT INTO mint_ledger (date_key, uid, amount, source) VALUES (?, ?, ?, ?)').run(
    dateKey,
    uid,
    amount,
    source
  );
  return { ok: true };
}

export function claimDailyCheckInDb(uid: string): {
  ok: boolean;
  coinsAwarded?: number;
  tokensAwarded?: number;
  xpAwarded?: number;
  streak?: number;
  error?: string;
} {
  const u = getFullUserRow(uid);
  if (!u) return { ok: false, error: 'Account not found.' };
  const today = todayKey();
  if (u.last_checkin_date === today) {
    return { ok: false, error: 'Daily check-in already claimed today.' };
  }
  const nextStreak = Number(u.daily_streak || 0) >= 7 ? 1 : Number(u.daily_streak || 0) + 1;
  const streakBonusTokens = nextStreak === 7 ? 30 : nextStreak * 2;
  const tokensAwarded = 20 + streakBonusTokens;
  const coinsAwarded = LIVE_MONEY_ENABLED ? 0 : nextStreak === 7 ? 750 : 500;
  const xpAwarded = 10 + nextStreak * 2;

  if (coinsAwarded > 0) {
    const mint = checkAndReserveMint(uid, coinsAwarded, 'daily_checkin');
    if (!mint.ok) return { ok: false, error: mint.error };
  }

  db.prepare(
    `UPDATE users
     SET coins = MIN(?, coins + ?),
         tokens = MIN(?, tokens + ?),
         xp = xp + ?,
         daily_streak = ?,
         last_checkin_date = ?
     WHERE uid = ?`
  ).run(MAX_BALANCE_CAP, coinsAwarded, MAX_BALANCE_CAP, tokensAwarded, xpAwarded, nextStreak, today, uid);

  return { ok: true, coinsAwarded, tokensAwarded, xpAwarded, streak: nextStreak };
}

export function recordWatchMinuteDb(uid: string): { ok: boolean; tokensAwarded: number; xpAwarded: number } {
  const u = getFullUserRow(uid);
  if (!u) return { ok: false, tokensAwarded: 0, xpAwarded: 0 };
  const today = todayKey();
  const used = u.watch_tokens_date === today ? Number(u.watch_tokens_today || 0) : 0;
  const tokensAwarded = used + 2 <= WATCH_TOKEN_DAILY_CAP ? 2 : Math.max(0, WATCH_TOKEN_DAILY_CAP - used);
  const xpAwarded = 6;
  db.prepare(
    `UPDATE users
     SET tokens = MIN(?, tokens + ?),
         xp = xp + ?,
         watch_tokens_date = ?,
         watch_tokens_today = ?
     WHERE uid = ?`
  ).run(MAX_BALANCE_CAP, tokensAwarded, xpAwarded, today, used + tokensAwarded, uid);
  return { ok: true, tokensAwarded, xpAwarded };
}

export function sendGiftTransaction(opts: {
  senderUid: string;
  hostUid: string;
  roomId: string;
  giftId: string;
  comboCount?: number;
}): {
  ok: boolean;
  error?: string;
  giftName?: string;
  chargedCoins?: number;
  hostDiamonds?: number;
  novaBurst?: boolean;
  senderBalance?: number;
} {
  const gift = GIFTS_CATALOG.find(
    (g) => g.id === opts.giftId.toLowerCase() || g.name.toLowerCase() === opts.giftId.toLowerCase()
  );
  if (!gift) return { ok: false, error: 'Unknown gift item.' };
  const sender = getFullUserRow(opts.senderUid);
  const host = getFullUserRow(opts.hostUid);
  if (!sender || !host) return { ok: false, error: 'Sender or Host not found.' };

  const now = Date.now();
  const isVip = Number(sender.vip_until || 0) > now;
  const isPro = Boolean(sender.is_pro);
  const isRoomAdmin = Boolean(
    db
      .prepare('SELECT 1 FROM room_admins WHERE room_id = ? AND admin_uid = ?')
      .get(opts.roomId, opts.senderUid)
  );
  const combo = Math.max(1, Math.min(520, Math.floor(opts.comboCount || 1)));
  const chargedCoins = priceAfterDiscount(gift.coins * combo, { isRoomAdmin, isVip, isPro });

  if (Number(sender.coins || 0) < chargedCoins) {
    return { ok: false, error: `Not enough coins (${chargedCoins} needed). Top up or claim Daily Check-In.` };
  }

  const hostIsVip = Number(host.vip_until || 0) > now;
  const hostSharePct = hostIsVip ? 0.8 : 0.7; // 80/20 for VIP hosts, 70/30 standard (G-012)
  const hostDiamonds = Math.max(1, Math.round(chargedCoins * hostSharePct));
  const senderXp = Math.max(1, Math.floor(chargedCoins / 2));

  const tx = db.transaction(() => {
    const deduct = db
      .prepare('UPDATE users SET coins = coins - ?, xp = xp + ? WHERE uid = ? AND coins >= ?')
      .run(chargedCoins, senderXp, opts.senderUid, chargedCoins);
    if (deduct.changes !== 1) {
      throw new Error('INSUFFICIENT_COINS');
    }
    db.prepare('UPDATE users SET diamonds = MIN(?, diamonds + ?), xp = xp + ? WHERE uid = ?').run(
      MAX_BALANCE_CAP,
      hostDiamonds,
      Math.max(1, Math.floor(hostDiamonds / 3)),
      opts.hostUid
    );
    db.prepare('UPDATE streams SET total_gifts_coins = total_gifts_coins + ? WHERE id = ?').run(
      chargedCoins,
      opts.roomId
    );
  });

  try {
    tx();
  } catch {
    return { ok: false, error: 'Not enough coins.' };
  }

  const updated = getFullUserRow(opts.senderUid);
  return {
    ok: true,
    giftName: gift.name,
    chargedCoins,
    hostDiamonds,
    novaBurst: gift.coins >= 500,
    senderBalance: Number(updated?.coins || 0),
  };
}

export function purchaseVipPlan(uid: string, planId: keyof typeof VIP_PLANS): { ok: boolean; error?: string } {
  const plan = VIP_PLANS[planId];
  if (!plan) return { ok: false, error: 'Invalid VIP plan.' };
  const u = getFullUserRow(uid);
  if (!u) return { ok: false, error: 'User not found.' };
  if (Number(u.tokens || 0) < plan.tokens) {
    return { ok: false, error: `Requires ${plan.tokens} tokens (you have ${u.tokens}).` };
  }
  const baseTime = Math.max(Date.now(), Number(u.vip_until || 0));
  const newUntil = baseTime + plan.durationMs;
  const upd = db
    .prepare('UPDATE users SET tokens = tokens - ?, vip_tier = ?, vip_until = ? WHERE uid = ? AND tokens >= ?')
    .run(plan.tokens, plan.id, newUntil, uid, plan.tokens);
  if (upd.changes !== 1) return { ok: false, error: 'Insufficient tokens.' };
  writeAuditLog(uid, 'vip_purchase', plan.id, `-${plan.tokens} tokens`);
  return { ok: true };
}

export function purchaseShopPerk(uid: string, perkId: string): { ok: boolean; error?: string } {
  const u = getFullUserRow(uid);
  if (!u) return { ok: false, error: 'User not found.' };

  if (perkId === 'pro_membership') {
    if (u.is_pro) return { ok: false, error: 'PRO membership is already active.' };
    if (Number(u.coins || 0) < 2000) return { ok: false, error: 'PRO costs 2,000 coins.' };
    db.prepare('UPDATE users SET coins = coins - 2000, is_pro = 1 WHERE uid = ? AND coins >= 2000').run(uid);
    writeAuditLog(uid, 'pro_purchase', uid, '-2000 coins');
    return { ok: true };
  }

  const perk = SHOP_PERKS.find((p) => p.id === perkId);
  if (!perk) return { ok: false, error: 'Unknown shop perk.' };
  const lvl = levelFromXp(Number(u.xp || 0));
  const isVip = Number(u.vip_until || 0) > Date.now();
  if (lvl < perk.minLevel) return { ok: false, error: `Requires Level ${perk.minLevel} (you are Lv.${lvl}).` };
  if (perk.requiresVip && !isVip) return { ok: false, error: 'Requires active VIP status.' };
  if (perk.requiresPro && !u.is_pro) return { ok: false, error: 'Requires active PRO membership.' };

  let owned: string[] = [];
  try {
    owned = JSON.parse(u.owned_perks_json || '[]');
  } catch {
    owned = [];
  }
  if (owned.includes(perk.id)) return { ok: false, error: 'You already own this perk.' };
  const price = isVip ? Math.round(perk.coins * 0.9) : perk.coins;
  if (Number(u.coins || 0) < price) return { ok: false, error: `Requires ${price} coins.` };

  owned.push(perk.id);
  const res = db
    .prepare('UPDATE users SET coins = coins - ?, owned_perks_json = ? WHERE uid = ? AND coins >= ?')
    .run(price, JSON.stringify(owned), uid, price);
  if (res.changes !== 1) return { ok: false, error: 'Insufficient coins.' };
  return { ok: true };
}

export function claimTopupPack(
  uid: string,
  packId: keyof typeof TOPUP_PACKS,
  claimKey: string
): { ok: boolean; coins?: number; error?: string } {
  if (LIVE_MONEY_ENABLED) {
    return { ok: false, error: 'Sandbox top-up is disabled while LIVE_MONEY is active.' };
  }
  const pack = TOPUP_PACKS[packId];
  if (!pack) return { ok: false, error: 'Unknown coin pack.' };
  const safeKey = claimKey.trim().slice(0, 64) || `claim-${uid}-${Date.now()}`;
  const existing = db.prepare('SELECT claim_key FROM topup_claims WHERE claim_key = ?').get(safeKey);
  if (existing) return { ok: false, error: 'This top-up claim has already been processed.' };

  const mint = checkAndReserveMint(uid, pack.coins, `topup:${pack.id}`);
  if (!mint.ok) return { ok: false, error: mint.error };

  db.prepare('INSERT INTO topup_claims (claim_key, uid, coins, created_at) VALUES (?, ?, ?, ?)').run(
    safeKey,
    uid,
    pack.coins,
    Date.now()
  );
  db.prepare('UPDATE users SET coins = MIN(?, coins + ?) WHERE uid = ?').run(MAX_BALANCE_CAP, pack.coins, uid);
  writeAuditLog(uid, 'topup_claim', pack.id, `+${pack.coins} coins`);
  return { ok: true, coins: pack.coins };
}

export function requestPayoutDb(opts: {
  uid: string;
  diamonds: number;
  method: string;
  destination: string;
}): { ok: boolean; payout?: PayoutRecord; error?: string } {
  const u = getFullUserRow(opts.uid);
  if (!u) return { ok: false, error: 'User not found.' };
  const amount = Math.floor(opts.diamonds);
  if (amount < MIN_PAYOUT_DIAMONDS) {
    return { ok: false, error: `Minimum payout is ${MIN_PAYOUT_DIAMONDS.toLocaleString()} diamonds ($5.00).` };
  }
  if (Number(u.diamonds || 0) < amount) {
    return { ok: false, error: 'Insufficient diamond balance.' };
  }
  const cooldownMs = 24 * 3600 * 1000;
  if (Number(u.last_payout_at || 0) > 0 && Date.now() - Number(u.last_payout_at) < cooldownMs && u.role !== 'staff') {
    return { ok: false, error: '24-hour payout wallet cooldown is active.' };
  }
  const dest = opts.destination.trim().slice(0, 120);
  if (dest.length < 4) return { ok: false, error: 'Enter a valid payout email or wallet address.' };

  const usdAmount = Number((amount / CASH_RATE_DIAMONDS_PER_USD).toFixed(2));
  const masked = maskWallet(dest);
  const method = ['PayPal', 'USDT (TRC20)', 'Bank Wire'].includes(opts.method) ? opts.method : 'PayPal';

  let insertedId = 0;
  const tx = db.transaction(() => {
    const upd = db
      .prepare('UPDATE users SET diamonds = diamonds - ?, last_payout_at = ? WHERE uid = ? AND diamonds >= ?')
      .run(amount, Date.now(), opts.uid, amount);
    if (upd.changes !== 1) throw new Error('INSUFFICIENT');
    const res = db
      .prepare(
        `INSERT INTO payout_requests (uid, display_name, diamonds, usd_amount, method, destination_raw, destination_masked, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(opts.uid, u.display_name, amount, usdAmount, method, dest, masked);
    insertedId = Number(res.lastInsertRowid);
  });

  try {
    tx();
  } catch {
    return { ok: false, error: 'Insufficient diamonds.' };
  }
  writeAuditLog(opts.uid, 'payout_request', String(insertedId), `${amount} diamonds ($${usdAmount}) -> ${masked}`);
  const row = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(insertedId) as Record<string, any>;
  return {
    ok: true,
    payout: {
      id: row.id,
      uid: row.uid,
      displayName: row.display_name,
      diamonds: row.diamonds,
      usdAmount: row.usd_amount,
      method: row.method,
      destinationMasked: row.destination_masked,
      status: row.status,
      createdAt: row.created_at,
    },
  };
}

export function listPayoutsDb(uid?: string): PayoutRecord[] {
  const rows = (
    uid
      ? db.prepare('SELECT * FROM payout_requests WHERE uid = ? ORDER BY id DESC LIMIT 40').all(uid)
      : db.prepare('SELECT * FROM payout_requests ORDER BY id DESC LIMIT 80').all()
  ) as Array<Record<string, any>>;
  return rows.map((r) => ({
    id: r.id,
    uid: r.uid,
    displayName: r.display_name,
    diamonds: r.diamonds,
    usdAmount: r.usd_amount,
    method: r.method,
    destinationMasked: r.destination_masked,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export function resolvePayoutDb(
  payoutId: number,
  action: 'approved' | 'denied',
  staffUid: string
): { ok: boolean; error?: string } {
  const row = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(payoutId) as Record<string, any> | undefined;
  if (!row) return { ok: false, error: 'Payout request not found.' };
  if (row.status !== 'pending') return { ok: false, error: 'Payout already resolved.' };

  const tx = db.transaction(() => {
    db.prepare('UPDATE payout_requests SET status = ? WHERE id = ?').run(action, payoutId);
    if (action === 'denied') {
      db.prepare('UPDATE users SET diamonds = MIN(?, diamonds + ?) WHERE uid = ?').run(
        MAX_BALANCE_CAP,
        row.diamonds,
        row.uid
      );
    }
  });
  tx();
  writeAuditLog(staffUid, `payout_${action}`, `${row.uid}#${payoutId}`, `${row.diamonds} diamonds (${row.destination_masked})`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Follows, Room Admins, Blocklists, Visitors, Reports, Appeals & Resets
// ---------------------------------------------------------------------------

export function toggleFollowDb(followerUid: string, hostUid: string): { following: boolean; followerCount: number } {
  const exists = db
    .prepare('SELECT 1 FROM follows WHERE follower_uid = ? AND host_uid = ?')
    .get(followerUid, hostUid);
  if (exists) {
    db.prepare('DELETE FROM follows WHERE follower_uid = ? AND host_uid = ?').run(followerUid, hostUid);
  } else {
    const currentCount = (db.prepare('SELECT COUNT(*) as c FROM follows WHERE host_uid = ?').get(hostUid) as { c: number }).c;
    const totalEdges = (db.prepare('SELECT COUNT(*) as c FROM follows').get() as { c: number }).c;
    if (currentCount < 1000 && totalEdges < 100_000) {
      db.prepare('INSERT OR IGNORE INTO follows (follower_uid, host_uid, created_at) VALUES (?, ?, ?)').run(
        followerUid,
        hostUid,
        Date.now()
      );
    }
  }
  const c = (db.prepare('SELECT COUNT(*) as c FROM follows WHERE host_uid = ?').get(hostUid) as { c: number }).c;
  return { following: !exists, followerCount: c };
}

export function getFollowingHostUids(followerUid: string): string[] {
  const rows = db.prepare('SELECT host_uid FROM follows WHERE follower_uid = ?').all(followerUid) as Array<{
    host_uid: string;
  }>;
  return rows.map((r) => r.host_uid);
}

export function isBlockedByHost(hostUid: string, targetUid: string): boolean {
  return Boolean(
    db.prepare('SELECT 1 FROM room_blocks WHERE host_uid = ? AND blocked_uid = ?').get(hostUid, targetUid)
  );
}

export function blockUserForHost(roomId: string, hostUid: string, targetUid: string, reason = ''): { ok: boolean; error?: string } {
  if (hostUid === targetUid) return { ok: false, error: 'Cannot block the room host.' };
  const cnt = (db.prepare('SELECT COUNT(*) as c FROM room_blocks WHERE host_uid = ?').get(hostUid) as { c: number }).c;
  if (cnt >= MAX_ROOM_BLOCKS) return { ok: false, error: 'Blocklist cap (200) reached.' };
  db.prepare(
    'INSERT OR REPLACE INTO room_blocks (room_id, host_uid, blocked_uid, reason, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(roomId, hostUid, targetUid, reason.slice(0, 120), Date.now());
  writeAuditLog(hostUid, 'room_block', targetUid, roomId);
  return { ok: true };
}

export function unblockUserForHost(hostUid: string, targetUid: string) {
  db.prepare('DELETE FROM room_blocks WHERE host_uid = ? AND blocked_uid = ?').run(hostUid, targetUid);
}

export function listBlockedByHost(hostUid: string): Array<{ uid: string; displayName: string; reason: string }> {
  const rows = db
    .prepare(
      `SELECT b.blocked_uid, b.reason, COALESCE(u.display_name, b.blocked_uid) as display_name
       FROM room_blocks b LEFT JOIN users u ON u.uid = b.blocked_uid
       WHERE b.host_uid = ? ORDER BY b.created_at DESC`
    )
    .all(hostUid) as Array<{ blocked_uid: string; reason: string; display_name: string }>;
  return rows.map((r) => ({ uid: r.blocked_uid, displayName: r.display_name, reason: r.reason }));
}

export function toggleRoomAdminDb(roomId: string, hostUid: string, targetUid: string): { ok: boolean; isAdmin?: boolean; error?: string } {
  if (targetUid === hostUid) return { ok: false, error: 'Host already owns the room.' };
  const exists = db
    .prepare('SELECT 1 FROM room_admins WHERE room_id = ? AND admin_uid = ?')
    .get(roomId, targetUid);
  if (exists) {
    db.prepare('DELETE FROM room_admins WHERE room_id = ? AND admin_uid = ?').run(roomId, targetUid);
    return { ok: true, isAdmin: false };
  }
  const cnt = (db.prepare('SELECT COUNT(*) as c FROM room_admins WHERE room_id = ?').get(roomId) as { c: number }).c;
  if (cnt >= MAX_ROOM_ADMINS) return { ok: false, error: 'Max 10 per-room admins reached.' };
  db.prepare('INSERT INTO room_admins (room_id, host_uid, admin_uid, created_at) VALUES (?, ?, ?, ?)').run(
    roomId,
    hostUid,
    targetUid,
    Date.now()
  );
  return { ok: true, isAdmin: true };
}

export function listRoomAdminsDb(roomId: string): Array<{ uid: string; displayName: string }> {
  const rows = db
    .prepare(
      `SELECT a.admin_uid, COALESCE(u.display_name, a.admin_uid) as display_name
       FROM room_admins a LEFT JOIN users u ON u.uid = a.admin_uid
       WHERE a.room_id = ?`
    )
    .all(roomId) as Array<{ admin_uid: string; display_name: string }>;
  return rows.map((r) => ({ uid: r.admin_uid, displayName: r.display_name }));
}

export function recordRoomVisitDb(roomId: string, hostUid: string, visitorUid: string, visitorName: string) {
  if (visitorUid === hostUid) return;
  db.prepare(
    'INSERT INTO room_visits (room_id, host_uid, visitor_uid, visitor_name, visited_at) VALUES (?, ?, ?, ?, ?)'
  ).run(roomId, hostUid, visitorUid, visitorName.slice(0, 32), Date.now());
  // Enforce 300-row per-room visitor log ceiling
  db.prepare(
    `DELETE FROM room_visits
     WHERE room_id = ? AND id NOT IN (
       SELECT id FROM room_visits WHERE room_id = ? ORDER BY visited_at DESC LIMIT 300
     )`
  ).run(roomId, roomId);
}

export function listRoomVisitorsDb(
  roomId: string,
  requesterUid: string,
  page = 1,
  pageSize = 24,
  forceFullAccess = false
): {
  total: number;
  totalCount: number;
  fullAccess: boolean;
  truncatedForFree: boolean;
  sampled: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  visitors: RoomVisitor[];
} {
  const stream = db.prepare('SELECT host_uid FROM streams WHERE id = ?').get(roomId) as
    | { host_uid: string }
    | undefined;
  const requester = requesterUid ? getFullUserRow(requesterUid) : undefined;
  const isVip = Number(requester?.vip_until || 0) > Date.now();
  const isHost = Boolean(requesterUid && stream?.host_uid === requesterUid);
  const isStaff = requester?.role === 'staff';
  const isRoomAdmin = Boolean(
    requesterUid &&
      db.prepare('SELECT 1 FROM room_admins WHERE room_id = ? AND admin_uid = ?').get(roomId, requesterUid)
  );
  const fullAccess = forceFullAccess || isHost || isVip || isStaff || isRoomAdmin;

  const total = (
    db.prepare('SELECT COUNT(DISTINCT visitor_uid) as c FROM room_visits WHERE room_id = ?').get(roomId) as {
      c: number;
    }
  ).c;

  const safeSize = fullAccess ? Math.max(1, Math.min(24, Math.floor(pageSize) || 24)) : 2;
  const totalPages = fullAccess ? Math.max(1, Math.ceil(total / safeSize)) : 1;
  const safePage = fullAccess ? Math.max(1, Math.min(totalPages, Math.floor(page) || 1)) : 1;
  const offset = fullAccess ? (safePage - 1) * safeSize : 0;

  const rows = db
    .prepare(
      `SELECT rv.visitor_uid, rv.visitor_name, MAX(rv.visited_at) as visited_at,
              u.numeric_id as visitor_numeric_id, u.country_code as visitor_country_code
       FROM room_visits rv
       LEFT JOIN users u ON u.uid = rv.visitor_uid
       WHERE rv.room_id = ?
       GROUP BY rv.visitor_uid ORDER BY visited_at DESC LIMIT ? OFFSET ?`
    )
    .all(roomId, safeSize, offset) as Array<{
    visitor_uid: string;
    visitor_name: string;
    visited_at: number;
    visitor_numeric_id: number | null;
    visitor_country_code: string | null;
  }>;

  return {
    total,
    totalCount: total,
    fullAccess,
    truncatedForFree: !fullAccess && total > 2,
    sampled: total >= 300,
    page: safePage,
    pageSize: safeSize,
    totalPages,
    visitors: rows.map((r) => ({
      visitorUid: r.visitor_uid,
      visitorName: r.visitor_name,
      visitorNumericId: Number(r.visitor_numeric_id || 100100),
      visitorCountryCode: r.visitor_country_code || 'US',
      visitedAt: r.visited_at,
    })),
  };
}

export function submitRoomReportDb(opts: {
  roomId: string;
  reporterUid: string;
  reason: string;
}): { ok: boolean; autoRemoved?: boolean; distinctCount?: number; error?: string } {
  const stream = db.prepare('SELECT id, host_uid FROM streams WHERE id = ?').get(opts.roomId) as
    | { id: string; host_uid: string }
    | undefined;
  if (!stream) return { ok: false, error: 'Stream not found.' };
  if (stream.host_uid === opts.reporterUid) return { ok: false, error: 'You cannot report your own stream.' };

  const exists = db
    .prepare('SELECT id FROM reports WHERE room_id = ? AND reporter_uid = ?')
    .get(opts.roomId, opts.reporterUid);
  if (exists) return { ok: false, error: 'You have already submitted a report for this room.' };

  db.prepare('INSERT INTO reports (room_id, target_uid, reporter_uid, reason) VALUES (?, ?, ?, ?)').run(
    opts.roomId,
    stream.host_uid,
    opts.reporterUid,
    opts.reason.slice(0, 120)
  );

  const distinctCount = (
    db.prepare("SELECT COUNT(DISTINCT reporter_uid) as c FROM reports WHERE room_id = ? AND status = 'open'").get(
      opts.roomId
    ) as { c: number }
  ).c;

  let autoRemoved = false;
  if (distinctCount >= 3) {
    // 3 DISTINCT reporters -> auto-remove room + escalating ban ladder (G-043 / G-077)
    db.prepare('UPDATE streams SET is_live = 0 WHERE id = ?').run(opts.roomId);
    db.prepare("UPDATE reports SET status = 'auto_removed' WHERE room_id = ?").run(opts.roomId);
    const host = getFullUserRow(stream.host_uid);
    const nextStrikes = Number(host?.ban_strikes || 0) + 1;
    const duration = BAN_LADDER_MS[Math.min(BAN_LADDER_MS.length - 1, nextStrikes - 1)];
    db.prepare('UPDATE users SET ban_strikes = ?, banned_until = ? WHERE uid = ?').run(
      nextStrikes,
      Date.now() + duration,
      stream.host_uid
    );
    writeAuditLog('system', 'auto_remove_3_reports', opts.roomId, `host=${stream.host_uid} strike=${nextStrikes}`);
    autoRemoved = true;
  } else {
    writeAuditLog(opts.reporterUid, 'report_room', opts.roomId, opts.reason.slice(0, 60));
  }

  return { ok: true, autoRemoved, distinctCount };
}

export function listReportsDb(): SafetyReport[] {
  const rows = db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 60').all() as Array<Record<string, any>>;
  return rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    targetUid: r.target_uid,
    reporterUid: r.reporter_uid,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export function submitAppealDb(uid: string, displayName: string, reason: string): { ok: boolean; error?: string } {
  const cnt = (db.prepare("SELECT COUNT(*) as c FROM appeals WHERE status = 'pending'").get() as { c: number }).c;
  if (cnt >= MAX_APPEALS) return { ok: false, error: 'Appeals queue is currently full (50 cap).' };
  db.prepare('INSERT INTO appeals (uid, display_name, reason) VALUES (?, ?, ?)').run(
    uid,
    displayName.slice(0, 32),
    reason.trim().slice(0, 300)
  );
  writeAuditLog(uid, 'appeal_submit', uid, reason.slice(0, 80));
  return { ok: true };
}

export function listAppealsDb(uid?: string): SafetyAppeal[] {
  const rows = (
    uid
      ? db.prepare('SELECT * FROM appeals WHERE uid = ? ORDER BY id DESC LIMIT 20').all(uid)
      : db.prepare('SELECT * FROM appeals ORDER BY id DESC LIMIT 50').all()
  ) as Array<Record<string, any>>;
  return rows.map((r) => ({
    id: r.id,
    uid: r.uid,
    displayName: r.display_name,
    reason: r.reason,
    status: r.status,
    staffNote: r.staff_note || '',
    createdAt: r.created_at,
  }));
}

export function resolveAppealDb(
  id: number,
  status: 'approved' | 'denied' | 'dismissed',
  staffNote: string,
  staffUid: string
): { ok: boolean; error?: string } {
  const row = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!row) return { ok: false, error: 'Appeal not found.' };
  db.prepare('UPDATE appeals SET status = ?, staff_note = ? WHERE id = ?').run(status, staffNote.slice(0, 160), id);
  if (status === 'approved') {
    db.prepare('UPDATE users SET banned_until = 0, ban_strikes = MAX(0, ban_strikes - 1) WHERE uid = ?').run(row.uid);
  }
  writeAuditLog(staffUid, `appeal_${status}`, row.uid, staffNote.slice(0, 60));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Password Reset Flow with Staff Approval & Contact Proof (G-005)
// ---------------------------------------------------------------------------

export function requestPasswordResetDb(identifier: string): { ok: boolean; resetId?: number; error?: string } {
  const u = findUserByIdentifier(identifier);
  if (!u) {
    // Generic response (no account enumeration oracle — G-004)
    return { ok: true };
  }
  const masked = u.email ? maskEmail(u.email) : u.phone ? maskPhone(u.phone) : u.uid;
  const expiresAt = Date.now() + 24 * 3600 * 1000;
  const res = db
    .prepare("INSERT INTO password_resets (uid, contact_masked, status, expires_at) VALUES (?, ?, 'pending', ?)")
    .run(u.uid, masked, expiresAt);
  writeAuditLog(u.uid, 'reset_request', u.uid, masked);
  return { ok: true, resetId: Number(res.lastInsertRowid) };
}

export function listPasswordResetsDb(): PasswordResetRecord[] {
  const rows = db
    .prepare(
      `SELECT r.*, COALESCE(u.display_name, r.uid) as display_name
       FROM password_resets r LEFT JOIN users u ON u.uid = r.uid
       ORDER BY r.id DESC LIMIT 40`
    )
    .all() as Array<Record<string, any>>;
  return rows.map((r) => ({
    id: r.id,
    uid: r.uid,
    displayName: r.display_name,
    contactMasked: r.contact_masked,
    status: r.status,
    expiresAt: Number(r.expires_at),
    createdAt: r.created_at,
  }));
}

export function approvePasswordResetDb(resetId: number, staffUid: string): { ok: boolean; error?: string } {
  const row = db.prepare('SELECT * FROM password_resets WHERE id = ?').get(resetId) as Record<string, any> | undefined;
  if (!row) return { ok: false, error: 'Reset request not found.' };
  db.prepare("UPDATE password_resets SET status = 'approved' WHERE id = ?").run(resetId);
  writeAuditLog(staffUid, 'reset_approve', row.uid, `reset#${resetId}`);
  return { ok: true };
}

export function confirmPasswordResetDb(opts: {
  identifier: string;
  contactProof: string;
  newPassword: string;
  pwStretched?: boolean;
}): { ok: boolean; error?: string } {
  const u = findUserByIdentifier(opts.identifier);
  if (!u) return { ok: false, error: 'Reset verification failed.' };
  const approved = db
    .prepare(
      "SELECT * FROM password_resets WHERE uid = ? AND status = 'approved' AND expires_at > ? ORDER BY id DESC LIMIT 1"
    )
    .get(u.uid, Date.now()) as Record<string, any> | undefined;
  if (!approved) {
    return { ok: false, error: 'Password reset has not been approved by staff yet (or has expired).' };
  }
  const proof = opts.contactProof.trim().toLowerCase();
  const matchesEmail = u.email && String(u.email).toLowerCase() === proof;
  const matchesPhone = u.phone && String(u.phone).replace(/[\s\-().]/g, '') === proof.replace(/[\s\-().]/g, '');
  const matchesUid = !u.email && !u.phone && String(u.uid).toLowerCase() === proof;
  if (!matchesEmail && !matchesPhone && !matchesUid) {
    return { ok: false, error: 'Contact proof does not match the email/phone stored on this account.' };
  }
  const hash = hashPassword(opts.newPassword);
  db.prepare('UPDATE users SET password_hash = ?, pw_stretched = ? WHERE uid = ?').run(
    hash,
    opts.pwStretched ? 1 : 0,
    u.uid
  );
  db.prepare("UPDATE password_resets SET status = 'completed' WHERE id = ?").run(approved.id);
  writeAuditLog(u.uid, 'reset_confirm', u.uid, approved.contact_masked);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Test Mode Persona Provisioner (Full Functional App Sandbox)
// ---------------------------------------------------------------------------

export function switchTestPersonaDb(
  persona: 'guest' | 'host' | 'admin' | 'agency' | 'band' | 'staff'
): AuthSession {
  const now = Date.now();
  const oneYear = now + 365 * 24 * 3600 * 1000;

  if (persona === 'guest') {
    const uid = 'TST-GUEST';
    db.prepare(
      `INSERT INTO users (uid, display_name, role, password_hash, coins, diamonds, tokens, xp, country_code, numeric_id, free_pin_trials)
       VALUES (?, 'Guest-4821', 'guest', NULL, 2500, 0, 45, 180, 'US', 482100, 3)
       ON CONFLICT(uid) DO UPDATE SET coins = MAX(coins, 2500), tokens = MAX(tokens, 45), free_pin_trials = 3`
    ).run(uid);
    const token = signSessionToken({ uid, role: 'guest' });
    return hydrateAuthSession(token, uid, 'guest', undefined, true)!;
  }

  if (persona === 'host') {
    const uid = 'ST-1001';
    db.prepare(
      `UPDATE users SET coins = MAX(coins, 25000), diamonds = MAX(diamonds, 18400), tokens = MAX(tokens, 260),
       xp = MAX(xp, 12500), vip_tier = 'monthly', vip_until = ?, is_pro = 1, verified = 1,
       monetag_status = 'verified',
       monetag_email = COALESCE(monetag_email, 'maya.partner@monetag.demo'),
       monetag_pub_id = COALESCE(monetag_pub_id, 'PUB-202688'),
       monetag_tip_url = COALESCE(monetag_tip_url, 'https://monetag.com/?ref_id=t20f'),
       aads_status = CASE WHEN aads_status = 'none' THEN 'verified' ELSE aads_status END,
       aads_email = COALESCE(aads_email, 'maya.ads@aads.demo'),
       aads_unit_id = COALESCE(aads_unit_id, '2345678')
       WHERE uid = ?`
    ).run(oneYear, uid);
    const token = signSessionToken({ uid, role: 'host' });
    return hydrateAuthSession(token, uid, 'host', undefined, true)!;
  }

  if (persona === 'admin') {
    const uid = 'ST-2001';
    const hostUid = 'ST-1001';
    const perms = JSON.stringify({
      canModerateChat: true,
      canApproveGames: true,
      canManageSeats: true,
      canRunPK: true,
    });
    db.prepare(
      `INSERT INTO admin_grants (host_uid, admin_uid, password_hash, permissions_json, active)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(host_uid, admin_uid) DO UPDATE SET permissions_json = excluded.permissions_json, active = 1`
    ).run(hostUid, uid, hashPassword('test-admin-mode'), perms);
    db.prepare('INSERT OR IGNORE INTO room_admins (room_id, host_uid, admin_uid, created_at) VALUES (?, ?, ?, ?)').run(
      'room-solo-maya',
      hostUid,
      uid,
      now
    );
    db.prepare('UPDATE users SET coins = MAX(coins, 8500), tokens = MAX(tokens, 120), xp = MAX(xp, 4200) WHERE uid = ?').run(uid);
    const token = signSessionToken({ uid, role: 'admin', assignedHostUid: hostUid });
    return hydrateAuthSession(token, uid, 'admin', hostUid, true)!;
  }

  if (persona === 'agency') {
    const uid = 'ST-3001';
    const token = signSessionToken({ uid, role: 'agency' });
    return hydrateAuthSession(token, uid, 'agency', undefined, true)!;
  }

  if (persona === 'band') {
    const uid = 'ST-4001';
    const token = signSessionToken({ uid, role: 'band' });
    return hydrateAuthSession(token, uid, 'band', undefined, true)!;
  }

  // staff
  const uid = 'ST-STAFF';
  const token = signSessionToken({ uid, role: 'staff' });
  return hydrateAuthSession(token, uid, 'staff', undefined, true)!;
}

export function spawnLockedTestRoomDb(): string {
  const id = 'room-pin-vip-test';
  const pinHash = hashPassword('123456');
  db.prepare(
    `INSERT INTO streams (id, host_uid, host_name, title, category, language, country_code, viewer_count, thumbnail, is_live, max_seats, pin_hash, is_locked, consent_verified, created_at, total_gifts_coins)
     VALUES (?, 'ST-1001', 'Maya Lin', 'VIP Backstage Acoustic Session (PIN: 123456)', 'solo', 'English', 'US', 3210, '/src/assets/images/stream_solo_studio_1795687719501.jpg', 1, 6, ?, 1, 1, ?, 6400)
     ON CONFLICT(id) DO UPDATE SET is_live = 1, is_locked = 1, pin_hash = excluded.pin_hash, created_at = excluded.created_at`
  ).run(id, pinHash, Date.now());
  return id;
}

export function verifyRoomPinDb(roomId: string, pin: string): boolean {
  const row = db.prepare('SELECT pin_hash FROM streams WHERE id = ?').get(roomId) as
    | { pin_hash: string | null }
    | undefined;
  if (!row?.pin_hash) return true;
  return verifyPassword(pin, row.pin_hash);
}

// ---------------------------------------------------------------------------
// Tiered Team Doors (?admin / ?admintrust / ?adminpower) — Zero-Trust Key Auth
// ---------------------------------------------------------------------------

const TEAM_TOKEN_SECRET =
  process.env.STLIVE_TEAM_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

const TEAM_ENV_MAP: Record<TeamDoorTier, string> = {
  monitor: 'STLIVE_TEAM_KEY_MONITOR',
  trusted: 'STLIVE_TEAM_KEY_TRUSTED',
  full: 'STLIVE_TEAM_KEY_FULL',
};

function getEnvTeamKey(tier: TeamDoorTier): string {
  const raw = process.env[TEAM_ENV_MAP[tier]];
  return typeof raw === 'string' ? raw.trim() : '';
}

function constantTimeMatch(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function getTeamDoorStatusDb(): Record<
  TeamDoorTier,
  { configured: boolean; source: 'env' | 'claimed' | 'unclaimed' }
> {
  const tiers: TeamDoorTier[] = ['monitor', 'trusted', 'full'];
  const out = {} as Record<TeamDoorTier, { configured: boolean; source: 'env' | 'claimed' | 'unclaimed' }>;
  for (const tier of tiers) {
    if (getEnvTeamKey(tier).length >= 6) {
      out[tier] = { configured: true, source: 'env' };
      continue;
    }
    const row = db.prepare('SELECT tier FROM team_keys WHERE tier = ?').get(tier);
    out[tier] = row
      ? { configured: true, source: 'claimed' }
      : { configured: false, source: 'unclaimed' };
  }
  return out;
}

export function bootstrapTeamKeyDb(
  tier: TeamDoorTier,
  passcode: string
): { ok: boolean; error?: string } {
  const clean = passcode.trim();
  if (clean.length < 8 || clean.length > 120) {
    return { ok: false, error: 'Team key must be 8–120 characters.' };
  }
  if (getEnvTeamKey(tier).length >= 6) {
    return { ok: false, error: 'This tier key is managed by server environment configuration.' };
  }
  const existing = db.prepare('SELECT tier FROM team_keys WHERE tier = ?').get(tier);
  if (existing) {
    return { ok: false, error: 'This tier key has already been claimed.' };
  }
  const hash = hashPassword(clean);
  db.prepare('INSERT INTO team_keys (tier, key_hash, updated_at) VALUES (?, ?, ?)').run(
    tier,
    hash,
    Date.now()
  );
  writeAuditLog(`TEAM-${tier.toUpperCase()}`, 'team_key_claimed', tier, 'first-run bootstrap');
  return { ok: true };
}

export function verifyTeamKeyDb(tier: TeamDoorTier, candidate: string): boolean {
  const clean = candidate.trim();
  if (!clean) return false;
  const envVal = getEnvTeamKey(tier);
  if (envVal.length >= 6) {
    return constantTimeMatch(clean, envVal);
  }
  const row = db.prepare('SELECT key_hash FROM team_keys WHERE tier = ?').get(tier) as
    | { key_hash: string }
    | undefined;
  if (!row?.key_hash) return false;
  return verifyPassword(clean, row.key_hash);
}

export function signTeamToken(tier: TeamDoorTier): string {
  const exp = Date.now() + 1000 * 60 * 90; // 90m memory-scoped session
  const payload = Buffer.from(JSON.stringify({ tier, exp, nonce: crypto.randomBytes(6).toString('hex') })).toString(
    'base64url'
  );
  const sig = crypto.createHmac('sha256', TEAM_TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyTeamToken(token: string | undefined): { tier: TeamDoorTier } | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', TEAM_TOKEN_SECRET).update(payload).digest('base64url');
  if (!constantTimeMatch(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      tier?: TeamDoorTier;
      exp?: number;
    };
    if (!parsed.tier || !['monitor', 'trusted', 'full'].includes(parsed.tier)) return null;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return { tier: parsed.tier };
  } catch {
    return null;
  }
}

export function listTeamMembersDirectoryDb(limit = 120): Array<{
  uid: string;
  numericId: number;
  displayName: string;
  role: string;
  countryCode: string;
  level: number;
  coins: number;
  diamonds: number;
  verified: boolean;
  partnerVerified: boolean;
  bannedUntil: number;
  banStrikes: number;
  avatarUrl?: string;
}> {
  const safeLimit = Math.max(10, Math.min(300, limit));
  const rows = db
    .prepare(
      `SELECT uid, numeric_id, display_name, role, country_code, xp, coins, diamonds,
              verified, monetag_status, aads_status, banned_until, ban_strikes, avatar_url
       FROM users ORDER BY created_at DESC LIMIT ?`
    )
    .all(safeLimit) as Array<Record<string, any>>;

  return rows.map((r) => {
    const partnerVerified = r.monetag_status === 'verified' || r.aads_status === 'verified';
    return {
      uid: r.uid,
      numericId: Number(r.numeric_id || 100100),
      displayName: r.display_name,
      role: r.role,
      countryCode: r.country_code || 'US',
      level: levelFromXp(Number(r.xp || 0)),
      coins: Number(r.coins || 0),
      diamonds: Number(r.diamonds || 0),
      verified: Boolean(r.verified) || partnerVerified,
      partnerVerified,
      bannedUntil: Number(r.banned_until || 0),
      banStrikes: Number(r.ban_strikes || 0),
      avatarUrl: r.avatar_url || undefined,
    };
  });
}

export function unbanUserDb(targetUid: string, actor: string): { ok: boolean; error?: string } {
  const u = getFullUserRow(targetUid);
  if (!u) return { ok: false, error: 'User not found.' };
  db.prepare('UPDATE users SET banned_until = 0 WHERE uid = ?').run(targetUid);
  writeAuditLog(actor, 'team_unban', targetUid, 'temp ban lifted');
  return { ok: true };
}

export function dismissReportDb(reportId: number, actor: string): { ok: boolean; error?: string } {
  const row = db.prepare('SELECT id, room_id FROM reports WHERE id = ?').get(reportId) as
    | { id: number; room_id: string }
    | undefined;
  if (!row) return { ok: false, error: 'Report not found.' };
  db.prepare("UPDATE reports SET status = 'dismissed' WHERE id = ?").run(reportId);
  writeAuditLog(actor, 'team_report_dismiss', `report#${reportId}`, row.room_id);
  return { ok: true };
}

export function grantCoinsAuditedDb(
  targetUid: string,
  amount: number,
  reason: string,
  actor: string
): { ok: boolean; error?: string; newBalance?: number } {
  const safeAmt = Math.floor(Number(amount) || 0);
  if (safeAmt < 10 || safeAmt > 25_000) {
    return { ok: false, error: 'Grant amount must be between 10 and 25,000 coins.' };
  }
  const u = getFullUserRow(targetUid);
  if (!u) return { ok: false, error: 'Target user not found.' };
  const mint = checkAndReserveMint(targetUid, safeAmt, `team_grant:${actor}`);
  if (!mint.ok) return { ok: false, error: mint.error };
  db.prepare('UPDATE users SET coins = MIN(?, coins + ?) WHERE uid = ?').run(
    MAX_BALANCE_CAP,
    safeAmt,
    targetUid
  );
  const updated = getFullUserRow(targetUid);
  writeAuditLog(actor, 'team_grant_coins', targetUid, `+${safeAmt}c (${reason.slice(0, 60)})`);
  return { ok: true, newBalance: Number(updated?.coins || 0) };
}


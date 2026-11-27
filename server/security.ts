import crypto from 'crypto';

// ---------------------------------------------------------------------------
// StreamLive Economy, Leveling, Ban Ladder & Security Constants (GapList parity)
// ---------------------------------------------------------------------------

export const LIVE_MONEY_ENABLED = process.env.LIVE_MONEY === '1';
export const START_COINS = LIVE_MONEY_ENABLED ? 0 : 500;
export const MAX_BALANCE_CAP = 900_000_000;
export const USER_DAILY_MINT_CAP = 200_000;
export const GLOBAL_DAILY_MINT_CAP = 2_000_000;
export const CASH_RATE_DIAMONDS_PER_USD = 1000;
export const MIN_PAYOUT_DIAMONDS = 5000; // $5.00 minimum
export const WATCH_TOKEN_DAILY_CAP = 30;
export const PRIVATE_ROOM_TOKEN_COST = 30;
export const MAX_ROOM_ADMINS = 10;
export const MAX_ROOM_BLOCKS = 200;
export const MAX_APPEALS = 50;

export const GIFTS_CATALOG = [
  { id: 'spark', name: 'Spark', coins: 10 },
  { id: 'bubble', name: 'Bubble', coins: 20 },
  { id: 'comet', name: 'Comet', coins: 50 },
  { id: 'rocket', name: 'Rocket', coins: 120 },
  { id: 'crown', name: 'Crown', coins: 200 },
  { id: 'nova', name: 'Nova Burst', coins: 500 },
] as const;

export const VIP_PLANS = {
  weekly: { id: 'weekly', label: 'VIP Weekly', tokens: 60, durationMs: 7 * 24 * 3600 * 1000 },
  monthly: { id: 'monthly', label: 'VIP Monthly', tokens: 200, durationMs: 30 * 24 * 3600 * 1000 },
  lifetime: { id: 'lifetime', label: 'VIP Lifetime', tokens: 800, durationMs: 100 * 365 * 24 * 3600 * 1000 },
} as const;

export const SHOP_PERKS = [
  { id: 'ring', name: 'Neon Ring', coins: 300, minLevel: 5, requiresVip: false, requiresPro: false },
  { id: 'banner', name: 'Stage Banner', coins: 400, minLevel: 10, requiresVip: false, requiresPro: false },
  { id: 'gframe', name: 'Gold Frame', coins: 600, minLevel: 15, requiresVip: false, requiresPro: false },
  { id: 'crown', name: 'Royal Crown', coins: 800, minLevel: 20, requiresVip: true, requiresPro: false },
  { id: 'vframe', name: 'VIP Aura Frame', coins: 1000, minLevel: 30, requiresVip: true, requiresPro: false },
  { id: 'pro_emblem', name: 'PRO Emblem', coins: 2000, minLevel: 50, requiresVip: false, requiresPro: true },
] as const;

export const TOPUP_PACKS = {
  p100: { id: 'p100', coins: 100, priceUsd: '$0.99' },
  p500: { id: 'p500', coins: 500, priceUsd: '$4.99' },
  p1000: { id: 'p1000', coins: 1000, priceUsd: '$8.99' },
} as const;

// Escalating ban ladder (flags are NEVER permanent — G-043 / G-078)
export const BAN_LADDER_MS = [
  1 * 3600 * 1000,      // 1h
  3 * 3600 * 1000,      // 3h
  7 * 3600 * 1000,      // 7h
  12 * 3600 * 1000,     // 12h
  24 * 3600 * 1000,     // 24h
  3 * 24 * 3600 * 1000, // 3d
  7 * 24 * 3600 * 1000, // 7d
  30 * 24 * 3600 * 1000 // 30d
];

export const REPORT_REASONS = [
  'Harassment or hate speech',
  'Scam / phishing / spam',
  'Explicit / unsafe content',
  'Impersonation',
  'Underage safety concern',
] as const;

export function xpNeededForLevel(level: number): number {
  const clamped = Math.max(0, Math.min(300, Math.floor(level)));
  return Math.floor(50 * clamped + 15 * clamped * clamped);
}

export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let lo = 0;
  let hi = 300;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (xpNeededForLevel(mid) <= safeXp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function priceAfterDiscount(
  baseCoins: number,
  opts: { isRoomAdmin?: boolean; isVip?: boolean; isPro?: boolean }
): number {
  let pctOff = 0;
  if (opts.isRoomAdmin) pctOff += 20;
  if (opts.isVip) pctOff += 10;
  if (opts.isPro) pctOff += 5;
  pctOff = Math.min(35, pctOff);
  return Math.max(1, Math.round(baseCoins * (1 - pctOff / 100)));
}

// ---------------------------------------------------------------------------
// Identity Validation, Reserved Names & PII Masking (G-002, G-009, G-010)
// ---------------------------------------------------------------------------

const RESERVED_NAMES = new Set([
  'app',
  'system',
  'admin',
  'administrator',
  'dev',
  'developer',
  'moderator',
  'mod',
  'novapulse',
  'streamlive',
  'stlive',
  'anon',
  'anonymous',
  'support',
  'staff',
]);

export function isReservedDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Display name must be at least 2 characters.';
  if (trimmed.length > 24) return 'Display name cannot exceed 24 characters.';
  if (/📢|📣/.test(trimmed)) return 'Announcement symbols are reserved for system notices.';
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (RESERVED_NAMES.has(normalized)) {
    return `"${trimmed}" is a reserved system name. Please choose another name.`;
  }
  return null;
}

export function okEmail(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s.length >= 5 && s.length <= 64 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function okPhone(v: string): boolean {
  const digits = v.replace(/[\s\-().]/g, '');
  return /^\+?\d{7,15}$/.test(digits);
}

export function splitContact(raw: string): { email: string | null; phone: string | null; error?: string } {
  const s = raw.trim();
  if (!s) return { email: null, phone: null, error: 'Enter an email address or phone number.' };
  if (s.includes('@')) {
    if (!okEmail(s)) return { email: null, phone: null, error: 'Please enter a valid email address.' };
    return { email: s.toLowerCase(), phone: null };
  }
  const normalized = s.replace(/[\s\-().]/g, '');
  if (!okPhone(normalized)) {
    return { email: null, phone: null, error: 'Enter a valid email or phone number (+1234567890).' };
  }
  return { email: null, phone: normalized.startsWith('+') ? normalized : `+${normalized}` };
}

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '';
  const [user, dom] = email.split('@');
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}***@${dom}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  if (phone.length <= 5) return '***';
  return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
}

export function maskWallet(dest?: string | null): string {
  if (!dest) return '';
  if (dest.includes('@')) return maskEmail(dest);
  if (dest.length <= 8) return `${dest.slice(0, 2)}***${dest.slice(-2)}`;
  return `${dest.slice(0, 4)}***${dest.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Injection Shield (threatScan) & Anti-DDoS / Rate Limiters (G-004, G-080, G-081)
// ---------------------------------------------------------------------------

const THREAT_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'script_tag', re: /<\s*\/?\s*script\b/i },
  { name: 'iframe_object', re: /<\s*(iframe|object|embed|applet|meta|base)\b/i },
  { name: 'event_handler', re: /\bon[a-z]{2,18}\s*=/i },
  { name: 'js_uri', re: /\b(?:javascript|vbscript)\s*:/i },
  { name: 'data_blob_uri', re: /\b(?:data|blob)\s*:/i },
  { name: 'srcdoc_formaction', re: /\b(?:srcdoc|formaction|xlink:href)\s*=/i },
  { name: 'svg_onload', re: /<\s*svg\b[^>]*\bon\w+\s*=/i },
];

export interface ThreatEntry {
  key: string;
  strikes: number;
  blockedUntil: number;
  lastReason: string;
  updatedAt: number;
}

const threatMap = new Map<string, ThreatEntry>();
let globalLockdownUntil = 0;

export function getThreatState() {
  const now = Date.now();
  const activeBlocks = Array.from(threatMap.values()).filter((t) => t.blockedUntil > now || t.strikes > 0);
  return {
    lockdownActive: globalLockdownUntil > now,
    lockdownUntil: globalLockdownUntil,
    entries: activeBlocks.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50),
  };
}

export function unblockThreatKey(key: string): boolean {
  return threatMap.delete(key);
}

export function setGlobalLockdown(durationMs: number) {
  globalLockdownUntil = durationMs > 0 ? Date.now() + durationMs : 0;
}

export function isThreatBlocked(key: string): { blocked: boolean; remainingSec: number } {
  const now = Date.now();
  if (globalLockdownUntil > now) {
    return { blocked: true, remainingSec: Math.ceil((globalLockdownUntil - now) / 1000) };
  }
  const entry = threatMap.get(key);
  if (entry && entry.blockedUntil > now) {
    return { blocked: true, remainingSec: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  return { blocked: false, remainingSec: 0 };
}

export function recordThreatStrike(key: string, reason: string, blockMs = 120_000): ThreatEntry {
  const now = Date.now();
  const prev = threatMap.get(key) ?? {
    key,
    strikes: 0,
    blockedUntil: 0,
    lastReason: reason,
    updatedAt: now,
  };
  prev.strikes += 1;
  prev.lastReason = reason;
  prev.updatedAt = now;
  if (prev.strikes >= 3) {
    prev.blockedUntil = now + blockMs;
  }
  threatMap.set(key, prev);
  return prev;
}

export function threatScan(
  input: string,
  clientKey?: string
): { clean: string; flagged: boolean; matched: string[] } {
  let clean = String(input ?? '');
  const matched: string[] = [];
  for (const pat of THREAT_PATTERNS) {
    if (pat.re.test(clean)) {
      matched.push(pat.name);
    }
  }
  if (matched.length > 0) {
    clean = clean
      .replace(/<\s*\/?\s*(script|iframe|object|embed|svg|style|meta|base)[^>]*>/gi, '')
      .replace(/\bon[a-z]{2,18}\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\bon[a-z]{2,18}\s*=\s*\S+/gi, '')
      .replace(/\b(?:javascript|vbscript|data|blob)\s*:/gi, '')
      .replace(/\b(?:srcdoc|formaction|xlink:href)\s*=/gi, '')
      .trim();
    if (clientKey) {
      recordThreatStrike(clientKey, `threatScan:${matched.join(',')}`);
    }
  }
  return { clean, flagged: matched.length > 0, matched };
}

export function stripProtoPollution<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => stripProtoPollution(item)) as unknown as T;
  }
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    safe[k] = stripProtoPollution(v);
  }
  return safe as T;
}

// Rate limiter buckets
const loginFails = new Map<string, number[]>();
const registerTimes = new Map<string, number>();
const resetTimes = new Map<string, number>();
const wsBursts = new Map<string, number[]>();
const pinFails = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginThrottle(key: string): { allowed: boolean; retrySec?: number } {
  const now = Date.now();
  const list = (loginFails.get(key) ?? []).filter((t) => now - t < 60_000);
  loginFails.set(key, list);
  if (list.length >= 5) {
    return { allowed: false, retrySec: Math.ceil((60_000 - (now - list[0])) / 1000) };
  }
  return { allowed: true };
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const list = (loginFails.get(key) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  loginFails.set(key, list);
}

export function clearLoginFailures(key: string) {
  loginFails.delete(key);
}

export function checkRegisterThrottle(key: string): { allowed: boolean; retrySec?: number } {
  const now = Date.now();
  const last = registerTimes.get(key) ?? 0;
  if (now - last < 10_000) {
    return { allowed: false, retrySec: Math.ceil((10_000 - (now - last)) / 1000) };
  }
  registerTimes.set(key, now);
  return { allowed: true };
}

export function checkResetThrottle(key: string): { allowed: boolean; retrySec?: number } {
  const now = Date.now();
  const last = resetTimes.get(key) ?? 0;
  if (now - last < 60_000) {
    return { allowed: false, retrySec: Math.ceil((60_000 - (now - last)) / 1000) };
  }
  resetTimes.set(key, now);
  return { allowed: true };
}

export function checkWsFlood(key: string): { allowed: boolean; lockdown?: boolean } {
  const now = Date.now();
  const block = isThreatBlocked(key);
  if (block.blocked) return { allowed: false };
  const list = (wsBursts.get(key) ?? []).filter((t) => now - t < 3000);
  list.push(now);
  wsBursts.set(key, list);
  if (list.length >= 16) {
    recordThreatStrike(key, 'ws_flood_lockdown', 300_000);
    setGlobalLockdown(60_000);
    return { allowed: false, lockdown: true };
  }
  if (list.length >= 9) {
    recordThreatStrike(key, 'ws_flood_burst', 120_000);
    return { allowed: false };
  }
  return { allowed: true };
}

export function checkPinLockout(key: string): { locked: boolean; remainingSec: number } {
  const now = Date.now();
  const rec = pinFails.get(key);
  if (rec && rec.lockedUntil > now) {
    return { locked: true, remainingSec: Math.ceil((rec.lockedUntil - now) / 1000) };
  }
  return { locked: false, remainingSec: 0 };
}

export function recordPinFailure(key: string): { locked: boolean; attemptsLeft: number } {
  const now = Date.now();
  const rec = pinFails.get(key) ?? { count: 0, lockedUntil: 0 };
  if (rec.lockedUntil < now && rec.count >= 10) rec.count = 0;
  rec.count += 1;
  if (rec.count >= 10) {
    rec.lockedUntil = now + 10 * 60 * 1000; // 10 min lockout
  }
  pinFails.set(key, rec);
  return { locked: rec.count >= 10, attemptsLeft: Math.max(0, 10 - rec.count) };
}

export function clearPinFailures(key: string) {
  pinFails.delete(key);
}

// ---------------------------------------------------------------------------
// RFC-6238 Pure-Node TOTP 2FA (Zero External Dependencies — G-006)
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += BASE32_ALPHABET[bytes[i] % 32];
  }
  return out;
}

function base32ToBuffer(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, windowOffset = 0): string {
  const key = base32ToBuffer(secret);
  const counter = Math.floor(Date.now() / 30000) + windowOffset;
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;
  return String(code).padStart(6, '0');
}

export function verifyTotpCode(secret: string, token: string): boolean {
  const clean = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  for (const offset of [-1, 0, 1]) {
    if (generateTotpCode(secret, offset) === clean) return true;
  }
  return false;
}

import express from 'express';
import crypto from 'crypto';
import {
  buildSessionFromToken,
  db,
  hashPassword,
  listAllStreams,
  signSessionToken,
  verifyPassword,
} from './db';
import {
  allocateNumericId,
  addStreamViewMinutesDb,
  approvePasswordResetDb,
  blockUserForHost,
  bootstrapTeamKeyDb,
  claimDailyCheckInDb,
  claimHostDailyTaskDb,
  claimTopupPack,
  confirmPasswordResetDb,
  dismissReportDb,
  findUserByIdentifier,
  getFollowingHostUids,
  getFullUserRow,
  getHostDailyTasksDb,
  getPublicUserProfileDb,
  getTeamDoorStatusDb,
  grantCoinsAuditedDb,
  hydrateAuthSession,
  incrementHostDailyTaskDb,
  isBlockedByHost,
  listAppealsDb,
  listAuditLogs,
  listBlockedByHost,
  listPasswordResetsDb,
  listPayoutsDb,
  listReportsDb,
  listRoomAdminsDb,
  listRoomVisitorsDb,
  listTeamMembersDirectoryDb,
  purchaseShopPerk,
  purchaseVipPlan,
  recordRoomVisitDb,
  recordWatchMinuteDb,
  requestPasswordResetDb,
  requestPayoutDb,
  resolveAppealDb,
  resolvePayoutDb,
  sendGiftTransaction,
  signTeamToken,
  spawnLockedTestRoomDb,
  submitAppealDb,
  submitRoomReportDb,
  switchTestPersonaDb,
  toggleFollowDb,
  toggleRoomAdminDb,
  unbanUserDb,
  unblockUserForHost,
  verifyRoomPinDb,
  verifyTeamKeyDb,
  verifyTeamToken,
  writeAuditLog,
} from './platformStore';
import {
  PRIVATE_ROOM_TOKEN_COST,
  START_COINS,
  TOPUP_PACKS,
  VIP_PLANS,
  checkLoginThrottle,
  checkPinLockout,
  checkRegisterThrottle,
  checkResetThrottle,
  clearLoginFailures,
  clearPinFailures,
  extractSafeAadsUnitIdServer,
  generateTotpCode,
  generateTotpSecret,
  getThreatState,
  isReservedDisplayName,
  isSafeHttpsUrlServer,
  isThreatBlocked,
  maskEmail,
  recordLoginFailure,
  recordPinFailure,
  sanitizeImageMediaUrl,
  setGlobalLockdown,
  splitContact,
  stripProtoPollution,
  threatScan,
  unblockThreatKey,
  verifyTotpCode,
} from './security';
import type { AuthSession, UserRole } from '../src/types';

export interface PlatformRouteHooks {
  broadcastAll: (event: string, payload: unknown) => void;
  broadcastToRoom: (roomId: string, event: string, payload: unknown) => void;
  getHydratedStreams: () => unknown[];
  onGiftBroadcast?: (roomId: string, payload: {
    uid: string;
    displayName: string;
    role: UserRole;
    giftName: string;
    coins: number;
    combo: number;
    novaBurst: boolean;
  }) => void;
}

function getClientKey(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'local';
}

function extractBearer(req: express.Request): string | undefined {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return undefined;
  return h.slice(7).trim();
}

function requireAuth(req: express.Request, res: express.Response): AuthSession | null {
  const session = buildSessionFromToken(extractBearer(req));
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  return session;
}

export function createPlatformRouter(hooks: PlatformRouteHooks): express.Router {
  const router = express.Router();

  // Strip prototype pollution keys on all platform routes (G-081)
  router.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = stripProtoPollution(req.body);
    }
    next();
  });

  // =========================================================================
  // 1. ENHANCED IDENTITY, REGISTRATION (EMAIL/PHONE), 2FA & PASSWORD RESETS
  // =========================================================================

  router.post('/auth/register-v2', (req, res) => {
    const clientKey = getClientKey(req);
    const threat = isThreatBlocked(clientKey);
    if (threat.blocked) {
      return res.status(429).json({ error: `Temporarily blocked (${threat.remainingSec}s remaining).` });
    }
    const throttle = checkRegisterThrottle(clientKey);
    if (!throttle.allowed) {
      return res.status(429).json({ error: `Please wait ${throttle.retrySec}s before registering again.` });
    }

    const rawName = String(req.body?.displayName ?? '').trim();
    const scanName = threatScan(rawName, clientKey);
    const nameErr = isReservedDisplayName(scanName.clean);
    if (nameErr) return res.status(400).json({ error: nameErr });

    const contact = splitContact(String(req.body?.contact ?? ''));
    if (contact.error) return res.status(400).json({ error: contact.error });

    const password = String(req.body?.password ?? '');
    const rawLen = Number(req.body?.rawPasswordLen ?? password.length);
    const pwStretched = Boolean(req.body?.pwStretched);
    if (rawLen < 8 || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const roleRaw = String(req.body?.role ?? 'guest');
    const role: UserRole = ['guest', 'host', 'agency', 'band'].includes(roleRaw)
      ? (roleRaw as UserRole)
      : 'guest';
    const countryCode = String(req.body?.countryCode ?? 'US').toUpperCase().slice(0, 2) || 'US';

    // Case-insensitive anti-squat check (G-001)
    const dupName = db.prepare('SELECT uid FROM users WHERE LOWER(display_name) = ?').get(scanName.clean.toLowerCase());
    if (dupName) return res.status(409).json({ error: 'That display name is already taken.' });
    if (contact.email) {
      const dupEmail = db.prepare('SELECT uid FROM users WHERE LOWER(email) = ?').get(contact.email);
      if (dupEmail) return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (contact.phone) {
      const dupPhone = db.prepare('SELECT uid FROM users WHERE phone = ?').get(contact.phone);
      if (dupPhone) return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }

    const prefix = role === 'host' ? 'ST-H' : role === 'agency' ? 'ST-A' : role === 'band' ? 'ST-B' : 'ST-U';
    const uid = `${prefix}${Math.floor(1000 + Math.random() * 8999)}`;
    const numericId = allocateNumericId();
    const pwHash = hashPassword(password);

    // Auto-migrate guest wallet if user was signed in as a Guest (G-001)
    const existingGuest = buildSessionFromToken(extractBearer(req));
    const migrateCoins = existingGuest?.role === 'guest' ? Math.max(START_COINS, existingGuest.coins) : START_COINS;
    const migrateTokens = existingGuest?.role === 'guest' ? Math.max(20, existingGuest.tokens) : 20;

    db.prepare(
      `INSERT INTO users (uid, numeric_id, display_name, role, email, phone, country_code, password_hash, pw_stretched, coins, diamonds, tokens, xp, free_pin_trials)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 25, 3)`
    ).run(
      uid,
      numericId,
      scanName.clean,
      role,
      contact.email,
      contact.phone,
      countryCode,
      pwHash,
      pwStretched ? 1 : 0,
      migrateCoins,
      migrateTokens
    );

    writeAuditLog(uid, 'register', uid, contact.email ? maskEmail(contact.email) : contact.phone || '');
    const token = signSessionToken({ uid, role });
    const session = hydrateAuthSession(token, uid, role);
    res.status(201).json({ session });
  });

  router.post('/auth/login-v2', (req, res) => {
    const clientKey = getClientKey(req);
    const threat = isThreatBlocked(clientKey);
    if (threat.blocked) {
      return res.status(429).json({ error: `Temporarily blocked (${threat.remainingSec}s remaining).` });
    }
    const throttle = checkLoginThrottle(clientKey);
    if (!throttle.allowed) {
      return res.status(429).json({ error: `Too many sign-in attempts. Try again in ${throttle.retrySec}s.` });
    }

    const identifier = String(req.body?.identifier ?? '').trim();
    const rawPassword = String(req.body?.rawPassword ?? '');
    const stretchedPassword = String(req.body?.stretchedPassword ?? '');
    const totpCode = String(req.body?.totpCode ?? '').trim();

    const user = findUserByIdentifier(identifier);
    if (!user || !user.password_hash) {
      recordLoginFailure(clientKey);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    let valid = false;
    if (user.pw_stretched && stretchedPassword) {
      valid = verifyPassword(stretchedPassword, user.password_hash);
    }
    if (!valid && rawPassword) {
      valid = verifyPassword(rawPassword, user.password_hash);
      // Seamless legacy marker upgrade to client-stretched hash (G-003)
      if (valid && !user.pw_stretched && stretchedPassword) {
        db.prepare('UPDATE users SET password_hash = ?, pw_stretched = 1 WHERE uid = ?').run(
          hashPassword(stretchedPassword),
          user.uid
        );
      }
    }

    if (!valid) {
      recordLoginFailure(clientKey);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.totp_enabled && user.totp_secret) {
      if (!totpCode) {
        return res.status(200).json({ require2fa: true, message: 'Enter your 6-digit authenticator code.' });
      }
      if (!verifyTotpCode(user.totp_secret, totpCode)) {
        recordLoginFailure(clientKey);
        return res.status(401).json({ error: 'Invalid 2FA verification code.' });
      }
    }

    clearLoginFailures(clientKey);
    const token = signSessionToken({ uid: user.uid, role: user.role as UserRole });
    const session = hydrateAuthSession(token, user.uid, user.role as UserRole);
    res.json({ session });
  });

  router.post('/auth/reset-request', (req, res) => {
    const clientKey = getClientKey(req);
    const throttle = checkResetThrottle(clientKey);
    if (!throttle.allowed) {
      return res.status(429).json({ error: `Please wait ${throttle.retrySec}s before requesting another reset.` });
    }
    const identifier = String(req.body?.identifier ?? '').trim();
    if (!identifier) return res.status(400).json({ error: 'Enter your account UID, email, phone, or #ID.' });
    requestPasswordResetDb(identifier);
    res.json({
      ok: true,
      message: 'If the account exists, a 24-hour password reset request has been queued for staff approval.',
    });
  });

  router.post('/auth/reset-confirm', (req, res) => {
    const identifier = String(req.body?.identifier ?? '').trim();
    const contactProof = String(req.body?.contactProof ?? '').trim();
    const newPassword = String(req.body?.newPassword ?? '');
    const pwStretched = Boolean(req.body?.pwStretched);
    if (!identifier || !contactProof || newPassword.length < 8) {
      return res.status(400).json({ error: 'Provide account ID, stored email/phone proof, and a new 8+ char password.' });
    }
    const out = confirmPasswordResetDb({ identifier, contactProof, newPassword, pwStretched });
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({ ok: true, message: 'Password updated securely. You may now sign in.' });
  });

  router.post('/auth/2fa/setup', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const secret = generateTotpSecret();
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE uid = ?').run(secret, session.uid);
    const otpauthUrl = `otpauth://totp/StreamLive:${encodeURIComponent(session.displayName)}?secret=${secret}&issuer=StreamLive`;
    res.json({ secret, otpauthUrl, demoCode: generateTotpCode(secret) });
  });

  router.post('/auth/2fa/confirm', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const code = String(req.body?.code ?? '').trim();
    const u = getFullUserRow(session.uid);
    if (!u?.totp_secret) return res.status(400).json({ error: 'Start 2FA setup first.' });
    if (!verifyTotpCode(u.totp_secret, code)) {
      return res.status(400).json({ error: 'Invalid 6-digit TOTP code.' });
    }
    db.prepare('UPDATE users SET totp_enabled = 1 WHERE uid = ?').run(session.uid);
    writeAuditLog(session.uid, '2fa_enabled', session.uid);
    res.json({ session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode) });
  });

  router.post('/auth/2fa/disable', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE uid = ?').run(session.uid);
    writeAuditLog(session.uid, '2fa_disabled', session.uid);
    res.json({ session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode) });
  });

  router.get('/users/:uid/profile', (req, res) => {
    const uid = String(req.params.uid || '').trim();
    if (!uid) return res.status(400).json({ error: 'User UID is required.' });
    const profile = getPublicUserProfileDb(uid);
    if (!profile) return res.status(404).json({ error: 'Creator profile not found.' });
    res.json({ profile });
  });

  router.patch('/me/profile', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const clientKey = getClientKey(req);
    const bio = threatScan(String(req.body?.bio ?? session.bio ?? '').slice(0, 320), clientKey).clean;
    const headline = threatScan(String(req.body?.headline ?? session.headline ?? '').slice(0, 90), clientKey).clean;
    const location = threatScan(String(req.body?.location ?? session.location ?? '').slice(0, 80), clientKey).clean;
    const languages = threatScan(String(req.body?.languages ?? session.languages ?? '').slice(0, 100), clientKey).clean;
    const skills = threatScan(String(req.body?.skills ?? session.skills ?? '').slice(0, 160), clientKey).clean;
    const schedule = threatScan(String(req.body?.schedule ?? session.schedule ?? '').slice(0, 90), clientKey).clean;
    const age = threatScan(String(req.body?.age ?? session.age ?? '').slice(0, 12), clientKey).clean;
    const gender = threatScan(String(req.body?.gender ?? session.gender ?? '').slice(0, 24), clientKey).clean;
    const hobbies = threatScan(String(req.body?.hobbies ?? session.hobbies ?? '').slice(0, 140), clientKey).clean;
    const countryCode = String(req.body?.countryCode ?? session.countryCode ?? 'US').toUpperCase().slice(0, 2);

    let websiteUrl = session.websiteUrl || '';
    if (typeof req.body?.websiteUrl === 'string') {
      const rawSite = req.body.websiteUrl.trim();
      if (!rawSite) {
        websiteUrl = '';
      } else if (isSafeHttpsUrlServer(rawSite)) {
        websiteUrl = rawSite.slice(0, 200);
      } else {
        return res.status(400).json({ error: 'Portfolio / social link must be a valid https:// URL.' });
      }
    }

    let avatarUrl = session.avatarUrl || '';
    if (req.body?.avatarUrl !== undefined) {
      const safeAvatar = sanitizeImageMediaUrl(req.body.avatarUrl);
      if (safeAvatar === null) {
        return res.status(400).json({ error: 'Invalid profile picture format or size (use JPEG/PNG/WebP under 450KB).' });
      }
      avatarUrl = safeAvatar;
    }

    let coverUrl = session.coverUrl || '';
    if (req.body?.coverUrl !== undefined) {
      const safeCover = sanitizeImageMediaUrl(req.body.coverUrl);
      if (safeCover === null) {
        return res.status(400).json({ error: 'Invalid cover photo format or size (use JPEG/PNG/WebP under 450KB).' });
      }
      coverUrl = safeCover;
    }

    const showBio = req.body?.showBio === false ? 0 : 1;
    const showAge = req.body?.showAge ? 1 : 0;
    const showGender = req.body?.showGender ? 1 : 0;
    const showLocation = req.body?.showLocation === false ? 0 : 1;
    const showLanguages = req.body?.showLanguages === false ? 0 : 1;
    const showSkills = req.body?.showSkills === false ? 0 : 1;
    const showSchedule = req.body?.showSchedule === false ? 0 : 1;
    const showHobbies = req.body?.showHobbies === false ? 0 : 1;
    const showWebsite = req.body?.showWebsite === false ? 0 : 1;
    const showFollowers = req.body?.showFollowers === false ? 0 : 1;
    const showVisits = req.body?.showVisits === false ? 0 : 1;
    const allowDm = req.body?.allowDm === false ? 0 : 1;
    const bannerPos = ['top', 'lower', 'corner', 'below_stage'].includes(req.body?.bannerPos)
      ? req.body.bannerPos
      : session.bannerPos || 'below_stage';
    const bannerSize = ['728x90', '468x60', '300x250', '320x50'].includes(req.body?.bannerSize)
      ? req.body.bannerSize
      : session.bannerSize || '728x90';

    db.prepare(
      `UPDATE users
       SET country_code = ?, avatar_url = ?, cover_url = ?, headline = ?, location = ?,
           languages = ?, skills = ?, schedule = ?, website_url = ?,
           bio = ?, age = ?, gender = ?, hobbies = ?,
           show_bio = ?, show_age = ?, show_gender = ?, show_location = ?,
           show_languages = ?, show_skills = ?, show_schedule = ?, show_hobbies = ?,
           show_website = ?, show_followers = ?, show_visits = ?, allow_dm = ?,
           banner_pos = ?, banner_size = ?
       WHERE uid = ?`
    ).run(
      countryCode,
      avatarUrl,
      coverUrl,
      headline,
      location,
      languages,
      skills,
      schedule,
      websiteUrl,
      bio,
      age,
      gender,
      hobbies,
      showBio,
      showAge,
      showGender,
      showLocation,
      showLanguages,
      showSkills,
      showSchedule,
      showHobbies,
      showWebsite,
      showFollowers,
      showVisits,
      allowDm,
      bannerPos,
      bannerSize,
      session.uid
    );
    incrementHostDailyTaskDb(session.uid, 'polish_profile', 1);
    hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
    res.json({
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.get('/me/daily-tasks', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    res.json({ tasks: getHostDailyTasksDb(session.uid) });
  });

  router.post('/me/daily-tasks/:taskId/claim', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const out = claimHostDailyTaskDb(session.uid, String(req.params.taskId || ''));
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({
      ...out,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.get('/me/social', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    res.json({
      followingHostUids: getFollowingHostUids(session.uid),
      blockedUsers: listBlockedByHost(session.uid),
      payouts: listPayoutsDb(session.uid),
      appeals: listAppealsDb(session.uid),
      dailyTasks: getHostDailyTasksDb(session.uid),
    });
  });

  // =========================================================================
  // 2. SERVER-AUTHORITATIVE ECONOMY (CHECK-IN, GIFTS, VIP, SHOP, TOPUP, PAYOUT, MONETAG, A-ADS)
  // =========================================================================

  router.post('/economy/checkin', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const out = claimDailyCheckInDb(session.uid);
    if (!out.ok) return res.status(400).json({ error: out.error });
    incrementHostDailyTaskDb(session.uid, 'daily_checkin', 1);
    res.json({
      ...out,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.post('/economy/watch-tick', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const out = recordWatchMinuteDb(session.uid);
    res.json({
      ...out,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.post('/economy/gift', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const roomId = String(req.body?.roomId ?? '').trim();
    const giftId = String(req.body?.giftId ?? 'spark').trim();
    const combo = Math.max(1, Math.min(520, Number(req.body?.combo) || 1));

    const stream = db.prepare('SELECT id, host_uid FROM streams WHERE id = ?').get(roomId) as
      | { id: string; host_uid: string }
      | undefined;
    if (!stream) return res.status(404).json({ error: 'Live room not found.' });
    if (isBlockedByHost(stream.host_uid, session.uid)) {
      return res.status(403).json({ error: 'You are blocked from interacting in this room.' });
    }

    const tx = sendGiftTransaction({
      senderUid: session.uid,
      hostUid: stream.host_uid,
      roomId,
      giftId,
      comboCount: combo,
    });
    if (!tx.ok) return res.status(400).json({ error: tx.error });

    hooks.onGiftBroadcast?.(roomId, {
      uid: session.uid,
      displayName: session.displayName,
      role: session.role,
      giftName: tx.giftName!,
      coins: tx.chargedCoins!,
      combo,
      novaBurst: Boolean(tx.novaBurst),
    });
    hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());

    res.json({
      ...tx,
      combo,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.post('/economy/vip', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const planId = String(req.body?.planId ?? '') as keyof typeof VIP_PLANS;
    const out = purchaseVipPlan(session.uid, planId);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({
      ok: true,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.post('/economy/shop/buy', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const perkId = String(req.body?.perkId ?? '');
    const out = purchaseShopPerk(session.uid, perkId);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({
      ok: true,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.post('/economy/topup', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const packId = String(req.body?.packId ?? '') as keyof typeof TOPUP_PACKS;
    const claimKey = String(req.body?.claimKey ?? `${session.uid}-${packId}-${Date.now()}`);
    const out = claimTopupPack(session.uid, packId, claimKey);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({
      ...out,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.get('/economy/payouts', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    res.json({ payouts: listPayoutsDb(session.uid) });
  });

  router.post('/economy/payout', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const diamonds = Number(req.body?.diamonds) || 0;
    const method = String(req.body?.method ?? 'PayPal');
    const destination = String(req.body?.destination ?? '');
    const out = requestPayoutDb({ uid: session.uid, diamonds, method, destination });
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.status(201).json({
      payout: out.payout,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.post('/economy/monetag', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (req.body?.checklistAccepted !== true) {
      return res.status(400).json({ error: 'Please review and tick every guideline checklist box before submitting.' });
    }
    const email = String(req.body?.email ?? '').trim().slice(0, 120);
    const pubId = String(req.body?.publisherId ?? '').trim().slice(0, 64);
    const tipUrl = String(req.body?.tipUrl ?? '').trim().slice(0, 280);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || pubId.length < 2 || !isSafeHttpsUrlServer(tipUrl)) {
      return res.status(400).json({
        error: 'Provide a valid Monetag email, Publisher ID, and strict HTTPS Free-Tip Direct Link.',
      });
    }
    db.prepare(
      `UPDATE users
       SET monetag_status = 'pending', monetag_email = ?, monetag_pub_id = ?, monetag_tip_url = ?, monetag_checklist_at = ?
       WHERE uid = ?`
    ).run(email, pubId, tipUrl, Date.now(), session.uid);
    incrementHostDailyTaskDb(session.uid, 'partner_setup', 1);
    writeAuditLog(session.uid, 'monetag_submit', session.uid, maskEmail(email));
    res.json({
      ok: true,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.post('/economy/aads', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    if (req.body?.checklistAccepted !== true) {
      return res.status(400).json({ error: 'Please review and tick every guideline checklist box before submitting.' });
    }
    const email = String(req.body?.email ?? '').trim().slice(0, 120);
    const unitId = extractSafeAadsUnitIdServer(req.body?.unitId);
    const bannerPos = ['top', 'lower', 'corner', 'below_stage'].includes(req.body?.bannerPos)
      ? req.body.bannerPos
      : 'below_stage';
    const bannerSize = ['728x90', '468x60', '300x250', '320x50'].includes(req.body?.bannerSize)
      ? req.body.bannerSize
      : '728x90';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Provide a valid A-ADS account email address.' });
    }
    if (!unitId) {
      return res.status(400).json({
        error: 'Enter a valid numeric A-ADS Ad Unit ID (4–12 digits) or paste an official ad.a-ads.com iframe snippet.',
      });
    }

    db.prepare(
      `UPDATE users
       SET aads_status = 'pending', aads_email = ?, aads_unit_id = ?,
           aads_banner_pos = ?, aads_banner_size = ?, aads_checklist_at = ?
       WHERE uid = ?`
    ).run(email, unitId, bannerPos, bannerSize, Date.now(), session.uid);
    incrementHostDailyTaskDb(session.uid, 'partner_setup', 1);
    writeAuditLog(session.uid, 'aads_submit', session.uid, `unit=${unitId} pos=${bannerPos}`);
    res.json({
      ok: true,
      unitId,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.patch('/economy/aads/placement', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const bannerPos = ['top', 'lower', 'corner', 'below_stage'].includes(req.body?.bannerPos)
      ? req.body.bannerPos
      : 'below_stage';
    const bannerSize = ['728x90', '468x60', '300x250', '320x50'].includes(req.body?.bannerSize)
      ? req.body.bannerSize
      : '728x90';
    db.prepare('UPDATE users SET aads_banner_pos = ?, aads_banner_size = ? WHERE uid = ?').run(
      bannerPos,
      bannerSize,
      session.uid
    );
    hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
    res.json({
      ok: true,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  // =========================================================================
  // 3. LIVE ROOM DEPTH: PIN UNLOCK, FOLLOWS, VISITORS, ROOM ADMINS, BLOCKS, REPORTS, TRANSLATE
  // =========================================================================

  router.post('/rooms/:id/unlock', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const roomId = req.params.id;
    const lockKey = `${session.uid}:${roomId}`;
    const lock = checkPinLockout(lockKey);
    if (lock.locked) {
      return res.status(429).json({ error: `Too many wrong PIN tries. Locked for ${lock.remainingSec}s.` });
    }
    const pin = String(req.body?.pin ?? '').trim();
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'Enter a 6-digit room PIN.' });
    }

    const stream = db.prepare('SELECT host_uid, is_locked FROM streams WHERE id = ?').get(roomId) as
      | { host_uid: string; is_locked: number }
      | undefined;
    if (!stream) return res.status(404).json({ error: 'Stream not found.' });
    if (!stream.is_locked || stream.host_uid === session.uid || session.role === 'staff') {
      return res.json({ unlocked: true, session });
    }

    if (!verifyRoomPinDb(roomId, pin)) {
      const fail = recordPinFailure(lockKey);
      return res.status(403).json({
        error: fail.locked
          ? 'PIN locked for 10 minutes after 10 failed tries.'
          : `Incorrect PIN (${fail.attemptsLeft} tries left).`,
      });
    }

    clearPinFailures(lockKey);
    // VIP enters free; otherwise consume 1 of 3 free PIN trials, else 30 tokens (G-014 / G-036)
    const u = getFullUserRow(session.uid)!;
    const isVip = Number(u.vip_until || 0) > Date.now();
    if (!isVip) {
      if (Number(u.free_pin_trials || 0) > 0) {
        db.prepare('UPDATE users SET free_pin_trials = free_pin_trials - 1 WHERE uid = ?').run(session.uid);
      } else if (Number(u.tokens || 0) >= PRIVATE_ROOM_TOKEN_COST) {
        db.prepare('UPDATE users SET tokens = tokens - ? WHERE uid = ?').run(PRIVATE_ROOM_TOKEN_COST, session.uid);
      } else {
        return res.status(402).json({
          error: `No free PIN trials left. Requires VIP or ${PRIVATE_ROOM_TOKEN_COST} tokens.`,
        });
      }
    }

    res.json({
      unlocked: true,
      session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, session.isTestMode),
    });
  });

  router.post('/rooms/:id/end', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const stream = db.prepare('SELECT host_uid FROM streams WHERE id = ?').get(req.params.id) as
      | { host_uid: string }
      | undefined;
    if (!stream) return res.status(404).json({ error: 'Stream not found.' });
    if (stream.host_uid !== session.uid && session.role !== 'staff') {
      return res.status(403).json({ error: 'Only the Host can end this broadcast.' });
    }
    db.prepare('UPDATE streams SET is_live = 0 WHERE id = ?').run(req.params.id);
    hooks.broadcastToRoom(req.params.id, 'room:ended', { roomId: req.params.id });
    hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
    res.json({ ok: true });
  });

  router.post('/rooms/:id/follow', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const stream = db.prepare('SELECT host_uid FROM streams WHERE id = ?').get(req.params.id) as
      | { host_uid: string }
      | undefined;
    const hostUid = stream?.host_uid || String(req.body?.hostUid ?? '');
    if (!hostUid) return res.status(404).json({ error: 'Host not found.' });
    if (hostUid === session.uid) return res.status(400).json({ error: 'Cannot follow yourself.' });
    const out = toggleFollowDb(session.uid, hostUid);
    hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
    res.json({ ...out, followingHostUids: getFollowingHostUids(session.uid) });
  });

  router.post('/rooms/:id/visit', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const stream = db.prepare('SELECT host_uid FROM streams WHERE id = ?').get(req.params.id) as
      | { host_uid: string }
      | undefined;
    if (stream) {
      recordRoomVisitDb(req.params.id, stream.host_uid, session.uid, session.displayName);
      addStreamViewMinutesDb(req.params.id, 1);
    }
    res.json({ ok: true });
  });

  router.post('/rooms/:id/heartbeat', (req, res) => {
    const stream = db.prepare('SELECT id FROM streams WHERE id = ? AND is_live = 1').get(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not live.' });
    addStreamViewMinutesDb(req.params.id, 1);
    res.json({ ok: true });
  });

  router.get('/rooms/:id/visitors', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    res.json(listRoomVisitorsDb(req.params.id, session.uid));
  });

  router.get('/rooms/:id/admins', (req, res) => {
    res.json({ admins: listRoomAdminsDb(req.params.id) });
  });

  router.post('/rooms/:id/admins', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const stream = db.prepare('SELECT host_uid FROM streams WHERE id = ?').get(req.params.id) as
      | { host_uid: string }
      | undefined;
    if (!stream || (stream.host_uid !== session.uid && session.role !== 'staff')) {
      return res.status(403).json({ error: 'Only the room host can manage room admins.' });
    }
    const targetUid = String(req.body?.targetUid ?? '').trim();
    const out = toggleRoomAdminDb(req.params.id, stream.host_uid, targetUid);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({ ...out, admins: listRoomAdminsDb(req.params.id) });
  });

  router.post('/rooms/:id/block', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const stream = db.prepare('SELECT host_uid FROM streams WHERE id = ?').get(req.params.id) as
      | { host_uid: string }
      | undefined;
    const hostUid = stream?.host_uid ?? session.uid;
    if (hostUid !== session.uid && session.role !== 'staff' && session.assignedHostUid !== hostUid) {
      return res.status(403).json({ error: 'Only the Host or assigned Admin can block users.' });
    }
    const targetUid = String(req.body?.targetUid ?? '').trim();
    const out = blockUserForHost(req.params.id, hostUid, targetUid, String(req.body?.reason ?? 'Room block'));
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({ ok: true, blockedUsers: listBlockedByHost(hostUid) });
  });

  router.delete('/rooms/:id/block/:targetUid', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    unblockUserForHost(session.uid, req.params.targetUid);
    res.json({ ok: true, blockedUsers: listBlockedByHost(session.uid) });
  });

  router.post('/rooms/:id/report', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const reason = threatScan(String(req.body?.reason ?? 'Safety report'), getClientKey(req)).clean || 'Safety report';
    const out = submitRoomReportDb({ roomId: req.params.id, reporterUid: session.uid, reason });
    if (!out.ok) return res.status(400).json({ error: out.error });
    if (out.autoRemoved) {
      hooks.broadcastToRoom(req.params.id, 'room:ended', {
        roomId: req.params.id,
        reason: 'Stream removed after 3 distinct community safety reports.',
      });
      hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
    }
    res.json(out);
  });

  router.post('/safety/appeal', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const reason = threatScan(String(req.body?.reason ?? ''), getClientKey(req)).clean;
    if (reason.length < 6) return res.status(400).json({ error: 'Explain your appeal in at least 6 characters.' });
    const out = submitAppealDb(session.uid, session.displayName, reason);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.status(201).json({ ok: true, appeals: listAppealsDb(session.uid) });
  });

  router.get('/translate', async (req, res) => {
    const q = threatScan(String(req.query.q ?? '').slice(0, 300)).clean;
    const to = String(req.query.to ?? 'en').slice(0, 5).toLowerCase();
    if (!q || /^\[(st|photo|clip):/i.test(q)) return res.json({ translated: q, skipped: true });
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=autodetect|${encodeURIComponent(to)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(3500) });
      const data = (await r.json()) as { responseData?: { translatedText?: string } };
      const translated = data?.responseData?.translatedText || q;
      res.json({ translated });
    } catch {
      res.json({ translated: q });
    }
  });

  // =========================================================================
  // 4. STAFF SAFETY, THREAT CONSOLE, PAYOUTS, RESETS & MONETAG VERIFICATION
  // =========================================================================

  function requireStaff(req: express.Request, res: express.Response): AuthSession | null {
    const session = requireAuth(req, res);
    if (!session) return null;
    if (session.role !== 'staff') {
      res.status(403).json({ error: 'Staff clearance required.' });
      return null;
    }
    return session;
  }

  router.get('/staff/overview', (req, res) => {
    if (!requireStaff(req, res)) return;
    const pendingMonetag = db
      .prepare(
        "SELECT uid, numeric_id, display_name, monetag_status, monetag_email, monetag_pub_id, monetag_tip_url FROM users WHERE monetag_status != 'none' ORDER BY monetag_checklist_at DESC, created_at DESC LIMIT 30"
      )
      .all() as Array<Record<string, any>>;
    const pendingAads = db
      .prepare(
        "SELECT uid, numeric_id, display_name, aads_status, aads_email, aads_unit_id, aads_banner_pos, aads_banner_size FROM users WHERE aads_status != 'none' ORDER BY aads_checklist_at DESC, created_at DESC LIMIT 30"
      )
      .all() as Array<Record<string, any>>;
    res.json({
      reports: listReportsDb(),
      appeals: listAppealsDb(),
      payouts: listPayoutsDb(),
      resets: listPasswordResetsDb(),
      monetagQueue: pendingMonetag.map((m) => ({
        uid: m.uid,
        numericId: Number(m.numeric_id || 100100),
        displayName: m.display_name,
        status: m.monetag_status,
        email: m.monetag_email || '',
        publisherId: m.monetag_pub_id || '',
        tipUrl: m.monetag_tip_url || '',
      })),
      aadsQueue: pendingAads.map((a) => ({
        uid: a.uid,
        numericId: Number(a.numeric_id || 100100),
        displayName: a.display_name,
        status: a.aads_status,
        email: a.aads_email || '',
        unitId: a.aads_unit_id || '',
        bannerPos: a.aads_banner_pos || 'below_stage',
        bannerSize: a.aads_banner_size || '728x90',
      })),
      threat: getThreatState(),
      auditLogs: listAuditLogs(),
    });
  });

  router.post('/staff/payouts/:id/resolve', (req, res) => {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const action = req.body?.action === 'approved' ? 'approved' : 'denied';
    const out = resolvePayoutDb(Number(req.params.id), action, staff.uid);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({ ok: true });
  });

  router.post('/staff/appeals/:id/resolve', (req, res) => {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const status = ['approved', 'denied', 'dismissed'].includes(req.body?.status) ? req.body.status : 'dismissed';
    const note = String(req.body?.staffNote ?? '');
    const out = resolveAppealDb(Number(req.params.id), status, note, staff.uid);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({ ok: true });
  });

  router.post('/staff/resets/:id/approve', (req, res) => {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const out = approvePasswordResetDb(Number(req.params.id), staff.uid);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({ ok: true });
  });

  router.post('/staff/monetag/:uid/verify', (req, res) => {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const status = req.body?.status === 'verified' ? 'verified' : 'rejected';
    if (status === 'verified') {
      db.prepare("UPDATE users SET monetag_status = 'verified', verified = 1 WHERE uid = ?").run(req.params.uid);
    } else {
      db.prepare("UPDATE users SET monetag_status = 'rejected' WHERE uid = ?").run(req.params.uid);
    }
    writeAuditLog(staff.uid, `monetag_${status}`, req.params.uid);
    hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
    res.json({ ok: true });
  });

  router.post('/staff/aads/:uid/verify', (req, res) => {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const status = req.body?.status === 'verified' ? 'verified' : 'rejected';
    if (status === 'verified') {
      db.prepare("UPDATE users SET aads_status = 'verified', verified = 1 WHERE uid = ?").run(req.params.uid);
    } else {
      db.prepare("UPDATE users SET aads_status = 'rejected' WHERE uid = ?").run(req.params.uid);
    }
    writeAuditLog(staff.uid, `aads_${status}`, req.params.uid);
    hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
    res.json({ ok: true });
  });

  router.post('/staff/threat/unblock', (req, res) => {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const key = String(req.body?.key ?? '');
    unblockThreatKey(key);
    writeAuditLog(staff.uid, 'threat_unblock', key);
    res.json({ ok: true, threat: getThreatState() });
  });

  router.post('/staff/threat/lockdown', (req, res) => {
    const staff = requireStaff(req, res);
    if (!staff) return;
    const durationSec = Math.max(0, Math.min(300, Number(req.body?.durationSec) || 0));
    setGlobalLockdown(durationSec * 1000);
    writeAuditLog(staff.uid, 'threat_lockdown', `${durationSec}s`);
    res.json({ ok: true, threat: getThreatState() });
  });

  // =========================================================================
  // 4B. TIERED TEAM DOORS (?admin / ?admintrust / ?adminpower — §D)
  // =========================================================================

  const TEAM_TIER_RANK: Record<'monitor' | 'trusted' | 'full', number> = {
    monitor: 1,
    trusted: 2,
    full: 3,
  };

  function parseTeamTier(raw: unknown): 'monitor' | 'trusted' | 'full' | null {
    return raw === 'monitor' || raw === 'trusted' || raw === 'full' ? raw : null;
  }

  function requireTeamTier(
    req: express.Request,
    res: express.Response,
    minTier: 'monitor' | 'trusted' | 'full'
  ): { tier: 'monitor' | 'trusted' | 'full'; actor: string } | null {
    const rawHeader = req.headers['x-team-token'];
    const token = typeof rawHeader === 'string' ? rawHeader.trim() : '';
    const verified = verifyTeamToken(token);
    if (!verified) {
      writeAuditLog('TEAM-ANON', 'team_auth_denied', req.path, `required=${minTier}`);
      res.status(401).json({ error: 'Valid Team Door key unlock required.' });
      return null;
    }
    if (TEAM_TIER_RANK[verified.tier] < TEAM_TIER_RANK[minTier]) {
      writeAuditLog(
        `TEAM-${verified.tier.toUpperCase()}`,
        'team_power_denied',
        String(req.body?.action || req.path),
        `tier=${verified.tier} required=${minTier}`
      );
      res.status(403).json({
        error: `Tier ${TEAM_TIER_RANK[minTier]} (${minTier.toUpperCase()}) clearance required for this action.`,
      });
      return null;
    }
    return { tier: verified.tier, actor: `TEAM-${verified.tier.toUpperCase()}` };
  }

  router.get('/team/status', (_req, res) => {
    res.json({ tiers: getTeamDoorStatusDb() });
  });

  router.post('/team/bootstrap', (req, res) => {
    const clientKey = getClientKey(req);
    const threat = isThreatBlocked(clientKey);
    if (threat.blocked) {
      return res.status(429).json({ error: `Temporarily blocked (${threat.remainingSec}s).` });
    }
    const tier = parseTeamTier(req.body?.tier);
    if (!tier) return res.status(400).json({ error: 'Invalid team tier.' });
    const passcode = String(req.body?.passcode ?? '');
    const out = bootstrapTeamKeyDb(tier, passcode);
    if (!out.ok) return res.status(400).json({ error: out.error });
    const token = signTeamToken(tier);
    res.status(201).json({ ok: true, tier, token, tiers: getTeamDoorStatusDb() });
  });

  router.post('/team/unlock', (req, res) => {
    const clientKey = getClientKey(req);
    const threat = isThreatBlocked(clientKey);
    if (threat.blocked) {
      return res.status(429).json({ error: `Temporarily blocked (${threat.remainingSec}s).` });
    }
    const throttle = checkLoginThrottle(`team:${clientKey}`);
    if (!throttle.allowed) {
      return res.status(429).json({ error: `Too many key attempts. Retry in ${throttle.retrySec}s.` });
    }
    const tier = parseTeamTier(req.body?.tier);
    if (!tier) return res.status(400).json({ error: 'Invalid team tier.' });
    const passcode = String(req.body?.passcode ?? '');
    if (!verifyTeamKeyDb(tier, passcode)) {
      recordLoginFailure(`team:${clientKey}`);
      writeAuditLog('TEAM-ANON', 'team_unlock_failed', tier, clientKey.slice(0, 24));
      return res.status(401).json({ error: 'Invalid Team Door key.' });
    }
    clearLoginFailures(`team:${clientKey}`);
    const token = signTeamToken(tier);
    writeAuditLog(`TEAM-${tier.toUpperCase()}`, 'team_unlock_ok', tier);
    res.json({ ok: true, tier, token });
  });

  router.get('/team/overview', (req, res) => {
    const auth = requireTeamTier(req, res, 'monitor');
    if (!auth) return;
    const pendingMonetag = db
      .prepare(
        "SELECT uid, numeric_id, display_name, monetag_status, monetag_email, monetag_pub_id, monetag_tip_url FROM users WHERE monetag_status != 'none' ORDER BY monetag_checklist_at DESC, created_at DESC LIMIT 30"
      )
      .all() as Array<Record<string, any>>;
    const pendingAads = db
      .prepare(
        "SELECT uid, numeric_id, display_name, aads_status, aads_email, aads_unit_id, aads_banner_pos, aads_banner_size FROM users WHERE aads_status != 'none' ORDER BY aads_checklist_at DESC, created_at DESC LIMIT 30"
      )
      .all() as Array<Record<string, any>>;
    const streams = hooks.getHydratedStreams();
    res.json({
      tier: auth.tier,
      counts: {
        liveRooms: streams.length,
        roomCeiling: 1000,
        openReports: listReportsDb().filter((r) => r.status === 'open').length,
        pendingAppeals: listAppealsDb().filter((a) => a.status === 'pending').length,
        pendingPayouts: listPayoutsDb().filter((p) => p.status === 'pending').length,
      },
      streams: streams.slice(0, 60),
      members: listTeamMembersDirectoryDb(120),
      reports: listReportsDb(),
      appeals: listAppealsDb(),
      payouts: listPayoutsDb(),
      monetagQueue: pendingMonetag.map((m) => ({
        uid: m.uid,
        numericId: Number(m.numeric_id || 100100),
        displayName: m.display_name,
        status: m.monetag_status,
        email: m.monetag_email || '',
        publisherId: m.monetag_pub_id || '',
        tipUrl: m.monetag_tip_url || '',
      })),
      aadsQueue: pendingAads.map((a) => ({
        uid: a.uid,
        numericId: Number(a.numeric_id || 100100),
        displayName: a.display_name,
        status: a.aads_status,
        email: a.aads_email || '',
        unitId: a.aads_unit_id || '',
        bannerPos: a.aads_banner_pos || 'below_stage',
        bannerSize: a.aads_banner_size || '728x90',
      })),
      threat: getThreatState(),
      auditLogs: listAuditLogs(),
    });
  });

  router.post('/team/action', (req, res) => {
    const action = String(req.body?.action ?? '');
    const tier2Actions = new Set([
      'dismiss_report',
      'resolve_appeal',
      'unban_user',
      'end_stream',
      'block_user',
      'unblock_user',
    ]);
    const tier3Actions = new Set([
      'resolve_payout',
      'verify_monetag',
      'verify_aads',
      'grant_coins',
      'threat_unblock',
      'threat_lockdown',
    ]);

    if (!tier2Actions.has(action) && !tier3Actions.has(action)) {
      return res.status(400).json({ error: 'Unknown team action.' });
    }

    const requiredTier = tier3Actions.has(action) ? 'full' : 'trusted';
    const auth = requireTeamTier(req, res, requiredTier);
    if (!auth) return;

    if (action === 'dismiss_report') {
      const out = dismissReportDb(Number(req.body?.reportId), auth.actor);
      return out.ok ? res.json({ ok: true }) : res.status(400).json({ error: out.error });
    }
    if (action === 'resolve_appeal') {
      const status = ['approved', 'denied', 'dismissed'].includes(req.body?.status)
        ? req.body.status
        : 'dismissed';
      const out = resolveAppealDb(
        Number(req.body?.appealId),
        status,
        String(req.body?.staffNote ?? '').slice(0, 160),
        auth.actor
      );
      return out.ok ? res.json({ ok: true }) : res.status(400).json({ error: out.error });
    }
    if (action === 'unban_user') {
      const out = unbanUserDb(String(req.body?.targetUid ?? '').trim(), auth.actor);
      return out.ok ? res.json({ ok: true }) : res.status(400).json({ error: out.error });
    }
    if (action === 'end_stream') {
      const roomId = String(req.body?.roomId ?? '').trim();
      const row = db.prepare('SELECT id FROM streams WHERE id = ?').get(roomId);
      if (!row) return res.status(404).json({ error: 'Stream not found.' });
      db.prepare('UPDATE streams SET is_live = 0 WHERE id = ?').run(roomId);
      writeAuditLog(auth.actor, 'team_end_stream', roomId);
      hooks.broadcastToRoom(roomId, 'room:ended', {
        roomId,
        reason: 'Ended by StreamLive Safety Team.',
      });
      hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
      return res.json({ ok: true });
    }
    if (action === 'block_user') {
      const targetUid = String(req.body?.targetUid ?? '').trim();
      const reason = String(req.body?.reason ?? 'Team moderation').slice(0, 120);
      const out = blockUserForHost('team-global', auth.actor, targetUid, reason);
      return out.ok ? res.json({ ok: true }) : res.status(400).json({ error: out.error });
    }
    if (action === 'unblock_user') {
      unblockUserForHost(auth.actor, String(req.body?.targetUid ?? '').trim());
      writeAuditLog(auth.actor, 'team_unblock', String(req.body?.targetUid ?? '').trim());
      return res.json({ ok: true });
    }
    if (action === 'resolve_payout') {
      const decision = req.body?.decision === 'approved' ? 'approved' : 'denied';
      const out = resolvePayoutDb(Number(req.body?.payoutId), decision, auth.actor);
      return out.ok ? res.json({ ok: true }) : res.status(400).json({ error: out.error });
    }
    if (action === 'verify_monetag') {
      const targetUid = String(req.body?.targetUid ?? '').trim();
      const status = req.body?.status === 'verified' ? 'verified' : 'rejected';
      if (status === 'verified') {
        db.prepare("UPDATE users SET monetag_status = 'verified', verified = 1 WHERE uid = ?").run(targetUid);
      } else {
        db.prepare("UPDATE users SET monetag_status = 'rejected' WHERE uid = ?").run(targetUid);
      }
      writeAuditLog(auth.actor, `team_monetag_${status}`, targetUid);
      hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
      return res.json({ ok: true });
    }
    if (action === 'verify_aads') {
      const targetUid = String(req.body?.targetUid ?? '').trim();
      const status = req.body?.status === 'verified' ? 'verified' : 'rejected';
      if (status === 'verified') {
        db.prepare("UPDATE users SET aads_status = 'verified', verified = 1 WHERE uid = ?").run(targetUid);
      } else {
        db.prepare("UPDATE users SET aads_status = 'rejected' WHERE uid = ?").run(targetUid);
      }
      writeAuditLog(auth.actor, `team_aads_${status}`, targetUid);
      hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
      return res.json({ ok: true });
    }
    if (action === 'grant_coins') {
      const targetUid = String(req.body?.targetUid ?? '').trim();
      const amount = Number(req.body?.amount) || 0;
      const reason = String(req.body?.reason ?? 'Team adjustment').trim();
      const out = grantCoinsAuditedDb(targetUid, amount, reason, auth.actor);
      return out.ok ? res.json(out) : res.status(400).json({ error: out.error });
    }
    if (action === 'threat_unblock') {
      const key = String(req.body?.key ?? '');
      unblockThreatKey(key);
      writeAuditLog(auth.actor, 'team_threat_unblock', key);
      return res.json({ ok: true, threat: getThreatState() });
    }
    if (action === 'threat_lockdown') {
      const durationSec = Math.max(0, Math.min(300, Number(req.body?.durationSec) || 0));
      setGlobalLockdown(durationSec * 1000);
      writeAuditLog(auth.actor, 'team_threat_lockdown', `${durationSec}s`);
      return res.json({ ok: true, threat: getThreatState() });
    }

    return res.status(400).json({ error: 'Unhandled action.' });
  });

  // =========================================================================
  // 5. FULL FUNCTIONAL TEST MODE SANDBOX API (USER REQ #3)
  // =========================================================================

  router.post('/test/switch-persona', (req, res) => {
    const raw = String(req.body?.persona ?? 'host');
    const persona = ['guest', 'host', 'admin', 'agency', 'band', 'staff'].includes(raw)
      ? (raw as 'guest' | 'host' | 'admin' | 'agency' | 'band' | 'staff')
      : 'host';
    const session = switchTestPersonaDb(persona);
    res.json({ session });
  });

  router.post('/test/action', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const action = String(req.body?.action ?? '');

    if (action === 'boost_wallet') {
      db.prepare('UPDATE users SET coins = coins + 5000, diamonds = diamonds + 6000, tokens = tokens + 120 WHERE uid = ?').run(
        session.uid
      );
      return res.json({
        ok: true,
        message: 'Test Wallet Boosted: +5,000 Coins, +6,000 Diamonds, +120 Tokens!',
        session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, true),
      });
    }

    if (action === 'boost_xp') {
      db.prepare('UPDATE users SET xp = xp + 4500 WHERE uid = ?').run(session.uid);
      return res.json({
        ok: true,
        message: 'Test XP Boosted: +4,500 XP!',
        session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, true),
      });
    }

    if (action === 'spawn_pin_room') {
      const roomId = spawnLockedTestRoomDb();
      hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
      return res.json({
        ok: true,
        roomId,
        message: 'Spawned PIN-Locked Room (PIN: 123456)! Opening room now.',
        streams: hooks.getHydratedStreams(),
      });
    }

    if (action === 'test_xss_shield') {
      const sample = `<script>alert('xss')</script><svg onload=fetch('evil')>Safe Hello`;
      const result = threatScan(sample);
      return res.json({
        ok: true,
        flagged: result.flagged,
        matched: result.matched,
        cleaned: result.clean,
        message: `Injection Shield stripped [${result.matched.join(', ')}] -> "${result.clean}"`,
      });
    }

    if (action === 'simulate_3_reports') {
      const roomId = `room-test-report-${crypto.randomBytes(2).toString('hex')}`;
      db.prepare(
        `INSERT INTO streams (id, host_uid, host_name, title, category, language, country_code, viewer_count, thumbnail, is_live, max_seats, created_at)
         VALUES (?, 'ST-1003', 'Rohan Verma', 'Test Moderation Room (3-Report Check)', 'solo', 'English', 'IN', 120, '/src/assets/images/stream_gaming_arena_1795687722196.jpg', 1, 4, ?)`
      ).run(roomId, Date.now());
      submitRoomReportDb({ roomId, reporterUid: 'TST-R1', reason: 'Scam / phishing / spam' });
      submitRoomReportDb({ roomId, reporterUid: 'TST-R2', reason: 'Harassment or hate speech' });
      const third = submitRoomReportDb({ roomId, reporterUid: 'TST-R3', reason: 'Explicit / unsafe content' });
      hooks.broadcastAll('streams:updated', hooks.getHydratedStreams());
      return res.json({
        ok: true,
        autoRemoved: third.autoRemoved,
        message: `3 distinct reporters flagged ${roomId} -> Auto-removed: ${Boolean(third.autoRemoved)}. Logged in Staff Console.`,
      });
    }

    if (action === 'reset_pin_trials') {
      db.prepare('UPDATE users SET free_pin_trials = 3 WHERE uid = ?').run(session.uid);
      return res.json({
        ok: true,
        message: 'Reset to 3 Free PIN Room trials.',
        session: hydrateAuthSession(session.token, session.uid, session.role, session.assignedHostUid, true),
      });
    }

    if (action === 'totp_current_code') {
      const u = getFullUserRow(session.uid);
      if (!u?.totp_secret) return res.status(400).json({ error: 'Setup 2FA first in Me > Safety & 2FA.' });
      return res.json({ ok: true, code: generateTotpCode(u.totp_secret), message: `Current TOTP Code: ${generateTotpCode(u.totp_secret)}` });
    }

    res.status(400).json({ error: 'Unknown test action.' });
  });

  return router;
}

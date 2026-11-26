import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import {
  buildSessionFromToken,
  db,
  getActiveGrant,
  getHostAdmins,
  getTasksForAdmin,
  getTasksForHost,
  getUserByUid,
  hashPassword,
  initSchema,
  listAgencyHosts,
  listAllStreams,
  listBandEvents,
  listBrandDrops,
  listDirectoryUsers,
  parsePermissions,
  signSessionToken,
  verifyPassword,
} from './server/db';
import { MultiplayerGameEngine } from './server/games';
import type {
  AdminPermissions,
  AuthSession,
  ChatMessage,
  Livestream,
  MultiGuestSeat,
  PKState,
  UserRole,
} from './src/types';

initSchema();

const app = express();
app.use(express.json({ limit: '1mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
});
const gameEngine = new MultiplayerGameEngine();

// In-memory real-time room state (seats, PK, chat, muted users, followers)
interface LiveRoomRuntime {
  seats: MultiGuestSeat[];
  pk: PKState;
  messages: ChatMessage[];
  mutedUids: Set<string>;
  followers: Set<string>;
}

const roomRuntimes = new Map<string, LiveRoomRuntime>();

function getOrCreateRuntime(streamId: string, maxSeats: number, hostUid: string, hostName: string): LiveRoomRuntime {
  let rt = roomRuntimes.get(streamId);
  if (!rt) {
    const seats: MultiGuestSeat[] = Array.from({ length: maxSeats }, (_, idx) =>
      idx === 0
        ? { seatIndex: 0, uid: hostUid, displayName: hostName, muted: false }
        : { seatIndex: idx, uid: null, displayName: null, muted: false }
    );
    rt = {
      seats,
      pk: {
        active: streamId.includes('pk'),
        challengerName: 'Team Cyan · Leo Park',
        hostScore: streamId.includes('pk') ? 2450 : 0,
        challengerScore: streamId.includes('pk') ? 2180 : 0,
        endsAt: Date.now() + 1000 * 60 * 5,
      },
      messages: [
        {
          id: `welcome-${streamId}`,
          roomId: streamId,
          uid: hostUid,
          displayName: hostName,
          role: 'host',
          text: 'Welcome to the live room. Chat respectfully or request a seat anytime.',
          pinned: true,
          timestamp: Date.now(),
        },
      ],
      mutedUids: new Set(),
      followers: new Set(['ST-2001', 'ST-2002']),
    };
    roomRuntimes.set(streamId, rt);
  }
  return rt;
}

function hydrateStreams(): Livestream[] {
  return listAllStreams().map((s) => {
    const rt = getOrCreateRuntime(s.id, s.maxSeats, s.hostUid, s.hostName);
    return {
      ...s,
      seats: rt.seats,
      pk: rt.pk,
    };
  });
}

// Track WS connections
interface ClientMeta {
  ws: WebSocket;
  session: AuthSession | null;
  subscribedRoomId: string | null;
  subscribedGameId: string | null;
}
const clients = new Set<ClientMeta>();

function sendWs(ws: WebSocket, event: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, payload }));
  }
}

function broadcastAll(event: string, payload: unknown) {
  for (const client of clients) {
    sendWs(client.ws, event, payload);
  }
}

function broadcastRoom(roomId: string, event: string, payload: unknown) {
  for (const client of clients) {
    if (client.subscribedRoomId === roomId) {
      sendWs(client.ws, event, payload);
    }
  }
}

function broadcastGame(roomId: string) {
  const room = gameEngine.getRoom(roomId);
  if (!room) return;
  broadcastAll('game:state', room);
  scheduleBotTurnIfNeeded(roomId);
}

// Smooth server-authoritative patrol tick for active 3D FPS Arena bots
setInterval(() => {
  if (clients.size === 0) return;
  const updatedFpsRooms = gameEngine.tickFpsBots();
  for (const room of updatedFpsRooms) {
    broadcastAll('game:fps_sync', {
      roomId: room.roomId,
      combatants: room.fps?.combatants || {},
    });
  }
}, 220);

function scheduleBotTurnIfNeeded(roomId: string) {
  const room = gameEngine.getRoom(roomId);
  if (!room || room.status !== 'playing' || room.gameType === 'fps') return;
  const active = room.players[room.turnIndex];
  if (!active || !active.isBot) return;

  setTimeout(() => {
    const latest = gameEngine.getRoom(roomId);
    if (!latest || latest.status !== 'playing') return;
    const current = latest.players[latest.turnIndex];
    if (!current || !current.isBot) return;

    if (!latest.mustMove) {
      const rolled = gameEngine.rollDice(roomId, current.uid, true);
      if (rolled.room) {
        broadcastAll('game:state', rolled.room);
        if (rolled.room.mustMove && rolled.room.diceValue !== null) {
          const legal = gameEngine.getLegalLudoTokens(current, rolled.room.diceValue);
          if (legal.length > 0) {
            setTimeout(() => {
              const moved = gameEngine.movePiece(roomId, current.uid, legal[0], true);
              if (moved.room) {
                broadcastGame(roomId);
              }
            }, 550);
            return;
          }
        }
        scheduleBotTurnIfNeeded(roomId);
      }
    }
  }, 750);
}

// Auth helper for REST routes
function extractBearer(req: express.Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

function requireAuth(req: express.Request, res: express.Response): AuthSession | null {
  const session = buildSessionFromToken(extractBearer(req));
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return session;
}

function canModerateHost(session: AuthSession | null, hostUid: string, perm: keyof AdminPermissions): boolean {
  if (!session) return false;
  if (session.role === 'host' && session.uid === hostUid) return true;
  if (session.role === 'admin' && session.assignedHostUid === hostUid && session.permissions?.[perm]) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// REST API: Authentication (Unified 5-Role Portal + Host-Assigned Admin Login)
// ---------------------------------------------------------------------------

app.post('/api/auth/guest', (req, res) => {
  const rawName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const displayName = rawName.slice(0, 32) || `Guest ${crypto.randomInt(100, 999)}`;
  const uid = `GST-${crypto.randomInt(1000, 9999)}`;

  db.prepare(
    'INSERT OR IGNORE INTO users (uid, display_name, role, password_hash, coins, diamonds) VALUES (?, ?, ?, NULL, 1500, 0)'
  ).run(uid, displayName, 'guest');

  const token = signSessionToken({ uid, role: 'guest' });
  const session = buildSessionFromToken(token);
  res.json({ session });
});

app.post('/api/auth/register', (req, res) => {
  const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim().toUpperCase() : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = req.body?.role as UserRole;

  const allowedRegisterRoles: UserRole[] = ['guest', 'host', 'agency', 'band'];
  if (!allowedRegisterRoles.includes(role)) {
    return res.status(400).json({ error: 'Admin accounts are assigned by a Host. Register as Guest, Host, Agency, or Band.' });
  }
  if (!/^[A-Z0-9_-]{3,20}$/.test(uid)) {
    return res.status(400).json({ error: 'UID must be 3–20 letters, numbers, hyphens, or underscores (e.g. HOST-105).' });
  }
  if (displayName.length < 2 || displayName.length > 40) {
    return res.status(400).json({ error: 'Display name must be 2–40 characters.' });
  }
  if (password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = getUserByUid(uid);
  if (existing && existing.password_hash) {
    return res.status(409).json({ error: 'That UID is already registered. Please sign in instead.' });
  }

  const hash = hashPassword(password);
  if (existing && !existing.password_hash) {
    // Claim seeded showcase profile with user-chosen password
    db.prepare('UPDATE users SET display_name = ?, role = ?, password_hash = ? WHERE uid = ?').run(
      displayName,
      role,
      hash,
      uid
    );
  } else {
    db.prepare(
      'INSERT INTO users (uid, display_name, role, password_hash, coins, diamonds) VALUES (?, ?, ?, ?, 2500, 0)'
    ).run(uid, displayName, role, hash);
  }

  const token = signSessionToken({ uid, role });
  const session = buildSessionFromToken(token);
  res.status(201).json({ session });
});

app.post('/api/auth/login', (req, res) => {
  const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim().toUpperCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = req.body?.role as UserRole;
  const hostUidFilter = typeof req.body?.hostUid === 'string' ? req.body.hostUid.trim().toUpperCase() : '';

  if (!uid || !password) {
    return res.status(400).json({ error: 'UID and password are required.' });
  }

  // Host-Assigned Admin Login: same User UID + Host-provided password!
  if (role === 'admin') {
    const grants = db
      .prepare(
        `SELECT g.id, g.host_uid, g.admin_uid, g.password_hash, g.permissions_json, g.active,
                COALESCE(h.display_name, g.host_uid) AS host_name
         FROM admin_grants g
         LEFT JOIN users h ON h.uid = g.host_uid
         WHERE g.admin_uid = ? AND g.active = 1 ${hostUidFilter ? 'AND g.host_uid = ?' : ''}`
      )
      .all(...(hostUidFilter ? [uid, hostUidFilter] : [uid])) as Array<{
      id: number;
      host_uid: string;
      admin_uid: string;
      password_hash: string;
      permissions_json: string;
      active: number;
      host_name: string;
    }>;

    const matchedGrant = grants.find((g) => verifyPassword(password, g.password_hash));
    if (!matchedGrant) {
      return res.status(401).json({
        error: 'Invalid Admin UID or Host-provided password. Ask your Host to assign or verify your Admin credentials.',
      });
    }

    // Ensure user exists in directory
    const user = getUserByUid(uid);
    if (!user) {
      db.prepare(
        'INSERT OR IGNORE INTO users (uid, display_name, role, password_hash, coins, diamonds) VALUES (?, ?, ?, NULL, 1500, 0)'
      ).run(uid, uid, 'guest');
    }

    const token = signSessionToken({
      uid,
      role: 'admin',
      assignedHostUid: matchedGrant.host_uid,
    });
    const session = buildSessionFromToken(token);
    return res.json({ session });
  }

  // Standard role login (Guest / Host / Agency / Band)
  const user = getUserByUid(uid);
  if (!user) {
    return res.status(404).json({ error: 'Account UID not found. Switch to Create Account to register this UID.' });
  }
  if (!user.password_hash) {
    return res.status(401).json({
      error: 'This showcase UID has not set a password yet. Switch to Create Account to claim it with your own password.',
    });
  }
  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  if (role && user.role !== role) {
    return res.status(403).json({
      error: `UID ${uid} is registered under the "${user.role}" role. Select the ${user.role} tab to sign in.`,
    });
  }

  const token = signSessionToken({ uid: user.uid, role: user.role });
  const session = buildSessionFromToken(token);
  res.json({ session });
});

app.get('/api/auth/me', (req, res) => {
  const session = buildSessionFromToken(extractBearer(req));
  res.json({ session });
});

app.get('/api/users/directory', (_req, res) => {
  res.json({ users: listDirectoryUsers() });
});

// ---------------------------------------------------------------------------
// REST API: Streams
// ---------------------------------------------------------------------------

app.get('/api/streams', (_req, res) => {
  res.json({ streams: hydrateStreams() });
});

app.post('/api/streams', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'host' && session.role !== 'band') {
    return res.status(403).json({ error: 'Only Hosts or Bands can start a live broadcast.' });
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 90) : '';
  const category = typeof req.body?.category === 'string' ? req.body.category : 'solo';
  const language = typeof req.body?.language === 'string' ? req.body.language.slice(0, 24) : 'English';
  const maxSeats = Math.min(12, Math.max(2, Number(req.body?.maxSeats) || 4));
  const gameType =
    req.body?.gameType === 'ludo' || req.body?.gameType === 'snakes' || req.body?.gameType === 'fps'
      ? req.body.gameType
      : null;

  if (title.length < 3) {
    return res.status(400).json({ error: 'Stream title must be at least 3 characters.' });
  }

  const validCategories = ['solo', 'multi_guest', 'audio', 'pk', 'games', 'music_band', 'gaming', 'brand_drop'];
  const safeCategory = validCategories.includes(category) ? category : 'solo';

  const thumbMap: Record<string, string> = {
    solo: '/src/assets/images/stream_solo_studio_1795687719501.jpg',
    multi_guest: '/src/assets/images/stream_multiguest_podcast_1795687722768.jpg',
    audio: '/src/assets/images/stream_multiguest_podcast_1795687722768.jpg',
    pk: '/src/assets/images/stream_solo_studio_1795687719501.jpg',
    games: '/src/assets/images/stream_gaming_arena_1795687722196.jpg',
    music_band: '/src/assets/images/stream_band_live_1795687720929.jpg',
    gaming: '/src/assets/images/stream_gaming_arena_1795687722196.jpg',
    brand_drop: '/src/assets/images/stream_brand_showcase_1795687724180.jpg',
  };

  const id = `room-${crypto.randomBytes(4).toString('hex')}`;
  let gameRoomId: string | null = null;
  if (gameType) {
    const label = gameType === 'fps' ? '3D FPS Arena' : gameType === 'ludo' ? 'Ludo' : 'Snakes';
    const createdGame = gameEngine.createRoom({
      title: `${title} — ${label}`,
      gameType,
      hostUid: session.uid,
      hostName: session.displayName,
    });
    gameRoomId = createdGame.roomId;
    broadcastAll('game:state', createdGame);
  }

  db.prepare(
    `INSERT INTO streams (id, host_uid, host_name, title, category, language, viewer_count, thumbnail, is_live, max_seats, game_room_id, game_type)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?)`
  ).run(id, session.uid, session.displayName, title, safeCategory, language, thumbMap[safeCategory], maxSeats, gameRoomId, gameType);

  const streams = hydrateStreams();
  broadcastAll('streams:updated', streams);
  const created = streams.find((s) => s.id === id);
  res.status(201).json({ stream: created });
});

// ---------------------------------------------------------------------------
// REST API: Host -> Admin Delegation & Task Assignment
// ---------------------------------------------------------------------------

app.get('/api/host/admins', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'host') {
    return res.status(403).json({ error: 'Host role required.' });
  }
  res.json({
    admins: getHostAdmins(session.uid),
    tasks: getTasksForHost(session.uid),
  });
});

app.post('/api/host/admins', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'host') {
    return res.status(403).json({ error: 'Only Hosts can assign Admins.' });
  }

  const adminUid = typeof req.body?.adminUid === 'string' ? req.body.adminUid.trim().toUpperCase() : '';
  const adminPassword = typeof req.body?.adminPassword === 'string' ? req.body.adminPassword : '';
  const permissions: AdminPermissions = {
    canModerateChat: Boolean(req.body?.permissions?.canModerateChat ?? true),
    canApproveGames: Boolean(req.body?.permissions?.canApproveGames ?? true),
    canManageSeats: Boolean(req.body?.permissions?.canManageSeats ?? false),
    canRunPK: Boolean(req.body?.permissions?.canRunPK ?? false),
  };

  if (!/^[A-Z0-9_-]{3,20}$/.test(adminUid)) {
    return res.status(400).json({ error: 'Enter a valid User UID (e.g. ST-2001).' });
  }
  if (adminUid === session.uid) {
    return res.status(400).json({ error: 'You cannot assign yourself as your own Admin.' });
  }
  if (adminPassword.length < 4 || adminPassword.length > 100) {
    return res.status(400).json({ error: 'Host-provided Admin password must be at least 4 characters.' });
  }

  // Ensure target UID exists in directory
  const targetUser = getUserByUid(adminUid);
  if (!targetUser) {
    db.prepare(
      'INSERT OR IGNORE INTO users (uid, display_name, role, password_hash, coins, diamonds) VALUES (?, ?, ?, NULL, 1500, 0)'
    ).run(adminUid, adminUid, 'guest');
  }

  const hash = hashPassword(adminPassword);
  db.prepare(
    `INSERT INTO admin_grants (host_uid, admin_uid, password_hash, permissions_json, active)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(host_uid, admin_uid) DO UPDATE SET
       password_hash = excluded.password_hash,
       permissions_json = excluded.permissions_json,
       active = 1`
  ).run(session.uid, adminUid, hash, JSON.stringify(permissions));

  const admins = getHostAdmins(session.uid);
  broadcastAll('admin:updated', { hostUid: session.uid, adminUid });
  res.status(201).json({ admins });
});

app.patch('/api/host/admins/:adminUid', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'host') {
    return res.status(403).json({ error: 'Host role required.' });
  }
  const adminUid = req.params.adminUid.trim().toUpperCase();
  const existing = db
    .prepare('SELECT id, permissions_json, active FROM admin_grants WHERE host_uid = ? AND admin_uid = ?')
    .get(session.uid, adminUid) as { id: number; permissions_json: string; active: number } | undefined;

  if (!existing) {
    return res.status(404).json({ error: 'Admin assignment not found.' });
  }

  const nextPerms = req.body?.permissions
    ? JSON.stringify({
        canModerateChat: Boolean(req.body.permissions.canModerateChat),
        canApproveGames: Boolean(req.body.permissions.canApproveGames),
        canManageSeats: Boolean(req.body.permissions.canManageSeats),
        canRunPK: Boolean(req.body.permissions.canRunPK),
      })
    : existing.permissions_json;

  const nextActive = typeof req.body?.active === 'boolean' ? (req.body.active ? 1 : 0) : existing.active;

  if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length >= 4) {
    const newHash = hashPassword(req.body.newPassword);
    db.prepare(
      'UPDATE admin_grants SET permissions_json = ?, active = ?, password_hash = ? WHERE host_uid = ? AND admin_uid = ?'
    ).run(nextPerms, nextActive, newHash, session.uid, adminUid);
  } else {
    db.prepare('UPDATE admin_grants SET permissions_json = ?, active = ? WHERE host_uid = ? AND admin_uid = ?').run(
      nextPerms,
      nextActive,
      session.uid,
      adminUid
    );
  }

  broadcastAll('admin:updated', { hostUid: session.uid, adminUid });
  res.json({ admins: getHostAdmins(session.uid) });
});

app.delete('/api/host/admins/:adminUid', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'host') {
    return res.status(403).json({ error: 'Host role required.' });
  }
  const adminUid = req.params.adminUid.trim().toUpperCase();
  db.prepare('DELETE FROM admin_grants WHERE host_uid = ? AND admin_uid = ?').run(session.uid, adminUid);
  broadcastAll('admin:updated', { hostUid: session.uid, adminUid });
  res.json({ admins: getHostAdmins(session.uid) });
});

app.post('/api/host/tasks', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'host') {
    return res.status(403).json({ error: 'Only Hosts can assign Admin tasks.' });
  }

  const adminUid = typeof req.body?.adminUid === 'string' ? req.body.adminUid.trim().toUpperCase() : '';
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 300) : '';
  const priority = ['low', 'medium', 'high'].includes(req.body?.priority) ? req.body.priority : 'medium';

  if (!adminUid || title.length < 2) {
    return res.status(400).json({ error: 'Select an Admin and provide a task title.' });
  }

  const grant = getActiveGrant(session.uid, adminUid);
  if (!grant) {
    return res.status(404).json({ error: 'That user is not an active Admin under your Host account.' });
  }

  db.prepare(
    'INSERT INTO admin_tasks (host_uid, admin_uid, title, notes, priority, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(session.uid, adminUid, title, notes, priority, 'pending');

  const tasks = getTasksForHost(session.uid);
  broadcastAll('admin:updated', { hostUid: session.uid, adminUid });
  res.status(201).json({ tasks });
});

app.delete('/api/host/tasks/:taskId', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'host') {
    return res.status(403).json({ error: 'Host role required.' });
  }
  const taskId = Number(req.params.taskId);
  db.prepare('DELETE FROM admin_tasks WHERE id = ? AND host_uid = ?').run(taskId, session.uid);
  broadcastAll('admin:updated', { hostUid: session.uid });
  res.json({ tasks: getTasksForHost(session.uid) });
});

// ---------------------------------------------------------------------------
// REST API: Admin Scoped Workspace
// ---------------------------------------------------------------------------

app.get('/api/admin/workspace', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'admin' || !session.assignedHostUid) {
    return res.status(403).json({ error: 'Host-assigned Admin login required.' });
  }
  const grant = getActiveGrant(session.assignedHostUid, session.uid);
  if (!grant) {
    return res.status(403).json({ error: 'Your Admin delegation has been revoked by the Host.' });
  }
  res.json({
    hostUid: grant.host_uid,
    hostName: grant.host_name,
    permissions: parsePermissions(grant.permissions_json),
    tasks: getTasksForAdmin(grant.host_uid, session.uid),
  });
});

app.patch('/api/admin/tasks/:taskId', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'admin' || !session.assignedHostUid) {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  const taskId = Number(req.params.taskId);
  const status = req.body?.status;
  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  db.prepare('UPDATE admin_tasks SET status = ? WHERE id = ? AND host_uid = ? AND admin_uid = ?').run(
    status,
    taskId,
    session.assignedHostUid,
    session.uid
  );
  broadcastAll('admin:updated', { hostUid: session.assignedHostUid, adminUid: session.uid });
  res.json({ tasks: getTasksForAdmin(session.assignedHostUid, session.uid) });
});

// ---------------------------------------------------------------------------
// REST API: Agency & Bands/Brands Workspaces
// ---------------------------------------------------------------------------

app.get('/api/agency/dashboard', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'agency') {
    return res.status(403).json({ error: 'Agency role required.' });
  }
  res.json({
    roster: listAgencyHosts(session.uid),
    inviteCode: `AGY-${session.uid.replace(/[^A-Z0-9]/g, '').slice(-4)}-2026`,
  });
});

app.post('/api/agency/recruit', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'agency') {
    return res.status(403).json({ error: 'Agency role required.' });
  }
  const hostUid = typeof req.body?.hostUid === 'string' ? req.body.hostUid.trim().toUpperCase() : '';
  const hostName = typeof req.body?.hostName === 'string' ? req.body.hostName.trim().slice(0, 40) : '';
  const targetHours = Math.max(10, Math.min(200, Number(req.body?.targetHours) || 40));
  const commissionRate = Math.max(5, Math.min(35, Number(req.body?.commissionRate) || 15));

  if (!hostUid || hostName.length < 2) {
    return res.status(400).json({ error: 'Host UID and Name are required.' });
  }

  db.prepare(
    `INSERT INTO agency_hosts (agency_uid, host_uid, host_name, live_hours, target_hours, diamonds_earned, target_diamonds, commission_rate, status)
     VALUES (?, ?, ?, 0, ?, 0, 45000, ?, 'onboarding')`
  ).run(session.uid, hostUid, hostName, targetHours, commissionRate);

  res.status(201).json({ roster: listAgencyHosts(session.uid) });
});

app.get('/api/bands/dashboard', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'band') {
    return res.status(403).json({ error: 'Bands / Brands role required.' });
  }
  res.json({
    events: listBandEvents(),
    drops: listBrandDrops(),
  });
});

app.post('/api/bands/events', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'band') {
    return res.status(403).json({ error: 'Bands / Brands role required.' });
  }
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 80) : '';
  const members = typeof req.body?.members === 'string' ? req.body.members.trim().slice(0, 140) : '';
  const scheduledAt = typeof req.body?.scheduledAt === 'string' ? req.body.scheduledAt.trim().slice(0, 40) : 'Tonight · 21:00 UTC';
  const stageMode = ['acoustic', 'full_band', 'dj_set', 'soundcheck'].includes(req.body?.stageMode)
    ? req.body.stageMode
    : 'full_band';

  if (title.length < 3) return res.status(400).json({ error: 'Event title is required.' });

  db.prepare(
    `INSERT INTO band_events (band_uid, band_name, title, members, scheduled_at, stage_mode, rsvp_count)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).run(session.uid, session.displayName, title, members || session.displayName, scheduledAt, stageMode);

  res.status(201).json({ events: listBandEvents() });
});

app.post('/api/bands/drops', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'band') {
    return res.status(403).json({ error: 'Bands / Brands role required.' });
  }
  const productTitle = typeof req.body?.productTitle === 'string' ? req.body.productTitle.trim().slice(0, 80) : '';
  const priceLabel = typeof req.body?.priceLabel === 'string' ? req.body.priceLabel.trim().slice(0, 20) : '$49';
  const stockCount = Math.max(1, Math.min(5000, Number(req.body?.stockCount) || 50));

  if (productTitle.length < 2) return res.status(400).json({ error: 'Product title is required.' });

  db.prepare(
    `INSERT INTO brand_drops (band_uid, brand_name, product_title, price_label, stock_count, claimed_count, status)
     VALUES (?, ?, ?, ?, ?, 0, 'live')`
  ).run(session.uid, session.displayName, productTitle, priceLabel, stockCount);

  res.status(201).json({ drops: listBrandDrops() });
});

// ---------------------------------------------------------------------------
// REST API: Multiplayer Games Overview
// ---------------------------------------------------------------------------

app.get('/api/games', (_req, res) => {
  res.json({ games: gameEngine.listRooms() });
});

app.post('/api/games', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  if (session.role !== 'host' && session.role !== 'band') {
    return res.status(403).json({ error: 'Only Hosts can create a new multiplayer game table.' });
  }
  const gameType =
    req.body?.gameType === 'snakes'
      ? 'snakes'
      : req.body?.gameType === 'fps'
        ? 'fps'
        : 'ludo';
  const defaultLabel =
    gameType === 'fps' ? 'Nova Strike 3D FPS' : gameType === 'ludo' ? 'Ludo Table' : 'Snakes Table';
  const title =
    typeof req.body?.title === 'string' ? req.body.title : `${session.displayName}'s ${defaultLabel}`;
  const room = gameEngine.createRoom({
    title,
    gameType,
    hostUid: session.uid,
    hostName: session.displayName,
  });
  broadcastAll('game:state', room);
  res.status(201).json({ game: room });
});

// ---------------------------------------------------------------------------
// WebSocket Server: Live Rooms + Server-Authoritative Multiplayer Games
// ---------------------------------------------------------------------------

wss.on('connection', (ws) => {
  const meta: ClientMeta = {
    ws,
    session: null,
    subscribedRoomId: null,
    subscribedGameId: null,
  };
  clients.add(meta);

  // Send initial games list on connect
  sendWs(ws, 'games:init', gameEngine.listRooms());

  ws.on('message', (raw) => {
    let msg: { event?: string; payload?: Record<string, unknown> };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const event = msg.event;
    const payload = msg.payload || {};

    if (event === 'auth:identify') {
      const token = typeof payload.token === 'string' ? payload.token : undefined;
      meta.session = buildSessionFromToken(token);
      sendWs(ws, 'auth:identified', { ok: Boolean(meta.session) });
      return;
    }

    if (event === 'room:join') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const stream = listAllStreams().find((s) => s.id === roomId);
      if (!stream) return;
      meta.subscribedRoomId = roomId;
      const rt = getOrCreateRuntime(stream.id, stream.maxSeats, stream.hostUid, stream.hostName);
      sendWs(ws, 'room:state', {
        roomId,
        seats: rt.seats,
        pk: rt.pk,
        messages: rt.messages,
        mutedUids: Array.from(rt.mutedUids),
        followers: Array.from(rt.followers),
      });
      return;
    }

    if (event === 'room:follow_toggle') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : meta.subscribedRoomId || '';
      if (!roomId || !meta.session) return;
      const stream = listAllStreams().find((s) => s.id === roomId);
      if (!stream) return;
      const rt = getOrCreateRuntime(stream.id, stream.maxSeats, stream.hostUid, stream.hostName);
      if (rt.followers.has(meta.session.uid)) {
        rt.followers.delete(meta.session.uid);
      } else {
        rt.followers.add(meta.session.uid);
      }
      broadcastRoom(roomId, 'room:state', {
        roomId,
        seats: rt.seats,
        pk: rt.pk,
        messages: rt.messages,
        mutedUids: Array.from(rt.mutedUids),
        followers: Array.from(rt.followers),
      });
      return;
    }

    if (event === 'room:launch_game') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const requestedType =
        payload.gameType === 'fps' || payload.gameType === 'snakes' ? payload.gameType : 'ludo';
      if (!roomId || !meta.session) {
        sendWs(ws, 'ws:error', { message: 'Sign in as a Host to launch an in-stream game.' });
        return;
      }
      const stream = listAllStreams().find((s) => s.id === roomId);
      if (!stream) return;
      const canLaunch =
        canModerateHost(meta.session, stream.hostUid, 'canApproveGames') ||
        meta.session.role === 'host' ||
        meta.session.role === 'band';
      if (!canLaunch) {
        sendWs(ws, 'ws:error', { message: 'Only Hosts or authorized Admins can launch live games in this stream.' });
        return;
      }
      const gameLabel =
        requestedType === 'fps' ? 'Nova Strike 3D FPS' : requestedType === 'ludo' ? 'Ludo' : 'Snakes & Ladders';
      const createdGame = gameEngine.createRoom({
        title: `${stream.hostName} Live — ${gameLabel}`,
        gameType: requestedType,
        hostUid: meta.session.uid,
        hostName: meta.session.displayName,
      });
      db.prepare('UPDATE streams SET game_room_id = ?, game_type = ? WHERE id = ?').run(
        createdGame.roomId,
        requestedType,
        stream.id
      );
      broadcastAll('game:state', createdGame);
      broadcastAll('streams:updated', hydrateStreams());
      const rt = getOrCreateRuntime(stream.id, stream.maxSeats, stream.hostUid, stream.hostName);
      const announce: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: stream.id,
        uid: meta.session.uid,
        displayName: meta.session.displayName,
        role: meta.session.role,
        text: `launched ${gameLabel} live in this stream! Followers & viewers can Request to Join now.`,
        pinned: true,
        timestamp: Date.now(),
      };
      rt.messages.push(announce);
      broadcastRoom(stream.id, 'room:chat_msg', announce);
      return;
    }

    if (event === 'room:chat') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : meta.subscribedRoomId || '';
      const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 260) : '';
      if (!roomId || !text || !meta.session) return;
      const stream = listAllStreams().find((s) => s.id === roomId);
      if (!stream) return;
      const rt = getOrCreateRuntime(stream.id, stream.maxSeats, stream.hostUid, stream.hostName);
      if (rt.mutedUids.has(meta.session.uid)) {
        sendWs(ws, 'ws:error', { message: 'You are muted in this live room.' });
        return;
      }
      const chat: ChatMessage = {
        id: crypto.randomUUID(),
        roomId,
        uid: meta.session.uid,
        displayName: meta.session.displayName,
        role: meta.session.role,
        isFollower: rt.followers.has(meta.session.uid),
        text,
        timestamp: Date.now(),
      };
      rt.messages.push(chat);
      if (rt.messages.length > 80) rt.messages.shift();
      broadcastRoom(roomId, 'room:chat_msg', chat);
      return;
    }

    if (event === 'room:gift') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const giftName = typeof payload.giftName === 'string' ? payload.giftName.slice(0, 32) : 'Studio Rose';
      const coins = Math.max(10, Math.min(5000, Number(payload.coins) || 50));
      const pkSide = payload.pkSide === 'challenger' ? 'challenger' : 'host';
      if (!roomId || !meta.session) return;
      const stream = listAllStreams().find((s) => s.id === roomId);
      if (!stream) return;
      const rt = getOrCreateRuntime(stream.id, stream.maxSeats, stream.hostUid, stream.hostName);

      if (rt.pk.active) {
        if (pkSide === 'challenger') rt.pk.challengerScore += coins;
        else rt.pk.hostScore += coins;
      }

      const giftMsg: ChatMessage = {
        id: crypto.randomUUID(),
        roomId,
        uid: meta.session.uid,
        displayName: meta.session.displayName,
        role: meta.session.role,
        text: `sent ${giftName}`,
        gift: { name: giftName, coins },
        timestamp: Date.now(),
      };
      rt.messages.push(giftMsg);
      if (rt.messages.length > 80) rt.messages.shift();
      broadcastRoom(roomId, 'room:chat_msg', giftMsg);
      broadcastRoom(roomId, 'room:state', {
        roomId,
        seats: rt.seats,
        pk: rt.pk,
        messages: rt.messages,
        mutedUids: Array.from(rt.mutedUids),
      });
      return;
    }

    if (event === 'room:seat_toggle') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const seatIndex = Number(payload.seatIndex);
      if (!roomId || !meta.session || Number.isNaN(seatIndex)) return;
      const stream = listAllStreams().find((s) => s.id === roomId);
      if (!stream) return;
      const rt = getOrCreateRuntime(stream.id, stream.maxSeats, stream.hostUid, stream.hostName);
      const seat = rt.seats[seatIndex];
      if (!seat || seatIndex === 0) return;

      if (seat.uid === null) {
        // Leave any previous seat first
        for (const s of rt.seats) {
          if (s.uid === meta.session.uid && s.seatIndex !== 0) {
            s.uid = null;
            s.displayName = null;
          }
        }
        seat.uid = meta.session.uid;
        seat.displayName = meta.session.displayName;
        seat.muted = false;
      } else if (seat.uid === meta.session.uid || canModerateHost(meta.session, stream.hostUid, 'canManageSeats')) {
        seat.uid = null;
        seat.displayName = null;
      }

      broadcastRoom(roomId, 'room:state', {
        roomId,
        seats: rt.seats,
        pk: rt.pk,
        messages: rt.messages,
        mutedUids: Array.from(rt.mutedUids),
      });
      return;
    }

    if (event === 'room:pk_toggle') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      if (!roomId || !meta.session) return;
      const stream = listAllStreams().find((s) => s.id === roomId);
      if (!stream) return;
      if (!canModerateHost(meta.session, stream.hostUid, 'canRunPK')) {
        sendWs(ws, 'ws:error', { message: 'Only the Host or authorized Admin can start/stop PK battles.' });
        return;
      }
      const rt = getOrCreateRuntime(stream.id, stream.maxSeats, stream.hostUid, stream.hostName);
      rt.pk.active = !rt.pk.active;
      if (rt.pk.active) {
        rt.pk.hostScore = 0;
        rt.pk.challengerScore = 0;
        rt.pk.endsAt = Date.now() + 1000 * 60 * 5;
      }
      broadcastRoom(roomId, 'room:state', {
        roomId,
        seats: rt.seats,
        pk: rt.pk,
        messages: rt.messages,
        mutedUids: Array.from(rt.mutedUids),
      });
      return;
    }

    if (event === 'room:mute_user') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const targetUid = typeof payload.targetUid === 'string' ? payload.targetUid : '';
      if (!roomId || !targetUid || !meta.session) return;
      const stream = listAllStreams().find((s) => s.id === roomId);
      if (!stream) return;
      if (!canModerateHost(meta.session, stream.hostUid, 'canModerateChat')) {
        sendWs(ws, 'ws:error', { message: 'Moderation permission required.' });
        return;
      }
      const rt = getOrCreateRuntime(stream.id, stream.maxSeats, stream.hostUid, stream.hostName);
      if (rt.mutedUids.has(targetUid)) rt.mutedUids.delete(targetUid);
      else rt.mutedUids.add(targetUid);
      broadcastRoom(roomId, 'room:state', {
        roomId,
        seats: rt.seats,
        pk: rt.pk,
        messages: rt.messages,
        mutedUids: Array.from(rt.mutedUids),
      });
      return;
    }

    // --- Multiplayer Game Events (3D FPS, Ludo & Snakes) ---
    if (event === 'game:request_join') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const streamRoomId = typeof payload.streamRoomId === 'string' ? payload.streamRoomId : meta.subscribedRoomId || '';
      if (!meta.session) {
        sendWs(ws, 'ws:error', { message: 'Sign in first to request a seat in the game.' });
        return;
      }
      const rt = streamRoomId ? roomRuntimes.get(streamRoomId) : undefined;
      const isFollower = Boolean(payload.isFollower || (rt && rt.followers.has(meta.session.uid)));
      const result = gameEngine.requestJoin(roomId, meta.session.uid, meta.session.displayName, isFollower);
      if (result.error) sendWs(ws, 'ws:error', { message: result.error });
      else broadcastGame(roomId);
      return;
    }

    if (event === 'game:approve_player') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const targetUid = typeof payload.targetUid === 'string' ? payload.targetUid : '';
      const room = gameEngine.getRoom(roomId);
      if (!room || !meta.session) return;
      if (!canModerateHost(meta.session, room.hostUid, 'canApproveGames')) {
        sendWs(ws, 'ws:error', { message: 'Only the table Host (or delegated Admin) can approve join requests.' });
        return;
      }
      const result = gameEngine.approveRequest(roomId, targetUid, meta.session.displayName);
      if (result.error) sendWs(ws, 'ws:error', { message: result.error });
      else broadcastGame(roomId);
      return;
    }

    if (event === 'game:decline_player') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const targetUid = typeof payload.targetUid === 'string' ? payload.targetUid : '';
      const room = gameEngine.getRoom(roomId);
      if (!room || !meta.session) return;
      if (!canModerateHost(meta.session, room.hostUid, 'canApproveGames')) {
        sendWs(ws, 'ws:error', { message: 'Only the table Host (or delegated Admin) can decline requests.' });
        return;
      }
      const result = gameEngine.declineRequest(roomId, targetUid, meta.session.displayName);
      if (result.error) sendWs(ws, 'ws:error', { message: result.error });
      else broadcastGame(roomId);
      return;
    }

    if (event === 'game:add_bot') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const room = gameEngine.getRoom(roomId);
      if (!room || !meta.session) return;
      if (!canModerateHost(meta.session, room.hostUid, 'canApproveGames')) {
        sendWs(ws, 'ws:error', { message: 'Only the Host or authorized Admin can add a Studio Bot.' });
        return;
      }
      const result = gameEngine.addBot(roomId);
      if (result.error) sendWs(ws, 'ws:error', { message: result.error });
      else broadcastGame(roomId);
      return;
    }

    if (event === 'game:restart') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const room = gameEngine.getRoom(roomId);
      if (!room || !meta.session) return;
      if (!canModerateHost(meta.session, room.hostUid, 'canApproveGames')) {
        sendWs(ws, 'ws:error', { message: 'Only the Host or authorized Admin can restart the match.' });
        return;
      }
      const result = gameEngine.startOrRestart(roomId);
      if (result.error) sendWs(ws, 'ws:error', { message: result.error });
      else broadcastGame(roomId);
      return;
    }

    if (event === 'game:roll_dice') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      if (!meta.session) {
        sendWs(ws, 'ws:error', { message: 'Sign in to play.' });
        return;
      }
      const result = gameEngine.rollDice(roomId, meta.session.uid);
      if (result.error) sendWs(ws, 'ws:error', { message: result.error });
      else broadcastGame(roomId);
      return;
    }

    if (event === 'game:move_piece') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const tokenIndex = Number(payload.tokenIndex);
      if (!meta.session || Number.isNaN(tokenIndex)) return;
      const result = gameEngine.movePiece(roomId, meta.session.uid, tokenIndex);
      if (result.error) sendWs(ws, 'ws:error', { message: result.error });
      else broadcastGame(roomId);
      return;
    }

    if (event === 'game:fps_pose') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      if (!meta.session || !roomId) return;
      const x = Number(payload.x);
      const z = Number(payload.z);
      const yaw = Number(payload.yaw);
      const res = gameEngine.updateFpsPose(roomId, meta.session.uid, x, z, yaw);
      if (res.room && res.combatant) {
        broadcastAll('game:fps_sync', {
          roomId,
          combatants: res.room.fps?.combatants || {},
        });
      }
      return;
    }

    if (event === 'game:fps_hit') {
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
      const targetUid = typeof payload.targetUid === 'string' ? payload.targetUid : '';
      const headshot = Boolean(payload.headshot);
      if (!meta.session || !roomId || !targetUid) return;
      const result = gameEngine.registerFpsHit(roomId, meta.session.uid, targetUid, headshot);
      if (result.error) sendWs(ws, 'ws:error', { message: result.error });
      else if (result.room) broadcastAll('game:state', result.room);
    }
  });

  ws.on('close', () => {
    clients.delete(meta);
  });
});

// ---------------------------------------------------------------------------
// Frontend Serving (Vite Dev Middleware or Production Static Dist)
// ---------------------------------------------------------------------------

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server, path: '/__vite_hmr' },
        hmr: !hmrDisabled,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`STLive server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

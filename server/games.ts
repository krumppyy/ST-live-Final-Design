import crypto from 'crypto';
import type {
  FpsCombatantState,
  GamePlayer,
  GameRoomState,
  GameType,
  PlayerColor,
} from '../src/types';

const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

// Global Ludo track start offset per player color
const LUDO_START_OFFSETS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Safe star squares on the 52-step Ludo loop
const LUDO_SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Snakes & Ladders transitions
export const SNAKES_MAP: Record<number, number> = {
  27: 5,
  40: 3,
  43: 18,
  54: 31,
  66: 45,
  76: 58,
  89: 53,
  99: 41,
};

export const LADDERS_MAP: Record<number, number> = {
  4: 25,
  13: 46,
  33: 49,
  42: 63,
  50: 69,
  62: 81,
  74: 92,
};

// Open tactical spawn points inside Nova Strike 3D FPS arena (radius ~23m, clear of cover monoliths)
const FPS_SPAWNS: Array<{ x: number; z: number; yaw: number }> = [
  { x: 0, z: 18.5, yaw: 0 },
  { x: 0, z: -18.5, yaw: Math.PI },
  { x: 18.5, z: 4, yaw: Math.PI / 2 },
  { x: -18.5, z: -4, yaw: -Math.PI / 2 },
];

const FPS_TARGET_KILLS = 15;

function makeCombatant(params: {
  uid: string;
  displayName: string;
  color: PlayerColor;
  isBot: boolean;
  isHost?: boolean;
  isFollower?: boolean;
  slotIndex: number;
}): FpsCombatantState {
  const sp = FPS_SPAWNS[params.slotIndex % FPS_SPAWNS.length];
  return {
    uid: params.uid,
    displayName: params.displayName,
    color: params.color,
    isBot: params.isBot,
    isHost: params.isHost,
    isFollower: params.isFollower,
    x: sp.x,
    z: sp.z,
    yaw: sp.yaw,
    hp: 100,
    maxHp: 100,
    kills: 0,
    deaths: 0,
    score: 0,
  };
}

export class MultiplayerGameEngine {
  private rooms = new Map<string, GameRoomState>();

  constructor() {
    this.seedDefaultGames();
  }

  private seedDefaultGames(): void {
    this.createRoom({
      roomId: 'game-fps-main',
      title: 'Nova Strike 3D FPS — Live Squad Arena',
      gameType: 'fps',
      hostUid: 'ST-1003',
      hostName: 'Rohan Verma',
    });
    // Populate 2 patrolling Arena Bots so spectators & dropping-in players immediately have targets
    this.addBot('game-fps-main');
    this.addBot('game-fps-main');

    this.createRoom({
      roomId: 'game-ludo-main',
      title: 'STLive Championship Ludo Table',
      gameType: 'ludo',
      hostUid: 'ST-1001',
      hostName: 'Maya Lin',
    });
    this.createRoom({
      roomId: 'game-snakes-main',
      title: 'Live Lounge Snakes & Ladders',
      gameType: 'snakes',
      hostUid: 'ST-1002',
      hostName: 'Alex Chen',
    });
  }

  listRooms(): GameRoomState[] {
    return Array.from(this.rooms.values());
  }

  getRoom(roomId: string): GameRoomState | undefined {
    return this.rooms.get(roomId);
  }

  createRoom(params: {
    roomId?: string;
    title: string;
    gameType: GameType;
    hostUid: string;
    hostName: string;
  }): GameRoomState {
    const roomId = params.roomId || `game-${params.gameType}-${crypto.randomBytes(3).toString('hex')}`;
    const hostTokens = params.gameType === 'ludo' ? [-1, -1, -1, -1] : params.gameType === 'snakes' ? [0] : [];
    const gameLabel =
      params.gameType === 'fps'
        ? 'Nova Strike 3D FPS'
        : params.gameType === 'ludo'
          ? 'Ludo'
          : 'Snakes & Ladders';

    const room: GameRoomState = {
      roomId,
      title: params.title.trim().slice(0, 80) || 'Live Multiplayer Arena',
      gameType: params.gameType,
      hostUid: params.hostUid,
      hostName: params.hostName,
      status: 'lobby',
      maxPlayers: params.gameType === 'fps' ? 8 : 4,
      pendingRequests: [],
      players: [
        {
          uid: params.hostUid,
          displayName: params.hostName,
          color: 'red',
          isBot: false,
          tokens: hostTokens,
        },
      ],
      turnIndex: 0,
      diceValue: null,
      mustMove: false,
      fps:
        params.gameType === 'fps'
          ? {
              targetKills: FPS_TARGET_KILLS,
              combatants: {
                [params.hostUid]: makeCombatant({
                  uid: params.hostUid,
                  displayName: params.hostName,
                  color: 'red',
                  isBot: false,
                  isHost: true,
                  slotIndex: 0,
                }),
              },
              killFeed: [],
            }
          : undefined,
      winnerUid: null,
      winnerName: null,
      log: [`${params.hostName} opened the ${gameLabel} arena.`],
      updatedAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  requestJoin(
    roomId: string,
    uid: string,
    displayName: string,
    isFollower = false
  ): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    if (room.players.some((p) => p.uid === uid)) {
      return { room }; // Idempotent: already seated
    }
    if (room.players.length >= room.maxPlayers) {
      return { error: `Arena is already full (${room.maxPlayers}/${room.maxPlayers} players)` };
    }
    if (room.pendingRequests.some((r) => r.uid === uid)) {
      return { room }; // Idempotent: already requested
    }
    room.pendingRequests.push({ uid, displayName, isFollower, requestedAt: Date.now() });
    this.pushLog(
      room,
      `${displayName} (${uid})${isFollower ? ' [Follower]' : ''} sent a join request.`
    );
    room.updatedAt = Date.now();
    return { room };
  }

  approveRequest(roomId: string, targetUid: string, approverName: string): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    if (room.players.length >= room.maxPlayers) return { error: 'Arena is full' };

    const reqIndex = room.pendingRequests.findIndex((r) => r.uid === targetUid);
    if (reqIndex === -1) {
      return { error: 'Join request no longer pending' };
    }
    const [req] = room.pendingRequests.splice(reqIndex, 1);
    if (room.players.some((p) => p.uid === req.uid)) {
      return { room };
    }

    const usedColors = new Set(room.players.map((p) => p.color));
    const nextColor = PLAYER_COLORS.find((c) => !usedColors.has(c)) || 'blue';
    const slotIndex = room.players.length;

    room.players.push({
      uid: req.uid,
      displayName: req.displayName,
      color: nextColor,
      isBot: false,
      isFollower: req.isFollower,
      tokens: room.gameType === 'ludo' ? [-1, -1, -1, -1] : room.gameType === 'snakes' ? [0] : [],
    });

    if (room.gameType === 'fps' && room.fps) {
      room.fps.combatants[req.uid] = makeCombatant({
        uid: req.uid,
        displayName: req.displayName,
        color: nextColor,
        isBot: false,
        isFollower: req.isFollower,
        slotIndex,
      });
    }

    this.pushLog(
      room,
      `${approverName} approved ${req.displayName}${req.isFollower ? ' (Follower)' : ''} as ${nextColor.toUpperCase()}.`
    );
    if (room.status === 'lobby' && room.players.length >= 2) {
      room.status = 'playing';
      this.pushLog(
        room,
        room.gameType === 'fps'
          ? `Match is live! First to ${room.fps?.targetKills ?? FPS_TARGET_KILLS} eliminations wins.`
          : 'Match is live! Red goes first.'
      );
    }
    room.updatedAt = Date.now();
    return { room };
  }

  declineRequest(roomId: string, targetUid: string, approverName: string): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    const reqIndex = room.pendingRequests.findIndex((r) => r.uid === targetUid);
    if (reqIndex === -1) return { room };
    const [req] = room.pendingRequests.splice(reqIndex, 1);
    this.pushLog(room, `${approverName} declined ${req.displayName}'s join request.`);
    room.updatedAt = Date.now();
    return { room };
  }

  addBot(roomId: string): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    if (room.players.length >= room.maxPlayers) return { error: 'Arena is full' };

    const usedColors = new Set(room.players.map((p) => p.color));
    const nextColor = PLAYER_COLORS.find((c) => !usedColors.has(c)) || 'green';
    const botIndex = room.players.filter((p) => p.isBot).length + 1;
    const botUid = `BOT-${nextColor.toUpperCase()}-${botIndex}`;
    const botName = room.gameType === 'fps' ? `Nova Drone ${botIndex}` : `Studio Bot ${botIndex}`;
    const slotIndex = room.players.length;

    room.players.push({
      uid: botUid,
      displayName: botName,
      color: nextColor,
      isBot: true,
      tokens: room.gameType === 'ludo' ? [-1, -1, -1, -1] : room.gameType === 'snakes' ? [0] : [],
    });

    if (room.gameType === 'fps' && room.fps) {
      room.fps.combatants[botUid] = makeCombatant({
        uid: botUid,
        displayName: botName,
        color: nextColor,
        isBot: true,
        slotIndex,
      });
    }

    this.pushLog(room, `${botName} joined as ${nextColor.toUpperCase()}.`);
    if (room.status === 'lobby' && room.players.length >= 2) {
      room.status = 'playing';
      this.pushLog(room, 'Match started!');
    }
    room.updatedAt = Date.now();
    return { room };
  }

  startOrRestart(roomId: string): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    if (room.players.length < 2) {
      return { error: 'Need at least 2 approved players (or add a Bot) to start' };
    }

    if (room.gameType === 'fps' && room.fps) {
      const resetCombatants: Record<string, FpsCombatantState> = {};
      room.players.forEach((p, idx) => {
        resetCombatants[p.uid] = makeCombatant({
          uid: p.uid,
          displayName: p.displayName,
          color: p.color,
          isBot: p.isBot,
          isHost: p.uid === room.hostUid,
          isFollower: p.isFollower,
          slotIndex: idx,
        });
      });
      room.fps.combatants = resetCombatants;
      room.fps.killFeed = [];
    } else {
      for (const p of room.players) {
        p.tokens = room.gameType === 'ludo' ? [-1, -1, -1, -1] : [0];
      }
    }

    room.status = 'playing';
    room.turnIndex = 0;
    room.diceValue = null;
    room.mustMove = false;
    room.winnerUid = null;
    room.winnerName = null;
    this.pushLog(
      room,
      room.gameType === 'fps'
        ? `Fresh 3D FPS round started! First to ${room.fps?.targetKills ?? FPS_TARGET_KILLS} eliminations.`
        : `Fresh match started! ${room.players[0].displayName}'s turn.`
    );
    room.updatedAt = Date.now();
    return { room };
  }

  // ---------------------------------------------------------------------------
  // Server-Authoritative 3D First-Person Shooter (Nova Strike FPS)
  // ---------------------------------------------------------------------------

  updateFpsPose(
    roomId: string,
    actorUid: string,
    x: number,
    z: number,
    yaw: number
  ): { room?: GameRoomState; combatant?: FpsCombatantState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room || room.gameType !== 'fps' || !room.fps) return { error: 'FPS arena not found' };
    const combatant = room.fps.combatants[actorUid];
    if (!combatant) return { error: 'Not seated in this FPS arena' };

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    combatant.x = clamp(Number.isFinite(x) ? x : combatant.x, -23, 23);
    combatant.z = clamp(Number.isFinite(z) ? z : combatant.z, -23, 23);
    combatant.yaw = Number.isFinite(yaw) ? yaw : combatant.yaw;
    return { room, combatant };
  }

  registerFpsHit(
    roomId: string,
    shooterUid: string,
    targetUid: string,
    headshot: boolean
  ): { room?: GameRoomState; eliminated?: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room || room.gameType !== 'fps' || !room.fps) return { error: 'FPS arena not found' };
    if (room.status !== 'playing') return { error: 'Match is not currently active' };
    if (shooterUid === targetUid) return { error: 'Cannot shoot yourself' };

    const shooter = room.fps.combatants[shooterUid];
    const target = room.fps.combatants[targetUid];
    if (!shooter || !target) return { error: 'Player not found in arena' };

    const damage = headshot ? 68 : 34;
    target.hp = Math.max(0, target.hp - damage);
    shooter.score += headshot ? 50 : 25;

    let eliminated = false;
    if (target.hp <= 0) {
      eliminated = true;
      shooter.kills += 1;
      shooter.score += headshot ? 150 : 100;
      target.deaths += 1;
      target.hp = target.maxHp;

      // Respawn target at the corner farthest from the shooter
      let bestSpawn = FPS_SPAWNS[0];
      let bestDistSq = -1;
      for (const sp of FPS_SPAWNS) {
        const dx = sp.x - shooter.x;
        const dz = sp.z - shooter.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > bestDistSq) {
          bestDistSq = dSq;
          bestSpawn = sp;
        }
      }
      target.x = bestSpawn.x + (Math.random() - 0.5) * 2;
      target.z = bestSpawn.z + (Math.random() - 0.5) * 2;

      room.fps.killFeed.unshift({
        id: crypto.randomUUID(),
        killerName: shooter.displayName,
        victimName: target.displayName,
        headshot,
        timestamp: Date.now(),
      });
      if (room.fps.killFeed.length > 8) {
        room.fps.killFeed.length = 8;
      }

      this.pushLog(
        room,
        `${shooter.displayName} eliminated ${target.displayName}${headshot ? ' (HEADSHOT)' : ''}! [${shooter.kills}/${room.fps.targetKills}]`
      );

      if (shooter.kills >= room.fps.targetKills) {
        room.status = 'finished';
        room.winnerUid = shooter.uid;
        room.winnerName = shooter.displayName;
        this.pushLog(room, `${shooter.displayName} won Nova Strike 3D FPS!`);
      }
    }

    room.updatedAt = Date.now();
    return { room, eliminated };
  }

  tickFpsBots(): GameRoomState[] {
    const updated: GameRoomState[] = [];
    const t = Date.now() * 0.001;

    for (const room of this.rooms.values()) {
      if (room.gameType !== 'fps' || room.status !== 'playing' || !room.fps) continue;
      const bots = Object.values(room.fps.combatants).filter((c) => c.isBot);
      if (bots.length === 0) continue;

      const allCombatants = Object.values(room.fps.combatants);
      bots.forEach((bot, idx) => {
        const phase = idx * 2.3 + 0.5;
        // Patrol cleanly along mid-outer lanes clear of cover blocks
        const orbitRadius = 6.8 + Math.sin(t * 0.65 + phase) * 2.2 + (idx % 2) * 1.4;
        const angle = t * (0.48 + idx * 0.09) * (idx % 2 === 0 ? 1 : -1) + phase;
        const goalX = Math.max(-21, Math.min(21, Math.cos(angle) * orbitRadius));
        const goalZ = Math.max(-21, Math.min(21, Math.sin(angle) * orbitRadius));

        bot.x = Number((bot.x + (goalX - bot.x) * 0.24).toFixed(2));
        bot.z = Number((bot.z + (goalZ - bot.z) * 0.24).toFixed(2));

        // Face nearest opposing player
        const target = allCombatants.find((c) => c.uid !== bot.uid && !c.isBot) || allCombatants.find((c) => c.uid !== bot.uid);
        if (target) {
          bot.yaw = Number(Math.atan2(target.x - bot.x, target.z - bot.z).toFixed(2));
        }
      });

      updated.push(room);
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Board Games (Ludo & Snakes & Ladders)
  // ---------------------------------------------------------------------------

  rollDice(roomId: string, actorUid: string, isBotTurn = false): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    if (room.gameType === 'fps') return { error: 'FPS uses live 3D arena controls' };
    if (room.status !== 'playing') return { error: 'Game is not currently active' };
    const current = room.players[room.turnIndex];
    if (!current) return { error: 'No active player' };
    if (!isBotTurn && current.uid !== actorUid) {
      return { error: `It is ${current.displayName}'s turn` };
    }
    if (room.mustMove) return { error: 'Select a token to move first' };

    const roll = crypto.randomInt(1, 7);
    room.diceValue = roll;

    if (room.gameType === 'snakes') {
      this.applySnakesMove(room, current, roll);
      room.updatedAt = Date.now();
      return { room };
    }

    // Ludo roll handling
    const legalIndices = this.getLegalLudoTokens(current, roll);
    if (legalIndices.length === 0) {
      this.pushLog(room, `${current.displayName} rolled ${roll} — no legal moves.`);
      room.mustMove = false;
      this.advanceTurn(room);
    } else if (legalIndices.length === 1) {
      room.mustMove = true;
      this.applyLudoMove(room, current, legalIndices[0], roll);
    } else {
      room.mustMove = true;
      this.pushLog(room, `${current.displayName} rolled ${roll} — pick a highlighted token.`);
    }
    room.updatedAt = Date.now();
    return { room };
  }

  movePiece(roomId: string, actorUid: string, tokenIndex: number, isBotTurn = false): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    if (room.status !== 'playing' || !room.mustMove || room.diceValue === null) {
      return { error: 'Roll the dice first' };
    }
    const current = room.players[room.turnIndex];
    if (!isBotTurn && current.uid !== actorUid) {
      return { error: `It is ${current.displayName}'s turn` };
    }
    if (room.gameType !== 'ludo') return { error: 'Snakes auto-moves on roll' };

    const legal = this.getLegalLudoTokens(current, room.diceValue);
    if (!legal.includes(tokenIndex)) {
      return { error: 'That token cannot legally move with this roll' };
    }
    this.applyLudoMove(room, current, tokenIndex, room.diceValue);
    room.updatedAt = Date.now();
    return { room };
  }

  getLegalLudoTokens(player: GamePlayer, dice: number): number[] {
    const legal: number[] = [];
    player.tokens.forEach((pos, idx) => {
      if (pos === -1 && dice === 6) {
        legal.push(idx);
      } else if (pos >= 0 && pos < 56 && pos + dice <= 56) {
        legal.push(idx);
      }
    });
    return legal;
  }

  private applyLudoMove(room: GameRoomState, player: GamePlayer, tokenIndex: number, dice: number): void {
    const prev = player.tokens[tokenIndex];
    let bonusRoll = dice === 6;

    if (prev === -1 && dice === 6) {
      player.tokens[tokenIndex] = 0;
      this.pushLog(room, `${player.displayName} rolled 6 and deployed Token #${tokenIndex + 1}!`);
    } else {
      const next = prev + dice;
      player.tokens[tokenIndex] = next;

      if (next === 56) {
        bonusRoll = true;
        this.pushLog(room, `${player.displayName}'s Token #${tokenIndex + 1} reached HOME!`);
      } else if (next <= 50) {
        const globalPos = (LUDO_START_OFFSETS[player.color] + next) % 52;
        if (!LUDO_SAFE_SQUARES.has(globalPos)) {
          for (const opp of room.players) {
            if (opp.uid === player.uid) continue;
            opp.tokens.forEach((oppPos, oppIdx) => {
              if (oppPos >= 0 && oppPos <= 50) {
                const oppGlobal = (LUDO_START_OFFSETS[opp.color] + oppPos) % 52;
                if (oppGlobal === globalPos) {
                  opp.tokens[oppIdx] = -1;
                  bonusRoll = true;
                  this.pushLog(room, `${player.displayName} captured ${opp.displayName}'s token! Bonus roll!`);
                }
              }
            });
          }
        }
        this.pushLog(room, `${player.displayName} moved Token #${tokenIndex + 1} by ${dice}.`);
      } else {
        this.pushLog(room, `${player.displayName} advanced Token #${tokenIndex + 1} into the home lane.`);
      }
    }

    room.mustMove = false;

    if (player.tokens.every((t) => t === 56)) {
      room.status = 'finished';
      room.winnerUid = player.uid;
      room.winnerName = player.displayName;
      this.pushLog(room, `${player.displayName} won the Ludo match!`);
      return;
    }

    if (!bonusRoll) {
      this.advanceTurn(room);
    } else {
      this.pushLog(room, `${player.displayName} gets a bonus roll!`);
    }
  }

  private applySnakesMove(room: GameRoomState, player: GamePlayer, roll: number): void {
    const currentPos = player.tokens[0];
    let target = currentPos + roll;

    if (target > 100) {
      this.pushLog(room, `${player.displayName} rolled ${roll} (needs exact ${100 - currentPos} to finish).`);
      if (roll !== 6) this.advanceTurn(room);
      return;
    }

    let note = `${player.displayName} rolled ${roll} -> square ${target}`;
    if (LADDERS_MAP[target]) {
      const top = LADDERS_MAP[target];
      note = `${player.displayName} rolled ${roll}, climbed ladder ${target} -> ${top}!`;
      target = top;
    } else if (SNAKES_MAP[target]) {
      const tail = SNAKES_MAP[target];
      note = `${player.displayName} rolled ${roll}, slid down snake ${target} -> ${tail}!`;
      target = tail;
    }

    player.tokens[0] = target;
    this.pushLog(room, note);

    if (target === 100) {
      room.status = 'finished';
      room.winnerUid = player.uid;
      room.winnerName = player.displayName;
      this.pushLog(room, `${player.displayName} reached 100 and won Snakes & Ladders!`);
      return;
    }

    if (roll !== 6) {
      this.advanceTurn(room);
    } else {
      this.pushLog(room, `${player.displayName} rolled a 6 — bonus turn!`);
    }
  }

  private advanceTurn(room: GameRoomState): void {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
  }

  private pushLog(room: GameRoomState, entry: string): void {
    room.log.unshift(entry);
    if (room.log.length > 24) {
      room.log.length = 24;
    }
  }
}

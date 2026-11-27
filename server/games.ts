import crypto from 'crypto';
import type {
  FpsCombatantState,
  GamePlayer,
  GameRoomState,
  GameType,
  PlayerColor,
  RpgArenaState,
  RpgEnemyState,
  RpgHeroClass,
  RpgHeroState,
} from '../src/types';

const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

// Global Ludo track start offset per player color
const LUDO_START_OFFSETS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const LUDO_SAFE_CLASSIC = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const LUDO_SAFE_HARD = new Set([0, 13, 26, 39]);

const LUDO_LEVELS: Record<number, { title: string; difficulty: string; deployOnFive: boolean; safeSquares: Set<number> }> = {
  1: { title: 'Classic Lounge', difficulty: 'Level 1 · Standard', deployOnFive: false, safeSquares: LUDO_SAFE_CLASSIC },
  2: { title: 'Blitz Arena', difficulty: 'Level 2 · Fast (5/6 Out)', deployOnFive: true, safeSquares: LUDO_SAFE_HARD },
  3: { title: 'Grandmaster Stakes', difficulty: 'Level 3 · Hunter AI', deployOnFive: false, safeSquares: LUDO_SAFE_HARD },
};

// Multi-Level Snakes & Ladders boards (Level 1 -> Level 3 progressively harder)
export const SNAKES_LEVELS: Record<number, { title: string; difficulty: string; snakes: Record<number, number>; ladders: Record<number, number> }> = {
  1: {
    title: 'Emerald Meadow',
    difficulty: 'Level 1 · Balanced',
    snakes: { 27: 8, 43: 18, 54: 31, 66: 45, 76: 58, 89: 67, 98: 79 },
    ladders: { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 },
  },
  2: {
    title: 'Viper Canyon',
    difficulty: 'Level 2 · Steep Drops',
    snakes: { 24: 6, 40: 3, 48: 22, 59: 35, 68: 44, 79: 52, 87: 61, 94: 70, 97: 52 },
    ladders: { 5: 26, 17: 38, 32: 51, 46: 65, 63: 82, 73: 89 },
  },
  3: {
    title: 'Apex Gauntlet',
    difficulty: 'Level 3 · Brutal Climb',
    snakes: { 19: 4, 31: 11, 44: 16, 56: 29, 64: 36, 72: 41, 81: 49, 88: 53, 93: 60, 96: 44, 99: 21 },
    ladders: { 6: 27, 22: 43, 47: 66, 67: 84, 77: 91 },
  },
};

// Backwards-compatible default exports
export const SNAKES_MAP: Record<number, number> = SNAKES_LEVELS[1].snakes;
export const LADDERS_MAP: Record<number, number> = SNAKES_LEVELS[1].ladders;

// Progressive ST Strike 3D FPS Levels (1 -> 5, each noticeably harder)
interface FpsLevelSpec {
  level: number;
  name: string;
  difficulty: string;
  targetKills: number;
  botCount: number;
  botHp: number;
  botSpeed: number;
  enemyDamage: number;
  fireChance: number;
  hasBoss: boolean;
  bossName?: string;
  bossHp?: number;
}

const FPS_LEVELS: Record<number, FpsLevelSpec> = {
  1: {
    level: 1,
    name: 'Training Yard',
    difficulty: 'Level 1 · Rookie',
    targetKills: 5,
    botCount: 2,
    botHp: 85,
    botSpeed: 0.44,
    enemyDamage: 6,
    fireChance: 0.08,
    hasBoss: false,
  },
  2: {
    level: 2,
    name: 'Outpost Breach',
    difficulty: 'Level 2 · Tactical',
    targetKills: 8,
    botCount: 3,
    botHp: 110,
    botSpeed: 0.56,
    enemyDamage: 9,
    fireChance: 0.13,
    hasBoss: false,
  },
  3: {
    level: 3,
    name: 'Neon Foundry',
    difficulty: 'Level 3 · Veteran',
    targetKills: 10,
    botCount: 4,
    botHp: 130,
    botSpeed: 0.68,
    enemyDamage: 12,
    fireChance: 0.18,
    hasBoss: false,
  },
  4: {
    level: 4,
    name: 'Crimson Citadel',
    difficulty: 'Level 4 · Elite',
    targetKills: 12,
    botCount: 4,
    botHp: 150,
    botSpeed: 0.8,
    enemyDamage: 15,
    fireChance: 0.23,
    hasBoss: true,
    bossName: 'Sentinel Prime',
    bossHp: 210,
  },
  5: {
    level: 5,
    name: 'Apex Overlord',
    difficulty: 'Level 5 · Nightmare',
    targetKills: 15,
    botCount: 5,
    botHp: 170,
    botSpeed: 0.94,
    enemyDamage: 18,
    fireChance: 0.28,
    hasBoss: true,
    bossName: 'Apex Overlord',
    bossHp: 260,
  },
};

// Open tactical spawn points inside ST Strike 3D FPS arena
const FPS_SPAWNS: Array<{ x: number; z: number; yaw: number }> = [
  { x: 0, z: 18.5, yaw: 0 },
  { x: 0, z: -18.5, yaw: Math.PI },
  { x: 18.5, z: 4, yaw: Math.PI / 2 },
  { x: -18.5, z: -4, yaw: -Math.PI / 2 },
  { x: 14, z: 14, yaw: Math.PI / 4 },
  { x: -14, z: -14, yaw: -Math.PI * 0.75 },
];

// Lightweight Multiplayer Co-Op RPG (Realm Quest) — 5 Floors
interface RpgFloorSpec {
  floor: number;
  zoneName: string;
  difficulty: string;
  enemies: Array<{ name: string; kind: 'minion' | 'elite' | 'boss'; hp: number; atk: number }>;
  goldReward: number;
}

const RPG_FLOORS: Record<number, RpgFloorSpec> = {
  1: {
    floor: 1,
    zoneName: 'Whispering Crypt',
    difficulty: 'Floor 1 · Novice Raid',
    goldReward: 80,
    enemies: [
      { name: 'Crypt Goblin', kind: 'minion', hp: 55, atk: 10 },
      { name: 'Bone Warden', kind: 'boss', hp: 95, atk: 15 },
    ],
  },
  2: {
    floor: 2,
    zoneName: 'Ashen Caverns',
    difficulty: 'Floor 2 · Ember Trial',
    goldReward: 130,
    enemies: [
      { name: 'Ember Imp', kind: 'minion', hp: 70, atk: 13 },
      { name: 'Cinder Brute', kind: 'elite', hp: 95, atk: 16 },
      { name: 'Magma Golem', kind: 'boss', hp: 145, atk: 20 },
    ],
  },
  3: {
    floor: 3,
    zoneName: 'Sunken Sanctum',
    difficulty: 'Floor 3 · Abyssal',
    goldReward: 190,
    enemies: [
      { name: 'Shadow Wraith', kind: 'elite', hp: 95, atk: 17 },
      { name: 'Abyss Acolyte', kind: 'elite', hp: 90, atk: 19 },
      { name: 'Tide Serpent', kind: 'boss', hp: 185, atk: 24 },
    ],
  },
  4: {
    floor: 4,
    zoneName: 'Obsidian Spire',
    difficulty: 'Floor 4 · Heroic',
    goldReward: 260,
    enemies: [
      { name: 'Void Knight', kind: 'elite', hp: 125, atk: 22 },
      { name: 'Soul Reaver', kind: 'elite', hp: 115, atk: 24 },
      { name: 'Dread Lich', kind: 'boss', hp: 235, atk: 29 },
    ],
  },
  5: {
    floor: 5,
    zoneName: 'Elder Wyrm Throne',
    difficulty: 'Floor 5 · Mythic Boss',
    goldReward: 400,
    enemies: [
      { name: 'Wyrmguard', kind: 'elite', hp: 145, atk: 25 },
      { name: 'Flame Sentinel', kind: 'elite', hp: 140, atk: 27 },
      { name: 'Elder Wyrm', kind: 'boss', hp: 310, atk: 34 },
    ],
  },
};

const RPG_CLASS_STATS: Record<RpgHeroClass, { maxHp: number; maxMp: number; atk: number }> = {
  vanguard: { maxHp: 140, maxMp: 45, atk: 20 },
  arcanist: { maxHp: 96, maxMp: 80, atk: 26 },
  ranger: { maxHp: 112, maxMp: 55, atk: 24 },
  cleric: { maxHp: 118, maxMp: 75, atk: 18 },
};

const RPG_DEFAULT_CLASSES: RpgHeroClass[] = ['vanguard', 'cleric', 'arcanist', 'ranger'];

function makeCombatant(params: {
  uid: string;
  displayName: string;
  color: PlayerColor;
  isBot: boolean;
  isBoss?: boolean;
  isHost?: boolean;
  isFollower?: boolean;
  slotIndex: number;
  maxHp?: number;
}): FpsCombatantState {
  const sp = FPS_SPAWNS[params.slotIndex % FPS_SPAWNS.length];
  const hp = params.maxHp ?? 100;
  return {
    uid: params.uid,
    displayName: params.displayName,
    color: params.color,
    isBot: params.isBot,
    isBoss: params.isBoss,
    isHost: params.isHost,
    isFollower: params.isFollower,
    x: sp.x,
    z: sp.z,
    yaw: sp.yaw,
    hp,
    maxHp: hp,
    kills: 0,
    deaths: 0,
    score: 0,
  };
}

function makeRpgHero(params: {
  uid: string;
  displayName: string;
  color: PlayerColor;
  isBot: boolean;
  heroClass: RpgHeroClass;
  heroLevel?: number;
}): RpgHeroState {
  const lvl = params.heroLevel ?? 1;
  const base = RPG_CLASS_STATS[params.heroClass];
  const maxHp = base.maxHp + (lvl - 1) * 14;
  const maxMp = base.maxMp + (lvl - 1) * 6;
  const atk = base.atk + (lvl - 1) * 4;
  return {
    uid: params.uid,
    displayName: params.displayName,
    color: params.color,
    heroClass: params.heroClass,
    isBot: params.isBot,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    atk,
    shield: 0,
    xp: 0,
    heroLevel: lvl,
    alive: true,
  };
}

function buildFloorEnemies(floor: number): RpgEnemyState[] {
  const spec = RPG_FLOORS[floor] || RPG_FLOORS[1];
  return spec.enemies.map((e, idx) => ({
    id: `f${floor}-e${idx + 1}`,
    name: e.name,
    kind: e.kind,
    hp: e.hp,
    maxHp: e.hp,
    atk: e.atk,
    alive: true,
  }));
}

export class MultiplayerGameEngine {
  private rooms = new Map<string, GameRoomState>();

  constructor() {
    this.seedDefaultGames();
  }

  private seedDefaultGames(): void {
    this.createRoom({
      roomId: 'game-fps-main',
      title: 'ST Strike 3D — Progressive Squad Arena',
      gameType: 'fps',
      hostUid: 'ST-1003',
      hostName: 'Rohan Verma',
      level: 1,
    });

    this.createRoom({
      roomId: 'game-rpg-main',
      title: 'Realm Quest Co-Op RPG — Live Party Raid',
      gameType: 'rpg',
      hostUid: 'ST-1001',
      hostName: 'Maya Lin',
      level: 1,
    });

    this.createRoom({
      roomId: 'game-ludo-main',
      title: 'STLive Multi-Level Ludo Table',
      gameType: 'ludo',
      hostUid: 'ST-1001',
      hostName: 'Maya Lin',
      level: 1,
    });

    this.createRoom({
      roomId: 'game-snakes-main',
      title: 'Live Lounge Snakes & Ladders',
      gameType: 'snakes',
      hostUid: 'ST-1002',
      hostName: 'Alex Chen',
      level: 1,
    });
  }

  listRooms(): GameRoomState[] {
    return Array.from(this.rooms.values());
  }

  getRoom(roomId: string): GameRoomState | undefined {
    return this.rooms.get(roomId);
  }

  private getLevelMeta(gameType: GameType, level: number): { maxLevel: number; levelTitle: string; difficultyLabel: string } {
    if (gameType === 'fps') {
      const clamped = Math.max(1, Math.min(5, level));
      const spec = FPS_LEVELS[clamped];
      return { maxLevel: 5, levelTitle: spec.name, difficultyLabel: spec.difficulty };
    }
    if (gameType === 'rpg') {
      const clamped = Math.max(1, Math.min(5, level));
      const spec = RPG_FLOORS[clamped];
      return { maxLevel: 5, levelTitle: spec.zoneName, difficultyLabel: spec.difficulty };
    }
    if (gameType === 'snakes') {
      const clamped = Math.max(1, Math.min(3, level));
      const spec = SNAKES_LEVELS[clamped];
      return { maxLevel: 3, levelTitle: spec.title, difficultyLabel: spec.difficulty };
    }
    const clamped = Math.max(1, Math.min(3, level));
    const spec = LUDO_LEVELS[clamped];
    return { maxLevel: 3, levelTitle: spec.title, difficultyLabel: spec.difficulty };
  }

  createRoom(params: {
    roomId?: string;
    title: string;
    gameType: GameType;
    hostUid: string;
    hostName: string;
    level?: number;
  }): GameRoomState {
    const roomId = params.roomId || `game-${params.gameType}-${crypto.randomBytes(3).toString('hex')}`;
    const hostTokens = params.gameType === 'ludo' ? [-1, -1, -1, -1] : params.gameType === 'snakes' ? [0] : [];
    const maxLevel = params.gameType === 'fps' || params.gameType === 'rpg' ? 5 : 3;
    const level = Math.max(1, Math.min(maxLevel, params.level ?? 1));
    const meta = this.getLevelMeta(params.gameType, level);
    const gameLabel =
      params.gameType === 'fps'
        ? 'ST Strike 3D'
        : params.gameType === 'rpg'
          ? 'Realm Quest RPG'
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
      level,
      maxLevel: meta.maxLevel,
      levelTitle: meta.levelTitle,
      difficultyLabel: meta.difficultyLabel,
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
      snakesMap: params.gameType === 'snakes' ? SNAKES_LEVELS[level].snakes : undefined,
      laddersMap: params.gameType === 'snakes' ? SNAKES_LEVELS[level].ladders : undefined,
      fps: undefined,
      rpg: undefined,
      winnerUid: null,
      winnerName: null,
      log: [`${params.hostName} opened ${gameLabel} (${meta.difficultyLabel}).`],
      updatedAt: Date.now(),
    };

    if (params.gameType === 'fps') {
      this.initializeFpsLevel(room, level);
    } else if (params.gameType === 'rpg') {
      this.initializeRpgFloor(room, level, true);
    }

    this.rooms.set(roomId, room);
    return room;
  }

  private initializeFpsLevel(room: GameRoomState, level: number): void {
    const spec = FPS_LEVELS[Math.max(1, Math.min(5, level))];
    room.level = spec.level;
    room.maxLevel = 5;
    room.levelTitle = spec.name;
    room.difficultyLabel = spec.difficulty;

    // Keep human players, replace bots with level-scaled drones + optional Boss
    const humans = room.players.filter((p) => !p.isBot);
    room.players = [...humans];

    const combatants: Record<string, FpsCombatantState> = {};
    humans.forEach((p, idx) => {
      combatants[p.uid] = makeCombatant({
        uid: p.uid,
        displayName: p.displayName,
        color: p.color,
        isBot: false,
        isHost: p.uid === room.hostUid,
        isFollower: p.isFollower,
        slotIndex: idx,
        maxHp: 100,
      });
    });

    const totalBots = Math.min(spec.botCount, Math.max(1, room.maxPlayers - humans.length));
    for (let i = 0; i < totalBots; i++) {
      const isBoss = spec.hasBoss && i === totalBots - 1;
      const color = PLAYER_COLORS[(humans.length + i) % PLAYER_COLORS.length];
      const botUid = isBoss ? `BOT-BOSS-L${spec.level}` : `BOT-L${spec.level}-${i + 1}`;
      const botName = isBoss ? (spec.bossName || 'Apex Boss') : `Strike Drone ${spec.level}.${i + 1}`;
      room.players.push({
        uid: botUid,
        displayName: botName,
        color,
        isBot: true,
        tokens: [],
      });
      combatants[botUid] = makeCombatant({
        uid: botUid,
        displayName: botName,
        color,
        isBot: true,
        isBoss,
        slotIndex: humans.length + i,
        maxHp: isBoss ? (spec.bossHp ?? 220) : spec.botHp,
      });
    }

    room.fps = {
      level: spec.level,
      maxLevel: 5,
      levelName: spec.name,
      targetKills: spec.targetKills,
      enemyDamage: spec.enemyDamage,
      botSpeed: spec.botSpeed,
      bossActive: spec.hasBoss,
      levelCleared: false,
      combatants,
      killFeed: [],
    };
    room.status = 'playing';
    room.winnerUid = null;
    room.winnerName = null;
  }

  private initializeRpgFloor(room: GameRoomState, floor: number, seedCompanion = false): void {
    const spec = RPG_FLOORS[Math.max(1, Math.min(5, floor))];
    room.level = spec.floor;
    room.maxLevel = 5;
    room.levelTitle = spec.zoneName;
    room.difficultyLabel = spec.difficulty;

    if (seedCompanion && room.players.length < 2) {
      room.players.push({
        uid: 'BOT-CLERIC-1',
        displayName: 'Lyra (AI Cleric)',
        color: 'green',
        isBot: true,
        tokens: [],
      });
    }

    const prevHeroes = room.rpg?.heroes || {};
    const heroes: Record<string, RpgHeroState> = {};
    room.players.forEach((p, idx) => {
      const existing = prevHeroes[p.uid];
      const cls: RpgHeroClass =
        existing?.heroClass || (p.isBot ? 'cleric' : RPG_DEFAULT_CLASSES[idx % RPG_DEFAULT_CLASSES.length]);
      const heroLevel = existing ? Math.min(10, existing.heroLevel + (floor > (room.rpg?.floor || 1) ? 1 : 0)) : 1;
      const fresh = makeRpgHero({
        uid: p.uid,
        displayName: p.displayName,
        color: p.color,
        isBot: p.isBot,
        heroClass: cls,
        heroLevel,
      });
      fresh.xp = existing?.xp || 0;
      heroes[p.uid] = fresh;
    });

    const rpg: RpgArenaState = {
      floor: spec.floor,
      maxFloor: 5,
      zoneName: spec.zoneName,
      round: 1,
      potions: Math.max(3, (room.rpg?.potions ?? 2) + 1),
      partyGold: room.rpg?.partyGold ?? 0,
      heroes,
      enemies: buildFloorEnemies(spec.floor),
      lastActionText: `Entered Floor ${spec.floor}: ${spec.zoneName}. Defeat all foes!`,
      floorCleared: false,
    };

    room.rpg = rpg;
    room.status = room.players.length >= 1 ? 'playing' : 'lobby';
    room.turnIndex = 0;
    room.winnerUid = null;
    room.winnerName = null;
  }

  setLevel(roomId: string, nextLevel: number): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    const clamped = Math.max(1, Math.min(room.maxLevel, Math.floor(nextLevel) || 1));

    if (room.gameType === 'fps') {
      this.initializeFpsLevel(room, clamped);
      this.pushLog(room, `ST Strike advanced to Level ${clamped}: ${room.levelTitle} (${room.difficultyLabel})!`);
    } else if (room.gameType === 'rpg') {
      this.initializeRpgFloor(room, clamped, false);
      this.pushLog(room, `Party entered Floor ${clamped}: ${room.levelTitle} (${room.difficultyLabel})!`);
    } else if (room.gameType === 'snakes') {
      const spec = SNAKES_LEVELS[clamped];
      room.level = clamped;
      room.levelTitle = spec.title;
      room.difficultyLabel = spec.difficulty;
      room.snakesMap = spec.snakes;
      room.laddersMap = spec.ladders;
      for (const p of room.players) p.tokens = [0];
      room.turnIndex = 0;
      room.diceValue = null;
      room.mustMove = false;
      room.winnerUid = null;
      room.winnerName = null;
      room.status = room.players.length >= 2 ? 'playing' : 'lobby';
      this.pushLog(room, `Snakes & Ladders switched to ${spec.difficulty}: ${spec.title}!`);
    } else {
      const spec = LUDO_LEVELS[clamped];
      room.level = clamped;
      room.levelTitle = spec.title;
      room.difficultyLabel = spec.difficulty;
      for (const p of room.players) p.tokens = [-1, -1, -1, -1];
      room.turnIndex = 0;
      room.diceValue = null;
      room.mustMove = false;
      room.winnerUid = null;
      room.winnerName = null;
      room.status = room.players.length >= 2 ? 'playing' : 'lobby';
      this.pushLog(room, `Ludo switched to ${spec.difficulty}: ${spec.title}!`);
    }

    room.updatedAt = Date.now();
    return { room };
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
      return { room };
    }
    if (room.players.length >= room.maxPlayers) {
      return { error: `Arena is already full (${room.maxPlayers}/${room.maxPlayers} players)` };
    }
    if (room.pendingRequests.some((r) => r.uid === uid)) {
      return { room };
    }
    room.pendingRequests.push({ uid, displayName, isFollower, requestedAt: Date.now() });
    this.pushLog(room, `${displayName} (${uid})${isFollower ? ' [Follower]' : ''} sent a join request.`);
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
    } else if (room.gameType === 'rpg' && room.rpg) {
      const heroClass = RPG_DEFAULT_CLASSES[slotIndex % RPG_DEFAULT_CLASSES.length];
      room.rpg.heroes[req.uid] = makeRpgHero({
        uid: req.uid,
        displayName: req.displayName,
        color: nextColor,
        isBot: false,
        heroClass,
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
          ? `ST Strike Level ${room.level} is live! First to ${room.fps?.targetKills ?? 8} kills.`
          : room.gameType === 'rpg'
            ? `Party Raid started on Floor ${room.level}!`
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
    const botUid = `BOT-${nextColor.toUpperCase()}-${botIndex}-${crypto.randomBytes(2).toString('hex')}`;
    const botName =
      room.gameType === 'fps'
        ? `Strike Drone ${room.level}.${botIndex}`
        : room.gameType === 'rpg'
          ? `AI Hero ${botIndex}`
          : `Studio Bot ${botIndex}`;
    const slotIndex = room.players.length;

    room.players.push({
      uid: botUid,
      displayName: botName,
      color: nextColor,
      isBot: true,
      tokens: room.gameType === 'ludo' ? [-1, -1, -1, -1] : room.gameType === 'snakes' ? [0] : [],
    });

    if (room.gameType === 'fps' && room.fps) {
      const spec = FPS_LEVELS[room.level] || FPS_LEVELS[1];
      room.fps.combatants[botUid] = makeCombatant({
        uid: botUid,
        displayName: botName,
        color: nextColor,
        isBot: true,
        slotIndex,
        maxHp: spec.botHp,
      });
    } else if (room.gameType === 'rpg' && room.rpg) {
      const heroClass = RPG_DEFAULT_CLASSES[slotIndex % RPG_DEFAULT_CLASSES.length];
      room.rpg.heroes[botUid] = makeRpgHero({
        uid: botUid,
        displayName: botName,
        color: nextColor,
        isBot: true,
        heroClass,
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
    if (room.gameType !== 'rpg' && room.players.length < 2) {
      return { error: 'Need at least 2 approved players (or add a Bot) to start' };
    }
    return this.setLevel(roomId, room.level);
  }

  // ---------------------------------------------------------------------------
  // Server-Authoritative ST Strike 3D FPS (Multi-Level 1..5 + Enemy Return Fire)
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

    const damage = headshot ? 72 : 36;
    target.hp = Math.max(0, target.hp - damage);
    shooter.score += headshot ? 55 : 25;

    let eliminated = false;
    if (target.hp <= 0) {
      eliminated = true;
      shooter.kills += 1;
      shooter.score += target.isBoss ? 350 : headshot ? 150 : 100;
      // Restore small combat shield regen on elimination
      shooter.hp = Math.min(shooter.maxHp, shooter.hp + 18);
      target.deaths += 1;
      target.hp = target.maxHp;

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
      if (room.fps.killFeed.length > 8) room.fps.killFeed.length = 8;

      this.pushLog(
        room,
        `${shooter.displayName} eliminated ${target.displayName}${headshot ? ' (HEADSHOT)' : ''}! [${shooter.kills}/${room.fps.targetKills}]`
      );

      if (shooter.kills >= room.fps.targetKills) {
        room.fps.levelCleared = true;
        room.status = 'finished';
        room.winnerUid = shooter.uid;
        room.winnerName = shooter.displayName;
        this.pushLog(
          room,
          room.level < 5
            ? `${shooter.displayName} cleared Level ${room.level}: ${room.levelTitle}! Ready for Level ${room.level + 1}.`
            : `${shooter.displayName} conquered Level 5: Apex Overlord!`
        );
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
      const spec = FPS_LEVELS[room.level] || FPS_LEVELS[1];
      const bots = Object.values(room.fps.combatants).filter((c) => c.isBot);
      if (bots.length === 0) continue;

      const humans = Object.values(room.fps.combatants).filter((c) => !c.isBot);
      const allCombatants = Object.values(room.fps.combatants);

      bots.forEach((bot, idx) => {
        const phase = idx * 2.1 + 0.5;
        const speedMul = spec.botSpeed * (bot.isBoss ? 1.15 : 1);
        const orbitRadius = 6.2 + Math.sin(t * (0.65 + room.level * 0.12) + phase) * 2.8 + (idx % 2) * 1.6;
        const angle = t * (speedMul + idx * 0.07) * (idx % 2 === 0 ? 1 : -1) + phase;
        const goalX = Math.max(-21, Math.min(21, Math.cos(angle) * orbitRadius));
        const goalZ = Math.max(-21, Math.min(21, Math.sin(angle) * orbitRadius));

        bot.x = Number((bot.x + (goalX - bot.x) * 0.28).toFixed(2));
        bot.z = Number((bot.z + (goalZ - bot.z) * 0.28).toFixed(2));

        const target = humans[idx % Math.max(1, humans.length)] || allCombatants.find((c) => c.uid !== bot.uid);
        if (target) {
          bot.yaw = Number(Math.atan2(target.x - bot.x, target.z - bot.z).toFixed(2));
          // Escalating enemy return-fire on higher levels when in sight range
          const dist = Math.hypot(target.x - bot.x, target.z - bot.z);
          if (!target.isBot && dist < 17 && Math.random() < spec.fireChance * 0.22) {
            const dmg = Math.round(spec.enemyDamage * (bot.isBoss ? 1.35 : 1));
            target.hp = Math.max(0, target.hp - dmg);
            if (target.hp <= 0) {
              target.deaths += 1;
              target.hp = target.maxHp;
              const sp = FPS_SPAWNS[0];
              target.x = sp.x;
              target.z = sp.z;
              bot.kills += 1;
              room.fps!.killFeed.unshift({
                id: crypto.randomUUID(),
                killerName: bot.displayName,
                victimName: target.displayName,
                headshot: false,
                timestamp: Date.now(),
              });
              if (room.fps!.killFeed.length > 8) room.fps!.killFeed.length = 8;
            }
          }
        }
      });

      updated.push(room);
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Server-Authoritative Multiplayer Co-Op RPG (Realm Quest, Floors 1..5)
  // ---------------------------------------------------------------------------

  rpgChooseClass(roomId: string, actorUid: string, heroClass: RpgHeroClass): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room || room.gameType !== 'rpg' || !room.rpg) return { error: 'RPG raid room not found' };
    const hero = room.rpg.heroes[actorUid];
    if (!hero) return { error: 'Join the party first to pick a class' };
    const allowed: RpgHeroClass[] = ['vanguard', 'arcanist', 'ranger', 'cleric'];
    if (!allowed.includes(heroClass)) return { error: 'Invalid class' };

    const rebuilt = makeRpgHero({
      uid: hero.uid,
      displayName: hero.displayName,
      color: hero.color,
      isBot: hero.isBot,
      heroClass,
      heroLevel: hero.heroLevel,
    });
    rebuilt.xp = hero.xp;
    room.rpg.heroes[actorUid] = rebuilt;
    this.pushLog(room, `${hero.displayName} switched class to ${heroClass.toUpperCase()}.`);
    room.updatedAt = Date.now();
    return { room };
  }

  rpgAction(
    roomId: string,
    actorUid: string,
    action: 'strike' | 'skill' | 'defend' | 'potion',
    targetEnemyId?: string,
    isBotTurn = false
  ): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room || room.gameType !== 'rpg' || !room.rpg) return { error: 'RPG raid not found' };
    if (room.status !== 'playing') return { error: 'Raid floor is finished — advance to Next Floor or Reset' };

    const current = room.players[room.turnIndex];
    if (!current) return { error: 'No active hero' };
    if (!isBotTurn && current.uid !== actorUid) {
      return { error: `Waiting on ${current.displayName}'s turn` };
    }

    const rpg = room.rpg;
    const hero = rpg.heroes[current.uid];
    if (!hero || !hero.alive) {
      this.advanceRpgTurn(room);
      return { room };
    }

    const livingEnemies = rpg.enemies.filter((e) => e.alive);
    if (livingEnemies.length === 0) {
      rpg.floorCleared = true;
      room.status = 'finished';
      return { room };
    }

    const target = livingEnemies.find((e) => e.id === targetEnemyId) || livingEnemies[0];
    let summary = '';

    if (action === 'strike') {
      const dmg = hero.atk + crypto.randomInt(2, 9);
      target.hp = Math.max(0, target.hp - dmg);
      hero.mp = Math.min(hero.maxMp, hero.mp + 10);
      if (target.hp <= 0) target.alive = false;
      summary = `${hero.displayName} struck ${target.name} for ${dmg} DMG${!target.alive ? ' (DEFEATED!)' : ''}.`;
    } else if (action === 'defend') {
      hero.shield = Math.min(45, hero.shield + 20);
      hero.mp = Math.min(hero.maxMp, hero.mp + 16);
      summary = `${hero.displayName} raised Guard (+20 Shield, +16 MP).`;
    } else if (action === 'potion') {
      if (rpg.potions <= 0) return { error: 'No party potions left on this floor!' };
      rpg.potions -= 1;
      const heal = Math.round(hero.maxHp * 0.55);
      hero.hp = Math.min(hero.maxHp, hero.hp + heal);
      summary = `${hero.displayName} drank a Potion (+${heal} HP, ${rpg.potions} left).`;
    } else if (action === 'skill') {
      const mpCost = 18;
      if (hero.mp < mpCost) return { error: `Need ${mpCost} MP to use Class Skill (Strike or Defend to recharge).` };
      hero.mp -= mpCost;

      if (hero.heroClass === 'cleric') {
        const healAmt = 36 + hero.heroLevel * 6;
        for (const ally of Object.values(rpg.heroes)) {
          if (ally.alive) ally.hp = Math.min(ally.maxHp, ally.hp + healAmt);
        }
        summary = `${hero.displayName} cast Sanctuary (+${healAmt} HP to entire party)!`;
      } else if (hero.heroClass === 'arcanist') {
        const aoeDmg = Math.round(hero.atk * 1.15) + crypto.randomInt(4, 10);
        for (const enemy of livingEnemies) {
          enemy.hp = Math.max(0, enemy.hp - aoeDmg);
          if (enemy.hp <= 0) enemy.alive = false;
        }
        summary = `${hero.displayName} unleashed Arcane Nova (${aoeDmg} DMG to all foes)!`;
      } else if (hero.heroClass === 'vanguard') {
        const bashDmg = Math.round(hero.atk * 1.45) + 6;
        target.hp = Math.max(0, target.hp - bashDmg);
        if (target.hp <= 0) target.alive = false;
        for (const ally of Object.values(rpg.heroes)) {
          if (ally.alive) ally.shield = Math.min(45, ally.shield + 14);
        }
        summary = `${hero.displayName} used Aegis Bash (${bashDmg} DMG to ${target.name} + Party Shield)!`;
      } else {
        // Ranger: Piercing Volley crit
        const critDmg = Math.round(hero.atk * 1.9) + crypto.randomInt(5, 12);
        target.hp = Math.max(0, target.hp - critDmg);
        if (target.hp <= 0) target.alive = false;
        summary = `${hero.displayName} fired Piercing Volley (${critDmg} CRIT DMG to ${target.name})!`;
      }
    }

    rpg.lastActionText = summary;
    this.pushLog(room, summary);

    // Check floor victory
    if (rpg.enemies.every((e) => !e.alive)) {
      const floorSpec = RPG_FLOORS[rpg.floor] || RPG_FLOORS[1];
      rpg.floorCleared = true;
      rpg.partyGold += floorSpec.goldReward;
      for (const h of Object.values(rpg.heroes)) {
        h.xp += 50 * rpg.floor;
        if (h.xp >= h.heroLevel * 100) {
          h.heroLevel += 1;
          h.maxHp += 14;
          h.maxMp += 6;
          h.atk += 4;
          h.hp = h.maxHp;
          h.mp = h.maxMp;
        }
      }
      room.status = 'finished';
      room.winnerUid = room.hostUid;
      room.winnerName = `Party Cleared Floor ${rpg.floor}: ${rpg.zoneName}!`;
      rpg.lastActionText = `Floor ${rpg.floor} cleared! +${floorSpec.goldReward} Gold looted.`;
      this.pushLog(room, rpg.lastActionText);
      room.updatedAt = Date.now();
      return { room };
    }

    this.advanceRpgTurn(room);
    room.updatedAt = Date.now();
    return { room };
  }

  private advanceRpgTurn(room: GameRoomState): void {
    const rpg = room.rpg;
    if (!rpg) return;

    const total = room.players.length;
    let nextIdx = room.turnIndex + 1;
    let wrapped = false;

    while (nextIdx < total) {
      const p = room.players[nextIdx];
      if (rpg.heroes[p.uid]?.alive) break;
      nextIdx += 1;
    }

    if (nextIdx >= total) {
      wrapped = true;
      nextIdx = 0;
      while (nextIdx < total && !rpg.heroes[room.players[nextIdx].uid]?.alive) {
        nextIdx += 1;
      }
    }

    // End of party round -> Living enemies counter-attack!
    if (wrapped) {
      rpg.round += 1;
      const aliveHeroes = Object.values(rpg.heroes).filter((h) => h.alive);
      const aliveEnemies = rpg.enemies.filter((e) => e.alive);
      if (aliveHeroes.length > 0 && aliveEnemies.length > 0) {
        const hitNotes: string[] = [];
        for (const enemy of aliveEnemies) {
          const livingNow = Object.values(rpg.heroes).filter((h) => h.alive);
          if (livingNow.length === 0) break;
          // Prefer targeting Vanguard tank if alive
          const targetHero =
            livingNow.find((h) => h.heroClass === 'vanguard') ||
            livingNow[crypto.randomInt(0, livingNow.length)];
          const raw = enemy.atk + crypto.randomInt(-2, 4);
          const absorbed = Math.min(targetHero.shield, raw);
          targetHero.shield -= absorbed;
          const finalDmg = Math.max(1, raw - absorbed);
          targetHero.hp = Math.max(0, targetHero.hp - finalDmg);
          if (targetHero.hp <= 0) {
            targetHero.alive = false;
            hitNotes.push(`${enemy.name} KO'd ${targetHero.displayName}!`);
          } else {
            hitNotes.push(`${enemy.name} hit ${targetHero.displayName} (-${finalDmg} HP)`);
          }
        }
        if (hitNotes.length > 0) {
          const enemyMsg = `Enemy Wave: ${hitNotes.join(' · ')}`;
          rpg.lastActionText = enemyMsg;
          this.pushLog(room, enemyMsg);
        }
      }

      // Check party wipe
      if (Object.values(rpg.heroes).every((h) => !h.alive)) {
        room.status = 'finished';
        room.winnerUid = null;
        room.winnerName = null;
        rpg.lastActionText = 'Party fallen! Tap Retry Floor to rally.';
        this.pushLog(room, rpg.lastActionText);
        return;
      }

      // Pick first living hero for next round
      const firstAlive = room.players.findIndex((p) => rpg.heroes[p.uid]?.alive);
      room.turnIndex = firstAlive >= 0 ? firstAlive : 0;
    } else {
      room.turnIndex = nextIdx;
    }
  }

  // ---------------------------------------------------------------------------
  // Board Games (Multi-Level Ludo & Multi-Level Snakes & Ladders)
  // ---------------------------------------------------------------------------

  rollDice(roomId: string, actorUid: string, isBotTurn = false): { room?: GameRoomState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Game room not found' };
    if (room.gameType === 'fps' || room.gameType === 'rpg') {
      return { error: 'This game uses live action controls instead of dice' };
    }
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

    // Multi-level Ludo roll handling
    const legalIndices = this.getLegalLudoTokens(current, roll, room.level);
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

    const legal = this.getLegalLudoTokens(current, room.diceValue, room.level);
    if (!legal.includes(tokenIndex)) {
      return { error: 'That token cannot legally move with this roll' };
    }
    this.applyLudoMove(room, current, tokenIndex, room.diceValue);
    room.updatedAt = Date.now();
    return { room };
  }

  getLegalLudoTokens(player: GamePlayer, dice: number, level = 1): number[] {
    const cfg = LUDO_LEVELS[level] || LUDO_LEVELS[1];
    const canDeploy = dice === 6 || (cfg.deployOnFive && dice === 5);
    const legal: number[] = [];
    player.tokens.forEach((pos, idx) => {
      if (pos === -1 && canDeploy) {
        legal.push(idx);
      } else if (pos >= 0 && pos < 56 && pos + dice <= 56) {
        legal.push(idx);
      }
    });
    return legal;
  }

  chooseSmartLudoToken(room: GameRoomState, player: GamePlayer, dice: number): number {
    const legal = this.getLegalLudoTokens(player, dice, room.level);
    if (legal.length <= 1) return legal[0] ?? 0;
    if (room.level < 3) return legal[0];

    // Level 3 Hunter AI: prioritize finishing -> capturing an opponent -> deploying -> advancing lead token
    const cfg = LUDO_LEVELS[room.level] || LUDO_LEVELS[3];
    for (const idx of legal) {
      if (player.tokens[idx] >= 0 && player.tokens[idx] + dice === 56) return idx;
    }
    for (const idx of legal) {
      const pos = player.tokens[idx];
      if (pos >= 0 && pos + dice <= 50) {
        const gPos = (LUDO_START_OFFSETS[player.color] + pos + dice) % 52;
        if (!cfg.safeSquares.has(gPos)) {
          const hitsOpp = room.players.some(
            (opp) =>
              opp.uid !== player.uid &&
              opp.tokens.some(
                (oPos) => oPos >= 0 && oPos <= 50 && (LUDO_START_OFFSETS[opp.color] + oPos) % 52 === gPos
              )
          );
          if (hitsOpp) return idx;
        }
      }
    }
    const deployIdx = legal.find((idx) => player.tokens[idx] === -1);
    if (deployIdx !== undefined) return deployIdx;
    return legal.sort((a, b) => player.tokens[b] - player.tokens[a])[0];
  }

  private applyLudoMove(room: GameRoomState, player: GamePlayer, tokenIndex: number, dice: number): void {
    const cfg = LUDO_LEVELS[room.level] || LUDO_LEVELS[1];
    const prev = player.tokens[tokenIndex];
    let bonusRoll = dice === 6;

    if (prev === -1 && (dice === 6 || (cfg.deployOnFive && dice === 5))) {
      player.tokens[tokenIndex] = 0;
      this.pushLog(room, `${player.displayName} rolled ${dice} and deployed Token #${tokenIndex + 1}!`);
    } else {
      const next = prev + dice;
      player.tokens[tokenIndex] = next;

      if (next === 56) {
        bonusRoll = true;
        this.pushLog(room, `${player.displayName}'s Token #${tokenIndex + 1} reached HOME!`);
      } else if (next <= 50) {
        const globalPos = (LUDO_START_OFFSETS[player.color] + next) % 52;
        if (!cfg.safeSquares.has(globalPos)) {
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
      this.pushLog(room, `${player.displayName} won Ludo (${cfg.title})!`);
      return;
    }

    if (!bonusRoll) {
      this.advanceTurn(room);
    } else {
      this.pushLog(room, `${player.displayName} gets a bonus roll!`);
    }
  }

  private applySnakesMove(room: GameRoomState, player: GamePlayer, roll: number): void {
    const spec = SNAKES_LEVELS[room.level] || SNAKES_LEVELS[1];
    const currentPos = player.tokens[0];
    let target = currentPos + roll;

    if (target > 100) {
      this.pushLog(room, `${player.displayName} rolled ${roll} (needs exact ${100 - currentPos} to finish).`);
      if (roll !== 6) this.advanceTurn(room);
      return;
    }

    let note = `${player.displayName} rolled ${roll} -> square ${target}`;
    if (spec.ladders[target]) {
      const top = spec.ladders[target];
      note = `${player.displayName} rolled ${roll}, climbed ladder ${target} -> ${top}!`;
      target = top;
    } else if (spec.snakes[target]) {
      const tail = spec.snakes[target];
      note = `${player.displayName} rolled ${roll}, slid down snake ${target} -> ${tail}!`;
      target = tail;
    }

    player.tokens[0] = target;
    this.pushLog(room, note);

    if (target === 100) {
      room.status = 'finished';
      room.winnerUid = player.uid;
      room.winnerName = player.displayName;
      this.pushLog(room, `${player.displayName} conquered ${spec.title} (Square 100)!`);
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

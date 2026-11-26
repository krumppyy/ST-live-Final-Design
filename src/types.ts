export type UserRole = 'guest' | 'host' | 'admin' | 'agency' | 'band';

export type StreamCategory =
  | 'all'
  | 'solo'
  | 'multi_guest'
  | 'audio'
  | 'pk'
  | 'games'
  | 'music_band'
  | 'gaming'
  | 'brand_drop';

export type ThemeMode = 'dark' | 'light';
export type ColorGrade = 'nova' | 'emerald' | 'surge' | 'ballot' | 'onyx' | 'ember';
export type FontChoice = 'jakarta' | 'fredoka' | 'outfit' | 'manrope' | 'dmsans' | 'playfair';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';
export type LocaleCode = 'en' | 'hi' | 'bn' | 'es' | 'ar' | 'ja';
export type CutoutProfile =
  | 'auto'
  | 'punch_center'
  | 'punch_left'
  | 'dynamic_island'
  | 'curved_tablet'
  | 'flat';

export interface CapturedAsset {
  id: string;
  type: 'photo' | 'video';
  url: string;
  label: string;
  createdAt: string;
}

export interface AdminPermissions {
  canModerateChat: boolean;
  canApproveGames: boolean;
  canManageSeats: boolean;
  canRunPK: boolean;
}

export interface AuthSession {
  token: string;
  uid: string;
  displayName: string;
  role: UserRole;
  coins: number;
  diamonds: number;
  assignedHostUid?: string;
  assignedHostName?: string;
  permissions?: AdminPermissions;
}

export interface DirectoryUser {
  uid: string;
  displayName: string;
  role: UserRole;
}

export interface AdminGrantSummary {
  id: number;
  hostUid: string;
  adminUid: string;
  adminName: string;
  permissions: AdminPermissions;
  active: boolean;
  createdAt: string;
}

export interface AdminTask {
  id: number;
  hostUid: string;
  adminUid: string;
  adminName?: string;
  title: string;
  notes: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

export interface MultiGuestSeat {
  seatIndex: number;
  uid: string | null;
  displayName: string | null;
  muted: boolean;
}

export interface PKState {
  active: boolean;
  challengerName: string;
  hostScore: number;
  challengerScore: number;
  endsAt: number;
}

export interface Livestream {
  id: string;
  hostUid: string;
  hostName: string;
  title: string;
  category: Exclude<StreamCategory, 'all'>;
  language: string;
  viewerCount: number;
  thumbnail: string;
  isLive: boolean;
  maxSeats: number;
  seats: MultiGuestSeat[];
  pk: PKState;
  gameRoomId?: string;
  gameType?: GameType;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  uid: string;
  displayName: string;
  role: UserRole;
  isFollower?: boolean;
  text: string;
  gift?: { name: string; coins: number };
  pinned?: boolean;
  timestamp: number;
}

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
export type GameType = 'ludo' | 'snakes' | 'fps';

export interface GameJoinRequest {
  uid: string;
  displayName: string;
  isFollower?: boolean;
  requestedAt: number;
}

export interface FpsCombatantState {
  uid: string;
  displayName: string;
  color: PlayerColor;
  isBot: boolean;
  isHost?: boolean;
  isFollower?: boolean;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  kills: number;
  deaths: number;
  score: number;
}

export interface FpsKillFeedItem {
  id: string;
  killerName: string;
  victimName: string;
  headshot: boolean;
  timestamp: number;
}

export interface FpsArenaState {
  targetKills: number;
  combatants: Record<string, FpsCombatantState>;
  killFeed: FpsKillFeedItem[];
}

export interface GamePlayer {
  uid: string;
  displayName: string;
  color: PlayerColor;
  isBot: boolean;
  isFollower?: boolean;
  tokens: number[];
}

export interface GameRoomState {
  roomId: string;
  title: string;
  gameType: GameType;
  hostUid: string;
  hostName: string;
  status: 'lobby' | 'playing' | 'finished';
  maxPlayers: number;
  pendingRequests: GameJoinRequest[];
  players: GamePlayer[];
  turnIndex: number;
  diceValue: number | null;
  mustMove: boolean;
  fps?: FpsArenaState;
  winnerUid: string | null;
  winnerName: string | null;
  log: string[];
  updatedAt: number;
}

export interface AgencyHostRecord {
  id: number;
  agencyUid: string;
  hostUid: string;
  hostName: string;
  liveHours: number;
  targetHours: number;
  diamondsEarned: number;
  targetDiamonds: number;
  commissionRate: number;
  status: 'active' | 'onboarding' | 'top_tier';
}

export interface BandEvent {
  id: number;
  bandUid: string;
  bandName: string;
  title: string;
  members: string;
  scheduledAt: string;
  stageMode: 'acoustic' | 'full_band' | 'dj_set' | 'soundcheck';
  rsvpCount: number;
}

export interface BrandDrop {
  id: number;
  bandUid: string;
  brandName: string;
  productTitle: string;
  priceLabel: string;
  stockCount: number;
  claimedCount: number;
  status: 'live' | 'scheduled' | 'sold_out';
}

export interface DeviceInfo {
  os: 'iOS' | 'iPadOS' | 'Android' | 'macOS' | 'Windows' | 'Linux' | 'ChromeOS' | 'Unknown';
  formFactor: 'mobile' | 'tablet' | 'desktop';
  isTouch: boolean;
  suggestedCutout: Exclude<CutoutProfile, 'auto'>;
  screenWidth: number;
  screenHeight: number;
}

export type UserRole = 'guest' | 'host' | 'admin' | 'agency' | 'band' | 'staff';

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

export type DiscoveryFeedTab = 'for_you' | 'following' | 'party' | 'nearby' | 'new' | 'popular';

export type ThemeMode = 'dark' | 'light';
export type ColorGrade = string; // Supports all 37 theme deck IDs (nova, emerald, surge, ballot, onyx, ember, etc.)
export type FontChoice = 'jakarta' | 'fredoka' | 'outfit' | 'manrope' | 'dmsans' | 'playfair';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';
export type LocaleCode =
  | 'en'
  | 'hi'
  | 'bn'
  | 'es'
  | 'ar'
  | 'ja'
  | 'fr'
  | 'de'
  | 'pt'
  | 'ru'
  | 'zh'
  | 'ko'
  | 'tr'
  | 'id'
  | 'vi'
  | 'th'
  | 'it'
  | 'ur'
  | 'tl'
  | 'ms';

export type CutoutProfile =
  | 'auto'
  | 'punch_center'
  | 'punch_left'
  | 'dynamic_island'
  | 'curved_tablet'
  | 'flat';

export type VipTier = 'none' | 'weekly' | 'monthly' | 'lifetime';

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
  numericId: number;
  displayName: string;
  role: UserRole;
  countryCode: string;
  emailMasked?: string;
  phoneMasked?: string;
  coins: number;
  diamonds: number;
  tokens: number;
  xp: number;
  level: number;
  vipTier: VipTier;
  vipUntil: number;
  isPro: boolean;
  verified: boolean;
  freePinTrials: number;
  dailyStreak: number;
  checkedInToday: boolean;
  totpEnabled: boolean;
  ownedPerks: string[];
  monetagStatus: 'none' | 'pending' | 'verified' | 'rejected';
  monetagTipUrl?: string;
  bio?: string;
  age?: string;
  gender?: string;
  hobbies?: string;
  showAge?: boolean;
  showGender?: boolean;
  showFollowers?: boolean;
  showVisits?: boolean;
  allowDm?: boolean;
  bannerPos?: 'top' | 'lower' | 'corner';
  bannerSize?: '728x90' | '468x60' | '300x250';
  bannedUntil?: number;
  banStrikes?: number;
  assignedHostUid?: string;
  assignedHostName?: string;
  permissions?: AdminPermissions;
  isTestMode?: boolean;
}

export interface DirectoryUser {
  uid: string;
  numericId?: number;
  displayName: string;
  role: UserRole;
  countryCode?: string;
  verified?: boolean;
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

export interface DiceDuelState {
  active: boolean;
  endsAt: number;
  entryTokens: number;
  potTokens: number;
  participants: Array<{
    uid: string;
    displayName: string;
    dice: [number, number] | null;
    total: number;
  }>;
  winnerName: string | null;
}

export interface Livestream {
  id: string;
  hostUid: string;
  hostNumericId?: number;
  hostName: string;
  hostVerified?: boolean;
  hostMonetagTipUrl?: string;
  countryCode: string;
  title: string;
  category: Exclude<StreamCategory, 'all'>;
  language: string;
  viewerCount: number;
  thumbnail: string;
  isLive: boolean;
  isLocked?: boolean;
  consentVerified?: boolean;
  createdAt?: number;
  totalGiftsCoins?: number;
  followerCount?: number;
  maxSeats: number;
  seats: MultiGuestSeat[];
  pk: PKState;
  duel?: DiceDuelState;
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
  isVip?: boolean;
  level?: number;
  text: string;
  stickerCode?: string;
  gift?: { name: string; coins: number; combo?: number; novaBurst?: boolean };
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

export type ConversationType = 'dm' | 'group' | 'support';

export interface InboxMember {
  uid: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: number;
}

export interface InboxConversation {
  id: string;
  type: ConversationType;
  title: string;
  creatorUid: string;
  inviteCode?: string;
  e2eeEnabled: boolean;
  defaultTtlSec: number;
  members: InboxMember[];
  unreadCount: number;
  lastMessagePreview?: string;
  lastMessageAt: number;
  updatedAt: number;
}

export interface InboxMessage {
  id: string;
  conversationId: string;
  senderUid: string;
  senderName: string;
  kind: 'text' | 'image' | 'system';
  encrypted: boolean;
  ciphertext: string | null;
  iv: string | null;
  viewOnce: boolean;
  consumed: boolean;
  ttlSec: number;
  expiresAt: number | null;
  createdAt: number;
}

export interface PayoutRecord {
  id: number;
  uid: string;
  displayName: string;
  diamonds: number;
  usdAmount: number;
  method: string;
  destinationMasked: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
}

export interface RoomVisitor {
  visitorUid: string;
  visitorName: string;
  visitedAt: number;
}

export interface SafetyReport {
  id: number;
  roomId: string;
  targetUid: string;
  reporterUid: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface SafetyAppeal {
  id: number;
  uid: string;
  displayName: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'dismissed';
  staffNote?: string;
  createdAt: string;
}

export interface PasswordResetRecord {
  id: number;
  uid: string;
  displayName?: string;
  contactMasked: string;
  status: 'pending' | 'approved' | 'completed' | 'expired';
  expiresAt: number;
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  actorUid: string;
  action: string;
  target: string;
  metaMasked: string;
  createdAt: string;
}

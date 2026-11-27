import type {
  AspectRatioId,
  FlashMode,
  MicSourceType,
  ResolutionOption,
} from './cameraEngine';
import type { GimbalMode } from './gimbalEngine';
import type { GameType, LiveStageLayout, StreamCategory } from '../types';

export type ArOverlayId = 'none' | 'snow' | 'confetti' | 'studio_frame' | 'neon_corner';

export interface FaceStudioProfile {
  smooth: number;     // 0..100
  brighten: number;   // 0..100
  fairGlow: number;   // 0..100
  slim: number;       // 0..100
  jaw: number;        // 0..100
  chin: number;       // 0..100
  eyes: number;       // 0..100
  warmth: number;     // -50..50
  rosy: number;       // 0..100
  clarity: number;    // 0..100
  vignette: number;   // 0..100
}

export const DEFAULT_FACE_STUDIO: FaceStudioProfile = {
  smooth: 20,
  brighten: 10,
  fairGlow: 0,
  slim: 0,
  jaw: 0,
  chin: 0,
  eyes: 10,
  warmth: 0,
  rosy: 12,
  clarity: 15,
  vignette: 0,
};

export interface StudioPresetSpec {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  bestFor: string;
  // 1:1 Camera Engine configuration
  camera: {
    resolution: ResolutionOption;
    fps: 30 | 60;
    aspect: AspectRatioId;
    filterId: string;
    beautyOn: boolean;
    faceStudio: FaceStudioProfile;
    macroMode: boolean;
    dualCamera: boolean;
    screenSharePip: boolean;
    arOverlay: ArOverlayId;
    lowerThirdDefault: string;
  };
  // 1:1 Audio & Hardware configuration
  hardware: {
    micSource: MicSourceType;
    ancEnabled: boolean;
    bncEnabled: boolean;
    gimbalMode: GimbalMode;
    flashMode: FlashMode;
  };
  // 1:1 Live Room configuration
  liveRoom: {
    defaultTitle: string;
    category: Exclude<StreamCategory, 'all'>;
    maxSeats: number;
    gameType: GameType | '';
    stageLayout: LiveStageLayout;
    suggestPin: boolean;
    slowModeSec: number;
    enablePkReady: boolean;
  };
  // Console widget highlights tailored specifically to this preset
  consoleHighlights: string[];
}

export const STUDIO_PRESETS: StudioPresetSpec[] = [
  {
    id: 'solo_irl',
    name: 'Creator Talk / IRL',
    tagline: 'Balanced portrait studio with crisp voice isolation & smooth follow gimbal.',
    badge: '1080p · 60fps',
    bestFor: 'Q&A, vlogs, daily check-ins, IRL chats',
    camera: {
      resolution: '1080p',
      fps: 60,
      aspect: '9:16',
      filterId: 'seoul',
      beautyOn: true,
      faceStudio: { ...DEFAULT_FACE_STUDIO, smooth: 34, brighten: 20, rosy: 18, eyes: 16, clarity: 22 },
      macroMode: false,
      dualCamera: false,
      screenSharePip: false,
      arOverlay: 'none',
      lowerThirdDefault: 'Ask me anything live · Drop your city in chat',
    },
    hardware: {
      micSource: 'wireless',
      ancEnabled: true,
      bncEnabled: true,
      gimbalMode: 'follow',
      flashMode: 'auto',
    },
    liveRoom: {
      defaultTitle: 'Live Q&A & Studio Hangout',
      category: 'solo',
      maxSeats: 4,
      gameType: '',
      stageLayout: 'video',
      suggestPin: false,
      slowModeSec: 0,
      enablePkReady: false,
    },
    consoleHighlights: ['Lower-Third Caption Cue', 'Voice ANC + BNC Isolation', 'Gimbal Follow Stabilization', '4-Seat Quick Invite'],
  },
  {
    id: 'gaming_arena',
    name: 'Gaming & Co-Op Arena',
    tagline: 'Switchable Game + Corner Cam PiP or 50/50 Split stage for ST Strike 3D, Realm RPG & board games.',
    badge: '1080p · 60fps',
    bestFor: 'ST Strike 3D (5 Levels), Realm Quest RPG, Ludo, Snakes & Ladders',
    camera: {
      resolution: '1080p',
      fps: 60,
      aspect: '16:9',
      filterId: 'cyber',
      beautyOn: false,
      faceStudio: { ...DEFAULT_FACE_STUDIO, smooth: 10, clarity: 35, vignette: 18 },
      macroMode: false,
      dualCamera: false,
      screenSharePip: true,
      arOverlay: 'neon_corner',
      lowerThirdDefault: 'Squad Open · Request a seat to join ST Strike 3D or Realm RPG',
    },
    hardware: {
      micSource: 'wired',
      ancEnabled: true,
      bncEnabled: true,
      gimbalMode: 'off',
      flashMode: 'off',
    },
    liveRoom: {
      defaultTitle: 'ST Strike 3D & Co-Op RPG · Open Squads',
      category: 'games',
      maxSeats: 6,
      gameType: 'fps',
      stageLayout: 'game_pip',
      suggestPin: false,
      slowModeSec: 0,
      enablePkReady: false,
    },
    consoleHighlights: ['Game + Corner Cam / 50-50 Split', 'Keyboard Fan BNC Gate', 'ST Strike 3D · Realm RPG · Ludo', '6-Seat Squad Voice'],
  },
  {
    id: 'music_stage',
    name: 'Music Band & Stage',
    tagline: 'Cinema 4K framing with raw acoustic mic capture (no noise gate clipping) & 8 seats.',
    badge: '4K · 30fps',
    bestFor: 'Acoustic sessions, full bands, DJ sets, vocal covers',
    camera: {
      resolution: '4K',
      fps: 30,
      aspect: '16:9',
      filterId: 'cine',
      beautyOn: false,
      faceStudio: { ...DEFAULT_FACE_STUDIO, warmth: 12, clarity: 30, vignette: 24 },
      macroMode: false,
      dualCamera: true,
      screenSharePip: false,
      arOverlay: 'studio_frame',
      lowerThirdDefault: 'Live Studio Session · Requests open in chat',
    },
    hardware: {
      micSource: 'wired',
      ancEnabled: false,
      bncEnabled: false,
      gimbalMode: 'lock',
      flashMode: 'off',
    },
    liveRoom: {
      defaultTitle: 'Live Unplugged Band Session',
      category: 'music_band',
      maxSeats: 8,
      gameType: '',
      stageLayout: 'video',
      suggestPin: false,
      slowModeSec: 0,
      enablePkReady: false,
    },
    consoleHighlights: ['Raw Acoustic Audio (No Gate Clip)', 'Dual B-Roll Stage Angle', 'Gimbal Horizon Lock', '8-Member Band Stage'],
  },
  {
    id: 'podcast_audio',
    name: 'Podcast & 12-Seat Lounge',
    tagline: 'Bandwidth-friendly 720p panel room with studio vocal clarity & full 12-seat deck.',
    badge: '720p · 12 Seats',
    bestFor: 'Talk shows, debates, community roundtables, late-night panels',
    camera: {
      resolution: '720p',
      fps: 30,
      aspect: '16:9',
      filterId: 'mocha',
      beautyOn: true,
      faceStudio: { ...DEFAULT_FACE_STUDIO, smooth: 22, warmth: 14, clarity: 20, vignette: 16 },
      macroMode: false,
      dualCamera: false,
      screenSharePip: false,
      arOverlay: 'studio_frame',
      lowerThirdDefault: 'Open Mic Roundtable · Tap an empty seat to speak',
    },
    hardware: {
      micSource: 'wired',
      ancEnabled: true,
      bncEnabled: true,
      gimbalMode: 'off',
      flashMode: 'off',
    },
    liveRoom: {
      defaultTitle: 'Creator Roundtable · 12-Seat Open Mic',
      category: 'audio',
      maxSeats: 12,
      gameType: '',
      stageLayout: 'video',
      suggestPin: false,
      slowModeSec: 3,
      enablePkReady: false,
    },
    consoleHighlights: ['Full 12-Seat Guest Panel', '3s Slow-Mode Discussion Guard', 'Strong Vocal ANC + BNC', 'Topic Lower-Third Banner'],
  },
  {
    id: 'pk_arena',
    name: 'PK Battle Showdown',
    tagline: 'High-energy vertical 60fps PK setup with vivid punch, confetti hype & Dice Duel ready.',
    badge: '1080p · PK Live',
    bestFor: '5-minute PK gift clashes, combo challenges, co-host rivalries',
    camera: {
      resolution: '1080p',
      fps: 60,
      aspect: '9:16',
      filterId: 'vivid',
      beautyOn: true,
      faceStudio: { ...DEFAULT_FACE_STUDIO, smooth: 38, brighten: 24, fairGlow: 18, eyes: 22, rosy: 20 },
      macroMode: false,
      dualCamera: false,
      screenSharePip: false,
      arOverlay: 'confetti',
      lowerThirdDefault: 'PK BATTLE LIVE · Tap Combo x10 to boost the bar!',
    },
    hardware: {
      micSource: 'bluetooth',
      ancEnabled: true,
      bncEnabled: true,
      gimbalMode: 'follow',
      flashMode: 'ttl',
    },
    liveRoom: {
      defaultTitle: '5-Min PK Clash · Team Crimson vs Cyan',
      category: 'pk',
      maxSeats: 4,
      gameType: '',
      stageLayout: 'video',
      suggestPin: false,
      slowModeSec: 0,
      enablePkReady: true,
    },
    consoleHighlights: ['5-Min PK Tug-of-War Ready', 'Live Confetti Crowd FX', '60fps Vertical Portrait', '4-Co-Host Split Ready'],
  },
  {
    id: 'beauty_glow',
    name: 'Beauty & Glow Portrait',
    tagline: '4K studio beauty tuning with 11-slider Face Studio, porcelain luminance & soft TTL fill.',
    badge: '4K · Face 11-Tune',
    bestFor: 'GRWM, skincare, makeup tutorials, portrait streams',
    camera: {
      resolution: '4K',
      fps: 30,
      aspect: '9:16',
      filterId: 'fair_auto',
      beautyOn: true,
      faceStudio: {
        smooth: 62,
        brighten: 44,
        fairGlow: 48,
        slim: 24,
        jaw: 18,
        chin: 14,
        eyes: 32,
        warmth: 6,
        rosy: 30,
        clarity: 26,
        vignette: 8,
      },
      macroMode: false,
      dualCamera: false,
      screenSharePip: false,
      arOverlay: 'snow',
      lowerThirdDefault: 'Beauty & Glow Studio · Ask for shades & routine',
    },
    hardware: {
      micSource: 'wireless',
      ancEnabled: true,
      bncEnabled: true,
      gimbalMode: 'horizon',
      flashMode: 'ttl',
    },
    liveRoom: {
      defaultTitle: 'Studio Glow & Routine Live',
      category: 'solo',
      maxSeats: 4,
      gameType: '',
      stageLayout: 'video',
      suggestPin: false,
      slowModeSec: 0,
      enablePkReady: false,
    },
    consoleHighlights: ['Full 11-Slider Face Studio', 'Fair Luminance & Soft TTL Fill', '4K Vertical Clarity', 'Live Snow / Glow AR Layer'],
  },
  {
    id: 'brand_drop',
    name: 'Brand Drop & Macro',
    tagline: 'Color-true 4K product showcase with Macro close-up lens, B-Roll PiP & Drop banner.',
    badge: '4K · Macro 4:5',
    bestFor: 'Product launches, unboxings, merch drops, hardware reviews',
    camera: {
      resolution: '4K',
      fps: 30,
      aspect: '4:5',
      filterId: 'pure',
      beautyOn: false,
      faceStudio: { ...DEFAULT_FACE_STUDIO, smooth: 0, brighten: 8, clarity: 42, vignette: 0 },
      macroMode: true,
      dualCamera: true,
      screenSharePip: false,
      arOverlay: 'studio_frame',
      lowerThirdDefault: 'LIMITED DROP LIVE · Claim exclusive stock now',
    },
    hardware: {
      micSource: 'wired',
      ancEnabled: true,
      bncEnabled: true,
      gimbalMode: 'lock',
      flashMode: 'on',
    },
    liveRoom: {
      defaultTitle: 'Limited Edition Studio Product Drop',
      category: 'brand_drop',
      maxSeats: 4,
      gameType: '',
      stageLayout: 'video',
      suggestPin: false,
      slowModeSec: 0,
      enablePkReady: false,
    },
    consoleHighlights: ['Macro Close-Up Optics Mode', 'Dual B-Roll Product PiP', 'True-Color Pure Profile', 'Pinned Lower-Third Drop Tag'],
  },
  {
    id: 'vip_private',
    name: 'Private VIP / PIN Lounge',
    tagline: '6-digit PIN-gated backstage room with cinema velvet tone & invite-only controls.',
    badge: 'PIN · Private',
    bestFor: 'VIP subscriber hangouts, agency meetings, backstage coaching',
    camera: {
      resolution: '1080p',
      fps: 30,
      aspect: '16:9',
      filterId: 'velvet',
      beautyOn: true,
      faceStudio: { ...DEFAULT_FACE_STUDIO, smooth: 28, brighten: 14, warmth: 8, vignette: 20 },
      macroMode: false,
      dualCamera: false,
      screenSharePip: false,
      arOverlay: 'studio_frame',
      lowerThirdDefault: 'Private VIP Lounge · Invite-Only Session',
    },
    hardware: {
      micSource: 'wireless',
      ancEnabled: true,
      bncEnabled: true,
      gimbalMode: 'lock',
      flashMode: 'off',
    },
    liveRoom: {
      defaultTitle: 'VIP Backstage Lounge (PIN Protected)',
      category: 'multi_guest',
      maxSeats: 6,
      gameType: '',
      stageLayout: 'video',
      suggestPin: true,
      slowModeSec: 0,
      enablePkReady: false,
    },
    consoleHighlights: ['Auto 6-Digit PIN Generator', 'VIP / Free-Trial Room Gate', '6-Seat Private Table', 'Cinema Velvet Look'],
  },
];

export function getStudioPreset(id: string | null | undefined): StudioPresetSpec | null {
  if (!id) return null;
  return STUDIO_PRESETS.find((p) => p.id === id) || null;
}

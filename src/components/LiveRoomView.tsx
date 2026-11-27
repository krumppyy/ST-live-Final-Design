import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  Ban,
  Bot,
  Camera,
  CameraOff,
  Check,
  Columns2,
  Compass,
  Copy,
  CornerDownRight,
  Crosshair,
  Crown,
  Dices,
  ExternalLink,
  Eye,
  Flag,
  Gamepad2,
  Gift,
  Heart,
  Image as ImageIcon,
  Info,
  Languages,
  Lock,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  Minimize2,
  PictureInPicture2,
  Power,
  RotateCcw,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  Smile,
  Sparkles,
  Swords,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { countryFlag } from '../lib/countries';
import { useGimbal } from '../lib/gimbalEngine';
import {
  AADS_BANNER_SIZES,
  buildSafeAadsIframeUrl,
  VIEWER_AADS_GUIDELINE,
  VIEWER_FREE_TIP_GUIDELINE,
} from '../lib/monetization';
import { fetchRtcConfig } from '../lib/rtcConfig';
import { playDiceSfx, playStepSfx } from '../lib/sfx';
import { parseStickerCode, STICKER_PACKS } from '../lib/stickers';
import type {
  BannerPlacement,
  ChatMessage,
  DiceDuelState,
  GameRoomState,
  GameType,
  Livestream,
  LiveStageLayout,
  MultiGuestSeat,
  PKState,
  PlayerColor,
  RoomVisitor,
} from '../types';
import { FpsArenaGame } from './FpsArenaGame';
import { RpgDungeonGame } from './RpgDungeonGame';

interface LiveRoomViewProps {
  stream: Livestream;
  onBack: () => void;
  onMinimizePip?: (stream: Livestream) => void;
  onOpenGame: (gameRoomId: string) => void;
  onMessageHost?: (hostUid: string) => void;
  onViewProfile?: (uid: string) => void;
  onRequireLogin: () => void;
}

const STREAMLIVE_GIFTS = [
  { id: 'spark', name: 'Spark', coins: 10 },
  { id: 'bubble', name: 'Bubble', coins: 20 },
  { id: 'comet', name: 'Comet', coins: 50 },
  { id: 'rocket', name: 'Rocket', coins: 120 },
  { id: 'crown', name: 'Crown', coins: 200 },
  { id: 'nova', name: 'Nova Burst', coins: 500 },
];

const COMBO_OPTIONS = [1, 10, 66, 99, 520];

const REPORT_REASONS = [
  'Harassment or hate speech',
  'Scam / phishing / spam',
  'Explicit / unsafe content',
  'Copyright / impersonation',
  'Underage safety concern',
];

const PLAYER_DOT_BG: Record<PlayerColor, string> = {
  red: 'bg-rose-600',
  green: 'bg-emerald-600',
  yellow: 'bg-amber-500',
  blue: 'bg-sky-600',
};

const STAGE_LAYOUT_OPTIONS: Array<{ id: LiveStageLayout; label: string; shortLabel: string }> = [
  { id: 'video', label: 'Stream', shortLabel: 'Stream' },
  { id: 'game_pip', label: 'Game + Cam', shortLabel: 'Game+Cam' },
  { id: 'split', label: '50/50 Split', shortLabel: '50/50' },
  { id: 'game', label: 'Full Game', shortLabel: 'Full Game' },
];

const PIP_CORNER_CLASSES: Record<'tr' | 'br' | 'tl' | 'bl', string> = {
  tr: 'top-3 right-3',
  br: 'bottom-3 right-3',
  tl: 'top-3 left-3',
  bl: 'bottom-3 left-3',
};

const PIP_CORNER_LABELS: Record<'tr' | 'br' | 'tl' | 'bl', string> = {
  br: 'Bottom-Right',
  bl: 'Bottom-Left',
  tl: 'Top-Left',
  tr: 'Top-Right',
};

function parseMediaToken(text: string): { kind: 'photo' | 'clip'; id: string } | null {
  const m = text.trim().match(/^\[(photo|clip):([a-zA-Z0-9_-]{3,48})\]$/);
  if (!m) return null;
  return { kind: m[1] as 'photo' | 'clip', id: m[2] };
}

export const LiveRoomView: React.FC<LiveRoomViewProps> = ({
  stream,
  onBack,
  onMinimizePip,
  onOpenGame,
  onMessageHost,
  onViewProfile,
  onRequireLogin,
}) => {
  const {
    session,
    setSession,
    authFetch,
    streams,
    games,
    mediaLibrary,
    followingHostUids,
    toggleFollowHost,
    autoTranslateChat,
    locale,
    sendWsEvent,
    subscribeWs,
    pushToast,
    t,
  } = useApp();

  const liveStream = useMemo(
    () => streams.find((s) => s.id === stream.id) || stream,
    [streams, stream]
  );

  const activeRoomGame: GameRoomState | undefined = useMemo(
    () => (liveStream.gameRoomId ? games.find((g) => g.roomId === liveStream.gameRoomId) : undefined),
    [games, liveStream.gameRoomId]
  );

  const [seats, setSeats] = useState<MultiGuestSeat[]>(liveStream.seats);
  const [pk, setPk] = useState<PKState>(liveStream.pk);
  const [duel, setDuel] = useState<DiceDuelState | undefined>(liveStream.duel);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mutedUids, setMutedUids] = useState<string[]>([]);
  const [slowModeSec, setSlowModeSec] = useState<number>(0);
  const [coHosts, setCoHosts] = useState<Array<{ uid: string; displayName: string; status: 'invited' | 'live'; joinedAt: number }>>([]);
  const [coHostInviteUid, setCoHostInviteUid] = useState<string>('');
  const [rtcTurnReady, setRtcTurnReady] = useState<boolean>(false);
  const [followersCount, setFollowersCount] = useState<number>(liveStream.followerCount ?? 2);
  const [draft, setDraft] = useState('');
  const [pkTarget, setPkTarget] = useState<'host' | 'challenger'>('host');
  const [giftCombo, setGiftCombo] = useState<number>(1);
  const [cameraActive, setCameraActive] = useState(false);
  const [stageLayout, setStageLayout] = useState<LiveStageLayout>(
    liveStream.stageLayout || (liveStream.gameRoomId ? 'game_pip' : 'video')
  );
  const [camCorner, setCamCorner] = useState<'tr' | 'br' | 'tl' | 'bl'>('br');
  const [camPipSize, setCamPipSize] = useState<'sm' | 'md'>('sm');
  const [splitSwapped, setSplitSwapped] = useState<boolean>(false);
  const [tipCooldownUntil, setTipCooldownUntil] = useState<number>(0);

  // PIN Lock Gate
  const isOwnerOrStaff = Boolean(
    session && (session.uid === liveStream.hostUid || session.role === 'staff')
  );
  const [pinUnlocked, setPinUnlocked] = useState<boolean>(!liveStream.isLocked || isOwnerOrStaff);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  // Celebratory FX overlays (Nova Burst 500 & Crowd Confetti/Pulse FX — G-013)
  const [novaFlash, setNovaFlash] = useState<{ sender: string; gift: string; coins: number; fxKind?: 'confetti' | 'pulse' | 'nova' } | null>(null);

  // Compact Popovers (Zero UI Clutter)
  const [activePopover, setActivePopover] = useState<
    'none' | 'share' | 'visitors' | 'report' | 'stickers' | 'duel'
  >('none');
  const [stickerPackId, setStickerPackId] = useState<'hype' | 'cute' | 'stage' | 'gaming'>('hype');
  const [visitorsData, setVisitorsData] = useState<{
    visitors: RoomVisitor[];
    totalCount: number;
    truncatedForFree: boolean;
  } | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [translateOn, setTranslateOn] = useState(autoTranslateChat);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [nowTick, setNowTick] = useState(Date.now());
  const [showTipGuide, setShowTipGuide] = useState(false);
  const [showAadsGuide, setShowAadsGuide] = useState(false);
  const [coHostLocalStream, setCoHostLocalStream] = useState<MediaStream | null>(null);
  const [coHostRemoteStreams, setCoHostRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [coHostPublishing, setCoHostPublishing] = useState(false);

  const gimbal = useGimbal('off');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const coHostLocalStreamRef = useRef<MediaStream | null>(null);
  const coHostPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const rtcConfigRef = useRef<RTCConfiguration>({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!liveStream.isLocked || isOwnerOrStaff) {
      setPinUnlocked(true);
    }
  }, [liveStream.isLocked, isOwnerOrStaff]);

  // Countdown tick when Dice Duel or Free Tip cooldown is active
  useEffect(() => {
    if (!duel?.active && tipCooldownUntil <= Date.now()) return;
    const id = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(id);
  }, [duel?.active, tipCooldownUntil]);

  // Keep live camera MediaStream attached cleanly whenever stage layout switches
  useEffect(() => {
    if (!cameraActive || !mediaStreamRef.current) return;
    const raf = requestAnimationFrame(() => {
      if (videoRef.current && videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        videoRef.current.play().catch(() => {});
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [cameraActive, stageLayout, camCorner, camPipSize, splitSwapped]);

  // Auto-open Game + Cam PiP stage when Host launches a game live
  const prevGameIdRef = useRef<string | undefined>(liveStream.gameRoomId);
  useEffect(() => {
    if (liveStream.gameRoomId && liveStream.gameRoomId !== prevGameIdRef.current) {
      setStageLayout((curr) => (curr === 'video' ? 'game_pip' : curr));
    }
    prevGameIdRef.current = liveStream.gameRoomId;
  }, [liveStream.gameRoomId]);

  const isHostOrMod =
    session &&
    ((session.role === 'host' && session.uid === liveStream.hostUid) ||
      session.role === 'staff' ||
      (session.role === 'admin' && session.assignedHostUid === liveStream.hostUid));

  const canLaunchGame = Boolean(
    session &&
      (session.role === 'host' ||
        session.role === 'band' ||
        (session.role === 'admin' &&
          session.assignedHostUid === liveStream.hostUid &&
          session.permissions?.canApproveGames))
  );

  const canApproveRoomGame = Boolean(
    session &&
      activeRoomGame &&
      ((session.role === 'host' && session.uid === activeRoomGame.hostUid) ||
        (session.role === 'band' && session.uid === activeRoomGame.hostUid) ||
        (session.role === 'admin' &&
          session.assignedHostUid === activeRoomGame.hostUid &&
          session.permissions?.canApproveGames))
  );

  const canModChat =
    session &&
    ((session.role === 'host' && session.uid === liveStream.hostUid) ||
      session.role === 'staff' ||
      (session.role === 'admin' &&
        session.assignedHostUid === liveStream.hostUid &&
        session.permissions?.canModerateChat));

  const canRunPK =
    session &&
    ((session.role === 'host' && session.uid === liveStream.hostUid) ||
      (session.role === 'admin' &&
        session.assignedHostUid === liveStream.hostUid &&
        session.permissions?.canRunPK));

  const isFollowing = followingHostUids.includes(liveStream.hostUid);
  const isSeatedInGame = Boolean(
    session && activeRoomGame?.players.some((p) => p.uid === session.uid)
  );
  const isPendingInGame = Boolean(
    session && activeRoomGame?.pendingRequests.some((r) => r.uid === session.uid)
  );
  const currentTurnPlayer = activeRoomGame?.players[activeRoomGame.turnIndex];
  const isMyBoardTurn = Boolean(
    session &&
      activeRoomGame &&
      activeRoomGame.gameType !== 'fps' &&
      activeRoomGame.gameType !== 'rpg' &&
      activeRoomGame.status === 'playing' &&
      currentTurnPlayer?.uid === session.uid
  );

  // Discount calculation preview (-20% Room Admin, -10% VIP, -5% PRO)
  const discountPct = useMemo(() => {
    if (!session) return 0;
    if (session.role === 'admin') return 20;
    if (session.vipUntil > Date.now()) return 10;
    if (session.isPro) return 5;
    return 0;
  }, [session]);

  const effectiveGiftPrice = (baseCoins: number) => {
    const raw = baseCoins * giftCombo;
    return Math.max(1, Math.round(raw * (1 - discountPct / 100)));
  };

  // Record visit + 60s Watch-Minute Token, XP & Popular View-Minutes heartbeat
  useEffect(() => {
    if (!pinUnlocked) return;
    if (session?.token) {
      authFetch(`/api/rooms/${encodeURIComponent(liveStream.id)}/visit`, { method: 'POST' }).catch(() => {});
    }
    const tickTimer = setInterval(async () => {
      try {
        fetch(`/api/rooms/${encodeURIComponent(liveStream.id)}/heartbeat`, { method: 'POST' }).catch(() => {});
        if (!session?.token) return;
        const res = await authFetch('/api/economy/watch-tick', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setSession({ ...data.session, token: session.token, isTestMode: session.isTestMode });
          }
        }
      } catch {
        // ignore
      }
    }, 60_000);
    return () => clearInterval(tickTimer);
  }, [session?.token, liveStream.id, pinUnlocked, authFetch, setSession]);

  // Load dynamic WebRTC STUN/TURN config (G-035)
  useEffect(() => {
    fetchRtcConfig()
      .then((cfg) => {
        setRtcTurnReady(cfg.turnConfigured);
        if (cfg.iceServers?.length) {
          rtcConfigRef.current = { iceServers: cfg.iceServers };
        }
      })
      .catch(() => {});
  }, []);

  const stopCoHostMedia = useCallback(() => {
    coHostLocalStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    coHostLocalStreamRef.current = null;
    setCoHostLocalStream(null);
    setCoHostPublishing(false);
    coHostPcsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore
      }
    });
    coHostPcsRef.current.clear();
    setCoHostRemoteStreams({});
  }, []);

  const getOrCreateCoHostPc = useCallback(
    (peerUid: string) => {
      const existing = coHostPcsRef.current.get(peerUid);
      if (existing) return existing;
      const pc = new RTCPeerConnection(rtcConfigRef.current);
      if (coHostLocalStreamRef.current) {
        coHostLocalStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, coHostLocalStreamRef.current!);
        });
      }
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendWsEvent('room:cohost_signal', {
            roomId: liveStream.id,
            signalType: 'ice',
            targetUid: peerUid,
            candidate: JSON.stringify(ev.candidate),
          });
        }
      };
      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (stream) {
          setCoHostRemoteStreams((prev) => ({ ...prev, [peerUid]: stream }));
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
          coHostPcsRef.current.delete(peerUid);
          setCoHostRemoteStreams((prev) => {
            if (!prev[peerUid]) return prev;
            const next = { ...prev };
            delete next[peerUid];
            return next;
          });
        }
      };
      coHostPcsRef.current.set(peerUid, pc);
      return pc;
    },
    [liveStream.id, sendWsEvent]
  );

  const startCoHostPublish = async () => {
    if (!session) {
      onRequireLogin();
      return;
    }
    try {
      const local = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: true,
      });
      coHostLocalStreamRef.current = local;
      setCoHostLocalStream(local);
      setCoHostPublishing(true);
      sendWsEvent('room:cohost_accept', { roomId: liveStream.id });
      sendWsEvent('room:cohost_signal', { roomId: liveStream.id, signalType: 'ready' });
      pushToast('Co-Host camera & mic live on stage!', 'success');
    } catch {
      sendWsEvent('room:cohost_accept', { roomId: liveStream.id });
      pushToast('Joined Co-Host stage (camera unavailable in this browser).', 'info');
    }
  };

  // WebSocket Room Subscriptions + Multi-Publisher Co-Host WebRTC Signaling
  useEffect(() => {
    sendWsEvent('room:join', { roomId: liveStream.id });
    const unsub = subscribeWs((event, payload) => {
      if (event === 'room:state' && payload) {
        const data = payload as {
          roomId: string;
          seats: MultiGuestSeat[];
          pk: PKState;
          duel?: DiceDuelState;
          messages: ChatMessage[];
          mutedUids: string[];
          followers?: string[];
          slowModeSec?: number;
          stageLayout?: LiveStageLayout;
          coHosts?: Array<{ uid: string; displayName: string; status: 'invited' | 'live'; joinedAt: number }>;
        };
        if (data.roomId === liveStream.id) {
          setSeats(data.seats);
          setPk(data.pk);
          if (data.duel) setDuel(data.duel);
          setMessages(data.messages);
          setMutedUids(data.mutedUids || []);
          if (typeof data.slowModeSec === 'number') setSlowModeSec(data.slowModeSec);
          if (data.stageLayout) setStageLayout(data.stageLayout);
          if (Array.isArray(data.coHosts)) setCoHosts(data.coHosts);
          if (data.followers) setFollowersCount(Math.max(data.followers.length, liveStream.followerCount ?? 0));
        }
      } else if (event === 'room:cohost_signal' && payload) {
        const sig = payload as {
          roomId?: string;
          signalType?: 'ready' | 'offer' | 'answer' | 'ice' | 'bye';
          fromUid?: string;
          sdp?: string;
          candidate?: string;
        };
        if (sig.roomId !== liveStream.id || !sig.fromUid || sig.fromUid === session?.uid) return;
        const peerUid = sig.fromUid;
        if (sig.signalType === 'bye') {
          const pc = coHostPcsRef.current.get(peerUid);
          pc?.close();
          coHostPcsRef.current.delete(peerUid);
          setCoHostRemoteStreams((prev) => {
            if (!prev[peerUid]) return prev;
            const next = { ...prev };
            delete next[peerUid];
            return next;
          });
        } else if (sig.signalType === 'ready') {
          // Viewer/Host requests video offer from newly live co-host
          const pc = getOrCreateCoHostPc(peerUid);
          pc.addTransceiver('video', { direction: 'recvonly' });
          pc.addTransceiver('audio', { direction: 'recvonly' });
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer).then(() => offer))
            .then((offer) => {
              sendWsEvent('room:cohost_signal', {
                roomId: liveStream.id,
                signalType: 'offer',
                targetUid: peerUid,
                sdp: offer.sdp,
              });
            })
            .catch(() => {});
        } else if (sig.signalType === 'offer' && sig.sdp) {
          const pc = getOrCreateCoHostPc(peerUid);
          pc.setRemoteDescription({ type: 'offer', sdp: sig.sdp })
            .then(() => pc.createAnswer())
            .then((ans) => pc.setLocalDescription(ans).then(() => ans))
            .then((ans) => {
              sendWsEvent('room:cohost_signal', {
                roomId: liveStream.id,
                signalType: 'answer',
                targetUid: peerUid,
                sdp: ans.sdp,
              });
            })
            .catch(() => {});
        } else if (sig.signalType === 'answer' && sig.sdp) {
          const pc = coHostPcsRef.current.get(peerUid);
          pc?.setRemoteDescription({ type: 'answer', sdp: sig.sdp }).catch(() => {});
        } else if (sig.signalType === 'ice' && sig.candidate) {
          const pc = coHostPcsRef.current.get(peerUid);
          try {
            const cand = JSON.parse(sig.candidate);
            pc?.addIceCandidate(cand).catch(() => {});
          } catch {
            // ignore
          }
        }
      } else if (event === 'room:chat_msg' && payload) {
        const msg = payload as ChatMessage;
        if (msg.roomId === liveStream.id) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev.slice(-199), msg]));
          if (msg.gift?.novaBurst || (msg.gift && msg.gift.coins >= 100)) {
            const fxKind = msg.gift.novaBurst ? 'nova' : msg.gift.coins >= 200 ? 'confetti' : 'pulse';
            setNovaFlash({ sender: msg.displayName, gift: msg.gift.name, coins: msg.gift.coins, fxKind });
            setTimeout(() => setNovaFlash(null), 2600);
          }
        }
      } else if (event === 'room:ended' && payload) {
        const data = payload as { roomId?: string; reason?: string };
        if (data.roomId === liveStream.id) {
          mediaStreamRef.current?.getTracks().forEach((tr) => tr.stop());
          mediaStreamRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
          stopCoHostMedia();
          pushToast(data.reason || 'This livestream has ended.', 'info');
          onBack();
        }
      }
    });
    return () => {
      unsub();
    };
  }, [
    liveStream.id,
    liveStream.followerCount,
    session?.uid,
    sendWsEvent,
    subscribeWs,
    pushToast,
    onBack,
    getOrCreateCoHostPc,
    stopCoHostMedia,
  ]);

  // Opt-in Live Chat Translation (strictly skips gifts, stickers, and [photo:]/[clip:] media tokens)
  useEffect(() => {
    if (!translateOn) return;
    const recent = messages.slice(-8);
    recent.forEach((m) => {
      if (
        m.gift ||
        parseStickerCode(m.text) ||
        parseMediaToken(m.text) ||
        translations[m.id] ||
        m.text.length < 3
      ) {
        return;
      }
      fetch(`/api/translate?q=${encodeURIComponent(m.text)}&to=${encodeURIComponent(locale)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.translated && d.translated !== m.text && !d.skipped) {
            setTranslations((prev) => ({ ...prev, [m.id]: d.translated }));
          }
        })
        .catch(() => {});
    });
  }, [translateOn, messages, locale, translations]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Guaranteed End-kills-tracks on unmount
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      mediaStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      stopCoHostMedia();
    };
  }, [stopCoHostMedia]);

  const handleUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onRequireLogin();
      return;
    }
    setPinError('');
    setPinBusy(true);
    try {
      const res = await authFetch(`/api/rooms/${encodeURIComponent(liveStream.id)}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ pin: pinInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || 'Incorrect PIN.');
        return;
      }
      if (data.session) {
        setSession({ ...data.session, token: session.token, isTestMode: session.isTestMode });
      }
      setPinUnlocked(true);
      pushToast('PIN Room unlocked! Welcome inside.', 'success');
    } finally {
      setPinBusy(false);
    }
  };

  const toggleLiveCamera = async () => {
    if (cameraActive) {
      mediaStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      mediaStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraActive(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      mediaStreamRef.current = media;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraActive(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!session) {
      onRequireLogin();
      return;
    }
    const nowFollowing = await toggleFollowHost(liveStream.id, liveStream.hostUid);
    if (nowFollowing !== null) {
      sendWsEvent('room:follow_toggle', { roomId: liveStream.id });
      setFollowersCount((c) => (nowFollowing ? c + 1 : Math.max(0, c - 1)));
    }
  };

  const handleLaunchInStreamGame = (gameType: GameType, targetLayout?: LiveStageLayout) => {
    if (!session) {
      onRequireLogin();
      return;
    }
    const nextLayout: LiveStageLayout = targetLayout || (stageLayout === 'video' ? 'game_pip' : stageLayout);
    sendWsEvent('room:launch_game', { roomId: liveStream.id, gameType });
    setStageLayout(nextLayout);
    if (isHostOrMod) {
      sendWsEvent('room:stage_layout', { roomId: liveStream.id, stageLayout: nextLayout });
    }
    const labelMap: Record<GameType, string> = {
      fps: 'ST Strike 3D',
      rpg: 'Realm Quest Co-Op RPG',
      ludo: 'Ludo Arena',
      snakes: 'Snakes & Ladders',
    };
    pushToast(`Launching ${labelMap[gameType]} live!`, 'success');
  };

  const handleSelectStageLayout = (nextLayout: LiveStageLayout) => {
    if (nextLayout !== 'video' && !activeRoomGame) {
      if (canLaunchGame) {
        handleLaunchInStreamGame('fps', nextLayout);
        return;
      }
      pushToast('No live game is active in this room yet.', 'info');
      return;
    }
    setStageLayout(nextLayout);
    if (isHostOrMod) {
      sendWsEvent('room:stage_layout', { roomId: liveStream.id, stageLayout: nextLayout });
    }
  };

  const cycleCamCorner = () => {
    const order: Array<'br' | 'bl' | 'tl' | 'tr'> = ['br', 'bl', 'tl', 'tr'];
    const next = order[(order.indexOf(camCorner) + 1) % order.length];
    setCamCorner(next);
  };

  const handleRequestJoinGame = () => {
    if (!session) {
      onRequireLogin();
      return;
    }
    if (!activeRoomGame) return;
    sendWsEvent('game:request_join', {
      roomId: activeRoomGame.roomId,
      streamRoomId: liveStream.id,
      isFollower: isFollowing,
    });
    pushToast('Join request sent to the Host!', 'info');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onRequireLogin();
      return;
    }
    if (!draft.trim()) return;
    sendWsEvent('room:chat', { roomId: liveStream.id, text: draft.trim() });
    setDraft('');
  };

  const handleSendSticker = (code: string) => {
    if (!session) {
      onRequireLogin();
      return;
    }
    sendWsEvent('room:chat', { roomId: liveStream.id, text: code });
    setActivePopover('none');
  };

  const handleGift = async (giftId: string, giftName: string, baseCoins: number) => {
    if (!session) {
      onRequireLogin();
      return;
    }
    try {
      const res = await authFetch('/api/economy/gift', {
        method: 'POST',
        body: JSON.stringify({ roomId: liveStream.id, giftId, combo: giftCombo }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not send gift.', 'error');
        return;
      }
      if (data.session) {
        setSession({ ...data.session, token: session.token, isTestMode: session.isTestMode });
      }
      if (pk.active) {
        sendWsEvent('room:gift', {
          roomId: liveStream.id,
          giftName: `${giftName}${giftCombo > 1 ? ` x${giftCombo}` : ''}`,
          coins: data.chargedCoins || baseCoins,
          pkSide: pkTarget,
        });
      }
      if (data.novaBurst || (data.chargedCoins || 0) >= 200) {
        setNovaFlash({ sender: session.displayName, gift: giftName, coins: data.chargedCoins || baseCoins });
        setTimeout(() => setNovaFlash(null), 2600);
      }
      pushToast(
        `Sent ${giftName}${giftCombo > 1 ? ` ×${giftCombo}` : ''} (-${data.chargedCoins}c · +${data.hostDiamonds ?? 0}D to Host)`,
        'success'
      );
    } catch {
      pushToast('Network error sending gift.', 'error');
    }
  };

  const handleLoadVisitors = async () => {
    if (!session) {
      onRequireLogin();
      return;
    }
    if (activePopover === 'visitors') {
      setActivePopover('none');
      return;
    }
    setActivePopover('visitors');
    const res = await authFetch(`/api/rooms/${encodeURIComponent(liveStream.id)}/visitors`);
    if (res.ok) {
      setVisitorsData(await res.json());
    }
  };

  const handleSubmitReport = async () => {
    if (!session) {
      onRequireLogin();
      return;
    }
    const res = await authFetch(`/api/rooms/${encodeURIComponent(liveStream.id)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason: reportReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not submit report.', 'error');
      return;
    }
    setActivePopover('none');
    pushToast(
      data.autoRemoved
        ? 'Room removed after 3 distinct safety reports.'
        : `Safety report logged (${data.reportCount}/3 threshold).`,
      'info'
    );
  };

  const handleBlockChatUser = async (targetUid: string, targetName: string) => {
    if (!session) return;
    const res = await authFetch(`/api/rooms/${encodeURIComponent(liveStream.id)}/block`, {
      method: 'POST',
      body: JSON.stringify({ targetUid, reason: 'Blocked from live chat' }),
    });
    if (res.ok) {
      pushToast(`Blocked ${targetName} from your rooms.`, 'info');
    }
  };

  const handleEndBroadcast = async () => {
    if (!session) return;
    // Always stop local camera/media tracks immediately on End Broadcast (G-044)
    mediaStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    mediaStreamRef.current = null;
    setCameraActive(false);
    const res = await authFetch(`/api/rooms/${encodeURIComponent(liveStream.id)}/end`, {
      method: 'POST',
    });
    if (res.ok) {
      pushToast('Broadcast ended cleanly.', 'info');
      onBack();
    }
  };

  const handleSeatClick = (seatIndex: number) => {
    if (!session) {
      onRequireLogin();
      return;
    }
    sendWsEvent('room:seat_toggle', { roomId: liveStream.id, seatIndex });
  };

  const roomShareUrl = `${window.location.origin}/?room=${encodeURIComponent(liveStream.id)}`;
  const shareText = encodeURIComponent(`Watch ${liveStream.hostName} LIVE on StreamLive: ${liveStream.title}`);
  const shareUrlEnc = encodeURIComponent(roomShareUrl);

  const totalPk = Math.max(1, pk.hostScore + pk.challengerScore);
  const hostPct = Math.round((pk.hostScore / totalPk) * 100);
  const duelSecLeft = duel?.active ? Math.max(0, Math.ceil((duel.endsAt - nowTick) / 1000)) : 0;

  return (
    <main className="sl-fluid-page pt-4 pb-28 md:pb-12 relative">
      {/* PIN Lock Gate Overlay */}
      {liveStream.isLocked && !pinUnlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-[var(--bg-surface)] p-6 text-center space-y-4 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Private PIN-Locked Room</h2>
              <p className="mt-1 text-xs text-[var(--fg-secondary)]">
                Enter the 6-digit PIN for <strong>{liveStream.title}</strong>.
                {session
                  ? session.vipUntil > Date.now()
                    ? ' VIP enters free!'
                    : ` Free trials left: ${session.freePinTrials} (or 30 Tokens).`
                  : ' Sign in or use Test Mode to unlock.'}
              </p>
            </div>
            <form onSubmit={handleUnlockPin} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit PIN (Test: 123456)"
                className="w-full h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-center font-mono-nums text-base tracking-[0.35em] text-[var(--fg-primary)]"
              />
              {pinError && <div className="text-xs text-rose-700 dark:text-rose-400">{pinError}</div>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 h-10 rounded-xl border border-[var(--border-hairline)] text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={pinBusy}
                  className="flex-1 h-10 rounded-xl bg-amber-500 text-xs font-bold text-black hover:bg-amber-400 cursor-pointer"
                >
                  {pinBusy ? 'Checking...' : 'Unlock Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Room Controls Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('backToLive')}</span>
          </button>

          {onMinimizePip && (
            <button
              type="button"
              onClick={() => onMinimizePip(liveStream)}
              title="Minimize to Floating PiP Player"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PiP</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFollowToggle}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer ${
              isFollowing
                ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${isFollowing ? 'fill-current' : ''}`} />
            <span>{isFollowing ? 'Following' : 'Follow'}</span>
            <span className="font-mono-nums opacity-80">{followersCount}</span>
          </button>

          {onMessageHost && session?.uid !== liveStream.hostUid && (
            <button
              type="button"
              onClick={() => {
                if (!session) {
                  onRequireLogin();
                  return;
                }
                onMessageHost(liveStream.hostUid);
              }}
              title="1-on-1 Encrypted Message"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-semibold text-[var(--fg-primary)] hover:border-emerald-500/60 cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
              <span className="hidden sm:inline">DM</span>
            </button>
          )}

          {liveStream.hostMonetagTipUrl && (
            session?.uid === liveStream.hostUid ? (
              <span
                title="Your Verified Free Tip button is live for viewers. Never click your own ad link."
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                <span>Free Tip Live</span>
              </span>
            ) : (() => {
              const tipSecLeft = Math.max(0, Math.ceil((tipCooldownUntil - nowTick) / 1000));
              return (
                <div className="relative group inline-flex items-center gap-1">
                  {tipSecLeft > 0 ? (
                    <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-2.5 text-xs font-mono-nums font-semibold text-emerald-700 dark:text-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                      <span>Tipped ({tipSecLeft}s)</span>
                    </span>
                  ) : (
                    <a
                      href={liveStream.hostMonetagTipUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setTipCooldownUntil(Date.now() + 30_000);
                        setNowTick(Date.now());
                        setShowTipGuide(false);
                        pushToast(
                          `Thanks for supporting ${liveStream.hostName}! Stay briefly in the partner tab if prompted so your free tip counts.`,
                          'success'
                        );
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Free Tip</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowTipGuide((v) => !v)}
                    aria-label="How Free Tip works"
                    title="How Free Tip supports this host"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-[var(--bg-surface)] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 cursor-pointer"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>

                  {/* Viewer Mouse-Hover & Mobile Tap Guideline Card */}
                  <div
                    role="tooltip"
                    className={`${
                      showTipGuide ? 'block' : 'hidden group-hover:block'
                    } absolute left-0 top-11 z-40 w-72 sm:w-80 rounded-xl border border-emerald-500/45 bg-[var(--bg-surface)] p-3 text-left shadow-2xl`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        <span>Free Tip · Viewer Support Guide</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTipGuide(false)}
                        className="text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer sm:hidden"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                      {VIEWER_FREE_TIP_GUIDELINE}
                    </p>
                    <p className="mt-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      100% free for viewers · Verified StreamLive Partner Link
                    </p>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Right Action Cluster (Compact Popover Triggers) */}
        <div className="flex flex-wrap items-center gap-1.5 relative">

          <button
            type="button"
            onClick={() => setActivePopover((p) => (p === 'duel' ? 'none' : 'duel'))}
            className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold cursor-pointer ${
              duel?.active
                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-[var(--accent-gold)]'
            }`}
          >
            <Dices className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
            <span>{duel?.active ? `Duel ${duelSecLeft}s` : 'Duel'}</span>
          </button>

          {canRunPK && (
            <button
              type="button"
              onClick={() => sendWsEvent('room:pk_toggle', { roomId: liveStream.id })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Swords className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>{pk.active ? t('endPK') : t('startPK')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLoadVisitors}
            title="Room Visitors"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Visitors</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePopover((p) => (p === 'share' ? 'none' : 'share'))}
            title="Share Room"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePopover((p) => (p === 'report' ? 'none' : 'report'))}
            title="Report Safety Issue"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-500/40 cursor-pointer"
          >
            <Flag className="h-3.5 w-3.5" />
          </button>

          {canModChat && (
            <button
              type="button"
              onClick={() => {
                const cycle = [0, 3, 5, 10];
                const next = cycle[(cycle.indexOf(slowModeSec) + 1) % cycle.length];
                sendWsEvent('room:slow_mode', { roomId: liveStream.id, seconds: next });
                pushToast(next > 0 ? `Chat Slow Mode: ${next}s` : 'Chat Slow Mode disabled', 'info');
              }}
              title="Toggle Chat Slow Mode"
              className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium cursor-pointer ${
                slowModeSec > 0
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)]'
              }`}
            >
              <span className="font-mono-nums">{slowModeSec > 0 ? `Slow ${slowModeSec}s` : 'Slow Off'}</span>
            </button>
          )}

          {isHostOrMod && (
            <>
              <button
                type="button"
                onClick={async () => {
                  await gimbal.requestGyroPermission();
                  const order: Array<'off' | 'follow' | 'horizon' | 'lock'> = ['off', 'follow', 'horizon', 'lock'];
                  const next = order[(order.indexOf(gimbal.mode as 'off' | 'follow' | 'horizon' | 'lock') + 1) % order.length];
                  gimbal.setMode(next);
                  pushToast(`Gimbal: ${next.toUpperCase()}`, 'info');
                }}
                className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium cursor-pointer ${
                  gimbal.mode !== 'off'
                    ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)]'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{gimbal.mode === 'off' ? 'Gimbal' : gimbal.mode.toUpperCase()}</span>
              </button>
              <button
                type="button"
                onClick={toggleLiveCamera}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
              >
                {cameraActive ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                <span>{cameraActive ? 'Stop Cam' : 'Live Cam'}</span>
              </button>
              {isOwnerOrStaff && (
                <button
                  type="button"
                  onClick={handleEndBroadcast}
                  title="End Broadcast"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                >
                  <Power className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">End</span>
                </button>
              )}
            </>
          )}

          {/* Share 7-Platform Popover */}
          {activePopover === 'share' && (
            <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Share Live Room</span>
                <button type="button" onClick={() => setActivePopover('none')} className="cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(roomShareUrl).catch(() => {});
                  pushToast('Room link copied!', 'success');
                  setActivePopover('none');
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-primary)] py-2 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Direct Room Link</span>
              </button>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-medium">
                {[
                  { label: 'X / Twitter', href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrlEnc}` },
                  { label: 'WhatsApp', href: `https://wa.me/?text=${shareText}%20${shareUrlEnc}` },
                  { label: 'Telegram', href: `https://t.me/share/url?url=${shareUrlEnc}&text=${shareText}` },
                  { label: 'Reddit', href: `https://reddit.com/submit?url=${shareUrlEnc}&title=${shareText}` },
                  { label: 'Discord', href: roomShareUrl },
                  { label: 'TikTok', href: roomShareUrl },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (s.href === roomShareUrl) {
                        navigator.clipboard?.writeText(roomShareUrl).catch(() => {});
                        pushToast(`Link copied for ${s.label}!`, 'success');
                      }
                      setActivePopover('none');
                    }}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] py-1.5 text-center hover:border-[var(--accent-primary)]"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Visitors Popover (2 free preview / Full VIP) */}
          {activePopover === 'visitors' && (
            <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Recent Visitors ({visitorsData?.totalCount ?? 0})</span>
                <button type="button" onClick={() => setActivePopover('none')} className="cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {!visitorsData || visitorsData.visitors.length === 0 ? (
                <p className="text-[11px] text-[var(--fg-secondary)]">No visitors logged yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {visitorsData.visitors.map((v, i) => (
                    <div
                      key={`${v.visitorUid}-${i}`}
                      className="flex items-center justify-between rounded-lg bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="font-semibold truncate">{v.visitorName}</span>
                      <span className="font-mono-nums text-[10px] text-[var(--fg-muted)]">
                        {new Date(v.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {visitorsData.truncatedForFree && (
                    <div className="rounded-lg bg-amber-500/12 border border-amber-500/30 p-2 text-[10px] text-amber-700 dark:text-amber-300">
                      Showing 2 free previews. Activate VIP in Me Hub to see full visitor history.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Report Room Popover */}
          {activePopover === 'report' && (
            <div className="absolute right-0 top-11 z-40 w-68 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 shadow-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Report Safety Concern</span>
                <button type="button" onClick={() => setActivePopover('none')} className="cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-2 text-xs"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSubmitReport}
                className="w-full rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                Submit Report (3-Reporter Auto-Review)
              </button>
            </div>
          )}

          {/* Dice Duel 45s Popover */}
          {activePopover === 'duel' && (
            <div className="absolute right-0 top-11 z-40 w-72 rounded-2xl border border-[var(--accent-gold)]/50 bg-[var(--bg-surface)] p-3.5 shadow-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-[var(--accent-gold)]">
                  <Dices className="h-4 w-4" />
                  <span>45s Dice Duel (5 Tokens)</span>
                </span>
                <button type="button" onClick={() => setActivePopover('none')} className="cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {duel?.active ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg bg-[var(--bg-elevated)] px-2.5 py-1.5 font-mono-nums">
                    <span>Pot: <strong className="text-[var(--accent-gold)]">{duel.potTokens}T</strong></span>
                    <span className="text-[var(--accent-secondary)]">{duelSecLeft}s left</span>
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {duel.participants.map((p) => (
                      <div key={p.uid} className="flex items-center justify-between text-[11px]">
                        <span>{p.displayName}</span>
                        <span className="font-mono-nums font-bold">
                          {p.dice ? `[${p.dice[0]}+${p.dice[1]}] = ${p.total}` : 'Rolling...'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!session) return onRequireLogin();
                      playDiceSfx();
                      sendWsEvent('duel:join_roll', { roomId: liveStream.id });
                    }}
                    className="w-full rounded-lg bg-[var(--accent-gold)] py-2 text-xs font-bold text-black cursor-pointer"
                  >
                    Join & Roll Dice (5 Tokens)
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {duel?.winnerName && (
                    <div className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                      Last Winner: <strong>{duel.winnerName}</strong>
                    </div>
                  )}
                  <p className="text-[11px] text-[var(--fg-secondary)]">
                    Start a 45-second server-settled 2-dice pot duel. Highest roll wins the full token pot!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!session) return onRequireLogin();
                      sendWsEvent('duel:start', { roomId: liveStream.id });
                    }}
                    className="w-full rounded-lg bg-[var(--accent-primary)] py-2 text-xs font-bold text-[var(--accent-contrast)] cursor-pointer"
                  >
                    Start 45s Dice Duel Round
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unified Live Stage Layout & In-Stream Game Bar (Zero Overlap) */}
      {(canLaunchGame || activeRoomGame) && (
        <section className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5">
          {/* 4 Switchable Stage Modes */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-0.5">
              {STAGE_LAYOUT_OPTIONS.map((opt) => {
                const effectiveLayout = activeRoomGame ? stageLayout : 'video';
                const isSelected = effectiveLayout === opt.id;
                const Icon =
                  opt.id === 'video'
                    ? Video
                    : opt.id === 'game_pip'
                      ? PictureInPicture2
                      : opt.id === 'split'
                        ? Columns2
                        : Gamepad2;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectStageLayout(opt.id)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{opt.label}</span>
                    <span className="sm:hidden">{opt.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {activeRoomGame && stageLayout === 'game_pip' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={cycleCamCorner}
                  title={`Camera corner: ${PIP_CORNER_LABELS[camCorner]}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-[11px] font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                >
                  <CornerDownRight className="h-3 w-3 text-[var(--accent-secondary)]" />
                  <span>Corner</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCamPipSize((s) => (s === 'sm' ? 'md' : 'sm'))}
                  title="Toggle PiP Camera Size"
                  className="inline-flex h-8 items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 font-mono-nums text-[11px] font-semibold text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] cursor-pointer"
                >
                  {camPipSize === 'sm' ? 'Cam S' : 'Cam M'}
                </button>
              </div>
            )}

            {activeRoomGame && stageLayout === 'split' && (
              <button
                type="button"
                onClick={() => setSplitSwapped((v) => !v)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-[11px] font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
              >
                <ArrowLeftRight className="h-3 w-3 text-[var(--accent-secondary)]" />
                <span>Swap Sides</span>
              </button>
            )}
          </div>

          {/* Host Inline 4-Game Launcher */}
          {canLaunchGame && (
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                { id: 'fps' as GameType, label: 'ST Strike', icon: Crosshair },
                { id: 'rpg' as GameType, label: 'Realm RPG', icon: Shield },
                { id: 'ludo' as GameType, label: 'Ludo', icon: Dices },
                { id: 'snakes' as GameType, label: 'Snakes', icon: Gamepad2 },
              ]).map((gm) => {
                const Icon = gm.icon;
                const active = activeRoomGame?.gameType === gm.id;
                return (
                  <button
                    key={gm.id}
                    type="button"
                    onClick={() => handleLaunchInStreamGame(gm.id)}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold cursor-pointer ${
                      active
                        ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{gm.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col lg:flex-row gap-5 xl:gap-6 items-start">
        {/* Main Stage */}
        <div className="w-full min-w-0 flex-1 space-y-5">
          {(() => {
            const effectiveLayout: LiveStageLayout = activeRoomGame ? stageLayout : 'video';
            const aadsUnitId = liveStream.hostAadsUnitId || '';
            const aadsPos: BannerPlacement = liveStream.hostAadsBannerPos || 'below_stage';
            const aadsSize = liveStream.hostAadsBannerSize || '728x90';
            const aadsMeta =
              AADS_BANNER_SIZES.find((s) => s.id === aadsSize) || AADS_BANNER_SIZES[0];
            const aadsUrl = aadsUnitId ? buildSafeAadsIframeUrl(aadsUnitId, aadsSize) : null;
            const isSelfHost = session?.uid === liveStream.hostUid;

            const renderAadsBanner = (slot: BannerPlacement, overlaid = false) => {
              if (!aadsUrl || aadsPos !== slot) return null;
              return (
                <div
                  className={
                    overlaid
                      ? slot === 'corner'
                        ? 'absolute right-3 top-3 z-20 max-w-[230px] sm:max-w-[300px]'
                        : 'absolute inset-x-3 bottom-20 z-20 flex justify-center'
                      : 'w-full'
                  }
                >
                  <div
                    className={`relative group rounded-xl border border-amber-500/35 ${
                      overlaid
                        ? 'bg-black/82 backdrop-blur-md p-1.5 text-white'
                        : 'bg-[var(--bg-surface)] px-3 py-2'
                    } shadow-md`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                          overlaid ? 'text-amber-300' : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        <BadgeCheck className="h-3 w-3" />
                        <span>Verified Host Sponsor (A-ADS)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAadsGuide((v) => !v)}
                        aria-label="How Sponsor Banner supports this host"
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer ${
                          overlaid
                            ? 'bg-white/15 text-white hover:bg-white/25'
                            : 'bg-[var(--bg-canvas)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                        }`}
                      >
                        <Info className="h-3 w-3" />
                        <span>How it helps</span>
                      </button>
                    </div>

                    {/* Hover & Tap Viewer Support Guideline */}
                    <div
                      role="tooltip"
                      className={`${
                        showAadsGuide ? 'block' : 'hidden group-hover:block'
                      } absolute right-0 bottom-full mb-2 z-40 w-72 sm:w-80 rounded-xl border border-amber-500/45 bg-[var(--bg-surface)] p-3 text-left text-[var(--fg-primary)] shadow-2xl`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          <span>Verified Sponsor Banner Guide</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAadsGuide(false)}
                          className="text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer sm:hidden"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                        {VIEWER_AADS_GUIDELINE}
                      </p>
                      <p className="mt-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        Sandboxed &amp; Verified A-ADS Partner Unit
                      </p>
                    </div>

                    {isSelfHost ? (
                      <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-[11px] text-amber-700 dark:text-amber-300">
                        Your Verified A-ADS Banner ({aadsSize} · Unit #{aadsUnitId}) is active for
                        viewers here. Self-clicks are disabled in Host View to protect your account.
                      </div>
                    ) : (
                      <div className="flex justify-center overflow-hidden rounded-lg bg-black/20">
                        <iframe
                          src={aadsUrl}
                          title={`Verified A-ADS Sponsor Banner for ${liveStream.hostName}`}
                          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                          referrerPolicy="no-referrer-when-downgrade"
                          loading="lazy"
                          style={{
                            width: `min(100%, ${aadsMeta.width}px)`,
                            height: `${overlaid && aadsMeta.height > 120 ? 120 : aadsMeta.height}px`,
                            border: 0,
                          }}
                          className="block rounded-md bg-transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            const renderVideoStage = (mode: 'full' | 'split' | 'pip') => (
              <div
                className={`relative overflow-hidden border border-[var(--border-hairline)] bg-black ${
                  mode === 'full'
                    ? 'mx-auto aspect-video w-full max-w-[calc(74dvh*16/9)] rounded-2xl'
                    : mode === 'split'
                      ? 'aspect-video xl:aspect-auto xl:min-h-[430px] h-full w-full rounded-2xl'
                      : `${
                          camPipSize === 'sm' ? 'w-36 sm:w-44' : 'w-48 sm:w-60'
                        } aspect-video rounded-xl border-white/25 shadow-2xl`
                }`}
              >
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: gimbal.getCssTransform(), transition: 'transform 70ms linear' }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={liveStream.thumbnail}
                    alt={liveStream.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                )}

                {/* Celebratory Nova Burst / Crowd Confetti / Pulse Overlay */}
                {novaFlash && mode !== 'pip' && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-tr from-[#D90429]/30 via-amber-400/20 to-[#A3E635]/30 motion-safe:animate-nova-burst">
                    {novaFlash.fxKind !== 'pulse' && (
                      <div className="absolute inset-0 overflow-hidden">
                        {Array.from({ length: 16 }).map((_, idx) => (
                          <span
                            key={idx}
                            style={{
                              left: `${(idx * 6.5 + 4) % 94}%`,
                              top: `${(idx * 17 + 8) % 80}%`,
                              backgroundColor: ['#D90429', '#A3E635', '#E8C86A', '#38bdf8'][idx % 4],
                            }}
                            className="absolute h-2 w-3 rounded-xs opacity-85 motion-safe:animate-bounce"
                          />
                        ))}
                      </div>
                    )}
                    <div className="relative rounded-2xl border border-amber-300/60 bg-black/82 px-5 py-3 text-center text-white shadow-2xl backdrop-blur-md">
                      <div className="flex items-center justify-center gap-2 text-amber-300 font-bold text-[11px] uppercase tracking-widest">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>
                          {novaFlash.fxKind === 'nova'
                            ? 'NOVA STAGE BURST'
                            : novaFlash.fxKind === 'confetti'
                              ? 'CROWD CONFETTI FX'
                              : 'STAGE PULSE HYPE'}
                        </span>
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div className="mt-1 font-display text-base font-extrabold">
                        {novaFlash.sender} sent {novaFlash.gift}!
                      </div>
                      <div className="font-mono-nums text-xs text-lime-300">
                        {novaFlash.coins.toLocaleString()} Coins Crowd Cut
                      </div>
                    </div>
                  </div>
                )}

                {/* Host-Assigned Overlaid A-ADS Banner (Lower-Third or Corner) */}
                {mode !== 'pip' && renderAadsBanner('lower', true)}
                {mode !== 'pip' && renderAadsBanner('corner', true)}

                {mode === 'pip' ? (
                  <>
                    <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#D90429]" />
                      <span>LIVE</span>
                      <span className="font-mono-nums opacity-80">{liveStream.viewerCount}</span>
                    </div>
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={cycleCamCorner}
                        title="Move Camera Corner"
                        className="flex h-6 w-6 items-center justify-center rounded bg-black/75 text-white hover:bg-black cursor-pointer"
                      >
                        <CornerDownRight className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectStageLayout('video')}
                        title="Expand Stream Fullscreen"
                        className="flex h-6 w-6 items-center justify-center rounded bg-black/75 text-white hover:bg-black cursor-pointer"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1 text-[10px] font-semibold text-white truncate">
                      {countryFlag(liveStream.countryCode)} {liveStream.hostName}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                    <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-3 text-white">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => onViewProfile?.(liveStream.hostUid)}
                          title={`View ${liveStream.hostName}'s Biodata & CV`}
                          className="shrink-0 rounded-full ring-2 ring-white/50 hover:ring-[var(--accent-primary)] transition-all cursor-pointer"
                        >
                          {liveStream.hostAvatarUrl ? (
                            <img
                              src={liveStream.hostAvatarUrl}
                              alt={liveStream.hostName}
                              referrerPolicy="no-referrer"
                              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover bg-neutral-900"
                            />
                          ) : (
                            <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] text-xs font-bold text-white">
                              {(liveStream.hostName || 'ST').slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </button>
                        <div className="min-w-0">
                          <h1 className="font-display text-base sm:text-lg font-bold truncate">
                            {liveStream.title}
                          </h1>
                          <p className="flex flex-wrap items-center gap-1.5 text-xs text-white/85 font-mono-nums">
                            <span>{countryFlag(liveStream.countryCode)}</span>
                            <button
                              type="button"
                              onClick={() => onViewProfile?.(liveStream.hostUid)}
                              className="font-semibold hover:underline cursor-pointer"
                            >
                              {liveStream.hostName}
                            </button>
                            {(liveStream.hostPartnerVerified || liveStream.hostVerified) && (
                              <BadgeCheck
                                className={`h-3.5 w-3.5 ${
                                  liveStream.hostPartnerVerified ? 'text-emerald-400' : 'text-sky-400'
                                }`}
                                aria-label={
                                  liveStream.hostPartnerVerified
                                    ? 'Verified Earning Partner'
                                    : 'Verified Host'
                                }
                              />
                            )}
                            {liveStream.hostNumericId && (
                              <span className="opacity-70">#{liveStream.hostNumericId}</span>
                            )}
                            <span>· {liveStream.viewerCount.toLocaleString()} {t('viewers')}</span>
                            {liveStream.consentVerified && (
                              <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                CONSENTED
                              </span>
                            )}
                            {slowModeSec > 0 && (
                              <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                SLOW {slowModeSec}s
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block font-mono-nums text-xs font-bold tracking-wide text-rose-400">
                          ON AIR
                        </span>
                        <span className="text-[10px] font-mono-nums text-white/65">
                          {rtcTurnReady ? 'RTC TURN' : 'RTC STUN'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );

            const renderGameStage = (showCornerPip: boolean, showMiniHostBar: boolean) => {
              if (!activeRoomGame) return null;
              const levelPrefix = activeRoomGame.gameType === 'rpg' ? 'F' : 'L';
              const maxLvl = activeRoomGame.maxLevel || 3;
              const curLvl = activeRoomGame.level || 1;
              return (
                <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 sm:p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-hairline)] pb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {showMiniHostBar && (
                        <div className="relative h-11 w-18 shrink-0 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-black">
                          {cameraActive ? (
                            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                          ) : (
                            <img src={liveStream.thumbnail} alt={liveStream.title} className="h-full w-full object-cover" />
                          )}
                          <span className="absolute left-1 top-1 rounded bg-[#D90429] px-1 text-[8px] font-bold text-white">
                            LIVE
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h1 className="font-display text-sm sm:text-base font-bold text-[var(--fg-primary)] truncate">
                            {activeRoomGame.title}
                          </h1>
                          <span className="rounded bg-[var(--accent-primary)]/15 px-1.5 py-0.5 font-mono-nums text-[10px] font-bold text-[var(--accent-primary)]">
                            {levelPrefix}{curLvl}/{maxLvl} · {activeRoomGame.difficultyLabel || 'Standard'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--fg-secondary)] truncate">
                          {activeRoomGame.levelTitle || activeRoomGame.hostName} ·{' '}
                          {activeRoomGame.players.length}/{activeRoomGame.maxPlayers || 4} playing
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {canApproveRoomGame && maxLvl > 1 && (
                        <div className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-0.5">
                          {Array.from({ length: maxLvl }, (_, i) => i + 1).map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() =>
                                sendWsEvent('game:set_level', { roomId: activeRoomGame.roomId, level: lvl })
                              }
                              className={`h-7 min-w-[26px] rounded px-1.5 font-mono-nums text-[10px] font-bold cursor-pointer ${
                                curLvl === lvl
                                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                                  : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                              }`}
                            >
                              {levelPrefix}{lvl}
                            </button>
                          ))}
                        </div>
                      )}

                      {!isSeatedInGame && !isPendingInGame && (
                        <button
                          type="button"
                          onClick={handleRequestJoinGame}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-2.5 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>{t('requestJoin')}</span>
                        </button>
                      )}
                      {isPendingInGame && (
                        <span className="inline-flex h-8 items-center rounded-lg border border-amber-500/40 bg-amber-500/12 px-2.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {t('requestPending')}
                        </span>
                      )}
                      {canApproveRoomGame && (
                        <>
                          <button
                            type="button"
                            onClick={() => sendWsEvent('game:add_bot', { roomId: activeRoomGame.roomId })}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                          >
                            <Bot className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">
                              {activeRoomGame.gameType === 'fps'
                                ? 'Drone'
                                : activeRoomGame.gameType === 'rpg'
                                  ? 'Ally Bot'
                                  : 'Add Bot'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => sendWsEvent('game:restart', { roomId: activeRoomGame.roomId })}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Reset</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenGame(activeRoomGame.roomId)}
                        title="Open Full Games Hub"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-xs font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] cursor-pointer"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Hub</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Game Arena Container (with optional Floating Streamer Camera PiP in corner) */}
                  <div className="relative">
                    {activeRoomGame.gameType === 'fps' ? (
                      <FpsArenaGame
                        game={activeRoomGame}
                        compact
                        isSeated={isSeatedInGame}
                        isPending={isPendingInGame}
                        onRequestJoin={handleRequestJoinGame}
                      />
                    ) : activeRoomGame.gameType === 'rpg' ? (
                      <RpgDungeonGame
                        game={activeRoomGame}
                        compact
                        isSeated={isSeatedInGame}
                        isPending={isPendingInGame}
                        onRequestJoin={handleRequestJoinGame}
                      />
                    ) : (
                      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-secondary)]">
                              {activeRoomGame.gameType === 'ludo'
                                ? `Live In-Stream Ludo · L${curLvl}`
                                : `Live In-Stream Snakes & Ladders · L${curLvl}`}
                            </div>
                            <p className="text-xs text-[var(--fg-secondary)] mt-0.5">
                              {activeRoomGame.winnerName ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                                  <Crown className="h-3.5 w-3.5" /> {activeRoomGame.winnerName} won!
                                </span>
                              ) : activeRoomGame.status === 'lobby' ? (
                                'Waiting for Host to approve a Follower/viewer or add a Bot.'
                              ) : currentTurnPlayer ? (
                                `Active Turn: ${currentTurnPlayer.displayName} (${currentTurnPlayer.color})`
                              ) : null}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {activeRoomGame.diceValue !== null && (
                              <span className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono-nums text-xs font-bold text-[var(--fg-primary)]">
                                Roll: {activeRoomGame.diceValue}
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={!isMyBoardTurn || activeRoomGame.mustMove}
                              onClick={() => {
                                playDiceSfx();
                                sendWsEvent('game:roll_dice', { roomId: activeRoomGame.roomId });
                              }}
                              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] disabled:opacity-40 cursor-pointer"
                            >
                              <Dices className="h-4 w-4" />
                              <span>{t('rollDice')}</span>
                            </button>
                            {activeRoomGame.gameType === 'ludo' && isMyBoardTurn && activeRoomGame.mustMove && (
                              <button
                                type="button"
                                onClick={() => {
                                  const me = activeRoomGame.players.find((p) => p.uid === session?.uid);
                                  const dice = activeRoomGame.diceValue || 1;
                                  const canDeploy = dice === 6 || (curLvl === 2 && dice === 5);
                                  const legalIdx = me?.tokens.findIndex(
                                    (pos) => (pos === -1 && canDeploy) || (pos >= 0 && pos < 56 && pos + dice <= 56)
                                  );
                                  if (legalIdx !== undefined && legalIdx >= 0) {
                                    playStepSfx();
                                    sendWsEvent('game:move_piece', {
                                      roomId: activeRoomGame.roomId,
                                      tokenIndex: legalIdx,
                                    });
                                  }
                                }}
                                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-bold text-[var(--accent-contrast)] cursor-pointer"
                              >
                                Move Token
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {activeRoomGame.players.map((p, idx) => (
                            <div
                              key={p.uid}
                              className={`rounded-xl border p-3 ${
                                activeRoomGame.status === 'playing' && activeRoomGame.turnIndex === idx
                                  ? 'border-[var(--accent-primary)] bg-[var(--bg-surface)]'
                                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]/50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${PLAYER_DOT_BG[p.color]}`} />
                                <span className="truncate text-xs font-semibold text-[var(--fg-primary)]">
                                  {p.displayName}
                                </span>
                              </div>
                              <div className="mt-1 font-mono-nums text-[11px] text-[var(--fg-muted)]">
                                {activeRoomGame.gameType === 'ludo'
                                  ? `Home ${p.tokens.filter((v) => v === 56).length}/4`
                                  : `Square ${p.tokens[0]}/100`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Floating Corner Streamer Camera Overlay (Game + Cam Mode) */}
                    {showCornerPip && (
                      <div className={`absolute z-20 ${PIP_CORNER_CLASSES[camCorner]}`}>
                        {renderVideoStage('pip')}
                      </div>
                    )}
                  </div>

                  {(activeRoomGame.pendingRequests.length > 0 || canApproveRoomGame) && (
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--fg-primary)]">
                          Join Requests ({activeRoomGame.pendingRequests.length})
                        </span>
                      </div>
                      {activeRoomGame.pendingRequests.length === 0 ? (
                        <p className="text-xs text-[var(--fg-muted)]">
                          Waiting for Followers or viewers to click &ldquo;{t('requestJoin')}&rdquo;.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {activeRoomGame.pendingRequests.map((req) => (
                            <div
                              key={req.uid}
                              className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs"
                            >
                              <span className="font-semibold">{req.displayName}</span>
                              {req.isFollower && (
                                <span className="text-[10px] font-bold text-[var(--accent-secondary)]">FOLLOWER</span>
                              )}
                              {canApproveRoomGame && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendWsEvent('game:approve_player', {
                                        roomId: activeRoomGame.roomId,
                                        targetUid: req.uid,
                                      })
                                    }
                                    className="inline-flex h-7 items-center gap-1 rounded bg-emerald-600 px-2 text-[11px] font-semibold text-white cursor-pointer"
                                  >
                                    <Check className="h-3 w-3" />
                                    <span>{t('approve')}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendWsEvent('game:decline_player', {
                                        roomId: activeRoomGame.roomId,
                                        targetUid: req.uid,
                                      })
                                    }
                                    aria-label="Decline"
                                    className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--fg-muted)] hover:text-rose-500 cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            };

            const stageContent =
              effectiveLayout === 'video' ? (
                renderVideoStage('full')
              ) : effectiveLayout === 'game_pip' ? (
                renderGameStage(true, false)
              ) : effectiveLayout === 'split' ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                  {splitSwapped ? (
                    <>
                      <div className="min-w-0">{renderGameStage(false, false)}</div>
                      <div className="min-w-0">{renderVideoStage('split')}</div>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">{renderVideoStage('split')}</div>
                      <div className="min-w-0">{renderGameStage(false, false)}</div>
                    </>
                  )}
                </div>
              ) : (
                renderGameStage(false, true)
              );

            return (
              <div className="space-y-3">
                {renderAadsBanner('top')}
                {stageContent}
                {renderAadsBanner('below_stage')}
              </div>
            );
          })()}

          {/* Co-Host / Co-Publish Rail (up to 4 co-hosts — G-037) */}
          {(coHosts.length > 0 || isHostOrMod) && (
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--fg-primary)]">
                  <Video className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>Co-Host Rail ({coHosts.length}/4)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isHostOrMod ? (
                    <>
                      <input
                        type="text"
                        value={coHostInviteUid}
                        onChange={(e) => setCoHostInviteUid(e.target.value)}
                        placeholder="Invite UID (e.g. ST-2001)"
                        className="h-8 w-36 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-xs text-[var(--fg-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!coHostInviteUid.trim()) return;
                          sendWsEvent('room:cohost_invite', {
                            roomId: liveStream.id,
                            targetUid: coHostInviteUid.trim().toUpperCase(),
                          });
                          setCoHostInviteUid('');
                        }}
                        className="h-8 rounded-lg bg-[var(--accent-primary)] px-2.5 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
                      >
                        Invite
                      </button>
                    </>
                  ) : session && coHosts.some((c) => c.uid === session.uid && c.status === 'invited') ? (
                    <button
                      type="button"
                      onClick={startCoHostPublish}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Go Live as Co-Host</span>
                    </button>
                  ) : session && coHostPublishing ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopCoHostMedia();
                        sendWsEvent('room:cohost_leave', { roomId: liveStream.id, targetUid: session.uid });
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                    >
                      <CameraOff className="h-3.5 w-3.5" />
                      <span>Stop Co-Host Cam</span>
                    </button>
                  ) : null}
                </div>
              </div>
              {coHosts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                  {coHosts.map((ch) => {
                    const isSelfCoHost = session?.uid === ch.uid;
                    const mediaFeed = isSelfCoHost
                      ? coHostLocalStream
                      : coHostRemoteStreams[ch.uid] || null;
                    return (
                      <div
                        key={ch.uid}
                        className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-xs"
                      >
                        {mediaFeed && (
                          <div className="relative aspect-video bg-black">
                            <video
                              autoPlay
                              playsInline
                              muted={isSelfCoHost}
                              ref={(el) => {
                                if (el && el.srcObject !== mediaFeed) {
                                  el.srcObject = mediaFeed;
                                  el.play().catch(() => {});
                                }
                              }}
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute left-1.5 top-1.5 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              {isSelfCoHost ? 'YOU · LIVE CAM' : 'CO-HOST VIDEO'}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-[var(--fg-primary)]">
                              {ch.displayName}
                            </div>
                            <div className="text-[10px] font-mono-nums text-[var(--fg-muted)]">
                              {mediaFeed
                                ? 'VIDEO PUBLISHING'
                                : ch.status === 'live'
                                  ? 'CO-HOST LIVE'
                                  : 'INVITED'}
                            </div>
                          </div>
                          {(isHostOrMod || isSelfCoHost) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isSelfCoHost) stopCoHostMedia();
                                sendWsEvent('room:cohost_leave', {
                                  roomId: liveStream.id,
                                  targetUid: ch.uid,
                                });
                              }}
                              aria-label="Remove Co-Host"
                              className="text-[var(--fg-muted)] hover:text-rose-500 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Live PK Battle Meter */}
          {pk.active && (
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-semibold">
                  {liveStream.hostName} · <span className="font-mono-nums text-[var(--accent-primary)]">{pk.hostScore}</span>
                </span>
                <span className="text-xs font-bold text-[var(--accent-gold)]">{t('pkBattle')}</span>
                <span className="font-semibold">
                  <span className="font-mono-nums text-[var(--accent-secondary)]">{pk.challengerScore}</span> · {pk.challengerName}
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                <div className="bg-[var(--accent-primary)] transition-all duration-300" style={{ width: `${hostPct}%` }} />
                <div className="bg-[var(--accent-secondary)] transition-all duration-300" style={{ width: `${100 - hostPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--fg-secondary)]">
                <span>Support side with gifts:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPkTarget('host')}
                    className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                      pkTarget === 'host'
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                    }`}
                  >
                    {liveStream.hostName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPkTarget('challenger')}
                    className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                      pkTarget === 'challenger'
                        ? 'border border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/18 text-[var(--fg-primary)] font-semibold'
                        : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                    }`}
                  >
                    Challenger
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Multi-Guest Stage (up to 12 seats) */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm sm:text-base font-semibold flex items-center gap-2 text-[var(--fg-primary)]">
                <Users className="h-4 w-4 text-[var(--accent-secondary)]" />
                <span>{t('multiGuestSeats')}</span>
              </h2>
              <span className="text-xs font-mono-nums text-[var(--fg-secondary)]">
                {seats.filter((s) => s.uid).length}/{seats.length} {t('seats')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {seats.map((seat) => {
                const occupied = Boolean(seat.uid);
                const isMine = session && seat.uid === session.uid;
                return (
                  <button
                    key={seat.seatIndex}
                    type="button"
                    disabled={seat.seatIndex === 0}
                    onClick={() => handleSeatClick(seat.seatIndex)}
                    className={`flex flex-col items-start justify-between rounded-xl border p-2.5 text-left transition-colors min-h-[68px] ${
                      seat.seatIndex === 0
                        ? 'border-[var(--accent-primary)]/50 bg-[var(--bg-elevated)] cursor-default'
                        : occupied
                          ? 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] cursor-pointer'
                          : 'border-dashed border-[var(--border-hairline)] hover:border-[var(--accent-secondary)] cursor-pointer'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between text-[11px] text-[var(--fg-muted)] font-mono-nums">
                      <span>Seat {seat.seatIndex + 1}</span>
                      {occupied ? (
                        seat.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                      ) : null}
                    </div>
                    <div className="mt-1.5 w-full truncate text-xs font-medium text-[var(--fg-primary)]">
                      {occupied ? `${seat.displayName}${isMine ? ' (You)' : ''}` : t('joinSeat')}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Sidebar: Real-Time Chat + 32 Stickers + Translate + Discounted Combo Gifts */}
        <aside className="w-full lg:w-[348px] xl:w-[382px] 2xl:w-[416px] shrink-0 flex flex-col rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] h-[620px] lg:h-[min(80dvh,780px)] relative">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm font-semibold text-[var(--fg-primary)]">Live Chat</h2>
              <span className="text-[11px] font-mono-nums text-[var(--fg-muted)]">{messages.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setTranslateOn((v) => !v)}
              title="Auto-Translate Chat to your UI language"
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold cursor-pointer ${
                translateOn
                  ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                  : 'border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
              }`}
            >
              <Languages className="h-3 w-3" />
              <span>{translateOn ? `Auto (${locale.toUpperCase()})` : 'Translate'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-2 text-sm">
            {messages.map((msg) => {
              const isMuted = mutedUids.includes(msg.uid);
              const sticker = parseStickerCode(msg.text);
              return (
                <div
                  key={msg.id}
                  className={`rounded-xl px-3 py-2 ${
                    msg.gift
                      ? 'bg-[var(--accent-gold)]/12 border border-[var(--accent-gold)]/35'
                      : msg.pinned
                        ? 'bg-[var(--bg-elevated)]'
                        : 'bg-[var(--bg-canvas)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--fg-primary)] truncate">
                      {msg.displayName}
                      {msg.level !== undefined && (
                        <span className="ml-1 font-mono-nums text-[10px] text-[var(--accent-secondary)]">
                          Lv.{msg.level}
                        </span>
                      )}
                      {msg.isVip && (
                        <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-400">
                          VIP
                        </span>
                      )}
                      {msg.isFollower && (
                        <span className="ml-1 text-[10px] font-bold text-[var(--accent-secondary)]">
                          Follower
                        </span>
                      )}
                    </span>
                    {canModChat && msg.uid !== liveStream.hostUid && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            sendWsEvent('room:mute_user', {
                              roomId: liveStream.id,
                              targetUid: msg.uid,
                            })
                          }
                          title={isMuted ? 'Unmute user' : 'Mute user'}
                          className="inline-flex items-center gap-0.5 text-[10px] text-[var(--fg-muted)] hover:text-amber-400 cursor-pointer"
                        >
                          <ShieldAlert className="h-3 w-3" />
                          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBlockChatUser(msg.uid, msg.displayName)}
                          title="Block user from room"
                          className="text-[var(--fg-muted)] hover:text-rose-500 cursor-pointer"
                        >
                          <Ban className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {sticker ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xl leading-none">{sticker.emoji}</span>
                      <span className="text-[11px] font-semibold text-[var(--fg-secondary)]">{sticker.label}</span>
                    </div>
                  ) : (() => {
                    const mediaTok = !msg.gift ? parseMediaToken(msg.text) : null;
                    if (mediaTok) {
                      const asset = mediaLibrary.find((a) => a.id === mediaTok.id);
                      if (asset) {
                        return (
                          <div className="mt-1.5 space-y-1">
                            {asset.type === 'photo' ? (
                              <img
                                src={asset.url}
                                alt={asset.label}
                                className="max-h-36 w-full rounded-lg border border-[var(--border-hairline)] object-cover"
                              />
                            ) : (
                              <video
                                src={asset.url}
                                controls
                                className="max-h-36 w-full rounded-lg border border-[var(--border-hairline)] bg-black object-cover"
                              />
                            )}
                            <div className="text-[10px] font-mono-nums text-[var(--fg-muted)] truncate">
                              {asset.label}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--fg-secondary)]">
                          <ImageIcon className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                          <span>Shared Studio {mediaTok.kind === 'clip' ? 'Clip' : 'Photo'} · #{mediaTok.id.slice(0, 10)}</span>
                        </div>
                      );
                    }
                    return (
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-secondary)] break-words">
                        {msg.gift ? (
                          <span className="font-semibold text-[var(--accent-gold)]">
                            {msg.text} ({msg.gift.coins} coins)
                          </span>
                        ) : (
                          <>
                            {msg.text}
                            {translateOn && translations[msg.id] && (
                              <span className="mt-0.5 block text-[11px] italic text-[var(--accent-secondary)]">
                                {translations[msg.id]}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    );
                  })()}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* 32-Sticker Drawer Popover (4 Packs × 8) */}
          {activePopover === 'stickers' && (
            <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {STICKER_PACKS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setStickerPackId(p.id)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                        stickerPackId === p.id
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                          : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setActivePopover('none')} className="cursor-pointer">
                  <X className="h-3.5 w-3.5 text-[var(--fg-muted)]" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {STICKER_PACKS.find((p) => p.id === stickerPackId)?.items.map((st) => (
                  <button
                    key={st.code}
                    type="button"
                    onClick={() => handleSendSticker(st.code)}
                    className="flex flex-col items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-1.5 hover:border-[var(--accent-primary)] cursor-pointer"
                  >
                    <span className="text-xl leading-none">{st.emoji}</span>
                    <span className="mt-0.5 text-[9px] text-[var(--fg-muted)] truncate max-w-full px-1">{st.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Gift Combo Selector + Discount Badge + 6-Tier Server-Authoritative Gift Ladder */}
          <div className="border-t border-[var(--border-hairline)] px-3 pt-2 pb-2 space-y-1.5">
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="text-[var(--fg-muted)]">Combo:</span>
                {COMBO_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setGiftCombo(c)}
                    className={`rounded px-1.5 py-0.5 font-mono-nums font-bold cursor-pointer ${
                      giftCombo === c
                        ? 'bg-[var(--accent-gold)] text-black'
                        : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                    }`}
                  >
                    ×{c}
                  </button>
                ))}
              </div>
              {discountPct > 0 && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                  -{discountPct}% OFF
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {STREAMLIVE_GIFTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGift(g.id, g.name, g.coins)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-gold)] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Gift className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
                  <span>{g.name}</span>
                  <span className="font-mono-nums text-[11px] text-[var(--accent-gold)]">
                    {effectiveGiftPrice(g.coins)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Composer with Sticker Drawer Trigger */}
          <form
            onSubmit={handleSendChat}
            className="flex items-center gap-1.5 border-t border-[var(--border-hairline)] p-2.5"
          >
            <button
              type="button"
              onClick={() => setActivePopover((p) => (p === 'stickers' ? 'none' : 'stickers'))}
              aria-label="Open 32 Stickers"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border cursor-pointer ${
                activePopover === 'stickers'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
              }`}
            >
              <Smile className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={session ? t('chatPlaceholder') : 'Sign in to chat...'}
              className="flex-1 h-9 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs sm:text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="submit"
              aria-label={t('sendMessage')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] transition-colors cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
};

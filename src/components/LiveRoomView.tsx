import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Camera,
  CameraOff,
  Check,
  Compass,
  Crosshair,
  Crown,
  Dices,
  Gamepad2,
  Gift,
  Heart,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Share2,
  ShieldAlert,
  Swords,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useGimbal } from '../lib/gimbalEngine';
import { playDiceSfx, playStepSfx } from '../lib/sfx';
import type {
  ChatMessage,
  GameRoomState,
  GameType,
  Livestream,
  MultiGuestSeat,
  PKState,
  PlayerColor,
} from '../types';
import { FpsArenaGame } from './FpsArenaGame';

interface LiveRoomViewProps {
  stream: Livestream;
  onBack: () => void;
  onOpenGame: (gameRoomId: string) => void;
  onMessageHost?: (hostUid: string) => void;
  onRequireLogin: () => void;
}

// Authentic StreamLive Gift Ladder
const STREAMLIVE_GIFTS = [
  { name: 'Spark', coins: 10 },
  { name: 'Bubble', coins: 20 },
  { name: 'Comet', coins: 50 },
  { name: 'Rocket', coins: 120 },
  { name: 'Nova Crown', coins: 200 },
  { name: 'Nova Burst', coins: 500 },
];

const PLAYER_DOT_BG: Record<PlayerColor, string> = {
  red: 'bg-rose-600',
  green: 'bg-emerald-600',
  yellow: 'bg-amber-500',
  blue: 'bg-sky-600',
};

export const LiveRoomView: React.FC<LiveRoomViewProps> = ({
  stream,
  onBack,
  onOpenGame,
  onMessageHost,
  onRequireLogin,
}) => {
  const { session, streams, games, sendWsEvent, subscribeWs, pushToast, t } = useApp();

  // Keep live stream metadata reactive when Host launches/switches an in-stream game
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mutedUids, setMutedUids] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>(['ST-2001', 'ST-2002']);
  const [draft, setDraft] = useState('');
  const [pkTarget, setPkTarget] = useState<'host' | 'challenger'>('host');
  const [cameraActive, setCameraActive] = useState(false);
  const [stageMode, setStageMode] = useState<'video' | 'game'>(
    liveStream.gameRoomId ? 'game' : 'video'
  );
  const gimbal = useGimbal('off');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-open in-stream game stage when Host launches a game live
  const prevGameIdRef = useRef<string | undefined>(liveStream.gameRoomId);
  useEffect(() => {
    if (liveStream.gameRoomId && liveStream.gameRoomId !== prevGameIdRef.current) {
      setStageMode('game');
    }
    prevGameIdRef.current = liveStream.gameRoomId;
  }, [liveStream.gameRoomId]);

  const isHostOrMod =
    session &&
    ((session.role === 'host' && session.uid === liveStream.hostUid) ||
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
      (session.role === 'admin' &&
        session.assignedHostUid === liveStream.hostUid &&
        session.permissions?.canModerateChat));

  const canRunPK =
    session &&
    ((session.role === 'host' && session.uid === liveStream.hostUid) ||
      (session.role === 'admin' &&
        session.assignedHostUid === liveStream.hostUid &&
        session.permissions?.canRunPK));

  const isFollowing = Boolean(session && followers.includes(session.uid));
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
      activeRoomGame.status === 'playing' &&
      currentTurnPlayer?.uid === session.uid
  );

  useEffect(() => {
    sendWsEvent('room:join', { roomId: liveStream.id });
    const unsub = subscribeWs((event, payload) => {
      if (event === 'room:state' && payload) {
        const data = payload as {
          roomId: string;
          seats: MultiGuestSeat[];
          pk: PKState;
          messages: ChatMessage[];
          mutedUids: string[];
          followers?: string[];
        };
        if (data.roomId === liveStream.id) {
          setSeats(data.seats);
          setPk(data.pk);
          setMessages(data.messages);
          setMutedUids(data.mutedUids || []);
          if (data.followers) setFollowers(data.followers);
        }
      } else if (event === 'room:chat_msg' && payload) {
        const msg = payload as ChatMessage;
        if (msg.roomId === liveStream.id) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      }
    });
    return () => {
      unsub();
    };
  }, [liveStream.id, sendWsEvent, subscribeWs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const toggleLiveCamera = async () => {
    if (cameraActive) {
      mediaStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      mediaStreamRef.current = null;
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

  const handleFollowToggle = () => {
    if (!session) {
      onRequireLogin();
      return;
    }
    sendWsEvent('room:follow_toggle', { roomId: liveStream.id });
    pushToast(
      isFollowing ? `Unfollowed ${liveStream.hostName}.` : `Following ${liveStream.hostName}! You now show as a Follower in chat & games.`,
      'info'
    );
  };

  const handleLaunchInStreamGame = (gameType: GameType) => {
    if (!session) {
      onRequireLogin();
      return;
    }
    sendWsEvent('room:launch_game', { roomId: liveStream.id, gameType });
    setStageMode('game');
    pushToast(
      `Launching ${gameType === 'fps' ? '3D FPS Arena' : gameType === 'ludo' ? 'Ludo' : 'Snakes & Ladders'} live for Followers & viewers!`,
      'success'
    );
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

  const handleGift = (giftName: string, coins: number) => {
    if (!session) {
      onRequireLogin();
      return;
    }
    sendWsEvent('room:gift', { roomId: liveStream.id, giftName, coins, pkSide: pkTarget });
  };

  const handleSeatClick = (seatIndex: number) => {
    if (!session) {
      onRequireLogin();
      return;
    }
    sendWsEvent('room:seat_toggle', { roomId: liveStream.id, seatIndex });
  };

  const totalPk = Math.max(1, pk.hostScore + pk.challengerScore);
  const hostPct = Math.round((pk.hostScore / totalPk) * 100);

  return (
    <main className="sl-fluid-page pt-5 pb-28 md:pb-12">
      {/* Top Room Controls Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-sm font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('backToLive')}</span>
          </button>

          <button
            type="button"
            onClick={handleFollowToggle}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-colors cursor-pointer ${
              isFollowing
                ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${isFollowing ? 'fill-current' : ''}`} />
            <span>{isFollowing ? 'Following' : 'Follow Host'}</span>
            <span className="font-mono-nums opacity-80">{followers.length}</span>
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
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">DM</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeRoomGame && (
            <div className="flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0.5">
              <button
                type="button"
                onClick={() => setStageMode('video')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold cursor-pointer ${
                  stageMode === 'video'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                <span>Stream</span>
              </button>
              <button
                type="button"
                onClick={() => setStageMode('game')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold cursor-pointer ${
                  stageMode === 'game'
                    ? 'bg-[var(--accent-secondary)] text-[#0d0d10]'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <Gamepad2 className="h-3.5 w-3.5" />
                <span>Play Live Game</span>
              </button>
            </div>
          )}

          {canRunPK && (
            <button
              type="button"
              onClick={() => sendWsEvent('room:pk_toggle', { roomId: liveStream.id })}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-sm font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Swords className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{pk.active ? t('endPK') : t('startPK')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/?room=${encodeURIComponent(liveStream.id)}`;
              if (navigator.share) {
                try {
                  await navigator.share({ title: liveStream.title, url });
                  return;
                } catch {
                  // fall back to clipboard
                }
              }
              await navigator.clipboard?.writeText(url).catch(() => {});
              pushToast('Live link copied', 'success');
            }}
            aria-label="Share Live Link"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

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
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium cursor-pointer ${
                  gimbal.mode !== 'off'
                    ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)]'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>{gimbal.mode === 'off' ? 'Gimbal' : gimbal.mode.toUpperCase()}</span>
              </button>
              <button
                type="button"
                onClick={toggleLiveCamera}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-medium text-[var(--accent-contrast)] cursor-pointer"
              >
                {cameraActive ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                <span>{cameraActive ? 'Stop Cam' : 'Live Cam'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Host Inline "Play With Followers & Viewers" Game Launcher */}
      {canLaunchGame && (
        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-[var(--fg-secondary)]">
            <Gamepad2 className="h-4 w-4 text-[var(--accent-secondary)]" />
            <span className="font-semibold text-[var(--fg-primary)]">Host Live Game Controls:</span>
            <span>Launch a multiplayer match inside this stream with Followers &amp; viewers</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleLaunchInStreamGame('fps')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>Launch 3D FPS</span>
            </button>
            <button
              type="button"
              onClick={() => handleLaunchInStreamGame('ludo')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Dices className="h-3.5 w-3.5" />
              <span>Launch Ludo</span>
            </button>
            <button
              type="button"
              onClick={() => handleLaunchInStreamGame('snakes')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Launch Snakes</span>
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-col lg:flex-row gap-5 xl:gap-6 items-start">
        {/* Main Stage: Interactive Video Stage OR In-Stream Multiplayer Game Stage + PK + Multi-Guest */}
        <div className="w-full min-w-0 flex-1 space-y-6">
          {stageMode === 'game' && activeRoomGame ? (
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4">
              {/* Compact Live Broadcast Strip above the In-Stream Game */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-black">
                    {cameraActive ? (
                      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                    ) : (
                      <img
                        src={liveStream.thumbnail}
                        alt={liveStream.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute left-1 top-1 rounded bg-[#D90429] px-1 text-[9px] font-bold text-white">
                      LIVE
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-display text-sm sm:text-base font-bold text-[var(--fg-primary)] truncate">
                      {activeRoomGame.title}
                    </h1>
                    <p className="text-xs text-[var(--fg-secondary)] truncate">
                      Host: <strong className="text-[var(--fg-primary)]">{activeRoomGame.hostName}</strong> ·{' '}
                      {activeRoomGame.players.length}/{activeRoomGame.maxPlayers || 4} playing in stream
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isSeatedInGame && !isPendingInGame && (
                    <button
                      type="button"
                      onClick={handleRequestJoinGame}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>{t('requestJoin')}</span>
                    </button>
                  )}
                  {isPendingInGame && (
                    <span className="inline-flex h-9 items-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-medium text-amber-500">
                      {t('requestPending')}
                    </span>
                  )}
                  {canApproveRoomGame && (
                    <>
                      <button
                        type="button"
                        onClick={() => sendWsEvent('game:add_bot', { roomId: activeRoomGame.roomId })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        <span>{activeRoomGame.gameType === 'fps' ? 'Add Drone' : 'Add Bot'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => sendWsEvent('game:restart', { roomId: activeRoomGame.roomId })}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenGame(activeRoomGame.roomId)}
                    title="Open Full Games Hub"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] cursor-pointer"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Full Hub</span>
                  </button>
                </div>
              </div>

              {/* Embedded In-Stream Game Viewport */}
              {activeRoomGame.gameType === 'fps' ? (
                <FpsArenaGame
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
                        {activeRoomGame.gameType === 'ludo' ? 'Live In-Stream Ludo' : 'Live In-Stream Snakes & Ladders'}
                      </div>
                      <p className="text-xs text-[var(--fg-secondary)] mt-0.5">
                        {activeRoomGame.winnerName ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
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
                            const legalIdx = me?.tokens.findIndex(
                              (pos) => (pos === -1 && dice === 6) || (pos >= 0 && pos < 56 && pos + dice <= 56)
                            );
                            if (legalIdx !== undefined && legalIdx >= 0) {
                              playStepSfx();
                              sendWsEvent('game:move_piece', {
                                roomId: activeRoomGame.roomId,
                                tokenIndex: legalIdx,
                              });
                            }
                          }}
                          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--accent-secondary)] px-3.5 text-xs font-bold text-[#0d0d10] cursor-pointer"
                        >
                          Move Token
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Player Progress Strip */}
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

                  <div className="flex items-center justify-between text-xs text-[var(--fg-secondary)]">
                    <span className="truncate">{activeRoomGame.log[0]}</span>
                    <button
                      type="button"
                      onClick={() => onOpenGame(activeRoomGame.roomId)}
                      className="shrink-0 font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                    >
                      Open Full Board →
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Host Approval Queue for Followers & Viewers inside the Stream */}
              {(activeRoomGame.pendingRequests.length > 0 || canApproveRoomGame) && (
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--fg-primary)]">
                      Follower &amp; Viewer Join Requests ({activeRoomGame.pendingRequests.length})
                    </span>
                    <span className="text-[var(--fg-muted)]">
                      {canApproveRoomGame ? 'Approve players directly into this live game' : 'Host approves requests here'}
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
                          <span className="font-semibold text-[var(--fg-primary)]">{req.displayName}</span>
                          {req.isFollower && (
                            <span className="text-[10px] font-bold text-[var(--accent-secondary)]">
                              FOLLOWER
                            </span>
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
                                className="inline-flex h-7 items-center gap-1 rounded bg-emerald-600 px-2 text-[11px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
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
          ) : (
            /* Standard Live Video Broadcast Stage */
            <div className="relative mx-auto aspect-video w-full max-w-[calc(74dvh*16/9)] overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-black">
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
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
              <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-4 text-white">
                <div className="min-w-0">
                  <h1 className="font-display text-lg sm:text-xl font-bold truncate">
                    {liveStream.title}
                  </h1>
                  <p className="text-xs text-white/80 font-mono-nums">
                    {liveStream.hostName} ({liveStream.hostUid}) · {liveStream.viewerCount.toLocaleString()} {t('viewers')}
                  </p>
                </div>
                <span className="shrink-0 font-mono-nums text-xs font-bold tracking-wide text-[var(--accent-primary)]">
                  ON AIR
                </span>
              </div>
            </div>
          )}

          {/* Live PK Battle Meter */}
          {pk.active && (
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[var(--fg-primary)]">
                  {liveStream.hostName} · <span className="font-mono-nums text-[var(--accent-primary)]">{pk.hostScore}</span>
                </span>
                <span className="text-xs font-medium text-[var(--accent-gold)]">
                  {t('pkBattle')}
                </span>
                <span className="font-semibold text-[var(--fg-primary)]">
                  <span className="font-mono-nums text-[var(--accent-secondary)]">{pk.challengerScore}</span> · {pk.challengerName}
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                <div
                  className="bg-[var(--accent-primary)] transition-all duration-300"
                  style={{ width: `${hostPct}%` }}
                />
                <div
                  className="bg-[var(--accent-secondary)] transition-all duration-300"
                  style={{ width: `${100 - hostPct}%` }}
                />
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
                        ? 'bg-[var(--accent-secondary)] text-[#0d0d10]'
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
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold flex items-center gap-2 text-[var(--fg-primary)]">
                <Users className="h-4 w-4 text-[var(--accent-secondary)]" />
                <span>{t('multiGuestSeats')}</span>
              </h2>
              <span className="text-xs font-mono-nums text-[var(--fg-secondary)]">
                {seats.filter((s) => s.uid).length}/{seats.length} {t('seats')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {seats.map((seat) => {
                const occupied = Boolean(seat.uid);
                const isMine = session && seat.uid === session.uid;
                return (
                  <button
                    key={seat.seatIndex}
                    type="button"
                    disabled={seat.seatIndex === 0}
                    onClick={() => handleSeatClick(seat.seatIndex)}
                    className={`flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-colors min-h-[76px] ${
                      seat.seatIndex === 0
                        ? 'border-[var(--accent-primary)]/50 bg-[var(--bg-elevated)] cursor-default'
                        : occupied
                          ? 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] cursor-pointer'
                          : 'border-dashed border-[var(--border-hairline)] hover:border-[var(--accent-secondary)] cursor-pointer'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between text-xs text-[var(--fg-muted)] font-mono-nums">
                      <span>Seat {seat.seatIndex + 1}</span>
                      {occupied ? (
                        seat.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                      ) : null}
                    </div>
                    <div className="mt-2 w-full truncate text-xs font-medium text-[var(--fg-primary)]">
                      {occupied
                        ? `${seat.displayName}${isMine ? ' (You)' : ''}`
                        : t('joinSeat')}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Sidebar: Real-Time WebSocket Chat & StreamLive Gift Ladder */}
        <aside className="w-full lg:w-[340px] xl:w-[376px] 2xl:w-[410px] shrink-0 flex flex-col rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] h-[610px] lg:h-[min(78dvh,760px)]">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3.5">
            <h2 className="font-display text-sm font-semibold text-[var(--fg-primary)]">
              Live Chat
            </h2>
            <span className="text-xs font-mono-nums text-[var(--fg-muted)]">
              {messages.length} msgs
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 text-sm">
            {messages.map((msg) => {
              const isMuted = mutedUids.includes(msg.uid);
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
                      <span className="ml-1.5 font-normal text-[var(--fg-muted)]">
                        {msg.role}
                      </span>
                      {msg.isFollower && (
                        <span className="ml-1.5 text-[10px] font-bold text-[var(--accent-secondary)]">
                          Follower
                        </span>
                      )}
                    </span>
                    {canModChat && msg.uid !== liveStream.hostUid && (
                      <button
                        type="button"
                        onClick={() =>
                          sendWsEvent('room:mute_user', {
                            roomId: liveStream.id,
                            targetUid: msg.uid,
                          })
                        }
                        title={isMuted ? 'Unmute user' : 'Mute user'}
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--fg-muted)] hover:text-rose-500 cursor-pointer"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-secondary)] break-words">
                    {msg.gift ? (
                      <span className="font-semibold text-[var(--accent-gold)]">
                        {msg.text} ({msg.gift.coins} coins)
                      </span>
                    ) : (
                      msg.text
                    )}
                  </p>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Authentic StreamLive 6-Tier Gift Ladder */}
          <div className="border-t border-[var(--border-hairline)] px-3 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {STREAMLIVE_GIFTS.map((g) => (
              <button
                key={g.name}
                type="button"
                onClick={() => handleGift(g.name, g.coins)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-gold)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Gift className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
                <span>{g.name}</span>
                <span className="font-mono-nums text-[var(--fg-muted)]">{g.coins}</span>
              </button>
            ))}
          </div>

          {/* Chat Composer */}
          <form
            onSubmit={handleSendChat}
            className="flex items-center gap-2 border-t border-[var(--border-hairline)] p-3"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={session ? t('chatPlaceholder') : 'Sign in to chat...'}
              className="flex-1 h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="submit"
              aria-label={t('sendMessage')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] transition-colors cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
};

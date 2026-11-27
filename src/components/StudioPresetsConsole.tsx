import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Gamepad2,
  KeyRound,
  Lock,
  Mic,
  Music,
  Radio,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Tv,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ASPECT_RATIOS, CAMERA_FILTERS, type AspectRatioId, type ResolutionOption } from '../lib/cameraEngine';
import { STUDIO_PRESETS, type ArOverlayId, type StudioPresetSpec } from '../lib/studioPresets';
import type { GameType, Livestream, LiveStageLayout } from '../types';

interface StudioPresetsConsoleProps {
  onOpenLogin: () => void;
  onEnterStream: (stream: Livestream) => void;
  onOpenCamera: () => void;
}

const PRESET_ICONS: Record<string, React.ReactNode> = {
  solo_irl: <Radio className="h-4 w-4" />,
  gaming_arena: <Gamepad2 className="h-4 w-4" />,
  music_stage: <Music className="h-4 w-4" />,
  podcast_audio: <Users className="h-4 w-4" />,
  pk_arena: <Swords className="h-4 w-4" />,
  beauty_glow: <Sparkles className="h-4 w-4" />,
  brand_drop: <ShoppingBag className="h-4 w-4" />,
  vip_private: <Lock className="h-4 w-4" />,
};

export const StudioPresetsConsole: React.FC<StudioPresetsConsoleProps> = ({
  onOpenLogin,
  onEnterStream,
  onOpenCamera,
}) => {
  const {
    session,
    authFetch,
    refreshStreams,
    sendWsEvent,
    pushToast,
    activeStudioPresetId,
    applyStudioPreset,
    studioOverlayCaption,
  } = useApp();

  const initialPreset =
    STUDIO_PRESETS.find((p) => p.id === activeStudioPresetId) || STUDIO_PRESETS[0];

  const [selectedId, setSelectedId] = useState<string>(initialPreset.id);
  const preset: StudioPresetSpec =
    STUDIO_PRESETS.find((p) => p.id === selectedId) || STUDIO_PRESETS[0];

  // Editable Console State synced 1:1 with the tapped preset
  const [title, setTitle] = useState(preset.liveRoom.defaultTitle);
  const [caption, setCaption] = useState(studioOverlayCaption || preset.camera.lowerThirdDefault);
  const [resolution, setResolution] = useState<ResolutionOption>(preset.camera.resolution);
  const [fps, setFps] = useState<30 | 60>(preset.camera.fps);
  const [aspect, setAspect] = useState<AspectRatioId>(preset.camera.aspect);
  const [filterId, setFilterId] = useState<string>(preset.camera.filterId);
  const [arOverlay, setArOverlay] = useState<ArOverlayId>(preset.camera.arOverlay);
  const [screenSharePip, setScreenSharePip] = useState<boolean>(preset.camera.screenSharePip);
  const [ancEnabled, setAncEnabled] = useState<boolean>(preset.hardware.ancEnabled);
  const [bncEnabled, setBncEnabled] = useState<boolean>(preset.hardware.bncEnabled);
  const [maxSeats, setMaxSeats] = useState<number>(preset.liveRoom.maxSeats);
  const [gameType, setGameType] = useState<GameType | ''>(preset.liveRoom.gameType);
  const [stageLayout, setStageLayout] = useState<LiveStageLayout>(preset.liveRoom.stageLayout);
  const [slowModeSec, setSlowModeSec] = useState<number>(preset.liveRoom.slowModeSec);
  const [roomPin, setRoomPin] = useState<string>(
    preset.liveRoom.suggestPin ? String(Math.floor(100000 + Math.random() * 900000)) : ''
  );
  const [consentChecked, setConsentChecked] = useState<boolean>(false);
  const [launching, setLaunching] = useState<boolean>(false);
  const [pinCopied, setPinCopied] = useState<boolean>(false);

  const loadPresetIntoConsole = (p: StudioPresetSpec) => {
    setSelectedId(p.id);
    setTitle(p.liveRoom.defaultTitle);
    setCaption(p.camera.lowerThirdDefault);
    setResolution(p.camera.resolution);
    setFps(p.camera.fps);
    setAspect(p.camera.aspect);
    setFilterId(p.camera.filterId);
    setArOverlay(p.camera.arOverlay);
    setScreenSharePip(p.camera.screenSharePip);
    setAncEnabled(p.hardware.ancEnabled);
    setBncEnabled(p.hardware.bncEnabled);
    setMaxSeats(p.liveRoom.maxSeats);
    setGameType(p.liveRoom.gameType);
    setStageLayout(p.liveRoom.stageLayout);
    setSlowModeSec(p.liveRoom.slowModeSec);
    setRoomPin(p.liveRoom.suggestPin ? String(Math.floor(100000 + Math.random() * 900000)) : '');
    setPinCopied(false);

    // Immediately stage preset into AppContext so Camera Studio stays synced
    applyStudioPreset(p.id, {
      resolution: p.camera.resolution,
      fps: p.camera.fps,
      aspect: p.camera.aspect,
      filterId: p.camera.filterId,
      ancEnabled: p.hardware.ancEnabled,
      bncEnabled: p.hardware.bncEnabled,
      screenSharePip: p.camera.screenSharePip,
      arOverlay: p.camera.arOverlay,
      caption: p.camera.lowerThirdDefault,
    });
  };

  useEffect(() => {
    if (!activeStudioPresetId) {
      applyStudioPreset(preset.id, {
        resolution: preset.camera.resolution,
        fps: preset.camera.fps,
        aspect: preset.camera.aspect,
        filterId: preset.camera.filterId,
        ancEnabled: preset.hardware.ancEnabled,
        bncEnabled: preset.hardware.bncEnabled,
        screenSharePip: preset.camera.screenSharePip,
        arOverlay: preset.camera.arOverlay,
        caption: preset.camera.lowerThirdDefault,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncOverridesToContext = () => {
    applyStudioPreset(preset.id, {
      resolution,
      fps,
      aspect,
      filterId,
      ancEnabled,
      bncEnabled,
      screenSharePip,
      arOverlay,
      caption,
      pin: roomPin.trim(),
    });
  };

  const handleOpenConfiguredCamera = () => {
    syncOverridesToContext();
    pushToast(`Loaded "${preset.name}" into Camera Studio (${resolution.toUpperCase()} · ${aspect}).`, 'success');
    onOpenCamera();
  };

  const handleGoLiveWithPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      pushToast('Sign in as Host, Band, or use Test Mode to launch a live broadcast.', 'info');
      onOpenLogin();
      return;
    }
    if (session.role !== 'host' && session.role !== 'band' && session.role !== 'staff') {
      pushToast('Switch to a Host or Band account (or Test Mode Host) to broadcast live.', 'error');
      return;
    }
    if (!consentChecked) {
      pushToast('Confirm the 18+ & Safety Broadcast Consent checkbox before going live.', 'error');
      return;
    }
    if (roomPin.trim() && !/^\d{6}$/.test(roomPin.trim())) {
      pushToast('Room PIN must be exactly 6 digits (or leave blank for public room).', 'error');
      return;
    }

    syncOverridesToContext();
    setLaunching(true);
    try {
      const res = await authFetch('/api/streams', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || preset.liveRoom.defaultTitle,
          category: preset.liveRoom.category,
          maxSeats,
          gameType: gameType || undefined,
          stageLayout: gameType ? stageLayout : 'video',
          pin: roomPin.trim() || undefined,
          consentVerified: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.stream) {
        pushToast(data.error || 'Could not launch broadcast.', 'error');
        return;
      }
      await refreshStreams();
      if (slowModeSec > 0) {
        sendWsEvent('room:slow_mode', { roomId: data.stream.id, seconds: slowModeSec });
      }
      if (preset.liveRoom.enablePkReady && !data.stream.pk?.active) {
        sendWsEvent('room:pk_toggle', { roomId: data.stream.id });
      }
      pushToast(`"${preset.name}" is now LIVE!`, 'success');
      onEnterStream(data.stream);
    } catch {
      pushToast('Network error launching broadcast.', 'error');
    } finally {
      setLaunching(false);
    }
  };

  const generatePin = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setRoomPin(code);
    setPinCopied(false);
  };

  const copyPin = () => {
    if (!roomPin) return;
    navigator.clipboard?.writeText(roomPin).catch(() => {});
    setPinCopied(true);
    pushToast(`Copied 6-digit Room PIN (${roomPin}).`, 'success');
    setTimeout(() => setPinCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header & Quick Tap Instruction */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--fg-primary)]">
            One-Tap Broadcast Presets & Dedicated Live Console
          </h2>
          <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">
            Tap any preset to auto-configure Camera optics, Audio ANC/BNC, Face Studio, AR overlays, and Live Room seats in one step.
          </p>
        </div>
        <span className="text-[11px] font-mono-nums text-[var(--fg-muted)]">
          8 Studio Profiles · Synced with Camera & Live Room
        </span>
      </div>

      {/* 8 One-Tap Studio Preset Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STUDIO_PRESETS.map((item) => {
          const isActive = item.id === preset.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => loadPresetIntoConsole(item)}
              className={`group rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
                isActive
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--fg-muted)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isActive
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--fg-primary)]'
                  }`}
                >
                  {PRESET_ICONS[item.id] || <SlidersHorizontal className="h-4 w-4" />}
                </span>
                <span className="text-[11px] font-mono-nums font-semibold text-[var(--fg-muted)]">
                  {item.badge}
                </span>
              </div>
              <div className="mt-3 font-display text-sm font-bold text-[var(--fg-primary)]">
                {item.name}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--fg-secondary)]">
                {item.tagline}
              </p>
              <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono-nums text-[var(--fg-muted)]">
                <span>
                  {item.camera.aspect} · {item.liveRoom.maxSeats} seats
                </span>
                {isActive && (
                  <span className="font-semibold text-[var(--accent-primary)]">Console Active</span>
                )}
              </div>
            </button>
          );
        })}
      </section>

      {/* Dedicated Tailored Console for Selected Preset */}
      <form
        onSubmit={handleGoLiveWithPreset}
        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden"
      >
        {/* Console Title Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-5 py-4 bg-[var(--bg-elevated)]/40">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)]">
              {PRESET_ICONS[preset.id]}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-bold text-[var(--fg-primary)]">
                  {preset.name} Console
                </h3>
                <span className="text-[11px] font-mono-nums text-[var(--fg-muted)]">
                  {resolution.toUpperCase()} · {fps}fps · {aspect} · {maxSeats} seats
                </span>
              </div>
              <p className="text-xs text-[var(--fg-secondary)] truncate">
                Best for: {preset.bestFor}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadPresetIntoConsole(preset)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Preset</span>
          </button>
        </div>

        {/* Preset Active Bindings Strip (Unboxed inline telemetry) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--border-hairline)] px-5 py-2.5 text-[11px] text-[var(--fg-secondary)]">
          {preset.consoleHighlights.map((highlight, idx) => (
            <span key={highlight} className="inline-flex items-center gap-1.5">
              {idx > 0 && <span className="text-[var(--border-hairline)]">·</span>}
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>{highlight}</span>
            </span>
          ))}
        </div>

        {/* Main 3-Column Console Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-hairline)]">
          {/* Column 1: Camera & Visual Stage */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              <Camera className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>Camera & Visual Engine</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Resolution</span>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as ResolutionOption)}
                  className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--fg-primary)]"
                >
                  <option value="480p">480p Saver</option>
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="4K">4K Ultra HD</option>
                  <option value="8K">8K Master</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Frame Rate</span>
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value) === 60 ? 60 : 30)}
                  className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--fg-primary)]"
                >
                  <option value={30}>30 FPS Cinema</option>
                  <option value={60}>60 FPS Smooth</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Aspect Format</span>
                <select
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value as AspectRatioId)}
                  className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--fg-primary)]"
                >
                  {ASPECT_RATIOS.map((ar) => (
                    <option key={ar.id} value={ar.id}>
                      {ar.label}{ar.socialTag ? ` · ${ar.socialTag}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Color Look</span>
                <select
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--fg-primary)]"
                >
                  {CAMERA_FILTERS.slice(0, 24).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Live AR Layer</span>
                <select
                  value={arOverlay}
                  onChange={(e) => setArOverlay(e.target.value as ArOverlayId)}
                  className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--fg-primary)]"
                >
                  <option value="none">Clean Feed (None)</option>
                  <option value="studio_frame">Broadcast Frame</option>
                  <option value="neon_corner">Arena HUD Corners</option>
                  <option value="snow">Soft Snow Glow</option>
                  <option value="confetti">Live Confetti FX</option>
                </select>
              </label>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Source Layout</span>
                <button
                  type="button"
                  onClick={() => setScreenSharePip((v) => !v)}
                  className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                    screenSharePip
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)]'
                  }`}
                >
                  <Tv className="h-3.5 w-3.5" />
                  <span>{screenSharePip ? 'Screen + Face PiP' : 'Camera Only'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Audio, Gimbal & On-Screen Cue */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              <Mic className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>Audio, Gimbal & Lower-Third</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAncEnabled((v) => !v)}
                className={`h-9 rounded-lg border px-3 text-xs font-medium text-left flex items-center justify-between cursor-pointer ${
                  ancEnabled
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)]'
                }`}
              >
                <span>Active ANC</span>
                <span className="font-mono-nums text-[10px] font-bold">{ancEnabled ? 'ON' : 'RAW'}</span>
              </button>

              <button
                type="button"
                onClick={() => setBncEnabled((v) => !v)}
                className={`h-9 rounded-lg border px-3 text-xs font-medium text-left flex items-center justify-between cursor-pointer ${
                  bncEnabled
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)]'
                }`}
              >
                <span>Bg Noise Gate</span>
                <span className="font-mono-nums text-[10px] font-bold">{bncEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono-nums text-[var(--fg-muted)]">
              <span>Mic: {preset.hardware.micSource.toUpperCase()}</span>
              <span>·</span>
              <span>Gimbal: {preset.hardware.gimbalMode.replace('_', ' ').toUpperCase()}</span>
              <span>·</span>
              <span>Flash: {preset.hardware.flashMode.toUpperCase()}</span>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
                On-Screen Lower-Third Caption (Drawn live in Camera)
              </span>
              <input
                type="text"
                maxLength={80}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Type an on-screen topic or callout..."
                className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </label>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
                  Optional 6-Digit Room PIN Lock
                </span>
                <button
                  type="button"
                  onClick={generatePin}
                  className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                >
                  Auto-Generate
                </button>
              </div>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--fg-muted)]" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={roomPin}
                    onChange={(e) => setRoomPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Public (leave blank)"
                    className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-8 pr-2.5 text-xs font-mono-nums text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>
                {roomPin && (
                  <button
                    type="button"
                    onClick={copyPin}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                  >
                    {pinCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Live Room Launch & Consent */}
          <div className="p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                <Radio className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>Live Room Setup</span>
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Broadcast Title</span>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={90}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Seats</span>
                  <select
                    value={maxSeats}
                    onChange={(e) => setMaxSeats(Number(e.target.value))}
                    className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-xs font-mono-nums text-[var(--fg-primary)]"
                  >
                    {[2, 4, 6, 8, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} Seats
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Live Game</span>
                  <select
                    value={gameType}
                    onChange={(e) => {
                      const nextGame = e.target.value as GameType | '';
                      setGameType(nextGame);
                      if (nextGame && stageLayout === 'video') {
                        setStageLayout('game_pip');
                      } else if (!nextGame) {
                        setStageLayout('video');
                      }
                    }}
                    className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-xs text-[var(--fg-primary)]"
                  >
                    <option value="">None</option>
                    <option value="fps">ST Strike 3D</option>
                    <option value="rpg">Realm RPG</option>
                    <option value="ludo">Ludo</option>
                    <option value="snakes">Snakes</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--fg-secondary)]">Slow Mode</span>
                  <select
                    value={slowModeSec}
                    onChange={(e) => setSlowModeSec(Number(e.target.value))}
                    className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 text-xs font-mono-nums text-[var(--fg-primary)]"
                  >
                    <option value={0}>Off</option>
                    <option value={3}>3s</option>
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                  </select>
                </label>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
                  Live Stage Mode (Camera + Game Layout)
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {([
                    ['video', 'Stream'],
                    ['game_pip', 'Game+Cam'],
                    ['split', '50/50'],
                    ['game', 'Full Game'],
                  ] as const).map(([layoutId, label]) => (
                    <button
                      key={layoutId}
                      type="button"
                      onClick={() => {
                        setStageLayout(layoutId);
                        if (layoutId !== 'video' && !gameType) {
                          setGameType('fps');
                        }
                      }}
                      className={`h-8 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                        stageLayout === layoutId
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 text-[11px] text-[var(--fg-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent-primary)] shrink-0"
                />
                <span>
                  <strong className="text-[var(--fg-primary)]">18+ & Safety Consent:</strong> I confirm all participants consent to live broadcast and follow community guidelines.
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleOpenConfiguredCamera}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
              >
                <Camera className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>Open Camera</span>
              </button>

              <button
                type="submit"
                disabled={launching}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{launching ? 'Starting...' : 'Go Live Now'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

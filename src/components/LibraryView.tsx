import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  Film,
  Gift,
  Image as ImageIcon,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CapturedAsset } from '../types';

interface LibraryViewProps {
  onOpenCamera: () => void;
}

const DARKROOM_LUTS = [
  { id: 'none', name: 'Original', filter: '' },
  { id: 'cine', name: 'Cinema', filter: 'contrast(1.14) saturate(1.12) sepia(0.08)' },
  { id: 'bw', name: 'Noir B&W', filter: 'grayscale(1) contrast(1.25)' },
  { id: 'vintage', name: 'Vintage 88', filter: 'sepia(0.32) contrast(1.06) brightness(1.02)' },
  { id: 'fair', name: 'Fair Glow', filter: 'brightness(1.12) contrast(0.97) saturate(1.06)' },
  { id: 'vivid', name: 'Vivid Pop', filter: 'saturate(1.32) contrast(1.08)' },
];

export const LibraryView: React.FC<LibraryViewProps> = ({ onOpenCamera }) => {
  const {
    mediaLibrary,
    addMediaAsset,
    removeMediaAsset,
    checkedInToday,
    bonusTokens,
    claimDailyCheckIn,
    pushToast,
  } = useApp();

  const [category, setCategory] = useState<'all' | 'photo' | 'video'>('all');
  const [editingAsset, setEditingAsset] = useState<CapturedAsset | null>(null);

  // Darkroom canvas editor state (G-053)
  const [lutId, setLutId] = useState<string>('none');
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [polaroidFrame, setPolaroidFrame] = useState<boolean>(false);
  const [polaroidCaption, setPolaroidCaption] = useState<string>('StreamLive Studio');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const filtered = mediaLibrary.filter((item) =>
    category === 'all' ? true : item.type === category
  );

  const openDarkroom = (asset: CapturedAsset) => {
    setEditingAsset(asset);
    setLutId('none');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setPolaroidFrame(false);
    setPolaroidCaption(asset.label.slice(0, 36));
  };

  useEffect(() => {
    if (!editingAsset || editingAsset.type !== 'photo') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const pad = polaroidFrame ? 36 : 0;
      const bottomPad = polaroidFrame ? 96 : 0;
      const maxW = 960;
      const scale = Math.min(1, maxW / Math.max(1, img.width));
      const drawW = Math.round(img.width * scale);
      const drawH = Math.round(img.height * scale);

      canvas.width = drawW + pad * 2;
      canvas.height = drawH + pad + bottomPad;

      ctx.fillStyle = polaroidFrame ? '#fafaf9' : '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const lutFilter = DARKROOM_LUTS.find((l) => l.id === lutId)?.filter || '';
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) ${lutFilter}`.trim();
      ctx.drawImage(img, pad, pad, drawW, drawH);
      ctx.filter = 'none';

      if (polaroidFrame) {
        ctx.fillStyle = '#18181b';
        ctx.font = '600 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(polaroidCaption || 'StreamLive Studio', canvas.width / 2, drawH + pad + 56);
      }
    };
    img.src = editingAsset.url;
  }, [editingAsset, lutId, brightness, contrast, saturation, polaroidFrame, polaroidCaption]);

  const handleSaveDarkroomCopy = () => {
    if (!canvasRef.current || !editingAsset) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.92);
    addMediaAsset({
      id: `dr-${Date.now()}`,
      type: 'photo',
      url: dataUrl,
      label: `${polaroidFrame ? 'Polaroid · ' : 'Darkroom · '}${editingAsset.label}`,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    pushToast('Saved Darkroom edit to Studio Library.', 'success');
    setEditingAsset(null);
  };

  const storagePct = Math.min(100, Math.round((mediaLibrary.length / 24) * 100));

  return (
    <main className="sl-fluid-page pt-6 pb-28 md:pb-16 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--fg-primary)]">
            Studio Library & Darkroom
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-secondary)]">
            Review captures, grade photos in the built-in Darkroom, export Polaroid frames, and manage your 24-slot reel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={claimDailyCheckIn}
            disabled={checkedInToday}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition-colors cursor-pointer ${
              checkedInToday
                ? 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] cursor-default'
                : 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/25'
            }`}
          >
            <Gift className="h-4 w-4" />
            <span>
              {checkedInToday
                ? `Checked In (${bonusTokens} Tokens)`
                : 'Daily Check-In (+500 Coins & +20 Tokens)'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenCamera}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            <span>Open Camera Studio</span>
          </button>
        </div>
      </div>

      {/* Category Filter Bar + 24-Item Storage Meter (G-053) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-elevated)] p-1">
          {([
            ['all', `All (${mediaLibrary.length})`],
            ['photo', `Photos (${mediaLibrary.filter((a) => a.type === 'photo').length})`],
            ['video', `Videos (${mediaLibrary.filter((a) => a.type === 'video').length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`h-8 rounded-lg px-3 text-xs font-medium cursor-pointer ${
                category === key
                  ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] font-semibold shadow-xs'
                  : 'text-[var(--fg-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--fg-secondary)]">
          <span className="font-mono-nums">
            Reel Capacity: <strong className="text-[var(--fg-primary)]">{mediaLibrary.length} / 24</strong>
          </span>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div
              className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
              style={{ width: `${storagePct}%` }}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <section className="mx-auto max-w-lg rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-10 text-center space-y-4">
          <Film className="mx-auto h-9 w-9 text-[var(--accent-secondary)]" />
          <h2 className="font-display text-lg font-bold text-[var(--fg-primary)]">
            {mediaLibrary.length === 0 ? 'Your Studio Reel Is Empty' : 'No Media in This Category'}
          </h2>
          <p className="text-sm text-[var(--fg-secondary)]">
            Shoot a color-graded photo, 5x burst, 20s Quick Clip, or Dual-PiP video in the Camera Studio and it will appear here for Darkroom editing.
          </p>
          <button
            type="button"
            onClick={onOpenCamera}
            className="h-10 rounded-xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
          >
            Launch Camera Studio
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1920px]:grid-cols-5 min-[2480px]:grid-cols-6 gap-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden"
            >
              <div className="aspect-video w-full bg-black overflow-hidden">
                {item.type === 'photo' ? (
                  <img
                    src={item.url}
                    alt={item.label}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video src={item.url} controls className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--fg-primary)]">
                    {item.label}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs font-mono-nums text-[var(--fg-muted)]">
                    {item.type === 'video' ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    <span>{item.createdAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.type === 'photo' && (
                    <button
                      type="button"
                      onClick={() => openDarkroom(item)}
                      aria-label="Open Darkroom Editor"
                      title="Darkroom & Polaroid Editor"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <a
                    href={item.url}
                    download={`streamlive-${item.id}.${item.type === 'photo' ? 'jpg' : 'webm'}`}
                    aria-label="Download"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--fg-primary)] hover:border-[var(--accent-secondary)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeMediaAsset(item.id)}
                    aria-label="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Darkroom & Polaroid Export Modal (G-053) */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
                <h2 className="font-display text-sm font-bold text-[var(--fg-primary)]">
                  Studio Darkroom & Polaroid Export
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5">
              <div className="md:col-span-3 flex items-center justify-center bg-black p-4">
                <canvas
                  ref={canvasRef}
                  className="max-h-[55vh] max-w-full rounded-lg object-contain"
                />
              </div>

              <div className="md:col-span-2 p-4 space-y-4 border-t md:border-t-0 md:border-l border-[var(--border-hairline)]">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                    Color LUT
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {DARKROOM_LUTS.map((lut) => (
                      <button
                        key={lut.id}
                        type="button"
                        onClick={() => setLutId(lut.id)}
                        className={`h-8 rounded-lg border text-xs font-medium cursor-pointer ${
                          lutId === lut.id
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)]'
                        }`}
                      >
                        {lut.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-[11px] text-[var(--fg-secondary)]">
                    <div className="flex justify-between font-mono-nums">
                      <span>Brightness</span>
                      <span>{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={145}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </label>
                  <label className="block text-[11px] text-[var(--fg-secondary)]">
                    <div className="flex justify-between font-mono-nums">
                      <span>Contrast</span>
                      <span>{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={150}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </label>
                  <label className="block text-[11px] text-[var(--fg-secondary)]">
                    <div className="flex justify-between font-mono-nums">
                      <span>Saturation</span>
                      <span>{saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={160}
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </label>
                </div>

                <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-[var(--fg-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={polaroidFrame}
                      onChange={(e) => setPolaroidFrame(e.target.checked)}
                      className="h-4 w-4 accent-[var(--accent-primary)]"
                    />
                    <span>Polaroid Instant Frame</span>
                  </label>
                  {polaroidFrame && (
                    <input
                      type="text"
                      maxLength={36}
                      value={polaroidCaption}
                      onChange={(e) => setPolaroidCaption(e.target.value)}
                      placeholder="Polaroid caption..."
                      className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--fg-primary)]"
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveDarkroomCopy}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Save Copy to Library</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

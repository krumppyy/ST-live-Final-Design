import React from 'react';
import { Camera, Download, Film, Gift, Trash2, Video } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LibraryViewProps {
  onOpenCamera: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onOpenCamera }) => {
  const { mediaLibrary, removeMediaAsset, checkedInToday, bonusTokens, claimDailyCheckIn } = useApp();

  return (
    <main className="sl-fluid-page pt-6 pb-28 md:pb-16 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--fg-primary)]">
            Studio Library
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-secondary)]">
            All graded photos, 5x burst sets, batch aspect snapshots, and recorded clips captured in your standalone Camera Studio.
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

      {mediaLibrary.length === 0 ? (
        <section className="mx-auto max-w-lg rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-10 text-center space-y-4">
          <Film className="mx-auto h-9 w-9 text-[var(--accent-secondary)]" />
          <h2 className="font-display text-lg font-bold text-[var(--fg-primary)]">
            Your Studio Reel Is Empty
          </h2>
          <p className="text-sm text-[var(--fg-secondary)]">
            Shoot a color-graded photo, 5x burst, 3-ratio batch set, or Dual-PiP video in the Camera Studio and it will automatically appear here.
          </p>
          <button
            type="button"
            onClick={onOpenCamera}
            className="h-10 rounded-xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
          >
            Launch 7-Stage Camera
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1920px]:grid-cols-5 min-[2480px]:grid-cols-6 gap-4">
          {mediaLibrary.map((item) => (
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
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--fg-primary)]">
                    {item.label}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs font-mono-nums text-[var(--fg-muted)]">
                    {item.type === 'video' ? <Video className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                    <span>{item.createdAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={item.url}
                    download={`streamlive-${item.id}.${item.type === 'photo' ? 'jpg' : 'webm'}`}
                    aria-label="Download"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--fg-primary)] hover:border-[var(--accent-secondary)]"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeMediaAsset(item.id)}
                    aria-label="Delete"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

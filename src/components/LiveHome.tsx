import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Flame,
  Globe,
  Grid2X2,
  PanelRight,
  Play,
  Radio,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Livestream, StreamCategory } from '../types';

interface LiveHomeProps {
  onSelectStream: (stream: Livestream) => void;
}

export const LiveHome: React.FC<LiveHomeProps> = ({ onSelectStream }) => {
  const { streams, t } = useApp();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState<StreamCategory>('all');
  const [regionLang, setRegionLang] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'viewers' | 'seats'>('viewers');
  const [multiView, setMultiView] = useState(false);
  const [showWideRail, setShowWideRail] = useState(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const categories: Array<{ id: StreamCategory; label: string }> = [
    { id: 'all', label: t('catAll') },
    { id: 'solo', label: t('catSolo') },
    { id: 'multi_guest', label: t('catMultiGuest') },
    { id: 'audio', label: t('catAudio') },
    { id: 'pk', label: t('catPK') },
    { id: 'games', label: t('catGames') },
    { id: 'music_band', label: t('catMusicBand') },
    { id: 'gaming', label: t('catGaming') },
    { id: 'brand_drop', label: t('catBrandDrop') },
  ];

  const categoryLabels: Record<Exclude<StreamCategory, 'all'>, string> = {
    solo: t('catSolo'),
    multi_guest: t('catMultiGuest'),
    audio: t('catAudio'),
    pk: t('catPK'),
    games: t('catGames'),
    music_band: t('catMusicBand'),
    gaming: t('catGaming'),
    brand_drop: t('catBrandDrop'),
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = streams.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (regionLang !== 'all' && s.language.toLowerCase() !== regionLang.toLowerCase()) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.hostName.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) =>
      sortBy === 'viewers' ? b.viewerCount - a.viewerCount : b.maxSeats - a.maxSeats
    );
  }, [streams, category, regionLang, query, sortBy]);

  const topTrending = useMemo(
    () => [...streams].sort((a, b) => b.viewerCount - a.viewerCount),
    [streams]
  );

  const spotlightStream = filtered[0] ?? topTrending[0] ?? null;

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<Exclude<StreamCategory, 'all'>, number>> = {};
    for (const s of streams) {
      counts[s.category] = (counts[s.category] ?? 0) + 1;
    }
    return counts;
  }, [streams]);

  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

  const toggleSearch = () => {
    setSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => searchInputRef.current?.focus());
      } else {
        setQuery('');
      }
      return next;
    });
  };

  return (
    <main className="mx-auto w-full max-w-[1640px] px-3 sm:px-5 lg:px-7 xl:px-8 pt-4 pb-28 md:pb-16 px-safe-curved">
      {/* Compact Category Strip: Icon-Only Search Tab directly BEFORE All Live */}
      <section className="space-y-3 border-b border-[var(--border-hairline)] pb-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0">
            {/* Search Tab BEFORE All Live — Icon Only (No Words) */}
            <button
              type="button"
              onClick={toggleSearch}
              aria-label="Search"
              aria-expanded={searchOpen}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border shrink-0 transition-colors cursor-pointer ${
                searchOpen || query
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
              }`}
            >
              <Search className="h-4.5 w-4.5" />
            </button>

            {categories.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`h-10 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                      : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-primary)]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Explore-All Region / Language Selector */}
            <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--fg-primary)]">
              <Globe className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
              <select
                value={regionLang}
                onChange={(e) => {
                  setRegionLang(e.target.value);
                  setQuery('');
                }}
                aria-label="Filter by region language"
                className="bg-transparent text-xs font-medium text-[var(--fg-primary)] focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[var(--bg-surface)]">Explore All</option>
                <option value="English" className="bg-[var(--bg-surface)]">English</option>
                <option value="Hindi" className="bg-[var(--bg-surface)]">Hindi</option>
                <option value="Spanish" className="bg-[var(--bg-surface)]">Spanish</option>
                <option value="Arabic" className="bg-[var(--bg-surface)]">Arabic</option>
                <option value="Japanese" className="bg-[var(--bg-surface)]">Japanese</option>
              </select>
            </label>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortBy((s) => (s === 'viewers' ? 'seats' : 'viewers'))}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
              <span>{sortBy === 'viewers' ? 'Popular' : 'Seats'}</span>
            </button>

            {/* Multi-View (2x2 Split Watch) Toggle */}
            <button
              type="button"
              onClick={() => setMultiView((m) => !m)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                multiView
                  ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
              }`}
            >
              <Grid2X2 className="h-3.5 w-3.5" />
              <span>Multi-View</span>
            </button>

            {/* Widescreen Sidebar Toggle (xl+ monitors only) */}
            <button
              type="button"
              onClick={() => setShowWideRail((v) => !v)}
              aria-label="Toggle discovery sidebar"
              title={showWideRail ? 'Hide discovery panel' : 'Show discovery panel'}
              className={`hidden xl:inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer ${
                showWideRail
                  ? 'border-[var(--accent-primary)]/60 bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
              }`}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Clean Expandable Search Bar (Appears when Search Icon Tab is tapped) */}
        {searchOpen && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label="Search livestreams"
              className="w-full h-11 rounded-xl border border-[var(--accent-primary)]/70 bg-[var(--bg-surface)] pl-10 pr-10 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (query) setQuery('');
                else setSearchOpen(false);
              }}
              aria-label="Close search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {/* Main Content + Widescreen Discovery Rail (xl+) */}
      <div className="mt-4 flex items-start gap-5 xl:gap-6">
        <section className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <div className="mx-auto max-w-md rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-10 text-center space-y-4">
              <Radio className="mx-auto h-7 w-7 text-[var(--fg-muted)]" />
              <p className="text-sm text-[var(--fg-secondary)]">{t('noStreams')}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                  setRegionLang('all');
                }}
                className="h-10 rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-medium text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] transition-colors cursor-pointer"
              >
                {t('clearFilters')}
              </button>
            </div>
          ) : multiView ? (
            /* 2x2 Multi-View Wall */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--fg-secondary)]">
                <span>Multi-View</span>
                <span className="font-mono-nums text-[var(--accent-secondary)]">
                  {Math.min(4, filtered.length)} feeds
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {filtered.slice(0, 4).map((stream) => (
                  <article
                    key={stream.id}
                    onClick={() => onSelectStream(stream)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectStream(stream);
                      }
                    }}
                    className="group relative aspect-video overflow-hidden rounded-2xl border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] bg-black cursor-pointer transition-colors"
                  >
                    <img
                      src={stream.thumbnail}
                      alt={stream.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
                    <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2 text-white">
                      <div className="min-w-0">
                        <h2 className="font-display text-xs sm:text-sm font-bold truncate">
                          {stream.title}
                        </h2>
                        <div className="text-[11px] text-white/75 truncate">
                          {stream.hostName}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono-nums text-[11px] font-semibold text-[var(--accent-secondary)]">
                        {formatCount(stream.viewerCount)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            /* 2-in-a-row on mobile/tablet, 4-in-a-row with smaller thumbnails on desktop */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-3">
              {filtered.map((stream) => (
                <article
                  key={stream.id}
                  onClick={() => onSelectStream(stream)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectStream(stream);
                    }
                  }}
                  className="group relative aspect-[4/5] sm:aspect-[4/3] lg:aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-2xl lg:rounded-xl border border-[var(--border-hairline)] bg-black transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-primary)] focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
                >
                  {!failedImages[stream.id] ? (
                    <img
                      src={stream.thumbnail}
                      alt={stream.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [stream.id]: true }))
                      }
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-800 to-neutral-950 p-4 text-center text-white">
                      <Radio className="h-7 w-7 lg:h-5 lg:w-5 text-[var(--accent-primary)]" />
                      <span className="text-xs lg:text-[11px] font-medium opacity-80">{stream.hostName}</span>
                    </div>
                  )}

                  {/* Top Scrim: Minimal LIVE + Viewers + Seats */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 lg:h-11 bg-gradient-to-b from-black/75 via-black/25 to-transparent" />
                  <div className="absolute inset-x-2.5 sm:inset-x-3.5 lg:inset-x-2 top-2.5 sm:top-3 lg:top-2 flex items-center justify-between gap-1.5 text-[11px] sm:text-xs lg:text-[10px] font-medium text-white">
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 lg:px-1.5 font-mono-nums">
                      <span className="font-bold text-[var(--accent-primary)]">LIVE</span>
                      <span>{formatCount(stream.viewerCount)}</span>
                    </span>
                    <span className="rounded-md bg-black/55 px-2 py-0.5 lg:px-1.5 font-mono-nums text-[var(--accent-secondary)]">
                      {stream.maxSeats} {t('seats')}
                    </span>
                  </div>

                  {/* Bottom Contrast Scrim: Host + Title + Category */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 lg:h-18 bg-gradient-to-t from-black/92 via-black/50 to-transparent" />
                  <div className="absolute inset-x-2.5 sm:inset-x-3.5 lg:inset-x-2 bottom-2.5 sm:bottom-3.5 lg:bottom-2 space-y-0.5 text-white">
                    <h2 className="font-display text-xs sm:text-base lg:text-xs font-bold leading-snug line-clamp-1">
                      {stream.title}
                    </h2>
                    <div className="flex items-center justify-between gap-1.5 text-[11px] sm:text-xs lg:text-[10px] text-white/80">
                      <span className="truncate font-medium">{stream.hostName}</span>
                      <span className="shrink-0 text-white/70 hidden sm:inline">
                        {categoryLabels[stream.category]}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Widescreen Live Discovery Rail (Only visible on xl+ wide monitors) */}
        {showWideRail && (
          <aside
            aria-label="Live Discovery Panel"
            className="hidden xl:flex xl:w-[272px] 2xl:w-[304px] shrink-0 flex-col gap-3.5 sticky top-[68px]"
          >
            {/* 1. Featured Live Spotlight */}
            {spotlightStream && (
              <div className="overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-hairline)]">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-secondary)]">
                    <Flame className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    Live Spotlight
                  </span>
                  <span className="font-mono-nums text-[11px] font-semibold text-[var(--accent-secondary)]">
                    {formatCount(spotlightStream.viewerCount)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectStream(spotlightStream)}
                  className="group relative block w-full aspect-video bg-black text-left overflow-hidden cursor-pointer"
                >
                  {!failedImages[spotlightStream.id] ? (
                    <img
                      src={spotlightStream.thumbnail}
                      alt={spotlightStream.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-900">
                      <Radio className="h-6 w-6 text-[var(--accent-primary)]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[var(--accent-contrast)] shadow-md transition-transform group-hover:scale-105">
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </span>
                  <div className="absolute inset-x-3 bottom-2.5 text-white">
                    <p className="font-display text-xs font-bold line-clamp-1">
                      {spotlightStream.title}
                    </p>
                    <p className="text-[11px] text-white/75 truncate">
                      {spotlightStream.hostName} · {categoryLabels[spotlightStream.category]}
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* 2. Top Live Channels */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-secondary)]">
                  Top Live Channels
                </span>
                <span className="font-mono-nums text-[10px] text-[var(--fg-muted)]">
                  {streams.length} live
                </span>
              </div>
              <div className="space-y-1.5">
                {topTrending.slice(0, 6).map((stream) => (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => onSelectStream(stream)}
                    className="group flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  >
                    <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg bg-black border border-[var(--border-hairline)]">
                      {!failedImages[stream.id] ? (
                        <img
                          src={stream.thumbnail}
                          alt={stream.hostName}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Radio className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--fg-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
                        {stream.hostName}
                      </p>
                      <p className="text-[10px] text-[var(--fg-muted)] truncate">
                        {categoryLabels[stream.category]} · {stream.language}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 shrink-0 font-mono-nums text-[11px] font-semibold text-[var(--accent-secondary)]">
                      <Users className="h-3 w-3 opacity-80" />
                      {formatCount(stream.viewerCount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Quick Room Format Breakdown */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-secondary)]">
                Browse Formats
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {categories
                  .filter((c) => c.id !== 'all')
                  .map((cat) => {
                    const count =
                      categoryCounts[cat.id as Exclude<StreamCategory, 'all'>] ?? 0;
                    const active = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(active ? 'all' : cat.id)}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/14 text-[var(--accent-primary)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]/45 text-[var(--fg-secondary)] hover:border-[var(--accent-primary)]/60 hover:text-[var(--fg-primary)]'
                        }`}
                      >
                        <span className="truncate">{cat.label}</span>
                        <span className="font-mono-nums text-[10px] opacity-80 ml-1">
                          {count}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
};


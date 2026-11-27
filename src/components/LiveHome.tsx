import React, { useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  ChevronDown,
  Flame,
  Globe,
  Grid2X2,
  Lock,
  Maximize2,
  PanelRight,
  Play,
  Radio,
  Search,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { COUNTRIES, countryFlag, getCountry } from '../lib/countries';
import type { DiscoveryFeedTab, Livestream, StreamCategory } from '../types';

interface LiveHomeProps {
  onSelectStream: (stream: Livestream) => void;
}

const DISCOVERY_TABS: Array<{ id: DiscoveryFeedTab; label: string }> = [
  { id: 'for_you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'party', label: 'Party' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'new', label: 'New' },
  { id: 'popular', label: 'Popular' },
];

export const LiveHome: React.FC<LiveHomeProps> = ({ onSelectStream }) => {
  const { streams, session, followingHostUids, t } = useApp();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedTab, setFeedTab] = useState<DiscoveryFeedTab>('for_you');
  const [category, setCategory] = useState<StreamCategory>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [multiView, setMultiView] = useState(false);
  const [multiActiveSoundId, setMultiActiveSoundId] = useState<string | null>(null);
  const [multiHiddenIds, setMultiHiddenIds] = useState<string[]>([]);
  const [pageLimit, setPageLimit] = useState<number>(24);
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

  // Count active streams per country so active countries bubble to the top of Explore All
  const countryLiveCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of streams) {
      const code = (s.countryCode || 'US').toUpperCase();
      map[code] = (map[code] || 0) + 1;
    }
    return map;
  }, [streams]);

  const sortedCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    const list = q
      ? COUNTRIES.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.region.toLowerCase().includes(q)
        )
      : COUNTRIES;
    return [...list].sort((a, b) => {
      const diff = (countryLiveCounts[b.code] || 0) - (countryLiveCounts[a.code] || 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [countrySearch, countryLiveCounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const userCountry = (session?.countryCode || 'US').toUpperCase();

    let list = streams.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (selectedCountry !== 'ALL' && (s.countryCode || 'US').toUpperCase() !== selectedCountry) {
        return false;
      }
      if (feedTab === 'following' && !followingHostUids.includes(s.hostUid)) {
        return false;
      }
      if (
        feedTab === 'party' &&
        !['multi_guest', 'audio', 'pk', 'games'].includes(s.category)
      ) {
        return false;
      }
      if (!q) return true;
      const country = getCountry(s.countryCode);
      return (
        s.title.toLowerCase().includes(q) ||
        s.hostName.toLowerCase().includes(q) ||
        s.hostUid.toLowerCase().includes(q) ||
        String(s.hostNumericId || '').includes(q.replace('#', '')) ||
        s.language.toLowerCase().includes(q) ||
        country.name.toLowerCase().includes(q) ||
        country.code.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      if (feedTab === 'new') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (feedTab === 'popular') {
        const scoreB = b.viewerCount + (b.totalGiftsCoins || 0) + (b.followerCount || 0) * 10;
        const scoreA = a.viewerCount + (a.totalGiftsCoins || 0) + (a.followerCount || 0) * 10;
        return scoreB - scoreA;
      }
      if (feedTab === 'nearby') {
        const nearB = (b.countryCode || 'US').toUpperCase() === userCountry ? 1 : 0;
        const nearA = (a.countryCode || 'US').toUpperCase() === userCountry ? 1 : 0;
        if (nearB !== nearA) return nearB - nearA;
      }
      return b.viewerCount - a.viewerCount;
    });

    return list;
  }, [streams, category, selectedCountry, feedTab, followingHostUids, session?.countryCode, query]);

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

  const activeCountryMeta = selectedCountry === 'ALL' ? null : getCountry(selectedCountry);
  const multiTiles = filtered.filter((s) => !multiHiddenIds.includes(s.id)).slice(0, 4);

  return (
    <main className="sl-fluid-page pt-3.5 pb-28 md:pb-16">
      {/* Compact 6 Discovery Tabs + Explore All Countries & Flags + Controls */}
      <section className="space-y-2.5 border-b border-[var(--border-hairline)] pb-3">
        {/* Row 1: 6 Discovery Feed Tabs + Explore All Countries w/ Flags + Multi-View */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {DISCOVERY_TABS.map((tab) => {
              const active = feedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedTab(tab.id)}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Explore All Countries & Flags Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCountryMenuOpen((o) => !o)}
                aria-expanded={countryMenuOpen}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCountry !== 'ALL'
                    ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/12 text-[var(--fg-primary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
                }`}
              >
                {activeCountryMeta ? (
                  <>
                    <span className="text-sm leading-none">{activeCountryMeta.flag}</span>
                    <span className="max-w-[90px] truncate">{activeCountryMeta.name}</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                    <span>Explore All ({COUNTRIES.length})</span>
                  </>
                )}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>

              {countryMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setCountryMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-10 z-40 w-72 sm:w-80 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-2xl space-y-2.5">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-muted)]" />
                      <input
                        type="search"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search 195+ countries or regions..."
                        className="w-full h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] pl-8 pr-3 text-xs text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountry('ALL');
                        setCountryMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                        selectedCountry === 'ALL'
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                          : 'bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)]/80'
                      }`}
                    >
                      <span>🌍 Explore All Countries</span>
                      <span className="font-mono-nums text-[10px]">{streams.length} live</span>
                    </button>
                    <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
                      {sortedCountries.map((c) => {
                        const liveCount = countryLiveCounts[c.code] || 0;
                        const active = selectedCountry === c.code;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setSelectedCountry(c.code);
                              setCountryMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                              active
                                ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-semibold'
                                : 'text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)]'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="text-base leading-none">{c.flag}</span>
                              <span className="truncate">{c.name}</span>
                            </span>
                            {liveCount > 0 ? (
                              <span className="shrink-0 rounded bg-[var(--accent-secondary)]/15 px-1.5 py-0.5 font-mono-nums text-[10px] font-bold text-[var(--accent-secondary)]">
                                {liveCount} live
                              </span>
                            ) : (
                              <span className="shrink-0 font-mono-nums text-[10px] text-[var(--fg-muted)]">
                                {c.code}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Multi-View (2x2 Split Watch) Toggle */}
            <button
              type="button"
              onClick={() => {
                setMultiView((m) => !m);
                setMultiHiddenIds([]);
              }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                multiView
                  ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
              }`}
            >
              <Grid2X2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Multi-View</span>
            </button>

            {/* Widescreen Sidebar Toggle (xl+ monitors only) */}
            <button
              type="button"
              onClick={() => setShowWideRail((v) => !v)}
              aria-label="Toggle discovery sidebar"
              title={showWideRail ? 'Hide discovery panel' : 'Show discovery panel'}
              className={`hidden xl:inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer ${
                showWideRail
                  ? 'border-[var(--accent-primary)]/60 bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
              }`}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Search Icon + Category Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={toggleSearch}
            aria-label="Search"
            aria-expanded={searchOpen}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 transition-colors cursor-pointer ${
              searchOpen || query
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          {categories.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`h-8 rounded-lg px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--bg-surface)] border border-[var(--accent-primary)] text-[var(--fg-primary)] font-semibold'
                    : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-primary)]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Clean Expandable Search Bar (Covers title / @host / #ID / country / language) */}
        {searchOpen && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search streams, @host, #ID, country, or language..."
              aria-label="Search livestreams"
              className="w-full h-10 rounded-xl border border-[var(--accent-primary)]/70 bg-[var(--bg-surface)] pl-10 pr-10 text-xs sm:text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (query) setQuery('');
                else setSearchOpen(false);
              }}
              aria-label="Close search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer"
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
              <p className="text-sm text-[var(--fg-secondary)]">
                {feedTab === 'following'
                  ? 'No followed hosts are live right now. Follow creators inside any live room!'
                  : t('noStreams')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                  setSelectedCountry('ALL');
                  setFeedTab('for_you');
                }}
                className="h-9 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] transition-colors cursor-pointer"
              >
                {t('clearFilters')}
              </button>
            </div>
          ) : multiView ? (
            /* 2x2 Multi-View Wall with Sound / Focus / Remove controls */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--fg-secondary)]">
                <span>Multi-View Split Wall (Click Sound to solo audio · Focus to enter)</span>
                <div className="flex items-center gap-2">
                  {multiHiddenIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMultiHiddenIds([])}
                      className="text-[11px] font-semibold text-[var(--accent-primary)] cursor-pointer"
                    >
                      Restore All
                    </button>
                  )}
                  <span className="font-mono-nums text-[var(--accent-secondary)]">
                    {multiTiles.length} feeds
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {multiTiles.map((stream) => {
                  const soundOn = multiActiveSoundId === stream.id;
                  return (
                    <article
                      key={stream.id}
                      className={`group relative aspect-video overflow-hidden rounded-2xl border bg-black transition-colors ${
                        soundOn
                          ? 'border-[var(--accent-secondary)] ring-1 ring-[var(--accent-secondary)]'
                          : 'border-[var(--border-hairline)] hover:border-[var(--accent-primary)]'
                      }`}
                    >
                      <img
                        src={stream.thumbnail}
                        alt={stream.title}
                        referrerPolicy="no-referrer"
                        className={`h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03] ${
                          stream.isLocked ? 'blur-md scale-105' : ''
                        }`}
                      />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2.5 bg-gradient-to-b from-black/75 to-transparent">
                        <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                          <span>{countryFlag(stream.countryCode)}</span>
                          <span className="text-[var(--accent-primary)] font-bold">LIVE</span>
                          <span className="font-mono-nums">{formatCount(stream.viewerCount)}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setMultiActiveSoundId(soundOn ? null : stream.id)}
                            title={soundOn ? 'Mute tile' : 'Solo audio'}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg cursor-pointer ${
                              soundOn
                                ? 'bg-[var(--accent-secondary)] text-black'
                                : 'bg-black/65 text-white hover:bg-black/85'
                            }`}
                          >
                            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectStream(stream)}
                            title="Focus & Enter Room"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/65 text-white hover:bg-[var(--accent-primary)] cursor-pointer"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setMultiHiddenIds((prev) => [...prev, stream.id])}
                            title="Remove tile"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/65 text-white hover:bg-rose-600 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectStream(stream)}
                        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/92 via-black/45 to-transparent px-3 pb-2.5 flex items-end justify-between text-left text-white cursor-pointer"
                      >
                        <div className="min-w-0">
                          <h2 className="font-display text-xs sm:text-sm font-bold truncate">{stream.title}</h2>
                          <div className="text-[11px] text-white/75 truncate">
                            {stream.hostName} {stream.hostNumericId ? `#${stream.hostNumericId}` : ''}
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 2-in-a-row on mobile/tablet, 4-in-a-row on desktop, auto-scaling on ultrawide */
            <div
              className={`grid grid-cols-2 gap-3 sm:gap-4 lg:gap-3 ${
                showWideRail
                  ? 'lg:grid-cols-4 min-[2048px]:grid-cols-5 min-[2560px]:grid-cols-6 min-[2960px]:grid-cols-7 min-[3360px]:grid-cols-8'
                  : 'lg:grid-cols-4 xl:grid-cols-5 min-[1920px]:grid-cols-6 min-[2480px]:grid-cols-7 min-[3000px]:grid-cols-8'
              }`}
            >
              {filtered.slice(0, pageLimit).map((stream) => {
                const filledSeats = stream.seats?.filter((s) => Boolean(s.uid)).length ?? 1;
                const isRoomFull = stream.maxSeats > 0 && filledSeats >= stream.maxSeats;
                return (
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
                      className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${
                        stream.isLocked ? 'blur-md scale-105 opacity-75' : ''
                      }`}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-800 to-neutral-950 p-4 text-center text-white">
                      <Radio className="h-7 w-7 lg:h-5 lg:w-5 text-[var(--accent-primary)]" />
                      <span className="text-xs lg:text-[11px] font-medium opacity-80">{stream.hostName}</span>
                    </div>
                  )}

                  {/* PIN-Locked Room Center Indicator */}
                  {stream.isLocked && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/75 border border-amber-400/50 px-2.5 py-1 text-[10px] font-bold text-amber-300 backdrop-blur-xs">
                        <Lock className="h-3 w-3" />
                        <span>PIN Room</span>
                      </span>
                    </div>
                  )}

                  {/* Top Scrim: LIVE + Viewers + Country Flag + Seats */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-14 lg:h-10 bg-gradient-to-b from-black/75 via-black/25 to-transparent" />
                  <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-1 text-[10px] font-medium text-white">
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 font-mono-nums">
                      <span className="font-bold text-[var(--accent-primary)]">LIVE</span>
                      <span>{formatCount(stream.viewerCount)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 font-mono-nums">
                      <span className="text-xs leading-none">{countryFlag(stream.countryCode)}</span>
                      <span className={isRoomFull ? 'text-amber-300 font-bold' : 'text-[var(--accent-secondary)]'}>
                        {isRoomFull ? 'FULL' : `${stream.maxSeats}s`}
                      </span>
                    </span>
                  </div>

                  {/* Bottom Contrast Scrim: Host + Verified + #ID + Title */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 lg:h-16 bg-gradient-to-t from-black/92 via-black/55 to-transparent" />
                  <div className="absolute inset-x-2.5 lg:inset-x-2 bottom-2 space-y-0.5 text-white">
                    <h2 className="font-display text-xs sm:text-sm lg:text-xs font-bold leading-snug line-clamp-1">
                      {stream.title}
                    </h2>
                    <div className="flex items-center justify-between gap-1 text-[10px] text-white/80">
                      <span className="flex items-center gap-1 truncate font-medium">
                        <span className="truncate">{stream.hostName}</span>
                        {stream.hostVerified && <BadgeCheck className="h-3 w-3 shrink-0 text-sky-400" />}
                      </span>
                      <span className="shrink-0 text-white/65 hidden sm:inline">
                        {categoryLabels[stream.category]}
                      </span>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
          {!multiView && filtered.length > pageLimit && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setPageLimit((n) => n + 24)}
                className="h-9 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
              >
                Load More ({filtered.length - pageLimit} remaining)
              </button>
            </div>
          )}
        </section>

        {/* Widescreen Live Discovery Rail (Only visible on xl+ wide monitors) */}
        {showWideRail && (
          <aside
            aria-label="Live Discovery Panel"
            className="hidden xl:flex xl:w-[276px] 2xl:w-[316px] min-[1840px]:w-[348px] shrink-0 flex-col gap-3.5 sticky top-[68px]"
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
                    {countryFlag(spotlightStream.countryCode)} {formatCount(spotlightStream.viewerCount)}
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
                      <p className="flex items-center gap-1 text-xs font-semibold text-[var(--fg-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
                        <span>{countryFlag(stream.countryCode)}</span>
                        <span className="truncate">{stream.hostName}</span>
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

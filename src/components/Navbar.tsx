import React from 'react';
import {
  Camera,
  Compass,
  Film,
  Gamepad2,
  LayoutGrid,
  SlidersHorizontal,
  User,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export type ActiveTab = 'live' | 'games' | 'camera' | 'library' | 'workspace';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenLogin: () => void;
  onOpenPreferences: () => void;
}

const GRADE_LABELS: Record<string, string> = {
  nova: 'Nova Dark',
  emerald: 'Emerald Forest',
  surge: 'Surge Cyber',
  ballot: 'Ballot Royal',
  onyx: 'Onyx Pro',
  ember: 'Spooky Ember',
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenLogin,
  onOpenPreferences,
}) => {
  const { session, streams, theme, grade, mediaLibrary, t } = useApp();
  const isOnline = useOnlineStatus();

  const totalLiveViewers = streams.reduce((acc, s) => acc + s.viewerCount, 0);
  const themeDisplayName = theme === 'light' ? 'Quiet Light' : GRADE_LABELS[grade] || 'Nova Dark';

  const railItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ElementType;
    count?: number;
  }> = [
    { id: 'live', label: t('navLive'), icon: Compass },
    { id: 'games', label: t('navGames'), icon: Gamepad2 },
    { id: 'camera', label: t('navCamera'), icon: Camera },
    { id: 'library', label: 'Library', icon: Film, count: mediaLibrary.length || undefined },
    { id: 'workspace', label: t('navWorkspace'), icon: LayoutGrid },
  ];

  return (
    <>
      {/* Signature StreamLive Studio Top Bar (Compact mobile/tablet sizing, punch-hole safe) */}
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border-hairline)] sl-topbar-bg backdrop-blur-md pt-safe-cutout">
        <div className="flex h-12 md:h-13 items-center justify-between gap-4 px-3 sm:px-5 px-safe-curved">
          {/* Left: Circular SL Monogram + StreamLive Wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('live')}
            className="flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-primary)]"
          >
            <span className="sl-brand-monogram flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tracking-tight text-white shadow-xs">
              SL
            </span>
            <span className="font-display text-base md:text-lg font-bold tracking-tight text-[var(--fg-primary)]">
              StreamLive
            </span>
          </button>

          {/* Center (Desktop): Quiet unboxed live studio summary */}
          <div className="hidden md:flex items-center gap-2.5 text-xs text-[var(--fg-secondary)] whitespace-nowrap">
            <span className="font-mono-nums font-semibold text-[var(--fg-primary)]">
              {totalLiveViewers.toLocaleString()} {t('viewers')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">{streams.length} rooms</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--accent-gold)] font-medium">{themeDisplayName}</span>
          </div>

          {/* Right: Compact Account / Sign In Action (+ Mobile Theme Trigger) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenPreferences}
              aria-label={t('preferences')}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {session ? (
              <button
                type="button"
                onClick={() => onSelectTab('workspace')}
                className="flex h-8 md:h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 md:px-3 text-xs md:text-sm font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer max-w-[180px]"
              >
                <User className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                <span className="truncate">{session.displayName}</span>
                <span className="hidden sm:inline font-mono-nums text-[11px] text-[var(--accent-gold)]">
                  {session.coins}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="h-8 md:h-9 rounded-lg bg-[var(--accent-primary)] px-3 md:px-3.5 text-xs md:text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Signature StreamLive Desktop Left Studio Rail (Compact 72px width) */}
      <aside
        aria-label="Studio Navigation Rail"
        className="hidden md:flex fixed left-0 top-13 bottom-0 z-30 w-[72px] flex-col items-center justify-between border-r border-[var(--accent-primary)]/60 sl-rail-bg py-3"
      >
        <nav className="flex w-full flex-col items-center gap-1.5 px-1.5">
          {railItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`group relative flex w-full flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors cursor-pointer ${
                  active
                    ? 'text-[var(--fg-primary)]'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-surface)]/70'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-150 ${
                    active
                      ? 'sl-rail-icon-active shadow-sm scale-[1.03]'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)] group-hover:border-[var(--accent-primary)]/60'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={`text-[10px] font-medium tracking-tight truncate max-w-[64px] ${
                    active ? 'font-semibold text-[var(--accent-primary)]' : ''
                  }`}
                >
                  {item.label}
                </span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute right-2 top-1.5 font-mono-nums text-[9px] font-bold text-[var(--accent-secondary)]">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Rail Trigger: Consolidated Themes, Fonts, Languages & OS Calibration */}
        <div className="w-full border-t border-[var(--border-hairline)] pt-2.5 px-1.5">
          <button
            type="button"
            onClick={onOpenPreferences}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <SlidersHorizontal className="h-4 w-4 text-[var(--accent-secondary)]" />
            </span>
            <span className="text-[9px] font-medium truncate max-w-[64px]">
              {t('preferences')}
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile & Tablet Fixed Bottom Bar (Sleek compact icons & spacing) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--accent-primary)]/45 sl-rail-bg/95 backdrop-blur-md pb-safe-bottom px-safe-curved"
      >
        <div className="grid grid-cols-5 h-12 items-center">
          {railItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active ? 'text-[var(--accent-primary)]' : 'text-[var(--fg-secondary)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9px] font-medium tracking-tight truncate max-w-[56px]">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Offline PWA Banner */}
      {!isOnline && (
        <div className="fixed bottom-16 md:bottom-4 left-3 md:left-[84px] z-50 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline Mode</span>
        </div>
      )}
    </>
  );
};

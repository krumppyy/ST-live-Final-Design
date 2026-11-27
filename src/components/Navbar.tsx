import React from 'react';
import {
  BadgeCheck,
  Camera,
  Compass,
  Film,
  FlaskConical,
  Gamepad2,
  HandCoins,
  LayoutGrid,
  MessageCircle,
  SlidersHorizontal,
  UserCircle2,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { countryFlag } from '../lib/countries';
import { getThemePreset } from '../lib/themes';

export type ActiveTab = 'live' | 'games' | 'camera' | 'library' | 'inbox' | 'workspace' | 'me';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenLogin: () => void;
  onOpenTestMode: () => void;
  onOpenFreeToEarn?: () => void;
  onOpenPreferences: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenLogin,
  onOpenTestMode,
  onOpenFreeToEarn,
  onOpenPreferences,
}) => {
  const { session, streams, grade, mediaLibrary, t } = useApp();
  const isOnline = useOnlineStatus();

  const totalLiveViewers = streams.reduce((acc, s) => acc + s.viewerCount, 0);
  const themeDisplayName = getThemePreset(grade).name;

  const desktopRailItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ElementType;
    count?: number;
  }> = [
    { id: 'live', label: t('navLive'), icon: Compass },
    { id: 'games', label: t('navGames'), icon: Gamepad2 },
    { id: 'camera', label: t('navCamera'), icon: Camera },
    { id: 'library', label: 'Library', icon: Film, count: mediaLibrary.length || undefined },
    { id: 'inbox', label: 'Inbox', icon: MessageCircle },
    { id: 'workspace', label: t('navWorkspace'), icon: LayoutGrid },
    { id: 'me', label: 'Me', icon: UserCircle2 },
  ];

  // Keep Mobile Bottom Bar sleek & uncrowded at 6 items (Me is 1 tap on the topbar account pill)
  const mobileBarItems = desktopRailItems.slice(0, 6);

  return (
    <>
      {/* Signature StreamLive Studio Top Bar (Compact mobile/tablet sizing, punch-hole safe) */}
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border-hairline)] sl-topbar-bg backdrop-blur-md pt-safe-cutout">
        <div className="flex h-12 md:h-13 items-center justify-between gap-2.5 sm:gap-4 px-3 sm:px-5 px-safe-curved">
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
          <div className="hidden lg:flex items-center gap-2.5 text-xs text-[var(--fg-secondary)] whitespace-nowrap">
            <span className="font-mono-nums font-semibold text-[var(--fg-primary)]">
              {totalLiveViewers.toLocaleString()} {t('viewers')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">{streams.length} rooms</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--accent-gold)] font-medium">{themeDisplayName}</span>
          </div>

          {/* Right: Test Mode button right beside Sign In / Account Wallet Pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenPreferences}
              aria-label={t('preferences')}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {/* Join Free to Earn Menu Trigger */}
            {onOpenFreeToEarn && (
              <button
                type="button"
                onClick={onOpenFreeToEarn}
                title="Join Free to Earn (Monetag & A-ADS Creator Program)"
                className="hidden sm:inline-flex h-8 md:h-9 items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-emerald-500/12 px-2.5 md:px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <HandCoins className="h-3.5 w-3.5 shrink-0" />
                <span>Free to Earn</span>
              </button>
            )}

            {/* Full Functional Test Mode Button (Beside Sign In) */}
            <button
              type="button"
              onClick={onOpenTestMode}
              title="Open Full Functional Test Mode Sandbox"
              className={`flex h-8 md:h-9 items-center gap-1.5 rounded-lg border px-2.5 md:px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                session?.isTestMode
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:border-amber-500/60 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              <FlaskConical className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
              <span className="hidden xs:inline sm:inline">Test Mode</span>
            </button>

            {session ? (
              <button
                type="button"
                onClick={() => onSelectTab('me')}
                title="Open Me Hub (Profile, Biodata, Daily Tasks, Free to Earn & Staff)"
                className={`flex h-8 md:h-9 items-center gap-1.5 rounded-lg border px-2 md:px-2.5 text-xs font-medium text-[var(--fg-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer max-w-[240px] ${
                  activeTab === 'me'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/12'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)]'
                }`}
              >
                {session.avatarUrl ? (
                  <img
                    src={session.avatarUrl}
                    alt={session.displayName}
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-[var(--border-hairline)] shrink-0"
                  />
                ) : (
                  <span className="text-sm leading-none shrink-0">
                    {countryFlag(session.countryCode)}
                  </span>
                )}
                <span className="truncate font-semibold">{session.displayName}</span>
                {(session.partnerVerified || session.verified) && (
                  <BadgeCheck
                    className={`h-3.5 w-3.5 shrink-0 ${
                      session.partnerVerified
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-sky-500'
                    }`}
                  />
                )}
                <span className="hidden sm:inline font-mono-nums text-[11px] text-[var(--accent-gold)]">
                  {session.coins.toLocaleString()}c
                </span>
                <span className="hidden xl:inline font-mono-nums text-[11px] text-[var(--accent-secondary)]">
                  Lv.{session.level}
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
        className="hidden md:flex fixed left-0 top-safe-rail bottom-0 z-30 w-[72px] flex-col items-center justify-between border-r border-[var(--accent-primary)]/60 sl-rail-bg py-2.5"
      >
        <nav className="flex w-full flex-col items-center gap-1 px-1.5 overflow-y-auto no-scrollbar">
          {desktopRailItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`group relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'text-[var(--fg-primary)]'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-surface)]/70'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-150 ${
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
                  <span className="absolute right-2 top-1 font-mono-nums text-[9px] font-bold text-[var(--accent-secondary)]">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Rail Trigger: Consolidated 37 Themes, 20 Languages, Fonts & OS Calibration */}
        <div className="w-full border-t border-[var(--border-hairline)] pt-2 px-1.5 shrink-0">
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

      {/* Mobile & Tablet Fixed Bottom Bar (Sleek compact 6-slot navigation) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--accent-primary)]/45 sl-rail-bg/95 backdrop-blur-md pb-safe-bottom px-safe-bar"
      >
        <div className="grid grid-cols-6 h-12 items-center">
          {mobileBarItems.map((item) => {
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

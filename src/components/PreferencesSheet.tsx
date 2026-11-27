import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Languages,
  Monitor,
  Moon,
  Search,
  Smartphone,
  Square,
  Sun,
  Tablet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { LOCALES } from '../lib/i18n';
import { THEME_DECK_37, type ThemeFamily } from '../lib/themes';
import type { CutoutProfile, FontChoice, FontScale } from '../types';

interface PreferencesSheetProps {
  open: boolean;
  onClose: () => void;
}

const FAMILIES: Array<{ id: ThemeFamily; label: string }> = [
  { id: 'nova', label: 'Nova' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'surge', label: 'Surge' },
  { id: 'ballot', label: 'Ballot' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'ember', label: 'Ember' },
];

const FONTS: Array<{ id: FontChoice; label: string; sample: string }> = [
  { id: 'jakarta', label: 'Plus Jakarta Sans', sample: 'Studio Clean' },
  { id: 'fredoka', label: 'Fredoka', sample: 'StreamLive Rounded' },
  { id: 'playfair', label: 'Playfair Display', sample: 'Editorial Serif' },
  { id: 'dmsans', label: 'DM Sans', sample: 'Google Minimal' },
  { id: 'outfit', label: 'Outfit', sample: 'Geometric Modern' },
  { id: 'manrope', label: 'Manrope', sample: 'Crisp Technical' },
];

const SIZES: Array<{ id: FontScale; label: string }> = [
  { id: 'sm', label: 'Compact' },
  { id: 'md', label: 'Standard' },
  { id: 'lg', label: 'Large' },
  { id: 'xl', label: 'XL' },
];

const CUTOUTS: Array<{ id: CutoutProfile; label: string }> = [
  { id: 'auto', label: 'Auto-Detect' },
  { id: 'punch_center', label: 'Center Punch-Hole' },
  { id: 'punch_left', label: 'Left Punch-Hole' },
  { id: 'dynamic_island', label: 'Dynamic Island / Notch' },
  { id: 'curved_tablet', label: 'Curved Tablet Edge' },
  { id: 'flat', label: 'Flat Desktop' },
];

export const PreferencesSheet: React.FC<PreferencesSheetProps> = ({ open, onClose }) => {
  const {
    theme,
    setTheme,
    grade,
    setGrade,
    squareCorners,
    setSquareCorners,
    autoTranslateChat,
    setAutoTranslateChat,
    font,
    setFont,
    fontSize,
    setFontSize,
    locale,
    setLocale,
    cutout,
    setCutout,
    stretchMode,
    setStretchMode,
    device,
    t,
  } = useApp();

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<ThemeFamily | 'all'>('all');
  const [langSearch, setLangSearch] = useState('');

  const filteredThemes = useMemo(
    () => (familyFilter === 'all' ? THEME_DECK_37 : THEME_DECK_37.filter((x) => x.family === familyFilter)),
    [familyFilter]
  );

  const filteredLocales = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return LOCALES;
    return LOCALES.filter(
      (l) => l.nativeName.toLowerCase().includes(q) || l.englishName.toLowerCase().includes(q) || l.code.includes(q)
    );
  }, [langSearch]);

  if (!open) return null;

  const DeviceIcon =
    device.formFactor === 'mobile' ? Smartphone : device.formFactor === 'tablet' ? Tablet : Monitor;
  const activeCutout = cutout === 'auto' ? device.suggestedCutout : cutout;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('preferences')}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-2xl pt-safe-cutout"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{t('preferences')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {/* Dark / Light Mode + Quick Toggles */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{t('themeMode')}</h3>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--bg-elevated)]">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <Moon className="h-4 w-4 text-[var(--accent-gold)]" />
                <span>{t('darkMode')}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <Sun className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>{t('lightMode')}</span>
              </button>
            </div>

            {/* Square Corners & Auto-Translate Toggles */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSquareCorners(!squareCorners)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer ${
                  squareCorners
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/12 text-[var(--fg-primary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Square className="h-3.5 w-3.5" />
                  <span>Square UI</span>
                </span>
                <span className="text-[10px] font-bold">{squareCorners ? 'ON' : 'OFF'}</span>
              </button>
              <button
                type="button"
                onClick={() => setAutoTranslateChat(!autoTranslateChat)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer ${
                  autoTranslateChat
                    ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/12 text-[var(--fg-primary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5" />
                  <span>Translate Chat</span>
                </span>
                <span className="text-[10px] font-bold">{autoTranslateChat ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </section>

          {/* 37-Theme WCAG Deck Organized by Family */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--fg-primary)]">
                37-Theme Studio Deck
              </h3>
              <span className="font-mono-nums text-[11px] text-[var(--fg-muted)]">
                {filteredThemes.length} presets
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setFamilyFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                  familyFilter === 'all'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                }`}
              >
                All (37)
              </button>
              {FAMILIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFamilyFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                    familyFilter === f.id
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
              {filteredThemes.map((preset) => {
                const selected = grade === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setGrade(preset.id)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] font-semibold'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <div className="truncate leading-tight">{preset.name}</div>
                      <div className="text-[9px] uppercase text-[var(--fg-muted)]">{preset.mode}</div>
                    </div>
                    <span className="flex items-center gap-0.5 shrink-0">
                      {[preset.bgCanvas, preset.accentPrimary, preset.accentSecondary].map((hex, i) => (
                        <span
                          key={i}
                          className="h-3 w-3 rounded-full border border-white/20"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* All 20 World Languages with Flags & RTL */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--fg-primary)]">
                {t('languageLabel')} ({LOCALES.length})
              </h3>
              <span className="text-[11px] text-[var(--fg-muted)]">RTL Ready</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-muted)]" />
              <input
                type="search"
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                placeholder="Search 20 world languages..."
                className="w-full h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] pl-8 pr-3 text-xs text-[var(--fg-primary)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
              {filteredLocales.map((loc) => {
                const selected = locale === loc.code;
                return (
                  <button
                    key={loc.code}
                    type="button"
                    onClick={() => setLocale(loc.code)}
                    className={`flex items-center justify-between rounded-xl border px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] font-semibold text-[var(--fg-primary)]'
                        : 'border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="text-sm leading-none">{loc.flag}</span>
                      <span className="truncate">{loc.nativeName}</span>
                    </span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Switchable Fonts & Sizes */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{t('fontFamily')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {FONTS.map((f) => {
                const selected = font === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFont(f.id)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]'
                        : 'border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    <span className="text-xs font-semibold">{f.label}</span>
                    <span className="text-[10px] text-[var(--fg-muted)]">{f.sample}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 space-y-2">
              <div className="text-xs font-medium text-[var(--fg-secondary)]">{t('fontSize')}</div>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[var(--bg-elevated)]">
                {SIZES.map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setFontSize(sz.id)}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      fontSize === sz.id
                        ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                        : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Auto-Detected OS & Punch-Hole / Curved-Edge Hardware Calibration */}
          <section className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{t('deviceSafeArea')}</h3>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono-nums text-[var(--fg-secondary)]">
                <DeviceIcon className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                {device.os} · {device.formFactor}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {CUTOUTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCutout(c.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    cutout === c.id
                      ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]'
                      : 'border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-elevated)]">
              <button
                type="button"
                onClick={() => setStretchMode('auto')}
                className={`h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  stretchMode === 'auto'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                Auto-Stretch ({activeCutout})
              </button>
              <button
                type="button"
                onClick={() => setStretchMode('centered')}
                className={`h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  stretchMode === 'centered'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                Centered Wide
              </button>
            </div>
          </section>

          {/* In-App PWA Install Prompt */}
          {!isInstalled && (
            <section className="space-y-2.5 border-t border-[var(--border-hairline)] pt-5 pb-6">
              {isInstallable ? (
                <button
                  type="button"
                  onClick={install}
                  className="flex w-full h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>{t('installApp')}</span>
                </button>
              ) : isIOS ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide((prev) => !prev)}
                    className="flex w-full h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-xs font-medium text-[var(--fg-primary)] cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Install on iPhone / iPad</span>
                  </button>
                  {showIOSGuide && (
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs leading-relaxed text-[var(--fg-secondary)]">
                      1. Tap <strong>Share</strong> in Safari.<br />
                      2. Tap <strong>Add to Home Screen</strong>.
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs text-[var(--fg-secondary)]">
                  Installable PWA ready across {device.os}, iOS, Android, macOS, Windows, and Linux.
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
};

import React, { useState } from 'react';
import { Check, Download, Monitor, Moon, Smartphone, Sun, Tablet, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { LOCALES } from '../lib/i18n';
import type { ColorGrade, CutoutProfile, FontChoice, FontScale } from '../types';

interface PreferencesSheetProps {
  open: boolean;
  onClose: () => void;
}

const GRADES: Array<{ id: ColorGrade; label: string; swatches: [string, string, string] }> = [
  { id: 'nova', label: 'Nova Dark', swatches: ['#D90429', '#A3E635', '#E8C86A'] },
  { id: 'emerald', label: 'Emerald Forest', swatches: ['#22C55E', '#FF2B4E', '#FFD166'] },
  { id: 'surge', label: 'Surge Cyber', swatches: ['#00F5FF', '#B4FF00', '#FFE66D'] },
  { id: 'ballot', label: 'Ballot Royal', swatches: ['#FDC500', '#2E6BFF', '#071627'] },
  { id: 'onyx', label: 'Onyx Pro', swatches: ['#CE1F27', '#9AA0AE', '#0B0B0E'] },
  { id: 'ember', label: 'Spooky Ember', swatches: ['#E8641C', '#7FD13B', '#F0B64B'] },
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
    font,
    setFont,
    fontSize,
    setFontSize,
    locale,
    setLocale,
    cutout,
    setCutout,
    device,
    t,
  } = useApp();

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

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
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-6 py-4">
          <h2 className="font-display text-lg font-semibold">{t('preferences')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Dark / Light Mode */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{t('themeMode')}</h3>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--bg-elevated)]">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
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
                className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <Sun className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>{t('lightMode')}</span>
              </button>
            </div>
          </section>

          {/* StreamLive 6 Signature Color Grading Themes */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">
              StreamLive {t('colorGrade')}
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {GRADES.map((g) => {
                const selected = grade === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGrade(g.id)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left text-xs font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] font-semibold'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    <span className="truncate">{g.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {g.swatches.map((hex, i) => (
                        <span
                          key={i}
                          className="h-3 w-3 rounded-full border border-white/15"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Multi-Language (6 Languages + Automatic RTL) */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{t('languageLabel')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {LOCALES.map((loc) => {
                const selected = locale === loc.code;
                return (
                  <button
                    key={loc.code}
                    type="button"
                    onClick={() => setLocale(loc.code)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] font-semibold text-[var(--fg-primary)]'
                        : 'border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    <span>
                      {loc.nativeName}
                      <span className="ml-1.5 text-xs text-[var(--fg-muted)]">{loc.englishName}</span>
                    </span>
                    {selected && <Check className="h-4 w-4 text-[var(--accent-primary)]" />}
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
                    className={`flex flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]'
                        : 'border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    <span className="text-xs font-semibold">{f.label}</span>
                    <span className="text-[11px] text-[var(--fg-muted)]">{f.sample}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 space-y-2">
              <div className="text-xs font-medium text-[var(--fg-secondary)]">{t('fontSize')}</div>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[var(--bg-elevated)]">
                {SIZES.map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setFontSize(sz.id)}
                    className={`rounded-lg py-2 text-xs font-medium transition-colors cursor-pointer ${
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
          <section className="space-y-3 border-t border-[var(--border-hairline)] pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{t('deviceSafeArea')}</h3>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono-nums text-[var(--fg-secondary)]">
                <DeviceIcon className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                {device.os} · {device.formFactor}
              </span>
            </div>

            <p className="text-xs leading-relaxed text-[var(--fg-secondary)]">
              Detected <strong className="text-[var(--fg-primary)]">{device.os}</strong> ({device.screenWidth}×{device.screenHeight}px,{' '}
              {device.isTouch ? 'Touch' : 'Desktop'}). Safe-area padding clears punch-hole cameras, Dynamic Island notches, and curved glass edges.
            </p>

            <div className="relative mx-auto h-20 w-44 rounded-2xl border-2 border-[var(--border-hairline)] bg-[var(--bg-canvas)] overflow-hidden">
              {activeCutout === 'punch_center' && (
                <div className="mx-auto mt-2 h-2.5 w-2.5 rounded-full bg-[var(--fg-primary)]" />
              )}
              {activeCutout === 'punch_left' && (
                <div className="ml-3 mt-2 h-2.5 w-2.5 rounded-full bg-[var(--fg-primary)]" />
              )}
              {activeCutout === 'dynamic_island' && (
                <div className="mx-auto mt-2 h-3 w-12 rounded-full bg-[var(--fg-primary)]" />
              )}
              {activeCutout === 'curved_tablet' && (
                <div className="inset-1 absolute rounded-xl border border-dashed border-[var(--accent-secondary)]/60" />
              )}
              <div className="mt-4 px-3 flex items-center justify-between text-[10px] font-mono-nums text-[var(--fg-muted)]">
                <span>SAFE UI</span>
                <span>{activeCutout}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {CUTOUTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCutout(c.id)}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    cutout === c.id
                      ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]'
                      : 'border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          {/* In-App PWA Install Prompt */}
          {!isInstalled && (
            <section className="space-y-2.5 border-t border-[var(--border-hairline)] pt-6 pb-8">
              {isInstallable ? (
                <button
                  type="button"
                  onClick={install}
                  className="flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>{t('installApp')}</span>
                </button>
              ) : isIOS ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide((prev) => !prev)}
                    className="flex w-full h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-sm font-medium text-[var(--fg-primary)] cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Install on iPhone / iPad</span>
                  </button>
                  {showIOSGuide && (
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-xs leading-relaxed text-[var(--fg-secondary)]">
                      1. Tap the <strong>Share</strong> icon in Safari.<br />
                      2. Scroll down and tap <strong>Add to Home Screen</strong>.
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-xs text-[var(--fg-secondary)]">
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

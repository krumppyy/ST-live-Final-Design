import React, { useState } from 'react';
import {
  Activity,
  Award,
  Building2,
  Camera,
  CheckCircle2,
  Coins,
  Compass,
  Crown,
  Film,
  FlaskConical,
  Gamepad2,
  KeyRound,
  LayoutGrid,
  Lock,
  MessageCircle,
  Music,
  Shield,
  ShieldAlert,
  Smartphone,
  Sparkles,
  User,
  UserCheck,
  UserCircle2,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { countryFlag } from '../lib/countries';
import type { ActiveTab } from './Navbar';
import type { AuthSession, CutoutProfile, Livestream } from '../types';

interface TestModeDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenStream: (stream: Livestream) => void;
}

type PersonaId = 'guest' | 'host' | 'admin' | 'agency' | 'band' | 'staff';

const PERSONAS: Array<{
  id: PersonaId;
  label: string;
  sub: string;
  badge: string;
  icon: React.ElementType;
}> = [
  {
    id: 'guest',
    label: 'Guest Viewer',
    sub: '3 free PIN trials · 1,000 Coins',
    badge: 'Viewer',
    icon: User,
  },
  {
    id: 'host',
    label: 'Host VIP (Verified)',
    sub: '25k Coins · 18k Diamonds · VIP 80/20',
    badge: 'Creator',
    icon: Crown,
  },
  {
    id: 'admin',
    label: 'Room Admin',
    sub: '-20% Gift Discount · Mod Controls',
    badge: 'Mod',
    icon: UserCheck,
  },
  {
    id: 'agency',
    label: 'Agency HQ',
    sub: 'Roster & Creator Management',
    badge: 'Agency',
    icon: Building2,
  },
  {
    id: 'band',
    label: 'Music Band / Brand',
    sub: 'Stage Live & Drop Console',
    badge: 'Band',
    icon: Music,
  },
  {
    id: 'staff',
    label: 'Staff Safety Desk',
    sub: 'Payouts · Appeals · Threat · Resets',
    badge: 'Staff',
    icon: Shield,
  },
];

export const TestModeDrawer: React.FC<TestModeDrawerProps> = ({
  open,
  onClose,
  onNavigateTab,
  onOpenStream,
}) => {
  const {
    session,
    setSession,
    authFetch,
    refreshStreams,
    streams,
    cutout,
    setCutout,
    stretchMode,
    setStretchMode,
    pushToast,
  } = useApp();

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ id: string; text: string; ok: boolean }>>([]);

  if (!open) return null;

  const logResult = (text: string, ok = true) => {
    setResults((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, ok }, ...prev].slice(0, 6));
  };

  const handleSwitchPersona = async (persona: PersonaId) => {
    setBusyKey(`persona:${persona}`);
    try {
      const res = await fetch('/api/test/switch-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      const data = (await res.json()) as { session?: AuthSession; error?: string };
      if (!res.ok || !data.session) {
        pushToast(data.error || 'Could not switch test persona.', 'error');
        logResult(data.error || 'Persona switch failed', false);
        return;
      }
      setSession({ ...data.session, isTestMode: true });
      pushToast(`Test Mode: Signed in as ${data.session.displayName} (${data.session.role.toUpperCase()})`, 'success');
      logResult(`Switched to ${data.session.displayName} (#${data.session.numericId}, ${data.session.role})`);
      if (persona === 'staff') {
        onNavigateTab('me');
      }
    } catch {
      pushToast('Network error switching test persona.', 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const ensureTestSession = async (): Promise<boolean> => {
    if (session?.token) return true;
    await handleSwitchPersona('host');
    return true;
  };

  const runTestAction = async (action: string, label: string) => {
    setBusyKey(`action:${action}`);
    try {
      await ensureTestSession();
      const res = await authFetch('/api/test/action', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || `${label} failed.`, 'error');
        logResult(data.error || `${label} failed`, false);
        return;
      }
      if (data.session) {
        setSession({ ...data.session, isTestMode: true });
      }
      const msg = data.message || `${label} complete.`;
      pushToast(msg, 'success');
      logResult(msg, true);

      if (action === 'spawn_pin_room' && data.roomId) {
        await refreshStreams();
        const freshList = (data.streams as Livestream[] | undefined) || streams;
        const found = freshList.find((s) => s.id === data.roomId);
        if (found) {
          onNavigateTab('live');
          onOpenStream(found);
          onClose();
        }
      }
    } catch {
      pushToast('Network error executing test trigger.', 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const quickJumps: Array<{ label: string; tab: ActiveTab; icon: React.ElementType }> = [
    { label: 'Discover', tab: 'live', icon: Compass },
    { label: 'Games', tab: 'games', icon: Gamepad2 },
    { label: '8K Camera', tab: 'camera', icon: Camera },
    { label: 'Library', tab: 'library', icon: Film },
    { label: 'E2EE Inbox', tab: 'inbox', icon: MessageCircle },
    { label: 'Me & Staff', tab: 'me', icon: UserCircle2 },
    { label: 'Studio HQ', tab: 'workspace', icon: LayoutGrid },
  ];

  const cutoutChoices: Array<{ id: CutoutProfile; label: string }> = [
    { id: 'auto', label: 'Auto' },
    { id: 'flat', label: 'Desktop' },
    { id: 'dynamic_island', label: 'iPhone Island' },
    { id: 'punch_center', label: 'Android Punch' },
    { id: 'curved_tablet', label: 'Tablet' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Test Mode Sandbox"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <FlaskConical className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold leading-tight">Full App Test Mode</h2>
              <p className="text-[11px] text-[var(--fg-secondary)]">
                Switch personas & test live server features end-to-end
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Test Mode"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Active Session Summary */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                Active Test Session
              </span>
              {session?.isTestMode && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                  SANDBOX ACTIVE
                </span>
              )}
            </div>
            {session ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <span>{countryFlag(session.countryCode)}</span>
                    <span>{session.displayName}</span>
                    <span className="font-mono-nums text-xs text-[var(--fg-muted)]">#{session.numericId}</span>
                  </div>
                  <span className="rounded bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--accent-primary)]">
                    {session.role}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1 text-center font-mono-nums text-[11px]">
                  <div className="rounded-lg bg-[var(--bg-surface)] py-1.5 border border-[var(--border-hairline)]">
                    <div className="text-[9px] text-[var(--fg-muted)]">Coins</div>
                    <div className="font-bold text-[var(--accent-gold)]">{session.coins.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface)] py-1.5 border border-[var(--border-hairline)]">
                    <div className="text-[9px] text-[var(--fg-muted)]">Diamonds</div>
                    <div className="font-bold text-cyan-400">{session.diamonds.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface)] py-1.5 border border-[var(--border-hairline)]">
                    <div className="text-[9px] text-[var(--fg-muted)]">Tokens</div>
                    <div className="font-bold text-[var(--accent-secondary)]">{session.tokens}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-surface)] py-1.5 border border-[var(--border-hairline)]">
                    <div className="text-[9px] text-[var(--fg-muted)]">Level</div>
                    <div className="font-bold">Lv.{session.level}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--fg-secondary)]">
                Not signed in yet. Pick any persona below for instant one-click access.
              </p>
            )}
          </div>

          {/* 1. One-Click Persona Switcher */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              1. Switch Persona (1-Click Real Auth)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {PERSONAS.map((p) => {
                const Icon = p.icon;
                const active = session?.role === p.id;
                const loading = busyKey === `persona:${p.id}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={loading}
                    onClick={() => handleSwitchPersona(p.id)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)]/50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span className="text-[9px] font-bold uppercase text-[var(--fg-muted)]">
                        {loading ? '...' : p.badge}
                      </span>
                    </div>
                    <div className="text-xs font-semibold leading-tight">{p.label}</div>
                    <div className="text-[10px] text-[var(--fg-secondary)] leading-snug">{p.sub}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. End-to-End Server Feature Triggers */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              2. Live Feature Triggers
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => runTestAction('boost_wallet', 'Boost Wallet')}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-xs font-medium hover:border-[var(--accent-gold)] transition-colors cursor-pointer"
              >
                <Coins className="h-4 w-4 shrink-0 text-[var(--accent-gold)]" />
                <div>
                  <div className="font-semibold">Boost Wallet</div>
                  <div className="text-[10px] text-[var(--fg-muted)]">+5k C / +6k D / +120 T</div>
                </div>
              </button>

              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => runTestAction('boost_xp', 'Boost XP')}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-xs font-medium hover:border-[var(--accent-secondary)] transition-colors cursor-pointer"
              >
                <Award className="h-4 w-4 shrink-0 text-[var(--accent-secondary)]" />
                <div>
                  <div className="font-semibold">Boost +4.5k XP</div>
                  <div className="text-[10px] text-[var(--fg-muted)]">Unlock level perks</div>
                </div>
              </button>

              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => runTestAction('spawn_pin_room', 'PIN Room')}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-xs font-medium hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
              >
                <Lock className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                <div>
                  <div className="font-semibold">Open PIN Room</div>
                  <div className="text-[10px] text-[var(--fg-muted)]">PIN: 123456</div>
                </div>
              </button>

              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => runTestAction('test_xss_shield', 'XSS Shield')}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-xs font-medium hover:border-emerald-400 transition-colors cursor-pointer"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-semibold">Test XSS Shield</div>
                  <div className="text-[10px] text-[var(--fg-muted)]">Injection sanitizer</div>
                </div>
              </button>

              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => runTestAction('simulate_3_reports', '3-Report Auto-Remove')}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-xs font-medium hover:border-rose-400 transition-colors cursor-pointer"
              >
                <Zap className="h-4 w-4 shrink-0 text-rose-400" />
                <div>
                  <div className="font-semibold">3-Report Takedown</div>
                  <div className="text-[10px] text-[var(--fg-muted)]">Auto-remove stream</div>
                </div>
              </button>

              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => runTestAction('totp_current_code', 'Get 2FA Code')}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-xs font-medium hover:border-sky-400 transition-colors cursor-pointer"
              >
                <KeyRound className="h-4 w-4 shrink-0 text-sky-400" />
                <div>
                  <div className="font-semibold">Live TOTP Code</div>
                  <div className="text-[10px] text-[var(--fg-muted)]">Verify 2FA login</div>
                </div>
              </button>
            </div>
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={() => runTestAction('reset_pin_trials', 'Reset PIN Trials')}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] cursor-pointer"
            >
              Reset Free PIN Room Trials (Back to 3)
            </button>
          </section>

          {/* 3. Quick Jump Matrix */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              3. Quick Jump to Any Module
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {quickJumps.map((j) => {
                const Icon = j.icon;
                return (
                  <button
                    key={j.tab}
                    type="button"
                    onClick={() => {
                      onNavigateTab(j.tab);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium hover:border-[var(--accent-primary)] cursor-pointer"
                  >
                    <Icon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    <span>{j.label}</span>
                  </button>
                );
              })}
              {streams[0] && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('live');
                    onOpenStream(streams[0]);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--accent-secondary)]/50 bg-[var(--accent-secondary)]/10 px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-secondary)] cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Join Top Live Room</span>
                </button>
              )}
            </div>
          </section>

          {/* 4. OS Cutout & Stretch Simulator */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                <Smartphone className="h-3.5 w-3.5" />
                <span>4. OS & Screen Stretch Check</span>
              </h3>
              <button
                type="button"
                onClick={() => setStretchMode(stretchMode === 'auto' ? 'centered' : 'auto')}
                className="rounded border border-[var(--border-hairline)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-secondary)] cursor-pointer"
              >
                Stretch: {stretchMode === 'auto' ? 'Auto-Fluid' : 'Centered'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cutoutChoices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCutout(c.id)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                    cutout === c.id
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--fg-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          {/* 5. Recent Test Verification Log */}
          {results.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                <Activity className="h-3.5 w-3.5" />
                <span>Recent Test Results</span>
              </h3>
              <div className="space-y-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-2.5">
                {results.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 text-[11px]">
                    <CheckCircle2
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${r.ok ? 'text-emerald-400' : 'text-rose-400'}`}
                    />
                    <span className="text-[var(--fg-secondary)] break-words">{r.text}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

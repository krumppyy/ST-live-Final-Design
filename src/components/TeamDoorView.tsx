import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  Coins,
  Eye,
  KeyRound,
  Lock,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { countryFlag } from '../lib/countries';
import type {
  AuditLogEntry,
  Livestream,
  PayoutRecord,
  SafetyAppeal,
  SafetyReport,
  TeamDoorTier,
} from '../types';

interface TeamDoorViewProps {
  tier: TeamDoorTier;
  onBackToMain: () => void;
  onViewProfile?: (uid: string) => void;
}

interface TeamMemberRow {
  uid: string;
  numericId: number;
  displayName: string;
  role: string;
  countryCode: string;
  level: number;
  coins: number;
  diamonds: number;
  verified: boolean;
  partnerVerified: boolean;
  bannedUntil: number;
  banStrikes: number;
  avatarUrl?: string;
}

interface TeamOverviewPayload {
  tier: TeamDoorTier;
  counts: {
    liveRooms: number;
    roomCeiling: number;
    openReports: number;
    pendingAppeals: number;
    pendingPayouts: number;
  };
  streams: Livestream[];
  members: TeamMemberRow[];
  reports: SafetyReport[];
  appeals: SafetyAppeal[];
  payouts: PayoutRecord[];
  monetagQueue: Array<{
    uid: string;
    numericId: number;
    displayName: string;
    status: string;
    email: string;
    publisherId: string;
    tipUrl: string;
  }>;
  aadsQueue: Array<{
    uid: string;
    numericId: number;
    displayName: string;
    status: string;
    email: string;
    unitId: string;
    bannerPos: string;
    bannerSize: string;
  }>;
  threat: {
    globalLockdownUntil: number;
    blockedKeys: Array<{ key: string; until: number }>;
    recentIncidents: Array<{ key: string; pattern: string; at: number }>;
  };
  auditLogs: AuditLogEntry[];
}

type TierStatusMap = Record<
  TeamDoorTier,
  { configured: boolean; source: 'env' | 'claimed' | 'unclaimed' }
>;

const TIER_META: Record<
  TeamDoorTier,
  {
    rank: number;
    code: string;
    title: string;
    queryFlag: string;
    description: string;
    badgeClass: string;
  }
> = {
  monitor: {
    rank: 1,
    code: 'MONITOR',
    title: 'Tier 1 · Monitor (Read-Only)',
    queryFlag: '?admin',
    description: 'Read-only access to live lobby, #ID directory, safety reports, appeals, and audit trail.',
    badgeClass: 'border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  trusted: {
    rank: 2,
    code: 'TRUSTED',
    title: 'Tier 2 · Trusted Moderator',
    queryFlag: '?admintrust',
    description: 'Includes Monitor visibility plus report dismissal, appeal resolution, temp-unban, and stream takedown.',
    badgeClass: 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  full: {
    rank: 3,
    code: 'FULL',
    title: 'Tier 3 · Full Team Admin',
    queryFlag: '?adminpower',
    description: 'Full operational powers: partner verification (Monetag/A-ADS), payouts, audited coin grants, and threat controls.',
    badgeClass: 'border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
};

export const TeamDoorView: React.FC<TeamDoorViewProps> = ({
  tier,
  onBackToMain,
  onViewProfile,
}) => {
  const meta = TIER_META[tier];
  // Memory-only Team Door session token (never stored in localStorage)
  const [teamToken, setTeamToken] = useState<string>('');
  const [tierStatus, setTierStatus] = useState<TierStatusMap | null>(null);
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  const [overview, setOverview] = useState<TeamOverviewPayload | null>(null);
  const [activeSection, setActiveSection] = useState<
    'overview' | 'people' | 'safety' | 'partners' | 'audit'
  >('overview');
  const [memberQuery, setMemberQuery] = useState('');
  const [membersPage, setMembersPage] = useState(1);
  const [actionMsg, setActionMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  // Tier 3 Audited Coin Grant form
  const [grantUid, setGrantUid] = useState('');
  const [grantAmount, setGrantAmount] = useState('500');
  const [grantReason, setGrantReason] = useState('Community event reward');

  // Set body[data-device="admin"] chrome indicator while inside a Team Door
  useEffect(() => {
    const prev = document.body.dataset.device;
    document.body.dataset.device = 'admin';
    return () => {
      if (prev) document.body.dataset.device = prev;
      else delete document.body.dataset.device;
    };
  }, []);

  // Load which tiers are configured via env vs claimed vs unclaimed
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/team/status');
      if (res.ok) {
        const data = await res.json();
        setTierStatus(data.tiers || null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const loadOverview = useCallback(async (tokenOverride?: string) => {
    const tok = tokenOverride ?? teamToken;
    if (!tok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/team/overview', {
        headers: { 'X-Team-Token': tok },
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Team session expired.');
        setTeamToken('');
        setOverview(null);
        return;
      }
      setOverview(data);
    } finally {
      setBusy(false);
    }
  }, [teamToken]);

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (passcode.trim().length < 8) {
      setAuthError('Team key must be at least 8 characters.');
      return;
    }
    if (passcode !== confirmPasscode) {
      setAuthError('Passcodes do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/team/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Could not claim team key.');
        return;
      }
      setTierStatus(data.tiers || null);
      setTeamToken(data.token);
      setPasscode('');
      setConfirmPasscode('');
      await loadOverview(data.token);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setBusy(true);
    try {
      const res = await fetch('/api/team/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Invalid Team Door key.');
        return;
      }
      setTeamToken(data.token);
      setPasscode('');
      await loadOverview(data.token);
    } finally {
      setBusy(false);
    }
  };

  const runTeamAction = async (payload: Record<string, unknown>, okLabel: string) => {
    setActionMsg(null);
    const res = await fetch('/api/team/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Team-Token': teamToken,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMsg({ text: data.error || 'Action denied by server policy.', tone: 'err' });
      await loadOverview();
      return;
    }
    setActionMsg({ text: okLabel, tone: 'ok' });
    await loadOverview();
  };

  const filteredMembers = useMemo(() => {
    if (!overview) return [];
    const q = memberQuery.trim().toLowerCase();
    if (!q) return overview.members;
    const cleanNum = q.replace('#', '');
    return overview.members.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.uid.toLowerCase().includes(q) ||
        String(m.numericId).includes(cleanNum) ||
        m.role.toLowerCase().includes(q)
    );
  }, [overview, memberQuery]);

  const currentTierInfo = tierStatus?.[tier];
  const needsBootstrap = currentTierInfo && !currentTierInfo.configured;
  const canModerate = meta.rank >= 2;
  const canPower = meta.rank >= 3;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--fg-primary)] border-l-4 border-rose-600">
      {/* Top Red-Rail Team Door Banner */}
      <header className="sticky top-0 z-40 border-b border-rose-500/40 bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="sl-fluid-page flex flex-wrap items-center justify-between gap-2.5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBackToMain}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-semibold text-[var(--fg-primary)] hover:border-rose-500 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold tracking-wider ${meta.badgeClass}`}>
              <Shield className="h-3.5 w-3.5" />
              <span>{meta.code}</span>
              <span className="font-mono-nums opacity-80">({meta.queryFlag})</span>
            </span>
            <span className="hidden md:inline text-xs text-[var(--fg-secondary)] truncate">
              {meta.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {teamToken && (
              <>
                <button
                  type="button"
                  onClick={() => loadOverview()}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-medium text-[var(--fg-primary)] hover:border-rose-500 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeamToken('');
                    setOverview(null);
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Lock Door</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="sl-fluid-page py-6 space-y-5">
        {!teamToken || !overview ? (
          /* Zero-Trust Key Gate (First-Run Claim or Unlock) */
          <section className="mx-auto max-w-md rounded-2xl border border-rose-500/40 bg-[var(--bg-surface)] p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-[var(--fg-primary)]">
                  {meta.title}
                </h1>
                <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">{meta.description}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-[11px] text-[var(--fg-secondary)] space-y-1">
              <div className="font-semibold text-[var(--fg-primary)]">Zero-Trust Team Gate</div>
              <p>
                Query flags open the Team Door interface only. Every read and write action is
                authenticated with a server-verified key, held strictly in memory, and logged in
                the audit trail.
              </p>
            </div>

            {needsBootstrap ? (
              <form onSubmit={handleBootstrap} className="space-y-3">
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  First-run setup: Claim the initial <strong>{meta.code}</strong> team key (min 8
                  chars). Once claimed, this setup form locks permanently unless overridden via
                  server environment variables.
                </div>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={`Create ${meta.code} Team Key (min 8 chars)`}
                  autoComplete="new-password"
                  className="h-10 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--fg-primary)]"
                />
                <input
                  type="password"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="Confirm Team Key"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--fg-primary)]"
                />
                {authError && (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{authError}</p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{busy ? 'Claiming Key...' : `Claim & Open ${meta.code} Door`}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleUnlock} className="space-y-3">
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={`Enter ${meta.code} Team Key`}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--fg-primary)]"
                />
                {authError && (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{authError}</p>
                )}
                <button
                  type="submit"
                  disabled={busy || !passcode.trim()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  <Unlock className="h-4 w-4" />
                  <span>{busy ? 'Verifying...' : `Unlock ${meta.code} Console`}</span>
                </button>
              </form>
            )}
          </section>
        ) : (
          /* Unlocked Tiered Team Console */
          <>
            {actionMsg && (
              <div
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                  actionMsg.tone === 'ok'
                    ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/12 text-rose-700 dark:text-rose-300'
                }`}
              >
                <span>{actionMsg.text}</span>
                <button type="button" onClick={() => setActionMsg(null)} className="cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                {
                  label: 'Live Rooms',
                  value: `${overview.counts.liveRooms} / ${overview.counts.roomCeiling}`,
                  icon: Radio,
                },
                { label: 'Directory', value: `${overview.members.length}`, icon: Users },
                { label: 'Open Reports', value: `${overview.counts.openReports}`, icon: ShieldAlert },
                { label: 'Pending Appeals', value: `${overview.counts.pendingAppeals}`, icon: AlertTriangle },
                { label: 'Pending Payouts', value: `${overview.counts.pendingPayouts}`, icon: Coins },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[var(--fg-muted)]">
                      <span>{stat.label}</span>
                      <Icon className="h-3.5 w-3.5 text-rose-500" />
                    </div>
                    <div className="mt-1 font-mono-nums text-base font-bold text-[var(--fg-primary)]">
                      {stat.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Section Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-hairline)] pb-3">
              {(
                [
                  ['overview', 'Live Lobby & Ceilings'],
                  ['people', `People & #IDs (${overview.members.length})`],
                  ['safety', `Reports & Appeals (${overview.reports.length + overview.appeals.length})`],
                  ['partners', 'Partners, Payouts & Grants'],
                  ['audit', `Audit Log (${overview.auditLogs.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold cursor-pointer ${
                    activeSection === id
                      ? 'bg-rose-600 text-white'
                      : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeSection === 'overview' && (
              <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-[var(--fg-primary)]">
                    Active Broadcast Rooms ({overview.streams.length})
                  </h2>
                  <span className="font-mono-nums text-[11px] text-[var(--fg-muted)]">
                    Ceiling: {overview.counts.roomCeiling} rooms · 300 visitors/room
                  </span>
                </div>
                <div className="space-y-2">
                  {overview.streams.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--fg-primary)] truncate">
                          {countryFlag(s.countryCode)} {s.title}
                        </div>
                        <div className="text-[11px] font-mono-nums text-[var(--fg-muted)]">
                          Host: {s.hostName} ({s.hostUid} #{s.hostNumericId}) · {s.viewerCount} viewers ·{' '}
                          {s.viewMinutes ?? 0} view-min
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {onViewProfile && (
                          <button
                            type="button"
                            onClick={() => onViewProfile(s.hostUid)}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2 text-[11px] font-medium cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Profile</span>
                          </button>
                        )}
                        {canModerate && (
                          <button
                            type="button"
                            onClick={() =>
                              runTeamAction(
                                { action: 'end_stream', roomId: s.id },
                                `Ended broadcast ${s.id}`
                              )
                            }
                            className="inline-flex h-7 items-center rounded-lg bg-rose-600 px-2.5 text-[11px] font-semibold text-white hover:bg-rose-700 cursor-pointer"
                          >
                            End Room
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeSection === 'people' && (() => {
              const MEMBERS_PAGE_SIZE = 24;
              const totalPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PAGE_SIZE));
              const safePage = Math.min(membersPage, totalPages);
              const pagedMembers = filteredMembers.slice(
                (safePage - 1) * MEMBERS_PAGE_SIZE,
                safePage * MEMBERS_PAGE_SIZE
              );
              return (
              <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-muted)]" />
                    <input
                      type="search"
                      value={memberQuery}
                      onChange={(e) => {
                        setMemberQuery(e.target.value);
                        setMembersPage(1);
                      }}
                      placeholder="Search people by name, UID, #ID, or role..."
                      className="h-9 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-9 pr-3 text-xs text-[var(--fg-primary)]"
                    />
                  </div>
                  <span className="font-mono-nums text-[11px] text-[var(--fg-muted)]">
                    {filteredMembers.length} people · Page {safePage}/{totalPages} (24/page)
                  </span>
                </div>
                <div className="space-y-1.5 max-h-[540px] overflow-y-auto">
                  {pagedMembers.map((m) => (
                    <div
                      key={m.uid}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt={m.displayName}
                            className="h-7 w-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[10px] font-bold shrink-0">
                            {m.displayName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-semibold text-[var(--fg-primary)]">
                            <span>{countryFlag(m.countryCode)}</span>
                            <span className="truncate">{m.displayName}</span>
                            {(m.partnerVerified || m.verified) && (
                              <BadgeCheck
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  m.partnerVerified ? 'text-emerald-500' : 'text-sky-500'
                                }`}
                              />
                            )}
                            <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono-nums text-[10px] text-[var(--fg-secondary)]">
                              #{m.numericId}
                            </span>
                            <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono-nums text-[10px] text-[var(--fg-muted)]">
                              {m.uid}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono-nums text-[var(--fg-muted)]">
                            Role: {m.role.toUpperCase()} · Lv.{m.level} · {m.coins.toLocaleString()}c ·{' '}
                            {m.diamonds.toLocaleString()}D
                            {m.bannedUntil > Date.now() && (
                              <span className="ml-2 font-bold text-rose-500">TEMP BANNED</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {onViewProfile && (
                          <button
                            type="button"
                            onClick={() => onViewProfile(m.uid)}
                            className="h-7 rounded-lg border border-[var(--border-hairline)] px-2 text-[11px] font-medium cursor-pointer"
                          >
                            CV
                          </button>
                        )}
                        {canModerate && m.bannedUntil > Date.now() && (
                          <button
                            type="button"
                            onClick={() =>
                              runTeamAction(
                                { action: 'unban_user', targetUid: m.uid },
                                `Lifted temp ban for ${m.displayName}`
                              )
                            }
                            className="h-7 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-semibold text-white cursor-pointer"
                          >
                            Unban
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-hairline)] text-xs">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                      className="h-7 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Prev
                    </button>
                    <span className="font-mono-nums text-[var(--fg-secondary)]">
                      {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setMembersPage((p) => Math.min(totalPages, p + 1))}
                      className="h-7 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </section>
              );
            })()}

            {activeSection === 'safety' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-2.5">
                  <h2 className="font-display text-sm font-bold text-[var(--fg-primary)]">
                    Community Reports ({overview.reports.length})
                  </h2>
                  {overview.reports.length === 0 ? (
                    <p className="text-xs text-[var(--fg-muted)]">No reports logged.</p>
                  ) : (
                    overview.reports.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--fg-primary)] truncate">
                            {r.reason}
                          </div>
                          <div className="font-mono-nums text-[10px] text-[var(--fg-muted)]">
                            Room: {r.roomId} · By: {r.reporterUid} · Status: {r.status}
                          </div>
                        </div>
                        {canModerate && r.status === 'open' && (
                          <button
                            type="button"
                            onClick={() =>
                              runTeamAction(
                                { action: 'dismiss_report', reportId: r.id },
                                `Dismissed report #${r.id}`
                              )
                            }
                            className="h-7 shrink-0 rounded-lg border border-[var(--border-hairline)] px-2 text-[11px] font-semibold hover:border-emerald-500 cursor-pointer"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </section>

                <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-2.5">
                  <h2 className="font-display text-sm font-bold text-[var(--fg-primary)]">
                    Ban Appeals ({overview.appeals.length})
                  </h2>
                  {overview.appeals.length === 0 ? (
                    <p className="text-xs text-[var(--fg-muted)]">No appeals pending.</p>
                  ) : (
                    overview.appeals.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{a.displayName} ({a.uid})</span>
                          <span className="font-mono-nums text-[10px] uppercase text-[var(--fg-muted)]">
                            {a.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--fg-secondary)]">{a.reason}</p>
                        {canModerate && a.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                runTeamAction(
                                  { action: 'resolve_appeal', appealId: a.id, status: 'approved' },
                                  `Approved appeal #${a.id}`
                                )
                              }
                              className="h-7 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-semibold text-white cursor-pointer"
                            >
                              Approve & Unban
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                runTeamAction(
                                  { action: 'resolve_appeal', appealId: a.id, status: 'denied' },
                                  `Denied appeal #${a.id}`
                                )
                              }
                              className="h-7 rounded-lg bg-rose-600 px-2.5 text-[11px] font-semibold text-white cursor-pointer"
                            >
                              Deny
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </section>
              </div>
            )}

            {activeSection === 'partners' && (
              <div className="space-y-4">
                {!canPower && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/12 p-3 text-xs text-amber-800 dark:text-amber-200">
                    Read-only preview: Partner verification, payouts, and audited coin grants
                    require <strong>Tier 3 FULL (?adminpower)</strong> clearance.
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Monetag + A-ADS Queues */}
                  <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
                    <h2 className="font-display text-sm font-bold text-[var(--fg-primary)]">
                      Monetag & A-ADS Verification Queues
                    </h2>
                    <div className="space-y-2">
                      {overview.monetagQueue.map((m) => (
                        <div
                          key={`m-${m.uid}`}
                          className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">
                              Monetag · {m.displayName} ({m.uid} #{m.numericId})
                            </span>
                            <span className="font-mono-nums text-[10px] uppercase">{m.status}</span>
                          </div>
                          <div className="text-[11px] text-[var(--fg-muted)] break-all">
                            {m.email} · Pub: {m.publisherId} · {m.tipUrl}
                          </div>
                          {canPower && (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  runTeamAction(
                                    { action: 'verify_monetag', targetUid: m.uid, status: 'verified' },
                                    `Verified Monetag partner ${m.uid}`
                                  )
                                }
                                className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                <Check className="h-3 w-3" />
                                <span>Verify</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  runTeamAction(
                                    { action: 'verify_monetag', targetUid: m.uid, status: 'rejected' },
                                    `Rejected Monetag submission for ${m.uid}`
                                  )
                                }
                                className="h-7 rounded-lg bg-rose-600 px-2.5 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {overview.aadsQueue.map((a) => (
                        <div
                          key={`a-${a.uid}`}
                          className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">
                              A-ADS · {a.displayName} ({a.uid} #{a.numericId})
                            </span>
                            <span className="font-mono-nums text-[10px] uppercase">{a.status}</span>
                          </div>
                          <div className="text-[11px] text-[var(--fg-muted)]">
                            {a.email} · Unit #{a.unitId} · {a.bannerPos} ({a.bannerSize})
                          </div>
                          {canPower && (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  runTeamAction(
                                    { action: 'verify_aads', targetUid: a.uid, status: 'verified' },
                                    `Verified A-ADS partner ${a.uid}`
                                  )
                                }
                                className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                <Check className="h-3 w-3" />
                                <span>Verify</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  runTeamAction(
                                    { action: 'verify_aads', targetUid: a.uid, status: 'rejected' },
                                    `Rejected A-ADS submission for ${a.uid}`
                                  )
                                }
                                className="h-7 rounded-lg bg-rose-600 px-2.5 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Audited Coin Grant + Payouts */}
                  <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-4">
                    <div className="space-y-2.5">
                      <h2 className="font-display text-sm font-bold text-[var(--fg-primary)]">
                        Audited Coin Grant (Daily Mint Capped)
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={grantUid}
                          onChange={(e) => setGrantUid(e.target.value)}
                          placeholder="Target UID (e.g. ST-1001)"
                          disabled={!canPower}
                          className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs"
                        />
                        <input
                          type="number"
                          min={10}
                          max={25000}
                          value={grantAmount}
                          onChange={(e) => setGrantAmount(e.target.value)}
                          disabled={!canPower}
                          className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-mono-nums"
                        />
                        <button
                          type="button"
                          disabled={!canPower || !grantUid.trim()}
                          onClick={() =>
                            runTeamAction(
                              {
                                action: 'grant_coins',
                                targetUid: grantUid.trim().toUpperCase(),
                                amount: Number(grantAmount),
                                reason: grantReason,
                              },
                              `Granted ${grantAmount} coins to ${grantUid.trim().toUpperCase()}`
                            )
                          }
                          className="h-9 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-45 cursor-pointer"
                        >
                          Grant Coins
                        </button>
                      </div>
                      <input
                        type="text"
                        value={grantReason}
                        onChange={(e) => setGrantReason(e.target.value)}
                        placeholder="Audit reason..."
                        disabled={!canPower}
                        className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs"
                      />
                    </div>

                    <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
                      <h3 className="text-xs font-bold text-[var(--fg-primary)]">
                        Payout Requests ({overview.payouts.length})
                      </h3>
                      {overview.payouts.slice(0, 8).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">
                              {p.displayName} · ${p.usdAmount.toFixed(2)} ({p.diamonds.toLocaleString()}D)
                            </div>
                            <div className="text-[10px] font-mono-nums text-[var(--fg-muted)]">
                              {p.method} · {p.destinationMasked} · {p.status}
                            </div>
                          </div>
                          {canPower && p.status === 'pending' && (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  runTeamAction(
                                    { action: 'resolve_payout', payoutId: p.id, decision: 'approved' },
                                    `Approved payout #${p.id}`
                                  )
                                }
                                className="h-7 rounded-lg bg-emerald-600 px-2 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  runTeamAction(
                                    { action: 'resolve_payout', payoutId: p.id, decision: 'denied' },
                                    `Denied & refunded payout #${p.id}`
                                  )
                                }
                                className="h-7 rounded-lg bg-rose-600 px-2 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                Deny
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeSection === 'audit' && (
              <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[var(--fg-primary)]">
                    <Activity className="h-4 w-4 text-rose-500" />
                    <span>Immutable Server Audit Log</span>
                  </h2>
                  <span className="font-mono-nums text-[11px] text-[var(--fg-muted)]">
                    Latest {overview.auditLogs.length} events
                  </span>
                </div>
                <div className="space-y-1.5 max-h-[520px] overflow-y-auto font-mono-nums text-[11px]">
                  {overview.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {log.actorUid}
                        </span>
                        <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px]">
                          {log.action}
                        </span>
                        <span className="text-[var(--fg-primary)]">{log.target}</span>
                        {log.metaMasked && (
                          <span className="text-[var(--fg-muted)]">({log.metaMasked})</span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--fg-muted)]">{log.createdAt}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

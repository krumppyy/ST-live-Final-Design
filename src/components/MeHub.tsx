import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Ban,
  CalendarCheck,
  CheckCircle2,
  Coins,
  Crown,
  DollarSign,
  ExternalLink,
  Gem,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { COUNTRIES, countryFlag } from '../lib/countries';
import type { AuditLogEntry, PasswordResetRecord, PayoutRecord, SafetyAppeal, SafetyReport } from '../types';

interface MeHubProps {
  onOpenLogin: () => void;
  onOpenTestMode: () => void;
}

type MeTab = 'profile' | 'wallet' | 'vip' | 'earning' | 'safety' | 'staff';

const SHOP_PERKS = [
  { id: 'pro_membership', name: 'PRO Membership (-5% Gifts)', price: 2000, minLevel: 1, desc: 'Permanent PRO badge + 5% off every gift sent' },
  { id: 'ring', name: 'Neon Ring', price: 300, minLevel: 5, desc: 'Glowing creator ring in chat & room header' },
  { id: 'banner', name: 'Stage Banner', price: 400, minLevel: 10, desc: 'Animated room entrance alert for viewers' },
  { id: 'gframe', name: 'Gold Frame', price: 600, minLevel: 15, desc: 'Metallic gilded border on profile & gifts' },
  { id: 'crown', name: 'Royal Crown (VIP)', price: 800, minLevel: 20, desc: 'Golden crown flair beside your name (VIP)' },
  { id: 'vframe', name: 'VIP Aura Frame (VIP)', price: 1000, minLevel: 30, desc: 'High-contrast crimson & gold aura frame (VIP)' },
  { id: 'pro_emblem', name: 'PRO Emblem (PRO)', price: 2000, minLevel: 50, desc: 'Elite PRO creator insignia (PRO)' },
];

const VIP_TIERS = [
  { id: 'weekly', label: 'VIP Weekly', tokens: 60, duration: '7 Days', perks: '80/20 Diamond split · -10% Gifts · Free PIN rooms · Full Visitor Log' },
  { id: 'monthly', label: 'VIP Monthly', tokens: 200, duration: '30 Days', perks: 'Best value · Priority room rank · All VIP privileges' },
  { id: 'lifetime', label: 'VIP Lifetime', tokens: 800, duration: 'Forever', perks: 'Permanent VIP crown · All future VIP unlocks included' },
];

const TOPUP_PACKS = [
  { id: 'p100', label: 'Starter Pack', coins: 100, bonus: 'Instant Credit', priceLabel: '$0.99 Sandbox' },
  { id: 'p500', label: 'Stage Pack', coins: 500, bonus: 'Popular Choice', priceLabel: '$4.99 Sandbox' },
  { id: 'p1000', label: 'Nova Whale Pack', coins: 1000, bonus: 'Best Value', priceLabel: '$8.99 Sandbox' },
];

export const MeHub: React.FC<MeHubProps> = ({ onOpenLogin, onOpenTestMode }) => {
  const {
    session,
    setSession,
    authFetch,
    logout,
    claimDailyCheckIn,
    checkedInToday,
    followingHostUids,
    pushToast,
  } = useApp();

  const [subTab, setSubTab] = useState<MeTab>(session?.role === 'staff' ? 'staff' : 'profile');
  const [busy, setBusy] = useState(false);

  // Profile form state
  const [countryCode, setCountryCode] = useState(session?.countryCode || 'US');
  const [bio, setBio] = useState(session?.bio || '');
  const [age, setAge] = useState(session?.age || '');
  const [gender, setGender] = useState(session?.gender || '');
  const [hobbies, setHobbies] = useState(session?.hobbies || '');
  const [showAge, setShowAge] = useState(Boolean(session?.showAge));
  const [showGender, setShowGender] = useState(Boolean(session?.showGender));
  const [showFollowers, setShowFollowers] = useState(session?.showFollowers !== false);
  const [showVisits, setShowVisits] = useState(session?.showVisits !== false);
  const [allowDm, setAllowDm] = useState(session?.allowDm !== false);
  const [bannerPos, setBannerPos] = useState<'top' | 'lower' | 'corner'>(session?.bannerPos || 'lower');
  const [bannerSize, setBannerSize] = useState<'728x90' | '468x60' | '300x250'>(session?.bannerSize || '728x90');

  // Social / Payouts / Appeals state
  const [blockedUsers, setBlockedUsers] = useState<Array<{ uid: string; displayName: string; reason: string }>>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [appeals, setAppeals] = useState<SafetyAppeal[]>([]);

  // Payout form
  const [payoutDiamonds, setPayoutDiamonds] = useState('5000');
  const [payoutMethod, setPayoutMethod] = useState('PayPal');
  const [payoutDestination, setPayoutDestination] = useState('');

  // Monetag form
  const [monetagEmail, setMonetagEmail] = useState('');
  const [monetagPubId, setMonetagPubId] = useState('');
  const [monetagTipUrl, setMonetagTipUrl] = useState(session?.monetagTipUrl || '');

  // 2FA & Appeal state
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string; demoCode: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [appealReason, setAppealReason] = useState('');

  // Staff Console state
  const [staffSection, setStaffSection] = useState<'reports' | 'appeals' | 'payouts' | 'resets' | 'monetag' | 'threat' | 'audit'>('reports');
  const [staffData, setStaffData] = useState<{
    reports: SafetyReport[];
    appeals: SafetyAppeal[];
    payouts: PayoutRecord[];
    resets: PasswordResetRecord[];
    monetagQueue: Array<{ uid: string; displayName: string; status: string; publisherId: string; tipUrl: string }>;
    threat: { lockdownUntil: number; activeBlocks: Array<{ key: string; until: number; strikes: number }> };
    auditLogs: AuditLogEntry[];
  } | null>(null);

  useEffect(() => {
    if (!session) return;
    setCountryCode(session.countryCode || 'US');
    setBio(session.bio || '');
    setAge(session.age || '');
    setGender(session.gender || '');
    setHobbies(session.hobbies || '');
    setShowAge(Boolean(session.showAge));
    setShowGender(Boolean(session.showGender));
    setShowFollowers(session.showFollowers !== false);
    setShowVisits(session.showVisits !== false);
    setAllowDm(session.allowDm !== false);
    setBannerPos(session.bannerPos || 'lower');
    setBannerSize(session.bannerSize || '728x90');
    setMonetagTipUrl(session.monetagTipUrl || '');
    if (session.role === 'staff' && subTab === 'profile') {
      setSubTab('staff');
    }
  }, [session?.uid]);

  const loadSocialData = useCallback(async () => {
    if (!session?.token) return;
    try {
      const res = await authFetch('/api/me/social');
      if (res.ok) {
        const data = await res.json();
        setBlockedUsers(data.blockedUsers || []);
        setPayouts(data.payouts || []);
        setAppeals(data.appeals || []);
      }
    } catch {
      // ignore
    }
  }, [session?.token, authFetch]);

  const loadStaffOverview = useCallback(async () => {
    if (!session?.token || session.role !== 'staff') return;
    try {
      const res = await authFetch('/api/staff/overview');
      if (res.ok) {
        const data = await res.json();
        setStaffData(data);
      }
    } catch {
      // ignore
    }
  }, [session?.token, session?.role, authFetch]);

  useEffect(() => {
    loadSocialData();
    if (session?.role === 'staff') {
      loadStaffOverview();
    }
  }, [loadSocialData, loadStaffOverview, session?.role]);

  if (!session) {
    return (
      <main className="sl-fluid-page py-10 pb-24 md:pb-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
            <User className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold">Your StreamLive Account Hub</h1>
          <p className="text-xs text-[var(--fg-secondary)] leading-relaxed">
            Sign in or activate 1-click Test Mode to manage your Profile, 3-Currency Wallet, VIP & Level 0–300 Perks,
            Diamond Payouts, Monetag Free-Tip, TOTP 2FA Security, and Staff Moderation Console.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onOpenLogin}
              className="h-10 rounded-lg bg-[var(--accent-primary)] px-5 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
            >
              Sign In / Create Account
            </button>
            <button
              type="button"
              onClick={onOpenTestMode}
              className="h-10 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 cursor-pointer"
            >
              Open Test Mode Sandbox
            </button>
          </div>
        </div>
      </main>
    );
  }

  const updateSessionFromResp = (nextSession?: typeof session) => {
    if (nextSession) {
      setSession({ ...nextSession, token: session.token, isTestMode: session.isTestMode });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          countryCode,
          bio,
          age,
          gender,
          hobbies,
          showAge,
          showGender,
          showFollowers,
          showVisits,
          allowDm,
          bannerPos,
          bannerSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not save profile.', 'error');
        return;
      }
      updateSessionFromResp(data.session);
      pushToast('Profile & privacy settings saved.', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleBuyTopup = async (packId: string) => {
    setBusy(true);
    try {
      const res = await authFetch('/api/economy/topup', {
        method: 'POST',
        body: JSON.stringify({ packId, claimKey: `${session.uid}-${packId}-${Date.now()}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Top-up failed.', 'error');
        return;
      }
      updateSessionFromResp(data.session);
      pushToast(`Pack credited: +${data.coinsAdded || 0} Coins!`, 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleBuyPerk = async (perkId: string) => {
    setBusy(true);
    try {
      const res = await authFetch('/api/economy/shop/buy', {
        method: 'POST',
        body: JSON.stringify({ perkId }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not purchase perk.', 'error');
        return;
      }
      updateSessionFromResp(data.session);
      pushToast('Shop perk unlocked!', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleBuyVip = async (planId: string) => {
    setBusy(true);
    try {
      const res = await authFetch('/api/economy/vip', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'VIP upgrade failed.', 'error');
        return;
      }
      updateSessionFromResp(data.session);
      pushToast(`VIP ${planId.toUpperCase()} activated!`, 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch('/api/economy/payout', {
        method: 'POST',
        body: JSON.stringify({
          diamonds: Number(payoutDiamonds),
          method: payoutMethod,
          destination: payoutDestination,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Payout request rejected.', 'error');
        return;
      }
      updateSessionFromResp(data.session);
      setPayoutDestination('');
      await loadSocialData();
      pushToast('Payout request submitted to Staff review!', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitMonetag = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch('/api/economy/monetag', {
        method: 'POST',
        body: JSON.stringify({
          email: monetagEmail,
          publisherId: monetagPubId,
          tipUrl: monetagTipUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Monetag submission failed.', 'error');
        return;
      }
      updateSessionFromResp(data.session);
      pushToast('Monetag Free-Tip application submitted for staff verification!', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleStart2fa = async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTotpSetup(data);
        setTotpCode(data.demoCode || '');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm2fa = async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/auth/2fa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Invalid 2FA code.', 'error');
        return;
      }
      updateSessionFromResp(data.session);
      setTotpSetup(null);
      setTotpCode('');
      pushToast('TOTP 2FA enabled on your account!', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable2fa = async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/auth/2fa/disable', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        updateSessionFromResp(data.session);
        pushToast('TOTP 2FA disabled.', 'info');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch('/api/safety/appeal', {
        method: 'POST',
        body: JSON.stringify({ reason: appealReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not submit appeal.', 'error');
        return;
      }
      setAppeals(data.appeals || []);
      setAppealReason('');
      pushToast('Safety appeal queued for staff review.', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleUnblockUser = async (targetUid: string) => {
    const res = await authFetch(`/api/rooms/any/block/${encodeURIComponent(targetUid)}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setBlockedUsers(data.blockedUsers || []);
      pushToast('User unblocked.', 'info');
    }
  };

  const handleStaffAction = async (url: string, body: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await authFetch(url, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Staff action failed.', 'error');
        return;
      }
      pushToast(successMsg, 'success');
      await loadStaffOverview();
    } finally {
      setBusy(false);
    }
  };

  const isVipActive = session.vipUntil > Date.now();
  const levelProgress = Math.min(100, Math.round(((session.xp % 300) / 300) * 100));

  const tabs: Array<{ id: MeTab; label: string; icon: React.ElementType }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'wallet', label: 'Wallet & Shop', icon: Wallet },
    { id: 'vip', label: 'VIP & Levels', icon: Crown },
    { id: 'earning', label: 'Earning & Payouts', icon: DollarSign },
    { id: 'safety', label: 'Safety & 2FA', icon: KeyRound },
    ...(session.role === 'staff' ? [{ id: 'staff' as MeTab, label: 'Staff Console', icon: Shield }] : []),
  ];

  return (
    <main className="sl-fluid-page py-5 pb-24 md:pb-12 space-y-5">
      {/* Compact Account Identity Header */}
      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 text-xl">
              {countryFlag(session.countryCode)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-lg font-bold">{session.displayName}</h1>
                {session.verified && <BadgeCheck className="h-4 w-4 text-sky-400" />}
                <span className="font-mono-nums text-xs text-[var(--fg-muted)]">#{session.numericId}</span>
                <span className="rounded bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--accent-primary)]">
                  {session.role}
                </span>
                {isVipActive && (
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                    VIP {session.vipTier.toUpperCase()}
                  </span>
                )}
                {session.isPro && (
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    PRO
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--fg-secondary)]">
                <span>UID: {session.uid}</span>
                <span>·</span>
                <span>Lv.{session.level} ({session.xp.toLocaleString()} XP)</span>
                <span>·</span>
                <span>Following {followingHostUids.length}</span>
                {session.emailMasked && (
                  <>
                    <span>·</span>
                    <span>{session.emailMasked}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3-Currency Trio + Sign Out */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-nums text-xs">
              <span className="flex items-center gap-1 text-[var(--accent-gold)] font-bold">
                <Coins className="h-3.5 w-3.5" />
                {session.coins.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-cyan-400 font-bold">
                <Gem className="h-3.5 w-3.5" />
                {session.diamonds.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-[var(--accent-secondary)] font-bold">
                <Sparkles className="h-3.5 w-3.5" />
                {session.tokens}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--fg-secondary)] hover:text-rose-400 hover:border-rose-500/40 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Sub-Tab Bar */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto border-t border-[var(--border-hairline)] pt-3 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: PROFILE & PRIVACY */}
      {subTab === 'profile' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4"
          >
            <h2 className="font-display text-base font-bold">Creator Profile & Visibility</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Country & Flag</span>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Hobbies / Tags</span>
                <input
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder="Music, FPS, IRL Travel..."
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Age</span>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Gender</span>
                <input
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>
            </div>
            <label className="block space-y-1 text-xs">
              <span className="text-[var(--fg-secondary)]">Bio</span>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell your live community about your schedule..."
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
              />
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
              {[
                { label: 'Show Age', val: showAge, set: setShowAge },
                { label: 'Show Gender', val: showGender, set: setShowGender },
                { label: 'Show Followers', val: showFollowers, set: setShowFollowers },
                { label: 'Show Room Visits', val: showVisits, set: setShowVisits },
                { label: 'Allow Direct DMs', val: allowDm, set: setAllowDm },
              ].map((t) => (
                <label
                  key={t.label}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={t.val}
                    onChange={(e) => t.set(e.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Sponsor / Tip Banner Position</span>
                <select
                  value={bannerPos}
                  onChange={(e) => setBannerPos(e.target.value as 'top' | 'lower' | 'corner')}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                >
                  <option value="top">Top Overlay</option>
                  <option value="lower">Lower Third</option>
                  <option value="corner">Corner Dock</option>
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Banner Dimension</span>
                <select
                  value={bannerSize}
                  onChange={(e) => setBannerSize(e.target.value as '728x90' | '468x60' | '300x250')}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                >
                  <option value="728x90">Leaderboard (728×90)</option>
                  <option value="468x60">Standard (468×60)</option>
                  <option value="300x250">Card (300×250)</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="h-9 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
            >
              {busy ? 'Saving...' : 'Save Profile & Preferences'}
            </button>
          </form>

          {/* Blocklist Card */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <Ban className="h-4 w-4 text-rose-400" />
              <span>Room Blocklist ({blockedUsers.length}/200)</span>
            </h2>
            {blockedUsers.length === 0 ? (
              <p className="text-xs text-[var(--fg-secondary)]">No blocked users. You can block disruptive users from any live room you host.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {blockedUsers.map((b) => (
                  <div
                    key={b.uid}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold">{b.displayName}</div>
                      <div className="text-[10px] text-[var(--fg-muted)]">{b.reason}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblockUser(b.uid)}
                      className="rounded border border-[var(--border-hairline)] px-2 py-1 text-[10px] hover:border-emerald-400 cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WALLET & SHOP */}
      {subTab === 'wallet' && (
        <div className="space-y-5">
          {/* Daily Check-In 7-Day Streak */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold">
                  <CalendarCheck className="h-4 w-4 text-[var(--accent-secondary)]" />
                  <span>7-Day Daily Check-In Streak (Day {session.dailyStreak || 0}/7)</span>
                </h2>
                <p className="text-xs text-[var(--fg-secondary)]">
                  Earn daily Tokens & XP. Day 7 awards the full weekly bonus!
                </p>
              </div>
              <button
                type="button"
                disabled={checkedInToday}
                onClick={claimDailyCheckIn}
                className={`h-9 rounded-lg px-4 text-xs font-semibold cursor-pointer ${
                  checkedInToday
                    ? 'bg-[var(--bg-elevated)] text-[var(--fg-muted)] cursor-default'
                    : 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)]'
                }`}
              >
                {checkedInToday ? 'Claimed Today ✓' : 'Claim Daily Check-In'}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const done = (session.dailyStreak || 0) >= day;
                return (
                  <div
                    key={day}
                    className={`rounded-xl border py-2.5 text-center text-xs ${
                      done
                        ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)] font-bold'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-muted)]'
                    }`}
                  >
                    <div className="text-[10px]">Day {day}</div>
                    <div className="mt-0.5 font-mono-nums">+{day === 7 ? 30 : day * 5}T</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Sandbox Coin Top-Up Packs */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Coin Top-Up Packs (Sandbox Mode)</h2>
              <span className="text-[11px] text-[var(--fg-muted)]">Protected by daily mint cap</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {TOPUP_PACKS.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-4 space-y-3"
                >
                  <div>
                    <div className="text-xs font-bold">{p.label}</div>
                    <div className="mt-1 font-mono-nums text-lg font-bold text-[var(--accent-gold)]">
                      {p.coins.toLocaleString()} Coins
                    </div>
                    <div className="text-[11px] text-[var(--accent-secondary)]">{p.bonus}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleBuyTopup(p.id)}
                    className="h-8 w-full rounded-lg bg-[var(--accent-primary)] text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                  >
                    Claim ({p.priceLabel})
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Level-Gated Perks & PRO Shop */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <ShoppingBag className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Creator Perks & PRO Shop</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SHOP_PERKS.map((perk) => {
                const owned = session.ownedPerks.includes(perk.id) || (perk.id === 'pro_membership' && session.isPro);
                const locked = session.level < perk.minLevel;
                return (
                  <div
                    key={perk.id}
                    className="flex flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3.5 space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{perk.name}</span>
                        <span className="font-mono-nums text-[10px] text-[var(--fg-muted)]">Lv.{perk.minLevel}+</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--fg-secondary)]">{perk.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || owned || locked}
                      onClick={() => handleBuyPerk(perk.id)}
                      className={`h-8 w-full rounded-lg text-xs font-semibold cursor-pointer ${
                        owned
                          ? 'bg-emerald-500/15 text-emerald-400 cursor-default'
                          : locked
                            ? 'bg-[var(--bg-surface)] text-[var(--fg-muted)] cursor-not-allowed'
                            : 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)]'
                      }`}
                    >
                      {owned ? 'Owned ✓' : locked ? `Requires Lv.${perk.minLevel}` : `Buy · ${perk.price} Coins`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: VIP & LEVELS (0-300) */}
      {subTab === 'vip' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Award className="h-4 w-4 text-[var(--accent-secondary)]" />
                <span>Level {session.level} / 300 Progression</span>
              </h2>
              <span className="font-mono-nums text-xs text-[var(--fg-secondary)]">
                {session.xp.toLocaleString()} Total XP
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-4 text-[11px] text-[var(--fg-secondary)]">
              <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">Chat message: <strong className="text-[var(--fg-primary)]">+1 XP</strong></div>
              <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">Watch 1 minute: <strong className="text-[var(--fg-primary)]">+1 Token +5 XP</strong></div>
              <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">Send gift: <strong className="text-[var(--fg-primary)]">+2 XP / coin</strong></div>
              <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">Daily Check-In: <strong className="text-[var(--fg-primary)]">+20–50 XP</strong></div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold">
                  <Crown className="h-4 w-4 text-amber-400" />
                  <span>VIP Membership Plans</span>
                </h2>
                <p className="text-xs text-[var(--fg-secondary)]">
                  Upgrade host diamond split from 70/30 to 80/20, save 10% on gifts, enter PIN rooms free, and unlock full visitor logs.
                </p>
              </div>
              <span className="font-mono-nums text-xs font-bold text-[var(--accent-secondary)]">
                Balance: {session.tokens} Tokens
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {VIP_TIERS.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-4 space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{plan.label}</span>
                      <span className="text-[10px] font-semibold text-amber-400">{plan.duration}</span>
                    </div>
                    <div className="mt-1 font-mono-nums text-lg font-bold text-[var(--accent-secondary)]">
                      {plan.tokens} Tokens
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--fg-secondary)] leading-relaxed">{plan.perks}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleBuyVip(plan.id)}
                    className="h-9 w-full rounded-lg bg-amber-500 text-xs font-bold text-black hover:bg-amber-400 cursor-pointer"
                  >
                    Activate {plan.label}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: EARNING, PAYOUTS & MONETAG */}
      {subTab === 'earning' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Diamond Cash-Out */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Gem className="h-4 w-4 text-cyan-400" />
                <span>Diamond Cash-Out (1,000 D = $1.00)</span>
              </h2>
              <p className="text-xs text-[var(--fg-secondary)]">
                Minimum 5,000 Diamonds ($5.00). 24h cooldown. Denied payouts refund automatically.
              </p>
            </div>
            <form onSubmit={handleRequestPayout} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  <span className="text-[var(--fg-secondary)]">Diamonds (Avail: {session.diamonds.toLocaleString()})</span>
                  <input
                    type="number"
                    min={5000}
                    step={500}
                    value={payoutDiamonds}
                    onChange={(e) => setPayoutDiamonds(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-nums"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-[var(--fg-secondary)]">Payout Rail</span>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                  >
                    <option value="PayPal">PayPal</option>
                    <option value="USDT-TRC20">USDT (TRC-20)</option>
                    <option value="Bank Wire">Bank Wire / SWIFT</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Destination Email / Wallet Address</span>
                <input
                  required
                  value={payoutDestination}
                  onChange={(e) => setPayoutDestination(e.target.value)}
                  placeholder="creator@example.com or TWallet..."
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="h-9 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
              >
                Request ${((Number(payoutDiamonds) || 0) / 1000).toFixed(2)} Payout
              </button>
            </form>

            {payouts.length > 0 && (
              <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
                <h3 className="text-xs font-semibold text-[var(--fg-muted)]">Recent Payout History</h3>
                {payouts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-mono-nums font-bold">${p.usdAmount.toFixed(2)}</span>
                      <span className="ml-2 text-[var(--fg-secondary)]">{p.method} · {p.destinationMasked}</span>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        p.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : p.status === 'denied'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Monetag Free-Tip Onboarding */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <ExternalLink className="h-4 w-4 text-[var(--accent-secondary)]" />
                <span>Monetag Free-Tip Program</span>
              </h2>
              <span className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--accent-gold)]">
                Status: {session.monetagStatus}
              </span>
            </div>
            <p className="text-xs text-[var(--fg-secondary)] leading-relaxed">
              Let viewers support your live streams for free via your verified Monetag direct link. Once Staff verifies
              your Publisher ID, a Free-Tip button appears inside your live room.
            </p>
            <form onSubmit={handleSubmitMonetag} className="space-y-3">
              <input
                required
                type="email"
                value={monetagEmail}
                onChange={(e) => setMonetagEmail(e.target.value)}
                placeholder="Monetag Publisher Email"
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
              />
              <input
                required
                value={monetagPubId}
                onChange={(e) => setMonetagPubId(e.target.value)}
                placeholder="Monetag Publisher ID (e.g. PUB-88241)"
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
              />
              <input
                required
                type="url"
                value={monetagTipUrl}
                onChange={(e) => setMonetagTipUrl(e.target.value)}
                placeholder="https://monetag.example/tip/your-zone"
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-9 rounded-lg bg-[var(--accent-secondary)] px-4 text-xs font-bold text-black cursor-pointer"
              >
                Submit for Staff Verification
              </button>
            </form>
          </section>
        </div>
      )}

      {/* TAB 5: SAFETY, TOTP 2FA & APPEALS */}
      {subTab === 'safety' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* TOTP 2FA */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Lock className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>TOTP 2-Factor Authentication</span>
              </h2>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  session.totpEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-elevated)] text-[var(--fg-muted)]'
                }`}
              >
                {session.totpEnabled ? 'ENABLED' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-[var(--fg-secondary)]">
              RFC-6238 6-digit authenticator codes protect your wallet, payouts, and creator room controls.
            </p>
            {session.totpEnabled ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleDisable2fa}
                className="h-9 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 text-xs font-semibold text-rose-400 cursor-pointer"
              >
                Disable 2FA
              </button>
            ) : totpSetup ? (
              <div className="space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3.5 text-xs">
                <div>
                  <div className="text-[10px] uppercase text-[var(--fg-muted)]">Authenticator Secret</div>
                  <div className="mt-0.5 font-mono-nums text-sm font-bold text-[var(--accent-gold)] select-all">
                    {totpSetup.secret}
                  </div>
                </div>
                <div className="text-[11px] text-[var(--fg-secondary)]">
                  Live test code: <strong className="font-mono-nums text-[var(--accent-secondary)]">{totpSetup.demoCode}</strong>
                </div>
                <div className="flex gap-2">
                  <input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="6-digit code"
                    className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono-nums text-xs"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleConfirm2fa}
                    className="rounded-lg bg-emerald-500 px-3.5 text-xs font-bold text-black cursor-pointer"
                  >
                    Confirm 2FA
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleStart2fa}
                className="h-9 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
              >
                Setup Authenticator 2FA
              </button>
            )}
          </section>

          {/* Standing & Safety Appeals */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>Account Standing & Appeals</span>
            </h2>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs">
              <span>Safety Strikes</span>
              <span className="font-mono-nums font-bold">{session.banStrikes || 0}</span>
            </div>
            <form onSubmit={handleSubmitAppeal} className="space-y-2.5">
              <textarea
                rows={3}
                required
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Submit a ban or moderation appeal for Staff review..."
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-9 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
              >
                Submit Appeal
              </button>
            </form>
            {appeals.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {appeals.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                  >
                    <span className="truncate pr-2">{a.reason}</span>
                    <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-bold uppercase">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 6: STAFF CONSOLE (STAFF ROLE ONLY) */}
      {subTab === 'staff' && session.role === 'staff' && (
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[var(--accent-primary)]" />
              <h2 className="font-display text-base font-bold">Staff Safety, Payout & Threat Desk</h2>
            </div>
            <button
              type="button"
              onClick={loadStaffOverview}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Desk</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['reports', `Reports (${staffData?.reports.length || 0})`],
                ['appeals', `Appeals (${staffData?.appeals.length || 0})`],
                ['payouts', `Payouts (${staffData?.payouts.length || 0})`],
                ['resets', `Resets (${staffData?.resets.length || 0})`],
                ['monetag', `Monetag (${staffData?.monetagQueue.length || 0})`],
                ['threat', 'Threat Console'],
                ['audit', `Audit Ring (${staffData?.auditLogs.length || 0})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStaffSection(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  staffSection === key
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {!staffData ? (
            <p className="text-xs text-[var(--fg-secondary)]">Loading staff desk records...</p>
          ) : (
            <div className="space-y-2.5">
              {staffSection === 'reports' &&
                (staffData.reports.length === 0 ? (
                  <p className="text-xs text-[var(--fg-secondary)]">No community room reports yet.</p>
                ) : (
                  staffData.reports.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold">Room {r.roomId} · Target {r.targetUid}</div>
                        <div className="text-[11px] text-[var(--fg-secondary)]">
                          Reporter: {r.reporterUid} · Reason: {r.reason}
                        </div>
                      </div>
                      <span className="font-mono-nums text-[10px] text-[var(--fg-muted)]">
                        {new Date(r.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                ))}

              {staffSection === 'appeals' &&
                (staffData.appeals.length === 0 ? (
                  <p className="text-xs text-[var(--fg-secondary)]">No pending appeals.</p>
                ) : (
                  staffData.appeals.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold">{a.displayName} ({a.uid}) · {a.status.toUpperCase()}</div>
                        <div className="text-[11px] text-[var(--fg-secondary)]">{a.reason}</div>
                      </div>
                      {a.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleStaffAction(`/api/staff/appeals/${a.id}/resolve`, { status: 'approved' }, 'Appeal approved & ban cleared.')
                            }
                            className="rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleStaffAction(`/api/staff/appeals/${a.id}/resolve`, { status: 'denied' }, 'Appeal denied.')
                            }
                            className="rounded bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ))}

              {staffSection === 'payouts' &&
                (staffData.payouts.length === 0 ? (
                  <p className="text-xs text-[var(--fg-secondary)]">No payout requests yet.</p>
                ) : (
                  staffData.payouts.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold">
                          {p.displayName} · ${p.usdAmount.toFixed(2)} ({p.diamonds.toLocaleString()} D) · {p.status.toUpperCase()}
                        </div>
                        <div className="text-[11px] text-[var(--fg-secondary)]">
                          {p.method} · {p.destinationMasked}
                        </div>
                      </div>
                      {p.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleStaffAction(`/api/staff/payouts/${p.id}/resolve`, { action: 'approved' }, 'Payout approved.')
                            }
                            className="rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleStaffAction(`/api/staff/payouts/${p.id}/resolve`, { action: 'denied' }, 'Payout denied & diamonds refunded.')
                            }
                            className="rounded bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                          >
                            Deny & Refund
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ))}

              {staffSection === 'resets' &&
                (staffData.resets.length === 0 ? (
                  <p className="text-xs text-[var(--fg-secondary)]">No password reset requests.</p>
                ) : (
                  staffData.resets.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold">{r.displayName} ({r.uid}) · {r.status.toUpperCase()}</div>
                        <div className="text-[11px] text-[var(--fg-secondary)]">Contact: {r.contactMasked}</div>
                      </div>
                      {r.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleStaffAction(`/api/staff/resets/${r.id}/approve`, {}, '24-hour password reset window approved.')
                          }
                          className="rounded bg-[var(--accent-secondary)] px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                        >
                          Approve 24h Window
                        </button>
                      )}
                    </div>
                  ))
                ))}

              {staffSection === 'monetag' &&
                (staffData.monetagQueue.length === 0 ? (
                  <p className="text-xs text-[var(--fg-secondary)]">No Monetag Free-Tip applications.</p>
                ) : (
                  staffData.monetagQueue.map((m) => (
                    <div
                      key={m.uid}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold">{m.displayName} · Pub {m.publisherId} · {m.status.toUpperCase()}</div>
                        <div className="text-[11px] text-[var(--fg-secondary)]">{m.tipUrl}</div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleStaffAction(`/api/staff/monetag/${m.uid}/verify`, { status: 'verified' }, 'Creator Monetag verified!')
                          }
                          className="rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleStaffAction(`/api/staff/monetag/${m.uid}/verify`, { status: 'rejected' }, 'Monetag application rejected.')
                          }
                          className="rounded bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                ))}

              {staffSection === 'threat' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 text-xs">
                    <div>
                      <div className="font-semibold">Global Injection & Flood Lockdown</div>
                      <div className="text-[11px] text-[var(--fg-secondary)]">
                        {staffData.threat.lockdownUntil > Date.now()
                          ? `ACTIVE until ${new Date(staffData.threat.lockdownUntil).toLocaleTimeString()}`
                          : 'Normal operating state (3-strike injection shield active)'}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleStaffAction('/api/staff/threat/lockdown', { durationSec: 60 }, '60s security lockdown engaged.')
                        }
                        className="rounded bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                      >
                        60s Lockdown
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleStaffAction('/api/staff/threat/lockdown', { durationSec: 0 }, 'Lockdown cleared.')
                        }
                        className="rounded border border-[var(--border-hairline)] px-2.5 py-1 text-[11px] cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {staffData.threat.activeBlocks.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Zero actively blocked threat keys.</span>
                    </div>
                  ) : (
                    staffData.threat.activeBlocks.map((b) => (
                      <div
                        key={b.key}
                        className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                      >
                        <span>{b.key} · {b.strikes} strikes</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleStaffAction('/api/staff/threat/unblock', { key: b.key }, `Unblocked ${b.key}`)
                          }
                          className="rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                        >
                          Unblock
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {staffSection === 'audit' && (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {staffData.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px]"
                    >
                      <span>
                        <strong className="text-[var(--accent-secondary)]">{log.action}</strong> · {log.actorUid} → {log.target || '-'} {log.metaMasked ? `(${log.metaMasked})` : ''}
                      </span>
                      <span className="font-mono-nums text-[10px] text-[var(--fg-muted)]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

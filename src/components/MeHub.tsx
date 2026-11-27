import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Ban,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Crown,
  DollarSign,
  Eye,
  Film,
  Gem,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Upload,
  User,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { COUNTRIES, countryFlag } from '../lib/countries';
import { computeLevelInfo, LEVEL_MILESTONES } from '../lib/leveling';
import type {
  AuditLogEntry,
  BannerPlacement,
  BannerSize,
  HostDailyTask,
  PasswordResetRecord,
  PayoutRecord,
  SafetyAppeal,
  SafetyReport,
} from '../types';
import { FreeToEarnHub } from './FreeToEarnHub';

export type MeTab = 'profile' | 'wallet' | 'vip' | 'earning' | 'safety' | 'staff';

interface MeHubProps {
  initialSubTab?: MeTab | null;
  onConsumeSubTab?: () => void;
  onOpenLogin: () => void;
  onOpenTestMode: () => void;
  onViewPublicProfile?: (uid: string) => void;
}

async function compressImageToDataUrl(file: File, maxDim: number, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

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

export const MeHub: React.FC<MeHubProps> = ({
  initialSubTab,
  onConsumeSubTab,
  onOpenLogin,
  onOpenTestMode,
  onViewPublicProfile,
}) => {
  const {
    session,
    setSession,
    authFetch,
    logout,
    claimDailyCheckIn,
    checkedInToday,
    followingHostUids,
    mediaLibrary,
    pushToast,
  } = useApp();

  const [subTab, setSubTab] = useState<MeTab>(
    initialSubTab || (session?.role === 'staff' ? 'staff' : 'profile')
  );
  const [busy, setBusy] = useState(false);

  // Profile Biodata / CV & Media form state
  const [countryCode, setCountryCode] = useState(session?.countryCode || 'US');
  const [avatarUrl, setAvatarUrl] = useState(session?.avatarUrl || '');
  const [coverUrl, setCoverUrl] = useState(session?.coverUrl || '');
  const [libraryPickerTarget, setLibraryPickerTarget] = useState<'none' | 'avatar' | 'cover'>('none');
  const [headline, setHeadline] = useState(session?.headline || '');
  const [location, setLocation] = useState(session?.location || '');
  const [languages, setLanguages] = useState(session?.languages || '');
  const [skills, setSkills] = useState(session?.skills || '');
  const [schedule, setSchedule] = useState(session?.schedule || '');
  const [websiteUrl, setWebsiteUrl] = useState(session?.websiteUrl || '');
  const [bio, setBio] = useState(session?.bio || '');
  const [age, setAge] = useState(session?.age || '');
  const [gender, setGender] = useState(session?.gender || '');
  const [hobbies, setHobbies] = useState(session?.hobbies || '');
  const [showBio, setShowBio] = useState(session?.showBio !== false);
  const [showAge, setShowAge] = useState(Boolean(session?.showAge));
  const [showGender, setShowGender] = useState(Boolean(session?.showGender));
  const [showLocation, setShowLocation] = useState(session?.showLocation !== false);
  const [showLanguages, setShowLanguages] = useState(session?.showLanguages !== false);
  const [showSkills, setShowSkills] = useState(session?.showSkills !== false);
  const [showSchedule, setShowSchedule] = useState(session?.showSchedule !== false);
  const [showHobbies, setShowHobbies] = useState(session?.showHobbies !== false);
  const [showWebsite, setShowWebsite] = useState(session?.showWebsite !== false);
  const [showFollowers, setShowFollowers] = useState(session?.showFollowers !== false);
  const [showVisits, setShowVisits] = useState(session?.showVisits !== false);
  const [allowDm, setAllowDm] = useState(session?.allowDm !== false);
  const [bannerPos, setBannerPos] = useState<BannerPlacement>(session?.bannerPos || 'below_stage');
  const [bannerSize, setBannerSize] = useState<BannerSize>(session?.bannerSize || '728x90');

  // Daily Host Tasks + Social / Payouts / Appeals state
  const [dailyTasks, setDailyTasks] = useState<HostDailyTask[]>([]);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Array<{ uid: string; displayName: string; reason: string }>>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [appeals, setAppeals] = useState<SafetyAppeal[]>([]);

  // Payout form
  const [payoutDiamonds, setPayoutDiamonds] = useState('5000');
  const [payoutMethod, setPayoutMethod] = useState('PayPal');
  const [payoutDestination, setPayoutDestination] = useState('');

  // 2FA & Appeal state
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string; demoCode: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [appealReason, setAppealReason] = useState('');

  // Staff Console state
  const [staffSection, setStaffSection] = useState<
    'reports' | 'appeals' | 'payouts' | 'resets' | 'monetag' | 'aads' | 'threat' | 'audit'
  >('reports');
  const [staffData, setStaffData] = useState<{
    reports: SafetyReport[];
    appeals: SafetyAppeal[];
    payouts: PayoutRecord[];
    resets: PasswordResetRecord[];
    monetagQueue: Array<{
      uid: string;
      numericId?: number;
      displayName: string;
      status: string;
      email?: string;
      publisherId: string;
      tipUrl: string;
    }>;
    aadsQueue: Array<{
      uid: string;
      numericId?: number;
      displayName: string;
      status: string;
      email?: string;
      unitId: string;
      bannerPos: string;
      bannerSize: string;
    }>;
    threat: { lockdownUntil: number; activeBlocks?: Array<{ key: string; until: number; strikes: number }>; entries?: Array<{ key: string; blockedUntil: number; strikes: number }> };
    auditLogs: AuditLogEntry[];
  } | null>(null);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
      onConsumeSubTab?.();
    }
  }, [initialSubTab, onConsumeSubTab]);

  useEffect(() => {
    if (!session) return;
    setCountryCode(session.countryCode || 'US');
    setAvatarUrl(session.avatarUrl || '');
    setCoverUrl(session.coverUrl || '');
    setHeadline(session.headline || '');
    setLocation(session.location || '');
    setLanguages(session.languages || '');
    setSkills(session.skills || '');
    setSchedule(session.schedule || '');
    setWebsiteUrl(session.websiteUrl || '');
    setBio(session.bio || '');
    setAge(session.age || '');
    setGender(session.gender || '');
    setHobbies(session.hobbies || '');
    setShowBio(session.showBio !== false);
    setShowAge(Boolean(session.showAge));
    setShowGender(Boolean(session.showGender));
    setShowLocation(session.showLocation !== false);
    setShowLanguages(session.showLanguages !== false);
    setShowSkills(session.showSkills !== false);
    setShowSchedule(session.showSchedule !== false);
    setShowHobbies(session.showHobbies !== false);
    setShowWebsite(session.showWebsite !== false);
    setShowFollowers(session.showFollowers !== false);
    setShowVisits(session.showVisits !== false);
    setAllowDm(session.allowDm !== false);
    setBannerPos(session.bannerPos || 'below_stage');
    setBannerSize(session.bannerSize || '728x90');
    if (session.role === 'staff' && subTab === 'profile' && !initialSubTab) {
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
        if (Array.isArray(data.dailyTasks)) {
          setDailyTasks(data.dailyTasks);
        }
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
          avatarUrl,
          coverUrl,
          headline,
          location,
          languages,
          skills,
          schedule,
          websiteUrl,
          bio,
          age,
          gender,
          hobbies,
          showBio,
          showAge,
          showGender,
          showLocation,
          showLanguages,
          showSkills,
          showSchedule,
          showHobbies,
          showWebsite,
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
      await loadSocialData();
      pushToast('Creator Biodata, photos & visibility settings saved!', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadImage = async (target: 'avatar' | 'cover', file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, target === 'avatar' ? 420 : 1080, 0.8);
      if (target === 'avatar') setAvatarUrl(dataUrl);
      else setCoverUrl(dataUrl);
      pushToast(
        `${target === 'avatar' ? 'Profile photo' : 'Cover banner'} ready — click Save Biodata & Photos to publish.`,
        'info'
      );
    } catch {
      pushToast('Could not process that image. Please choose a JPEG, PNG, or WebP photo.', 'error');
    }
  };

  const handleClaimDailyTask = async (taskId: string) => {
    setClaimingTaskId(taskId);
    try {
      const res = await authFetch(`/api/me/daily-tasks/${encodeURIComponent(taskId)}/claim`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not claim task reward.', 'error');
        return;
      }
      updateSessionFromResp(data.session);
      if (Array.isArray(data.tasks)) setDailyTasks(data.tasks);
      pushToast(
        `Task claimed! +${data.rewardXp} XP, +${data.rewardCoins} Coins, +${data.rewardTokens} Tokens!`,
        'success'
      );
    } finally {
      setClaimingTaskId(null);
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
  const levelInfo = computeLevelInfo(session.xp);
  const libraryPhotos = mediaLibrary.filter((m) => m.type === 'photo');

  const tabs: Array<{ id: MeTab; label: string; icon: React.ElementType }> = [
    { id: 'profile', label: 'Biodata & Tasks', icon: User },
    { id: 'wallet', label: 'Wallet & Shop', icon: Wallet },
    { id: 'vip', label: 'VIP & Levels', icon: Crown },
    { id: 'earning', label: 'Join Free to Earn', icon: DollarSign },
    { id: 'safety', label: 'Safety & 2FA', icon: KeyRound },
    ...(session.role === 'staff' ? [{ id: 'staff' as MeTab, label: 'Staff Console', icon: Shield }] : []),
  ];

  return (
    <main className="sl-fluid-page py-5 pb-24 md:pb-12 space-y-5">
      {/* Account Identity Header with Cover Banner & Avatar */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        {/* Cover Banner Strip */}
        <div className="relative h-24 sm:h-28 w-full bg-gradient-to-r from-[var(--accent-primary)]/25 via-[var(--bg-elevated)] to-[var(--accent-secondary)]/25">
          {(coverUrl || session.coverUrl) && (
            <img
              src={coverUrl || session.coverUrl}
              alt="Profile cover"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
          {onViewPublicProfile && (
            <button
              type="button"
              onClick={() => onViewPublicProfile(session.uid)}
              className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/65 px-2.5 text-[11px] font-semibold text-white hover:bg-black/85 backdrop-blur-xs cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview Public Biodata</span>
            </button>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="-mt-10 relative z-10 h-16 w-16 rounded-2xl border-4 border-[var(--bg-surface)] bg-[var(--bg-elevated)] overflow-hidden shadow-md shrink-0 flex items-center justify-center">
                {avatarUrl || session.avatarUrl ? (
                  <img
                    src={avatarUrl || session.avatarUrl}
                    alt={session.displayName}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl">{countryFlag(session.countryCode)}</span>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm leading-none">{countryFlag(session.countryCode)}</span>
                  <h1 className="font-display text-lg font-bold">{session.displayName}</h1>
                  {session.verified && (
                    <BadgeCheck
                      className={`h-4 w-4 ${session.partnerVerified ? 'text-emerald-500' : 'text-sky-400'}`}
                    />
                  )}
                  {session.partnerVerified && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      PARTNER
                    </span>
                  )}
                  <span className="font-mono-nums text-xs text-[var(--fg-muted)]">#{session.numericId}</span>
                  <span className="rounded bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--accent-primary)]">
                    {session.role}
                  </span>
                  {isVipActive && (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      VIP {session.vipTier.toUpperCase()}
                    </span>
                  )}
                  {session.isPro && (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      PRO
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-[var(--fg-secondary)]">
                  <span>UID: {session.uid}</span>
                  <span>·</span>
                  <span className="font-semibold text-[var(--fg-primary)]">
                    Lv.{levelInfo.level} <span className={levelInfo.rankAccent}>({levelInfo.rankTitle})</span>
                  </span>
                  <span>·</span>
                  <span className="font-mono-nums">
                    {levelInfo.xpIntoLevel.toLocaleString()}/{levelInfo.xpRequiredForNext.toLocaleString()} XP to Lv.{Math.min(300, levelInfo.level + 1)}
                  </span>
                  <span>·</span>
                  <span>Following {followingHostUids.length}</span>
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
                <span className="flex items-center gap-1 text-sky-700 dark:text-cyan-400 font-bold">
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
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--fg-secondary)] hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-500/40 cursor-pointer"
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
                      : tab.id === 'earning'
                        ? 'bg-emerald-500/12 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                        : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* TAB 1: CREATOR BIODATA / CV, AVATAR & COVER PICKER + DAILY HOST TASKS */}
      {subTab === 'profile' && (
        <div className="grid gap-5 xl:grid-cols-3 items-start">
          {/* Left 2 Columns: Creator Biodata / CV & Public Visibility Builder */}
          <form
            onSubmit={handleSaveProfile}
            className="xl:col-span-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
              <div>
                <h2 className="font-display text-base font-bold">Creator Biodata / CV &amp; Public Visibility</h2>
                <p className="text-[11px] text-[var(--fg-secondary)]">
                  Set your profile pic &amp; cover banner from your device or Library, and choose exactly what visitors see.
                </p>
              </div>
              {onViewPublicProfile && (
                <button
                  type="button"
                  onClick={() => onViewPublicProfile(session.uid)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                  Preview Public CV
                </button>
              )}
            </div>

            {/* Profile Picture & Cover Banner Pickers (Upload OR Direct From Library) */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] overflow-hidden shrink-0 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-5 w-5 text-[var(--fg-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">Profile Picture</div>
                    <div className="text-[10px] text-[var(--fg-secondary)]">Shown on Home cards &amp; Live Room</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <label className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold cursor-pointer hover:border-[var(--accent-primary)]">
                    <Upload className="h-3 w-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleUploadImage('avatar', e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setLibraryPickerTarget((t) => (t === 'avatar' ? 'none' : 'avatar'))
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--accent-secondary)]/50 bg-[var(--accent-secondary)]/12 px-2.5 text-[11px] font-semibold text-[var(--accent-secondary)] cursor-pointer"
                  >
                    <Film className="h-3 w-3" />
                    <span>From Library ({libraryPhotos.length})</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="h-8 rounded-lg px-2 text-[11px] text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-24 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] overflow-hidden shrink-0 flex items-center justify-center">
                    {coverUrl ? (
                      <img src={coverUrl} alt="Cover preview" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-[var(--fg-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">Cover Photo</div>
                    <div className="text-[10px] text-[var(--fg-secondary)]">Header banner on your Biodata CV</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <label className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold cursor-pointer hover:border-[var(--accent-primary)]">
                    <Upload className="h-3 w-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleUploadImage('cover', e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setLibraryPickerTarget((t) => (t === 'cover' ? 'none' : 'cover'))
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--accent-secondary)]/50 bg-[var(--accent-secondary)]/12 px-2.5 text-[11px] font-semibold text-[var(--accent-secondary)] cursor-pointer"
                  >
                    <Film className="h-3 w-3" />
                    <span>From Library ({libraryPhotos.length})</span>
                  </button>
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverUrl('')}
                      className="h-8 rounded-lg px-2 text-[11px] text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Direct Library Photo Picker Strip */}
            {libraryPickerTarget !== 'none' && (
              <div className="rounded-xl border border-[var(--accent-secondary)]/50 bg-[var(--bg-canvas)] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--accent-secondary)]">
                    Pick {libraryPickerTarget === 'avatar' ? 'Profile Picture' : 'Cover Photo'} from Studio Library
                  </span>
                  <button
                    type="button"
                    onClick={() => setLibraryPickerTarget('none')}
                    className="text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {libraryPhotos.length === 0 ? (
                  <p className="text-[11px] text-[var(--fg-secondary)]">
                    No photos saved in your Studio Library yet. Capture a snapshot in Camera Studio or import a photo in Library!
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {libraryPhotos.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (libraryPickerTarget === 'avatar') setAvatarUrl(item.url);
                          else setCoverUrl(item.url);
                          setLibraryPickerTarget('none');
                          pushToast(
                            `Selected "${item.label}" as ${libraryPickerTarget === 'avatar' ? 'Profile Pic' : 'Cover Photo'}. Click Save to publish!`,
                            'info'
                          );
                        }}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] cursor-pointer"
                      >
                        <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[9px] text-white truncate">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Biodata / CV Structured Fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs sm:col-span-2">
                <span className="text-[var(--fg-secondary)]">Creator Headline / Role Title (CV Summary)</span>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Live Gaming Host · Dual-Cam Storyteller · Music Producer"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Country &amp; Flag</span>
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
                <span className="text-[var(--fg-secondary)]">City / Location</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Mumbai, India / Austin, TX"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Languages Spoken</span>
                <input
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="e.g. English, Hindi, Spanish"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Broadcast Schedule</span>
                <input
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="e.g. Mon–Sat · 8:00 PM IST"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>

              <label className="space-y-1 text-xs sm:col-span-2">
                <span className="text-[var(--fg-secondary)]">Skills &amp; Specialties (comma-separated CV tags)</span>
                <input
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. ST Strike 3D, Acoustic Guitar, Podcast Hosting, Color Grading"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Hobbies / Interests</span>
                <input
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder="Music, FPS, IRL Travel..."
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-[var(--fg-secondary)]">Portfolio / Social Website (HTTPS)</span>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://your-portfolio.com"
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
              <span className="text-[var(--fg-secondary)]">Experience &amp; Bio</span>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your creator background, live show format, and achievements..."
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)]"
              />
            </label>

            {/* Granular Public Visibility Controls (Assign What People See) */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-[var(--fg-primary)]">
                Public Profile Visibility (Choose What Visitors Can See)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'Show Bio / Experience', val: showBio, set: setShowBio },
                  { label: 'Show Location', val: showLocation, set: setShowLocation },
                  { label: 'Show Languages', val: showLanguages, set: setShowLanguages },
                  { label: 'Show Skills Tags', val: showSkills, set: setShowSkills },
                  { label: 'Show Live Schedule', val: showSchedule, set: setShowSchedule },
                  { label: 'Show Hobbies', val: showHobbies, set: setShowHobbies },
                  { label: 'Show Website Link', val: showWebsite, set: setShowWebsite },
                  { label: 'Show Age', val: showAge, set: setShowAge },
                  { label: 'Show Gender', val: showGender, set: setShowGender },
                  { label: 'Show Followers', val: showFollowers, set: setShowFollowers },
                  { label: 'Show Room Visits', val: showVisits, set: setShowVisits },
                  { label: 'Allow Direct DMs', val: allowDm, set: setAllowDm },
                ].map((item) => (
                  <label
                    key={item.label}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.val}
                      onChange={(e) => item.set(e.target.checked)}
                      className="accent-[var(--accent-primary)]"
                    />
                    <span className="truncate">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-xl bg-[var(--accent-primary)] px-5 text-xs font-bold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
            >
              {busy ? 'Saving...' : 'Save Biodata, Photos & Visibility'}
            </button>
          </form>

          {/* Right Column: Daily Host Tasks + Room Blocklist */}
          <div className="space-y-5">
            {/* Daily Host Tasks Panel */}
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-base font-bold">
                    <ClipboardCheck className="h-4 w-4 text-[var(--accent-secondary)]" />
                    <span>Daily Host Tasks</span>
                  </h2>
                  <p className="text-[11px] text-[var(--fg-secondary)]">
                    Complete daily creator goals to level up &amp; earn XP, Coins &amp; Tokens.
                  </p>
                </div>
                <span className="font-mono-nums text-xs font-bold text-[var(--accent-secondary)]">
                  {dailyTasks.filter((t) => t.claimed).length}/{dailyTasks.length || 6}
                </span>
              </div>

              <div className="space-y-2.5">
                {dailyTasks.map((task) => {
                  const pct = Math.min(100, Math.round((task.progress / Math.max(1, task.target)) * 100));
                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl border p-3 space-y-2 ${
                        task.claimed
                          ? 'border-emerald-500/30 bg-emerald-500/8'
                          : task.completed
                            ? 'border-[var(--accent-secondary)]/55 bg-[var(--accent-secondary)]/8'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--fg-primary)]">{task.title}</div>
                          <div className="text-[11px] text-[var(--fg-secondary)] leading-snug">
                            {task.description}
                          </div>
                        </div>
                        <span className="font-mono-nums text-[10px] font-bold text-[var(--fg-muted)] shrink-0">
                          {task.progress}/{task.target}
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            task.claimed
                              ? 'bg-emerald-500'
                              : task.completed
                                ? 'bg-[var(--accent-secondary)]'
                                : 'bg-[var(--accent-primary)]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 font-mono-nums text-[10px]">
                          <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-bold text-[var(--accent-primary)]">
                            +{task.rewardXp} XP
                          </span>
                          <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-bold text-[var(--accent-gold)]">
                            +{task.rewardCoins}c
                          </span>
                          <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-bold text-[var(--accent-secondary)]">
                            +{task.rewardTokens}T
                          </span>
                        </div>

                        {task.claimed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Claimed
                          </span>
                        ) : task.completed ? (
                          <button
                            type="button"
                            disabled={claimingTaskId === task.id}
                            onClick={() => handleClaimDailyTask(task.id)}
                            className="h-7 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-500 cursor-pointer"
                          >
                            {claimingTaskId === task.id ? '...' : 'Claim Reward'}
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-[var(--fg-muted)]">In Progress</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Blocklist Card */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Ban className="h-4 w-4 text-rose-700 dark:text-rose-400" />
                <span>Room Blocklist ({blockedUsers.length}/200)</span>
              </h2>
              {blockedUsers.length === 0 ? (
                <p className="text-xs text-[var(--fg-secondary)]">
                  No blocked users. You can block disruptive users from any live room you host.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
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
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 cursor-default'
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

      {/* TAB 3: VIP & PROGRESSIVE LEVELS (1-300) */}
      {subTab === 'vip' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold">
                  <Award className="h-4 w-4 text-[var(--accent-secondary)]" />
                  <span>
                    Level {levelInfo.level} / 300 · <span className={levelInfo.rankAccent}>{levelInfo.rankTitle}</span>
                  </span>
                </h2>
                <p className="text-[11px] text-[var(--fg-secondary)]">
                  Progressive difficulty curve: fast early levels, steeper prestige XP requirements every level up!
                </p>
              </div>
              <span className="font-mono-nums text-xs font-semibold text-[var(--fg-primary)]">
                {levelInfo.xpIntoLevel.toLocaleString()} / {levelInfo.xpRequiredForNext.toLocaleString()} XP ({levelInfo.progressPct}%)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-gold)] transition-all"
                style={{ width: `${levelInfo.progressPct}%` }}
              />
            </div>

            {/* Progressive Curve Milestones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LEVEL_MILESTONES.map((m) => {
                const reached = levelInfo.level >= m.level;
                return (
                  <div
                    key={m.level}
                    className={`rounded-xl border p-2.5 text-xs ${
                      reached
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono-nums">
                      <span className="font-bold text-[var(--fg-primary)]">Lv.{m.level}</span>
                      {reached && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </div>
                    <div className={`text-[11px] font-semibold ${m.accent}`}>{m.rank}</div>
                    <div className="mt-1 font-mono-nums text-[10px] text-[var(--fg-muted)]">
                      {m.totalXp.toLocaleString()} total XP
                      {m.nextStepXp > 0 ? ` · +${m.nextStepXp.toLocaleString()} next` : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-4 text-[11px] text-[var(--fg-secondary)]">
              <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">Daily Host Tasks: <strong className="text-[var(--fg-primary)]">+45–150 XP</strong></div>
              <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">Watch 1 minute: <strong className="text-[var(--fg-primary)]">+2 Tokens +6 XP</strong></div>
              <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">Send gift: <strong className="text-[var(--fg-primary)]">+XP / coins</strong></div>
              <div className="rounded-lg bg-[var(--bg-elevated)] p-2.5">Chat message: <strong className="text-[var(--fg-primary)]">+1 XP</strong></div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold">
                  <Crown className="h-4 w-4 text-amber-700 dark:text-amber-400" />
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
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{plan.duration}</span>
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

      {/* TAB 4: JOIN FREE TO EARN (MONETAG + A-ADS + GUIDELINE + DIAMOND CASH-OUT) */}
      {subTab === 'earning' && (
        <div className="space-y-6">
          <FreeToEarnHub />

          {/* Diamond Cash-Out */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Gem className="h-4 w-4 text-sky-600 dark:text-cyan-400" />
                <span>Diamond Cash-Out (1,000 D = $1.00)</span>
              </h2>
              <p className="text-xs text-[var(--fg-secondary)]">
                Minimum 5,000 Diamonds ($5.00). 24h cooldown. Denied payouts refund automatically.
              </p>
            </div>
            <form onSubmit={handleRequestPayout} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
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
                <label className="space-y-1 text-xs">
                  <span className="text-[var(--fg-secondary)]">Destination Email / Wallet Address</span>
                  <input
                    required
                    value={payoutDestination}
                    onChange={(e) => setPayoutDestination(e.target.value)}
                    placeholder="creator@example.com or TWallet..."
                    className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                  />
                </label>
              </div>
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
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : p.status === 'denied'
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                  session.totpEnabled ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-[var(--bg-elevated)] text-[var(--fg-muted)]'
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
                className="h-9 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 text-xs font-semibold text-rose-700 dark:text-rose-400 cursor-pointer"
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
                ['aads', `A-ADS (${staffData?.aadsQueue?.length || 0})`],
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
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {m.displayName} ({m.uid} {m.numericId ? `#${m.numericId}` : ''}) · Pub {m.publisherId} ·{' '}
                          {m.status.toUpperCase()}
                        </div>
                        <div className="text-[11px] text-[var(--fg-secondary)] truncate">
                          {m.email ? `${m.email} · ` : ''}
                          {m.tipUrl}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleStaffAction(
                              `/api/staff/monetag/${m.uid}/verify`,
                              { status: 'verified' },
                              'Creator Monetag verified & Partner Badge granted!'
                            )
                          }
                          className="rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleStaffAction(
                              `/api/staff/monetag/${m.uid}/verify`,
                              { status: 'rejected' },
                              'Monetag application rejected.'
                            )
                          }
                          className="rounded bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                ))}

              {staffSection === 'aads' &&
                (!staffData.aadsQueue || staffData.aadsQueue.length === 0 ? (
                  <p className="text-xs text-[var(--fg-secondary)]">No A-ADS Custom Banner applications.</p>
                ) : (
                  staffData.aadsQueue.map((a) => (
                    <div
                      key={a.uid}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {a.displayName} ({a.uid} {a.numericId ? `#${a.numericId}` : ''}) · Unit #{a.unitId} ·{' '}
                          {a.status.toUpperCase()}
                        </div>
                        <div className="text-[11px] text-[var(--fg-secondary)] truncate">
                          {a.email ? `${a.email} · ` : ''}Placement: {a.bannerPos} ({a.bannerSize})
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleStaffAction(
                              `/api/staff/aads/${a.uid}/verify`,
                              { status: 'verified' },
                              'Creator A-ADS Banner verified & Partner Badge granted!'
                            )
                          }
                          className="rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleStaffAction(
                              `/api/staff/aads/${a.uid}/verify`,
                              { status: 'rejected' },
                              'A-ADS application rejected.'
                            )
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
                  {((staffData.threat.activeBlocks ?? staffData.threat.entries ?? []).length === 0) ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Zero actively blocked threat keys.</span>
                    </div>
                  ) : (
                    (staffData.threat.activeBlocks ?? staffData.threat.entries ?? []).map((b) => (
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

import React, { useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  AADS_BANNER_PLACEMENTS,
  AADS_BANNER_SIZES,
  AADS_REFERRAL_IS_PLACEHOLDER,
  AADS_REFERRAL_URL,
  EARNING_CHECKLIST_ITEMS,
  EARNING_MACHINE_GUIDELINE_SECTIONS,
  HOST_COPYABLE_CTA_SCRIPT,
  MONETAG_REFERRAL_URL,
  VERIFICATION_EMAIL,
  buildVerificationLinks,
  buildVerificationMessage,
  extractSafeAadsUnitId,
} from '../lib/monetization';
import type { BannerPlacement, BannerSize } from '../types';

export const FreeToEarnHub: React.FC = () => {
  const { session, setSession, authFetch, pushToast } = useApp();

  // Guideline playbook accordion
  const [guideOpen, setGuideOpen] = useState<boolean>(true);

  // Monetag Form State
  const [monetagEmail, setMonetagEmail] = useState(session?.monetagEmail || '');
  const [monetagPubId, setMonetagPubId] = useState(session?.monetagPublisherId || '');
  const [monetagTipUrl, setMonetagTipUrl] = useState(session?.monetagTipUrl || '');
  const [monetagBusy, setMonetagBusy] = useState(false);

  // A-ADS Form State
  const [aadsEmail, setAadsEmail] = useState(session?.aadsEmail || '');
  const [aadsRawCode, setAadsRawCode] = useState(session?.aadsUnitId || '');
  const [aadsBannerPos, setAadsBannerPos] = useState<BannerPlacement>(session?.aadsBannerPos || 'below_stage');
  const [aadsBannerSize, setAadsBannerSize] = useState<BannerSize>(session?.aadsBannerSize || '728x90');
  const [aadsBusy, setAadsBusy] = useState(false);
  const [placementBusy, setPlacementBusy] = useState(false);

  // Mandatory Pre-Submit Guideline Checklist (shared gate so hosts read & tick every line)
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const allChecklistTicked = EARNING_CHECKLIST_ITEMS.every((item) => Boolean(checkedIds[item.id]));
  const tickedCount = EARNING_CHECKLIST_ITEMS.filter((item) => Boolean(checkedIds[item.id])).length;

  const parsedAadsUnitId = useMemo(() => extractSafeAadsUnitId(aadsRawCode), [aadsRawCode]);

  if (!session) return null;

  const monetagPacket = buildVerificationMessage({
    network: 'Monetag',
    uid: session.uid,
    numericId: session.numericId,
    displayName: session.displayName,
    partnerEmail: monetagEmail.trim() || '(enter your Monetag email)',
    publisherOrUnitId: monetagPubId.trim() || '(enter Publisher ID)',
    directLinkOrPlacement: monetagTipUrl.trim() || '(enter HTTPS Direct Link)',
  });
  const monetagLinks = buildVerificationLinks(monetagPacket, 'Monetag', session.uid);

  const aadsPacket = buildVerificationMessage({
    network: 'A-ADS',
    uid: session.uid,
    numericId: session.numericId,
    displayName: session.displayName,
    partnerEmail: aadsEmail.trim() || '(enter your A-ADS email)',
    publisherOrUnitId: parsedAadsUnitId || '(enter Unit ID)',
    directLinkOrPlacement: `${aadsBannerPos} · ${aadsBannerSize}`,
  });
  const aadsLinks = buildVerificationLinks(aadsPacket, 'A-ADS', session.uid);

  const toggleChecklist = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    pushToast(`${label} copied!`, 'success');
  };

  const handleSubmitMonetag = async () => {
    if (!allChecklistTicked) {
      pushToast('Please tick every box in the Mandatory Earning Checklist before submitting.', 'error');
      return;
    }
    setMonetagBusy(true);
    try {
      const res = await authFetch('/api/economy/monetag', {
        method: 'POST',
        body: JSON.stringify({
          email: monetagEmail.trim(),
          publisherId: monetagPubId.trim(),
          tipUrl: monetagTipUrl.trim(),
          checklistAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not submit Monetag application.', 'error');
        return;
      }
      if (data.session) {
        setSession({ ...data.session, token: session.token, isTestMode: session.isTestMode });
      }
      pushToast(
        'Monetag submitted! Now send your verification packet via Telegram, WhatsApp, or Email for fast approval.',
        'success'
      );
    } finally {
      setMonetagBusy(false);
    }
  };

  const handleSubmitAads = async () => {
    if (!allChecklistTicked) {
      pushToast('Please tick every box in the Mandatory Earning Checklist before submitting.', 'error');
      return;
    }
    if (!parsedAadsUnitId) {
      pushToast('Enter a valid 4–12 digit A-ADS Ad Unit ID or paste your A-ADS iframe snippet.', 'error');
      return;
    }
    setAadsBusy(true);
    try {
      const res = await authFetch('/api/economy/aads', {
        method: 'POST',
        body: JSON.stringify({
          email: aadsEmail.trim(),
          unitId: parsedAadsUnitId,
          bannerPos: aadsBannerPos,
          bannerSize: aadsBannerSize,
          checklistAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not submit A-ADS application.', 'error');
        return;
      }
      if (data.session) {
        setSession({ ...data.session, token: session.token, isTestMode: session.isTestMode });
      }
      pushToast(
        `A-ADS Unit #${parsedAadsUnitId} queued! Send your packet via Telegram, WhatsApp, or Email to activate your badge.`,
        'success'
      );
    } finally {
      setAadsBusy(false);
    }
  };

  const handleSavePlacementOnly = async () => {
    setPlacementBusy(true);
    try {
      const res = await authFetch('/api/economy/aads/placement', {
        method: 'PATCH',
        body: JSON.stringify({ bannerPos: aadsBannerPos, bannerSize: aadsBannerSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Could not update banner placement.', 'error');
        return;
      }
      if (data.session) {
        setSession({ ...data.session, token: session.token, isTestMode: session.isTestMode });
      }
      pushToast(`Live A-ADS banner placement updated: ${aadsBannerPos.replace('_', ' ')} (${aadsBannerSize})`, 'success');
    } finally {
      setPlacementBusy(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          <BadgeCheck className="h-3.5 w-3.5" /> VERIFIED PARTNER
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
          PENDING MANUAL VERIFICATION
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
          NEEDS RESUBMISSION
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--fg-secondary)]">
        NOT CONNECTED
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Hero Banner: Join Free to Earn Program */}
      <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/10 via-[var(--bg-surface)] to-[var(--accent-primary)]/10 p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span>Join Free to Earn · Creator Partner Machine</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--fg-primary)]">
              Unlock Verified Partner Tick + Free Tip Button + Custom Live Ad Banners
            </h2>
            <p className="text-xs leading-relaxed text-[var(--fg-secondary)]">
              Register through our official partner referral links, submit your Publisher / Unit ID with your StreamLive
              User ID (<strong>{session.uid}</strong> · <strong>#{session.numericId}</strong>), and verify directly via
              Telegram, WhatsApp, or Email. You can use a separate email ID for Monetag or A-ADS.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {session.partnerVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                <BadgeCheck className="h-4 w-4" /> Partner Tick Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" /> Earn 100% Free to Join
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Step-by-Step Host Earning Machine Playbook (Line-by-Line Guide + Legal CPC/CPM Boost) */}
      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-[var(--bg-elevated)]/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
            <div>
              <h3 className="font-display text-sm font-bold text-[var(--fg-primary)]">
                Complete Host Earning Machine Guideline (Read Before Submitting)
              </h3>
              <p className="text-[11px] text-[var(--fg-secondary)]">
                Step-by-step referral setup, ethical high-CPC &amp; high-CPM tactics, and viewer chat script
              </p>
            </div>
          </div>
          {guideOpen ? (
            <ChevronUp className="h-4 w-4 text-[var(--fg-secondary)] shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--fg-secondary)] shrink-0" />
          )}
        </button>

        {guideOpen && (
          <div className="border-t border-[var(--border-hairline)] p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {EARNING_MACHINE_GUIDELINE_SECTIONS.map((sec) => (
                <div
                  key={sec.step}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 font-mono-nums text-[11px] font-bold text-[var(--accent-primary)]">
                      {sec.step}
                    </span>
                    <h4 className="font-display text-xs sm:text-sm font-bold text-[var(--fg-primary)]">
                      {sec.title}
                    </h4>
                  </div>
                  <ul className="space-y-1.5 text-xs leading-relaxed text-[var(--fg-secondary)]">
                    {sec.lines.map((line, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent-secondary)] shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* 1-Click Copyable Viewer Callout Script for Higher Ethical Engagement */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Policy-Safe Host Chat Callout (Boosts Natural Viewer Support)
                </div>
                <p className="text-xs text-[var(--fg-primary)] italic">&ldquo;{HOST_COPYABLE_CTA_SCRIPT}&rdquo;</p>
              </div>
              <button
                type="button"
                onClick={() => copyText(HOST_COPYABLE_CTA_SCRIPT, 'Host CTA script')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 shrink-0 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Chat Script
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Mandatory Interactive Compliance Checklist Form (Must Tick Every Line Before Submit) */}
      <section className="rounded-2xl border border-amber-500/40 bg-[var(--bg-surface)] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-display text-sm font-bold text-[var(--fg-primary)]">
              Mandatory Pre-Submit Host Agreement Checklist
            </h3>
          </div>
          <span
            className={`font-mono-nums text-xs font-bold ${
              allChecklistTicked ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {tickedCount}/{EARNING_CHECKLIST_ITEMS.length} Confirmed
          </span>
        </div>
        <p className="text-xs text-[var(--fg-secondary)]">
          Read and tick every box below to unlock final submission for Monetag Free Tip and A-ADS Custom Banners.
        </p>

        <div className="space-y-2">
          {EARNING_CHECKLIST_ITEMS.map((item) => {
            const ticked = Boolean(checkedIds[item.id]);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleChecklist(item.id)}
                className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                  ticked
                    ? 'border-emerald-500/45 bg-emerald-500/10 text-[var(--fg-primary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)] hover:border-[var(--accent-primary)]/50'
                }`}
              >
                {ticked ? (
                  <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-4 w-4 text-[var(--fg-muted)] shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Two Partner Integration Cards: Monetag (Free Tip) & A-ADS (Custom Banner Placement) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* CARD 1: MONETAG FREE-TIP PARTNER */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-[var(--fg-primary)]">
                1. Monetag · Free Tip Button
              </h3>
              <p className="text-[11px] text-[var(--fg-secondary)]">
                Custom HTTPS Direct Link + Verified Partner Tick on Profile &amp; Live Room
              </p>
            </div>
            {statusBadge(session.monetagStatus)}
          </div>

          {/* Step 1 Referral CTA */}
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Step 1 · Join Monetag Through Official Referral Link
              </div>
              <div className="font-mono-nums text-[11px] text-[var(--fg-secondary)] truncate">
                {MONETAG_REFERRAL_URL}
              </div>
            </div>
            <a
              href={MONETAG_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-500 shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Join Monetag Free
            </a>
          </div>

          {/* Step 2 Credentials Form */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[var(--fg-primary)]">
              Step 2 · Enter Your Monetag Details (Different Email Allowed)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-secondary)]">
                  Monetag Account Email
                </label>
                <input
                  type="email"
                  value={monetagEmail}
                  onChange={(e) => setMonetagEmail(e.target.value)}
                  placeholder="your-monetag@email.com"
                  className="mt-1 w-full h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--fg-primary)]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-secondary)]">
                  Monetag Publisher ID
                </label>
                <input
                  type="text"
                  value={monetagPubId}
                  onChange={(e) => setMonetagPubId(e.target.value)}
                  placeholder="e.g. PUB-884210"
                  className="mt-1 w-full h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs font-mono-nums text-[var(--fg-primary)]"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--fg-secondary)]">
                Custom Monetag Direct Link (Assigned to Your Live &ldquo;Free Tip&rdquo; Button)
              </label>
              <input
                type="url"
                value={monetagTipUrl}
                onChange={(e) => setMonetagTipUrl(e.target.value)}
                placeholder="https://your-monetag-direct-link.com/..."
                className="mt-1 w-full h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--fg-primary)]"
              />
            </div>

            <button
              type="button"
              disabled={!allChecklistTicked || monetagBusy}
              onClick={handleSubmitMonetag}
              className="w-full h-10 rounded-xl bg-[var(--accent-primary)] text-xs font-bold text-[var(--accent-contrast)] disabled:opacity-45 cursor-pointer"
            >
              {monetagBusy
                ? 'Submitting...'
                : allChecklistTicked
                  ? 'Submit Monetag for Verification'
                  : `Tick All ${EARNING_CHECKLIST_ITEMS.length} Checklist Boxes Above to Submit`}
            </button>
          </div>

          {/* Step 3 Direct Manual Verification Dispatch (Telegram / WhatsApp / Email) */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--fg-primary)]">
                Step 3 · Send Manual Verification (with UID {session.uid})
              </span>
              <button
                type="button"
                onClick={() => copyText(monetagPacket, 'Monetag verification packet')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                <Copy className="h-3 w-3" /> Copy Packet
              </button>
            </div>
            <p className="text-[11px] text-[var(--fg-secondary)]">
              Send your pre-filled StreamLive UID, Monetag email &amp; Publisher ID directly to our verification desk:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={monetagLinks.telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/12 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
              >
                <Send className="h-3.5 w-3.5" /> Telegram
              </a>
              <a
                href={monetagLinks.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a
                href={monetagLinks.emailHref}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)]"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            </div>
            <div className="text-[10px] font-mono-nums text-[var(--fg-muted)]">
              Verification Email: {VERIFICATION_EMAIL}
            </div>
          </div>
        </section>

        {/* CARD 2: A-ADS CUSTOM LIVE BANNER PARTNER */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-[var(--fg-primary)]">
                2. A-ADS · Custom Live Screen Banner
              </h3>
              <p className="text-[11px] text-[var(--fg-secondary)]">
                Choose your exact banner slot &amp; size inside your Live Room + Verified Badge
              </p>
            </div>
            {statusBadge(session.aadsStatus)}
          </div>

          {/* Step 1 A-ADS Referral CTA */}
          <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-bold text-sky-800 dark:text-sky-300">
                Step 1 · Join A-ADS via StreamLive Referral
              </div>
              <div className="font-mono-nums text-[11px] text-[var(--fg-secondary)] truncate">
                {AADS_REFERRAL_URL}
                {AADS_REFERRAL_IS_PLACEHOLDER ? ' (partner code ready)' : ''}
              </div>
            </div>
            <a
              href={AADS_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-xs font-bold text-white hover:bg-sky-500 shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Join A-ADS
            </a>
          </div>

          {/* Step 2 A-ADS Account & Safe Unit ID Parser */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[var(--fg-primary)]">
              Step 2 · A-ADS Email, Ad Unit Code &amp; Custom Screen Placement
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-secondary)]">A-ADS Account Email</label>
                <input
                  type="email"
                  value={aadsEmail}
                  onChange={(e) => setAadsEmail(e.target.value)}
                  placeholder="your-aads@email.com"
                  className="mt-1 w-full h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--fg-primary)]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--fg-secondary)]">
                  A-ADS Unit ID (or Paste Embed Snippet)
                </label>
                <input
                  type="text"
                  value={aadsRawCode}
                  onChange={(e) => setAadsRawCode(e.target.value)}
                  placeholder="e.g. 2345678 or <iframe data-aa='2345678'...>"
                  className="mt-1 w-full h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs font-mono-nums text-[var(--fg-primary)]"
                />
              </div>
            </div>

            {aadsRawCode.trim() && (
              <div
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-mono-nums ${
                  parsedAadsUnitId
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35'
                    : 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/35'
                }`}
              >
                {parsedAadsUnitId
                  ? `Safe Sandboxed Ad Unit Detected: #${parsedAadsUnitId} (Zero raw script injection)`
                  : 'Could not detect a 4–12 digit A-ADS Unit ID. Enter numbers like 2345678 or official ad.a-ads.com iframe code.'}
              </div>
            )}

            {/* Banner Size Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--fg-secondary)]">Banner Size</label>
              <div className="grid grid-cols-2 gap-1.5">
                {AADS_BANNER_SIZES.map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setAadsBannerSize(sz.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                      aadsBannerSize === sz.id
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/12'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)]/50'
                    }`}
                  >
                    <div className="font-mono-nums text-xs font-bold text-[var(--fg-primary)]">{sz.label}</div>
                    <div className="text-[10px] text-[var(--fg-muted)]">{sz.tip}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Screen Placement Selector + Interactive Mini-Stage Preview */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--fg-secondary)]">
                <LayoutTemplate className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                <span>Custom Screen Placement Inside Your Live Room</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {AADS_BANNER_PLACEMENTS.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setAadsBannerPos(pos.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      aadsBannerPos === pos.id
                        ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/12'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[var(--fg-primary)]">{pos.label}</span>
                      {aadsBannerPos === pos.id && <Check className="h-3 w-3 text-[var(--accent-secondary)]" />}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {pos.cpmHint}
                    </div>
                  </button>
                ))}
              </div>

              {/* Mini Visual Stage Placement Diagram */}
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-[var(--fg-muted)]">
                  <span>Live Room Stage Placement Preview</span>
                  <span className="font-mono-nums font-bold text-[var(--fg-primary)]">
                    {aadsBannerPos.replace('_', ' ').toUpperCase()} · {aadsBannerSize}
                  </span>
                </div>
                {aadsBannerPos === 'top' && (
                  <div className="h-5 rounded bg-sky-500/25 border border-sky-500/60 flex items-center justify-center text-[9px] font-bold text-sky-700 dark:text-sky-300">
                    A-ADS SPONSOR BANNER (TOP OF STAGE)
                  </div>
                )}
                <div className="relative h-20 rounded-lg bg-neutral-900 border border-[var(--border-hairline)] flex items-center justify-center text-[10px] text-white/60">
                  <span>HOST LIVE VIDEO / GAME STAGE</span>
                  {aadsBannerPos === 'lower' && (
                    <div className="absolute inset-x-3 bottom-1.5 h-5 rounded bg-sky-500/35 border border-sky-400/70 flex items-center justify-center text-[9px] font-bold text-sky-200">
                      A-ADS LOWER OVERLAY ({aadsBannerSize})
                    </div>
                  )}
                  {aadsBannerPos === 'corner' && (
                    <div className="absolute right-2 bottom-2 h-11 w-24 rounded bg-sky-500/35 border border-sky-400/70 flex items-center justify-center text-[8px] font-bold text-sky-200 text-center px-1">
                      CORNER DOCK ({aadsBannerSize})
                    </div>
                  )}
                </div>
                {aadsBannerPos === 'below_stage' && (
                  <div className="h-6 rounded bg-emerald-500/20 border border-emerald-500/55 flex items-center justify-center text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                    A-ADS SPONSOR BANNER (BELOW STAGE · HIGHEST CPM)
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!allChecklistTicked || aadsBusy}
                onClick={handleSubmitAads}
                className="flex-1 min-w-[180px] h-10 rounded-xl bg-[var(--accent-primary)] text-xs font-bold text-[var(--accent-contrast)] disabled:opacity-45 cursor-pointer"
              >
                {aadsBusy
                  ? 'Submitting...'
                  : allChecklistTicked
                    ? 'Submit A-ADS for Verification'
                    : `Tick All ${EARNING_CHECKLIST_ITEMS.length} Checklist Boxes Above`}
              </button>
              {session.aadsStatus === 'verified' && (
                <button
                  type="button"
                  disabled={placementBusy}
                  onClick={handleSavePlacementOnly}
                  className="h-10 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                >
                  {placementBusy ? 'Saving...' : 'Update Placement Live'}
                </button>
              )}
            </div>
          </div>

          {/* Step 3 A-ADS Direct Manual Verification Dispatch */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--fg-primary)]">
                Step 3 · Send A-ADS Verification (with UID {session.uid})
              </span>
              <button
                type="button"
                onClick={() => copyText(aadsPacket, 'A-ADS verification packet')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                <Copy className="h-3 w-3" /> Copy Packet
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={aadsLinks.telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/12 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
              >
                <Send className="h-3.5 w-3.5" /> Telegram
              </a>
              <a
                href={aadsLinks.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a
                href={aadsLinks.emailHref}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)]"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

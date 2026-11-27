import type { BannerPlacement, BannerSize } from '../types';

// Official StreamLive Creator Referral Links
export const MONETAG_REFERRAL_URL = 'https://monetag.com/?ref_id=t20f';

// Configurable A-ADS Referral Link (developer can set VITE_AADS_REFERRAL_URL once ready)
const envAadsRef =
  typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AADS_REFERRAL_URL;
export const AADS_REFERRAL_URL =
  envAadsRef && /^https:\/\//i.test(envAadsRef) ? envAadsRef : 'https://aads.com/?partner=stlive';
export const AADS_REFERRAL_IS_PLACEHOLDER = !envAadsRef;

// Manual Verification Dispatch Contacts
export const VERIFICATION_EMAIL = 'ankan.career@gmail.com';
export const VERIFICATION_TELEGRAM_HANDLE =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_VERIFY_TELEGRAM) ||
  '';
export const VERIFICATION_WHATSAPP_NUMBER =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_VERIFY_WHATSAPP) ||
  '';

export const AADS_BANNER_SIZES: Array<{
  id: BannerSize;
  label: string;
  width: number;
  height: number;
  tip: string;
}> = [
  { id: '728x90', label: '728×90 Leaderboard', width: 728, height: 90, tip: 'Highest desktop CPM below stage' },
  { id: '468x60', label: '468×60 Compact Bar', width: 468, height: 60, tip: 'Clean top/lower overlay bar' },
  { id: '320x50', label: '320×50 Mobile Strip', width: 320, height: 50, tip: 'Ideal for mobile & tablet screens' },
  { id: '300x250', label: '300×250 Medium Box', width: 300, height: 250, tip: 'Strong corner dock visibility' },
];

export const AADS_BANNER_PLACEMENTS: Array<{
  id: BannerPlacement;
  label: string;
  desc: string;
  cpmHint: string;
}> = [
  {
    id: 'below_stage',
    label: 'Below Live Stage',
    desc: 'Renders directly underneath your live video/game frame — zero obstruction.',
    cpmHint: 'Best Viewability & CPM',
  },
  {
    id: 'top',
    label: 'Top of Live Stage',
    desc: 'Compact sponsor strip docked cleanly above your live video player.',
    cpmHint: 'Above-the-fold Impressions',
  },
  {
    id: 'lower',
    label: 'Lower Stage Overlay',
    desc: 'Sleek semi-translucent lower-third dock inside your broadcast canvas.',
    cpmHint: 'High Attention During Q&A',
  },
  {
    id: 'corner',
    label: 'Corner Floating Dock',
    desc: 'Compact sponsor box anchored cleanly in the stage corner.',
    cpmHint: 'Great for 300×250 Box',
  },
];

/**
 * Validates that a Monetag Direct Link or portfolio URL uses strictly HTTPS and is not local/malicious.
 */
export function isValidHttpsUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s || s.length > 300) return false;
  try {
    const parsed = new URL(s);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      !host.includes('.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely extracts ONLY a numeric A-ADS Ad Unit ID (4–12 digits) from either:
 * - A plain numeric ID (e.g. "2345678")
 * - An official A-ADS iframe embed snippet (e.g. `<iframe data-aa='2345678' src='//ad.a-ads.com/2345678?size=728x90'></iframe>`)
 * Never trusts or stores raw HTML/scripts.
 */
export function extractSafeAadsUnitId(raw: string): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (/^\d{4,12}$/.test(trimmed)) return trimmed;
  const fromUrl = trimmed.match(/a-ads\.com\/(\d{4,12})/i);
  if (fromUrl?.[1]) return fromUrl[1];
  const fromAttr = trimmed.match(/data-aa\s*=\s*['"]?(\d{4,12})['"]?/i);
  if (fromAttr?.[1]) return fromAttr[1];
  return null;
}

export function buildSafeAadsIframeUrl(unitId: string, size: BannerSize): string | null {
  const cleanId = extractSafeAadsUnitId(unitId);
  if (!cleanId) return null;
  const safeSize: BannerSize = ['728x90', '468x60', '300x250', '320x50'].includes(size) ? size : '728x90';
  return `https://ad.a-ads.com/${cleanId}?size=${safeSize}`;
}

export interface VerificationPacketInput {
  network: 'Monetag' | 'A-ADS';
  uid: string;
  numericId: number;
  displayName: string;
  partnerEmail: string;
  publisherOrUnitId: string;
  directLinkOrPlacement: string;
}

export function buildVerificationMessage(input: VerificationPacketInput): string {
  return [
    `StreamLive Partner Verification Request (${input.network})`,
    `----------------------------------------`,
    `User UID: ${input.uid}`,
    `Numeric ID: #${input.numericId}`,
    `Display Name: ${input.displayName}`,
    `Network: ${input.network}`,
    `Partner Email: ${input.partnerEmail}`,
    `${input.network === 'Monetag' ? 'Publisher ID' : 'A-ADS Unit ID'}: ${input.publisherOrUnitId}`,
    `${input.network === 'Monetag' ? 'Direct Link' : 'Banner Placement'}: ${input.directLinkOrPlacement}`,
    `Checklist & Policy Agreement: Confirmed by Host`,
  ].join('\n');
}

export function buildVerificationLinks(packetText: string, network: 'Monetag' | 'A-ADS', uid: string) {
  const encoded = encodeURIComponent(packetText);
  const subject = encodeURIComponent(`StreamLive ${network} Verification — ${uid}`);

  const emailHref = `mailto:${VERIFICATION_EMAIL}?subject=${subject}&body=${encoded}`;
  const whatsappHref = VERIFICATION_WHATSAPP_NUMBER
    ? `https://wa.me/${VERIFICATION_WHATSAPP_NUMBER.replace(/[^\d]/g, '')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  const telegramHref = VERIFICATION_TELEGRAM_HANDLE
    ? `https://t.me/${VERIFICATION_TELEGRAM_HANDLE.replace(/^@/, '')}?text=${encoded}`
    : `https://t.me/share/url?url=${encodeURIComponent(MONETAG_REFERRAL_URL)}&text=${encoded}`;

  return { emailHref, whatsappHref, telegramHref };
}

export const EARNING_CHECKLIST_ITEMS = [
  {
    id: 'joined_referral',
    label: 'I created my partner account directly through StreamLive’s official referral link (new account, no duplicate referral abuse).',
  },
  {
    id: 'accurate_ids',
    label: 'My StreamLive UID, partner email (may differ from StreamLive email), and Publisher/Unit ID are accurate for manual verification.',
  },
  {
    id: 'no_self_clicks',
    label: 'I will NEVER click my own Free Tip link or A-ADS banner, and I will never use bots, VPNs, or automated traffic.',
  },
  {
    id: 'ethical_cta',
    label: 'I will invite viewers genuinely and transparently (hover guideline explains how Free Tip & Sponsor Banners support the stream).',
  },
  {
    id: 'manual_verify',
    label: 'I understand my Partner Verified badge & live monetization slot activate once manually verified via Telegram, WhatsApp, or Email.',
  },
  {
    id: 'legal_age',
    label: 'I am 18+ (or legal age in my jurisdiction) and comply with Monetag, A-ADS, and StreamLive Creator Safety policies.',
  },
] as const;

export const EARNING_MACHINE_GUIDELINE_SECTIONS = [
  {
    step: '01',
    title: 'How the StreamLive Earning Machine Works',
    lines: [
      'Stack 3 legal revenue streams inside every broadcast: (1) Monetag Free Tip Button (zero cost to viewers), (2) A-ADS Verified Sponsor Banner (passive impressions + optional clicks), and (3) Viewer Gifts -> Diamonds Cash-Out.',
      'Joining through StreamLive’s referral link unlocks your Verified Partner Tick badge on your profile, Home cards, and Live Room — building instant trust with viewers.',
    ],
  },
  {
    step: '02',
    title: 'Step-by-Step Monetag Setup (Free Tip Button)',
    lines: [
      'Tap "Join Monetag via Official Referral" (ref_id=t20f) and register your Monetag publisher account. You may use a separate email ID specifically for Monetag.',
      'Inside Monetag Dashboard -> Direct Links -> Create a new Direct Link and copy the full HTTPS URL.',
      'Paste your Monetag Email, Publisher ID, and Direct Link in the form below, tick every compliance box, submit in-app, and send your verification packet via Telegram, WhatsApp, or Email with your StreamLive User ID.',
    ],
  },
  {
    step: '03',
    title: 'Step-by-Step A-ADS Setup (Custom Screen Banner)',
    lines: [
      'Register on A-ADS via StreamLive’s referral link and create a Site/App Ad Unit (recommended sizes: 728×90 Leaderboard for desktop, 320×50 for mobile, or 300×250 for corner dock).',
      'Copy either your numeric Ad Unit ID (e.g. 2345678) or the official A-ADS iframe snippet — StreamLive safely extracts ONLY the numeric ID and renders it inside a sandboxed frame.',
      'Choose where the banner appears on your Live Room stage (Below Stage, Top Bar, Lower Overlay, or Corner Dock) and send your verification packet to unlock live placement.',
    ],
  },
  {
    step: '04',
    title: 'Maximizing Legal CPC & CPM (Creator Playbook)',
    lines: [
      'Placement & Viewability: "Below Live Stage" (728×90) and "Top of Stage" keep your sponsor banner visible above the fold for longer watch sessions, boosting verified CPM.',
      'Real Engagement > Volume: Networks pay significantly higher eCPM/CPC when real viewers stay on partner pages naturally for 15–30 seconds rather than instant-closing. StreamLive’s built-in 30s anti-spam cooldown protects your traffic quality.',
      'Global Audience Timing: Streaming during peak US/EU/UK/CA hours alongside your local audience blends higher Tier-1 CPM with strong regional engagement.',
      'Honest Viewer Callout: Use our copyable chat callout below — remind viewers that tapping Free Tip or exploring the verified sponsor banner is 100% optional and supports your stream for free.',
    ],
  },
] as const;

export const VIEWER_FREE_TIP_GUIDELINE =
  'Click Free Tip to support this host at zero cost! If a partner window opens, stay briefly and complete any verification or browse naturally so your support counts toward the host.';

export const VIEWER_AADS_GUIDELINE =
  'Verified Sponsor Banner: Viewing or exploring this sponsor naturally (staying briefly if a page opens) helps support this creator’s broadcast for free.';

export const HOST_COPYABLE_CTA_SCRIPT =
  'Want to support this live stream for FREE? Tap the emerald "Free Tip" button above (or check the verified sponsor banner below) — if a partner window opens, stay a few seconds and browse naturally so your support counts! Thank you!';

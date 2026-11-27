export interface StickerItem {
  code: string;
  pack: 'hype' | 'cute' | 'stage' | 'gaming';
  emoji: string;
  label: string;
}

export const STICKER_PACKS: Array<{
  id: 'hype' | 'cute' | 'stage' | 'gaming';
  name: string;
  items: StickerItem[];
}> = [
  {
    id: 'hype',
    name: 'Hype',
    items: [
      { code: '[st:hype:fire]', pack: 'hype', emoji: '🔥', label: 'Fire' },
      { code: '[st:hype:boom]', pack: 'hype', emoji: '💥', label: 'Nova Boom' },
      { code: '[st:hype:rocket]', pack: 'hype', emoji: '🚀', label: 'Rocket' },
      { code: '[st:hype:crown]', pack: 'hype', emoji: '👑', label: 'Crown' },
      { code: '[st:hype:zap]', pack: 'hype', emoji: '⚡', label: 'Surge' },
      { code: '[st:hype:100]', pack: 'hype', emoji: '💯', label: '100%' },
      { code: '[st:hype:gem]', pack: 'hype', emoji: '💎', label: 'Diamond' },
      { code: '[st:hype:party]', pack: 'hype', emoji: '🎉', label: 'Party' },
    ],
  },
  {
    id: 'cute',
    name: 'Cute',
    items: [
      { code: '[st:cute:heart]', pack: 'cute', emoji: '💖', label: 'Spark Heart' },
      { code: '[st:cute:cat]', pack: 'cute', emoji: '🐱', label: 'Kitty' },
      { code: '[st:cute:bunny]', pack: 'cute', emoji: '🐰', label: 'Bunny' },
      { code: '[st:cute:panda]', pack: 'cute', emoji: '🐼', label: 'Panda' },
      { code: '[st:cute:frog]', pack: 'cute', emoji: '🐸', label: 'Froggy' },
      { code: '[st:cute:bear]', pack: 'cute', emoji: '🧸', label: 'Teddy' },
      { code: '[st:cute:star]', pack: 'cute', emoji: '🌟', label: 'Star' },
      { code: '[st:cute:angel]', pack: 'cute', emoji: '😇', label: 'Halo' },
    ],
  },
  {
    id: 'stage',
    name: 'Stage',
    items: [
      { code: '[st:stage:mic]', pack: 'stage', emoji: '🎤', label: 'Mic Drop' },
      { code: '[st:stage:guitar]', pack: 'stage', emoji: '🎸', label: 'Rock On' },
      { code: '[st:stage:dj]', pack: 'stage', emoji: '🎧', label: 'DJ Set' },
      { code: '[st:stage:clap]', pack: 'stage', emoji: '👏', label: 'Applause' },
      { code: '[st:stage:cam]', pack: 'stage', emoji: '🎬', label: 'Action' },
      { code: '[st:stage:spark]', pack: 'stage', emoji: '✨', label: 'Spotlight' },
      { code: '[st:stage:note]', pack: 'stage', emoji: '🎵', label: 'Vibe' },
      { code: '[st:stage:shades]', pack: 'stage', emoji: '😎', label: 'Cool' },
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming',
    items: [
      { code: '[st:gaming:gg]', pack: 'gaming', emoji: '🎮', label: 'GG' },
      { code: '[st:gaming:dice]', pack: 'gaming', emoji: '🎲', label: 'Dice Duel' },
      { code: '[st:gaming:trophy]', pack: 'gaming', emoji: '🏆', label: 'MVP' },
      { code: '[st:gaming:target]', pack: 'gaming', emoji: '🎯', label: 'Headshot' },
      { code: '[st:gaming:swords]', pack: 'gaming', emoji: '⚔️', label: 'PK Clash' },
      { code: '[st:gaming:shield]', pack: 'gaming', emoji: '🛡️', label: 'Clutch' },
      { code: '[st:gaming:skull]', pack: 'gaming', emoji: '💀', label: 'KO' },
      { code: '[st:gaming:phoenix]', pack: 'gaming', emoji: '🔥', label: 'Phoenix' },
    ],
  },
];

export const STICKER_MAP = new Map<string, StickerItem>(
  STICKER_PACKS.flatMap((p) => p.items.map((item) => [item.code, item]))
);

export function parseStickerCode(text: string): StickerItem | null {
  const trimmed = text.trim();
  return STICKER_MAP.get(trimmed) ?? null;
}

/**
 * Client-side PBKDF2-SHA256 100k password stretcher bound to identifier (G-003).
 */
export async function stretchPasswordClient(rawPassword: string, identity: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return rawPassword;
  }
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(rawPassword),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const salt = enc.encode(`stlive:pw:v1:${identity.trim().toLowerCase()}`);
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function evaluatePasswordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
} {
  let pts = 0;
  if (pw.length >= 8) pts++;
  if (pw.length >= 12) pts++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) pts++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) pts++;
  const score = Math.min(4, pts) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Vault-Grade'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
  return { score, label: labels[score], color: colors[score] };
}

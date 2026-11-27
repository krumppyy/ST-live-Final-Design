// Progressive User & Host Leveling Curve (Easy early levels -> progressively harder prestige climb)
// Shared identically between server (server/security.ts) and client UI components.

export const MAX_USER_LEVEL = 300;

export interface LevelProgressInfo {
  level: number;
  maxLevel: number;
  rankTitle: string;
  rankAccent: string;
  totalXp: number;
  xpIntoLevel: number;
  xpRequiredForNext: number;
  progressPct: number;
  totalXpForCurrentLevel: number;
  totalXpForNextLevel: number;
}

/**
 * XP required to advance from `level` to `level + 1`.
 * Level 1 -> 2 = 100 XP (quick onboarding win)
 * Level 2 -> 3 = 197 XP
 * Level 5 -> 6 = 635 XP
 * Level 10 -> 11 = 1,648 XP
 * Level 25 -> 26 = 6,367 XP
 * Level 50 -> 51 = 17,053 XP
 * Level 100 -> 101 = 46,724 XP
 */
export function xpDeltaForNextLevel(level: number): number {
  const safe = Math.max(1, Math.min(MAX_USER_LEVEL, Math.floor(level)));
  const step = safe - 1;
  return Math.round(100 + step * 65 + Math.pow(step, 1.55) * 32);
}

/**
 * Cumulative XP required to REACH `level` (Level 1 starts at 0 XP).
 */
export function cumulativeXpForLevel(level: number): number {
  const target = Math.max(1, Math.min(MAX_USER_LEVEL, Math.floor(level)));
  let total = 0;
  for (let l = 1; l < target; l++) {
    total += xpDeltaForNextLevel(l);
  }
  return total;
}

export function getLevelRank(level: number): { title: string; accent: string } {
  if (level >= 150) return { title: 'Mythic Sovereign', accent: 'text-fuchsia-600 dark:text-fuchsia-400' };
  if (level >= 80) return { title: 'Grand Legend', accent: 'text-amber-600 dark:text-amber-400' };
  if (level >= 40) return { title: 'Elite Broadcaster', accent: 'text-rose-600 dark:text-rose-400' };
  if (level >= 20) return { title: 'Pro Creator', accent: 'text-sky-600 dark:text-sky-400' };
  if (level >= 8) return { title: 'Rising Star', accent: 'text-emerald-700 dark:text-emerald-400' };
  return { title: 'Rookie', accent: 'text-[var(--fg-secondary)]' };
}

export function computeLevelInfo(xp: number): LevelProgressInfo {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let level = 1;
  let totalForCurrent = 0;

  while (level < MAX_USER_LEVEL) {
    const delta = xpDeltaForNextLevel(level);
    if (safeXp < totalForCurrent + delta) {
      const rank = getLevelRank(level);
      const xpIntoLevel = safeXp - totalForCurrent;
      return {
        level,
        maxLevel: MAX_USER_LEVEL,
        rankTitle: rank.title,
        rankAccent: rank.accent,
        totalXp: safeXp,
        xpIntoLevel,
        xpRequiredForNext: delta,
        progressPct: Math.min(100, Math.max(0, Math.round((xpIntoLevel / delta) * 100))),
        totalXpForCurrentLevel: totalForCurrent,
        totalXpForNextLevel: totalForCurrent + delta,
      };
    }
    totalForCurrent += delta;
    level += 1;
  }

  const maxRank = getLevelRank(MAX_USER_LEVEL);
  return {
    level: MAX_USER_LEVEL,
    maxLevel: MAX_USER_LEVEL,
    rankTitle: maxRank.title,
    rankAccent: maxRank.accent,
    totalXp: safeXp,
    xpIntoLevel: 0,
    xpRequiredForNext: 0,
    progressPct: 100,
    totalXpForCurrentLevel: totalForCurrent,
    totalXpForNextLevel: totalForCurrent,
  };
}

export const LEVEL_MILESTONES = [1, 5, 10, 20, 40, 80, 150, 300].map((lvl) => ({
  level: lvl,
  rank: getLevelRank(lvl).title,
  accent: getLevelRank(lvl).accent,
  totalXp: cumulativeXpForLevel(lvl),
  nextStepXp: lvl < MAX_USER_LEVEL ? xpDeltaForNextLevel(lvl) : 0,
}));

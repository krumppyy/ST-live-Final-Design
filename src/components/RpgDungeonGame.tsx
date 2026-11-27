import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Crosshair,
  Crown,
  FlaskConical,
  Heart,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  UserPlus,
  Wand2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { playFpsHitSfx, playStepSfx, playVictorySfx } from '../lib/sfx';
import type { GameRoomState, RpgHeroClass } from '../types';

interface RpgDungeonGameProps {
  game: GameRoomState;
  compact?: boolean;
  isSeated: boolean;
  isPending: boolean;
  canApprove?: boolean;
  onRequestJoin?: () => void;
}

const CLASS_META: Record<
  RpgHeroClass,
  { label: string; skillName: string; roleNote: string; icon: React.ReactNode }
> = {
  vanguard: {
    label: 'Vanguard',
    skillName: 'Aegis Bash',
    roleNote: 'Tank + Party Shield',
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  arcanist: {
    label: 'Arcanist',
    skillName: 'Arcane Nova',
    roleNote: 'Hits All Enemies',
    icon: <Wand2 className="h-3.5 w-3.5" />,
  },
  ranger: {
    label: 'Ranger',
    skillName: 'Piercing Volley',
    roleNote: 'High Single Crit',
    icon: <Crosshair className="h-3.5 w-3.5" />,
  },
  cleric: {
    label: 'Cleric',
    skillName: 'Sanctuary',
    roleNote: 'Heals Entire Party',
    icon: <Heart className="h-3.5 w-3.5" />,
  },
};

export const RpgDungeonGame: React.FC<RpgDungeonGameProps> = ({
  game,
  compact = false,
  isSeated,
  isPending,
  canApprove = false,
  onRequestJoin,
}) => {
  const { session, sendWsEvent } = useApp();
  const rpg = game.rpg;

  const livingEnemies = useMemo(
    () => (rpg?.enemies || []).filter((e) => e.alive),
    [rpg?.enemies]
  );
  const [selectedEnemyId, setSelectedEnemyId] = useState<string>('');

  const effectiveTargetId = useMemo(() => {
    if (livingEnemies.some((e) => e.id === selectedEnemyId)) return selectedEnemyId;
    return livingEnemies[0]?.id || '';
  }, [livingEnemies, selectedEnemyId]);

  if (!rpg) {
    return (
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-6 text-center text-sm text-[var(--fg-secondary)]">
        Initializing Realm Quest Raid...
      </div>
    );
  }

  const currentPlayer = game.players[game.turnIndex];
  const isMyTurn = Boolean(
    session && game.status === 'playing' && currentPlayer?.uid === session.uid
  );
  const myHero = session?.uid ? rpg.heroes[session.uid] : undefined;
  const heroList = game.players
    .map((p) => rpg.heroes[p.uid])
    .filter((h): h is NonNullable<typeof h> => Boolean(h));

  const triggerAction = (action: 'strike' | 'skill' | 'defend' | 'potion') => {
    if (!isMyTurn) return;
    if (action === 'strike' || action === 'skill') playFpsHitSfx(action === 'skill');
    else playStepSfx();
    sendWsEvent('game:rpg_action', {
      roomId: game.roomId,
      action,
      targetEnemyId: effectiveTargetId,
    });
  };

  const handleNextFloor = () => {
    playVictorySfx();
    const nextFloor = Math.min(rpg.maxFloor, rpg.floor + 1);
    sendWsEvent('game:set_level', { roomId: game.roomId, level: nextFloor });
  };

  const handleRetryFloor = () => {
    sendWsEvent('game:set_level', { roomId: game.roomId, level: rpg.floor });
  };

  return (
    <div
      className={`rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] overflow-hidden ${
        compact ? 'p-3 sm:p-4 space-y-3' : 'p-4 sm:p-5 space-y-4'
      }`}
    >
      {/* Top Tactical Floor HUD */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--fg-primary)]">
            <Swords className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
            <span>
              Floor {rpg.floor}/{rpg.maxFloor} · {rpg.zoneName}
            </span>
            <span className="font-mono-nums text-[11px] font-medium text-[var(--fg-muted)]">
              Round {rpg.round}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--fg-secondary)] line-clamp-1">
            {rpg.lastActionText}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono-nums text-[var(--fg-primary)]">
          <span>
            Gold: <strong className="text-amber-600 dark:text-amber-300">{rpg.partyGold}</strong>
          </span>
          <span aria-hidden="true" className="text-[var(--fg-muted)]">·</span>
          <span>
            Potions: <strong className="text-emerald-700 dark:text-emerald-400">{rpg.potions}</strong>
          </span>
        </div>
      </div>

      {/* Floor Cleared or Party Fallen Banner */}
      {game.status === 'finished' && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
            rpg.floorCleared
              ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/12 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {rpg.floorCleared ? <Crown className="h-4 w-4" /> : <Skull className="h-4 w-4" />}
            {rpg.floorCleared
              ? rpg.floor < rpg.maxFloor
                ? `Floor ${rpg.floor} Cleared! Advance party to Floor ${rpg.floor + 1}.`
                : 'Mythic Victory! Elder Wyrm Throne conquered!'
              : 'Party Defeated — Rally and retry this floor.'}
          </span>
          <div className="flex items-center gap-2">
            {rpg.floorCleared && rpg.floor < rpg.maxFloor && (isSeated || canApprove) && (
              <button
                type="button"
                onClick={handleNextFloor}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
              >
                <span>Next Floor ({rpg.floor + 1})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            {(isSeated || canApprove) && (
              <button
                type="button"
                onClick={handleRetryFloor}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--fg-primary)] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{rpg.floorCleared ? 'Replay Floor' : 'Retry Floor'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Enemy Wave Arena */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--fg-muted)]">
          <span>Active Enemies (tap to target)</span>
          <span className="font-mono-nums">{livingEnemies.length}/{rpg.enemies.length} standing</span>
        </div>
        <div className={`grid gap-2.5 ${rpg.enemies.length >= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {rpg.enemies.map((enemy) => {
            const isTarget = enemy.alive && enemy.id === effectiveTargetId;
            const hpPct = Math.max(0, Math.min(100, Math.round((enemy.hp / Math.max(1, enemy.maxHp)) * 100)));
            return (
              <button
                key={enemy.id}
                type="button"
                disabled={!enemy.alive}
                onClick={() => setSelectedEnemyId(enemy.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  !enemy.alive
                    ? 'border-[var(--border-hairline)] bg-[var(--bg-surface)]/40 opacity-50 cursor-default'
                    : isTarget
                      ? 'border-[var(--accent-primary)] bg-[var(--bg-surface)] cursor-pointer'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--fg-muted)] cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-[var(--fg-primary)]">
                    {enemy.name}
                  </span>
                  <span className="text-[10px] font-mono-nums font-semibold text-[var(--fg-muted)] uppercase">
                    {enemy.alive ? enemy.kind : 'KO'}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                  <div
                    className={`h-full transition-all duration-200 ${
                      enemy.kind === 'boss' ? 'bg-rose-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono-nums text-[var(--fg-secondary)]">
                  <span>HP {enemy.hp}/{enemy.maxHp}</span>
                  <span>ATK {enemy.atk}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Party Roster */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--fg-muted)]">
          <span>Live Party ({heroList.length}/4 Heroes)</span>
          {currentPlayer && game.status === 'playing' && (
            <span className="text-[var(--accent-primary)]">
              Turn: {currentPlayer.displayName}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {heroList.map((hero) => {
            const activeTurn = game.status === 'playing' && currentPlayer?.uid === hero.uid;
            const hpPct = Math.max(0, Math.min(100, Math.round((hero.hp / Math.max(1, hero.maxHp)) * 100)));
            const mpPct = Math.max(0, Math.min(100, Math.round((hero.mp / Math.max(1, hero.maxMp)) * 100)));
            const meta = CLASS_META[hero.heroClass];
            return (
              <div
                key={hero.uid}
                className={`rounded-xl border p-3 ${
                  activeTurn
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-surface)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]/75'
                } ${!hero.alive ? 'opacity-55' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[var(--accent-primary)] shrink-0">{meta.icon}</span>
                    <span className="truncate text-xs font-bold text-[var(--fg-primary)]">
                      {hero.displayName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-nums text-[var(--fg-muted)] shrink-0">
                    Lv.{hero.heroLevel} {meta.label}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono-nums text-[var(--fg-secondary)]">
                    <span>
                      HP {hero.hp}/{hero.maxHp}
                      {hero.shield > 0 ? ` (+${hero.shield} Shd)` : ''}
                    </span>
                    <span>MP {hero.mp}/{hero.maxMp}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${hpPct}%` }} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                      <div className="h-full bg-sky-500 transition-all" style={{ width: `${mpPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Combat Controls & Class Picker */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 space-y-3">
        {isSeated && myHero ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--fg-primary)]">
                {isMyTurn
                  ? `Your Turn (${CLASS_META[myHero.heroClass].label}) — Choose Action`
                  : game.status === 'finished'
                    ? 'Floor Complete'
                    : `Waiting for ${currentPlayer?.displayName || 'party'}...`}
              </span>

              <div className="flex flex-wrap items-center gap-1">
                {(['vanguard', 'arcanist', 'ranger', 'cleric'] as RpgHeroClass[]).map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => sendWsEvent('game:rpg_class', { roomId: game.roomId, heroClass: cls })}
                    className={`h-7 rounded-md px-2 text-[11px] font-medium cursor-pointer ${
                      myHero.heroClass === cls
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                        : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                    }`}
                  >
                    {CLASS_META[cls].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() => triggerAction('strike')}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-40 cursor-pointer"
              >
                <Swords className="h-3.5 w-3.5" />
                <span>Strike (+10 MP)</span>
              </button>
              <button
                type="button"
                disabled={!isMyTurn || myHero.mp < 18}
                onClick={() => triggerAction('skill')}
                title={CLASS_META[myHero.heroClass].roleNote}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--accent-primary)] bg-[var(--accent-primary)]/12 px-3 text-xs font-semibold text-[var(--fg-primary)] hover:bg-[var(--accent-primary)]/20 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span className="truncate">{CLASS_META[myHero.heroClass].skillName} (18MP)</span>
              </button>
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() => triggerAction('defend')}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] disabled:opacity-40 cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Guard (+20 Shd)</span>
              </button>
              <button
                type="button"
                disabled={!isMyTurn || rpg.potions <= 0}
                onClick={() => triggerAction('potion')}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-semibold text-[var(--fg-primary)] hover:border-emerald-500 disabled:opacity-40 cursor-pointer"
              >
                <FlaskConical className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Potion ({rpg.potions})</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--fg-secondary)]">
            <span>
              {isPending
                ? 'Your party join request is waiting for Host approval.'
                : 'Spectating live RPG party raid. Request a hero seat to fight alongside the Host!'}
            </span>
            {!isPending && onRequestJoin && (
              <button
                type="button"
                onClick={onRequestJoin}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Join Party</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

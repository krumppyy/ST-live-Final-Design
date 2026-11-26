import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  Crosshair,
  Crown,
  Dices,
  Plus,
  RotateCcw,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { playDiceSfx, playStepSfx, playVictorySfx } from '../lib/sfx';
import type { GamePlayer, GameRoomState, GameType, PlayerColor } from '../types';
import { FpsArenaGame } from './FpsArenaGame';

interface MultiplayerGamesHubProps {
  initialRoomId?: string | null;
  onRequireLogin: () => void;
}

const COLOR_STYLES: Record<PlayerColor, { bg: string; ring: string; label: string; hex: string }> = {
  red: { bg: 'bg-rose-600', ring: 'ring-rose-400', label: 'Red', hex: '#E11D48' },
  green: { bg: 'bg-emerald-600', ring: 'ring-emerald-400', label: 'Green', hex: '#059669' },
  yellow: { bg: 'bg-amber-500', ring: 'ring-amber-300', label: 'Yellow', hex: '#D97706' },
  blue: { bg: 'bg-sky-600', ring: 'ring-sky-400', label: 'Blue', hex: '#0284C7' },
};

// 52-cell outer Ludo path mapped to [row, col] on a 15x15 board
const LUDO_PATH: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

const LUDO_OFFSETS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const LUDO_HOME_LANES: Record<PlayerColor, Array<[number, number]>> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

const LUDO_YARD_SLOTS: Record<PlayerColor, Array<[number, number]>> = {
  red: [[1, 1], [1, 4], [4, 1], [4, 4]],
  green: [[1, 10], [1, 13], [4, 10], [4, 13]],
  yellow: [[10, 10], [10, 13], [13, 10], [13, 13]],
  blue: [[10, 1], [10, 4], [13, 1], [13, 4]],
};

const SAFE_COORDS = new Set(
  [0, 8, 13, 21, 26, 34, 39, 47].map((i) => `${LUDO_PATH[i][0]},${LUDO_PATH[i][1]}`)
);

const SNAKES: Array<[number, number]> = [
  [27, 5], [40, 3], [43, 18], [54, 31], [66, 45], [76, 58], [89, 53], [99, 41],
];

const LADDERS: Array<[number, number]> = [
  [4, 25], [13, 46], [33, 49], [42, 63], [50, 69], [62, 81], [74, 92],
];

function snakesSquareToPercent(square: number): { x: number; y: number } {
  const clamped = Math.max(1, Math.min(100, square));
  const zero = clamped - 1;
  const rowFromBottom = Math.floor(zero / 10);
  const colInRow = zero % 10;
  const col = rowFromBottom % 2 === 0 ? colInRow : 9 - colInRow;
  const rowFromTop = 9 - rowFromBottom;
  return {
    x: col * 10 + 5,
    y: rowFromTop * 10 + 5,
  };
}

function ludoTokenCoord(color: PlayerColor, tokenIdx: number, step: number): [number, number] {
  if (step === -1) return LUDO_YARD_SLOTS[color][tokenIdx];
  if (step >= 56) return [7, 7];
  if (step >= 51) return LUDO_HOME_LANES[color][step - 51];
  const globalIdx = (LUDO_OFFSETS[color] + step) % 52;
  return LUDO_PATH[globalIdx];
}

export const MultiplayerGamesHub: React.FC<MultiplayerGamesHubProps> = ({
  initialRoomId,
  onRequireLogin,
}) => {
  const { session, games, sendWsEvent, authFetch, pushToast, t } = useApp();
  const [selectedId, setSelectedId] = useState<string>(initialRoomId || 'game-fps-main');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (initialRoomId) setSelectedId(initialRoomId);
  }, [initialRoomId]);

  const activeGame: GameRoomState | undefined = useMemo(() => {
    return games.find((g) => g.roomId === selectedId) || games[0];
  }, [games, selectedId]);

  const prevWinnerRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (activeGame?.winnerUid && activeGame.winnerUid !== prevWinnerRef.current) {
      playVictorySfx();
      prevWinnerRef.current = activeGame.winnerUid;
    } else if (!activeGame?.winnerUid) {
      prevWinnerRef.current = null;
    }
  }, [activeGame?.winnerUid]);

  const canApprove = Boolean(
    session &&
      activeGame &&
      ((session.role === 'host' && session.uid === activeGame.hostUid) ||
        (session.role === 'admin' &&
          session.assignedHostUid === activeGame.hostUid &&
          session.permissions?.canApproveGames))
  );

  const isSeated = Boolean(
    session && activeGame?.players.some((p) => p.uid === session.uid)
  );
  const isPending = Boolean(
    session && activeGame?.pendingRequests.some((r) => r.uid === session.uid)
  );

  const currentPlayer: GamePlayer | undefined = activeGame?.players[activeGame.turnIndex];
  const isMyTurn = Boolean(
    session && activeGame?.status === 'playing' && currentPlayer?.uid === session.uid
  );

  const legalLudoTokens = useMemo(() => {
    if (!activeGame || activeGame.gameType !== 'ludo' || !activeGame.mustMove || !activeGame.diceValue || !currentPlayer) {
      return new Set<number>();
    }
    const set = new Set<number>();
    currentPlayer.tokens.forEach((pos, idx) => {
      if (pos === -1 && activeGame.diceValue === 6) set.add(idx);
      else if (pos >= 0 && pos < 56 && pos + activeGame.diceValue! <= 56) set.add(idx);
    });
    return set;
  }, [activeGame, currentPlayer]);

  const handleCreateTable = async (gameType: GameType) => {
    if (!session) {
      onRequireLogin();
      return;
    }
    setCreating(true);
    try {
      const res = await authFetch('/api/games', {
        method: 'POST',
        body: JSON.stringify({
          gameType,
          title: `${session.displayName}'s Live ${
            gameType === 'fps' ? '3D FPS Arena' : gameType === 'ludo' ? 'Ludo Table' : 'Snakes Table'
          }`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Only Hosts can open a new table.', 'error');
      } else if (data.game) {
        setSelectedId(data.game.roomId);
        pushToast('New live multiplayer table opened!', 'success');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRequestJoin = () => {
    if (!session) {
      onRequireLogin();
      return;
    }
    if (!activeGame) return;
    sendWsEvent('game:request_join', { roomId: activeGame.roomId });
    pushToast('Join request sent to the Host.', 'info');
  };

  const handleRoll = () => {
    if (!activeGame) return;
    playDiceSfx();
    sendWsEvent('game:roll_dice', { roomId: activeGame.roomId });
  };

  const handleMoveToken = (tokenIndex: number) => {
    if (!activeGame || !isMyTurn || !activeGame.mustMove) return;
    if (!legalLudoTokens.has(tokenIndex)) return;
    playStepSfx();
    sendWsEvent('game:move_piece', { roomId: activeGame.roomId, tokenIndex });
  };

  return (
    <main className="sl-fluid-page pt-6 pb-28 md:pb-16 space-y-6">
      {/* Header & Table Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--fg-primary)]">
            {t('gamesTitle')}
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-secondary)] max-w-2xl">
            {t('gamesSubtitle')}
          </p>
        </div>

        {(session?.role === 'host' || session?.role === 'band') && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => handleCreateTable('fps')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
            >
              <Crosshair className="h-4 w-4" />
              <span>New 3D FPS Arena</span>
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => handleCreateTable('ludo')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Ludo Table</span>
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => handleCreateTable('snakes')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Snakes Table</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Tables Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {games.map((g) => {
          const active = g.roomId === activeGame?.roomId;
          const badge = g.gameType === 'fps' ? '3D FPS' : g.gameType === 'ludo' ? 'Ludo' : 'Snakes';
          return (
            <button
              key={g.roomId}
              type="button"
              onClick={() => setSelectedId(g.roomId)}
              className={`flex h-11 items-center gap-2.5 rounded-xl border px-4 text-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'border-[var(--accent-primary)] bg-[var(--bg-surface)] font-semibold text-[var(--fg-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
              }`}
            >
              <span className={g.gameType === 'fps' ? 'text-[var(--accent-primary)] font-bold' : ''}>
                {badge}
              </span>
              <span aria-hidden="true">·</span>
              <span>{g.title}</span>
              <span className="font-mono-nums text-xs text-[var(--fg-muted)]">
                ({g.players.length}/{g.maxPlayers || 4})
              </span>
            </button>
          );
        })}
      </div>

      {activeGame && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Board Arena (8 Cols) */}
          <div className="lg:col-span-8 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 sm:p-6 space-y-5">
            {/* Unobtrusive Top HUD */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--fg-primary)]">
                  {activeGame.title}
                </h2>
                <p className="text-xs text-[var(--fg-secondary)]">
                  Host: <strong className="text-[var(--fg-primary)]">{activeGame.hostName}</strong> ({activeGame.hostUid}) · Status:{' '}
                  <span className="capitalize font-medium text-[var(--accent-secondary)]">{activeGame.status}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isSeated && !isPending && (
                  <button
                    type="button"
                    onClick={handleRequestJoin}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{t('requestJoin')}</span>
                  </button>
                )}
                {isPending && (
                  <span className="inline-flex h-10 items-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 text-xs font-medium text-amber-500">
                    {t('requestPending')}
                  </span>
                )}
                {canApprove && (
                  <>
                    <button
                      type="button"
                      onClick={() => sendWsEvent('game:add_bot', { roomId: activeGame.roomId })}
                      disabled={activeGame.gameType !== 'fps' && activeGame.players.length >= (activeGame.maxPlayers || 4)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] disabled:opacity-40 cursor-pointer"
                    >
                      <Bot className="h-4 w-4" />
                      <span>{activeGame.gameType === 'fps' ? 'Add Drone Bot' : t('addBot')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => sendWsEvent('game:restart', { roomId: activeGame.roomId })}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>{t('restartMatch')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Winner Banner */}
            {activeGame.winnerName && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="inline-flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  {activeGame.winnerName} won this match!
                </span>
                {canApprove && (
                  <button
                    type="button"
                    onClick={() => sendWsEvent('game:restart', { roomId: activeGame.roomId })}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    Play Again
                  </button>
                )}
              </div>
            )}

            {/* 3D FIRST-PERSON SHOOTER ARENA OR LUDO / SNAKES BOARDS */}
            {activeGame.gameType === 'fps' ? (
              <FpsArenaGame
                game={activeGame}
                isSeated={isSeated}
                isPending={isPending}
                onRequestJoin={handleRequestJoin}
              />
            ) : activeGame.gameType === 'ludo' ? (
              <div className="mx-auto w-full max-w-[540px] aspect-square rounded-xl border-2 border-[var(--border-hairline)] overflow-hidden grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] bg-[var(--bg-canvas)] relative">
                {Array.from({ length: 225 }).map((_, idx) => {
                  const r = Math.floor(idx / 15);
                  const c = idx % 15;
                  let cellBg = 'bg-[var(--bg-surface)]';
                  // 4 Home Yards
                  if (r < 6 && c < 6) cellBg = 'bg-rose-600/20';
                  else if (r < 6 && c > 8) cellBg = 'bg-emerald-600/20';
                  else if (r > 8 && c > 8) cellBg = 'bg-amber-500/20';
                  else if (r > 8 && c < 6) cellBg = 'bg-sky-600/20';
                  // Home center 3x3
                  else if (r >= 6 && r <= 8 && c >= 6 && c <= 8) cellBg = 'bg-[var(--bg-elevated)]';
                  // Colored Home Lanes
                  else if (r === 7 && c >= 1 && c <= 5) cellBg = 'bg-rose-600/35';
                  else if (c === 7 && r >= 1 && r <= 5) cellBg = 'bg-emerald-600/35';
                  else if (r === 7 && c >= 9 && c <= 13) cellBg = 'bg-amber-500/35';
                  else if (c === 7 && r >= 9 && r <= 13) cellBg = 'bg-sky-600/35';

                  const isSafe = SAFE_COORDS.has(`${r},${c}`);

                  // Find tokens occupying this cell
                  const cellTokens: Array<{ player: GamePlayer; tokenIdx: number }> = [];
                  activeGame.players.forEach((p) => {
                    p.tokens.forEach((step, tIdx) => {
                      const [tr, tc] = ludoTokenCoord(p.color, tIdx, step);
                      if (tr === r && tc === c) {
                        cellTokens.push({ player: p, tokenIdx: tIdx });
                      }
                    });
                  });

                  return (
                    <div
                      key={idx}
                      className={`relative flex items-center justify-center border-[0.5px] border-[var(--border-hairline)]/60 ${cellBg}`}
                    >
                      {isSafe && cellTokens.length === 0 && (
                        <Star className="h-3 w-3 text-[var(--fg-muted)]/60" />
                      )}
                      {r === 7 && c === 7 && cellTokens.length === 0 && (
                        <Crown className="h-4 w-4 text-amber-500" />
                      )}
                      <div className="flex flex-wrap items-center justify-center gap-0.5">
                        {cellTokens.map(({ player, tokenIdx }) => {
                          const clickable =
                            isMyTurn &&
                            activeGame.mustMove &&
                            player.uid === session?.uid &&
                            legalLudoTokens.has(tokenIdx);
                          return (
                            <button
                              key={`${player.uid}-${tokenIdx}`}
                              type="button"
                              disabled={!clickable}
                              onClick={() => handleMoveToken(tokenIdx)}
                              title={`${player.displayName} Token #${tokenIdx + 1}`}
                              className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full border-2 border-white shadow-sm transition-transform ${
                                COLOR_STYLES[player.color].bg
                              } ${
                                clickable
                                  ? 'scale-125 ring-2 ring-offset-1 ring-white cursor-pointer z-20'
                                  : 'cursor-default'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* SNAKES & LADDERS 10x10 BOARD */
              <div className="relative mx-auto w-full max-w-[540px] aspect-square rounded-xl border-2 border-[var(--border-hairline)] overflow-hidden bg-[var(--bg-canvas)]">
                <div className="grid grid-cols-10 grid-rows-10 h-full w-full">
                  {Array.from({ length: 100 }).map((_, idx) => {
                    const rowFromTop = Math.floor(idx / 10);
                    const rowFromBottom = 9 - rowFromTop;
                    const col = idx % 10;
                    const num =
                      rowFromBottom % 2 === 0
                        ? rowFromBottom * 10 + col + 1
                        : rowFromBottom * 10 + (10 - col);
                    const alt = (rowFromTop + col) % 2 === 0;
                    return (
                      <div
                        key={num}
                        className={`relative flex items-start justify-start p-1 border-[0.5px] border-[var(--border-hairline)]/60 ${
                          num === 100
                            ? 'bg-emerald-500/20'
                            : alt
                              ? 'bg-[var(--bg-surface)]'
                              : 'bg-[var(--bg-elevated)]/65'
                        }`}
                      >
                        <span className="font-mono-nums text-[9px] sm:text-[10px] text-[var(--fg-muted)]">
                          {num}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* SVG Snakes & Ladders Overlay */}
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  {LADDERS.map(([from, to]) => {
                    const a = snakesSquareToPercent(from);
                    const b = snakesSquareToPercent(to);
                    return (
                      <g key={`l-${from}`} opacity="0.72">
                        <line x1={a.x - 1} y1={a.y} x2={b.x - 1} y2={b.y} stroke="#10B981" strokeWidth="0.9" />
                        <line x1={a.x + 1} y1={a.y} x2={b.x + 1} y2={b.y} stroke="#10B981" strokeWidth="0.9" />
                      </g>
                    );
                  })}
                  {SNAKES.map(([head, tail]) => {
                    const a = snakesSquareToPercent(head);
                    const b = snakesSquareToPercent(tail);
                    const cx = (a.x + b.x) / 2 + (head % 2 === 0 ? 7 : -7);
                    const cy = (a.y + b.y) / 2;
                    return (
                      <path
                        key={`s-${head}`}
                        d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        strokeDasharray="2 1"
                        opacity="0.78"
                      />
                    );
                  })}
                </svg>

                {/* Live Player Tokens on Snakes Board */}
                {activeGame.players.map((p, idx) => {
                  const pos = p.tokens[0] || 1;
                  const coord = snakesSquareToPercent(pos);
                  const offsetX = (idx % 2 === 0 ? -1.4 : 1.4);
                  const offsetY = (idx < 2 ? -1.4 : 1.4);
                  return (
                    <div
                      key={p.uid}
                      title={`${p.displayName} (Sq ${p.tokens[0]})`}
                      style={{
                        left: `${coord.x + offsetX}%`,
                        top: `${coord.y + offsetY}%`,
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-white shadow-md transition-all duration-300 flex items-center justify-center text-[9px] font-bold text-white ${
                        COLOR_STYLES[p.color].bg
                      }`}
                    >
                      {p.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Turn & Dice Action Bar (Board Games Only) */}
            {activeGame.gameType !== 'fps' && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
                <div className="space-y-0.5">
                  <div className="text-xs text-[var(--fg-secondary)]">
                    {activeGame.status === 'lobby'
                      ? 'Waiting for at least 2 approved players (or Host adds a Studio Bot).'
                      : isMyTurn
                        ? activeGame.mustMove
                          ? 'Select one of your highlighted tokens to move.'
                          : 'Your turn! Roll the dice.'
                        : currentPlayer
                          ? `Current turn: ${currentPlayer.displayName} (${currentPlayer.color})`
                          : t('spectatingNote')}
                  </div>
                  {activeGame.diceValue !== null && (
                    <div className="text-xs font-mono-nums text-[var(--fg-primary)]">
                      Last roll: <strong>{activeGame.diceValue}</strong>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!isMyTurn || activeGame.mustMove}
                  onClick={handleRoll}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Dices className="h-4.5 w-4.5" />
                  <span>{t('rollDice')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Right 4 Cols: Host Approval Queue, Seated Players & Move Log */}
          <aside className="lg:col-span-4 space-y-5">
            {/* Join Request Approval Queue (Visible to all, actionable by Host / Permitted Admin) */}
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-[var(--fg-primary)]">
                  {t('hostApprovalQueue')}
                </h3>
                <span className="font-mono-nums text-xs text-[var(--fg-muted)]">
                  {activeGame.pendingRequests.length} pending
                </span>
              </div>

              {activeGame.pendingRequests.length === 0 ? (
                <p className="text-xs text-[var(--fg-muted)]">
                  No pending requests. Viewers click &ldquo;{t('requestJoin')}&rdquo; and the Host approves seats here.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {activeGame.pendingRequests.map((req) => (
                    <div
                      key={req.uid}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[var(--fg-primary)]">
                          {req.displayName}
                          {req.isFollower && (
                            <span className="ml-1.5 text-[10px] font-bold text-[var(--accent-secondary)]">
                              FOLLOWER
                            </span>
                          )}
                        </div>
                        <div className="font-mono-nums text-[11px] text-[var(--fg-muted)]">
                          {req.uid}
                        </div>
                      </div>
                      {canApprove ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              sendWsEvent('game:approve_player', {
                                roomId: activeGame.roomId,
                                targetUid: req.uid,
                              })
                            }
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{t('approve')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              sendWsEvent('game:decline_player', {
                                roomId: activeGame.roomId,
                                targetUid: req.uid,
                              })
                            }
                            aria-label={t('decline')}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-rose-500 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--fg-muted)]">Awaiting Host</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Seated Players */}
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
              <h3 className="font-display text-sm font-semibold text-[var(--fg-primary)]">
                {activeGame.gameType === 'fps'
                  ? `Active Squad (${activeGame.players.length}/${activeGame.maxPlayers || 8})`
                  : `Seated Players (${activeGame.players.length}/${activeGame.maxPlayers || 4})`}
              </h3>
              <div className="space-y-2">
                {activeGame.players.map((p, idx) => {
                  const isTurn =
                    activeGame.gameType !== 'fps' &&
                    activeGame.status === 'playing' &&
                    activeGame.turnIndex === idx;
                  const fpsUnit = activeGame.fps?.combatants?.[p.uid];
                  return (
                    <div
                      key={p.uid}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                        isTurn
                          ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`h-3 w-3 rounded-full shrink-0 ${COLOR_STYLES[p.color].bg}`} />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[var(--fg-primary)]">
                            {p.displayName} {p.uid === session?.uid ? '(You)' : ''}
                            {p.isFollower && (
                              <span className="ml-1.5 text-[10px] font-bold text-[var(--accent-secondary)]">
                                FOLLOWER
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono-nums text-[var(--fg-muted)]">
                            {activeGame.gameType === 'fps'
                              ? `Kills: ${fpsUnit?.kills ?? 0} · Score: ${fpsUnit?.score ?? 0} · HP ${fpsUnit?.hp ?? 100}`
                              : activeGame.gameType === 'ludo'
                                ? `Home: ${p.tokens.filter((x) => x === 56).length}/4`
                                : `Square ${p.tokens[0]}/100`}
                          </div>
                        </div>
                      </div>
                      {isTurn && (
                        <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                          TURN
                        </span>
                      )}
                      {activeGame.gameType === 'fps' && p.uid === activeGame.hostUid && (
                        <span className="text-[11px] font-semibold text-[var(--accent-gold)]">
                          HOST
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Live Match Log */}
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
              <h3 className="font-display text-sm font-semibold text-[var(--fg-primary)]">
                Match Feed
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs text-[var(--fg-secondary)]">
                {activeGame.log.map((entry, idx) => (
                  <div key={idx} className="border-b border-[var(--border-hairline)]/50 pb-1.5 last:border-0">
                    {entry}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
};

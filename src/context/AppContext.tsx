import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { detectDeviceInfo } from '../lib/device';
import { getTranslator, isRTL } from '../lib/i18n';
import { getThemePreset, THEME_DECK_37, THEME_PRESET_MAP } from '../lib/themes';
import type {
  AuthSession,
  CapturedAsset,
  ColorGrade,
  CutoutProfile,
  DeviceInfo,
  FontChoice,
  FontScale,
  GameRoomState,
  Livestream,
  LocaleCode,
  ThemeMode,
} from '../types';

export interface ToastItem {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

type WsListener = (event: string, payload: unknown) => void;

interface AppContextValue {
  // Auth (in-memory Bearer token only)
  session: AuthSession | null;
  setSession: (s: AuthSession | null) => void;
  refreshSession: () => Promise<void>;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  logout: () => void;

  // Daily check-in wallet bonus (server-authoritative when signed in)
  checkedInToday: boolean;
  bonusTokens: number;
  claimDailyCheckIn: () => Promise<void>;

  // Following state (synced with server)
  followingHostUids: string[];
  refreshSocial: () => Promise<void>;
  toggleFollowHost: (roomId: string, hostUid: string) => Promise<boolean | null>;

  // Shared Studio Media Library
  mediaLibrary: CapturedAsset[];
  addMediaAsset: (asset: CapturedAsset) => void;
  removeMediaAsset: (id: string) => void;

  // Preferences (37-theme deck, 20 languages, fonts, square corners, auto-translate)
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  grade: ColorGrade;
  setGrade: (g: ColorGrade) => void;
  squareCorners: boolean;
  setSquareCorners: (v: boolean) => void;
  autoTranslateChat: boolean;
  setAutoTranslateChat: (v: boolean) => void;
  font: FontChoice;
  setFont: (f: FontChoice) => void;
  fontSize: FontScale;
  setFontSize: (s: FontScale) => void;
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  cutout: CutoutProfile;
  setCutout: (c: CutoutProfile) => void;
  stretchMode: 'auto' | 'centered';
  setStretchMode: (m: 'auto' | 'centered') => void;
  device: DeviceInfo;
  t: ReturnType<typeof getTranslator>;

  // Live Data & WebSocket
  streams: Livestream[];
  refreshStreams: () => Promise<void>;
  games: GameRoomState[];
  wsConnected: boolean;
  sendWsEvent: (event: string, payload?: Record<string, unknown>) => void;
  subscribeWs: (listener: WsListener) => () => void;

  // Floating PiP mini-player
  pipStream: Livestream | null;
  setPipStream: (s: Livestream | null) => void;

  // Toasts
  toasts: ToastItem[];
  pushToast: (message: string, tone?: ToastItem['tone']) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const VALID_FONTS: FontChoice[] = ['jakarta', 'fredoka', 'outfit', 'manrope', 'dmsans', 'playfair'];

function readPref<T extends string>(key: string, fallback: T, allowed?: T[]): T {
  try {
    const v = window.localStorage.getItem(key) as T | null;
    if (!v) return fallback;
    if (allowed && !allowed.includes(v)) return fallback;
    return v;
  } catch {
    return fallback;
  }
}

function readBoolPref(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1' || v === 'true';
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [grade, setGradeState] = useState<ColorGrade>(() => {
    const saved = readPref<ColorGrade>('stlive_grade_v2', 'nova');
    return THEME_PRESET_MAP.has(saved) ? saved : 'nova';
  });
  const [theme, setThemeState] = useState<ThemeMode>(() => readPref<ThemeMode>('stlive_theme', 'dark'));
  const [squareCorners, setSquareCorners] = useState<boolean>(() => readBoolPref('stlive_corners', false));
  const [autoTranslateChat, setAutoTranslateChat] = useState<boolean>(() => readBoolPref('stlive_translate', false));
  const [font, setFont] = useState<FontChoice>(() =>
    readPref<FontChoice>('stlive_font_v2', 'jakarta', VALID_FONTS)
  );
  const [fontSize, setFontSize] = useState<FontScale>(() => readPref<FontScale>('stlive_size', 'md'));
  const [locale, setLocale] = useState<LocaleCode>(() => readPref<LocaleCode>('stlive_locale', 'en'));
  const [cutout, setCutout] = useState<CutoutProfile>(() => readPref<CutoutProfile>('stlive_cutout', 'auto'));
  const [stretchMode, setStretchMode] = useState<'auto' | 'centered'>(() =>
    readPref<'auto' | 'centered'>('stlive_stretch', 'auto', ['auto', 'centered'])
  );
  const [device, setDevice] = useState<DeviceInfo>(() => detectDeviceInfo());

  const [localCheckedIn, setLocalCheckedIn] = useState(false);
  const [bonusTokens, setBonusTokens] = useState(20);
  const [followingHostUids, setFollowingHostUids] = useState<string[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<CapturedAsset[]>([]);
  const [pipStream, setPipStream] = useState<Livestream | null>(null);

  const [streams, setStreams] = useState<Livestream[]>([]);
  const [games, setGames] = useState<GameRoomState[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<WsListener>>(new Set());
  const sessionRef = useRef<AuthSession | null>(null);

  const pushToast = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  // Selecting a preset from the 37-theme deck syncs mode cleanly
  const setGrade = useCallback((nextId: ColorGrade) => {
    const preset = getThemePreset(nextId);
    setGradeState(preset.id);
    setThemeState(preset.mode);
  }, []);

  // Toggling Light/Dark mode picks the closest preset in the current family with that mode
  const setTheme = useCallback((nextMode: ThemeMode) => {
    setThemeState(nextMode);
    setGradeState((curr) => {
      const currPreset = getThemePreset(curr);
      if (currPreset.mode === nextMode) return curr;
      const sameFamily = THEME_DECK_37.find((t) => t.family === currPreset.family && t.mode === nextMode);
      if (sameFamily) return sameFamily.id;
      const fallback = THEME_DECK_37.find((t) => t.mode === nextMode);
      return fallback ? fallback.id : curr;
    });
  }, []);

  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (sessionRef.current?.token) {
      headers.set('Authorization', `Bearer ${sessionRef.current.token}`);
    }
    return fetch(url, { ...init, headers });
  }, []);

  const setSession = useCallback((next: AuthSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
    if (next) {
      setBonusTokens(next.tokens ?? 20);
      setLocalCheckedIn(Boolean(next.checkedInToday));
    } else {
      setFollowingHostUids([]);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'auth:identify',
          payload: { token: next?.token || null },
        })
      );
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!sessionRef.current?.token) return;
    try {
      const res = await authFetch('/api/auth/me');
      if (res.ok) {
        const data = (await res.json()) as { session?: AuthSession };
        if (data.session) {
          const merged: AuthSession = {
            ...data.session,
            token: sessionRef.current.token,
            isTestMode: sessionRef.current.isTestMode,
          };
          sessionRef.current = merged;
          setSessionState(merged);
          setBonusTokens(merged.tokens ?? 20);
          setLocalCheckedIn(Boolean(merged.checkedInToday));
        }
      }
    } catch {
      // ignore offline
    }
  }, [authFetch]);

  const refreshSocial = useCallback(async () => {
    if (!sessionRef.current?.token) {
      setFollowingHostUids([]);
      return;
    }
    try {
      const res = await authFetch('/api/me/social');
      if (res.ok) {
        const data = (await res.json()) as { followingHostUids?: string[] };
        setFollowingHostUids(data.followingHostUids || []);
      }
    } catch {
      // ignore
    }
  }, [authFetch]);

  useEffect(() => {
    if (session?.token) {
      refreshSocial();
    }
  }, [session?.token, session?.uid, refreshSocial]);

  const toggleFollowHost = useCallback(
    async (roomId: string, hostUid: string): Promise<boolean | null> => {
      if (!sessionRef.current?.token) {
        pushToast('Sign in or activate Test Mode to follow hosts.', 'info');
        return null;
      }
      try {
        const res = await authFetch(`/api/rooms/${encodeURIComponent(roomId)}/follow`, {
          method: 'POST',
        });
        const data = await res.json();
        if (!res.ok) {
          pushToast(data.error || 'Could not update follow state.', 'error');
          return null;
        }
        const nowFollowing = Boolean(data.following);
        setFollowingHostUids((prev) =>
          nowFollowing ? Array.from(new Set([...prev, hostUid])) : prev.filter((id) => id !== hostUid)
        );
        pushToast(nowFollowing ? 'Followed host!' : 'Unfollowed host.', 'success');
        return nowFollowing;
      } catch {
        pushToast('Network error updating follow.', 'error');
        return null;
      }
    },
    [authFetch, pushToast]
  );

  const checkedInToday = session ? Boolean(session.checkedInToday) : localCheckedIn;

  const claimDailyCheckIn = useCallback(async () => {
    if (checkedInToday) {
      pushToast('Daily check-in already claimed today.', 'info');
      return;
    }
    if (sessionRef.current?.token) {
      try {
        const res = await authFetch('/api/economy/checkin', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          pushToast(data.error || 'Daily check-in failed.', 'error');
          return;
        }
        if (data.session) {
          const merged: AuthSession = {
            ...data.session,
            token: sessionRef.current.token,
            isTestMode: sessionRef.current.isTestMode,
          };
          sessionRef.current = merged;
          setSessionState(merged);
          setBonusTokens(merged.tokens ?? 20);
          setLocalCheckedIn(true);
        }
        pushToast(
          `Day ${data.streak || 1} check-in: +${data.rewardTokens || 5} Tokens & +${data.rewardXp || 20} XP!`,
          'success'
        );
        return;
      } catch {
        pushToast('Could not reach server for check-in.', 'error');
        return;
      }
    }
    setLocalCheckedIn(true);
    setBonusTokens((n) => n + 5);
    pushToast('Guest check-in: +5 Tokens! Sign in to save 7-day streaks.', 'success');
  }, [checkedInToday, authFetch, pushToast]);

  const addMediaAsset = useCallback((asset: CapturedAsset) => {
    setMediaLibrary((prev) => [asset, ...prev]);
  }, []);

  const removeMediaAsset = useCallback((id: string) => {
    setMediaLibrary((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const onResize = () => setDevice(detectDeviceInfo());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const preset = getThemePreset(grade);
    const activeMode = preset.mode;

    if (activeMode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    // Apply all 37-deck CSS custom properties directly so every theme works with WCAG contrast
    root.style.setProperty('--bg-canvas', preset.bgCanvas);
    root.style.setProperty('--bg-surface', preset.bgSurface);
    root.style.setProperty('--bg-elevated', preset.bgElevated);
    root.style.setProperty('--border-hairline', preset.borderHairline);
    root.style.setProperty('--fg-primary', preset.fgPrimary);
    root.style.setProperty('--fg-secondary', preset.fgSecondary);
    root.style.setProperty('--fg-muted', preset.fgMuted);
    root.style.setProperty('--accent-primary', preset.accentPrimary);
    root.style.setProperty('--accent-primary-hover', preset.accentHover);
    root.style.setProperty('--accent-secondary', preset.accentSecondary);
    root.style.setProperty('--accent-gold', preset.accentGold);
    root.style.setProperty('--accent-contrast', preset.accentContrast);
    root.style.setProperty('--topbar-bg', preset.topbarBg);
    root.style.setProperty('--rail-bg', preset.railBg);

    root.setAttribute('data-grade', preset.id);
    root.setAttribute('data-font', font);
    root.setAttribute('data-size', fontSize);
    root.setAttribute('lang', locale);
    root.setAttribute('dir', isRTL(locale) ? 'rtl' : 'ltr');
    root.setAttribute('data-corners', squareCorners ? 'square' : 'rounded');

    const effectiveCutout = cutout === 'auto' ? device.suggestedCutout : cutout;
    root.setAttribute('data-cutout', effectiveCutout);
    root.setAttribute('data-stretch', stretchMode);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', preset.bgCanvas);
    }

    try {
      window.localStorage.setItem('stlive_theme', activeMode);
      window.localStorage.setItem('stlive_grade_v2', preset.id);
      window.localStorage.setItem('stlive_corners', squareCorners ? '1' : '0');
      window.localStorage.setItem('stlive_translate', autoTranslateChat ? '1' : '0');
      window.localStorage.setItem('stlive_font_v2', font);
      window.localStorage.setItem('stlive_size', fontSize);
      window.localStorage.setItem('stlive_locale', locale);
      window.localStorage.setItem('stlive_cutout', cutout);
      window.localStorage.setItem('stlive_stretch', stretchMode);
    } catch {
      // ignore storage errors
    }
  }, [theme, grade, squareCorners, autoTranslateChat, font, fontSize, locale, cutout, stretchMode, device.suggestedCutout]);

  const sendWsEvent = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    pushToast('Signed out cleanly.', 'info');
  }, [setSession, pushToast]);

  const refreshStreams = useCallback(async () => {
    try {
      const res = await fetch('/api/streams');
      if (res.ok) {
        const data = (await res.json()) as { streams: Livestream[] };
        setStreams(data.streams || []);
      }
    } catch {
      // offline safe
    }
  }, []);

  useEffect(() => {
    refreshStreams();
    fetch('/api/games')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.games) setGames(data.games);
      })
      .catch(() => {});
  }, [refreshStreams]);

  useEffect(() => {
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        if (sessionRef.current?.token) {
          ws.send(JSON.stringify({ event: 'auth:identify', payload: { token: sessionRef.current.token } }));
        }
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data) as { event: string; payload: unknown };
          if (parsed.event === 'games:init' && Array.isArray(parsed.payload)) {
            setGames(parsed.payload as GameRoomState[]);
          } else if (parsed.event === 'game:state' && parsed.payload) {
            const updated = parsed.payload as GameRoomState;
            setGames((prev) => {
              const exists = prev.some((g) => g.roomId === updated.roomId);
              if (!exists) return [updated, ...prev];
              return prev.map((g) => (g.roomId === updated.roomId ? updated : g));
            });
          } else if (parsed.event === 'streams:updated' && Array.isArray(parsed.payload)) {
            setStreams(parsed.payload as Livestream[]);
          } else if (parsed.event === 'ws:error' && parsed.payload) {
            const msg = (parsed.payload as { message?: string }).message;
            if (msg) pushToast(msg, 'error');
          }
          listenersRef.current.forEach((fn) => fn(parsed.event, parsed.payload));
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closed) {
          retryTimer = setTimeout(connect, 2200);
        }
      };
    }

    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [pushToast]);

  const subscribeWs = useCallback((listener: WsListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const t = useMemo(() => getTranslator(locale), [locale]);

  const value: AppContextValue = {
    session,
    setSession,
    refreshSession,
    authFetch,
    logout,
    checkedInToday,
    bonusTokens,
    claimDailyCheckIn,
    followingHostUids,
    refreshSocial,
    toggleFollowHost,
    mediaLibrary,
    addMediaAsset,
    removeMediaAsset,
    theme,
    setTheme,
    grade,
    setGrade,
    squareCorners,
    setSquareCorners,
    autoTranslateChat,
    setAutoTranslateChat,
    font,
    setFont,
    fontSize,
    setFontSize,
    locale,
    setLocale,
    cutout,
    setCutout,
    stretchMode,
    setStretchMode,
    device,
    t,
    streams,
    refreshStreams,
    games,
    wsConnected,
    sendWsEvent,
    subscribeWs,
    pipStream,
    setPipStream,
    toasts,
    pushToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

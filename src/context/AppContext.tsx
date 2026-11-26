import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { detectDeviceInfo } from '../lib/device';
import { getTranslator, isRTL } from '../lib/i18n';
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
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  logout: () => void;

  // Daily check-in wallet bonus (StreamLive signature)
  checkedInToday: boolean;
  bonusTokens: number;
  claimDailyCheckIn: () => void;

  // Shared Studio Media Library (synced between Standalone Camera Studio & Library Rail Tab)
  mediaLibrary: CapturedAsset[];
  addMediaAsset: (asset: CapturedAsset) => void;
  removeMediaAsset: (id: string) => void;

  // Preferences
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  grade: ColorGrade;
  setGrade: (g: ColorGrade) => void;
  font: FontChoice;
  setFont: (f: FontChoice) => void;
  fontSize: FontScale;
  setFontSize: (s: FontScale) => void;
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  cutout: CutoutProfile;
  setCutout: (c: CutoutProfile) => void;
  device: DeviceInfo;
  t: ReturnType<typeof getTranslator>;

  // Live Data & WebSocket
  streams: Livestream[];
  refreshStreams: () => Promise<void>;
  games: GameRoomState[];
  wsConnected: boolean;
  sendWsEvent: (event: string, payload?: Record<string, unknown>) => void;
  subscribeWs: (listener: WsListener) => () => void;

  // Toasts
  toasts: ToastItem[];
  pushToast: (message: string, tone?: ToastItem['tone']) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const VALID_GRADES: ColorGrade[] = ['nova', 'emerald', 'surge', 'ballot', 'onyx', 'ember'];
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => readPref<ThemeMode>('stlive_theme', 'dark'));
  const [grade, setGrade] = useState<ColorGrade>(() =>
    readPref<ColorGrade>('stlive_grade_v2', 'nova', VALID_GRADES)
  );
  const [font, setFont] = useState<FontChoice>(() =>
    readPref<FontChoice>('stlive_font_v2', 'jakarta', VALID_FONTS)
  );
  const [fontSize, setFontSize] = useState<FontScale>(() => readPref<FontScale>('stlive_size', 'md'));
  const [locale, setLocale] = useState<LocaleCode>(() => readPref<LocaleCode>('stlive_locale', 'en'));
  const [cutout, setCutout] = useState<CutoutProfile>(() => readPref<CutoutProfile>('stlive_cutout', 'auto'));
  const [device, setDevice] = useState<DeviceInfo>(() => detectDeviceInfo());

  const [checkedInToday, setCheckedInToday] = useState(false);
  const [bonusTokens, setBonusTokens] = useState(20);
  const [mediaLibrary, setMediaLibrary] = useState<CapturedAsset[]>([]);

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

  const claimDailyCheckIn = useCallback(() => {
    if (checkedInToday) {
      pushToast('Daily check-in already claimed today.', 'info');
      return;
    }
    setCheckedInToday(true);
    setBonusTokens((n) => n + 20);
    setSessionState((prev) => (prev ? { ...prev, coins: prev.coins + 500 } : prev));
    pushToast('Daily check-in claimed: +500 Coins & +20 Studio Tokens!', 'success');
  }, [checkedInToday, pushToast]);

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
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    root.setAttribute('data-grade', grade);
    root.setAttribute('data-font', font);
    root.setAttribute('data-size', fontSize);
    root.setAttribute('lang', locale);
    root.setAttribute('dir', isRTL(locale) ? 'rtl' : 'ltr');

    const effectiveCutout = cutout === 'auto' ? device.suggestedCutout : cutout;
    root.setAttribute('data-cutout', effectiveCutout);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const darkBgMap: Record<ColorGrade, string> = {
        nova: '#0D0D10',
        emerald: '#07130D',
        surge: '#0A0A18',
        ballot: '#071627',
        onyx: '#0B0B0E',
        ember: '#1A0B0E',
      };
      metaTheme.setAttribute('content', theme === 'dark' ? darkBgMap[grade] : '#F7F7FA');
    }

    try {
      window.localStorage.setItem('stlive_theme', theme);
      window.localStorage.setItem('stlive_grade_v2', grade);
      window.localStorage.setItem('stlive_font_v2', font);
      window.localStorage.setItem('stlive_size', fontSize);
      window.localStorage.setItem('stlive_locale', locale);
      window.localStorage.setItem('stlive_cutout', cutout);
    } catch {
      // ignore storage errors
    }
  }, [theme, grade, font, fontSize, locale, cutout, device.suggestedCutout]);

  const sendWsEvent = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
    }
  }, []);

  const setSession = useCallback((next: AuthSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'auth:identify',
          payload: { token: next?.token || null },
        })
      );
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    pushToast('Signed out cleanly.', 'info');
  }, [setSession, pushToast]);

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
    authFetch,
    logout,
    checkedInToday,
    bonusTokens,
    claimDailyCheckIn,
    mediaLibrary,
    addMediaAsset,
    removeMediaAsset,
    theme,
    setTheme,
    grade,
    setGrade,
    font,
    setFont,
    fontSize,
    setFontSize,
    locale,
    setLocale,
    cutout,
    setCutout,
    device,
    t,
    streams,
    refreshStreams,
    games,
    wsConnected,
    sendWsEvent,
    subscribeWs,
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

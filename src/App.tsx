import React, { Component, useEffect, useRef, useState } from 'react';
import { Maximize2, Volume2, VolumeX, X } from 'lucide-react';
import { CameraStudio } from './components/CameraStudio';
import { InboxHub } from './components/InboxHub';
import { LibraryView } from './components/LibraryView';
import { LiveHome } from './components/LiveHome';
import { LiveRoomView } from './components/LiveRoomView';
import { MeHub, type MeTab } from './components/MeHub';
import { MultiplayerGamesHub } from './components/MultiplayerGamesHub';
import { Navbar, type ActiveTab } from './components/Navbar';
import { PreferencesSheet } from './components/PreferencesSheet';
import { PublicProfileModal } from './components/PublicProfileModal';
import { RoleWorkspace } from './components/RoleWorkspace';
import { TestModeDrawer } from './components/TestModeDrawer';
import { UnifiedLoginModal } from './components/UnifiedLoginModal';
import { AppProvider, useApp } from './context/AppContext';
import { countryFlag } from './lib/countries';
import type { Livestream } from './types';

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-6 text-center">
          <div className="max-w-sm space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <h1 className="font-display text-lg font-bold text-[var(--fg-primary)]">
              Something went wrong
            </h1>
            <p className="text-xs text-[var(--fg-secondary)]">
              Reset the view to continue using StreamLive.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="h-10 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-white cursor-pointer"
            >
              Reload Interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const StreamLiveShell: React.FC = () => {
  const { toasts, streams, pipStream, setPipStream } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [activeStream, setActiveStream] = useState<Livestream | null>(null);
  const [targetGameId, setTargetGameId] = useState<string | null>(null);
  const [targetDmUid, setTargetDmUid] = useState<string | null>(null);
  const [targetJoinCode, setTargetJoinCode] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [testModeOpen, setTestModeOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [profileModalUid, setProfileModalUid] = useState<string | null>(null);
  const [meInitialSubTab, setMeInitialSubTab] = useState<MeTab | null>(null);
  const deepLinkAppliedRef = useRef(false);

  // Draggable Floating PiP Position & Mute Toggle
  const [pipPos, setPipPos] = useState<{ x: number; y: number }>({ x: 16, y: 80 });
  const [pipMuted, setPipMuted] = useState<boolean>(true);
  const pipDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Escape closes any open modal or sheet cleanly (G-026)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (profileModalUid) setProfileModalUid(null);
        else if (loginOpen) setLoginOpen(false);
        else if (testModeOpen) setTestModeOpen(false);
        else if (prefsOpen) setPrefsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [profileModalUid, loginOpen, testModeOpen, prefsOpen]);

  // Resolve directly shared links (?room=<id>, ?live=cam, or ?joinGroup=<code>)
  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const liveParam = params.get('live');
    const joinGroupParam = params.get('joinGroup');
    if (joinGroupParam) {
      deepLinkAppliedRef.current = true;
      setTargetJoinCode(joinGroupParam);
      setActiveTab('inbox');
    } else if (roomParam && streams.length > 0) {
      const matched = streams.find((s) => s.id === roomParam);
      if (matched) {
        deepLinkAppliedRef.current = true;
        setActiveStream(matched);
        setActiveTab('live');
      }
    } else if (liveParam) {
      deepLinkAppliedRef.current = true;
      setActiveTab('camera');
    }
  }, [streams]);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab !== 'live') {
      setActiveStream(null);
    }
  };

  const handleOpenStream = (stream: Livestream) => {
    setPipStream(null);
    setActiveStream(stream);
    setActiveTab('live');
  };

  const handleMinimizePip = (stream: Livestream) => {
    setPipStream(stream);
    setActiveStream(null);
  };

  const handleOpenGameFromStream = (gameRoomId: string) => {
    setTargetGameId(gameRoomId);
    setActiveStream(null);
    setActiveTab('games');
  };

  const isCameraFullscreen = activeTab === 'camera';

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--fg-primary)] transition-colors duration-200">
      {!isCameraFullscreen && (
        <Navbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenLogin={() => setLoginOpen(true)}
          onOpenTestMode={() => setTestModeOpen(true)}
          onOpenFreeToEarn={() => {
            setActiveStream(null);
            setMeInitialSubTab('earning');
            setActiveTab('me');
          }}
          onOpenPreferences={() => setPrefsOpen(true)}
        />
      )}

      {/* Desktop content shifts cleanly right of the 72px StreamLive Left Studio Rail */}
      <div className={isCameraFullscreen ? '' : 'md:pl-[72px]'}>
        {activeTab === 'live' &&
          (activeStream ? (
            <LiveRoomView
              stream={activeStream}
              onBack={() => setActiveStream(null)}
              onMinimizePip={handleMinimizePip}
              onOpenGame={handleOpenGameFromStream}
              onMessageHost={(hostUid) => {
                setTargetDmUid(hostUid);
                setActiveStream(null);
                setActiveTab('inbox');
              }}
              onViewProfile={(uid) => setProfileModalUid(uid)}
              onRequireLogin={() => setLoginOpen(true)}
            />
          ) : (
            <LiveHome
              onSelectStream={handleOpenStream}
              onViewProfile={(uid) => setProfileModalUid(uid)}
            />
          ))}

        {activeTab === 'games' && (
          <MultiplayerGamesHub
            initialRoomId={targetGameId}
            onRequireLogin={() => setLoginOpen(true)}
          />
        )}

        {activeTab === 'camera' && (
          <CameraStudio
            onBack={() => handleSelectTab('live')}
            onGoLive={handleOpenStream}
            onRequireLogin={() => setLoginOpen(true)}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView onOpenCamera={() => handleSelectTab('camera')} />
        )}

        {activeTab === 'inbox' && (
          <InboxHub
            initialDmUid={targetDmUid}
            initialJoinCode={targetJoinCode}
            onConsumeDeepLink={() => {
              setTargetDmUid(null);
              setTargetJoinCode(null);
            }}
            onRequireLogin={() => setLoginOpen(true)}
          />
        )}

        {activeTab === 'workspace' && (
          <RoleWorkspace
            onOpenLogin={() => setLoginOpen(true)}
            onEnterStream={handleOpenStream}
            onNavigateTab={(tab) => handleSelectTab(tab)}
          />
        )}

        {activeTab === 'me' && (
          <MeHub
            initialSubTab={meInitialSubTab}
            onConsumeSubTab={() => setMeInitialSubTab(null)}
            onOpenLogin={() => setLoginOpen(true)}
            onOpenTestMode={() => setTestModeOpen(true)}
            onViewPublicProfile={(uid) => setProfileModalUid(uid)}
          />
        )}
      </div>

      {/* Floating Draggable PiP Mini-Player when a Live Room is minimized */}
      {pipStream && !activeStream && !isCameraFullscreen && (
        <div
          style={{ right: `${pipPos.x}px`, bottom: `${pipPos.y}px` }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            pipDragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              origX: pipPos.x,
              origY: pipPos.y,
            };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!pipDragRef.current) return;
            const dx = pipDragRef.current.startX - e.clientX;
            const dy = pipDragRef.current.startY - e.clientY;
            setPipPos({
              x: Math.max(8, Math.min(window.innerWidth - 220, pipDragRef.current.origX + dx)),
              y: Math.max(64, Math.min(window.innerHeight - 160, pipDragRef.current.origY + dy)),
            });
          }}
          onPointerUp={() => {
            pipDragRef.current = null;
          }}
          className="fixed z-40 w-52 sm:w-60 overflow-hidden rounded-2xl border border-[var(--accent-primary)]/70 bg-black shadow-2xl cursor-grab active:cursor-grabbing select-none"
        >
          <div className="relative aspect-video">
            <img
              src={pipStream.thumbnail}
              alt={pipStream.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60" />
            <div className="absolute inset-x-2 top-1.5 flex items-center justify-between text-white">
              <span className="inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold">
                <span className="text-[var(--accent-primary)]">LIVE</span>
                <span>{countryFlag(pipStream.countryCode)}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPipMuted((m) => !m)}
                  aria-label={pipMuted ? 'Unmute PiP Stream' : 'Mute PiP Stream'}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-black/70 hover:bg-[var(--accent-secondary)] hover:text-black cursor-pointer"
                >
                  {pipMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenStream(pipStream)}
                  aria-label="Expand PiP Stream"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-black/70 hover:bg-[var(--accent-primary)] cursor-pointer"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setPipStream(null)}
                  aria-label="Close PiP Stream"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-black/70 hover:bg-rose-600 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenStream(pipStream)}
              className="absolute inset-x-2 bottom-1.5 text-left text-white cursor-pointer"
            >
              <div className="truncate text-[11px] font-bold leading-tight">{pipStream.title}</div>
              <div className="truncate text-[10px] text-white/75">{pipStream.hostName}</div>
            </button>
          </div>
        </div>
      )}

      <UnifiedLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={(s) => {
          if (s.role === 'staff') {
            setActiveStream(null);
            setActiveTab('me');
          } else if (s.role !== 'guest') {
            setActiveStream(null);
            setActiveTab('workspace');
          }
        }}
      />

      <TestModeDrawer
        open={testModeOpen}
        onClose={() => setTestModeOpen(false)}
        onNavigateTab={handleSelectTab}
        onOpenStream={handleOpenStream}
      />

      <PreferencesSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} />

      <PublicProfileModal
        uid={profileModalUid}
        onClose={() => setProfileModalUid(null)}
        onMessageUser={(uid) => {
          setProfileModalUid(null);
          setTargetDmUid(uid);
          setActiveStream(null);
          setActiveTab('inbox');
        }}
        onWatchStream={(stream) => {
          setProfileModalUid(null);
          handleOpenStream(stream);
        }}
        onRequireLogin={() => setLoginOpen(true)}
      />

      {/* Live Toast Notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl border px-4 py-3 text-xs font-medium shadow-lg backdrop-blur-md ${
                toast.tone === 'error'
                  ? 'border-rose-500/40 bg-rose-950/90 text-rose-100'
                  : toast.tone === 'success'
                    ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 text-[var(--fg-primary)]'
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <StreamLiveShell />
      </AppProvider>
    </AppErrorBoundary>
  );
}

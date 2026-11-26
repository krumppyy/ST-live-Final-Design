import React, { Component, useEffect, useRef, useState } from 'react';
import { CameraStudio } from './components/CameraStudio';
import { InboxHub } from './components/InboxHub';
import { LibraryView } from './components/LibraryView';
import { LiveHome } from './components/LiveHome';
import { LiveRoomView } from './components/LiveRoomView';
import { MultiplayerGamesHub } from './components/MultiplayerGamesHub';
import { Navbar, type ActiveTab } from './components/Navbar';
import { PreferencesSheet } from './components/PreferencesSheet';
import { RoleWorkspace } from './components/RoleWorkspace';
import { UnifiedLoginModal } from './components/UnifiedLoginModal';
import { AppProvider, useApp } from './context/AppContext';
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
  const { toasts, streams } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');
  const [activeStream, setActiveStream] = useState<Livestream | null>(null);
  const [targetGameId, setTargetGameId] = useState<string | null>(null);
  const [targetDmUid, setTargetDmUid] = useState<string | null>(null);
  const [targetJoinCode, setTargetJoinCode] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const deepLinkAppliedRef = useRef(false);

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
              onOpenGame={handleOpenGameFromStream}
              onMessageHost={(hostUid) => {
                setTargetDmUid(hostUid);
                setActiveStream(null);
                setActiveTab('inbox');
              }}
              onRequireLogin={() => setLoginOpen(true)}
            />
          ) : (
            <LiveHome onSelectStream={(stream) => setActiveStream(stream)} />
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
            onGoLive={(stream) => {
              setActiveStream(stream);
              setActiveTab('live');
            }}
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
            onEnterStream={(stream) => {
              setActiveStream(stream);
              setActiveTab('live');
            }}
            onNavigateTab={(tab) => handleSelectTab(tab)}
          />
        )}
      </div>

      <UnifiedLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={(s) => {
          if (s.role !== 'guest') {
            setActiveStream(null);
            setActiveTab('workspace');
          }
        }}
      />

      <PreferencesSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} />

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

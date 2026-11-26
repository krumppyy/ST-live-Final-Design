import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Check,
  ClipboardList,
  Copy,
  KeyRound,
  LogOut,
  Music,
  Plus,
  Radio,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type {
  AdminGrantSummary,
  AdminPermissions,
  AdminTask,
  AgencyHostRecord,
  BandEvent,
  BrandDrop,
  DirectoryUser,
  Livestream,
} from '../types';

interface RoleWorkspaceProps {
  onOpenLogin: () => void;
  onEnterStream: (stream: Livestream) => void;
  onNavigateTab: (tab: 'live' | 'games' | 'camera') => void;
}

const COMPARISON_ROWS = [
  {
    feature: 'Home Discovery UI',
    stlive: 'Google-clean minimal feed, zero popups',
    bigo: 'Banner-heavy grid with floating promos',
    buzzcast: 'Mixed short-video & chat feed',
    mango: 'High-density gift & event banners',
    papaya: 'Task & promotional overlays',
  },
  {
    feature: 'Admin Delegation',
    stlive: 'Host promotes any UID + Host-set password + assignable tasks',
    bigo: 'Room co-host mute/kick only',
    buzzcast: 'Basic room moderator toggle',
    mango: 'Limited host assistant role',
    papaya: 'Standard room admin toggle',
  },
  {
    feature: 'Standalone Camera App',
    stlive: 'Full independent pro studio (LUTs, Beauty, Burst, PiP, Teleprompter)',
    bigo: 'Stream-only filters',
    buzzcast: 'Short-clip camera only',
    mango: 'In-stream beauty presets',
    papaya: 'In-stream face filters',
  },
  {
    feature: 'Multiplayer Games',
    stlive: 'In-stream 3D First-Person Shooter, Ludo & Snakes with Follower Join Request -> Host Approval',
    bigo: 'Draw & Guess / casual voice games',
    buzzcast: 'Party chat mini-games',
    mango: 'Gift-driven lucky games',
    papaya: 'Casual room mini-games',
  },
  {
    feature: 'All-OS & Hardware Fit',
    stlive: 'Auto OS detect + punch-hole/Dynamic Island/curved-edge calibration + PWA',
    bigo: 'Native mobile focus, limited web',
    buzzcast: 'Mobile-only focus',
    mango: 'Mobile-first APK/iOS',
    papaya: 'Mobile-first app',
  },
  {
    feature: 'Accessibility & Type',
    stlive: '6 languages (RTL Arabic) + 5 switchable fonts + 4 text sizes + 4 color grades',
    bigo: 'Fixed UI font & fixed size',
    buzzcast: 'Fixed UI font, chat translate',
    mango: 'Fixed UI font & palette',
    papaya: 'Fixed UI font & palette',
  },
];

export const RoleWorkspace: React.FC<RoleWorkspaceProps> = ({
  onOpenLogin,
  onEnterStream,
  onNavigateTab,
}) => {
  const { session, authFetch, logout, pushToast, refreshStreams, subscribeWs, games, sendWsEvent, t } =
    useApp();

  const [subView, setSubView] = useState<'role' | 'compare'>('role');

  // Host state
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [hostAdmins, setHostAdmins] = useState<AdminGrantSummary[]>([]);
  const [hostTasks, setHostTasks] = useState<AdminTask[]>([]);
  const [promoteUid, setPromoteUid] = useState('ST-2001');
  const [promotePassword, setPromotePassword] = useState('');
  const [promotePerms, setPromotePerms] = useState<AdminPermissions>({
    canModerateChat: true,
    canApproveGames: true,
    canManageSeats: true,
    canRunPK: false,
  });

  const [taskAdminUid, setTaskAdminUid] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Host Go Live Form
  const [liveTitle, setLiveTitle] = useState('');
  const [liveCategory, setLiveCategory] = useState<Livestream['category']>('solo');
  const [liveSeats, setLiveSeats] = useState(6);
  const [liveGameType, setLiveGameType] = useState<'' | 'fps' | 'ludo' | 'snakes'>('fps');

  // Admin state
  const [adminScope, setAdminScope] = useState<{
    hostUid: string;
    hostName: string;
    permissions: AdminPermissions;
    tasks: AdminTask[];
  } | null>(null);

  // Agency state
  const [roster, setRoster] = useState<AgencyHostRecord[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [recruitUid, setRecruitUid] = useState('');
  const [recruitName, setRecruitName] = useState('');

  // Bands & Brands state
  const [bandEvents, setBandEvents] = useState<BandEvent[]>([]);
  const [brandDrops, setBrandDrops] = useState<BrandDrop[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventMembers, setEventMembers] = useState('');
  const [dropTitle, setDropTitle] = useState('');
  const [dropPrice, setDropPrice] = useState('$59');

  const loadRoleData = useCallback(async () => {
    if (!session) return;
    if (session.role === 'host') {
      const [dirRes, admRes] = await Promise.all([
        fetch('/api/users/directory'),
        authFetch('/api/host/admins'),
      ]);
      if (dirRes.ok) {
        const d = await dirRes.json();
        setDirectory(d.users || []);
      }
      if (admRes.ok) {
        const a = await admRes.json();
        setHostAdmins(a.admins || []);
        setHostTasks(a.tasks || []);
        if (a.admins?.length && !taskAdminUid) {
          setTaskAdminUid(a.admins[0].adminUid);
        }
      }
    } else if (session.role === 'admin') {
      const res = await authFetch('/api/admin/workspace');
      if (res.ok) {
        setAdminScope(await res.json());
      }
    } else if (session.role === 'agency') {
      const res = await authFetch('/api/agency/dashboard');
      if (res.ok) {
        const d = await res.json();
        setRoster(d.roster || []);
        setInviteCode(d.inviteCode || '');
      }
    } else if (session.role === 'band') {
      const res = await authFetch('/api/bands/dashboard');
      if (res.ok) {
        const d = await res.json();
        setBandEvents(d.events || []);
        setBrandDrops(d.drops || []);
      }
    }
  }, [session, authFetch, taskAdminUid]);

  useEffect(() => {
    loadRoleData();
  }, [loadRoleData]);

  useEffect(() => {
    return subscribeWs((event) => {
      if (event === 'admin:updated') {
        loadRoleData();
      }
    });
  }, [subscribeWs, loadRoleData]);

  const handlePromoteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/host/admins', {
      method: 'POST',
      body: JSON.stringify({
        adminUid: promoteUid,
        adminPassword: promotePassword,
        permissions: promotePerms,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not promote Admin.', 'error');
      return;
    }
    setHostAdmins(data.admins || []);
    setTaskAdminUid(promoteUid.toUpperCase());
    setPromotePassword('');
    pushToast(
      `${promoteUid.toUpperCase()} promoted to Admin! They can now sign in under Admin with UID ${promoteUid.toUpperCase()} + your password.`,
      'success'
    );
  };

  const handleToggleAdminPerm = async (
    grant: AdminGrantSummary,
    key: keyof AdminPermissions
  ) => {
    const updatedPerms = { ...grant.permissions, [key]: !grant.permissions[key] };
    const res = await authFetch(`/api/host/admins/${grant.adminUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ permissions: updatedPerms }),
    });
    if (res.ok) {
      const data = await res.json();
      setHostAdmins(data.admins || []);
    }
  };

  const handleRevokeAdmin = async (adminUid: string) => {
    const res = await authFetch(`/api/host/admins/${adminUid}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setHostAdmins(data.admins || []);
      pushToast(`Revoked Admin access for ${adminUid}.`, 'info');
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/host/tasks', {
      method: 'POST',
      body: JSON.stringify({
        adminUid: taskAdminUid,
        title: taskTitle,
        notes: taskNotes,
        priority: taskPriority,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not assign task.', 'error');
      return;
    }
    setHostTasks(data.tasks || []);
    setTaskTitle('');
    setTaskNotes('');
    pushToast('Task assigned to Admin.', 'success');
  };

  const handleDeleteTask = async (id: number) => {
    const res = await authFetch(`/api/host/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setHostTasks(data.tasks || []);
    }
  };

  const handleAdminTaskStatus = async (
    taskId: number,
    status: AdminTask['status']
  ) => {
    const res = await authFetch(`/api/admin/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setAdminScope((prev) => (prev ? { ...prev, tasks: data.tasks } : prev));
      pushToast(`Task marked ${status.replace('_', ' ')}.`, 'success');
    }
  };

  const handleGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/streams', {
      method: 'POST',
      body: JSON.stringify({
        title: liveTitle,
        category: liveCategory,
        maxSeats: liveSeats,
        gameType: liveGameType || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not start stream.', 'error');
      return;
    }
    setLiveTitle('');
    await refreshStreams();
    pushToast('Broadcast is now live!', 'success');
    if (data.stream) onEnterStream(data.stream);
  };

  const handleRecruitHost = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/agency/recruit', {
      method: 'POST',
      body: JSON.stringify({ hostUid: recruitUid, hostName: recruitName }),
    });
    if (res.ok) {
      const data = await res.json();
      setRoster(data.roster || []);
      setRecruitUid('');
      setRecruitName('');
      pushToast('Host added to Agency roster.', 'success');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/bands/events', {
      method: 'POST',
      body: JSON.stringify({ title: eventTitle, members: eventMembers }),
    });
    if (res.ok) {
      const data = await res.json();
      setBandEvents(data.events || []);
      setEventTitle('');
      setEventMembers('');
      pushToast('Live showcase scheduled.', 'success');
    }
  };

  const handleCreateDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/bands/drops', {
      method: 'POST',
      body: JSON.stringify({ productTitle: dropTitle, priceLabel: dropPrice }),
    });
    if (res.ok) {
      const data = await res.json();
      setBrandDrops(data.drops || []);
      setDropTitle('');
      pushToast('Live brand drop created.', 'success');
    }
  };

  const relevantHostUid =
    session?.role === 'host'
      ? session.uid
      : session?.role === 'admin'
        ? session.assignedHostUid
        : undefined;

  const pendingGameApprovals = games.filter(
    (g) => g.hostUid === relevantHostUid && g.pendingRequests.length > 0
  );

  return (
    <main className="sl-fluid-page pt-6 pb-28 md:pb-16 space-y-6">
      {/* Top Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--fg-primary)]">
            {session ? `${session.displayName} · ${session.role.toUpperCase()}` : t('workspaceTitle')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--fg-secondary)] font-mono-nums">
            {session
              ? `UID: ${session.uid}${
                  session.assignedHostUid ? ` · Scoped Host: ${session.assignedHostName} (${session.assignedHostUid})` : ''
                }`
              : 'Sign in with one unified login screen to unlock Guest, Host, Admin, Agency, or Bands/Brands tools.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-xl bg-[var(--bg-elevated)]">
            <button
              type="button"
              onClick={() => setSubView('role')}
              className={`h-9 rounded-lg px-3.5 text-xs font-medium cursor-pointer ${
                subView === 'role'
                  ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs font-semibold'
                  : 'text-[var(--fg-secondary)]'
              }`}
            >
              {t('workspaceTitle')}
            </button>
            <button
              type="button"
              onClick={() => setSubView('compare')}
              className={`h-9 rounded-lg px-3.5 text-xs font-medium cursor-pointer ${
                subView === 'compare'
                  ? 'bg-[var(--bg-surface)] text-[var(--fg-primary)] shadow-xs font-semibold'
                  : 'text-[var(--fg-secondary)]'
              }`}
            >
              {t('comparePlatforms')}
            </button>
          </div>

          {session ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-xs font-medium text-[var(--fg-primary)] hover:border-rose-500 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('signOut')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="h-10 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
            >
              {t('signIn')}
            </button>
          )}
        </div>
      </div>

      {/* Platform Benchmark Matrix (STLive vs Bigo Live, BuzzCast, Mango Live, Papaya Live) */}
      {subView === 'compare' ? (
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="p-5 border-b border-[var(--border-hairline)]">
            <h2 className="font-display text-lg font-bold text-[var(--fg-primary)]">
              STLive vs. Bigo Live, BuzzCast, Mango Live & Papaya Live
            </h2>
            <p className="mt-1 text-xs text-[var(--fg-secondary)]">
              Architectural comparison across UI cleanliness, Host-controlled Admin delegation, standalone Camera Studio, multiplayer games, and all-OS accessibility.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]">
                  <th className="py-3 px-4 font-semibold">Capability</th>
                  <th className="py-3 px-4 font-bold text-[var(--accent-primary)]">STLive</th>
                  <th className="py-3 px-4 font-semibold">Bigo Live</th>
                  <th className="py-3 px-4 font-semibold">BuzzCast</th>
                  <th className="py-3 px-4 font-semibold">Mango Live</th>
                  <th className="py-3 px-4 font-semibold">Papaya Live</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="hover:bg-[var(--bg-canvas)]/60">
                    <td className="py-3.5 px-4 font-semibold text-[var(--fg-primary)] whitespace-nowrap">
                      {row.feature}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[var(--fg-primary)]">
                      {row.stlive}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--fg-secondary)]">{row.bigo}</td>
                    <td className="py-3.5 px-4 text-[var(--fg-secondary)]">{row.buzzcast}</td>
                    <td className="py-3.5 px-4 text-[var(--fg-secondary)]">{row.mango}</td>
                    <td className="py-3.5 px-4 text-[var(--fg-secondary)]">{row.papaya}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : !session ? (
        /* Signed-Out Entry Card */
        <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center space-y-5">
          <ShieldCheck className="mx-auto h-10 w-10 text-[var(--accent-primary)]" />
          <h2 className="font-display text-xl font-bold text-[var(--fg-primary)]">
            One Unified Portal for Every Role
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fg-secondary)]">
            Sign in or create an account as a <strong>Guest</strong>, <strong>Host</strong>,{' '}
            <strong>Host-Assigned Admin</strong> (same User UID + Host-provided password),{' '}
            <strong>Agency</strong>, or <strong>Bands / Brands</strong> to load your tailored interface.
          </p>
          <button
            type="button"
            onClick={onOpenLogin}
            className="h-11 rounded-xl bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
          >
            Open Unified Login Screen
          </button>
        </section>
      ) : session.role === 'host' ? (
        /* ==============================================================
           HOST WORKSPACE: Go Live + Admin Promotion + Task Assignment
           ============================================================== */
        <div className="space-y-6">
          {/* Quick Go Live Studio Launcher */}
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h2 className="font-display text-base font-bold flex items-center gap-2 text-[var(--fg-primary)]">
              <Radio className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
              <span>Launch New Livestream</span>
            </h2>
            <form onSubmit={handleGoLive} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                required
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="Stream title..."
                className="lg:col-span-2 h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              <select
                value={liveCategory}
                onChange={(e) => setLiveCategory(e.target.value as Livestream['category'])}
                className="h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)]"
              >
                <option value="solo">Solo Video</option>
                <option value="multi_guest">Multi-Guest</option>
                <option value="audio">Audio Room</option>
                <option value="pk">PK Battle</option>
                <option value="games">Live Games</option>
                <option value="music_band">Music & Bands</option>
                <option value="gaming">Gaming</option>
                <option value="brand_drop">Brand Drop</option>
              </select>
              <select
                value={liveGameType}
                onChange={(e) => setLiveGameType(e.target.value as '' | 'fps' | 'ludo' | 'snakes')}
                className="h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)]"
              >
                <option value="fps">Attach 3D FPS Arena</option>
                <option value="ludo">Attach Ludo Table</option>
                <option value="snakes">Attach Snakes Table</option>
                <option value="">No Attached Game</option>
              </select>
              <button
                type="submit"
                className="h-11 rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
              >
                Go Live ({liveSeats} seats)
              </button>
            </form>
            <div className="flex items-center gap-3 text-xs text-[var(--fg-secondary)]">
              <span>Multi-Guest Stage Capacity:</span>
              {[4, 6, 8, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLiveSeats(n)}
                  className={`rounded-md px-2.5 py-1 font-mono-nums cursor-pointer ${
                    liveSeats === n
                      ? 'bg-[var(--fg-primary)] text-[var(--bg-canvas)] font-semibold'
                      : 'bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                  }`}
                >
                  {n} seats
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Promote Any User to Admin with Host-Provided Password (6 Cols) */}
            <section className="lg:col-span-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-5">
              <div>
                <h2 className="font-display text-base font-bold flex items-center gap-2 text-[var(--fg-primary)]">
                  <KeyRound className="h-4.5 w-4.5 text-[var(--accent-secondary)]" />
                  <span>{t('promoteAdmin')}</span>
                </h2>
                <p className="mt-1 text-xs text-[var(--fg-secondary)]">
                  Assign any user UID as your Admin with a Host-provided password. They sign in using their <strong>same UID + your password</strong>.
                </p>
              </div>

              <form onSubmit={handlePromoteAdmin} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                      Target User UID
                    </label>
                    <input
                      list="stlive-users"
                      value={promoteUid}
                      onChange={(e) => setPromoteUid(e.target.value.toUpperCase())}
                      placeholder="ST-2001"
                      required
                      className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 font-mono-nums text-sm text-[var(--fg-primary)]"
                    />
                    <datalist id="stlive-users">
                      {directory
                        .filter((u) => u.uid !== session.uid)
                        .map((u) => (
                          <option key={u.uid} value={u.uid}>
                            {u.displayName} ({u.role})
                          </option>
                        ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                      Host-Provided Admin Password
                    </label>
                    <input
                      type="text"
                      value={promotePassword}
                      onChange={(e) => setPromotePassword(e.target.value)}
                      placeholder="Set secret for Admin..."
                      required
                      minLength={4}
                      className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(
                    [
                      ['canModerateChat', 'Chat Mute / Moderation'],
                      ['canApproveGames', 'Approve Game Requests'],
                      ['canManageSeats', 'Manage Multi-Guest Seats'],
                      ['canRunPK', 'Start / End PK Battles'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={promotePerms[key]}
                        onChange={(e) =>
                          setPromotePerms((p) => ({ ...p, [key]: e.target.checked }))
                        }
                        className="accent-[var(--accent-primary)]"
                      />
                      <span className="text-[var(--fg-primary)]">{label}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Promote / Update Admin Credentials</span>
                </button>
              </form>

              {/* Active Host-Assigned Admins */}
              <div className="border-t border-[var(--border-hairline)] pt-4 space-y-3">
                <h3 className="text-xs font-semibold text-[var(--fg-secondary)]">
                  Your Assigned Admins ({hostAdmins.length})
                </h3>
                {hostAdmins.length === 0 ? (
                  <p className="text-xs text-[var(--fg-muted)]">
                    No Admins assigned yet. Promote any user UID above to delegate room moderation and tasks.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {hostAdmins.map((grant) => (
                      <div
                        key={grant.id}
                        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-[var(--fg-primary)]">
                              {grant.adminName}
                            </div>
                            <div className="font-mono-nums text-xs text-[var(--fg-muted)]">
                              UID: {grant.adminUid}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevokeAdmin(grant.adminUid)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 text-xs text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Revoke</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ['canModerateChat', 'Chat Mod'],
                              ['canApproveGames', 'Game Queue'],
                              ['canManageSeats', 'Seats'],
                              ['canRunPK', 'PK Control'],
                            ] as const
                          ).map(([k, label]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => handleToggleAdminPerm(grant, k)}
                              className={`rounded-md px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                                grant.permissions[k]
                                  ? 'bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-[var(--bg-elevated)] text-[var(--fg-muted)] border border-[var(--border-hairline)]'
                              }`}
                            >
                              {grant.permissions[k] ? '✓ ' : ''}
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Assign & Track Admin Tasks (6 Cols) */}
            <section className="lg:col-span-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-5">
              <div>
                <h2 className="font-display text-base font-bold flex items-center gap-2 text-[var(--fg-primary)]">
                  <ClipboardList className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
                  <span>{t('assignTask')}</span>
                </h2>
                <p className="mt-1 text-xs text-[var(--fg-secondary)]">
                  Delegate clear action items to your Admins and track completion in real time.
                </p>
              </div>

              <form onSubmit={handleAssignTask} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={taskAdminUid}
                    onChange={(e) => setTaskAdminUid(e.target.value)}
                    required
                    className="h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)]"
                  >
                    <option value="">Select Promoted Admin...</option>
                    {hostAdmins.map((a) => (
                      <option key={a.adminUid} value={a.adminUid}>
                        {a.adminName} ({a.adminUid})
                      </option>
                    ))}
                  </select>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)]"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>

                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title (e.g. Approve Ludo players for 8PM stream)"
                  className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)]"
                />
                <input
                  type="text"
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="Optional instructions..."
                  className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)]"
                />
                <button
                  type="submit"
                  disabled={hostAdmins.length === 0}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--fg-primary)] px-4 text-xs font-semibold text-[var(--bg-canvas)] disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Assign Task</span>
                </button>
              </form>

              <div className="border-t border-[var(--border-hairline)] pt-4 space-y-2.5">
                <h3 className="text-xs font-semibold text-[var(--fg-secondary)]">
                  Delegated Tasks ({hostTasks.length})
                </h3>
                {hostTasks.length === 0 ? (
                  <p className="text-xs text-[var(--fg-muted)]">No tasks assigned yet.</p>
                ) : (
                  hostTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--fg-primary)]">
                          {task.title}
                        </div>
                        <div className="text-xs text-[var(--fg-secondary)] mt-0.5">
                          {task.adminName} ({task.adminUid}) · {task.priority} ·{' '}
                          <strong className="capitalize text-[var(--accent-secondary)]">
                            {task.status.replace('_', ' ')}
                          </strong>
                        </div>
                        {task.notes && (
                          <p className="mt-1 text-xs text-[var(--fg-muted)]">{task.notes}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        aria-label="Remove task"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Pending Multiplayer Game Join Approvals for Host */}
          {pendingGameApprovals.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
              <h3 className="font-display text-sm font-bold text-[var(--fg-primary)]">
                Pending Multiplayer Game Join Requests
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingGameApprovals.map((game) =>
                  game.pendingRequests.map((req) => (
                    <div
                      key={`${game.roomId}-${req.uid}`}
                      className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3"
                    >
                      <div>
                        <div className="text-xs font-semibold text-[var(--fg-primary)]">
                          {req.displayName} ({req.uid})
                        </div>
                        <div className="text-[11px] text-[var(--fg-secondary)]">{game.title}</div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            sendWsEvent('game:approve_player', {
                              roomId: game.roomId,
                              targetUid: req.uid,
                            })
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            sendWsEvent('game:decline_player', {
                              roomId: game.roomId,
                              targetUid: req.uid,
                            })
                          }
                          className="rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-xs text-[var(--fg-secondary)] cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      ) : session.role === 'admin' ? (
        /* ==============================================================
           ADMIN PANEL (Host-Assigned UID + Host-Provided Password)
           ============================================================== */
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--fg-primary)]">
                  Host-Scoped Admin Console
                </h2>
                <p className="text-xs text-[var(--fg-secondary)] mt-0.5">
                  Authenticated with your User UID (<span className="font-mono-nums">{session.uid}</span>) and password provided by Host{' '}
                  <strong className="text-[var(--fg-primary)]">
                    {adminScope?.hostName || session.assignedHostName} ({adminScope?.hostUid || session.assignedHostUid})
                  </strong>.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {adminScope?.permissions &&
                  (
                    [
                      ['canModerateChat', 'Chat Moderation'],
                      ['canApproveGames', 'Approve Games'],
                      ['canManageSeats', 'Manage Seats'],
                      ['canRunPK', 'Run PK Battles'],
                    ] as const
                  ).map(([k, label]) => (
                    <span
                      key={k}
                      className={`rounded-md border px-2.5 py-1 font-medium ${
                        adminScope.permissions[k]
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-[var(--border-hairline)] text-[var(--fg-muted)] line-through'
                      }`}
                    >
                      {label}
                    </span>
                  ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-[var(--fg-primary)]">
              {t('assignedTasks')} ({adminScope?.tasks.length || 0})
            </h3>
            {!adminScope || adminScope.tasks.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">
                Your Host has not assigned any tasks yet. Tasks created by your Host appear here automatically.
              </p>
            ) : (
              <div className="space-y-3">
                {adminScope.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[var(--fg-primary)]">
                        {task.title}
                      </div>
                      {task.notes && (
                        <p className="text-xs text-[var(--fg-secondary)]">{task.notes}</p>
                      )}
                      <div className="text-[11px] font-mono-nums text-[var(--fg-muted)]">
                        Priority: {task.priority} · Assigned {task.createdAt}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(['pending', 'in_progress', 'completed'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleAdminTaskStatus(task.id, st)}
                          className={`h-9 rounded-lg px-3 text-xs font-medium capitalize cursor-pointer ${
                            task.status === st
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                              : 'border border-[var(--border-hairline)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : session.role === 'agency' ? (
        /* ==============================================================
           AGENCY WORKSPACE: Host Roster, Targets, Commission & Recruitment
           ============================================================== */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Signed Hosts', value: String(roster.length) },
              {
                label: 'Total Live Hours',
                value: `${roster.reduce((a, b) => a + b.liveHours, 0).toFixed(1)}h`,
              },
              {
                label: 'Total Diamonds',
                value: roster.reduce((a, b) => a + b.diamondsEarned, 0).toLocaleString(),
              },
              {
                label: 'Invite Code',
                value: inviteCode || 'AGY-2026',
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5"
              >
                <div className="text-xs text-[var(--fg-secondary)]">{kpi.label}</div>
                <div className="mt-1 font-display text-2xl font-bold font-mono-nums text-[var(--fg-primary)]">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h2 className="font-display text-base font-bold flex items-center gap-2 text-[var(--fg-primary)]">
              <Building2 className="h-4.5 w-4.5 text-[var(--accent-secondary)]" />
              <span>Recruit Host to Agency</span>
            </h2>
            <form onSubmit={handleRecruitHost} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={recruitUid}
                onChange={(e) => setRecruitUid(e.target.value.toUpperCase())}
                placeholder="Host UID (e.g. ST-1099)"
                className="h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 font-mono-nums text-sm"
              />
              <input
                type="text"
                required
                value={recruitName}
                onChange={(e) => setRecruitName(e.target.value)}
                placeholder="Creator Name"
                className="h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm"
              />
              <button
                type="submit"
                className="h-10 rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--accent-contrast)] cursor-pointer"
              >
                Add to Roster
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="p-5 border-b border-[var(--border-hairline)]">
              <h3 className="font-display text-base font-bold text-[var(--fg-primary)]">
                Agency Host Roster & Monthly Targets
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]">
                    <th className="py-3 px-4 font-semibold">Host</th>
                    <th className="py-3 px-4 font-semibold text-right">Live Hours</th>
                    <th className="py-3 px-4 font-semibold text-right">Diamonds</th>
                    <th className="py-3 px-4 font-semibold text-right">Commission</th>
                    <th className="py-3 px-4 font-semibold">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {roster.map((h) => (
                    <tr key={h.id} className="hover:bg-[var(--bg-canvas)]/50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--fg-primary)]">{h.hostName}</div>
                        <div className="font-mono-nums text-[11px] text-[var(--fg-muted)]">{h.hostUid}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-nums text-[var(--fg-primary)]">
                        {h.liveHours} / {h.targetHours}h
                      </td>
                      <td className="py-3 px-4 text-right font-mono-nums text-[var(--fg-primary)]">
                        {h.diamondsEarned.toLocaleString()} / {h.targetDiamonds.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-nums text-emerald-500 font-semibold">
                        {h.commissionRate}%
                      </td>
                      <td className="py-3 px-4 capitalize text-[var(--fg-secondary)]">
                        {h.status.replace('_', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : session.role === 'band' ? (
        /* ==============================================================
           BANDS & BRANDS WORKSPACE: Live Setlists + Product Drops
           ============================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-5">
            <h2 className="font-display text-base font-bold flex items-center gap-2 text-[var(--fg-primary)]">
              <Music className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
              <span>Band Stage & Live Showcases</span>
            </h2>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <input
                type="text"
                required
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Live session title..."
                className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm"
              />
              <input
                type="text"
                value={eventMembers}
                onChange={(e) => setEventMembers(e.target.value)}
                placeholder="Band lineup (Vocals, Guitar, Drums, Synth)"
                className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm"
              />
              <button
                type="submit"
                className="h-10 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
              >
                Schedule Live Showcase
              </button>
            </form>

            <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
              {bandEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[var(--fg-primary)]">{ev.title}</div>
                    <span className="font-mono-nums text-xs text-[var(--accent-secondary)]">
                      {ev.rsvpCount.toLocaleString()} RSVPs
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--fg-secondary)]">{ev.members}</div>
                  <div className="mt-1 text-[11px] font-mono-nums text-[var(--fg-muted)]">
                    {ev.scheduledAt} · {ev.stageMode.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-5">
            <h2 className="font-display text-base font-bold flex items-center gap-2 text-[var(--fg-primary)]">
              <ShoppingBag className="h-4.5 w-4.5 text-[var(--accent-secondary)]" />
              <span>Brand Sponsorship & Live Merch Drops</span>
            </h2>
            <form onSubmit={handleCreateDrop} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                value={dropTitle}
                onChange={(e) => setDropTitle(e.target.value)}
                placeholder="Product / Merch title"
                className="sm:col-span-2 h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm"
              />
              <input
                type="text"
                value={dropPrice}
                onChange={(e) => setDropPrice(e.target.value)}
                placeholder="$59"
                className="h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 font-mono-nums text-sm"
              />
              <button
                type="submit"
                className="sm:col-span-3 h-10 rounded-xl bg-[var(--fg-primary)] text-xs font-semibold text-[var(--bg-canvas)] cursor-pointer"
              >
                Launch Live Drop
              </button>
            </form>

            <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
              {brandDrops.map((drop) => (
                <div
                  key={drop.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5"
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--fg-primary)]">
                      {drop.productTitle}
                    </div>
                    <div className="text-xs text-[var(--fg-secondary)]">
                      {drop.brandName} · <span className="font-mono-nums">{drop.priceLabel}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono-nums text-xs">
                    <div className="font-semibold text-[var(--fg-primary)]">
                      {drop.claimedCount}/{drop.stockCount}
                    </div>
                    <div className="text-[11px] uppercase text-[var(--accent-secondary)]">
                      {drop.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* ==============================================================
           GUEST WORKSPACE: Shareable UID + Quick Launchers
           ============================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h2 className="font-display text-base font-bold flex items-center gap-2 text-[var(--fg-primary)]">
              <Users className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
              <span>Your Guest Identity</span>
            </h2>
            <p className="text-xs leading-relaxed text-[var(--fg-secondary)]">
              Share your UID below with any Host if they want to promote you as their room Admin. Once promoted, sign in under the <strong>Admin</strong> tab using your same UID and the Host&apos;s password.
            </p>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3">
              <div>
                <div className="text-[11px] text-[var(--fg-muted)]">User UID</div>
                <div className="font-mono-nums text-lg font-bold text-[var(--fg-primary)]">
                  {session.uid}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(session.uid);
                  pushToast(`Copied UID ${session.uid}`, 'success');
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy UID</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--fg-secondary)]">
              <span>Wallet Balance</span>
              <span className="font-mono-nums font-semibold text-[var(--fg-primary)]">
                {session.coins.toLocaleString()} coins
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-[var(--fg-primary)]">
              Jump Right In
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Explore All Live Streams', tab: 'live' as const },
                { label: 'Join Multiplayer Ludo or Snakes', tab: 'games' as const },
                { label: 'Open Standalone Pro Camera Studio', tab: 'camera' as const },
              ].map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => onNavigateTab(item.tab)}
                  className="flex w-full h-11 items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 text-sm font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
                >
                  <span>{item.label}</span>
                  <Check className="h-4 w-4 text-[var(--accent-secondary)]" />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

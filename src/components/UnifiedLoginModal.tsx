import React, { useState } from 'react';
import { Building2, KeyRound, Music, ShieldCheck, User, Video, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { AuthSession, UserRole } from '../types';

interface UnifiedLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (session: AuthSession) => void;
}

const SUGGESTED_UIDS: Record<Exclude<UserRole, 'admin'>, string> = {
  guest: 'ST-2001',
  host: 'ST-1001',
  agency: 'ST-3001',
  band: 'ST-4001',
};

export const UnifiedLoginModal: React.FC<UnifiedLoginModalProps> = ({ open, onClose, onSuccess }) => {
  const { setSession, pushToast, t } = useApp();
  const [role, setRole] = useState<UserRole>('host');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [uid, setUid] = useState('ST-1001');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [hostUid, setHostUid] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const roles: Array<{ id: UserRole; label: string; icon: React.ElementType }> = [
    { id: 'guest', label: t('roleGuest'), icon: User },
    { id: 'host', label: t('roleHost'), icon: Video },
    { id: 'admin', label: t('roleAdmin'), icon: ShieldCheck },
    { id: 'agency', label: t('roleAgency'), icon: Building2 },
    { id: 'band', label: t('roleBand'), icon: Music },
  ];

  const handleRoleSwitch = (nextRole: UserRole) => {
    setRole(nextRole);
    setError('');
    if (nextRole === 'admin') {
      setMode('login');
      setUid('ST-2001');
    } else {
      setUid(SUGGESTED_UIDS[nextRole]);
    }
  };

  const handleQuickGuest = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not start guest session.');
      } else {
        setSession(data.session);
        pushToast(`Signed in as ${data.session.displayName} (${data.session.uid})`, 'success');
        onSuccess?.(data.session);
        onClose();
      }
    } catch {
      setError('Network error while connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'register' && role !== 'admin' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register' && role !== 'admin'
          ? { uid, displayName: displayName.trim() || uid, password, role }
          : { uid, password, role, hostUid: role === 'admin' ? hostUid : undefined };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
      } else {
        setSession(data.session);
        pushToast(
          role === 'admin'
            ? `Admin session active for Host ${data.session.assignedHostName}`
            : `Welcome, ${data.session.displayName}`,
          'success'
        );
        onSuccess?.(data.session);
        onClose();
      }
    } catch {
      setError('Unable to reach STLive authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('loginTitle')}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--fg-primary)]">
              {t('loginTitle')}
            </h2>
            <p className="mt-1 text-sm text-[var(--fg-secondary)]">
              {t('loginSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Unified 5-Role Selector */}
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 rounded-xl bg-[var(--bg-elevated)]">
          {roles.map((r) => {
            const Icon = r.icon;
            const active = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSwitch(r.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 px-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs font-semibold'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate max-w-full">{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sign In vs Create Account Switch (Admin is strictly Host-assigned) */}
        {role !== 'admin' ? (
          <div className="mt-5 flex items-center gap-4 border-b border-[var(--border-hairline)] text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`pb-2.5 font-medium transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'border-b-2 border-[var(--accent-primary)] text-[var(--fg-primary)]'
                  : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
              }`}
            >
              {t('signIn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`pb-2.5 font-medium transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'border-b-2 border-[var(--accent-primary)] text-[var(--fg-primary)]'
                  : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
              }`}
            >
              {t('createAccount')}
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-xs leading-relaxed text-[var(--fg-secondary)] flex items-start gap-2.5">
            <KeyRound className="h-4 w-4 shrink-0 text-[var(--accent-secondary)] mt-0.5" />
            <span>{t('adminLoginHint')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1.5">
              {t('uidLabel')}
            </label>
            <input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value.toUpperCase())}
              placeholder="ST-1001"
              required
              className="w-full h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 font-mono-nums text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>

          {mode === 'register' && role !== 'admin' && (
            <div>
              <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1.5">
                {t('displayNameLabel')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Maya Lin"
                required
                className="w-full h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1.5">
              {role === 'admin' ? t('hostAdminPasswordLabel') : t('passwordLabel')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={role === 'admin' ? 'Password set by your Host' : 'At least 6 characters'}
              required
              className="w-full h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>

          {role === 'admin' && (
            <div>
              <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1.5">
                {t('hostUidOptional')}
              </label>
              <input
                type="text"
                value={hostUid}
                onChange={(e) => setHostUid(e.target.value.toUpperCase())}
                placeholder="ST-1001"
                className="w-full h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 font-mono-nums text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-500 dark:text-rose-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading
              ? 'Please wait...'
              : mode === 'register' && role !== 'admin'
                ? `${t('createAccount')} (${role.toUpperCase()})`
                : `${t('signIn')} (${role.toUpperCase()})`}
          </button>
        </form>

        {/* 1-Tap Instant Guest Entry */}
        {role === 'guest' && (
          <div className="mt-4 border-t border-[var(--border-hairline)] pt-4">
            <button
              type="button"
              onClick={handleQuickGuest}
              disabled={loading}
              className="w-full h-11 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-sm font-medium text-[var(--fg-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
            >
              {t('continueAsGuest')}
            </button>
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--fg-muted)] leading-relaxed">
          Tip: New here? Select <strong>Host</strong>, <strong>Agency</strong>, or <strong>Bands</strong> and switch to{' '}
          <strong>Create Account</strong> to claim showcase UIDs like <span className="font-mono-nums">ST-1001</span> or register your own UID. Hosts can then promote any UID (e.g. <span className="font-mono-nums">ST-2001</span>) to Admin with a Host-provided password.
        </p>
      </div>
    </div>
  );
};

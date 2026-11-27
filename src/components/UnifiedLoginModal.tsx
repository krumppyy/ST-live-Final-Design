import React, { useState } from 'react';
import { Building2, KeyRound, Lock, Music, ShieldCheck, User, Video, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { COUNTRIES } from '../lib/countries';
import { evaluatePasswordStrength, stretchPasswordClient } from '../lib/stickers';
import type { AuthSession, UserRole } from '../types';

interface UnifiedLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (session: AuthSession) => void;
}

const SUGGESTED_UIDS: Record<Exclude<UserRole, 'admin' | 'staff'>, string> = {
  guest: 'ST-2001',
  host: 'ST-1001',
  agency: 'ST-3001',
  band: 'ST-4001',
};

export const UnifiedLoginModal: React.FC<UnifiedLoginModalProps> = ({ open, onClose, onSuccess }) => {
  const { setSession, authFetch, pushToast, t } = useApp();
  const [role, setRole] = useState<UserRole>('host');
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [identifier, setIdentifier] = useState('ST-1001');
  const [displayName, setDisplayName] = useState('');
  const [contact, setContact] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [password, setPassword] = useState('');
  const [hostUid, setHostUid] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Reset Password state
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetProof, setResetProof] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const roles: Array<{ id: UserRole; label: string; icon: React.ElementType }> = [
    { id: 'guest', label: t('roleGuest'), icon: User },
    { id: 'host', label: t('roleHost'), icon: Video },
    { id: 'admin', label: t('roleAdmin'), icon: ShieldCheck },
    { id: 'agency', label: t('roleAgency'), icon: Building2 },
    { id: 'band', label: t('roleBand'), icon: Music },
  ];

  const pwStrength = evaluatePasswordStrength(mode === 'reset' ? resetNewPw : password);

  const handleRoleSwitch = (nextRole: UserRole) => {
    setRole(nextRole);
    setError('');
    setInfo('');
    setTotpRequired(false);
    if (nextRole === 'admin') {
      setMode('login');
      setIdentifier('ST-2001');
    } else if (nextRole !== 'staff') {
      setIdentifier(SUGGESTED_UIDS[nextRole]);
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
        pushToast(`Signed in as ${data.session.displayName} (#${data.session.numericId})`, 'success');
        onSuccess?.(data.session);
        onClose();
      }
    } catch {
      setError('Network error while connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (resetStep === 'request') {
        const res = await fetch('/api/auth/reset-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || 'Reset request failed.');
        else {
          setInfo(data.message || 'Reset queued for staff approval.');
          setResetStep('confirm');
        }
      } else {
        const stretched = await stretchPasswordClient(resetNewPw, identifier.toLowerCase());
        const res = await fetch('/api/auth/reset-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier,
            contactProof: resetProof,
            newPassword: stretched,
            pwStretched: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || 'Could not confirm password reset.');
        else {
          pushToast('Password reset complete! Sign in with your new password.', 'success');
          setMode('login');
          setResetStep('request');
          setPassword('');
        }
      }
    } catch {
      setError('Unable to reach authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'reset') {
      await handleResetSubmit(e);
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      // Host-Assigned Admin uses the dedicated host-password admin endpoint
      if (role === 'admin') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: identifier.toUpperCase(), password, role: 'admin', hostUid: hostUid || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Admin authentication failed.');
        } else {
          setSession(data.session);
          pushToast(`Admin session active for Host ${data.session.assignedHostName}`, 'success');
          onSuccess?.(data.session);
          onClose();
        }
        return;
      }

      if (mode === 'register') {
        const stretched = await stretchPasswordClient(password, displayName.trim().toLowerCase());
        const res = await authFetch('/api/auth/register-v2', {
          method: 'POST',
          body: JSON.stringify({
            displayName: displayName.trim(),
            contact: contact.trim(),
            password: stretched,
            rawPasswordLen: password.length,
            pwStretched: true,
            role,
            countryCode,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Registration failed.');
        } else {
          setSession(data.session);
          pushToast(`Account created: ${data.session.displayName} (#${data.session.numericId})`, 'success');
          onSuccess?.(data.session);
          onClose();
        }
        return;
      }

      // Sign In (v2 supports UID, #NumericID, Email, Phone, PBKDF2-stretched + Legacy + TOTP 2FA)
      const stretched = await stretchPasswordClient(password, identifier.trim().toLowerCase());
      const res = await fetch('/api/auth/login-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          rawPassword: password,
          stretchedPassword: stretched,
          totpCode: totpRequired ? totpCode.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (data.require2fa) {
        setTotpRequired(true);
        setInfo(data.message || 'Enter your 6-digit authenticator code.');
        return;
      }
      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
      } else {
        setSession(data.session);
        pushToast(`Welcome, ${data.session.displayName}`, 'success');
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
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-7 shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--fg-primary)]">
              {t('loginTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">
              PBKDF2-SHA256 hardened auth · UID, Email, Phone, or #ID
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Unified 5-Role Selector */}
        <div className="mt-5 grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 rounded-xl bg-[var(--bg-elevated)]">
          {roles.map((r) => {
            const Icon = r.icon;
            const active = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSwitch(r.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
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

        {/* Mode Tabs */}
        {role !== 'admin' ? (
          <div className="mt-4 flex items-center gap-4 border-b border-[var(--border-hairline)] text-xs sm:text-sm">
            {(
              [
                ['login', t('signIn')],
                ['register', t('createAccount')],
                ['reset', 'Reset Password'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError('');
                  setInfo('');
                  setTotpRequired(false);
                }}
                className={`pb-2 font-medium transition-colors cursor-pointer ${
                  mode === m
                    ? 'border-b-2 border-[var(--accent-primary)] text-[var(--fg-primary)] font-semibold'
                    : 'text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs leading-relaxed text-[var(--fg-secondary)] flex items-start gap-2">
            <KeyRound className="h-4 w-4 shrink-0 text-[var(--accent-secondary)] mt-0.5" />
            <span>{t('adminLoginHint')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {mode === 'register' && role !== 'admin' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                    {t('displayNameLabel')}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Maya Lin"
                    required
                    className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                    Country & Flag
                  </label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--fg-primary)]"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                  Email or Phone Number (Single Field)
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="creator@example.com or +1 555 234 5678"
                  required
                  className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                {role === 'admin' ? t('uidLabel') : 'UID, Email, Phone, or #Numeric ID'}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="ST-1001, #100001, or email@example.com"
                required
                className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 font-mono-nums text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                {role === 'admin' ? t('hostAdminPasswordLabel') : t('passwordLabel')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                required
                className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              {mode === 'register' && password.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1 flex-1 rounded-full ${
                          pwStrength.score >= step
                            ? pwStrength.score >= 3
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                            : 'bg-[var(--border-hairline)]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-[10px] text-[var(--fg-muted)]">Strength: {pwStrength.label}</div>
                </div>
              )}
            </div>
          )}

          {mode === 'reset' && resetStep === 'confirm' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                  Contact Proof (Stored Email or Phone)
                </label>
                <input
                  type="text"
                  value={resetProof}
                  onChange={(e) => setResetProof(e.target.value)}
                  placeholder="Exact email or phone on file"
                  required
                  className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                  New Password (8+ chars)
                </label>
                <input
                  type="password"
                  value={resetNewPw}
                  onChange={(e) => setResetNewPw(e.target.value)}
                  required
                  className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm"
                />
              </div>
            </>
          )}

          {totpRequired && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Lock className="h-3.5 w-3.5" />
                <span>2-Factor Verification Required</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit authenticator code"
                required
                className="w-full h-10 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 font-mono-nums text-sm tracking-widest"
              />
            </div>
          )}

          {role === 'admin' && (
            <div>
              <label className="block text-xs font-medium text-[var(--fg-secondary)] mb-1">
                {t('hostUidOptional')}
              </label>
              <input
                type="text"
                value={hostUid}
                onChange={(e) => setHostUid(e.target.value.toUpperCase())}
                placeholder="ST-1001"
                className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 font-mono-nums text-sm text-[var(--fg-primary)]"
              />
            </div>
          )}

          {info && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              {info}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading
              ? 'Please wait...'
              : mode === 'reset'
                ? resetStep === 'request'
                  ? 'Request Staff-Approved Reset'
                  : 'Confirm New Password'
                : mode === 'register' && role !== 'admin'
                  ? `${t('createAccount')} (${role.toUpperCase()})`
                  : `${t('signIn')} (${role.toUpperCase()})`}
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => setResetStep((s) => (s === 'request' ? 'confirm' : 'request'))}
              className="w-full text-center text-[11px] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] cursor-pointer"
            >
              {resetStep === 'request'
                ? 'Already have Staff approval? Enter contact proof →'
                : '← Back to submit reset request'}
            </button>
          )}
        </form>

        {/* 1-Tap Instant Guest Entry */}
        {role === 'guest' && mode !== 'reset' && (
          <div className="mt-4 border-t border-[var(--border-hairline)] pt-3.5">
            <button
              type="button"
              onClick={handleQuickGuest}
              disabled={loading}
              className="w-full h-10 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
            >
              {t('continueAsGuest')} (3 Free PIN Trials · 1,000 Coins)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

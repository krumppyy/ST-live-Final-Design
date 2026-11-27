import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  Crown,
  ExternalLink,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  Radio,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { countryFlag, getCountry } from '../lib/countries';
import { computeLevelInfo } from '../lib/leveling';
import type { Livestream, PublicUserProfile } from '../types';

interface PublicProfileModalProps {
  uid: string | null;
  onClose: () => void;
  onMessageUser?: (uid: string) => void;
  onWatchStream?: (stream: Livestream) => void;
  onRequireLogin: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  uid,
  onClose,
  onMessageUser,
  onWatchStream,
  onRequireLogin,
}) => {
  const { session, streams, followingHostUids, toggleFollowHost, pushToast } = useApp();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`/api/users/${encodeURIComponent(uid)}/profile`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Profile unavailable.');
        if (!cancelled) setProfile(data.profile);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load creator profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uid, onClose]);

  if (!uid) return null;

  const isMe = session?.uid === uid;
  const isFollowing = followingHostUids.includes(uid);
  const liveMatch = profile?.liveStreamId
    ? streams.find((s) => s.id === profile.liveStreamId)
    : streams.find((s) => s.hostUid === uid);
  const lvlInfo = profile ? computeLevelInfo(profile.xp) : null;
  const skillTags = profile?.skills
    ? profile.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const countryMeta = profile ? getCountry(profile.countryCode) : null;

  const handleFollow = async () => {
    if (!session) {
      onRequireLogin();
      return;
    }
    if (!profile) return;
    const roomId = liveMatch?.id || `profile-${profile.uid}`;
    const res = await toggleFollowHost(roomId, profile.uid);
    if (res !== null) {
      setProfile((prev) =>
        prev && typeof prev.followerCount === 'number'
          ? { ...prev, followerCount: Math.max(0, prev.followerCount + (res ? 1 : -1)) }
          : prev
      );
      pushToast(res ? `Following ${profile.displayName}` : `Unfollowed ${profile.displayName}`, 'info');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Creator Biodata Profile"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto no-scrollbar rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/85 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {loading ? (
          <div className="p-10 text-center text-xs text-[var(--fg-secondary)]">Loading creator biodata...</div>
        ) : error || !profile || !lvlInfo ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-rose-700 dark:text-rose-400">{error || 'Profile not found.'}</p>
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[var(--border-hairline)] px-4 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Cover Banner */}
            <div className="relative h-32 sm:h-36 w-full overflow-hidden bg-gradient-to-br from-[var(--accent-primary)]/35 via-[var(--bg-elevated)] to-[var(--accent-secondary)]/30">
              {profile.coverUrl && (
                <img
                  src={profile.coverUrl}
                  alt={`${profile.displayName} cover`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              {liveMatch && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  <Radio className="h-3 w-3" />
                  LIVE NOW
                </span>
              )}
            </div>

            {/* Avatar & Identity Header */}
            <div className="px-5 pb-5">
              <div className="-mt-10 flex items-end justify-between gap-3 relative z-10">
                <div className="h-20 w-20 rounded-2xl border-4 border-[var(--bg-surface)] bg-[var(--bg-elevated)] overflow-hidden shadow-lg shrink-0 flex items-center justify-center">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-2xl font-bold text-[var(--accent-primary)]">
                      {profile.displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-11">
                  {liveMatch && onWatchStream && (
                    <button
                      type="button"
                      onClick={() => {
                        onWatchStream(liveMatch);
                        onClose();
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--accent-contrast)] cursor-pointer"
                    >
                      <Radio className="h-3.5 w-3.5" />
                      Watch Live
                    </button>
                  )}
                  {!isMe && (
                    <button
                      type="button"
                      onClick={handleFollow}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold cursor-pointer ${
                        isFollowing
                          ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:border-[var(--accent-primary)]'
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isFollowing ? 'fill-current' : ''}`} />
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                  {!isMe && profile.allowDm && onMessageUser && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!session) {
                          onRequireLogin();
                          return;
                        }
                        onMessageUser(profile.uid);
                        onClose();
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      DM
                    </button>
                  )}
                </div>
              </div>

              {/* Name, Badges & Headline */}
              <div className="mt-3 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-base leading-none">{countryFlag(profile.countryCode)}</span>
                  <h2 className="font-display text-lg font-bold text-[var(--fg-primary)]">
                    {profile.displayName}
                  </h2>
                  {profile.verified && (
                    <span
                      title={
                        profile.partnerVerified
                          ? 'Verified Free-to-Earn Creator Partner'
                          : 'Verified StreamLive Creator'
                      }
                      className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400"
                    >
                      <BadgeCheck className="h-4 w-4" />
                    </span>
                  )}
                  {profile.partnerVerified && (
                    <span className="rounded-md bg-emerald-500/15 border border-emerald-500/35 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      PARTNER
                    </span>
                  )}
                  {profile.isVip && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      <Crown className="h-3 w-3" /> VIP
                    </span>
                  )}
                  {profile.isPro && (
                    <span className="rounded-md bg-[var(--accent-primary)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-primary)]">
                      PRO
                    </span>
                  )}
                </div>

                {profile.headline && (
                  <p className="text-xs font-semibold text-[var(--fg-primary)]">{profile.headline}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-nums text-[var(--fg-secondary)]">
                  <span>{profile.uid}</span>
                  <span>· #{profile.numericId}</span>
                  <span className="uppercase">{profile.role}</span>
                  {countryMeta && <span>· {countryMeta.name}</span>}
                  {typeof profile.followerCount === 'number' && (
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--fg-primary)]">
                      · <UserCheck className="h-3 w-3 text-[var(--accent-secondary)]" />{' '}
                      {profile.followerCount.toLocaleString()} followers
                    </span>
                  )}
                </div>
              </div>

              {/* Progressive Level & Rank Bar */}
              <div className="mt-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--fg-primary)]">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
                    Level {lvlInfo.level} · <span className={lvlInfo.rankAccent}>{lvlInfo.rankTitle}</span>
                  </span>
                  <span className="font-mono-nums text-[11px] text-[var(--fg-secondary)]">
                    {lvlInfo.totalXp.toLocaleString()} XP
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--bg-canvas)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-gold)]"
                    style={{ width: `${lvlInfo.progressPct}%` }}
                  />
                </div>
              </div>

              {/* Creator Biodata / CV Fields (Only fields enabled by user) */}
              <div className="mt-4 space-y-3">
                {profile.bio && (
                  <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                      About / Experience
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--fg-primary)] whitespace-pre-line">
                      {profile.bio}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {profile.location && (
                    <div className="flex items-start gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5">
                      <MapPin className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase text-[var(--fg-muted)]">Location</div>
                        <div className="truncate font-medium text-[var(--fg-primary)]">{profile.location}</div>
                      </div>
                    </div>
                  )}

                  {profile.schedule && (
                    <div className="flex items-start gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5">
                      <CalendarClock className="h-3.5 w-3.5 text-[var(--accent-secondary)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase text-[var(--fg-muted)]">
                          Broadcast Schedule
                        </div>
                        <div className="truncate font-medium text-[var(--fg-primary)]">{profile.schedule}</div>
                      </div>
                    </div>
                  )}

                  {profile.languages && (
                    <div className="flex items-start gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5">
                      <Globe className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase text-[var(--fg-muted)]">Languages</div>
                        <div className="truncate font-medium text-[var(--fg-primary)]">{profile.languages}</div>
                      </div>
                    </div>
                  )}

                  {(profile.age || profile.gender) && (
                    <div className="flex items-start gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5">
                      <UserCheck className="h-3.5 w-3.5 text-[var(--accent-gold)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase text-[var(--fg-muted)]">Details</div>
                        <div className="truncate font-medium text-[var(--fg-primary)]">
                          {[profile.age ? `Age ${profile.age}` : '', profile.gender || '']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {skillTags.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      Skills & Specialties
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skillTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--fg-primary)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.hobbies && (
                  <div className="text-xs text-[var(--fg-secondary)]">
                    <span className="font-semibold text-[var(--fg-primary)]">Interests: </span>
                    {profile.hobbies}
                  </div>
                )}

                {profile.websiteUrl && (
                  <a
                    href={profile.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>{profile.websiteUrl.replace(/^https:\/\//i, '')}</span>
                  </a>
                )}

                {!profile.bio &&
                  !profile.location &&
                  !profile.schedule &&
                  !profile.languages &&
                  skillTags.length === 0 &&
                  !profile.hobbies && (
                    <div className="rounded-xl border border-dashed border-[var(--border-hairline)] p-4 text-center text-xs text-[var(--fg-muted)]">
                      This creator keeps their biodata private.
                    </div>
                  )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

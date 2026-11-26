import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Eye,
  Flame,
  Headphones,
  Image as ImageIcon,
  KeyRound,
  Lock,
  MessageSquarePlus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  compressImageToDataUrl,
  computeSafetyNumber,
  decryptPayload,
  encryptPayload,
  formatRemainingCountdown,
  formatTtlShort,
} from '../lib/e2ee';
import type { DirectoryUser, InboxConversation, InboxMessage } from '../types';

interface InboxHubProps {
  initialDmUid?: string | null;
  initialJoinCode?: string | null;
  onConsumeDeepLink?: () => void;
  onRequireLogin: () => void;
}

type InboxFilter = 'all' | 'dm' | 'group' | 'support';

const TTL_PRESETS: Array<{ label: string; sec: number }> = [
  { label: 'Off', sec: 0 },
  { label: '10s', sec: 10 },
  { label: '30s', sec: 30 },
  { label: '1m', sec: 60 },
  { label: '5m', sec: 300 },
  { label: '1h', sec: 3600 },
  { label: '24h', sec: 86400 },
  { label: '7d', sec: 604800 },
];

const SUPPORT_QUICK_PROMPTS = [
  'How does 1-on-1 encryption work?',
  'How to create & invite members to a group?',
  'How do Hosts assign an Admin password?',
  'Camera Pro, Reels & Gimbal tips',
  'How to Go Live with 3D FPS / Ludo?',
];

export const InboxHub: React.FC<InboxHubProps> = ({
  initialDmUid,
  initialJoinCode,
  onConsumeDeepLink,
  onRequireLogin,
}) => {
  const {
    session,
    authFetch,
    subscribeWs,
    sendWsEvent,
    pushToast,
    mediaLibrary,
  } = useApp();

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Composer State
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [viewOnceToggle, setViewOnceToggle] = useState(false);
  const [msgTtlOverride, setMsgTtlOverride] = useState<number | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);

  // Popovers & Modals
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [dmUidInput, setDmUidInput] = useState('');
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSelectedUids, setGroupSelectedUids] = useState<string[]>([]);
  const [groupCustomUid, setGroupCustomUid] = useState('');
  const [groupTtlSec, setGroupTtlSec] = useState(0);
  const [groupE2ee, setGroupE2ee] = useState(true);

  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSelected, setInviteSelected] = useState<string[]>([]);
  const [inviteCustomUid, setInviteCustomUid] = useState('');

  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const [customVal, setCustomVal] = useState('45');
  const [customUnit, setCustomUnit] = useState<'sec' | 'min' | 'hr' | 'day'>('sec');

  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [safetyNumber, setSafetyNumber] = useState('');

  // Active 1-Click View-Once Reveal Overlay
  const [revealedOnce, setRevealedOnce] = useState<{
    kind: 'text' | 'image';
    content: string;
    senderName: string;
  } | null>(null);

  // Live 1s Clock for Disappearing Countdowns
  const [nowTs, setNowTs] = useState(() => Date.now());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const msgEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  // Effective disappearing timer (per-message override or conversation default)
  const effectiveTtlSec = msgTtlOverride !== null ? msgTtlOverride : activeConv?.defaultTtlSec || 0;

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!session) return;
    try {
      const res = await authFetch('/api/inbox/conversations');
      if (res.ok) {
        const data = (await res.json()) as { conversations: InboxConversation[] };
        setConversations(data.conversations || []);
        setActiveId((prev) => {
          if (prev && data.conversations.some((c) => c.id === prev)) return prev;
          return window.innerWidth >= 768 ? data.conversations[0]?.id || null : null;
        });
      }
    } catch {
      // ignore offline
    }
  }, [session, authFetch]);

  const fetchDirectory = useCallback(async () => {
    try {
      const res = await fetch('/api/users/directory');
      if (res.ok) {
        const data = (await res.json()) as { users: DirectoryUser[] };
        setDirectory(data.users || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDirectory();
    fetchConversations();
  }, [fetchDirectory, fetchConversations]);

  // Handle deep-linked DM from LiveRoomView or Group Invite Link (?joinGroup=CODE)
  useEffect(() => {
    if (!session) return;
    if (initialDmUid) {
      authFetch('/api/inbox/dm', {
        method: 'POST',
        body: JSON.stringify({ targetUid: initialDmUid }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.conversation) {
            fetchConversations();
            setActiveId(data.conversation.id);
          }
          onConsumeDeepLink?.();
        })
        .catch(() => onConsumeDeepLink?.());
    } else if (initialJoinCode) {
      authFetch('/api/inbox/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: initialJoinCode }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.conversation) {
            pushToast(`Joined group ${data.conversation.title}`, 'success');
            fetchConversations();
            setActiveId(data.conversation.id);
          }
          onConsumeDeepLink?.();
        })
        .catch(() => onConsumeDeepLink?.());
    }
  }, [session, initialDmUid, initialJoinCode, authFetch, fetchConversations, onConsumeDeepLink, pushToast]);

  // Decrypt helper for messages in active conversation
  const decryptMessageBatch = useCallback(
    async (conv: InboxConversation, msgs: InboxMessage[]) => {
      const memberUids = conv.members.map((m) => m.uid);
      const entries: Record<string, string> = {};
      for (const m of msgs) {
        if (m.consumed || m.viewOnce || !m.ciphertext) continue;
        if (m.encrypted) {
          entries[m.id] = await decryptPayload(m.ciphertext, m.iv, true, conv.id, memberUids);
        } else {
          entries[m.id] = m.ciphertext;
        }
      }
      setDecryptedMap((prev) => ({ ...prev, ...entries }));
    },
    []
  );

  // Load messages for selected conversation
  useEffect(() => {
    if (!session || !activeId) {
      setMessages([]);
      return;
    }
    let alive = true;
    setLoadingMsgs(true);
    setMsgTtlOverride(null);
    setViewOnceToggle(false);
    setTypingLabel(null);

    authFetch(`/api/inbox/conversations/${encodeURIComponent(activeId)}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data: { messages?: InboxMessage[]; conversation?: InboxConversation } | null) => {
        if (!alive || !data) return;
        const list = data.messages || [];
        setMessages(list);
        if (data.conversation) {
          setConversations((prev) =>
            prev.map((c) => (c.id === data.conversation!.id ? data.conversation! : c))
          );
          await decryptMessageBatch(data.conversation, list);
        }
      })
      .finally(() => {
        if (alive) setLoadingMsgs(false);
      });

    return () => {
      alive = false;
    };
  }, [session, activeId, authFetch, decryptMessageBatch]);

  // Compute WhatsApp-style Safety Number when Safety Modal opens
  useEffect(() => {
    if (!safetyModalOpen || !activeConv) return;
    computeSafetyNumber(
      activeConv.id,
      activeConv.members.map((m) => m.uid)
    ).then(setSafetyNumber);
  }, [safetyModalOpen, activeConv]);

  // Real-time WebSocket subscriptions for Inbox
  useEffect(() => {
    if (!session) return;
    const unsub = subscribeWs(async (event, payload) => {
      if (event === 'inbox:new_message' && payload) {
        const data = payload as { conversationId: string; message: InboxMessage };
        fetchConversations();
        if (data.conversationId === activeId) {
          setMessages((prev) =>
            prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
          );
          if (activeConv) {
            await decryptMessageBatch(activeConv, [data.message]);
          }
        }
      } else if (event === 'inbox:consumed' && payload) {
        const data = payload as { conversationId: string; messageId: string };
        if (data.conversationId === activeId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId ? { ...m, consumed: true, ciphertext: null, iv: null } : m
            )
          );
        }
        fetchConversations();
      } else if (event === 'inbox:expired' && payload) {
        const data = payload as { conversationId: string; messageIds: string[] };
        if (data.conversationId === activeId) {
          const rm = new Set(data.messageIds);
          setMessages((prev) => prev.filter((m) => !rm.has(m.id)));
        }
        fetchConversations();
      } else if (event === 'inbox:deleted' && payload) {
        const data = payload as { conversationId: string; messageId: string };
        if (data.conversationId === activeId) {
          setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
        }
        fetchConversations();
      } else if (event === 'inbox:refresh') {
        fetchConversations();
      } else if (event === 'inbox:typing' && payload) {
        const data = payload as { conversationId: string; displayName: string };
        if (data.conversationId === activeId) {
          setTypingLabel(`${data.displayName} is typing...`);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setTypingLabel(null), 2400);
        }
      }
    });
    return () => {
      unsub();
    };
  }, [session, activeId, activeConv, subscribeWs, fetchConversations, decryptMessageBatch]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingLabel]);

  // Send Encrypted or Support Message (Text or Image, with Disappearing TTL & View-Once)
  const sendMessage = async (kind: 'text' | 'image', rawContent: string) => {
    if (!session || !activeConv || !rawContent.trim()) return;
    setSending(true);
    try {
      const shouldEncrypt = activeConv.e2eeEnabled && activeConv.type !== 'support';
      let ciphertext = rawContent;
      let iv: string | null = null;
      let encrypted = false;

      if (shouldEncrypt) {
        const enc = await encryptPayload(
          rawContent,
          activeConv.id,
          activeConv.members.map((m) => m.uid)
        );
        ciphertext = enc.ciphertext;
        iv = enc.iv;
        encrypted = enc.encrypted;
      }

      const res = await authFetch(`/api/inbox/conversations/${encodeURIComponent(activeConv.id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          kind,
          encrypted,
          ciphertext,
          iv,
          viewOnce: viewOnceToggle,
          ttlSec: effectiveTtlSec,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Failed to send message', 'error');
        return;
      }
      if (data.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
        );
        if (!viewOnceToggle) {
          setDecryptedMap((prev) => ({ ...prev, [data.message.id]: rawContent }));
        }
      }
      setDraft('');
      if (viewOnceToggle) setViewOnceToggle(false);
      fetchConversations();
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage('text', draft.trim());
  };

  // Send Image from Device / SSD
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 1080);
      await sendMessage('image', compressed);
      setShowPhotoPicker(false);
    } catch {
      pushToast('Could not read image', 'error');
    }
  };

  // Send Image from StreamLive Camera Library
  const handleLibraryPhotoSend = async (url: string) => {
    try {
      const compressed = await compressImageToDataUrl(url, 1080);
      await sendMessage('image', compressed);
      setShowPhotoPicker(false);
    } catch {
      pushToast('Could not attach library photo', 'error');
    }
  };

  // One-Click Reveal & Auto-Destruct for 1× View-Once Messages & Photos
  const handleOpenViewOnce = async (msg: InboxMessage) => {
    if (!activeConv || msg.consumed) return;
    try {
      const res = await authFetch(`/api/inbox/messages/${encodeURIComponent(msg.id)}/consume`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast(data.error || 'Already vanished', 'info');
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, consumed: true, ciphertext: null, iv: null } : m))
        );
        return;
      }
      const plain = data.encrypted
        ? await decryptPayload(
            data.ciphertext,
            data.iv,
            true,
            activeConv.id,
            activeConv.members.map((m) => m.uid)
          )
        : data.ciphertext || '';

      // Mark locally consumed immediately so it cannot be reopened
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, consumed: true, ciphertext: null, iv: null } : m))
      );
      setRevealedOnce({
        kind: data.kind || msg.kind,
        content: plain,
        senderName: msg.senderName,
      });
    } catch {
      pushToast('Could not open view-once item', 'error');
    }
  };

  const handleStartDm = async (targetUid: string) => {
    const clean = targetUid.trim().toUpperCase();
    if (!clean) return;
    const res = await authFetch('/api/inbox/dm', {
      method: 'POST',
      body: JSON.stringify({ targetUid: clean }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not start chat', 'error');
      return;
    }
    setNewDmOpen(false);
    setDmUidInput('');
    await fetchConversations();
    if (data.conversation) setActiveId(data.conversation.id);
    pushToast('Auto-encrypted 1-on-1 chat ready', 'success');
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const extraUids = groupCustomUid
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const allMembers = [...new Set([...groupSelectedUids, ...extraUids])];
    const res = await authFetch('/api/inbox/groups', {
      method: 'POST',
      body: JSON.stringify({
        title: groupName.trim(),
        memberUids: allMembers,
        defaultTtlSec: groupTtlSec,
        e2eeEnabled: groupE2ee,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Could not create group', 'error');
      return;
    }
    setNewGroupOpen(false);
    setGroupName('');
    setGroupSelectedUids([]);
    setGroupCustomUid('');
    await fetchConversations();
    if (data.conversation) setActiveId(data.conversation.id);
    pushToast(`Group "${data.conversation?.title}" created`, 'success');
  };

  const handleInviteToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv) return;
    const extra = inviteCustomUid
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const list = [...new Set([...inviteSelected, ...extra])];
    if (list.length === 0) return;
    const res = await authFetch(`/api/inbox/groups/${encodeURIComponent(activeConv.id)}/invite`, {
      method: 'POST',
      body: JSON.stringify({ memberUids: list }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Invite failed', 'error');
      return;
    }
    setInviteOpen(false);
    setInviteSelected([]);
    setInviteCustomUid('');
    await fetchConversations();
    pushToast(
      data.added?.length ? `Invited ${data.added.join(', ')}` : 'Members already in group',
      'success'
    );
  };

  const handleJoinGroupByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    const res = await authFetch('/api/inbox/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: joinCodeInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      pushToast(data.error || 'Invalid invite code', 'error');
      return;
    }
    setJoinCodeOpen(false);
    setJoinCodeInput('');
    await fetchConversations();
    if (data.conversation) setActiveId(data.conversation.id);
    pushToast(`Joined "${data.conversation?.title}"`, 'success');
  };

  const handleApplyConversationTtl = async (sec: number) => {
    if (!activeConv) return;
    const res = await authFetch(`/api/inbox/conversations/${encodeURIComponent(activeConv.id)}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ defaultTtlSec: sec }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.conversation) {
        setConversations((prev) => prev.map((c) => (c.id === data.conversation.id ? data.conversation : c)));
      }
      setMsgTtlOverride(null);
      setTimerModalOpen(false);
      pushToast(sec > 0 ? `Disappearing timer: ${formatTtlShort(sec)}` : 'Disappearing timer off', 'success');
    }
  };

  const handleApplyCustomTimer = () => {
    const n = Math.max(1, Number(customVal) || 0);
    const mult = customUnit === 'sec' ? 1 : customUnit === 'min' ? 60 : customUnit === 'hr' ? 3600 : 86400;
    const totalSec = Math.min(60 * 60 * 24 * 30, Math.round(n * mult));
    handleApplyConversationTtl(totalSec);
  };

  const handleShareGroupInvite = async (conv: InboxConversation) => {
    if (!conv.inviteCode) return;
    const url = `${window.location.origin}/?joinGroup=${encodeURIComponent(conv.inviteCode)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${conv.title} on StreamLive`, text: `Invite code: ${conv.inviteCode}`, url });
        return;
      } catch {
        // fallback copy
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    pushToast(`Invite link copied (${conv.inviteCode})`, 'success');
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (filter !== 'all' && c.type !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.members.some((m) => m.displayName.toLowerCase().includes(q) || m.uid.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [conversations, filter, search]);

  const libraryPhotos = useMemo(() => mediaLibrary.filter((a) => a.type === 'photo'), [mediaLibrary]);

  // Require login prompt for unauthenticated visitors
  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-12 pb-24 px-safe-curved">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-7 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-[var(--fg-primary)]">
            Encrypted Inbox &amp; Live Support
          </h1>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-[var(--fg-secondary)]">
            Sign in as a Guest, Host, Admin, Agency, or Band to unlock automatic 1-on-1 AES-256 encrypted chats, groups with invites, disappearing timers, 1× view-once photos, and 24/7 Live Support.
          </p>
          <button
            type="button"
            onClick={onRequireLogin}
            className="h-10 rounded-xl bg-[var(--accent-primary)] px-6 text-xs sm:text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
          >
            Sign In to Open Inbox
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1640px] px-2.5 sm:px-5 lg:px-7 pt-3 sm:pt-5 pb-16 md:pb-6 px-safe-curved">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-12 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] h-[calc(100dvh-124px)] md:h-[calc(100dvh-92px)]">
        {/* =================================================================
            LEFT PANE: CONVERSATIONS LIST (1-on-1 E2EE, Groups, Live Support)
            ================================================================= */}
        <aside
          className={`md:col-span-4 lg:col-span-4 flex flex-col border-r border-[var(--border-hairline)] bg-[var(--bg-elevated)]/40 min-h-0 ${
            activeId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Compact Top Action Strip */}
          <div className="p-3 border-b border-[var(--border-hairline)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-base font-bold text-[var(--fg-primary)]">Inbox</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <Lock className="h-2.5 w-2.5" />
                  E2EE
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setNewDmOpen(true)}
                  title="New 1-on-1 Encrypted Chat"
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 text-[11px] font-semibold text-[var(--accent-contrast)] cursor-pointer"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  <span>Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewGroupOpen(true)}
                  title="Create Group"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 text-[11px] font-semibold text-[var(--fg-primary)] hover:border-[var(--accent-primary)] cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Group</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJoinCodeOpen(true)}
                  title="Join Group via Code"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats, groups, UID..."
                className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'dm', label: '1-on-1' },
                  { id: 'group', label: 'Groups' },
                  { id: 'support', label: 'Support' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                    filter === tab.id
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)]/60">
            {filteredConversations.map((conv) => {
              const selected = conv.id === activeId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setActiveId(conv.id)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[var(--accent-primary)]/12 border-l-2 border-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-surface)]/70'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      conv.type === 'support'
                        ? 'bg-[var(--accent-secondary)] text-[#0d0d10]'
                        : conv.type === 'group'
                          ? 'bg-[var(--accent-gold)]/20 text-[var(--accent-gold)]'
                          : 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                    }`}
                  >
                    {conv.type === 'support' ? (
                      <Headphones className="h-4 w-4" />
                    ) : conv.type === 'group' ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      conv.title.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold text-[var(--fg-primary)] flex items-center gap-1">
                        {conv.title}
                        {conv.e2eeEnabled && <Lock className="h-2.5 w-2.5 shrink-0 text-emerald-400" />}
                      </span>
                      <span className="shrink-0 font-mono-nums text-[9px] text-[var(--fg-muted)]">
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] text-[var(--fg-secondary)]">
                        {conv.lastMessagePreview}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {conv.defaultTtlSec > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 font-mono-nums text-[9px] text-amber-400">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTtlShort(conv.defaultTtlSec)}
                          </span>
                        )}
                        {conv.unreadCount > 0 && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 font-mono-nums text-[9px] font-bold text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredConversations.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--fg-muted)]">
                No chats yet. Start an encrypted 1-on-1 chat or create a group.
              </div>
            )}
          </div>
        </aside>

        {/* =================================================================
            RIGHT PANE: ACTIVE CHAT ROOM
            ================================================================= */}
        <section
          className={`md:col-span-8 lg:col-span-8 flex flex-col min-h-0 bg-[var(--bg-canvas)]/40 ${
            activeId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {!activeConv ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="font-display text-base font-bold text-[var(--fg-primary)]">
                End-to-End Encrypted Inbox
              </h2>
              <p className="max-w-sm text-xs text-[var(--fg-secondary)]">
                Select a conversation, start an automatic AES-256 1-on-1 chat, create a group, or message Live Support.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    aria-label="Back to Inbox"
                    className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-primary)] cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="truncate text-xs sm:text-sm font-bold text-[var(--fg-primary)]">
                        {activeConv.title}
                      </h2>
                      {activeConv.e2eeEnabled && (
                        <button
                          type="button"
                          onClick={() => setSafetyModalOpen(true)}
                          title="Verify Encryption Safety Number"
                          className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 cursor-pointer"
                        >
                          <ShieldCheck className="h-2.5 w-2.5" />
                          <span>E2EE</span>
                        </button>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-[var(--fg-muted)]">
                      {typingLabel ? (
                        <span className="text-[var(--accent-secondary)] font-medium">{typingLabel}</span>
                      ) : activeConv.type === 'support' ? (
                        'Live Support Desk · Online'
                      ) : activeConv.type === 'group' ? (
                        `${activeConv.members.length} members · Code ${activeConv.inviteCode || ''}`
                      ) : (
                        'Auto-encrypted 1-on-1 chat'
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Controls: Disappearing Timer, Group Invite, Share Invite */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTimerModalOpen(true)}
                    title="Disappearing Message Timer"
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold cursor-pointer ${
                      activeConv.defaultTtlSec > 0
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTtlShort(activeConv.defaultTtlSec)}</span>
                  </button>

                  {activeConv.type === 'group' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setInviteOpen(true)}
                        title="Invite Members"
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2 text-[10px] font-semibold text-[var(--accent-contrast)] cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Invite</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShareGroupInvite(activeConv)}
                        title="Share Invite Link"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] cursor-pointer"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Group Member Bar */}
              {activeConv.type === 'group' && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[var(--border-hairline)]/60 bg-[var(--bg-surface)]/60 px-3 py-1.5 text-[10px]">
                  <span className="shrink-0 font-semibold text-[var(--fg-muted)]">Members:</span>
                  {activeConv.members.map((m) => (
                    <span
                      key={m.uid}
                      className="shrink-0 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[var(--fg-primary)]"
                    >
                      {m.displayName} {m.role === 'owner' ? '★' : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                {loadingMsgs && (
                  <p className="text-center text-xs text-[var(--fg-muted)] py-4">Decrypting messages...</p>
                )}

                {messages.map((msg) => {
                  if (msg.kind === 'system') {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1 text-[10px] text-[var(--fg-secondary)]">
                          <Lock className="h-2.5 w-2.5 text-emerald-400" />
                          <span>{msg.ciphertext}</span>
                        </span>
                      </div>
                    );
                  }

                  const isMine = msg.senderUid === session.uid;
                  const plain = decryptedMap[msg.id] ?? (msg.encrypted ? 'Decrypting...' : msg.ciphertext || '');
                  const remaining = msg.expiresAt ? formatRemainingCountdown(msg.expiresAt, nowTs) : null;

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {!isMine && activeConv.type !== 'dm' && (
                        <span className="mb-0.5 px-1 text-[10px] font-medium text-[var(--fg-muted)]">
                          {msg.senderName}
                        </span>
                      )}

                      <div
                        className={`group relative max-w-[82%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-xs shadow-xs ${
                          isMine
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] rounded-br-sm'
                            : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--fg-primary)] rounded-bl-sm'
                        }`}
                      >
                        {/* 1× VIEW-ONCE (Auto-Disappear After One Click) */}
                        {msg.viewOnce ? (
                          msg.consumed ? (
                            <div className="flex items-center gap-1.5 opacity-70 italic text-[11px]">
                              <Flame className="h-3.5 w-3.5" />
                              <span>1× View-once {msg.kind === 'image' ? 'photo' : 'message'} · Vanished</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenViewOnce(msg)}
                              className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition-opacity hover:opacity-90 cursor-pointer ${
                                isMine ? 'bg-black/25 text-white' : 'bg-[var(--bg-elevated)] text-[var(--fg-primary)]'
                              }`}
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-mono-nums text-[11px] font-bold">
                                1×
                              </span>
                              <div>
                                <p className="text-[11px] font-bold">
                                  {msg.kind === 'image' ? 'View-Once Photo' : 'View-Once Message'}
                                </p>
                                <p className="text-[9px] opacity-80">Tap once · auto-vanishes after click</p>
                              </div>
                              <Eye className="h-3.5 w-3.5 ml-1 opacity-80" />
                            </button>
                          )
                        ) : msg.kind === 'image' ? (
                          <div className="space-y-1">
                            {plain.startsWith('data:image') || plain.startsWith('http') || plain.startsWith('blob:') ? (
                              <img
                                src={plain}
                                alt="Encrypted attachment"
                                className="max-h-60 rounded-xl object-cover"
                              />
                            ) : (
                              <span className="text-[11px] opacity-80">Loading encrypted photo...</span>
                            )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{plain}</p>
                        )}

                        {/* Meta row: E2EE lock, Disappearing countdown, Timestamp, Read Receipt, Delete */}
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-[9px] opacity-75">
                          {msg.encrypted && <Lock className="h-2.5 w-2.5" />}
                          {remaining && (
                            <span className="inline-flex items-center gap-0.5 font-mono-nums font-bold text-amber-300">
                              <Clock className="h-2.5 w-2.5" />
                              {remaining}
                            </span>
                          )}
                          <span className="font-mono-nums">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && <CheckCheck className="h-3 w-3" />}
                          {isMine && (
                            <button
                              type="button"
                              onClick={() =>
                                authFetch(`/api/inbox/messages/${encodeURIComponent(msg.id)}`, { method: 'DELETE' })
                              }
                              aria-label="Delete"
                              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef} />
              </div>

              {/* Live Support Quick Help Chips */}
              {activeConv.type === 'support' && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-[var(--border-hairline)]/60 bg-[var(--bg-surface)]/50 px-3 py-1.5">
                  {SUPPORT_QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage('text', q)}
                      className="shrink-0 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--fg-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--fg-primary)] cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Photo Attachment Drawer (Device / SSD OR Camera Library) */}
              {showPhotoPicker && (
                <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 font-semibold text-[var(--accent-contrast)] cursor-pointer"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>Upload Photo / SSD</span>
                      </button>
                      <span className="text-[10px] text-[var(--fg-muted)]">
                        {viewOnceToggle ? 'Sending as 1× View-Once' : effectiveTtlSec > 0 ? `Vanishes in ${formatTtlShort(effectiveTtlSec)}` : 'Encrypted photo'}
                      </span>
                    </div>
                    <button type="button" onClick={() => setShowPhotoPicker(false)} className="p-1 text-[var(--fg-muted)] cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {libraryPhotos.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {libraryPhotos.slice(0, 10).map((ph) => (
                        <button
                          key={ph.id}
                          type="button"
                          onClick={() => handleLibraryPhotoSend(ph.url)}
                          className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] cursor-pointer"
                        >
                          <img src={ph.url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Composer Bar (Text + Photo + 1× View-Once + Disappearing Timer) */}
              <form
                onSubmit={handleFormSubmit}
                className="flex items-center gap-1.5 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-2"
              >
                <button
                  type="button"
                  onClick={() => setShowPhotoPicker((v) => !v)}
                  aria-label="Send Photo"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border cursor-pointer ${
                    showPhotoPicker
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                  }`}
                >
                  <ImageIcon className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setViewOnceToggle((v) => !v)}
                  title="1× View-Once (Auto disappear after one click)"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono-nums text-[11px] font-bold cursor-pointer ${
                    viewOnceToggle
                      ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)]'
                  }`}
                >
                  1×
                </button>

                <input
                  type="text"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    const now = Date.now();
                    if (now - lastTypingSentRef.current > 1800) {
                      lastTypingSentRef.current = now;
                      sendWsEvent('inbox:typing', { conversationId: activeConv.id });
                    }
                  }}
                  placeholder={
                    viewOnceToggle
                      ? '1× View-once message (vanishes after 1 click)...'
                      : effectiveTtlSec > 0
                        ? `Disappearing (${formatTtlShort(effectiveTtlSec)}) encrypted message...`
                        : activeConv.e2eeEnabled
                          ? 'Encrypted message...'
                          : 'Message Live Support...'
                  }
                  className="h-8 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] outline-none focus:border-[var(--accent-primary)]"
                />

                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  aria-label="Send"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] disabled:opacity-40 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* =================================================================
          MODALS: NEW 1-ON-1 DM, CREATE GROUP, INVITE MEMBERS, JOIN CODE, TIMER, SAFETY NUMBER, 1× VIEW-ONCE
          ================================================================= */}

      {/* New 1-on-1 Auto-Encrypted DM */}
      {newDmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fg-primary)] flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-400" />
                New 1-on-1 Encrypted Chat
              </h3>
              <button type="button" onClick={() => setNewDmOpen(false)} className="p-1 text-[var(--fg-muted)] cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={dmUidInput}
                onChange={(e) => setDmUidInput(e.target.value)}
                placeholder="Enter User UID (e.g. ST-1001)"
                className="h-9 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--fg-primary)] outline-none"
              />
              <button
                type="button"
                onClick={() => handleStartDm(dmUidInput)}
                className="h-9 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-semibold text-white cursor-pointer"
              >
                Start
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {directory
                .filter((u) => u.uid !== session.uid)
                .map((u) => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => handleStartDm(u.uid)}
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3 py-2 text-left hover:border-[var(--accent-primary)] cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--fg-primary)]">{u.displayName}</p>
                      <p className="text-[10px] font-mono-nums text-[var(--fg-muted)]">
                        {u.uid} · {u.role}
                      </p>
                    </div>
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {newGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleCreateGroup}
            className="w-full max-w-md rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fg-primary)] flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[var(--accent-gold)]" />
                Create Group Chat
              </h3>
              <button type="button" onClick={() => setNewGroupOpen(false)} className="p-1 text-[var(--fg-muted)] cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Squad Room, Band Crew)"
              className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--fg-primary)] outline-none"
            />

            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupE2ee}
                  onChange={(e) => setGroupE2ee(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Auto-Encrypt Group</span>
              </label>
              <select
                value={groupTtlSec}
                onChange={(e) => setGroupTtlSec(Number(e.target.value))}
                className="h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--fg-primary)]"
              >
                {TTL_PRESETS.map((p) => (
                  <option key={p.sec} value={p.sec}>
                    Timer: {p.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={groupCustomUid}
              onChange={(e) => setGroupCustomUid(e.target.value)}
              placeholder="Extra UIDs (comma separated, e.g. ST-2001, ST-1002)"
              className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--fg-primary)] outline-none"
            />

            <div className="max-h-40 overflow-y-auto space-y-1">
              {directory
                .filter((u) => u.uid !== session.uid)
                .map((u) => {
                  const picked = groupSelectedUids.includes(u.uid);
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() =>
                        setGroupSelectedUids((prev) =>
                          prev.includes(u.uid) ? prev.filter((id) => id !== u.uid) : [...prev, u.uid]
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-left text-xs cursor-pointer ${
                        picked
                          ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/12'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)]/50'
                      }`}
                    >
                      <span>
                        {u.displayName} <span className="text-[10px] text-[var(--fg-muted)]">({u.uid})</span>
                      </span>
                      {picked && <Check className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />}
                    </button>
                  );
                })}
            </div>

            <button
              type="submit"
              className="h-9 w-full rounded-lg bg-[var(--accent-primary)] text-xs font-bold text-white cursor-pointer"
            >
              Create Group
            </button>
          </form>
        </div>
      )}

      {/* Invite Members to Active Group */}
      {inviteOpen && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleInviteToGroup}
            className="w-full max-w-md rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fg-primary)]">Invite to {activeConv.title}</h3>
              <button type="button" onClick={() => setInviteOpen(false)} className="p-1 text-[var(--fg-muted)] cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeConv.inviteCode && (
              <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--fg-muted)] block">Group Invite Code</span>
                  <span className="font-mono-nums font-bold text-[var(--accent-gold)]">{activeConv.inviteCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleShareGroupInvite(activeConv)}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-2.5 text-[11px] font-semibold cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                  <span>Share Link</span>
                </button>
              </div>
            )}

            <input
              type="text"
              value={inviteCustomUid}
              onChange={(e) => setInviteCustomUid(e.target.value)}
              placeholder="Invite by UID (comma separated)..."
              className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--fg-primary)] outline-none"
            />

            <div className="max-h-44 overflow-y-auto space-y-1">
              {directory
                .filter((u) => !activeConv.members.some((m) => m.uid === u.uid))
                .map((u) => {
                  const picked = inviteSelected.includes(u.uid);
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() =>
                        setInviteSelected((prev) =>
                          prev.includes(u.uid) ? prev.filter((id) => id !== u.uid) : [...prev, u.uid]
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-xs cursor-pointer ${
                        picked
                          ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)]/12'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)]/50'
                      }`}
                    >
                      <span>
                        {u.displayName} <span className="text-[10px] text-[var(--fg-muted)]">({u.uid})</span>
                      </span>
                      {picked && <Check className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />}
                    </button>
                  );
                })}
            </div>

            <button
              type="submit"
              className="h-9 w-full rounded-lg bg-[var(--accent-primary)] text-xs font-bold text-white cursor-pointer"
            >
              Send Invites
            </button>
          </form>
        </div>
      )}

      {/* Join Group via Invite Code */}
      {joinCodeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleJoinGroupByCode}
            className="w-full max-w-sm rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fg-primary)]">Join Group by Invite Code</h3>
              <button type="button" onClick={() => setJoinCodeOpen(false)} className="p-1 text-[var(--fg-muted)] cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder="e.g. GRP-A1B2C3"
              className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 font-mono-nums text-xs uppercase text-[var(--fg-primary)] outline-none"
            />
            <button
              type="submit"
              className="h-9 w-full rounded-lg bg-[var(--accent-primary)] text-xs font-bold text-white cursor-pointer"
            >
              Join Group
            </button>
          </form>
        </div>
      )}

      {/* Custom Disappearing Timer Modal */}
      {timerModalOpen && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fg-primary)] flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-400" />
                Disappearing Messages
              </h3>
              <button type="button" onClick={() => setTimerModalOpen(false)} className="p-1 text-[var(--fg-muted)] cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {TTL_PRESETS.map((p) => (
                <button
                  key={p.sec}
                  type="button"
                  onClick={() => handleApplyConversationTtl(p.sec)}
                  className={`h-8 rounded-lg text-xs font-semibold cursor-pointer ${
                    activeConv.defaultTtlSec === p.sec
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Selected Time Period */}
            <div className="pt-2 border-t border-[var(--border-hairline)] space-y-2">
              <p className="text-[11px] font-semibold text-[var(--fg-secondary)]">Custom Time Period</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  className="h-8 w-20 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2 font-mono-nums text-xs text-[var(--fg-primary)]"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as 'sec' | 'min' | 'hr' | 'day')}
                  className="h-8 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2 text-xs text-[var(--fg-primary)]"
                >
                  <option value="sec">Seconds</option>
                  <option value="min">Minutes</option>
                  <option value="hr">Hours</option>
                  <option value="day">Days</option>
                </select>
                <button
                  type="button"
                  onClick={handleApplyCustomTimer}
                  className="h-8 rounded-lg bg-[var(--accent-secondary)] px-3 text-xs font-bold text-[#0d0d10] cursor-pointer"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp-Style E2EE Safety Number Verification Modal */}
      {safetyModalOpen && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-500/35 bg-[var(--bg-surface)] p-5 space-y-3 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-[var(--fg-primary)]">End-to-End Encryption</h3>
            <p className="text-[11px] text-[var(--fg-secondary)]">
              Messages and photos in <span className="font-semibold text-[var(--fg-primary)]">{activeConv.title}</span> are encrypted client-side with AES-256-GCM. Compare this 60-digit safety number:
            </p>
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3 font-mono-nums text-xs tracking-widest text-emerald-400 leading-relaxed">
              {safetyNumber || 'Computing...'}
            </div>
            <button
              type="button"
              onClick={() => setSafetyModalOpen(false)}
              className="h-9 w-full rounded-lg bg-emerald-600 text-xs font-bold text-white cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 1× VIEW-ONCE ONE-CLICK SECURE REVEAL OVERLAY */}
      {revealedOnce && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md select-none">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#111218] p-4 text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Flame className="h-4 w-4" />
                1× View-Once · From {revealedOnce.senderName}
              </span>
              <button
                type="button"
                onClick={() => setRevealedOnce(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {revealedOnce.kind === 'image' ? (
              <img
                src={revealedOnce.content}
                alt="View-once photo"
                className="max-h-[65vh] w-full rounded-xl object-contain bg-black"
              />
            ) : (
              <div className="rounded-xl border border-white/15 bg-black/50 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {revealedOnce.content}
              </div>
            )}
            <p className="text-center text-[10px] text-white/60">
              Permanently erased from server. Closing this view removes it forever.
            </p>
            <button
              type="button"
              onClick={() => setRevealedOnce(null)}
              className="h-9 w-full rounded-lg bg-[#D90429] text-xs font-bold text-white cursor-pointer"
            >
              Close &amp; Vanish
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

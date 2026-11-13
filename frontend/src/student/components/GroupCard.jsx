import React, { useMemo, useState } from 'react';
import { CalendarDays, Check, Copy, LogOut, MessageSquare, MoreHorizontal, Trash2, Vote } from 'lucide-react';
import Avatar from './Avatar';
import HealthBadge from './HealthBadge';
import { ShareBar } from './ProgressBar';
import { btnPrimary, btnSecondary } from '../design';
import useOutsideClick from '../hooks/useOutsideClick';
import { MIN_BALANCE_POINTS } from '../health';

const MAX_AVATARS = 5;
const R = 18;
const CIRC = 2 * Math.PI * R;

const ProgressRing = ({ value = 0, label }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = CIRC - (pct / 100) * CIRC;
  return (
    <div className="relative flex h-12 w-12 items-center justify-center" role="img" aria-label={label || `Progress ${Math.round(pct)}%`}>
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={R} fill="none" stroke="#DDE4EC" strokeWidth="5" />
        <circle cx="24" cy="24" r={R} fill="none" stroke="#4A6079" strokeWidth="5" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset} />
      </svg>
      <span className="absolute text-[10px] font-bold text-[#1F2D3D]">{Math.round(pct)}%</span>
    </div>
  );
};

const GroupCard = ({ group, insight, menuOpen, onToggleMenu, onCloseMenu, onOpenWorkspace, onChat, onLeave, onDelete, unreadMessages = 0, currentUserId, showMenu = true }) => {
  const [copied, setCopied] = useState(false);
  useOutsideClick(showMenu && menuOpen, onCloseMenu);
  const members = insight?.members || [];
  const progress = insight ? insight.progress : Number(group.progress_percentage) || 0;
  const unitLine = group.unit_code ? `${group.unit_code}${group.unit_name ? ` · ${group.unit_name}` : ''}` : group.course || 'Group';
  const openPolls = insight?.openPollsToVote?.length || 0;
  const workload = insight?.workload;

  const share = useMemo(() => {
    if (!workload) return null;
    const my = (workload.members || []).find((m) => String(m.user_id) === String(currentUserId));
    return {
      sharePercent: Number(my?.share_percent ?? workload.share_percent ?? 0),
      points: Number(my?.points_assigned ?? workload.points ?? 0),
      totalPoints: Number(workload.total_points ?? 0),
      memberCount: (workload.members || []).length || members.length || 1,
    };
  }, [workload, members.length, currentUserId]);

  const nextDeadline = insight?.nextDeadline || workload?.upcoming_tasks?.[0]?.due_date || null;

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(group.join_code || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <article className="flex h-full flex-col rounded-xl border border-[#D7DEE6] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#4A6079]">{unitLine}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[#1F2D3D]">{group.name}</h3>
            {group.is_leader && <span className="rounded-full bg-[#E3EAF2] px-2 py-0.5 text-xs font-semibold text-[#2F4A66]">Leader</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ProgressRing value={progress} label={`${group.name} progress`} />
          {showMenu ? (
            <div className="relative shrink-0" data-popover-root>
              <button type="button" aria-label={`More actions for ${group.name}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={onToggleMenu} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4]">
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[#D7DEE6] bg-white p-2 shadow-lg">
                  <button type="button" role="menuitem" onClick={onLeave} className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-[#1F2D3D] hover:bg-[#EEF1F4]"><LogOut size={16} aria-hidden="true" /> Leave group</button>
                  <button type="button" role="menuitem" onClick={onDelete} className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 size={16} aria-hidden="true" /> Delete group</button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center -space-x-2" aria-label={`${group.members_count || members.length} members`}>
          {members.slice(0, MAX_AVATARS).map((member) => <Avatar key={member.id} name={member.name} />)}
          {members.length > MAX_AVATARS && <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-xs font-bold text-[#4F5F73] ring-2 ring-white">+{members.length - MAX_AVATARS}</span>}
          {!members.length && <span className="pl-2 text-sm text-[#4F5F73]">{group.members_count || 0} members</span>}
        </div>
        {insight ? <HealthBadge status={insight.health.status} reason={insight.health.reason} /> : null}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#4F5F73]">Who is carrying the work</p>
        {share ? (
          <ShareBar
            sharePercent={share.sharePercent}
            memberCount={share.memberCount}
            points={share.points}
            totalPoints={share.totalPoints}
            isEarly={share.totalPoints < MIN_BALANCE_POINTS}
          />
        ) : (
          <p className="text-xs text-[#4F5F73]">Workload details loading…</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#4F5F73]">
        <span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden="true" /> Next deadline: <span className="font-semibold text-[#33445A]">{nextDeadline ? new Date(nextDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'None'}</span></span>
      </div>

      {(openPolls > 0 || unreadMessages > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {openPolls > 0 ? <span className="inline-flex items-center gap-1 rounded-full border border-[#C3D0DF] bg-[#E3EAF2] px-2 py-0.5 text-[11px] font-semibold text-[#2F4A66]"><Vote size={12} aria-hidden="true" /> {openPolls} open poll{openPolls === 1 ? '' : 's'}</span> : null}
          {unreadMessages > 0 ? <span className="inline-flex items-center gap-1 rounded-full border border-[#C3D0DF] bg-[#E3EAF2] px-2 py-0.5 text-[11px] font-semibold text-[#2F4A66]"><MessageSquare size={12} aria-hidden="true" /> {unreadMessages} unread</span> : null}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-[#EEF1F4] px-3 py-2">
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-[#4F5F73]">Join code</span>
          <code className="text-sm font-bold tracking-widest text-[#1F2D3D]">{group.join_code || '—'}</code>
        </div>
        <button type="button" onClick={copy} disabled={!group.join_code} aria-label={`Copy join code for ${group.name}`} className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#35475C] hover:bg-white disabled:opacity-50">
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onOpenWorkspace} className={`${btnPrimary} flex-1`}>Open workspace</button>
        <button type="button" onClick={onChat} className={`${btnSecondary} flex-1`}><MessageSquare size={16} aria-hidden="true" /> Chat</button>
      </div>
    </article>
  );
};

export default GroupCard;

import React, { useState } from 'react';
import { Check, Copy, LogOut, MessageSquare, MoreHorizontal, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import HealthBadge from './HealthBadge';
import { ProgressBar } from './ProgressBar';
import { btnPrimary, btnSecondary } from '../design';
import useOutsideClick from '../hooks/useOutsideClick';

const MAX_AVATARS = 5;

const GroupCard = ({ group, insight, menuOpen, onToggleMenu, onCloseMenu, onOpenWorkspace, onChat, onLeave, onDelete }) => {
  const [copied, setCopied] = useState(false);
  useOutsideClick(menuOpen, onCloseMenu);
  const members = insight?.members || [];
  const progress = insight ? insight.progress : Number(group.progress_percentage) || 0;
  const unitLine = group.unit_code ? `${group.unit_code}${group.unit_name ? ` · ${group.unit_name}` : ''}` : group.course || 'Group';

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(group.join_code || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <article className="flex flex-col rounded-xl border border-[#D7DEE6] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#4A6079]">{unitLine}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[#1F2D3D]">{group.name}</h3>
            {group.is_leader && <span className="rounded-full bg-[#E3EAF2] px-2 py-0.5 text-xs font-semibold text-[#2F4A66]">Leader</span>}
          </div>
        </div>
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
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center -space-x-2" aria-label={`${group.members_count || members.length} members`}>
          {members.slice(0, MAX_AVATARS).map((member) => <Avatar key={member.id} name={member.name} />)}
          {members.length > MAX_AVATARS && <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-xs font-bold text-[#4F5F73] ring-2 ring-white">+{members.length - MAX_AVATARS}</span>}
          {!members.length && <span className="text-sm text-[#4F5F73] pl-2">{group.members_count || 0} members</span>}
        </div>
        {insight ? <HealthBadge status={insight.health.status} reason={insight.health.reason} /> : null}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-sm"><span className="text-[#4F5F73]">Progress</span><span className="font-semibold text-[#1F2D3D]">{Math.round(progress)}%</span></div>
        <ProgressBar value={progress} label={`${group.name} progress`} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-[#EEF1F4] px-4 py-2">
        <div>
          <span className="block text-xs font-semibold text-[#4F5F73]">Join code</span>
          <code className="text-sm font-bold tracking-widest text-[#1F2D3D]">{group.join_code || '—'}</code>
        </div>
        <button type="button" onClick={copy} disabled={!group.join_code} aria-label={`Copy join code for ${group.name}`} className="flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#35475C] hover:bg-white disabled:opacity-50">
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

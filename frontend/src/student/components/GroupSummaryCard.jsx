import React from 'react';
import HealthBadge from './HealthBadge';
import { ProgressBar, ShareBar } from './ProgressBar';
import Avatar from './Avatar';
import { MIN_BALANCE_POINTS } from '../health';


const GroupSummaryCard = ({ group, insight, onOpen }) => {
  const workload = insight?.workload;
  const totalPoints = workload?.total_points ?? 0;
  const progress = insight ? insight.progress : Number(group.progress_percentage) || 0;
  const memberCount = insight?.members?.length || group.members_count || 1;

  return (
    <article className="flex flex-col rounded-xl border border-[#D7DEE6] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold text-[#1F2D3D]">{group.name}</h3>
            {group.is_leader ? <span className="shrink-0 rounded-full bg-[#E3EAF2] px-2 py-0.5 text-[13px] font-semibold text-[#2F4A66]">Leader</span> : null}
          </div>
          <p className="truncate text-sm text-[#4F5F73]">{group.unit_code || group.course || 'Group'}</p>
        </div>
        {insight ? <HealthBadge status={insight.health.status} reason={insight.health.reason} /> : null}
      </div>

      <div className="mt-3 flex items-center">
        {(insight?.members || []).slice(0, 5).map((m) => <Avatar key={m.id} name={m.name} className="-ml-2 first:ml-0" />)}
        {(insight?.members?.length || 0) > 5 ? <span className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[13px] font-bold text-[#4F5F73] ring-2 ring-white">+{insight.members.length - 5}</span> : null}
        {!insight?.members?.length ? <span className="text-sm text-[#4F5F73]">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span> : null}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-sm"><span className="text-[#4F5F73]">Group progress</span><span className="font-semibold text-[#1F2D3D]">{Math.round(progress)}%</span></div>
        <ProgressBar value={progress} label={`${group.name} progress`} />
      </div>

      <div className="mt-4">
        <p className="mb-1 text-sm text-[#4F5F73]">My share of the work</p>
        {!workload ? <p className="text-sm text-[#4F5F73]">Not available yet.</p>
          : totalPoints < MIN_BALANCE_POINTS ? <div><div className="h-2 rounded-full bg-[#E5E7EB]" aria-hidden="true" /><p className="mt-1 text-[13px] text-[#4F5F73]">Balancing starts at {MIN_BALANCE_POINTS} points. Your group has {totalPoints}.</p></div>
          : <ShareBar sharePercent={workload.share_percent} memberCount={memberCount} points={workload.points} totalPoints={totalPoints} />}
      </div>

      <p className="mb-4 mt-4 text-sm text-[#33445A]">
        <span className="text-[#4F5F73]">Next deadline: </span>
        {insight?.nextDeadline ? new Date(insight.nextDeadline).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'None scheduled'}
      </p>

      <button type="button" onClick={onOpen} className="mt-auto inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">Open</button>
    </article>
  );
};

export default GroupSummaryCard;

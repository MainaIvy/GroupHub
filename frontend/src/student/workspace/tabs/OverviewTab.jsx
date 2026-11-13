import React from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { MIN_BALANCE_POINTS } from '../../health';
import { timeAgo } from '../../utils';
import { describeActivity, formatDue } from '../taskUtils';

const card = 'rounded-xl border border-[#D7DEE6] bg-white p-4';
const heading = 'mb-3 text-base font-bold text-[#1F2D3D]';

const BAR = { ok: 'bg-[#4A6079]', warning: 'bg-[#4A6079]', critical: 'bg-[#D7DEE6]', too_early: 'bg-[#4A6079]' };

const OverviewTab = ({ workspace, balance, activity, polls, pollsLoading, onOpenTask, onGoTab }) => {
  const tasks = workspace.tasks || [];
  const now = Date.now();
  const deadlines = [
    ...tasks.filter((task) => task.due_date && task.board_status !== 'done' && new Date(task.due_date).getTime() >= now)
      .map((task) => ({ key: `t-${task.id}`, title: task.title, due: task.due_date, kind: 'Task', taskId: task.id })),
    ...(workspace.group?.projects || []).filter((project) => project.deadline && new Date(project.deadline).getTime() >= now && project.status !== 'completed')
      .map((project) => ({ key: `p-${project.id}`, title: project.title, due: project.deadline, kind: 'Project' })),
  ].sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 3);

  const openPolls = polls.filter((poll) => poll.status === 'open');
  const totalPoints = balance?.total_points ?? 0;
  const members = balance?.members || [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className={card} aria-labelledby="ov-progress">
        <h3 id="ov-progress" className={heading}>Project progress</h3>
        <div className="mb-1 flex items-baseline justify-between"><span className="text-3xl font-bold text-[#1F2D3D]">{workspace.project_progress}%</span><span className="text-sm capitalize text-[#4F5F73]">{String(workspace.project_status || 'planning').replaceAll('_', ' ')}</span></div>
        <ProgressBar value={workspace.project_progress} label="Project progress" />
        <p className="mt-2 text-sm text-[#4F5F73]">{tasks.filter((task) => task.board_status === 'done').length} of {tasks.length} tasks done</p>
      </section>

      <section className={card} aria-labelledby="ov-deadlines">
        <h3 id="ov-deadlines" className={heading}>Next 3 deadlines</h3>
        {deadlines.length ? (
          <ul className="space-y-2">
            {deadlines.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-[#EEF1F4] px-3 py-2 text-sm">
                {item.taskId ? <button type="button" onClick={() => onOpenTask(item.taskId)} className="truncate text-left font-semibold text-[#1F2D3D] hover:underline">{item.title}</button> : <span className="truncate font-semibold text-[#1F2D3D]">{item.title}</span>}
                <span className="shrink-0 text-[#4F5F73]">{item.kind} · {formatDue(item.due)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[#4F5F73]">No upcoming deadlines.</p>}
      </section>

      <section className={card} aria-labelledby="ov-balance">
        <h3 id="ov-balance" className={heading}>Workload balance</h3>
        {!balance ? <p className="text-sm text-[#4F5F73]">Workload balance isn’t available right now.</p>
          : totalPoints < MIN_BALANCE_POINTS ? (
            <div>
              <div className="h-2 rounded-full bg-[#E5E7EB]" aria-hidden="true" />
              <p className="mt-2 text-sm text-[#4F5F73]">Balancing starts at {MIN_BALANCE_POINTS} points. Your group has {totalPoints}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.user_id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate font-medium text-[#1F2D3D]">{member.name}</span><span className="shrink-0 text-[#4F5F73]">{member.points_assigned} pts · {Math.round(member.share_percent)}%</span></div>
                  <div className="relative h-2 rounded-full bg-[#DDE4EC]">
                    <div className={`h-full rounded-full ${BAR[member.warning_level] || BAR.ok}`} style={{ width: `${Math.min(100, member.share_percent)}%` }} />
                    <span aria-hidden="true" className="absolute -top-1 h-4 w-0.5 rounded bg-[#1F2D3D]" style={{ left: `${member.fair_share}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[13px] text-[#4F5F73]">The dark marker is each member’s fair share ({Math.round(balance.fair_share)}%).</p>
              {balance.suggestion ? <p className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] px-3 py-2 text-sm text-[#35475C]">{balance.suggestion}</p> : <p className="text-sm text-[#33445A]">Work is shared fairly.</p>}
            </div>
          )}
      </section>

      <section className={card} aria-labelledby="ov-polls">
        <div className="mb-3 flex items-center justify-between"><h3 id="ov-polls" className="text-base font-bold text-[#1F2D3D]">Open polls</h3><button type="button" onClick={() => onGoTab('polls')} className="text-sm font-semibold text-[#35475C] underline">All polls</button></div>
        {pollsLoading ? <p className="text-sm text-[#4F5F73]">Loading polls…</p> : openPolls.length ? (
          <ul className="space-y-2">
            {openPolls.map((poll) => (
              <li key={poll.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#EEF1F4] px-3 py-2 text-sm">
                <span className="truncate font-medium text-[#1F2D3D]">{poll.question}</span>
                <span className="shrink-0 text-[#4F5F73]">{poll.can_vote && poll.my_vote == null ? 'Needs your vote' : 'Voted'}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[#4F5F73]">No open polls.</p>}
      </section>

      <section className={`${card} lg:col-span-2`} aria-labelledby="ov-activity">
        <div className="mb-3 flex items-center justify-between"><h3 id="ov-activity" className="text-base font-bold text-[#1F2D3D]">Recent activity</h3><button type="button" onClick={() => onGoTab('activity')} className="text-sm font-semibold text-[#35475C] underline">Full timeline</button></div>
        {activity.length ? (
          <ul className="space-y-2">
            {activity.slice(0, 5).map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-[#1F2D3D]">{describeActivity(item)}</span><span className="text-[#4F5F73]">{timeAgo(item.created_at)}</span></li>)}
          </ul>
        ) : <p className="text-sm text-[#4F5F73]">No activity yet.</p>}
      </section>
    </div>
  );
};

export default OverviewTab;

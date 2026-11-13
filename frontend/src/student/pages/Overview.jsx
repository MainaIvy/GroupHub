import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Clock, History, PieChart, UsersRound, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GroupActions from '../components/GroupActions';
import GroupCard from '../components/GroupCard';
import StatCard from '../components/StatCard';
import CalendarCard from '../components/CalendarCard';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { describeActivity, weightText } from '../workspace/taskUtils';
import { timeAgo } from '../utils';
import { btnPrimary, btnSecondary } from '../design';
import { MIN_BALANCE_POINTS } from '../health';

const PANEL = 'rounded-xl border border-[#D5DDE6] bg-white shadow-sm';
const PANEL_HEAD = 'mb-3 flex items-center justify-between gap-2';
const PANEL_TITLE = 'text-base font-bold text-[#1F2D3D]';
const EMPTY_MIN_H = 'min-h-[160px]';
const CHECKLIST_KEY = 'student_overview_checklist_dismissed_v1';

const statusChip = (status) => {
  const s = String(status || '').toLowerCase();
  if (['completed', 'done', 'submitted'].includes(s)) return { label: 'Done', cls: 'bg-[#E3EAF2] text-[#35475C] border-[#C3D0DF]' };
  if (s === 'in_progress') return { label: 'In progress', cls: 'bg-[#E3EAF2] text-[#2F4A66] border-[#C3D0DF]' };
  return { label: 'Pending', cls: 'bg-[#EEF1F4] text-[#33445A] border-[#D7DEE6]' };
};

const Overview = ({ ctx }) => {
  const { greeting, groups, units, setActiveTab, openCreateModal, openJoinModal, openGroupTasks, openGroupDetails, insights, dashboardError, reloadDashboard, user, notif, access, groupMenuId, setGroupMenuId, setChatGroupId } = ctx;
  const navigate = useNavigate();
  const [dismissedChecklist, setDismissedChecklist] = useState(() => localStorage.getItem(CHECKLIST_KEY) === '1');

  useEffect(() => { if (dismissedChecklist) localStorage.setItem(CHECKLIST_KEY, '1'); }, [dismissedChecklist]);

  const openGroupTab = (groupId) => {
    const group = groups.find((item) => String(item.id) === String(groupId));
    if (group) { setActiveTab('tasks'); openGroupTasks(group); }
  };

  const openTasks = useMemo(() => insights.mine
    .filter((task) => !['completed', 'done', 'submitted'].includes(String(task.status || '').toLowerCase()))
    .sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return ad - bd;
    })
    .slice(0, 5), [insights.mine]);

  const recentActivity = useMemo(() => {
    const items = [];
    groups.forEach((group) => {
      (insights.byGroup[group.id]?.activity || []).slice(0, 5).forEach((item) => {
        items.push({ ...item, group_id: group.id, group_name: group.name });
      });
    });
    return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  }, [groups, insights.byGroup]);

  const nextDeadline = useMemo(() => {
    const dates = [];
    groups.forEach((group) => {
      const nd = insights.byGroup[group.id]?.nextDeadline || insights.byGroup[group.id]?.workload?.upcoming_tasks?.[0]?.due_date;
      if (nd) dates.push({ date: nd, group_name: group.name });
    });
    insights.mine.filter((t) => t.due_date && !['completed', 'done', 'submitted'].includes(String(t.status || '').toLowerCase())).forEach((t) => dates.push({ date: t.due_date, group_name: t.group_name }));
    dates.sort((a, b) => new Date(a.date) - new Date(b.date));
    return dates[0] || null;
  }, [groups, insights.byGroup, insights.mine]);

  const myShare = useMemo(() => {
    const workloads = groups.map((g) => insights.byGroup[g.id]?.workload).filter(Boolean);
    if (!workloads.length) return { label: '—', hint: 'Workload details loading' };
    const totalPoints = workloads.reduce((s, w) => s + Number(w.total_points || 0), 0);
    const myPoints = workloads.reduce((s, w) => s + Number(w.points || 0), 0);
    if (totalPoints < MIN_BALANCE_POINTS) return { label: `${Math.max(0, totalPoints)} of 6`, hint: 'Points to start balancing' };
    const pct = totalPoints ? Math.round((myPoints / totalPoints) * 100) : 0;
    return { label: `${pct}%`, hint: `${myPoints} of ${totalPoints} pts across groups` };
  }, [groups, insights.byGroup]);

  const yourMoveItems = useMemo(() => {
    const items = [];
    insights.overdue.forEach((task) => items.push({
      key: `od-${task.id}`, text: `Overdue: ${task.title} (${task.group_name})`, action: 'Open task', onClick: () => openGroupTab(task.group_id),
    }));
    insights.dueSoon.forEach((task) => items.push({
      key: `soon-${task.id}`, text: `Due soon: ${task.title} (${task.group_name})`, action: 'Open task', onClick: () => openGroupTab(task.group_id),
    }));
    (notif?.invites || []).forEach((item) => items.push({
      key: `inv-${item.id}`, text: item.message || item.title || 'Group invitation', action: access.busyId === item.id ? 'Working…' : 'Accept', onClick: () => access.acceptInvite(item),
      secondary: { label: 'Decline', onClick: () => access.declineInvite(item) },
    }));
    (notif?.joinRequests || []).forEach((item) => items.push({
      key: `jr-${item.id}`, text: item.message || item.title || 'Join request', action: access.busyId === item.id ? 'Working…' : 'Approve', onClick: () => access.approveRequest(item),
      secondary: { label: 'Decline', onClick: () => access.declineRequest(item) },
    }));
    (insights.pollsToVote || []).forEach((poll) => items.push({
      key: `poll-${poll.group_id}-${poll.id}`, text: `Open poll to vote on: ${poll.question || 'Poll'} (${poll.group_name})`, action: 'Vote', onClick: () => { const g = groups.find((x) => String(x.id) === String(poll.group_id)); if (g) openGroupDetails(g); },
    }));
    return items.slice(0, 10);
  }, [insights.overdue, insights.dueSoon, insights.pollsToVote, notif?.invites, notif?.joinRequests, access, groups]);

  const checklist = useMemo(() => {
    const hasGroup = groups.length > 0;
    const hasTask = insights.mine.length > 0 || groups.some((g) => (insights.byGroup[g.id]?.tasks || []).length > 0);
    const hasMessage = groups.some((g) => (insights.byGroup[g.id]?.activity || []).some((a) => String(a.action || '').includes('message') || String(a.target_type || '') === 'message'));
    const hasSubmission = groups.some((g) => (insights.byGroup[g.id]?.activity || []).some((a) => String(a.action || '').includes('submit') || String(a.target_type || '') === 'submission'));
    const items = [
      { label: 'Join or create a group', done: hasGroup },
      { label: 'Add a first task', done: hasTask },
      { label: 'Send a message', done: hasMessage },
      { label: 'Submit work', done: hasSubmission },
    ];
    return { items, complete: items.every((i) => i.done) };
  }, [groups, insights.mine, insights.byGroup]);

  const header = (
    <PageHeader
      title={greeting}
      subtitle="Here's what's happening across your groups today."
      actions={<GroupActions onJoin={openJoinModal} onCreate={openCreateModal} />}
    />
  );

  if (dashboardError) return <section className="space-y-6">{header}<ErrorState message={dashboardError} onRetry={reloadDashboard} /></section>;

  if (!groups.length) {
    return (
      <section className="space-y-6">
        {header}
        {!dismissedChecklist && !checklist.complete ? (
          <section className={`${PANEL} p-4`}>
            <div className={PANEL_HEAD}>
              <h2 className={PANEL_TITLE}>Getting started</h2>
              <button type="button" onClick={() => setDismissedChecklist(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4]" aria-label="Dismiss checklist"><X size={16} /></button>
            </div>
            <ul className="space-y-2">
              {checklist.items.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm text-[#33445A]">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.done ? 'border-[#35475C] bg-[#35475C] text-white' : 'border-[#D7DEE6] bg-white'}`}>{item.done ? <Check size={12} /> : null}</span>
                  <span className={item.done ? 'line-through text-[#4F5F73]' : ''}>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <div className={`${PANEL} p-6 text-center ${EMPTY_MIN_H}`}>
          <UsersRound size={32} className="mx-auto mb-2 text-[#4F5F73]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[#1F2D3D]">You haven't joined a group yet</h2>
          <p className="mt-1 text-sm text-[#4F5F73]">Join with a code from a classmate, or create a group to start collaborating.</p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" onClick={openJoinModal} className={btnSecondary}>Join with code</button>
            <button type="button" onClick={openCreateModal} className={btnPrimary}>Create group</button>
          </div>
        </div>
      </section>
    );
  }

  const waiting = insights.loading && !Object.keys(insights.byGroup).length;
  const calendarTasks = insights.mine.filter((task) => task.due_date);

  return (
    <section className="space-y-6">
      {waiting ? (
        <LoadingState label="Loading your overview..." rows={3} />
      ) : (
        <>
          {insights.error ? (
            <p role="status" className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] px-4 py-2 text-sm text-[#4A6079]">
              {insights.error} <button type="button" onClick={insights.reload} className="font-semibold text-[#35475C] underline">Retry</button>
            </p>
          ) : null}
          {access.error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{access.error}</p> : null}
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1 space-y-5">
              {header}

              {!dismissedChecklist && !checklist.complete ? (
                <section className={`${PANEL} p-4`}>
                  <div className={PANEL_HEAD}>
                    <h2 className={PANEL_TITLE}>Getting started</h2>
                    <button type="button" onClick={() => setDismissedChecklist(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4]" aria-label="Dismiss checklist"><X size={16} /></button>
                  </div>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {checklist.items.map((item) => (
                      <li key={item.label} className="flex items-center gap-2 text-sm text-[#33445A]">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.done ? 'border-[#35475C] bg-[#35475C] text-white' : 'border-[#D7DEE6] bg-white'}`}>{item.done ? <Check size={12} /> : null}</span>
                        <span className={item.done ? 'text-[#4F5F73] line-through' : ''}>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className={`${PANEL} p-4`}>
                <div className={PANEL_HEAD}>
                  <h2 className={PANEL_TITLE}>Your move today</h2>
                </div>
                {yourMoveItems.length === 0 ? (
                  <p className="text-sm text-[#4F5F73]">Nothing needs your attention right now.</p>
                ) : (
                  <ul className="divide-y divide-[#EEF1F4]">
                    {yourMoveItems.map((item) => (
                      <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <p className="min-w-0 flex-1 text-sm font-medium text-[#1F2D3D]">{item.text}</p>
                        <div className="flex shrink-0 gap-2">
                          {item.secondary ? <button type="button" onClick={item.secondary.onClick} className="h-9 rounded-lg border border-[#D7DEE6] px-3 text-sm font-semibold text-[#33445A] hover:bg-[#EEF1F4]">{item.secondary.label}</button> : null}
                          <button type="button" onClick={item.onClick} className="h-9 rounded-lg bg-[#35475C] px-3 text-sm font-semibold text-white hover:bg-[#435B76]">{item.action}</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon={CalendarDays} label="Next deadline" value={nextDeadline ? new Date(nextDeadline.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'} hint={nextDeadline ? nextDeadline.group_name : 'No upcoming deadlines'} />
                <StatCard icon={CalendarDays} label="Due this week" value={insights.dueWeek.length} hint="Open tasks, next 7 days" />
                <StatCard icon={PieChart} label="My share of the work" value={myShare.label} hint={myShare.hint} />
                <StatCard icon={CheckCircle2} label="My completion" value={insights.completion == null ? '—' : `${insights.completion}%`} hint={insights.completion == null ? 'No tasks assigned yet' : 'Of my assigned tasks'} />
              </div>

              <section className={`${PANEL} p-4`}>
                <div className={PANEL_HEAD}>
                  <h2 className={PANEL_TITLE}>My groups</h2>
                </div>
                <div className={`grid gap-3 ${groups.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
                  {groups.map((group) => {
                    const unitLine = group.unit_code ? `${group.unit_code}${group.unit_name ? ` · ${group.unit_name}` : ''}` : group.course || 'Unit';
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => openGroupDetails(group)}
                        className="w-full rounded-lg border border-[#D7DEE6] bg-white px-4 py-3 text-left transition-colors hover:bg-[#EEF1F4] hover:shadow-sm"
                      >
                        <p className="truncate text-sm font-semibold text-[#1F2D3D]">{group.name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#4F5F73]">{unitLine}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="gap-5 lg:grid lg:grid-cols-2">
                <section className={`${PANEL} p-4 ${EMPTY_MIN_H}`}>
                  <div className={PANEL_HEAD}>
                    <div className="flex items-center gap-1"><Clock size={16} className="text-[#4A6079]" aria-hidden="true" /><h2 className={PANEL_TITLE}>My tasks</h2></div>
                    <button type="button" onClick={() => setActiveTab('tasks')} className="text-[11px] font-semibold text-[#4A6079] hover:underline">View all <ChevronRight size={12} className="inline" /></button>
                  </div>
                  {openTasks.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center gap-1 pt-6 text-center ${EMPTY_MIN_H}`}>
                      <Clock size={24} className="mx-auto text-[#4F5F73]" aria-hidden="true" />
                      <p className="text-sm text-[#4F5F73]">No tasks assigned yet</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {openTasks.map((task) => {
                        const chip = statusChip(task.status);
                        return (
                          <li key={task.id} className="cursor-pointer border-b border-[#EEF1F4] py-2 last:border-0 hover:bg-[#EEF1F4]" onClick={() => openGroupTab(task.group_id)} role="button" tabIndex={0}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1F2D3D]">{task.title}</p>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.cls}`}>{chip.label}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-[#4F5F73]">{task.group_name || 'Group'}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#33445A]">
                              <span>{weightText(task.weight)}</span>
                              <span>{task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'No due date'}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className={`${PANEL} p-4 ${EMPTY_MIN_H}`}>
                  <div className={PANEL_HEAD}>
                    <div className="flex items-center gap-1"><History size={16} className="text-[#4A6079]" aria-hidden="true" /><h2 className={PANEL_TITLE}>Recent activity</h2></div>
                  </div>
                  {recentActivity.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center gap-1 pt-6 text-center ${EMPTY_MIN_H}`}>
                      <History size={24} className="mx-auto text-[#4F5F73]" aria-hidden="true" />
                      <p className="text-sm text-[#4F5F73]">No activity yet</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {recentActivity.map((item) => (
                        <li key={`a-${item.group_id}-${item.id}`} className="text-sm text-[#33445A]">
                          {describeActivity(item)} <span className="text-[#4F5F73]">· {item.group_name}, {timeAgo(item.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <section className={`${PANEL} p-4`}>
                <div className={PANEL_HEAD}>
                  <div className="flex items-center gap-1"><BookOpen size={16} className="text-[#4A6079]" aria-hidden="true" /><h2 className={PANEL_TITLE}>My units</h2></div>
                  <button type="button" onClick={() => setActiveTab('units')} className="flex items-center gap-1 text-[11px] font-semibold text-[#4A6079] hover:underline">
                    View all units <ChevronRight size={12} />
                  </button>
                </div>
                {units.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center gap-1 pt-6 text-center ${EMPTY_MIN_H}`}>
                    <BookOpen size={24} className="mx-auto text-[#4F5F73]" aria-hidden="true" />
                    <p className="text-sm text-[#4F5F73]">No units available yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {units.map((unit) => {
                      const userGroup = groups.find((g) => String(g.unit_id) === String(unit.id));
                      const noGroup = !userGroup;
                      return (
                        <article
                          key={unit.id}
                          className={`cursor-pointer rounded-xl border p-4 transition-colors hover:shadow-sm ${noGroup ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50' : 'border-[#D5DDE6] bg-white hover:bg-[#EEF1F4]'}`}
                          onClick={() => navigate(`/student/units/${unit.id}`)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/student/units/${unit.id}`); }}
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <span className="block text-[11px] font-mono font-bold uppercase text-[#35475C]">{unit.code}</span>
                            <ChevronRight size={14} className="text-[#4A6079]" aria-hidden="true" />
                          </div>
                          <p className="block text-sm font-semibold text-[#1F2D3D]">{unit.name}</p>
                          <p className={`mt-2 text-xs font-semibold ${noGroup ? 'text-amber-800' : 'text-[#35475C]'}`}>
                            {noGroup ? 'No group yet' : `Your group: ${userGroup.name}`}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
            <div className="w-full flex-none space-y-6 lg:sticky lg:top-20 lg:w-[360px] lg:shrink-0 lg:self-start">
              <CalendarCard tasks={calendarTasks} />
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default Overview;

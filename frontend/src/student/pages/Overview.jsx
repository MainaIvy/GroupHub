import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsersRound, CalendarDays, AlertTriangle, CheckCircle2, Clock, BookOpen, ChevronRight, History, Plus, LogIn } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GroupActions from '../components/GroupActions';
import StatCard from '../components/StatCard';
import DueList from '../components/DueList';
import CalendarCard from '../components/CalendarCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import ProgressBar from '../components/ProgressBar';
import { describeActivity } from '../workspace/taskUtils';
import { timeAgo } from '../utils';
import { btnPrimary, btnSecondary } from '../design';

const PANEL = 'rounded-xl border border-[#D5DDE6] bg-white shadow-sm';
const PANEL_HEAD = 'flex items-center justify-between gap-2 mb-3';
const PANEL_TITLE = 'text-base font-bold text-[#1F2D3D]';
const EMPTY_MIN_H = 'min-h-[160px]';

const Overview = ({ ctx }) => {
  const { greeting, groups, units, setActiveTab, openCreateModal, openJoinModal, openGroupTasks, openGroupDetails, insights, dashboardError, reloadDashboard } = ctx;
  const navigate = useNavigate();

  const openGroupTab = (groupId) => {
    const group = groups.find((item) => String(item.id) === String(groupId));
    setActiveTab('tasks');
    if (group) openGroupTasks(group);
  };

  const openTasks = useMemo(() => {
    return insights.mine
      .filter((task) => !['completed', 'done', 'submitted'].includes(String(task.status || '').toLowerCase()))
      .sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      })
      .slice(0, 5);
  }, [insights.mine]);

  const allActivity = useMemo(() => {
    const items = [];
    groups.forEach((group) => {
      const insight = insights.byGroup[group.id];
      if (insight?.activity) {
        insight.activity.forEach((item) => {
          items.push({ ...item, group_id: group.id, group_name: group.name });
        });
      }
    });
    return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  }, [groups, insights.byGroup]);

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
        <div className={`${PANEL} p-6 text-center ${EMPTY_MIN_H}`}>
          <UsersRound size={32} className="mx-auto mb-2 text-[#4F5F73]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[#1F2D3D]">You haven't joined a group yet</h2>
          <p className="mt-1 text-sm text-[#4F5F73]">Join with a code from a classmate, or create a group to start collaborating.</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
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
              {insights.error} <button type="button" onClick={insights.reload} className="font-semibold underline text-[#35475C]">Retry</button>
            </p>
          ) : null}
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0 space-y-5">
              {header}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon={UsersRound} label="Groups" value={groups.length} hint="Groups you belong to" />
                <StatCard icon={CalendarDays} label="Due this week" value={insights.dueWeek.length} hint="Open tasks, next 7 days" />
                <StatCard icon={AlertTriangle} label="Overdue" value={insights.overdue.length} hint={insights.overdue.length ? 'Needs attention' : 'Nothing late'} />
                <StatCard icon={CheckCircle2} label="My completion" value={insights.completion == null ? '—' : `${insights.completion}%`} hint={insights.completion == null ? 'No tasks assigned yet' : 'Of my assigned tasks'} />
              </div>

              {/* My groups */}
              <section className={`${PANEL} p-4`}>
                <div className={PANEL_HEAD}>
                  <h2 className={PANEL_TITLE}>My groups</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {groups.map((group) => {
                    const insight = insights.byGroup[group.id];
                    const progress = insight ? insight.progress : Number(group.progress_percentage) || 0;
                    const members = insight?.members || [];
                    const memberCount = members.length || group.members_count || 1;
                    const unitLine = group.unit_code ? `${group.unit_code}${group.unit_name ? ` · ${group.unit_name}` : ''}` : group.course || 'Group';
                    return (
                      <article
                        key={group.id}
                        className="rounded-lg border border-[#D7DEE6] bg-white p-4 hover:bg-[#EEF1F4] transition-colors cursor-pointer"
                        onClick={() => openGroupDetails(group)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="truncate text-sm font-semibold text-[#1F2D3D]">{group.name}</h3>
                          {group.is_leader ? <span className="shrink-0 rounded-full bg-[#E3EAF2] px-2 py-0.5 text-[11px] font-semibold text-[#2F4A66]">Leader</span> : null}
                        </div>
                        <p className="truncate text-xs text-[#4F5F73] mb-3">{unitLine}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-[#4F5F73]">Members</span>
                            <span className="text-xs font-semibold text-[#1F2D3D]">{memberCount}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-[#4F5F73]">Progress</span>
                            <span className="text-xs font-semibold text-[#1F2D3D]">{Math.round(progress)}%</span>
                          </div>
                        </div>
                        <div className="mt-3"><ProgressBar value={progress} label={`${group.name} progress`} /></div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* My tasks + Recent activity */}
              <div className="gap-5 lg:grid lg:grid-cols-2 lg:gap-5">
                {/* My tasks */}
                <section className={`${PANEL} p-4 ${EMPTY_MIN_H}`}>
                  <div className={PANEL_HEAD}>
                    <div className="flex items-center gap-1">
                      <Clock size={16} className="text-[#4A6079]" aria-hidden="true" />
                      <h2 className={PANEL_TITLE}>My tasks</h2>
                    </div>
                    <button type="button" onClick={() => setActiveTab('tasks')} className="text-[11px] font-semibold text-[#4A6079] hover:underline">View all <ChevronRight size={12} /></button>
                  </div>
                  {openTasks.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center gap-1 text-center pt-6 ${EMPTY_MIN_H}`}>
                      <Clock size={24} className="mx-auto text-[#4F5F73]" aria-hidden="true" />
                      <p className="text-sm text-[#4F5F73]">No tasks assigned yet</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {openTasks.map((task) => {
                        const group = groups.find((g) => String(g.id) === String(task.group_id));
                        return (
                          <li key={task.id} className="flex items-start justify-between gap-2 py-2 border-b border-[#EEF1F4] last:border-0 hover:bg-[#EEF1F4]" onClick={() => openGroupTab(task.group_id)} role="button" tabIndex={0}>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#1F2D3D] truncate">{task.title}</p>
                              <p className="text-[11px] text-[#4F5F73]">{task.group_name || group?.name || 'Group'}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[11px] font-medium text-[#1F2D3D]">{task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}</span>
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-[#D7DEE6] px-2 py-0.5 text-[10px] font-semibold text-[#33445A]">{task.weight}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {/* Recent activity */}
                <section className={`${PANEL} p-4 ${EMPTY_MIN_H}`}>
                  <div className={PANEL_HEAD}>
                    <div className="flex items-center gap-1">
                      <History size={16} className="text-[#4A6079]" aria-hidden="true" />
                      <h2 className={PANEL_TITLE}>Recent activity</h2>
                    </div>
                  </div>
                  {allActivity.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center gap-1 text-center pt-6 ${EMPTY_MIN_H}`}>
                      <History size={24} className="mx-auto text-[#4F5F73]" aria-hidden="true" />
                      <p className="text-sm text-[#4F5F73]">No activity yet</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {allActivity.map((item) => (
                        <li key={`a-${item.id}`} className="flex items-start gap-2 py-2 border-b border-[#EEF1F4] last:border-0">
                          <span aria-hidden="true" className="shrink-0 h-2 w-2 rounded-full bg-[#4A6079] mt-[4px]" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#1F2D3D]">{describeActivity(item)}</p>
                            <p className="mt-0.5 text-[11px] text-[#4F5F73]">{item.group_name} · {timeAgo(item.created_at)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* My units */}
              <section className={`${PANEL} p-4`}>
                <div className={PANEL_HEAD}>
                  <div className="flex items-center gap-1">
                    <BookOpen size={16} className="text-[#4A6079]" aria-hidden="true" />
                    <h2 className={PANEL_TITLE}>My units</h2>
                  </div>
                  <a href="/student/units" className="text-[11px] font-semibold text-[#4A6079] hover:underline flex items-center gap-1">
                    View all units <ChevronRight size={12} />
                  </a>
                </div>
                {units.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center gap-1 text-center pt-6 ${EMPTY_MIN_H}`}>
                    <BookOpen size={24} className="mx-auto text-[#4F5F73]" aria-hidden="true" />
                    <p className="text-sm text-[#4F5F73]">No units available yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {units.map((unit) => (
                      <article
                        key={unit.id}
                        className="rounded-xl border border-[#D5DDE6] bg-white p-4 hover:bg-[#EEF1F4] hover:shadow-sm transition-colors cursor-pointer"
                        onClick={() => navigate(`/student/units/${unit.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/student/units/${unit.id}`); }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="block text-[11px] font-mono font-bold text-[#35475C] uppercase">{unit.code}</span>
                          <ChevronRight size={14} className="text-[#4A6079]" aria-hidden="true" />
                        </div>
                        <p className="mt-0.5 block text-sm font-semibold text-[#1F2D3D]">{unit.name}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <div className="flex-none w-[360px] shrink-0 space-y-6">
              <CalendarCard tasks={calendarTasks} />
              <DueList tasks={insights.dueWeek} onOpenTask={openGroupTab} onViewAll={() => setActiveTab('tasks')} />
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default Overview;

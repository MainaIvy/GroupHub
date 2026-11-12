import React from 'react';
import { UsersRound, CalendarDays, AlertTriangle, CheckCircle2, Users, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GroupActions from '../components/GroupActions';
import AttentionList from '../components/AttentionList';
import StatCard from '../components/StatCard';
import GroupSummaryCard from '../components/GroupSummaryCard';
import DueList from '../components/DueList';
import CalendarCard from '../components/CalendarCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';

const Overview = ({ ctx }) => {
  const { greeting, groups, setActiveTab, openCreateModal, openJoinModal, openGroupDetails, openGroupTasks, insights, notif, access, dashboardError, reloadDashboard } = ctx;

  const openGroupTab = (groupId) => {
    const group = groups.find((item) => String(item.id) === String(groupId));
    setActiveTab('tasks');
    if (group) openGroupTasks(group);
  };

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
        <EmptyState icon={UsersRound} title="You haven't joined a group yet" description="Join with a code from a classmate, or create a group to start collaborating." actionLabel="Create group" onAction={() => openCreateModal()} />
        <AttentionList overdue={[]} dueSoon={[]} polls={[]} invites={notif.invites} joinRequests={notif.joinRequests} access={access} onOpenTask={() => {}} onOpenPoll={() => {}} />
      </section>
    );
  }

  const waiting = insights.loading && !Object.keys(insights.byGroup).length;
  const calendarTasks = insights.mine.filter((task) => task.due_date);

  return (
    <section className="space-y-6">
      {header}
      {insights.error ? (
        <p role="status" className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] px-4 py-2 text-sm text-[#4A6079]">
          {insights.error} <button type="button" onClick={insights.reload} className="font-semibold underline text-[#35475C]">Retry</button>
        </p>
      ) : null}
      {waiting ? (
        <LoadingState label="Loading your overview..." rows={3} />
      ) : (
        <>
          {/* Stat overview */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={UsersRound} label="Groups" value={groups.length} hint="Groups you belong to" />
            <StatCard icon={CalendarDays} label="Due this week" value={insights.dueWeek.length} hint="Open tasks, next 7 days" />
            <StatCard icon={AlertTriangle} label="Overdue" value={insights.overdue.length} hint={insights.overdue.length ? 'Needs attention' : 'Nothing late'} />
            <StatCard icon={CheckCircle2} label="My completion" value={insights.completion == null ? '—' : `${insights.completion}%`} hint={insights.completion == null ? 'No tasks assigned yet' : 'Of my assigned tasks'} />
          </div>

          {/* Attention list */}
          <AttentionList
            overdue={insights.overdue}
            dueSoon={insights.dueSoon}
            invites={notif.invites}
            polls={insights.pollsToVote}
            joinRequests={notif.joinRequests}
            access={access}
            onOpenTask={(task) => openGroupTab(task.group_id)}
            onOpenPoll={(poll) => openGroupTab(poll.group_id)}
          />

          {/* Your groups + Due this week side by side */}
          <div className="lg:grid lg:grid-cols-[2fr_1fr] lg:gap-6">
            <div className="space-y-6">
              <section aria-labelledby="my-groups-title" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 id="my-groups-title" className="text-base font-bold text-[#1F2D33]">Your groups</h2>
                  <button type="button" onClick={() => setActiveTab('groups')} className="text-xs font-semibold text-[#35475C] hover:underline">View all <ChevronRight size={14} /></button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
                  {groups.map((group) => <GroupSummaryCard key={group.id} group={group} insight={insights.byGroup[group.id]} onOpen={() => openGroupDetails(group)} />)}
                </div>
              </section>
            </div>
            <div className="space-y-6">
              <DueList tasks={insights.dueWeek} onOpenTask={(task) => openGroupTab(task.group_id)} onViewAll={() => setActiveTab('tasks')} />
              <CalendarCard tasks={calendarTasks} />
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default Overview;

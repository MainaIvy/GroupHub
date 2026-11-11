import React from 'react';
import { UsersRound, CalendarDays, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GroupActions from '../components/GroupActions';
import AttentionList from '../components/AttentionList';
import StatCard from '../components/StatCard';
import GroupSummaryCard from '../components/GroupSummaryCard';
import DueList from '../components/DueList';
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

  const header = <PageHeader title={greeting} subtitle="Here’s what needs you today." actions={<GroupActions onJoin={openJoinModal} onCreate={openCreateModal} />} />;

  if (dashboardError) return <section className="space-y-6">{header}<ErrorState message={dashboardError} onRetry={reloadDashboard} /></section>;

  if (!groups.length) {
    return (
      <section className="space-y-6">
        {header}
        <EmptyState icon={UsersRound} title="You haven’t joined a group yet" description="Join with a code from a classmate, or create a group to start collaborating." actionLabel="Create group" onAction={() => openCreateModal()} />
        <AttentionList overdue={[]} dueSoon={[]} polls={[]} invites={notif.invites} joinRequests={notif.joinRequests} access={access} onOpenTask={() => {}} onOpenPoll={() => {}} />
      </section>
    );
  }

  const waiting = insights.loading && !Object.keys(insights.byGroup).length;

  return (
    <section className="space-y-6">
      {header}
      {insights.error ? <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">{insights.error} <button type="button" onClick={insights.reload} className="font-semibold underline">Retry</button></p> : null}
      {waiting ? <LoadingState label="Loading your overview…" rows={3} /> : (
        <>
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="Groups" value={groups.length} hint="Groups you belong to" />
            <StatCard icon={CalendarDays} tone="warning" label="Due this week" value={insights.dueWeek.length} hint="Open tasks, next 7 days" />
            <StatCard icon={AlertTriangle} label="Overdue" value={insights.overdue.length} tone={insights.overdue.length ? 'danger' : 'success'} hint={insights.overdue.length ? 'Needs attention' : 'Nothing late'} />
            <StatCard icon={CheckCircle2} tone="success" label="My completion" value={insights.completion == null ? '—' : `${insights.completion}%`} hint={insights.completion == null ? 'No tasks assigned yet' : 'Of my assigned tasks'} />
          </div>
          <section aria-labelledby="my-groups-title" className="space-y-4">
            <h2 id="my-groups-title" className="text-base font-bold text-[#1F2D3D]">My groups</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
              {groups.map((group) => <GroupSummaryCard key={group.id} group={group} insight={insights.byGroup[group.id]} onOpen={() => openGroupDetails(group)} />)}
            </div>
          </section>
          <div>
            <DueList tasks={insights.dueWeek} onOpenTask={(task) => openGroupTab(task.group_id)} onViewAll={() => setActiveTab('tasks')} />
          </div>
        </>
      )}
    </section>
  );
};

export default Overview;

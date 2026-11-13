import React, { useState } from 'react';
import { UsersRound } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import GroupActions from '../components/GroupActions';
import GroupCard from '../components/GroupCard';
import AccessSections from '../components/AccessSections';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';

const Groups = ({ ctx }) => {
  const { groups, visibleGroups, groupMenuId, setGroupMenuId, setActiveTab, setChatGroupId, openCreateModal, openJoinModal, openGroupDetails, handleDeleteGroup, handleLeaveGroup, insights, notif, access, dashboardError, reloadDashboard } = ctx;
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      if (pending.kind === 'delete') await handleDeleteGroup(pending.group);
      else await handleLeaveGroup(pending.group);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const request = (kind, group) => { setGroupMenuId(null); setPending({ kind, group }); };

  return (
    <section className="space-y-6">
      <PageHeader title="Groups" subtitle="Projects and classmates you work with." actions={<GroupActions onJoin={openJoinModal} onCreate={openCreateModal} />} />
      {dashboardError ? <ErrorState message={dashboardError} onRetry={reloadDashboard} /> : (
        <>
          {insights.error ? <p role="status" className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] px-4 py-2 text-sm text-[#35475C]">{insights.error} <button type="button" onClick={insights.reload} className="font-semibold underline">Retry</button></p> : null}
          {insights.loading && groups.length && !Object.keys(insights.byGroup).length ? <LoadingState label="Loading your groups…" /> : null}
          {visibleGroups.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  insight={insights.byGroup[group.id]}
                  currentUserId={ctx.user?.id}
                  unreadMessages={Number(notif?.unreadByGroup?.[group.id] ?? 0)}
                  menuOpen={groupMenuId === group.id}
                  onToggleMenu={() => setGroupMenuId((current) => (current === group.id ? null : group.id))}
                  onCloseMenu={() => setGroupMenuId(null)}
                  onOpenWorkspace={() => openGroupDetails(group)}
                  onChat={() => { setChatGroupId(group.id); setActiveTab('chat'); }}
                  onLeave={() => request('leave', group)}
                  onDelete={() => request('delete', group)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={UsersRound}
              title={groups.length ? 'No groups match your search' : 'You haven’t joined a group yet'}
              description={groups.length ? 'Try a different search term.' : 'Join with a code from a classmate, or create a group to start collaborating.'}
              actionLabel={groups.length ? undefined : 'Create group'}
              onAction={groups.length ? undefined : () => openCreateModal()}
            />
          )}
          <AccessSections notif={notif} access={access} />
        </>
      )}
      <ConfirmDialog
        open={Boolean(pending)}
        busy={busy}
        title={pending?.kind === 'delete' ? 'Delete this group?' : 'Leave this group?'}
        message={pending?.kind === 'delete'
          ? `Are you sure you want to delete “${pending?.group?.name}” and its group chat? This cannot be undone.`
          : `Are you sure you want to leave “${pending?.group?.name}”? You will need its join code to come back.`}
        confirmLabel={pending?.kind === 'delete' ? 'Delete group' : 'Leave group'}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </section>
  );
};

export default Groups;

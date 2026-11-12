import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, UsersRound } from 'lucide-react';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import HealthBadge from '../components/HealthBadge';
import LoadingState from '../components/LoadingState';
import useGroupWorkspaceData from '../hooks/useGroupWorkspaceData';
import useWorkspaceExtras from '../hooks/useWorkspaceExtras';
import useTaskActions from '../hooks/useTaskActions';
import ProposeTaskModal from '../workspace/ProposeTaskModal';
import TaskPanel from '../workspace/TaskPanel';
import OverviewTab from '../workspace/tabs/OverviewTab';
import TasksTab from '../workspace/tabs/TasksTab';
import ChatTab from '../workspace/tabs/ChatTab';
import PollsTab from '../workspace/tabs/PollsTab';
import FilesTab from '../workspace/tabs/FilesTab';
import SubmissionTab from '../workspace/tabs/SubmissionTab';
import MembersTab from '../workspace/tabs/MembersTab';
import ActivityTab from '../workspace/tabs/ActivityTab';

const TABS = [
  ['overview', 'Overview'],
  ['tasks', 'Tasks'],
  ['chat', 'Chat'],
  ['polls', 'Polls'],
  ['files', 'Files'],
  ['submission', 'Submission'],
  ['members', 'Members'],
  ['activity', 'Activity'],
];
const TAB_KEYS = TABS.map(([key]) => key);

const GroupWorkspace = ({ ctx }) => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { groups, setGroups, user, insights, notif, access, setSubmissionGroupId, setError } = ctx;

  const group = groups.find((item) => String(item.id) === String(groupId));
  const requestedTab = searchParams.get('tab');
  const tab = TAB_KEYS.includes(requestedTab) ? requestedTab : 'overview';
  const [selectedTaskId, setSelectedTaskId] = useState(() => Number(searchParams.get('task')) || null);
  const [proposeFor, setProposeFor] = useState(undefined);
  const [copied, setCopied] = useState(false);

  const data = useGroupWorkspaceData(group ? groupId : null);
  const extras = useWorkspaceExtras(group ? groupId : null, tab === 'files');
  const actions = useTaskActions(groupId, data.reload);

  useEffect(() => {
    if (group) setSubmissionGroupId(String(group.id));
    // Submissions load through the shared dashboard state, keyed by group id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  const goTab = useCallback((key) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    if (key !== 'tasks') next.delete('task');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openTask = useCallback((taskId) => {
    setSelectedTaskId(taskId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'tasks');
    next.set('task', String(taskId));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeTask = useCallback(() => {
    setSelectedTaskId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const workspace = data.workspace;
  const tasks = useMemo(() => workspace?.tasks || [], [workspace]);
  const members = useMemo(() => workspace?.members || [], [workspace]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const insight = insights.byGroup[groupId];
  const isLeader = Boolean(group?.is_leader);
  const joinRequests = notif.joinRequests.filter((item) => String(item.related_group_id) === String(groupId));
  const toGroups = () => navigate('/student/dashboard', { state: { tab: 'groups' } });

  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText(workspace?.group?.join_code || group?.join_code || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  if (!group) {
    return <EmptyState icon={UsersRound} title="Group not found" description="You may have left this group, or it no longer exists." actionLabel="Back to groups" onAction={toGroups} />;
  }

  const code = workspace?.group?.join_code || group.join_code;
  const unitLine = group.unit_code ? `${group.unit_code}${group.unit_name ? ` · ${group.unit_name}` : ''}` : group.course || 'Group workspace';

  const header = (
    <header className="rounded-xl border border-[#D7DEE6] bg-white p-4">
      <button type="button" onClick={toGroups} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-[#4A6079] hover:underline"><ArrowLeft size={16} aria-hidden="true" /> Your groups</button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-[#1F2D3D]">{group.name}</h2>
            {isLeader ? <span className="rounded-full bg-[#E3EAF2] px-2 py-0.5 text-[13px] font-semibold text-[#2F4A66]">Leader</span> : null}
            {insight ? <HealthBadge status={insight.health.status} reason={insight.health.reason} /> : null}
          </div>
          <p className="mt-1 text-sm text-[#4F5F73]">{unitLine}</p>
          <div className="mt-3 flex items-center -space-x-2" aria-label={`${members.length || group.members_count || 0} members`}>
            {members.slice(0, 6).map((member) => <Avatar key={member.id} name={member.name} />)}
            {members.length > 6 ? <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[13px] font-bold text-[#4F5F73] ring-2 ring-white">+{members.length - 6}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-[#EEF1F4] px-4 py-2">
          <div><span className="block text-[13px] font-semibold text-[#4F5F73]">Join code</span><code className="text-sm font-bold tracking-widest text-[#1F2D3D]">{code || '—'}</code></div>
          <button type="button" onClick={copyCode} disabled={!code} aria-label="Copy join code" className="flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#35475C] hover:bg-white disabled:opacity-50">
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <nav aria-label="Workspace sections" className="mt-4 flex gap-1 overflow-x-auto border-t border-[#E3EAF2] pt-3">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => goTab(key)} className={`h-10 shrink-0 rounded-lg px-4 text-sm font-semibold ${tab === key ? 'bg-[#35475C] text-white' : 'text-[#33445A] hover:bg-[#EEF1F4]'}`}>{label}</button>
        ))}
      </nav>
    </header>
  );

  const body = () => {
    if (data.loading && !workspace) return <LoadingState label="Loading workspace…" rows={3} />;
    if (data.error && !workspace) return <ErrorState message={data.error} onRetry={data.retry} />;
    if (!workspace) return null;
    switch (tab) {
      case 'tasks':
        return <TasksTab tasks={tasks} userId={user?.id} selectedTaskId={selectedTaskId} onSelectTask={openTask} onPropose={() => setProposeFor(null)} />;
      case 'chat':
        return <ChatTab groupId={group.id} tasks={tasks} onOpenTask={openTask} onAssignTask={() => setProposeFor(null)} onGoGroups={toGroups} />;
      case 'polls':
        return <PollsTab groupId={group.id} />;
      case 'files':
        return <FilesTab files={extras.files} loading={extras.filesLoading} error={extras.filesError} onRetry={extras.reloadFiles} onGoChat={() => goTab('chat')} />;
      case 'submission':
        return <SubmissionTab ctx={ctx} />;
      case 'members':
        return <MembersTab group={{ ...workspace.group, ...group }} members={members} isLeader={isLeader} joinRequests={joinRequests} access={access} setGroups={setGroups} onLeft={toGroups} onLeaveError={setError} />;
      case 'activity':
        return <ActivityTab activity={data.activity} comments={data.comments} onGoTasks={() => goTab('tasks')} />;
      default:
        return <OverviewTab workspace={workspace} balance={data.balance} activity={data.activity} polls={extras.polls} pollsLoading={extras.pollsLoading} onOpenTask={openTask} onGoTab={goTab} />;
    }
  };

  return (
    <section className="space-y-4">
      {header}
      {body()}
      {selectedTask && tab === 'tasks' ? (
        <TaskPanel
          key={selectedTask.id}
          task={selectedTask}
          tasks={tasks}
          members={members}
          activity={data.activity}
          userId={user?.id}
          leaderId={workspace.group.leader_id}
          actions={actions}
          onClose={closeTask}
          onSelectTask={openTask}
          onAddSubtask={(parent) => setProposeFor(parent)}
        />
      ) : null}
      {proposeFor !== undefined ? (
        <ProposeTaskModal
          parent={proposeFor}
          projects={data.projects}
          busy={actions.busy}
          error={actions.error}
          onSubmit={actions.propose}
          onClose={() => { setProposeFor(undefined); actions.clearError(); }}
        />
      ) : null}
    </section>
  );
};

export default GroupWorkspace;

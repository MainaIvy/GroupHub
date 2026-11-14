import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../api';
import { DAY, isDone, isLeaf, taskIsOverdue } from '../health';

const ROOT = '/api/accounts';

// Per-group workspace, polls, activity and workload, plus cross-group task aggregates.
export default function useGroupInsights(groups, userId) {
  const [byGroup, setByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const groupKey = groups.map((group) => group.id).join(',');

  useEffect(() => {
    if (!groups.length) {
      setByGroup({});
      setLoading(false);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [workloadResult, ...groupResults] = await Promise.allSettled([
        axios.get(`${ROOT}/student/workload-summary/`),
        ...groups.map((group) => Promise.allSettled([
          axios.get(`${ROOT}/groups/${group.id}/workspace/`),
          axios.get(`${ROOT}/groups/${group.id}/polls/`),
          axios.get(`${ROOT}/groups/${group.id}/activity/`),
        ])),
      ]);
      if (cancelled) return;
      const workloads = workloadResult.status === 'fulfilled' && Array.isArray(workloadResult.value.data) ? workloadResult.value.data : [];
      const next = {};
      let failed = workloadResult.status === 'rejected' ? 1 : 0;
      groups.forEach((group, index) => {
        const [workspaceResult, pollsResult, activityResult] = groupResults[index].value;
        if (workspaceResult.status === 'rejected') { failed += 1; return; }
        const workspace = workspaceResult.value.data || {};
        const workload = workloads.find((item) => item.group_id === group.id) || null;
        const polls = pollsResult.status === 'fulfilled' && Array.isArray(pollsResult.value.data) ? pollsResult.value.data : [];
        const activity = activityResult.status === 'fulfilled' && Array.isArray(activityResult.value.data) ? activityResult.value.data : [];
        const tasks = Array.isArray(workspace.tasks) ? workspace.tasks : [];
        const members = Array.isArray(workspace.members) ? workspace.members : [];
        const lastActivity = activity[0]?.created_at || null;
        // Health is computed server-side and returned by the workspace endpoint.
        const apiHealth = workspace.health || null;
        const health = apiHealth
          ? { status: apiHealth.status, reason: (apiHealth.reasons || []).join(' · ') }
          : { status: 'too_early', reason: 'Health data unavailable' };
        next[group.id] = {
          members,
          tasks,
          polls,
          workload,
          progress: Number(workspace.project_progress) || 0,
          nextDeadline: workspace.group?.next_deadline || null,
          lastActivity,
          health,
          openPollsToVote: polls.filter((poll) => poll.status === 'open' && poll.can_vote && (poll.my_vote == null)),
        };
      });
      setByGroup(next);
      setError(failed ? 'Some group details could not be loaded.' : '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const summary = useMemo(() => {
    const now = Date.now();
    const mine = [];
    groups.forEach((group) => {
      (byGroup[group.id]?.tasks || []).forEach((task) => {
        if (isLeaf(task) && String(task.assigned_to_id) === String(userId)) {
          mine.push({ ...task, group_id: group.id, group_name: group.name, isOverdue: taskIsOverdue(task, now) });
        }
      });
    });
    const open = mine.filter((task) => !isDone(task));
    const overdue = open.filter((task) => task.isOverdue).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const dueSoon = open.filter((task) => task.due_date && !task.isOverdue && new Date(task.due_date).getTime() - now <= 3 * DAY)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const dueWeek = open.filter((task) => task.due_date && !task.isOverdue && new Date(task.due_date).getTime() - now <= 7 * DAY)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const completion = mine.length ? Math.round((mine.filter(isDone).length / mine.length) * 100) : null;
    const pollsToVote = groups.flatMap((group) => (byGroup[group.id]?.openPollsToVote || []).map((poll) => ({ ...poll, group_name: group.name, group_id: group.id })));
    return { mine, overdue, dueSoon, dueWeek, completion, pollsToVote };
  }, [byGroup, groups, userId]);

  return { byGroup, loading, error, reload, ...summary };
}

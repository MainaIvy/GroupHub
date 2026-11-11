const DAY = 24 * 60 * 60 * 1000;
export const MIN_BALANCE_POINTS = 6;

const isLeaf = (task) => !task.is_parent && !task.has_subtasks;
const isDone = (task) => task.status === 'completed';

export const taskIsOverdue = (task, now = Date.now()) =>
  !isDone(task) && Boolean(task.due_date) && new Date(task.due_date).getTime() < now;

// Returns { status, reason } where status is on_track | quiet | at_risk | too_early.
export function computeHealth({ tasks = [], workload = null, lastActivity = null, now = Date.now() }) {
  const leaves = tasks.filter(isLeaf);
  const overdue = leaves.filter((task) => taskIsOverdue(task, now)).length;
  const imbalanced = (workload?.members || []).some((member) => ['warning', 'critical'].includes(member.warning_level));

  if (overdue > 0) return { status: 'at_risk', reason: `${overdue} overdue task${overdue === 1 ? '' : 's'}` };
  if (imbalanced) return { status: 'at_risk', reason: 'Workload is uneven between members' };
  if ((workload?.total_points ?? 0) < MIN_BALANCE_POINTS) return { status: 'too_early', reason: 'Not enough assigned points to judge yet' };
  if (!lastActivity || now - new Date(lastActivity).getTime() > 7 * DAY) return { status: 'quiet', reason: 'No activity in the last 7 days' };
  return { status: 'on_track', reason: 'Work is progressing evenly' };
}

export { isLeaf, isDone, DAY };

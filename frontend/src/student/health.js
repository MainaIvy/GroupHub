const DAY = 24 * 60 * 60 * 1000;
export const MIN_BALANCE_POINTS = 6;

const isLeaf = (task) => !task.is_parent && !task.has_subtasks;
const isDone = (task) => task.status === 'completed';

export const taskIsOverdue = (task, now = Date.now()) =>
  !isDone(task) && Boolean(task.due_date) && new Date(task.due_date).getTime() < now;

// Health status is now computed server-side (backend/accounts/health.py) and returned
// by the group workspace / dashboard endpoints. This module only keeps the small
// client-side helpers that the UI still needs for task filtering and due-date checks.
export { isLeaf, isDone, DAY };
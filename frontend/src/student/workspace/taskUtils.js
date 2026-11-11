import { weightInfo } from '../../taskWeights';

export const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

export const BOARD_LABEL = {
  proposed: 'Proposed',
  open_to_claim: 'Open to claim',
  assigned: 'Assigned',
  in_progress: 'In progress',
  done: 'Done',
};

export const columnOf = (task) => {
  if (task.board_status === 'done') return 'done';
  if (task.board_status === 'in_progress') return 'in_progress';
  return 'todo';
};

export const childrenOf = (task, tasks) => tasks.filter((item) => item.parent_task_id === task.id);

export const weightText = (weight) => {
  const info = weightInfo(weight);
  return info ? `${info.label} · ${info.value} pt${info.value === 1 ? '' : 's'}` : `${weight} pts`;
};

export const formatDue = (value) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No due date' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const ACTION_TEXT = {
  proposed: 'proposed',
  approved: 'approved',
  claimed: 'claimed',
  reassigned: 'reassigned',
  assigned: 'assigned',
  weight_changed: 'changed the weight of',
  weight_confirmed: 'confirmed the weight of',
};

export const describeActivity = (item) => `${item.actor_name} ${ACTION_TEXT[item.action] || String(item.action || 'updated').replaceAll('_', ' ')} “${item.task_title}”`;

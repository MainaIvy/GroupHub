import React from 'react';
import { CalendarDays, MessageSquare } from 'lucide-react';
import Avatar from '../components/Avatar';
import { BOARD_LABEL, childrenOf, formatDue, weightText } from './taskUtils';

const CHIP = {
  proposed: 'bg-amber-50 text-amber-800 border-amber-200',
  open_to_claim: 'bg-[#E3EAF2] text-[#2F4A66] border-[#C9D5E2]',
  assigned: 'bg-[#EEF1F4] text-[#33445A] border-[#D7DEE6]',
  in_progress: 'bg-[#EEF1F4] text-[#33445A] border-[#D7DEE6]',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export const StatusChip = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[13px] font-semibold ${CHIP[status] || CHIP.assigned}`}>{BOARD_LABEL[status] || status}</span>
);

const TaskCard = ({ task, tasks, selected, onOpen }) => {
  const subtasks = childrenOf(task, tasks);
  const doneSubtasks = subtasks.filter((item) => item.board_status === 'done').length;
  const assigned = task.assigned_to_id != null;

  return (
    <button
      type="button"
      id={`task-${task.id}`}
      onClick={onOpen}
      aria-pressed={selected}
      className={`w-full rounded-xl border bg-white p-4 text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6079] ${selected ? 'border-[#4A6079] ring-1 ring-[#4A6079]' : 'border-[#D7DEE6]'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[15px] font-semibold text-[#1F2D3D]">{task.title}</h4>
        <StatusChip status={task.board_status} />
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm text-[#33445A]">
        {assigned ? <Avatar name={task.assigned_to_name} size={24} /> : <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-[#8A97A8] text-[13px] text-[#4F5F73]">?</span>}
        <span className="truncate">{assigned ? task.assigned_to_name : 'Unassigned'}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span className="rounded bg-[#EEF1F4] px-2 py-0.5 font-semibold text-[#33445A]">{weightText(task.weight)}</span>
        <span className={`inline-flex items-center gap-1 ${task.is_overdue ? 'font-semibold text-red-700' : 'text-[#4F5F73]'}`}>
          <CalendarDays size={14} aria-hidden="true" />{task.is_overdue ? `Overdue · ${formatDue(task.due_date)}` : formatDue(task.due_date)}
        </span>
        <span className="inline-flex items-center gap-1 text-[#4F5F73]"><MessageSquare size={14} aria-hidden="true" />{task.comments?.length || 0}</span>
      </div>

      {subtasks.length ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[13px] text-[#4F5F73]"><span>Subtasks</span><span>{doneSubtasks}/{subtasks.length} done</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#DDE4EC]"><div className="h-full rounded-full bg-[#4A6079]" style={{ width: `${(doneSubtasks / subtasks.length) * 100}%` }} /></div>
        </div>
      ) : null}
    </button>
  );
};

export default TaskCard;

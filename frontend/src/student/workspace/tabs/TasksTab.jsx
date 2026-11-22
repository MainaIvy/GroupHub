import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, CalendarDays, Clock, Edit2, FileText, Plus, Paperclip, Trash2 } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { btnPrimary, btnSecondary } from '../../design';
import { childrenOf, formatDue, weightText } from '../taskUtils';

const isLeaf = (task) => !task.has_subtasks && !task.is_compile_task;
const isApproved = (task) => task.board_status !== 'proposed';

const computeProgress = (allTasks) => {
  const leafTasks = allTasks.filter((t) => isLeaf(t) && isApproved(t));
  if (leafTasks.length === 0) return 0;
  const totalWeight = leafTasks.reduce((sum, t) => sum + Math.max(1, t.weight || 1), 0);
  const weightedProgress = leafTasks.reduce((sum, t) => sum + (t.progress_percentage || 0) * Math.max(1, t.weight || 1), 0);
  return Math.round(weightedProgress / totalWeight);
};

const allApprovedLeafCompleted = (allTasks) => {
  const leafTasks = allTasks.filter((t) => isLeaf(t) && isApproved(t));
  if (leafTasks.length === 0) return false;
  return leafTasks.every((t) => t.board_status === 'done' || (t.progress_percentage || 0) >= 100);
};

const statuses = ['todo', 'in_progress', 'done'];
const personsLabel = 'Group by: Task';
const groupLabels = { task: 'Task', person: 'Person', status: 'Status' };

const toDisplayStatus = (boardStatus) => {
  if (boardStatus === 'done') return 'done';
  if (boardStatus === 'in_progress') return 'in_progress';
  return 'todo';
};

const taskStatusChip = (boardStatus) => {
  const s = toDisplayStatus(boardStatus);
  return ({
    done: 'bg-[#E3EAF2] text-[#35475C] border-[#D7DEE6]',
    in_progress: 'bg-[#EEF1F4] text-[#2F4A66] border-[#C9D5E2]',
    todo: 'bg-[#EEF1F4] text-[#33445A] border-[#D7DEE6]',
  }[s] || 'bg-[#EEF1F4] text-[#33445A] border-[#D7DEE6]');
};

const statusLabelFor = (boardStatus) => {
  const s = toDisplayStatus(boardStatus);
  return { todo: 'To do', in_progress: 'In progress', done: 'Done' }[s];
};

const cycleNext = (boardStatus) => {
  if (boardStatus === 'done') return 'pending';
  if (boardStatus === 'in_progress') return 'completed';
  return 'in_progress';
};

const SubtaskRow = ({ subtask, tasks, members, actions, userId, leaderId, compile, onSelectTask, onEditTask, onDeleteTask, onAddSubtask }) => {
  const subMember = members.find((item) => item.id === subtask.assigned_to_id);
  const isAssignee = subtask.assigned_to_id === userId;
  const isLeader = userId === leaderId;
  const canClaim = subtask.board_status === 'open_to_claim' && !subtask.has_subtasks;
  const canFinish = isAssignee && isApproved(subtask) && subtask.board_status !== 'done';
  const compileLocked = compile.is_locked && subtask.is_compile_task;
  const statusLabel = statusLabelFor(subtask.board_status);
  const weightLabel = subtask.weight ? `weight ${subtask.weight}` : 'weight —';
  const proofCount = (subtask.work_items || []).length;
  const [submitting, setSubmitting] = useState({
    note: '',
    url: '',
    file: null,
  });
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submittingWork, setSubmittingWork] = useState(false);

  const handleSubmitWork = async (event) => {
    event.preventDefault();
    if (!submitting.note.trim() && !submitting.url.trim() && !submitting.file) return;
    setSubmittingWork(true);
    try {
      const formData = new FormData();
      if (submitting.note.trim()) formData.append('note', submitting.note.trim());
      if (submitting.url.trim()) formData.append('url', submitting.url.trim());
      if (submitting.file) formData.append('files', submitting.file);
      formData.append('marks_complete', 'true');
      await actions.addWork(subtask, formData);
      setSubmitting({ note: '', url: '', file: null });
      setShowSubmitForm(false);
    } finally {
      setSubmittingWork(false);
    }
  };

  const workItems = (subtask.work_items || []).slice(0, 3);

  return (
    <article
      key={subtask.id}
      className="rounded-xl border border-[#CDD6E0] bg-white p-2.5 text-[13px] transition-all hover:border-[#4A6079] cursor-pointer"
      onClick={() => onSelectTask && onSelectTask(subtask.id)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-[#1F2D3D] truncate">{subtask.title}</span>
            <span className="rounded-full bg-[#DFE6EE] px-2 py-0.5 text-[11px] font-medium text-[#1F2D3D]">{weightLabel}</span>
            <span className={`shrink-0 rounded-full bg-[#DFE6EE] px-2 py-0.5 text-[11px] font-medium ${taskStatusChip(subtask.board_status)}${((isLeader || isAssignee) && subtask.board_status !== 'proposed' && !compileLocked) ? ' cursor-pointer hover:opacity-80 transition-colors' : ''}`} onClick={((isLeader || isAssignee) && subtask.board_status !== 'proposed' && !compileLocked) ? () => {
              actions.setStatus(subtask, cycleNext(subtask.board_status));
            } : undefined}>
              {statusLabel}
            </span>
            {subtask.is_overdue && <span className="rounded-full bg-[#FDE3E1] border border-[#E59A95] px-2 py-0.5 text-[10px] font-bold text-[#8A2A22]">Overdue</span>}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#4F5F73]">
            {subMember ? (
              <span className="flex items-center gap-1"><Avatar name={subMember.name} avatar={subMember.avatar} size={14} className="text-[8px]" /> {subMember.name}</span>
            ) : <span>Unassigned</span>}
            {subtask.due_date && <span>· {formatDue(subtask.due_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {subtask.board_status === 'proposed' && isLeader ? (
            <>
              <button type="button" disabled={actions.busy} onClick={() => actions.approve(subtask, { mode: 'open_to_claim' })} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Approve</button>
              <button type="button" disabled={actions.busy} onClick={() => actions.setStatus(subtask, 'todo')} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 border border-[#CDD6E0] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1F2D3D] hover:bg-[#EEF1F4] disabled:opacity-60">Reject</button>
            </>
          ) : (
            <>
              {canClaim && !compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => actions.claim(subtask, false)} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Claim</button>
              ) : null}
              {canFinish && !compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => actions.setStatus(subtask, 'completed')} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Done</button>
              ) : null}
              {compileLocked && <span className="inline-flex h-6 items-center justify-center gap-1 rounded-6 border border-[#CDD6E0] bg-[#EEF1F4] px-2 py-0.5 text-[10px] font-semibold text-[#2F4A66]">Locked</span>}
            </>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); setShowSubmitForm(!showSubmitForm); }} className="flex h-6 w-6 items-center justify-center rounded-6 border border-[#CDD6E0] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Submit work">
            <Paperclip size={12} />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onEditTask(subtask); }} className="flex h-6 w-6 items-center justify-center rounded-6 border border-[#CDD6E0] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Edit task">
            <Edit2 size={12} />
          </button>
          {!subtask.has_subtasks && (isLeader || isAssignee) && !compileLocked && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onAddSubtask(subtask); }} className="flex h-6 w-6 items-center justify-center rounded-6 border border-[#CDD6E0] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Add subtask">
              <Plus size={12} />
            </button>
          )}
          {isLeader && !compileLocked && (
            <button type="button" onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this subtask?')) onDeleteTask(subtask); }} className="flex h-6 w-6 items-center justify-center rounded-6 border border-[#CDD6E0] text-[#8A2A22] hover:bg-[#FDE3E1] hover:text-[#8A2A22] transition-colors" title="Delete task">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {showSubmitForm && (
        <div className="mt-2 pt-2 border-t border-[#DDDDDD]">
          <form onSubmit={handleSubmitWork} className="space-y-2">
            <input
              value={submitting.note}
              onChange={(event) => setSubmitting({ ...submitting, note: event.target.value })}
              placeholder="Add a note about your work…"
              className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-[13px] focus:border-[#4A6079] outline-none"
            />
            <input
              value={submitting.url}
              onChange={(event) => setSubmitting({ ...submitting, url: event.target.value })}
              placeholder="Link (e.g. Google Doc, GitHub)…"
              className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-[13px] focus:border-[#4A6079] outline-none"
            />
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setSubmitting({ ...submitting, file: event.target.files?.[0] || null })}
              className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-[12px] focus:border-[#4A6079] outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowSubmitForm(false)} className="flex-1 rounded-lg border border-[#CBD5E0] bg-white px-3 py-1.5 text-[12px] text-[#666666] hover:bg-[#F5F5F7] transition-colors">Cancel</button>
              <button type="submit" disabled={submittingWork || (!submitting.note.trim() && !submitting.url.trim() && !submitting.file)} className="flex-1 rounded-lg bg-[#4A6079] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#35475C] transition-colors">{submittingWork ? 'Submitting…' : 'Submit work'}</button>
            </div>
          </form>
        </div>
      )}

      {workItems.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#DDDDDD]">
          <p className="text-[11px] font-semibold text-[#666666] mb-1">Proof of work</p>
          <div className="space-y-1">
            {workItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-[#E3EAF2] bg-[#F8FAFC] p-1.5">
                {item.file_url ? (
                  <a href={item.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-[#435B76] underline hover:text-[#35475C]">
                    <span className="text-[10px]">📄</span> {item.file_name || 'File'}
                  </a>
                ) : item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-[#435B76] underline hover:text-[#35475C]">
                    <span className="text-[10px]">🔗</span> {item.url.length > 40 ? item.url.slice(0, 40) + '…' : item.url}
                  </a>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-[#666666]">
                    <span className="text-[10px]">📝</span> {item.note}
                  </span>
                )}
                {item.marks_complete && <span className="ml-auto text-[10px] font-bold text-[#16A34A]">Marks complete</span>}
              </div>
            ))}
            {proofCount > 3 && <p className="mt-1 text-[10px] text-[#4F5F73]">+{proofCount - 3} more…</p>}
          </div>
        </div>
      )}
    </article>
  );
};

const TaskRow = ({ task, tasks, members, actions, userId, leaderId, compile, openGroupTasks, onEditTask, onDeleteTask, onAddSubtask, onSelectTask }) => {
  const subtasks = task.subtask_ids.map((id) => tasks.find((item) => item.id === id)).filter(Boolean);
  const member = members.find((item) => item.id === task.assigned_to_id);
  const isLeader = userId === leaderId;
  const isAssignee = task.assigned_to_id === userId;
  const canFinish = isAssignee && isApproved(task) && task.board_status !== 'done' && !task.has_subtasks;
  const canClaim = task.board_status === 'open_to_claim' && !task.has_subtasks;
  const statusLabel = statusLabelFor(task.board_status);
  const proofCount = (task.work_items || []).length;
  const isCompile = task.is_compile_task || task.title.trim().toLowerCase() === 'compile and edit';
  const compileLocked = compile.is_locked;
  const canEditCompile = isLeader && compile.can_override;

  const finishTask = async () => {
    if (!task.has_subtasks) {
      const result = await actions.setStatus(task, 'completed');
      return result?.ok;
    }
    return true;
  };

  const claimTask = async () => {
    return actions.claim(task, false).ok ?? false;
  };

  const reassignTask = async (newAssigneeId) => {
    return actions.reassign(task, newAssigneeId, false).ok ?? false;
  };

  if (task.has_subtasks) {
    return (
      <article key={task.id} className="rounded-xl border border-[#CDD6E0] bg-white p-3 text-[13px]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[#1F2D3D] truncate">{task.title}</h4>
            {!task.parent_task_id && <span className="rounded-full bg-[#DFE6EE] px-2 py-0.5 text-[11px] font-medium text-[#35475C]">Parent task</span>}
            {isCompile ? <span className="rounded-full bg-[#DFE6EE] px-2 py-0.5 text-[11px] font-medium text-[#2F4A66]">Final task</span> : null}
            <span className={`shrink-0 rounded-full bg-[#DFE6EE] px-2 py-0.5 text-[11px] font-medium ${taskStatusChip(task.board_status)}${((isLeader || isAssignee) && !compileLocked && !task.has_subtasks && task.board_status !== 'proposed') ? ' cursor-pointer hover:opacity-80 transition-colors' : ''}`} onClick={((isLeader || isAssignee) && !compileLocked && !task.has_subtasks && task.board_status !== 'proposed') ? () => {
              actions.setStatus(task, cycleNext(task.board_status));
            } : undefined}>
              {statusLabel}
            </span>
            {task.is_overdue && <span className="rounded-full bg-[#FDE3E1] border border-[#E59A95] px-2 py-0.5 text-[11px] font-bold text-[#8A2A22]">Overdue</span>}
          </div>
          <div className="flex items-center gap-1">
            {task.board_status === 'proposed' && isLeader ? (
              <>
                <button type="button" disabled={actions.busy} onClick={() => actions.approve(task, { mode: 'open_to_claim' })} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Approve</button>
                <button type="button" disabled={actions.busy} onClick={() => actions.setStatus(task, 'todo')} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 border border-[#CDD6E0] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1F2D3D] hover:bg-[#EEF1F4] disabled:opacity-60">Reject</button>
              </>
            ) : (
              <>
                {canClaim && !compileLocked ? (
                  <button type="button" disabled={actions.busy} onClick={() => claimTask()} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Claim</button>
                ) : null}
                {canFinish && !compileLocked ? (
                  <button type="button" disabled={actions.busy} onClick={() => finishTask()} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Done</button>
                ) : null}
                {!member && canEditCompile && isCompile && compileLocked ? (
                  <button type="button" disabled={actions.busy} onClick={() => openGroupTasks()} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Combine</button>
                ) : null}
                {member && !compileLocked ? (
                  <button type="button" disabled={actions.busy} onClick={() => reassignTask(member.id)} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Reassign</button>
                ) : null}
                {compileLocked && <span className="inline-flex h-6 items-center justify-center gap-1 rounded-6 border border-[#CDD6E0] bg-[#EEF1F4] px-2 py-0.5 text-[10px] font-semibold text-[#2F4A66]">Locked</span>}
              </>
            )}
          </div>
        </div>
        <div className="mt-1 space-y-1">
          {subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} tasks={tasks} members={members} actions={actions} userId={userId} leaderId={leaderId} compile={compile} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onAddSubtask={onAddSubtask} />
          ))}
        </div>
      </article>
    );
  }

  return (
    <article key={task.id} className="rounded-xl border border-[#CDD6E0] bg-white p-2.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-[#1F2D3D] truncate">{task.title}</span>
            {isCompile ? <span className="rounded-full bg-[#DFE6EE] px-2 py-0.5 text-[11px] font-medium text-[#2F4A66]">Final task</span> : null}
            <span className={`shrink-0 rounded-full bg-[#DFE6EE] px-2 py-0.5 text-[11px] font-medium ${taskStatusChip(task.board_status)}${((isLeader || isAssignee) && !compileLocked && task.board_status !== 'proposed') ? ' cursor-pointer hover:opacity-80 transition-colors' : ''}`} onClick={((isLeader || isAssignee) && !compileLocked && task.board_status !== 'proposed') ? () => {
              actions.setStatus(task, cycleNext(task.board_status));
            } : undefined}>
              {statusLabel}
            </span>
            {task.is_overdue && <span className="rounded-full bg-[#FDE3E1] border border-[#E59A95] px-2 py-0.5 text-[10px] font-bold text-[#8A2A22]">Overdue</span>}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#4F5F73]">
            {member ? (
              <span className="flex items-center gap-1"><Avatar name={member.name} avatar={member.avatar} size={14} className="text-[8px]" /> {member.name}</span>
            ) : <span>Unassigned</span>}
            {task.weight && <span>· weight {task.weight}</span>}
            {task.due_date && <span>· {formatDue(task.due_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.board_status === 'proposed' && isLeader ? (
            <>
              <button type="button" disabled={actions.busy} onClick={() => actions.approve(task, { mode: 'open_to_claim' })} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Approve</button>
              <button type="button" disabled={actions.busy} onClick={() => actions.setStatus(task, 'todo')} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 border border-[#CDD6E0] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1F2D3D] hover:bg-[#EEF1F4] disabled:opacity-60">Reject</button>
            </>
          ) : (
            <>
              {canClaim && !compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => claimTask()} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Claim</button>
              ) : null}
              {canFinish && !compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => finishTask()} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Done</button>
              ) : null}
              {!member && canEditCompile && isCompile && compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => openGroupTasks()} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Combine</button>
              ) : null}
              {member && !compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => reassignTask(member.id)} className="inline-flex h-6 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Reassign</button>
              ) : null}
              {(isLeader || isAssignee) && !compileLocked && task.board_status !== 'done' ? (
                <button type="button" onClick={() => onEditTask(task)} className="flex h-6 w-6 items-center justify-center rounded-6 border border-[#CDD6E0] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Edit task">
                  <Edit2 size={12} />
                </button>
              ) : null}
              {!task.has_subtasks && (isLeader || isAssignee) && !compileLocked ? (
                <button type="button" onClick={() => onAddSubtask(task)} className="flex h-6 w-6 items-center justify-center rounded-6 border border-[#CDD6E0] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Add subtask">
                  <Plus size={12} />
                </button>
              ) : null}
              {isLeader && !compileLocked ? (
                <button type="button" onClick={() => { if (window.confirm('Delete this task?')) onDeleteTask(task); }} className="flex h-6 w-6 items-center justify-center rounded-6 border border-[#CDD6E0] text-[#8A2A22] hover:bg-[#FDE3E1] hover:text-[#8A2A22] transition-colors" title="Delete task">
                  <Trash2 size={12} />
                </button>
              ) : null}
              {compileLocked && <span className="inline-flex h-6 items-center justify-center gap-1 rounded-6 border border-[#CDD6E0] bg-[#EEF1F4] px-2 py-0.5 text-[10px] font-semibold text-[#2F4A66]">Locked</span>}
            </>
          )}
        </div>
      </div>
    </article>
  );
};

const TaskGroup = ({ title, tasks, members, actions, userId, leaderId, compile, openGroupTasks, collapsible, onEditTask, onDeleteTask, onAddSubtask, onSelectTask }) => {
  const [open, setOpen] = useState(true);
  const headerLabel = collapsible ? (open ? <ChevronUp size={14} className="mr-1 text-[#4F5F73]" /> : <ChevronDown size={14} className="mr-1 text-[#4F5F73]" />) : null;
  return (
    <section className="space-y-3" aria-label={title}>
      <button
        type="button"
        onClick={collapsible ? () => setOpen((previous) => !previous) : undefined}
        aria-expanded={!collapsible || open}
        className="flex items-center justify-between gap-2 rounded-xl border border-[#CDD6E0] bg-white px-3 py-2 text-left hover:bg-[#EEF1F4]"
      >
        <span className="flex items-center gap-1 shrink-0 font-semibold text-[#1F2D3D]">{headerLabel}{title}</span>
        {tasks.length > 0 && (
          <span className="shrink-0 rounded-full bg-[#DFE6EE] px-2 py-0.5 text-[11px] font-medium text-[#4F5F73]">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        )}
      </button>
      {(!collapsible || open) && (
        <div className="space-y-2">
          {tasks.map((task) => <TaskRow key={task.id} task={task} tasks={tasks} members={members} actions={actions} userId={userId} leaderId={leaderId} compile={compile} openGroupTasks={openGroupTasks} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onAddSubtask={onAddSubtask} onSelectTask={onSelectTask} />)}
        </div>
      )}
    </section>
  );
};

const BalanceBox = ({ type, members, suggestion }) => {
  const configs = {
    warning: { bg: '#FDF1D8', border: '#E8C36A', text: '#7A5A10', label: 'Workload warning' },
    critical: { bg: '#FDE3E1', border: '#E59A95', text: '#8A2A22', label: 'Workload critical' },
  };
  const config = configs[type];
  const overloaded = members.filter((m) => m.warning_level === type || m.warning_level === (type === 'warning' ? 'critical' : type));
  return (
    <div className={`rounded-lg border border-[${config.border}] bg-[${config.bg}] p-2.5 mb-3`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[10px] font-bold text-[${config.text}]">{config.label}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[${config.text}] leading-snug">{suggestion || `${overloaded.length} member${overloaded.length !== 1 ? 's' : ''} over fair share.`}</p>
        </div>
      </div>
    </div>
  );
};

const TasksTab = ({
  workspace,
  tasks,
  members,
  projects,
  balance,
  compile,
  actions,
  user,
  isLeader,
  selectedTaskId,
  onSelectTask,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onAddSubtask,
  onCreateProject,
  onGoSubmission,
  reload,
}) => {
  const [groupBy, setGroupBy] = useState('task');
  const [openTask, setOpenTask] = useState(undefined);

  const userId = user?.id;
  const leaderId = workspace.group?.leader_id;
  const rootTasks = tasks.filter((task) => !task.parent_task_id);
  const taskOrder = ['Compile and edit', ...rootTasks.filter((task) => task.title.trim().toLowerCase() !== 'compile and edit').sort((a, b) => new Date(a.due_date || '9999') - new Date(b.due_date || '9999'))];
  const groupedByTask = useMemo(() => {
    const map = new Map();
    taskOrder.forEach((task) => map.set(task.id, [task.id, ...(task.subtask_ids || [])]));
    const remaining = tasks.filter((task) => !task.parent_task_id && !taskOrder.some((t) => t.id === task.id));
    remaining.forEach((task) => map.set(task.id, [task.id, ...(task.subtask_ids || [])]));
    return taskOrder.concat(remaining).map((task) => ({ task, items: map.get(task.id).map((id) => tasks.find((item) => item.id === id)).filter(Boolean) }));
  }, [tasks]);
  const groupedByPerson = useMemo(() => {
    const map = new Map(members.map((member) => [member.id, { member, items: [] }]));
    tasks.forEach((task) => {
      if (task.parent_task_id) return;
      if (task.assigned_to_id) {
        const entry = map.get(task.assigned_to_id);
        if (entry) entry.items.push(task);
      }
    });
    return Array.from(map.values()).filter((entry) => entry.items.length > 0);
  }, [tasks, members]);
  const groupedByStatus = useMemo(() => statuses.map((status) => ({ status, items: tasks.filter((task) => !task.parent_task_id && toDisplayStatus(task.board_status) === status) })), [tasks]);

  const taskGroups = useMemo(() => {
    if (groupBy === 'task') return groupedByTask.map((group) => ({ title: group.task.title, tasks: group.items, sectionId: group.task.id }));
    if (groupBy === 'person') return groupedByPerson.map((group) => ({ title: group.member.name, tasks: group.items, sectionId: `person-${group.member.id}`, avatar: group.member.avatar }));
    return groupedByStatus.map((group) => ({ title: group.status.charAt(0).toUpperCase() + group.status.slice(1), tasks: group.items, sectionId: `status-${group.status}` }));
  }, [groupBy, groupedByTask, groupedByPerson, groupedByStatus]);

  const openCombine = useCallback(() => {
    actions.setStatus(tasks.find((task) => task.is_compile_task), 'completed', { override_reason: '' });
  }, [actions, tasks]);

  const project = projects?.[0] || workspace.project || {};
  const overallProgress = computeProgress(tasks);
  const openToClaim = tasks.filter((task) => task.board_status === 'open_to_claim' && !task.has_subtasks && task.section);

  const taskCardForOpen = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : null;

  const memberCount = members.length || workspace.group?.members_count || 0;
  const fairShare = memberCount ? (100 / memberCount).toFixed(1) : 0;
  const totalPoints = balance?.total_points ?? 0;
  const tooEarly = totalPoints < 6;
  const warningMembers = balance?.members?.filter((m) => m.warning_level === 'warning') || [];
  const criticalMembers = balance?.members?.filter((m) => m.warning_level === 'critical') || [];
  const suggestion = balance?.suggestion || '';

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-[#CDD6E0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#1F2D3D]">{workspace.group?.project_title || project.title || 'Project plan'}</h2>
            <p className="mt-1 text-sm text-[#4F5F73]">{workspace.group?.unit_name || ''}</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#1F2D3D]">{overallProgress}%</span>
              <span className="text-sm font-semibold text-[#4A6079]">overall progress</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-[#4F5F73]">
              <CalendarDays size={14} aria-hidden="true" />
              <span>{(workspace.group?.project_deadline || project.deadline) ? formatDue(workspace.group?.project_deadline || project.deadline) : (tasks.find((t) => t.due_date) ? formatDue(tasks.find((t) => t.due_date).due_date) : 'No deadline')}</span>
              <span className="hidden sm:inline">· {memberCount} member{memberCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={actions.busy} onClick={onCreateTask} className="inline-flex h-8 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-3 py-1 text-xs font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Create Task</button>
            <button type="button" disabled={actions.busy || !allApprovedLeafCompleted(tasks)} onClick={() => actions.setStatus(tasks.find((task) => task.is_compile_task), 'completed')} className="inline-flex h-8 items-center justify-center gap-1 rounded-6 bg-[#4A6079] px-3 py-1 text-xs font-semibold text-white hover:bg-[#35475C] disabled:opacity-60">Ready to submit</button>
          </div>
        </div>
      </header>

      {compile.is_locked && (
        <section className="rounded-lg border border-[#E3EAF2] bg-[#EEF1F4] p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-[#2F4A66]" aria-hidden="true" />
            <p className="text-sm text-[#2F4A66]">{compile.lock_reason}</p>
          </div>
          {compile.ready_to_combine && compile.can_override && (
            <button type="button" disabled={actions.busy} onClick={openCombine} className="mt-2.5 rounded-lg bg-[#4A6079] px-3 py-1 text-xs font-bold text-white hover:bg-[#35475C] disabled:opacity-60">Override and start combine</button>
          )}
        </section>
      )}
      {compile.ready_to_combine && !compile.is_locked && (
        <section className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] p-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#2F4A66]" aria-hidden="true" />
            <p className="text-sm text-[#2F4A66]">All approved tasks complete — compile and edit unlocked.</p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <section className="rounded-xl border border-[#CDD6E0] bg-white p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-[#1F2D3D]">Plan view</h3>
              <div className="flex gap-1 rounded-lg border border-[#CDD6E0]">
                {[['task', 'task'], ['person', 'person'], ['status', 'status']].map(([value, label]) => (
                  <button key={value} type="button" role="radio" aria-checked={groupBy === value} onClick={() => setGroupBy(value)} className={`h-8 px-3 text-[11px] font-medium transition ${groupBy === value ? 'bg-[#4A6079] text-white' : 'text-[#1F2D3D] hover:bg-[#EEF1F4]'}`}>{groupLabels[value]}</button>
                ))}
              </div>
            </div>

            <section aria-labelledby="open-to-claim">
              <h4 className="text-[11px] font-semibold text-[#4F5F73] mb-2 uppercase tracking-wide">Open to claim</h4>
              {openToClaim.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {openToClaim.map((task) => {
                    const member = members.find((item) => item.id === task.assigned_to_id);
                    return (
                      <article key={task.id} className="rounded-xl border border-[#CDD6E0] bg-white p-2 text-[12px]">
                        <h5 className="font-medium text-[#1F2D3D] truncate">{task.title}</h5>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-[#4F5F73]">
                          {task.due_date && <span>{formatDue(task.due_date)}</span>}
                          {task.weight && <span>· weight {task.weight}</span>}
                        </div>
                        <button type="button" disabled={actions.busy} onClick={() => actions.claim(task, false)} className="mt-2 rounded-lg bg-[#4A6079] w-full px-3 py-1 text-[10px] font-bold text-white hover:bg-[#35475C] disabled:opacity-60">Claim</button>
                      </article>
                    );
                  })}
                </div>
              ) : <p className="text-[11px] text-[#4F5F73]">No unclaimed subtasks right now.</p>}
            </section>

            <section className="space-y-2" aria-labelledby="tasks">
              <h4 className="text-[11px] font-semibold text-[#4F5F73] mb-2 uppercase tracking-wide">Tasks</h4>
              {taskGroups.length ? (
                taskGroups.map((group) => (
                  <TaskGroup key={group.sectionId} title={group.title} tasks={group.tasks} members={members} actions={actions} userId={userId} leaderId={leaderId} compile={compile} openGroupTasks={reload} collapsible={groupBy === 'task'} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onAddSubtask={onAddSubtask} onSelectTask={onSelectTask} />
                ))
              ) : (
                <p className="text-[11px] text-[#4F5F73]">No tasks yet. Add one to start the plan.</p>
              )}
            </section>
          </section>
        </div>

        <div className="lg:col-span-4">
          <section className="rounded-xl border border-[#CDD6E0] bg-white p-4">
            <h3 className="text-sm font-bold text-[#1F2D3D] mb-3">Workload balance</h3>

            {tooEarly ? (
              <div className="rounded-lg border border-[#CDD6E0] bg-[#EEF1F4] p-2.5 mb-3">
                <p className="text-[11px] text-[#4F5F73]">0 of 6 points to start balancing</p>
              </div>
            ) : (
              <>
                {criticalMembers.length > 0 && <BalanceBox type="critical" members={criticalMembers} suggestion={suggestion} />}
                {warningMembers.length > 0 && <BalanceBox type="warning" members={warningMembers} suggestion={suggestion} />}

                <div className="space-y-2">
                  {members.map((member) => {
                    const share = Number(member.share_percent || 0);
                    return (
                      <div key={member.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={member.name} avatar={member.avatar} size={18} className="text-[9px]" />
                          <span className="truncate text-[11px] font-medium text-[#1F2D3D]">{member.name}</span>
                          {member.is_leader && <span className="rounded-full bg-[#E3EAF2] px-1.5 py-0.5 text-[9px] font-semibold text-[#2F4A66]">Leader</span>}
                        </div>
                        <div className="w-16 flex flex-col items-end gap-0.5">
                          <span className="text-[10px] font-semibold text-[#4F5F73]">{share.toFixed(0)}%</span>
                          <div className="w-full h-[8px] rounded-full bg-[#DFE6EE] overflow-hidden">
                            <div className="h-full bg-[#4A6079]" style={{ width: `${Math.min(100, share)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-[#4F5F73]">Fair share: {fairShare}% per member</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default TasksTab;

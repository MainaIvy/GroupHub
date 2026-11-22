import React, { useCallback, useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { btnPrimary, btnSecondary } from '../design';
import { WEIGHT_SCALE } from '../../taskWeights';
import { timeAgo } from '../utils';
import Avatar from '../components/Avatar';
import { ProgressBar } from '../components/ProgressBar';
import { StatusChip } from './TaskCard';
import { childrenOf, describeActivity, formatDue, weightText } from './taskUtils';

const Section = ({ title, children }) => (
  <section className="border-t border-[#E3EAF2] pt-4">
    <h4 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#4F5F73]">{title}</h4>
    {children}
  </section>
);

const selectClass = 'h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[15px] text-[#1F2D3D]';

const TaskPanel = ({ task, tasks, members, activity, userId, leaderId, actions, compile, onClose, onSelectTask, onAddSubtask, onGoSubmission }) => {
  const [warning, setWarning] = useState(null);
  const [approveMode, setApproveMode] = useState('open_to_claim');
  const [approveAssignee, setApproveAssignee] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [weight, setWeight] = useState(task.weight);
  const [comment, setComment] = useState('');
  const [section, setSection] = useState('');
  const [proofText, setProofText] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofFile, setProofFile] = useState(null);

  useEffect(() => {
    setWarning(null);
    setSection('');
    setWeight(task.weight);
    setComment('');
    setProofText('');
    setProofUrl('');
    setProofFile(null);
    actions.clearError();
    // Reset local form state only when a different task is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const subtasks = childrenOf(task, tasks);
  const parent = tasks.find((item) => item.id === task.parent_task_id);
  const isLeader = userId === leaderId;
  const isAssignee = task.assigned_to_id === userId;
  const history = activity.filter((item) => item.task_id === task.id);
  const weightHistory = history.filter((item) => item.new_weight != null);
  const comments = task.comments || [];
  const workItems = task.work_items || [];
  const isCompile = task.is_compile_task || task.title.trim().toLowerCase() === 'compile and edit';
  const compileLocked = compile?.is_locked || false;
  const canApprove = isLeader && task.board_status === 'proposed' && !task.has_subtasks;
  const canFinish = isAssignee && task.board_status !== 'done' && task.board_status !== 'proposed' && !task.has_subtasks && !(isCompile && compileLocked);
  const canStart = isAssignee && task.board_status === 'todo' && !task.has_subtasks && !(isCompile && compileLocked);
  const canClaim = task.board_status === 'open_to_claim' && !isAssignee && !task.has_subtasks && !task.is_compile_task;
  const canReassign = (isLeader || isAssignee) && task.board_status !== 'proposed' && !task.has_subtasks;

  const exec = async (call) => {
    const result = await call(false);
    if (result.warning) setWarning({ text: result.warning, retry: async () => { const again = await call(true); if (!again.warning) setWarning(null); return again; } });
    else { setWarning(null); if (result.ok) setSection(''); }
    return result;
  };

  const finishTask = async () => {
    if (!task.has_subtasks && onGoSubmission) {
      await onGoSubmission();
    } else if (!task.has_subtasks && actions.setStatus) {
      await actions.setStatus(task, 'completed');
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const text = comment.trim();
    if (!text) return;
    const result = await actions.comment(task, text);
    if (result.ok) setComment('');
  };

  const addWork = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('note', proofText.trim());
    formData.append('url', proofUrl.trim());
    if (proofFile) formData.append('file', proofFile);
    const result = await actions.addWork(task, formData);
    if (result?.ok) {
      setProofText('');
      setProofUrl('');
      setProofFile(null);
      await exec(() => actions.setStatus(task, 'completed'));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#1F2D3D]/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={`Task: ${task.title}`} className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {parent ? <button type="button" onClick={() => onSelectTask(parent.id)} className="mb-1 text-sm font-semibold text-[#4A6079] underline">← {parent.title}</button> : null}
            <h3 className="text-lg font-bold text-[#1F2D3D]">{task.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2"><StatusChip status={task.board_status} />{task.is_overdue ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[13px] font-semibold text-red-700">Overdue</span> : null}</div>
          </div>
          <button type="button" aria-label="Close task" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-[#EEF1F4]"><X size={18} aria-hidden="true" /></button>
        </div>

        {actions.error ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{actions.error}</p> : null}
        {warning ? (
          <div role="alert" className="mt-3 rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] p-3 text-sm text-[#35475C]">
            <p>{warning.text}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={actions.busy} onClick={warning.retry} className={btnPrimary}>Continue anyway</button>
              <button type="button" onClick={() => setWarning(null)} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-4 text-[15px] text-[#33445A]">
          <p className="whitespace-pre-wrap">{task.description || <span className="text-[#4F5F73]">No description.</span>}</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[13px] text-[#4F5F73]">Assignee</dt><dd className="mt-1 flex items-center gap-2 font-medium">{task.assigned_to_id != null ? <><Avatar name={task.assigned_to_name} size={24} />{task.assigned_to_name}</> : 'Unassigned'}</dd></div>
            <div><dt className="text-[13px] text-[#4F5F73]">Due</dt><dd className={`mt-1 font-medium ${task.is_overdue ? 'text-red-700' : ''}`}>{formatDue(task.due_date)}</dd></div>
            <div><dt className="text-[13px] text-[#4F5F73]">Project</dt><dd className="mt-1 font-medium">{task.project_name}</dd></div>
            <div><dt className="text-[13px] text-[#4F5F73]">Progress</dt><dd className="mt-1 font-medium">{task.progress_percentage || 0}%</dd></div>
          </dl>

          {workItems.length ? (
            <Section title="Proof of work">
              <div className="space-y-2 text-xs text-[#4F5F73]">
                {workItems.map((item) => {
                  const isOwner = item.author_id === userId;
                  return (
                    <article key={item.id} className="rounded-lg border border-[#E3EAF2] p-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm font-medium text-[#33445A]">
                        <span>{item.author_name} • {timeAgo(item.created_at)}</span>
                        {isOwner && !actions.busy && (
                          <button type="button" onClick={() => { if (window.confirm('Remove this proof of work?')) actions.deleteWorkItem(task.id, item.id); }} className="text-[10px] text-red-600 hover:text-red-700 underline hover:bg-red-50 px-1 py-0.5 rounded" title="Delete proof">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                      {item.note && <p className="mt-1 whitespace-pre-wrap">{item.note}</p>}
                      {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-medium text-[#435B76] underline">Open link</a>}
                      {item.file_url && <a href={item.file_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-medium text-[#435B76] underline">Open {item.file_name}</a>}
                    </article>
                  );
                })}
              </div>
            </Section>
          ) : null}

          <Section title="Actions">
            <div className="flex flex-wrap gap-2">
              {canClaim ? <button type="button" disabled={actions.busy} onClick={() => exec((confirm) => actions.claim(task, confirm))} className={btnPrimary}>Claim task</button> : null}
              {canApprove ? <button type="button" onClick={() => setSection(section === 'approve' ? '' : 'approve')} className={btnPrimary}>Approve</button> : null}
              {canStart ? <button type="button" disabled={actions.busy} onClick={() => exec(() => actions.setStatus(task, 'in_progress'))} className={btnSecondary}>Start work</button> : null}
              {canFinish ? <button type="button" disabled={actions.busy} onClick={() => finishTask()} className={btnPrimary}>Done</button> : null}
              {canReassign ? <button type="button" onClick={() => setSection(section === 'reassign' ? '' : 'reassign')} className={btnSecondary}>Reassign</button> : null}
              {!task.parent_task_id ? <button type="button" onClick={() => onAddSubtask(task)} className={btnSecondary}>Add subtask</button> : null}
            </div>
            {!canClaim && !canApprove && !canStart && !canFinish && !canReassign && task.parent_task_id ? <p className="text-sm text-[#4F5F73]">No actions available for you on this task.</p> : null}

            {section === 'approve' && canApprove ? (
              <div className="mt-3 space-y-2 rounded-lg bg-[#EEF1F4] p-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="approve-mode" checked={approveMode === 'open_to_claim'} onChange={() => setApproveMode('open_to_claim')} disabled={task.has_subtasks} /> Open to claim</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="approve-mode" checked={approveMode === 'assigned'} onChange={() => setApproveMode('assigned')} /> Assign to a member</label>
                {approveMode === 'assigned' && !task.has_subtasks ? (
                  <select aria-label="Assign to" value={approveAssignee} onChange={(event) => setApproveAssignee(event.target.value)} className={selectClass}>
                    <option value="">Choose a member</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                ) : null}
                <button type="button" disabled={actions.busy || (approveMode === 'assigned' && !task.has_subtasks && !approveAssignee)} onClick={() => exec((confirm) => actions.approve(task, { mode: approveMode, assignedToId: approveAssignee, confirm }))} className={btnPrimary}>Confirm approval</button>
              </div>
            ) : null}

            {section === 'reassign' && canReassign ? (
              <div className="mt-3 space-y-2 rounded-lg bg-[#EEF1F4] p-3">
                <select aria-label="Reassign to" value={reassignTo} onChange={(event) => setReassignTo(event.target.value)} className={selectClass}>
                  <option value="">Choose a member</option>
                  {members.filter((member) => member.id !== task.assigned_to_id).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
                <button type="button" disabled={actions.busy || !reassignTo} onClick={() => exec((confirm) => actions.reassign(task, reassignTo, confirm))} className={btnPrimary}>Reassign</button>
              </div>
            ) : null}
          </Section>

          {task.board_status === 'completed' || task.board_status === 'in_progress' ? (
            <Section title="Proof of work (optional)">
              <p className="text-sm text-[#4F5F73]">Attach a link, file, or note to show what you did.</p>
              <div className="mt-2 space-y-2">
                <textarea value={proofText} onChange={(event) => setProofText(event.target.value)} placeholder="Note or link…" rows={2} className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-[14px]" />
                <input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="https://docs.google.com/document/…" className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-[14px]" />
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(event) => setProofFile(event.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs" />
              </div>
              {workItems.length ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-[#4F5F73]">{workItems.length} file(s)/link(s) attached</div>
              ) : null}
              <button type="button" disabled={actions.busy || (!proofText.trim() && !proofUrl.trim() && !proofFile)} onClick={addWork} className={btnSecondary}>Attach proof</button>
            </Section>
          ) : null}

          <Section title="Weight">
            <p className="text-sm"><span className="font-semibold">{weightText(task.weight)}</span> · {task.weight_confirmed ? 'Confirmed' : 'Not confirmed yet'}</p>
            {task.can_change_weight ? (
              <div className="mt-2 flex gap-2">
                <select aria-label="Change weight" value={weight} onChange={(event) => setWeight(Number(event.target.value))} className={selectClass}>
                  {WEIGHT_SCALE.map((item) => <option key={item.value} value={item.value}>{item.value} · {item.label}</option>)}
                </select>
                <button type="button" disabled={actions.busy || Number(weight) === Number(task.weight)} onClick={() => exec(() => actions.changeWeight(task, weight))} className={btnSecondary}>Change</button>
              </div>
            ) : null}
            {!task.weight_confirmed && task.can_confirm_weight ? <button type="button" disabled={actions.busy} onClick={() => exec(() => actions.confirmWeight(task))} className={`${btnPrimary} mt-2`}>Confirm weight</button> : null}
            {!task.weight_confirmed && !task.can_confirm_weight && leaderOwnsTask ? <p className="mt-2 text-sm text-[#4F5F73]">You can't confirm the weight of your own task. Another member needs to confirm it.</p> : null}
            {weightHistory.length ? (
              <ul className="mt-3 space-y-1 text-sm text-[#4F5F73]">
                {weightHistory.map((item) => <li key={item.id}>{item.old_weight != null ? `${item.old_weight} → ${item.new_weight}` : `Set to ${item.new_weight}`} · {item.actor_name} · {timeAgo(item.created_at)}</li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-[#4F5F73]">No weight changes yet.</p>}
          </Section>

          <Section title={`Subtasks (${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''})`}>
            {subtasks.length ? (
              <ul className="space-y-2">
                {subtasks.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => onSelectTask(item.id)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#D7DEE6] px-3 py-2 text-left text-sm hover:bg-[#EEF1F4]">
                      <span className="truncate font-medium text-[#1F2D3D]">{item.title}</span><StatusChip status={item.board_status} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[#4F5F73]">No subtasks.</p>}
          </Section>

          <Section title={`Comments (${comments.length} comment${comments.length !== 1 ? 's' : ''})`}>
            {comments.length ? (
              <ol className="space-y-2">
                {comments.map((item) => <li key={item.id} className="rounded-lg bg-[#EEF1F4] px-3 py-2 text-sm"><p className="whitespace-pre-wrap">{item.content}</p><p className="mt-1 text-[13px] text-[#4F5F73]">{item.author_name} · {timeAgo(item.created_at)}</p></li>)}
              </ol>
            ) : <p className="text-sm text-[#4F5F73]">No comments yet.</p>}
            <form onSubmit={submitComment} className="mt-2 flex gap-2">
              <input value={comment} onChange={(event) => setComment(event.target.value)} aria-label="Add a comment" placeholder="Add a comment…" maxLength={500} className="h-10 min-w-0 flex-1 rounded-lg border border-[#CBD5E1] px-3 text-[15px]" />
              <button type="submit" disabled={actions.busy || !comment.trim()} className={btnSecondary}>Post</button>
            </form>
          </Section>

          <Section title="Activity">
            {history.length ? (
              <ul className="space-y-2 text-sm">
                {history.map((item) => <li key={item.id}><p>{describeActivity(item)}</p>{item.note ? <p className="text-[13px] text-[#4F5F73]">{item.note}</p> : null}<p className="text-[13px] text-[#4F5F73]">{timeAgo(item.created_at)}</p></li>)}
              </ul>
            ) : <p className="text-sm text-[#4F5F73]">No activity on this task yet.</p>}
          </Section>
        </div>
      </aside>
    </div>
  );
};

export default TaskPanel;


import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, CalendarDays, Clock, Edit2, FileText, Plus, Trash2 } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { btnPrimary, btnSecondary } from '../../design';
import { ProgressBar } from '../../components/ProgressBar';
import { childrenOf, formatDue, weightText } from '../taskUtils';

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

const SubtaskCard = ({ subtask, tasks, members, actions, userId, leaderId, compile, onSelectTask, onEditTask, onDeleteTask }) => {
  const subMember = members.find((item) => item.id === subtask.assigned_to_id);
  const isAssignee = subtask.assigned_to_id === userId;
  const isLeader = userId === leaderId;
  const canClaim = subtask.board_status === 'open_to_claim' && !subtask.has_subtasks;
  const canFinish = isAssignee && subtask.board_status !== 'done';
  const compileLocked = compile.is_locked && subtask.is_compile_task;
  const statusLabel = statusLabelFor(subtask.board_status);
  const proofCount = (subtask.work_items || []).length;
  const [attachOpen, setAttachOpen] = useState(false);
  const [proofText, setProofText] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofFile, setProofFile] = useState(null);

  const addWork = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('note', proofText.trim());
    formData.append('url', proofUrl.trim());
    if (proofFile) formData.append('files', proofFile);
    const result = await actions.addWork(subtask, formData);
    if (result?.ok) {
      setProofText('');
      setProofUrl('');
      setProofFile(null);
      setAttachOpen(false);
    }
  };

  return (
    <article
      key={subtask.id}
      className={`rounded-xl border border-[#D7DEE6] bg-white p-3 text-[13px] transition-all hover:border-[#35475C] hover:shadow-sm cursor-pointer${onSelectTask ? ' hover:bg-[#FAFCFD]' : ''}`}
      onClick={onSelectTask ? () => onSelectTask(subtask.id) : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h5 className="font-medium text-[#1F2D3D] truncate">{subtask.title}</h5>
            <span className="rounded-full border border-[#C9D5E2] bg-[#EEF1F4] px-1.5 py-0.5 text-[9px] font-semibold text-[#6B7280]">Subtask</span>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${taskStatusChip(subtask.board_status)}${isAssignee && !compileLocked ? ' cursor-pointer hover:opacity-80 transition-colors' : ''}`} onClick={isAssignee && !compileLocked ? () => {
              actions.setStatus(subtask, cycleNext(subtask.board_status));
            } : undefined}>
              {statusLabel}
            </span>
            {subtask.is_overdue && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">Overdue</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[#4F5F73]">
            {subtask.due_date && <span>{formatDue(subtask.due_date)}</span>}
            {subtask.weight ? <span>Â· {weightText(subtask.weight)}</span> : ''}
            {subtask.is_overdue && <span className="text-red-700 font-semibold">overdue</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {subMember ? <Avatar name={subMember.name} avatar={subMember.avatar} size={18} className="text-[9px]" /> : <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-[#8A97A8] text-[9px] text-[#4F5F73]">?</span>}
          {proofCount > 0 && <FileText size={10} className="text-[#4A6079]" title="Proof attached" />}
        </div>
      </div>

      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {subMember ? <Avatar name={subMember.name} avatar={subMember.avatar} size={16} className="text-[8px]" /> : <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-dashed border-[#8A97A8] text-[8px] text-[#4F5F73]">?</span>}
            {subMember ? <span className="text-[10px] text-[#4F5F73]">{subMember.name}</span> : <span className="text-[10px] text-[#4F5F73]">Unassigned</span>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canClaim && !compileLocked ? (
              <button type="button" disabled={actions.busy} onClick={() => actions.claim(subtask, false)} className={btnSecondary}>Claim</button>
            ) : null}
            {canFinish && !compileLocked ? (
              <button type="button" disabled={actions.busy} onClick={() => actions.setStatus(subtask, 'completed')} className={btnPrimary}>Done</button>
            ) : null}
            {compileLocked && <span className="shrink-0 rounded-full border border-[#E3EAF2] bg-[#EEF1F4] px-1.5 py-0.5 text-[9px] font-semibold text-[#2F4A66]">Locked</span>}
          </div>
        </div>

        <div className="mt-2 rounded-lg border border-[#E3EAF2] bg-[#FAFCFD] p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-[#4F5F73]">Proof of work ({proofCount})</span>
            <button type="button" onClick={() => setAttachOpen((prev) => !prev)} className="text-[10px] text-[#35475C] underline hover:text-[#435B76]">
              {attachOpen ? 'Hide' : 'Attach'}
            </button>
          </div>
          {attachOpen && (
            <form onSubmit={addWork} className="flex flex-col gap-1.5">
              <textarea value={proofText} onChange={(e) => setProofText(e.target.value)} placeholder="Note or link…" rows={1} className="w-full rounded-lg border border-[#CBD5E1] px-2.5 py-1.5 text-[11px] focus:ring-0 focus:border-[#35475C]" />
              <input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://docs.google.com/document/…" className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-2.5 py-1.5 text-[11px] focus:ring-0 focus:border-[#35475C]" />
              <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-2.5 py-1.5 text-xs focus:ring-0 focus:border-[#35475C]" />
              <button type="submit" disabled={actions.busy || (!proofText.trim() && !proofUrl.trim() && !proofFile)} className={btnSecondary}>Submit</button>
            </form>
          )}
          {proofCount > 0 && !attachOpen && (
            <div className="space-y-1 mt-1">
              {(subtask.work_items || []).slice(0, 2).map((item) => (
                <div key={item.id} className="flex items-center gap-1 text-[10px]">
                  <FileText size={10} className="text-[#4A6079]" />
                  <span className="truncate max-w-[140px] text-[#4F5F73]">{item.note || item.url || item.file_name || 'Proof attached'}</span>
                </div>
              ))}
              {proofCount > 2 && <span className="text-[10px] text-[#4F5F73] italic">+{proofCount - 2} more</span>}
            </div>
          )}
        </div>

        {(isLeader || isAssignee) && !compileLocked && subtask.board_status !== 'done' && (
          <button type="button" onClick={() => onEditTask(subtask)} className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#D7DEE6] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Edit task">
            <Edit2 size={12} />
          </button>
        )}
        {!subtask.has_subtasks && (isLeader || isAssignee) && !compileLocked && (
          <button type="button" onClick={() => onAddSubtask(subtask)} className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#D7DEE6] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Add subtask">
            <Plus size={12} />
          </button>
        )}
        {isLeader && !compileLocked && (
          <button type="button" onClick={() => { if (window.confirm('Delete this subtask?')) onDeleteTask(subtask); }} className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#D7DEE6] text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors" title="Delete task">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </article>
  );
};

const TaskRow = ({ task, tasks, members, actions, userId, leaderId, compile, openGroupTasks, onEditTask, onDeleteTask, onAddSubtask }) => {
  const subtasks = task.subtask_ids.map((id) => tasks.find((item) => item.id === id)).filter(Boolean);
  const member = members.find((item) => item.id === task.assigned_to_id);
  const isLeader = userId === leaderId;
  const isAssignee = task.assigned_to_id === userId;
  const canFinish = isAssignee && task.board_status !== 'done' && !task.has_subtasks;
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

  return (
    <article key={task.id} className="rounded-xl border border-[#D7DEE6] bg-white p-3 text-[13px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[#1F2D3D] truncate">{task.title}</h4>
            {!task.parent_task_id && <span className="rounded-full border border-[#E3EAF2] bg-[#EEF1F4] px-2 py-0.5 text-[10px] font-semibold text-[#35475C]">Parent task</span>}
            {isCompile ? <span className="rounded-full border border-[#E3EAF2] bg-[#EEF1F4] px-2 py-0.5 text-[11px] font-semibold text-[#2F4A66]">Final task</span> : null}
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${taskStatusChip(task.board_status)}${((isLeader || isAssignee) && !compileLocked && !task.has_subtasks) ? ' cursor-pointer hover:opacity-80 transition-colors' : ''}`} onClick={(isLeader || isAssignee) && !compileLocked && !task.has_subtasks ? () => {
              actions.setStatus(task, cycleNext(task.board_status));
            } : undefined}>
              {statusLabel}
            </span>
            {task.is_overdue && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">Overdue</span>}
          </div>
          {task.due_date && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[#4F5F73]">
              <CalendarDays size={12} aria-hidden="true" /> {formatDue(task.due_date)}{task.weight ? ` Â· ${weightText(task.weight)}` : ''}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {member ? <Avatar name={member.name} avatar={member.avatar} size={22} className="text-[10px]" /> : <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[#8A97A8] text-[11px] text-[#4F5F73]">?</span>}
          {proofCount > 0 && <FileText size={12} className="text-[#4A6079]" title="Proof attached" />}
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        {task.has_subtasks ? (
          <div className="mt-2 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-[#4F5F73] font-semibold px-2">Subtasks of “{task.title}”</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subtasks.map((subtask) => (
                <SubtaskCard key={subtask.id} subtask={subtask} tasks={tasks} members={members} actions={actions} userId={userId} leaderId={leaderId} compile={compile} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onAddSubtask={onAddSubtask} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {member ? <Avatar name={member.name} avatar={member.avatar} size={20} className="text-[9px]" /> : <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-[#8A97A8] text-[9px] text-[#4F5F73]">?</span>}
              {proofCount > 0 && <FileText size={10} className="text-[#4A6079]" title="Proof attached" />}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canClaim && !compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => claimTask()} className={btnSecondary}>Claim</button>
              ) : null}
              {canFinish && !compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => finishTask()} className={btnPrimary}>Done</button>
              ) : null}
              {!member && canEditCompile && isCompile && compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => openGroupTasks()} className={btnSecondary}>Combine</button>
              ) : null}
              {member && !compileLocked ? (
                <button type="button" disabled={actions.busy} onClick={() => reassignTask(member.id)} className={btnSecondary}>Reassign</button>
              ) : null}
              {(isLeader || isAssignee) && !compileLocked && task.board_status !== 'done' ? (
                <button type="button" onClick={() => onEditTask(task)} className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#D7DEE6] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Edit task">
                  <Edit2 size={12} />
                </button>
              ) : null}
              {!task.has_subtasks && (isLeader || isAssignee) && !compileLocked ? (
                <button type="button" onClick={() => onAddSubtask(task)} className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#D7DEE6] text-[#35475C] hover:bg-[#EEF1F4] transition-colors" title="Add subtask">
                  <Plus size={12} />
                </button>
              ) : null}
              {isLeader && !compileLocked ? (
                <button type="button" onClick={() => { if (window.confirm('Delete this task?')) onDeleteTask(task); }} className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#D7DEE6] text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors" title="Delete task">
                  <Trash2 size={12} />
                </button>
              ) : null}
              {compileLocked && <span className="shrink-0 rounded-full border border-[#E3EAF2] bg-[#EEF1F4] px-2 py-0.5 text-[9px] font-semibold text-[#2F4A66]">Locked</span>}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

const TaskGroup = ({ title, tasks, members, actions, userId, leaderId, compile, openGroupTasks, collapsible, onEditTask, onDeleteTask, onAddSubtask }) => {
  const [open, setOpen] = useState(true);
  const headerLabel = collapsible ? (open ? <ChevronUp size={14} className="mr-1 text-[#4F5F73]" /> : <ChevronDown size={14} className="mr-1 text-[#4F5F73]" />) : null;
  return (
    <section className="space-y-3" aria-label={title}>
      <button
        type="button"
        onClick={collapsible ? () => setOpen((previous) => !previous) : undefined}
        aria-expanded={!collapsible || open}
        className="flex items-center justify-between gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-left hover:bg-[#EEF1F4]"
      >
        <span className="flex items-center gap-1 shrink-0 font-semibold text-[#1F2D3D]">{headerLabel}{title}</span>
        <span className="shrink-0 text-[12px] font-semibold text-[#4F5F73]">{tasks.length}</span>
      </button>
      {(!collapsible || open) && (
        <div className="space-y-2">
          {tasks.map((task) => <TaskRow key={task.id} task={task} tasks={tasks} members={members} actions={actions} userId={userId} leaderId={leaderId} compile={compile} openGroupTasks={openGroupTasks} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onAddSubtask={onAddSubtask} />)}
        </div>
      )}
    </section>
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
      if (task.assigned_to_id) {
        const entry = map.get(task.assigned_to_id);
        if (entry) entry.items.push(task);
      }
    });
    return Array.from(map.values()).filter((entry) => entry.items.length > 0);
  }, [tasks, members]);
  const groupedByStatus = useMemo(() => statuses.map((status) => ({ status, items: tasks.filter((task) => toDisplayStatus(task.board_status) === status) })), [tasks]);

  const taskGroups = useMemo(() => {
    if (groupBy === 'task') return groupedByTask.map((group) => ({ title: group.task.title, tasks: group.items, sectionId: group.task.id }));
    if (groupBy === 'person') return groupedByPerson.map((group) => ({ title: group.member.name, tasks: group.items, sectionId: `person-${group.member.id}`, avatar: group.member.avatar }));
    return groupedByStatus.map((group) => ({ title: group.status.charAt(0).toUpperCase() + group.status.slice(1), tasks: group.items, sectionId: `status-${group.status}` }));
  }, [groupBy, groupedByTask, groupedByPerson, groupedByStatus]);

  const openCombine = useCallback(() => {
    actions.setStatus(tasks.find((task) => task.is_compile_task), 'completed', { override_reason: '' });
  }, [actions, tasks]);

  const project = projects?.[0] || workspace.project || {};
  const overallProgress = workspace.project_progress ?? 0;
  const openToClaim = tasks.filter((task) => task.board_status === 'open_to_claim' && !task.has_subtasks && task.section);

  const taskCardForOpen = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : null;

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-[#D7DEE6] bg-white p-4">
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
              <span className="hidden sm:inline">Â· {members.length || workspace.group?.members_count || 0} members</span>
            </div>
          </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={actions.busy} onClick={onCreateTask} className={btnSecondary}>Create Task</button>
              <button type="button" disabled={actions.busy} onClick={() => actions.setStatus(tasks.find((task) => task.is_compile_task), 'completed')} className={btnPrimary}>Ready to submit</button>
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
            <button type="button" disabled={actions.busy} onClick={openCombine} className="mt-2.5 rounded-lg bg-[#35475C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#4A6079] disabled:opacity-50">Override and start combine</button>
          )}
        </section>
      )}
      {compile.ready_to_combine && !compile.is_locked && (
        <section className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] p-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#2F4A66]" aria-hidden="true" />
            <p className="text-sm text-[#2F4A66]">Ready to combine â€” all tasks complete.</p>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[#D7DEE6] bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-bold text-[#1F2D3D]">Plan view</h3>
          <div className="flex gap-1 rounded-lg border border-[#D7DEE6]">
            {[['task', 'task'], ['person', 'person'], ['status', 'status']].map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={groupBy === value} onClick={() => setGroupBy(value)} className={`h-8 px-3 text-xs font-medium transition ${groupBy === value ? 'bg-[#35475C] text-white' : 'text-[#33445A] hover:bg-[#EEF1F4]'}`}>{groupLabels[value]}</button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <section aria-labelledby="open-to-claim">
            <h4 className="text-sm font-semibold text-[#1F2D3D] mb-2">Open to claim</h4>
            {openToClaim.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {openToClaim.map((task) => {
                  const member = members.find((item) => item.id === task.assigned_to_id);
                  return (
                    <article key={task.id} className="rounded-lg border border-[#D7DEE6] bg-white p-2.5 text-[12px]">
                      <h5 className="font-medium text-[#1F2D3D] truncate">{task.title}</h5>
                      <div className="mt-1 flex items-center gap-1 text-xs text-[#4F5F73]">
                        {task.due_date && <span>{formatDue(task.due_date)}</span>}
                        {task.weight ? <span>Â· {weightText(task.weight)}</span> : ''}
                      </div>
                      <button type="button" disabled={actions.busy} onClick={() => actions.claim(task, false)} className="mt-2 rounded-lg bg-[#35475C] w-full px-3 py-1.5 text-xs font-bold text-white hover:bg-[#4A6079] disabled:opacity-50">Claim</button>
                    </article>
                  );
                })}
              </div>
            ) : <p className="text-sm text-[#4F5F73]">No unclaimed subtasks right now.</p>}
          </section>

          <section className="space-y-2" aria-labelledby="tasks">
            <h4 className="text-sm font-semibold text-[#1F2D3D] mb-2">Tasks</h4>
            {taskGroups.length ? (
              taskGroups.map((group) => (
                <TaskGroup key={group.sectionId} title={group.title} tasks={group.tasks} members={members} actions={actions} userId={userId} leaderId={leaderId} compile={compile} openGroupTasks={reload} collapsible={groupBy === 'task'} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onAddSubtask={onAddSubtask} />
              ))
            ) : (
              <p className="text-sm text-[#4F5F73]">No tasks yet. Add one to start the plan.</p>
            )}
          </section>
        </div>
      </section>

      {balance && (
        <section className="rounded-xl border border-[#D7DEE6] bg-white p-4">
          <h3 className="text-sm font-bold text-[#1F2D3D] mb-3">Workload balance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-lg border border-[#E3EAF2] bg-white p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2"><Avatar name={member.name} avatar={member.avatar} size={22} className="text-[10px]" /><span className="font-medium text-[#1F2D3D] truncate">{member.name}</span></div>
                  {member.is_leader && <span className="rounded bg-[#E3EAF2] px-1.5 py-0.5 text-[10px] font-bold text-[#2F4A66]">Leader</span>}
                </div>
                <ProgressBar value={Math.min(100, member.share_percent || 0)} label={`${member.name} share`} />
                <p className="mt-1 text-xs text-[#4F5F73]">{member.points_assigned || 0} pts Â· {(member.share_percent || 0).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

export default TasksTab;

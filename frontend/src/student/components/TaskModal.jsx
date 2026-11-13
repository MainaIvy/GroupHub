import React from 'react';
import { safeArray, pluralize } from '../utils';

const TaskModal = ({ ctx }) => {
  const { selectedTaskGroup, taskWorkspace, taskWorkspaceError, taskModalOpen, setTaskModalOpen, taskModalMode, parentTaskId, editingTask, taskForm, setTaskForm, taskBalanceWarning, setTaskBalanceWarning, taskProjectedBalance, setTaskProjectedBalance, taskProjectionLoading, taskBalanceConfirmed, setTaskBalanceConfirmed, taskOverrideReason, setTaskOverrideReason, taskBusy, taskPreviewWarning, taskTooEarlyToJudge, handleTaskSubmit } = ctx;

  if (!taskModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 shadow-2xl dark:border-stone-700 dark:bg-stone-900">
        <button
          type="button"
          onClick={() => setTaskModalOpen(false)}
          aria-label="Close task dialog"
          className="absolute right-4 top-4 rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          ✕
        </button>
        <h2 className="pr-10 text-base font-black text-[#1C1C1E] dark:text-stone-100">
          {taskModalMode === 'create' ? (parentTaskId ? 'Create micro-task' : 'Create project task') : 'Reassign task'}
        </h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          {parentTaskId
            ? `Under ${taskWorkspace?.tasks?.find((task) => task.id === parentTaskId)?.title || 'parent task'} · ${selectedTaskGroup?.name}`
            : selectedTaskGroup?.name}
        </p>

        <form onSubmit={handleTaskSubmit} className="mt-5 space-y-4">
          {taskModalMode === 'create' ? (
            <>
              <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                Task title
                <input
                  required
                  maxLength={200}
                  value={taskForm.title}
                  onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                />
              </label>
              <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                Project
                {safeArray(taskWorkspace?.group?.projects).length ? (
                  <select required disabled={Boolean(parentTaskId)} value={taskForm.projectId} onChange={(event) => setTaskForm((current) => ({ ...current, projectId: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] disabled:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100">
                    <option value="">Select a project</option>
                    {taskWorkspace.group.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                  </select>
                ) : <span className="mt-1.5 block rounded-lg bg-stone-50 px-3 py-2.5 text-sm font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">Group project (created automatically)</span>}
              </label>
              <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                Instructions
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                  className="mt-1.5 w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                />
              </label>
              <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                Due date
                <input
                  type="date"
                  required
                  value={taskForm.dueDate}
                  onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                />
              </label>
            </>
          ) : (
            <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-sm font-bold text-[#1C1C1E] dark:bg-stone-800 dark:text-stone-100">
              {editingTask?.title}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
            <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
              Assignee
              <select
                required
                value={taskForm.assignedToId}
                onChange={(event) => {
                  setTaskForm((current) => ({ ...current, assignedToId: event.target.value }));
                  setTaskBalanceConfirmed(false);
                  setTaskBalanceWarning('');
                  setTaskProjectedBalance(null);
                }}
                className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
              >
                {safeArray(taskWorkspace?.members).map((member) => (
                  <option key={member.id} value={member.id} disabled={taskModalMode === 'reassign' && String(member.id) === String(editingTask?.assigned_to_id)}>{member.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
              Weight (1–5)
              <select
                value={taskForm.weight}
                disabled={taskModalMode === 'reassign'}
                onChange={(event) => {
                  setTaskForm((current) => ({ ...current, weight: Number(event.target.value) }));
                  setTaskBalanceConfirmed(false);
                  setTaskBalanceWarning('');
                  setTaskProjectedBalance(null);
                }}
                className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] disabled:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:disabled:bg-stone-700"
              >
                {[1, 2, 3, 4, 5].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
              </select>
            </label>
          </div>

          {(taskBalanceWarning || taskPreviewWarning) ? (
            <div className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] p-3 text-xs text-[#35475C]" role="status">
              <p className="font-bold">{taskProjectedBalance?.level === 'critical' ? 'Critical workload warning' : 'Workload balance warning'}</p>
              <p className="mt-1">{taskProjectedBalance?.suggestion || taskBalanceWarning || taskPreviewWarning}</p>
              {taskProjectedBalance && <p className="mt-1 text-[10px]">Projected group total: {pluralize(taskProjectedBalance.total_points, 'point')}</p>}
              <label className="mt-3 flex items-start gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={taskBalanceConfirmed}
                  onChange={(event) => setTaskBalanceConfirmed(event.target.checked)}
                  className="mt-0.5 accent-[#35475C]"
                />
                <span>I understand the imbalance and want to continue.</span>
              </label>
              <label className="mt-3 block font-semibold">
                Reason (optional)
                <textarea
                  rows={2}
                  value={taskOverrideReason}
                  onChange={(event) => setTaskOverrideReason(event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#D7DEE6] bg-white px-2.5 py-2 text-xs text-[#1F2D3D] dark:border-[#35475C] dark:bg-[#35475C] dark:text-white"
                />
              </label>
            </div>
          ) : null}
          {taskTooEarlyToJudge && <p role="status" className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-600">Too early to judge: the projected group total is below 6 points.</p>}

          {taskWorkspaceError ? <p role="alert" className="text-xs font-semibold text-red-600">{taskWorkspaceError}</p> : null}
          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4 dark:border-stone-700">
            <button type="button" onClick={() => setTaskModalOpen(false)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800">Cancel</button>
            <button type="submit" disabled={taskBusy || taskProjectionLoading || (taskModalMode === 'create' && (!taskForm.title.trim() || !taskForm.dueDate || (safeArray(taskWorkspace?.group?.projects).length > 0 && !taskForm.projectId))) || !taskForm.assignedToId || (taskModalMode === 'reassign' && String(taskForm.assignedToId) === String(editingTask?.assigned_to_id))} className="rounded-lg bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900">
              {taskBusy ? 'Saving…' : taskModalMode === 'create' ? 'Create task' : 'Save assignee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;

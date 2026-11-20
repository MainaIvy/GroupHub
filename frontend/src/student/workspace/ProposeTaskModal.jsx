import React, { useState } from 'react';
import { btnPrimary, btnSecondary } from '../design';
import { WEIGHT_SCALE } from '../../taskWeights';

const field = 'mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[15px] text-[#1F2D3D]';

// Proposes a task or subtask. The leader approves it afterwards.
const ProposeTaskModal = ({ parent, task, projects, busy, error, onSubmit, onClose }) => {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    weight: task?.weight ?? 2,
    dueDate: task?.due_date ? String(task.due_date).slice(0, 10) : '',
    projectId: task?.project_id ? String(task.project_id) : (parent?.project_id ? String(parent.project_id) : (projects?.[0]?.id ? String(projects[0].id) : '')),
  });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const result = await onSubmit({
      task_id: task?.id,
      title: form.title.trim(),
      description: form.description.trim(),
      weight: Number(form.weight),
      due_date: form.dueDate,
      project_id: form.projectId ? Number(form.projectId) : undefined,
      parent_task_id: parent?.id,
    });
    if (result?.ok) onClose();
  };

  const heading = task ? `Edit “${task.title}”` : (parent ? `Add a subtask to “${parent.title}”` : 'Add a task');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2D3D]/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={heading} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-[#1F2D3D]">{heading}</h3>
        <p className="text-sm text-[#4F5F73]">{parent ? 'Break this task into a concrete piece of work. The leader approves it and sets who does it.' : 'Add a new task to the plan. The leader approves it and it can be split into subtasks.'}</p>
        <label className="block text-sm font-medium text-[#33445A]">Title
          <input required autoFocus maxLength={120} value={form.title} onChange={update('title')} className={field} />
        </label>
        <label className="block text-sm font-medium text-[#33445A]">Description (optional)
          <textarea rows={3} value={form.description} onChange={update('description')} className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-[15px]" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-[#33445A]">Suggested weight
            <select value={form.weight} onChange={update('weight')} className={field}>{WEIGHT_SCALE.map((item) => <option key={item.value} value={item.value}>{item.value} · {item.label}</option>)}</select>
          </label>
          <label className="block text-sm font-medium text-[#33445A]">Due date
            <input required type="date" value={form.dueDate} onChange={update('dueDate')} className={field} />
          </label>
        </div>
        {!parent && projects.length > 1 ? (
          <label className="block text-sm font-medium text-[#33445A]">Project
            <select value={form.projectId} onChange={update('projectId')} className={field}>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
        ) : null}
        {error ? <p role="alert" className="text-sm font-medium text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy || !form.title.trim() || !form.dueDate} className={btnPrimary}>{busy ? 'Saving…' : (task ? 'Save changes' : (parent ? 'Add subtask' : 'Add task'))}</button>
        </div>
      </form>
    </div>
  );
};

export default ProposeTaskModal;

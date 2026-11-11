import React, { useMemo, useState } from 'react';
import { ListTodo, Plus } from 'lucide-react';
import { btnPrimary } from '../../design';
import EmptyState from '../../components/EmptyState';
import TaskCard from '../TaskCard';
import { COLUMNS, columnOf } from '../taskUtils';

const SEGMENT = 'h-10 px-4 text-sm font-semibold first:rounded-l-lg last:rounded-r-lg border border-[#D7DEE6]';

const TasksTab = ({ tasks, userId, selectedTaskId, onSelectTask, onPropose }) => {
  const [scope, setScope] = useState('all');
  const [filter, setFilter] = useState('all');

  const topLevel = useMemo(() => {
    const ids = new Set(tasks.map((task) => task.id));
    return tasks.filter((task) => !task.parent_task_id || !ids.has(task.parent_task_id));
  }, [tasks]);

  const visible = topLevel.filter((task) => {
    if (scope === 'mine' && task.assigned_to_id !== userId) return false;
    if (filter === 'proposed') return task.board_status === 'proposed';
    if (filter === 'open_to_claim') return task.board_status === 'open_to_claim';
    return true;
  });

  if (!tasks.length) {
    return <EmptyState icon={ListTodo} title="No tasks yet" description="Propose the first task. Your group leader approves it and sets who does it." actionLabel="Propose a task" onAction={onPropose} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Task scope" className="inline-flex">
            {[['all', 'All'], ['mine', 'Mine']].map(([key, label]) => <button key={key} type="button" aria-pressed={scope === key} onClick={() => setScope(key)} className={`${SEGMENT} ${scope === key ? 'bg-[#35475C] text-white' : 'bg-white text-[#1F2D3D] hover:bg-[#EEF1F4]'}`}>{label}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#33445A]">Show
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 text-[15px]">
              <option value="all">All tasks</option>
              <option value="proposed">Proposed</option>
              <option value="open_to_claim">Open to claim</option>
            </select>
          </label>
        </div>
        <button type="button" onClick={onPropose} className={btnPrimary}><Plus size={16} aria-hidden="true" /> Propose task</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const items = visible.filter((task) => columnOf(task) === column.key);
          return (
            <section key={column.key} aria-label={column.label} className="rounded-xl bg-[#D9E0E8] p-3">
              <h3 className="mb-3 flex items-center justify-between text-sm font-bold text-[#1F2D3D]"><span>{column.label}</span><span className="rounded-full bg-white px-2 py-0.5 text-[13px] text-[#33445A]">{items.length}</span></h3>
              <div className="space-y-3">
                {items.map((task) => <TaskCard key={task.id} task={task} tasks={tasks} selected={selectedTaskId === task.id} onOpen={() => onSelectTask(task.id)} />)}
                {!items.length ? <p className="rounded-lg border border-dashed border-[#8A97A8] px-3 py-6 text-center text-sm text-[#4F5F73]">Nothing here.</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default TasksTab;

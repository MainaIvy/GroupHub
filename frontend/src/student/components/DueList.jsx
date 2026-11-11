import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import EmptyState from './EmptyState';
import { pluralize } from '../utils';

const DueList = ({ tasks, onOpenTask, onViewAll }) => (
  <section aria-labelledby="due-title" className="rounded-xl border border-[#D7DEE6] bg-white p-4">
    <h2 id="due-title" className="text-base font-bold text-[#1F2D3D]">Due this week</h2>
    {tasks.length ? (
      <ul className="mt-2 divide-y divide-[#EEF1F4]">
        {tasks.map((task) => (
          <li key={task.id}>
            <button type="button" onClick={() => onOpenTask(task)} className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-[#F4F7FA]">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#1F2D3D]">{task.title}</span>
                <span className="block text-sm text-[#4F5F73]">{task.group_name} · {pluralize(task.weight || 1, 'point')}</span>
              </span>
              <span className="shrink-0 text-sm font-medium text-[#33445A]">{new Date(task.due_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <div className="mt-2"><EmptyState icon={CheckCircle2} title="Nothing due this week" description="Tasks assigned to you with a deadline in the next 7 days show up here." actionLabel="View my tasks" onAction={onViewAll} /></div>
    )}
  </section>
);

export default DueList;

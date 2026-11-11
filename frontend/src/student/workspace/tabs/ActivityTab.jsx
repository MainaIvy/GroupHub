import React, { useMemo } from 'react';
import { History } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { timeAgo } from '../../utils';
import { describeActivity } from '../taskUtils';

const ActivityTab = ({ activity, comments, onGoTasks }) => {
  const timeline = useMemo(() => [
    ...activity.map((item) => ({ key: `a-${item.id}`, at: item.created_at, title: describeActivity(item), note: item.note, kind: 'Task update' })),
    ...comments.map((item) => ({ key: `c-${item.id}`, at: item.created_at, title: `${item.author_name}${item.author_type === 'lecturer' ? ' (lecturer)' : ''} commented on “${item.task_title}”`, note: item.content, kind: item.author_type === 'lecturer' ? 'Lecturer comment' : 'Comment' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)), [activity, comments]);

  if (!timeline.length) return <EmptyState icon={History} title="No activity yet" description="Task changes and comments will appear here as your group works." actionLabel="Go to tasks" onAction={onGoTasks} />;

  return (
    <section className="rounded-xl border border-[#D7DEE6] bg-white p-4" aria-label="Activity timeline">
      <ol className="space-y-4 border-l-2 border-[#D7DEE6] pl-4">
        {timeline.map((item) => (
          <li key={item.key} className="relative">
            <span aria-hidden="true" className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full bg-[#4A6079] ring-2 ring-white" />
            <p className="text-[15px] font-medium text-[#1F2D3D]">{item.title}</p>
            {item.note ? <p className="mt-0.5 whitespace-pre-wrap text-sm text-[#33445A]">{item.note}</p> : null}
            <p className="mt-0.5 text-[13px] text-[#4F5F73]">{item.kind} · {timeAgo(item.at)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default ActivityTab;

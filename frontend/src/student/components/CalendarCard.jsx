import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const CalendarCard = ({ tasks = [] }) => {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [selected, setSelected] = useState(() => dayjs().format('YYYY-MM-DD'));

  const days = useMemo(() => {
    const start = month.startOf('month');
    const end = month.endOf('month');
    const offset = (start.day() + 6) % 7;
    const first = start.subtract(offset, 'day');
    const lastDay = end.day() === 0 ? 6 : end.day() - 1;
    const last = end.add(6 - lastDay, 'day');
    const totalDays = last.diff(first, 'day') + 1;
    return Array.from({ length: totalDays }, (_, i) => first.add(i, 'day'));
  }, [month]);

  const today = dayjs().format('YYYY-MM-DD');
  const tasksByDay = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if (!task.due_date) return;
      const k = dayjs(task.due_date).format('YYYY-MM-DD');
      map.set(k, [...(map.get(k) || []), task]);
    });
    return map;
  }, [tasks]);

  const sortedTasks = [...(tasksByDay.get(selected) || [])].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#D7DEE6] bg-white p-3 shadow-sm" style={{ maxWidth: '360px' }}>
      <div className="flex items-center justify-between gap-2 border-b border-[#EEF1F4] pb-2">
        <button
          type="button"
          onClick={() => setMonth(month.subtract(1, 'month'))}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D7DEE6] bg-white text-[#35475C] hover:bg-[#EEF1F4]"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#E8F3FB] px-2 py-1.5 text-xs font-bold text-[#35475C] whitespace-nowrap">
          <CalendarDays size={14} aria-hidden="true" />
          {month.format('MMMM YYYY')}
        </span>
        <button
          type="button"
          onClick={() => setMonth(month.add(1, 'month'))}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D7DEE6] bg-white text-[#35475C] hover:bg-[#EEF1F4]"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="flex h-5 items-center justify-center rounded-md bg-[#E2E8F0] px-1 text-[10px] font-semibold text-[#4A6079] uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const k = day.format('YYYY-MM-DD');
            const inMonth = day.month() === month.month();
            const isSelected = k === selected;
            const isToday = k === today;
            const cellTasks = (tasksByDay.get(k) || []).length > 0;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-label={day.format('D MMMM YYYY')}
                className={`flex min-h-9 flex-col items-center justify-center gap-0.5 rounded-lg border p-0.5 text-left transition-colors hover:border-[#7189A3] hover:bg-[#F4F7FA] ${isSelected ? 'border-[#35475C] bg-[#E8F3FB] shadow-sm' : cellTasks ? 'border-amber-300 bg-amber-50/40' : 'border-transparent bg-transparent'} ${!inMonth ? 'opacity-40' : ''} ${isToday ? 'ring-2 ring-[#7189A3]' : ''}`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? 'bg-[#35475C] text-white' : isSelected ? 'bg-white text-[#35475C]' : 'text-[#1F2D33]'}`}>
                  {day.date()}
                </span>
                {cellTasks && <span className="h-1 w-1 rounded-full bg-amber-500" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg bg-[#F8FAFC] p-2">
        <p className="text-xs font-semibold text-[#1F2D3D]">{dayjs(selected).format('D MMMM')}</p>
        {sortedTasks.length === 0 ? (
          <p className="mt-1 text-xs text-[#4A6079]">Nothing due on this day.</p>
        ) : (
          <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto">
            {sortedTasks.map((task) => (
              <li key={task.id} className="truncate text-xs text-[#33445A]">
                <span className="font-medium text-[#1F2D3D]">{task.title}</span>
                <span className="text-[#4F5F73]"> · {task.group_name || 'Group'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/student/tasks')}
        className="flex h-8 w-full items-center justify-center rounded-lg bg-[#1F2D33] px-3 text-xs font-semibold text-white hover:bg-[#2C3A52]"
      >
        View all tasks
      </button>
    </section>
  );
};

export default CalendarCard;

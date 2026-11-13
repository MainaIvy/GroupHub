import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { CalendarDays, ChevronLeft, ChevronRight, User } from 'lucide-react';
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
  const selectedDay = days.find((d) => d.format('YYYY-MM-DD') === selected);

  const tasksByDay = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if (!task.due_date) return;
      const k = dayjs(task.due_date).format('YYYY-MM-DD');
      map.set(k, [...(map.get(k) || []), task]);
    });
    return map;
  }, [tasks]);

  const dayTasks = tasksByDay.get(selected) || [];
  const sortedTasks = [...dayTasks].sort((a, b) => {
    const ta = a.due_time || a.due_at || a.due_date;
    const tb = b.due_time || b.due_at || b.due_date;
    return new Date(ta) - new Date(tb);
  });

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-[#D7DEE6] bg-white p-4 shadow-sm" style={{ maxWidth: '380px' }}>
      {/* Month header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#EEF1F4] pb-3">
        <button
          type="button"
          onClick={() => setMonth(month.subtract(1, 'month'))}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D7DEE6] bg-white text-[#35475C] hover:bg-[#EEF1F4] transition-colors"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#E8F3FB] px-3 py-2 text-sm font-bold text-[#35475C] whitespace-nowrap">
          <CalendarDays size={15} aria-hidden="true" />
          {month.format('MMMM YYYY')}
        </span>
        <button
          type="button"
          onClick={() => setMonth(month.add(1, 'month'))}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D7DEE6] bg-white text-[#35475C] hover:bg-[#EEF1F4] transition-colors"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="px-2 pb-1">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="flex h-6 items-center justify-center rounded-md bg-[#E2E8F0] px-1 text-[10px] font-semibold text-[#4A6079] uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const k = day.format('YYYY-MM-DD');
            const inMonth = day.month() === month.month();
            const isSelected = k === selected;
            const dayTasksList = tasksByDay.get(k) || [];
            const isToday = k === today;
            const cellTasks = dayTasksList.length > 0;

            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-label={day.format('D MMMM YYYY')}
                className={`flex min-h-11 flex-col items-center gap-1 rounded-lg border p-1 text-left transition-colors hover:border-[#7189A3] hover:bg-[#F4F7FA] ${isSelected ? 'border-[#35475C] bg-[#E8F3FB] shadow-sm' : cellTasks ? 'border-amber-300 bg-amber-50/40' : 'border-transparent bg-transparent'} ${!inMonth ? 'opacity-40' : ''} ${isToday ? 'ring-2 ring-[#7189A3]' : ''}`}
              >
                <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${isToday ? 'bg-[#35475C] text-white' : isSelected ? 'bg-white text-[#35475C]' : 'text-[#1F2D33]'}`}>
                  {day.date()}
                </span>
                {cellTasks && (
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date heading */}
      <div className="px-2">
        <h2 className="text-[20px] font-bold text-[#1F2D33]">
          {selectedDay ? selectedDay.format('D MMMM') : selected}
        </h2>
      </div>

      {/* Filter row */}
      <div className="px-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#1F2D33]">
          <span>Time</span>
          <span className="px-1.5 text-[#4A6079]">Today's timeline</span>
        </div>
        <button type="button" className="flex h-6 items-center gap-1.5 rounded-full border border-[#D7DEE6] bg-[#1F2D33] px-2 py-0.5 text-[10px] font-semibold text-white">
          All
        </button>
      </div>

      {/* Timeline / task list */}
      <div className="px-2 flex flex-col gap-2 min-h-[200px]">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-4 text-sm text-[#4A6079]">
            Nothing due on this day.
          </div>
        ) : (
          <div className="relative rounded-lg bg-[#F8FAFC] p-3">
            {sortedTasks.map((task) => {
              const isPast = taskIsOverdue(task);
              return (
                <div
                  key={task.id}
                  className={`relative ml-4 mb-2 pl-3 border-l-2 border-[#CBD5E1] transition-colors ${isPast ? 'border-[#DDE4EC] opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center border border-[#D7DEE6] bg-white text-xs font-bold text-[#4A6079]">
                      <User size={14} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isPast ? 'opacity-50' : 'opacity-100'}`}>{task.title}</p>
                      <p className="text-[10px] text-[#4A6079]">{task.group_name || 'Group'}</p>
                      <p className={`text-[10px] mt-0.5 ${isPast ? 'text-[#4A6079] opacity-50' : 'text-[#1F2D33]'}`}>
                        Due {dayjs(task.due_date).format('DD MMMM')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View all tasks */}
      <div className="px-2">
        <button
          type="button"
          onClick={() => navigate('/student/tasks')}
          className="flex w-full h-10 items-center justify-center rounded-full bg-[#1F2D33] px-4 text-sm font-semibold text-white hover:bg-[#2C3A52] transition-colors"
        >
          View all tasks
        </button>
      </div>
    </section>
  );
};

function taskIsOverdue(task) {
  if (!task.due_date) return false;
  return new Date(task.due_date).getTime() < Date.now();
}

export default CalendarCard;

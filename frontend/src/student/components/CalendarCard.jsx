import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { btnPrimary, btnSecondary } from '../design';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KINDS = {
  deadline: { label: 'My deadline', chip: 'bg-[#E3EAF2] text-[#2F4A66]' },
  mark: { label: 'Marked date', chip: 'bg-amber-50 text-amber-800' },
};
const MAX_CHIPS = 2;

const storageKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return `grouphub_calendar_events_${user?.id || user?.email || 'me'}`;
  } catch {
    return 'grouphub_calendar_events_me';
  }
};

const loadEvents = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const CalendarCard = ({ tasks = [] }) => {
  const key = useMemo(storageKey, []);
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [selected, setSelected] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [events, setEvents] = useState(() => loadEvents(key));
  const [form, setForm] = useState(null);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(events));
  }, [events, key]);

  const itemsByDay = useMemo(() => {
    const map = new Map();
    const push = (day, item) => map.set(day, [...(map.get(day) || []), item]);
    tasks.forEach((task) => {
      if (!task.due_date) return;
      push(dayjs(task.due_date).format('YYYY-MM-DD'), {
        id: `task-${task.id}`,
        title: task.title,
        meta: `${task.group_name || 'Group'} · group task`,
        kind: 'task',
        overdue: Boolean(task.isOverdue || task.is_overdue),
      });
    });
    events.forEach((event) => push(event.date, { ...event, meta: event.note || KINDS[event.kind]?.label, personal: true }));
    return map;
  }, [tasks, events]);

  const days = useMemo(() => {
    const start = month.startOf('month');
    const offset = (start.day() + 6) % 7;
    const first = start.subtract(offset, 'day');
    return Array.from({ length: 42 }, (_, i) => first.add(i, 'day'));
  }, [month]);

  const today = dayjs().format('YYYY-MM-DD');
  const selectedItems = itemsByDay.get(selected) || [];

  const chipClass = (item) => {
    if (item.kind === 'task') return item.overdue ? 'bg-red-50 text-red-700' : 'bg-[#E3EAF2] text-[#2F4A66]';
    return KINDS[item.kind]?.chip || KINDS.deadline.chip;
  };

  const openForm = (date) => setForm({ title: '', date: date || selected, kind: 'deadline', note: '' });

  const saveForm = (event) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title || !form.date) return;
    setEvents((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, date: form.date, kind: form.kind, note: form.note.trim() }]);
    setSelected(form.date);
    setMonth(dayjs(form.date).startOf('month'));
    setForm(null);
  };

  const removeEvent = (id) => setEvents((prev) => prev.filter((event) => event.id !== id));

  return (
    <section aria-label="Calendar" className="rounded-xl border border-[#D7DEE6] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(month.subtract(1, 'month'))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D7DEE6] hover:bg-[#EEF1F4]"><ChevronLeft size={18} aria-hidden="true" /></button>
          <h2 className="min-w-[9rem] text-center text-lg font-bold text-[#1F2D3D]">{month.format('MMMM YYYY')}</h2>
          <button type="button" aria-label="Next month" onClick={() => setMonth(month.add(1, 'month'))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D7DEE6] hover:bg-[#EEF1F4]"><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <button type="button" onClick={() => openForm()} className={btnPrimary}><Plus size={16} aria-hidden="true" /> Add deadline or mark a date</button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => <div key={d} className="pb-1 text-center text-[13px] font-semibold uppercase text-[#4F5F73]">{d}</div>)}
        {days.map((day) => {
          const k = day.format('YYYY-MM-DD');
          const items = itemsByDay.get(k) || [];
          const inMonth = day.month() === month.month();
          const isSelected = k === selected;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              onDoubleClick={() => openForm(k)}
              aria-label={`${day.format('D MMMM YYYY')}, ${items.length} items`}
              aria-pressed={isSelected}
              className={`flex min-h-[92px] flex-col items-stretch rounded-lg border p-1.5 text-left transition-colors ${isSelected ? 'border-[#4A6079] bg-[#EEF3F8]' : 'border-[#E3EAF2] bg-white hover:bg-[#F6F8FB]'} ${inMonth ? '' : 'opacity-50'}`}
            >
              <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center self-end rounded-full text-[13px] font-semibold ${k === today ? 'bg-[#35475C] text-white' : 'text-[#33445A]'}`}>{day.date()}</span>
              <span className="flex flex-col gap-1">
                {items.slice(0, MAX_CHIPS).map((item) => (
                  <span key={item.id} className={`truncate rounded px-1.5 py-0.5 text-[13px] font-medium leading-tight ${chipClass(item)}`}>{item.title}</span>
                ))}
                {items.length > MAX_CHIPS ? <span className="px-1 text-[13px] font-medium text-[#4F5F73]">+{items.length - MAX_CHIPS} more</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-[#4F5F73]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#4A6079]" />Group task / my deadline</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Marked date</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" />Overdue</span>
      </div>

      <div className="mt-4 border-t border-[#D7DEE6] pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[#1F2D3D]">{dayjs(selected).format('dddd, D MMMM')}</h3>
          <button type="button" onClick={() => openForm(selected)} className="text-sm font-semibold text-[#35475C] underline">Add for this day</button>
        </div>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-[#4F5F73]">Nothing on this day. Add a deadline or mark the date.</p>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((item) => (
              <li key={item.id} className={`flex items-start justify-between gap-3 rounded-lg px-4 py-2 ${item.overdue ? 'bg-red-50 text-red-800' : 'bg-[#EEF1F4] text-[#33445A]'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-[13px]">{item.meta}</p>
                </div>
                {item.personal ? (
                  <button type="button" aria-label={`Delete ${item.title}`} onClick={() => removeEvent(item.id)} className="rounded p-1 text-[#4F5F73] hover:bg-white hover:text-red-700"><Trash2 size={16} aria-hidden="true" /></button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add to calendar" onMouseDown={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <form onSubmit={saveForm} className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1F2D3D]">Add to my calendar</h3>
              <button type="button" aria-label="Close" onClick={() => setForm(null)} className="rounded p-1 hover:bg-[#EEF1F4]"><X size={18} aria-hidden="true" /></button>
            </div>
            <label className="block text-sm font-medium text-[#33445A]">Title
              <input autoFocus required maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Assignment 2 due" className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-[15px]" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-[#33445A]">Date
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-[15px]" />
              </label>
              <label className="block text-sm font-medium text-[#33445A]">Type
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-[15px]">
                  <option value="deadline">My deadline</option>
                  <option value="mark">Marked date</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium text-[#33445A]">Note (optional)
              <textarea rows={2} maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-[15px]" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className={btnSecondary}>Cancel</button>
              <button type="submit" className={btnPrimary}>Save</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default CalendarCard;

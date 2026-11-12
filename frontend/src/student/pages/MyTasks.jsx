import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, List, Filter, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, CalendarDays } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import { safeArray, startOfDay } from '../utils';
import { formatDue } from '../workspace/taskUtils';

const MyTasks = ({ ctx }) => {
  const { 
    groups, 
    setActiveTab, 
    insights, 
    handleTaskStatusChange 
  } = ctx;

  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'in_progress', 'completed'

  // Get all tasks from insights.mine (already filtered to user's tasks)
  const allTasks = useMemo(() => safeArray(insights?.mine), [insights?.mine]);

  // Filter tasks by group and status
  const filteredTasks = useMemo(() => {
    let tasks = allTasks;
    if (selectedGroupId) {
      tasks = tasks.filter(task => String(task.group_id) === String(selectedGroupId));
    }
    if (statusFilter !== 'all') {
      tasks = tasks.filter(task => task.status === statusFilter);
    }
    return tasks;
  }, [allTasks, selectedGroupId, statusFilter]);

  // Group tasks by due date category
  const groupedTasks = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now).getTime();
    const weekEnd = today + 7 * 24 * 60 * 60 * 1000;

    const overdue = [];
    const todayTasks = [];
    const thisWeek = [];
    const later = [];
    const noDueDate = [];

    for (const task of filteredTasks) {
      if (!task.due_date) {
        noDueDate.push(task);
        continue;
      }
      const due = startOfDay(new Date(task.due_date)).getTime();
      const status = String(task.status || '').toLowerCase();
      
      if (status === 'completed') continue; // Skip completed in grouped view
      
      if (due < today) {
        overdue.push(task);
      } else if (due === today) {
        todayTasks.push(task);
      } else if (due <= weekEnd) {
        thisWeek.push(task);
      } else {
        later.push(task);
      }
    }

    // Sort each group by due date
    const sortByDue = (a, b) => new Date(a.due_date) - new Date(b.due_date);
    return {
      overdue: overdue.sort(sortByDue),
      today: todayTasks.sort(sortByDue),
      thisWeek: thisWeek.sort(sortByDue),
      later: later.sort(sortByDue),
      noDueDate: noDueDate.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  }, [filteredTasks]);

  const totalTasks = filteredTasks.length;
  const completedCount = filteredTasks.filter(t => String(t.status).toLowerCase() === 'completed').length;
  const pendingCount = filteredTasks.filter(t => String(t.status).toLowerCase() === 'pending').length;
  const inProgressCount = filteredTasks.filter(t => String(t.status).toLowerCase() === 'in_progress').length;

  const groupsWithTasks = useMemo(() => {
    const groupIds = new Set(allTasks.map(t => t.group_id).filter(Boolean));
    return groups.filter(g => groupIds.has(g.id));
  }, [allTasks, groups]);

  if (!groups.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1F2D3D]">My tasks</h2>
            <p className="mt-1 text-sm text-[#4F5F73]">Tasks assigned to you across all groups.</p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-[#D7DEE6] bg-white p-8 text-center">
          <p className="text-sm font-medium text-[#35475C]">No groups yet</p>
          <p className="mt-1 text-sm text-[#4F5F73]">Join a group to see your tasks.</p>
          <button type="button" onClick={() => setActiveTab('groups')} className="mt-4 rounded-lg bg-[#35475C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#435B76]">Browse groups</button>
        </div>
      </div>
    );
  }

  const renderTaskCard = (task) => {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && String(task.status).toLowerCase() !== 'completed';
    const status = String(task.status || '').toLowerCase();
    
    return (
      <article key={task.id} className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-md ${isOverdue ? 'border-red-200' : 'border-[#D7DEE6]'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-[#1F2D3D] truncate">{task.title}</h4>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                status === 'in_progress' ? 'bg-[#E3EAF2] text-[#2F4A66]' :
                'bg-[#EEF1F4] text-[#33445A]'
              }`}>
                {status === 'in_progress' ? 'In progress' : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
              {isOverdue && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[12px] font-bold text-red-700">Overdue</span>}
            </div>
            {task.description && <p className="mt-1 text-sm text-[#4F5F73] line-clamp-2">{task.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#4F5F73]">
              <span className="flex items-center gap-1"><span className="font-medium text-[#33445A]">{task.group_name}</span></span>
              <span className="rounded bg-[#EEF1F4] px-2 py-0.5 font-semibold text-[#33445A]">{task.weight} pts</span>
              <span className={`inline-flex items-center gap-1 ${isOverdue ? 'font-semibold text-red-700' : ''}`}>
                <CalendarDays size={14} aria-hidden="true" />{isOverdue ? `Overdue · ${formatDue(task.due_date)}` : task.due_date ? formatDue(task.due_date) : 'No due date'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              aria-label={`Update status for ${task.title}`}
              value={status}
              onChange={(event) => handleTaskStatusChange(task, event.target.value)}
              className="h-9 min-w-[140px] rounded-lg border border-[#D7DEE6] bg-white px-3 text-sm capitalize text-[#1F2D3D] focus:border-[#4A6079] focus:outline-none"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
            <button 
              type="button" 
              onClick={() => navigate(`/student/groups/${task.group_id}?tab=tasks&task=${task.id}`)}
              className="h-9 rounded-lg border border-[#D7DEE6] px-3 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4]"
            >
              Open
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderGroup = (title, tasks, icon, iconColor) => {
    if (!tasks.length) return null;
    return (
      <section className="space-y-3" aria-labelledby={title.toLowerCase()}>
        <h3 id={title.toLowerCase()} className="flex items-center gap-2 text-base font-bold text-[#1F2D3D]">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${iconColor}`}>{icon}</span>
          {title} <span className="rounded-full bg-[#EEF1F4] px-2 py-0.5 text-sm font-semibold text-[#33445A]">{tasks.length}</span>
        </h3>
        <div className="space-y-3">{tasks.map(renderTaskCard)}</div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1F2D3D]">My tasks</h2>
          <p className="mt-1 text-sm text-[#4F5F73]">{totalTasks} tasks across {groupsWithTasks.length} groups · {completedCount} done, {inProgressCount} in progress, {pendingCount} pending</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Group filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#33445A]">Group</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="h-9 min-w-[180px] rounded-lg border border-[#D7DEE6] bg-white px-3 text-sm text-[#1F2D3D] focus:border-[#4A6079] focus:outline-none"
            >
              <option value="">All groups</option>
              {groupsWithTasks.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#33445A]">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 min-w-[150px] rounded-lg border border-[#D7DEE6] bg-white px-3 text-sm text-[#1F2D3D] focus:border-[#4A6079] focus:outline-none"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-[#D7DEE6] bg-white" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={`h-9 px-4 rounded-l-lg text-sm font-semibold ${viewMode === 'list' ? 'bg-[#35475C] text-white' : 'text-[#33445A] hover:bg-[#EEF1F4]'}`}
            >
              <List size={16} className="inline-flex items-center justify-center" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
              className={`h-9 px-4 rounded-r-lg text-sm font-semibold ${viewMode === 'calendar' ? 'bg-[#35475C] text-white' : 'text-[#33445A] hover:bg-[#EEF1F4]'}`}
            >
              <Calendar size={16} className="inline-flex items-center justify-center" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        /* Calendar View */
        <div className="rounded-xl border border-[#D7DEE6] bg-white p-4">
          <CalendarCard tasks={allTasks.filter(t => t.due_date && String(t.status).toLowerCase() !== 'completed')} />
        </div>
      ) : (
        /* List View - Grouped by due date */
        <div className="space-y-6">
          {renderGroup('Overdue', groupedTasks.overdue, <AlertTriangle size={16} aria-hidden="true" />, 'bg-red-50 text-red-700')}
          {renderGroup('Due today', groupedTasks.today, <Clock size={16} aria-hidden="true" />, 'bg-amber-50 text-amber-700')}
          {renderGroup('This week', groupedTasks.thisWeek, <CalendarDays size={16} aria-hidden="true" />, 'bg-[#E3EAF2] text-[#2F4A66]')}
          {renderGroup('Later', groupedTasks.later, <Calendar size={16} aria-hidden="true" />, 'bg-[#EEF1F4] text-[#33445A]')}
          {renderGroup('No due date', groupedTasks.noDueDate, <ChevronDown size={16} aria-hidden="true" />, 'bg-[#F1F5F9] text-[#64748B]')}
          
          {totalTasks > 0 && !groupedTasks.overdue.length && !groupedTasks.today.length && !groupedTasks.thisWeek.length && !groupedTasks.later.length && !groupedTasks.noDueDate.length && (
            <div className="rounded-xl border border-dashed border-[#D7DEE6] bg-white p-8 text-center">
              <p className="text-sm font-medium text-[#35475C]">No tasks match your filters</p>
              <p className="mt-1 text-sm text-[#4F5F73]">Try changing the group or status filter.</p>
            </div>
          )}
          
          {totalTasks === 0 && (
            <div className="rounded-xl border border-dashed border-[#D7DEE6] bg-white p-8 text-center">
              <p className="text-sm font-medium text-[#35475C]">No tasks assigned to you yet</p>
              <p className="mt-1 text-sm text-[#4F5F73]">Tasks will appear here when you're assigned to them.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyTasks;
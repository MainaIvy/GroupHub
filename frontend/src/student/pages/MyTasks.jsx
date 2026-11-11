import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import PollPanel from '../../components/PollPanel';
import { safeArray, pluralize, timeAgo } from '../utils';

const MyTasks = ({ ctx }) => {
  const { groups, setActiveTab, selectedTaskGroup, taskWorkspace, taskBalance, taskWorkspaceLoading, taskWorkspaceError, groupActivity, taskGroupProjects, setProjectModal, activityLoading, groupComments, insights, taskCommentDrafts, setTaskCommentDrafts, taskCommentBusyId, openGroupTasks, openTaskModal, handleTaskCommentSubmit, handleTaskStatusChange, taskTree } = ctx;

  const navigate = useNavigate();

  const renderTaskTree = (task, depth = 0) => (
    <article id={`task-${task.id}`} key={task.id} className="space-y-2">
      <div className={`rounded-lg border bg-white p-3 ${task.is_overdue ? 'border-red-300' : 'border-[#D7DEE6]'} ${depth ? 'ml-4' : ''}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {depth > 0 && <span className="rounded bg-[#E4E9EF] px-1.5 py-0.5 text-[9px] font-semibold text-[#435B76]">MICRO-TASK</span>}
              <h4 className="text-sm font-bold text-[#29384A]">{task.title}</h4>
              <span className="rounded px-2 py-0.5 text-[9px] font-semibold capitalize text-[#435B76] bg-[#EEF1F4]">{String(task.status).replaceAll('_', ' ')}</span>
              {task.is_overdue && <span className="rounded bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">Overdue</span>}
            </div>
            {task.description && <p className="mt-1 text-xs text-[#4F5F73]">{task.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#4F5F73]">
              <span>Owner: {task.assigned_to_name}</span>
              <span>Weight: {task.weight}</span>
              <span className={task.is_overdue ? 'font-bold text-red-700' : ''}>{task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString()}` : 'No due date'}</span>
              {task.completed_at && <span>Completed {new Date(task.completed_at).toLocaleDateString()}</span>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E4E9EF]">
                <div className="h-full rounded-full bg-[#4A6079] transition-all" style={{ width: `${Math.min(100, task.progress_percentage || 0)}%` }} />
              </div>
              <span className="w-9 text-right text-[10px] font-semibold text-[#435B76]">{task.progress_percentage || 0}%</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {task.is_parent && <button type="button" onClick={() => openTaskModal('create', null, task.id)} className="rounded-md border border-[#CBD5E1] px-2.5 py-2 text-[10px] font-semibold text-[#354B63] hover:bg-[#EEF1F4]">+ Micro-task</button>}
            {!task.is_parent && task.can_update_progress && (
              <select
                aria-label={`Update status for ${task.title}`}
                value={task.status}
                onChange={(event) => handleTaskStatusChange(task, event.target.value)}
                className="max-w-36 rounded-md border border-[#D7DEE6] bg-white px-2 py-2 text-[10px] capitalize text-[#354B63]"
              >
                {['pending', 'in_progress', 'completed'].map((status) => <option key={status} value={status}>{status === 'in_progress' ? 'In progress' : status === 'pending' ? 'Pending' : 'Completed'}</option>)}
              </select>
            )}
            {selectedTaskGroup ? <button type="button" onClick={() => navigate(`/student/groups/${selectedTaskGroup.id}?tab=tasks&task=${task.id}`)} className="rounded-md border border-[#CBD5E1] px-2.5 py-2 text-[10px] font-semibold text-[#354B63] hover:bg-[#EEF1F4]">Open in workspace</button> : null}
            {!task.is_parent && <button type="button" onClick={() => openTaskModal('reassign', task)} className="rounded-md border border-[#CBD5E1] px-2.5 py-2 text-[10px] font-semibold text-[#354B63] hover:bg-[#EEF1F4]">Reassign</button>}
          </div>
        </div>
      </div>
      <section className={`rounded-lg bg-white p-3 ${depth ? 'ml-4' : ''}`} aria-label={`Comments on ${task.title}`}>
        {groupComments.filter((comment) => Number(comment.task_id) === Number(task.id)).length ? (
          <ul className="mb-3 space-y-2">
            {groupComments.filter((comment) => Number(comment.task_id) === Number(task.id)).map((comment) => (
              <li key={comment.id} className="border-l-2 border-[#D7DEE6] pl-2.5">
                <p className="whitespace-pre-wrap text-xs text-[#354B63]">{comment.content}</p>
                <p className="mt-0.5 text-[9px] text-[#4F5F73]">{comment.author_name}{comment.author_type === 'lecturer' ? ' · Lecturer' : ''} · {timeAgo(comment.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mb-2 text-[10px] text-[#8895A5]">No comments yet.</p>}
        <form onSubmit={(event) => handleTaskCommentSubmit(event, task)} className="flex items-end gap-2">
          <textarea rows={1} required value={taskCommentDrafts[task.id] || ''} onChange={(event) => setTaskCommentDrafts((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Add a comment…" aria-label={`Add a comment to ${task.title}`} className="min-h-9 flex-1 resize-y rounded-md border border-[#D7DEE6] px-2.5 py-2 text-xs text-[#354B63] outline-none focus:border-[#7189A3]" />
          <button type="submit" disabled={taskCommentBusyId === task.id || !String(taskCommentDrafts[task.id] || '').trim()} className="rounded-md bg-[#35475C] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50">{taskCommentBusyId === task.id ? 'Adding…' : 'Add'}</button>
        </form>
      </section>
      {task.children.length > 0 && <div className="space-y-2 border-l-2 border-[#CBD5E1] pl-2">{task.children.map((child) => renderTaskTree(child, depth + 1))}</div>}
    </article>
  );

  return (
    <div className="space-y-5">
      <CalendarCard tasks={safeArray(insights?.mine).filter((task) => task.status !== 'completed' && task.due_date)} />
      <div className="flex flex-col gap-3 border-b border-stone-200/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-[#1C1C1E] dark:text-stone-100">Group Tasks</h2>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">Weighted assignments and current workload by member.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-stone-300">
          <span>Group</span>
          <select
            value={selectedTaskGroup?.id || ''}
            onChange={(event) => {
              const group = groups.find((item) => String(item.id) === event.target.value);
              if (group) openGroupTasks(group);
            }}
            className="min-w-44 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-[#1C1C1E] dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          >
            <option value="" disabled>Select a group</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        {selectedTaskGroup ? <button type="button" onClick={() => navigate(`/student/groups/${selectedTaskGroup.id}?tab=tasks`)} className="h-10 rounded-lg bg-[#35475C] px-4 text-sm font-semibold text-white hover:bg-[#2B3A4C]">Open full workspace</button> : null}
      </div>

      {!selectedTaskGroup && groups.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => openGroupTasks(group)}
              className="rounded-xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900"
            >
              <span className="text-[10px] font-bold uppercase text-stone-400">{group.course || 'Group'}</span>
              <span className="mt-1 block text-sm font-bold text-[#1C1C1E] dark:text-stone-100">{group.name}</span>
            </button>
          ))}
        </div>
      ) : taskWorkspaceLoading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">Loading group tasks…</div>
      ) : taskWorkspace ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#354B63]">{taskWorkspace.group?.project_title || taskWorkspace.group?.name || selectedTaskGroup.name}</h3>
                <p className="text-xs text-[#4F5F73]">{pluralize(safeArray(taskWorkspace.tasks).length, 'task')} · Project {taskWorkspace.project_status || 'planning'} · {taskWorkspace.project_progress || 0}% complete</p>
                <div className="mt-2 h-2 w-52 max-w-full overflow-hidden rounded-full bg-[#E4E9EF]">
                  <div className="h-full rounded-full bg-[#4A6079] transition-all" style={{ width: `${Math.min(100, taskWorkspace.project_progress || 0)}%` }} />
                </div>
              </div>
              {taskTree.length ? <button
                type="button"
                onClick={() => openTaskModal('create')}
                className="rounded-lg bg-[#1C1C1E] px-3 py-2 text-xs font-bold text-white hover:opacity-90 dark:bg-stone-100 dark:text-stone-900"
              >
                + Create task
              </button> : null}
            </div>
            {taskTree.length ? taskTree.map((task) => renderTaskTree(task)) : (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-900"><p className="text-sm font-medium text-[#354B63]">No tasks yet.</p><button type="button" onClick={() => openTaskModal('create')} className="mt-3 rounded-md bg-[#35475C] px-4 py-2 text-xs font-semibold text-white">Create a task</button></div>
            )}
          </section>

          <section className="h-fit rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#354B63]">Workload balance</h3>
                <p className="mt-1 text-[10px] text-stone-500 dark:text-stone-400">Weighted task points by assignee</p>
                <button type="button" title="Each task has a weight from 1 to 5. A member’s share is their assigned points divided by the group’s total points." aria-label="How is this calculated? Each task has a weight from 1 to 5. A member’s share is their assigned points divided by the group’s total points." className="mt-1 inline-flex items-center gap-1 text-[10px] text-stone-500 hover:text-stone-800"><CircleHelp size={12} aria-hidden="true" /> How is this calculated?</button>
              </div>
              <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-300">{pluralize(taskBalance?.total_points || 0, 'point')}</span>
            </div>
            <div className="space-y-4">
              {safeArray(taskBalance?.members).map((member) => {
                const level = member.warning_level || 'ok';
                const fillColor = level === 'too_early' ? '#9CA3AF' : level === 'critical' ? '#C64F5D' : level === 'warning' ? '#D69A32' : '#4A6079';
                const levelLabel = level === 'too_early' ? 'Too early to judge' : level === 'critical' ? 'Critical' : level === 'warning' ? 'Warning' : 'OK';
                return (
                  <div key={member.user_id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-bold text-[#1C1C1E] dark:text-stone-100">{member.name}</span>
                      <span className="shrink-0 font-semibold text-stone-600 dark:text-stone-300">{Number(member.share_percent).toFixed(1)}% · {pluralize(member.points_assigned, 'point')}</span>
                    </div>
                    <p className="mb-1 text-[10px] text-stone-500">{pluralize(member.points_assigned, 'point')} assigned · {pluralize(member.points_completed, 'point')} completed · {pluralize(member.tasks_completed, 'task')} completed · {Number(member.on_time_rate || 0).toFixed(0)}% on time</p>
                    <div className="relative h-3 rounded-full bg-stone-100 dark:bg-stone-700" aria-label={`${member.name}: ${Number(member.share_percent).toFixed(1)} percent share, ${levelLabel}`}>
                      <div className="dashboard-workload-fill h-full rounded-full transition-all" style={{ width: `${Math.min(100, Number(member.share_percent || 0))}%`, backgroundColor: fillColor }} />
                      <span className="absolute -top-1 h-5 w-0.5 bg-[#1C1C1E] dark:bg-white" style={{ left: `${Math.min(100, Number(member.fair_share || 0))}%` }} aria-hidden="true" />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400">
                      <span>{level === 'too_early' ? 'Too early to judge' : level === 'critical' ? '● Critical' : level === 'warning' ? '▲ Warning' : '✓ OK'}</span>
                      <span>Fair share {Number(member.fair_share).toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {taskBalance?.suggestion && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[10px] text-amber-900">{taskBalance.suggestion}</p>}
            {Number(taskBalance?.total_points || 0) < 6 && <p className="mt-2 text-[10px] font-semibold text-stone-500">Too early to judge the group balance below 6 points.</p>}
            <p className="mt-4 border-t border-stone-100 pt-3 text-[10px] text-stone-500 dark:border-stone-700 dark:text-stone-400">Vertical marker indicates the fair-share target.</p>
          </section>
          <section className="h-fit rounded-xl border border-[#D7DEE6] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#354B63]">Activity</h3>
                <p className="mt-1 text-[10px] text-[#4F5F73]">Recent changes in this group</p>
              </div>
              {activityLoading && <span className="text-[10px] text-[#4F5F73]">Loading…</span>}
            </div>
            {groupActivity.length ? (
              <ol className="space-y-3">
                {groupActivity.map((item) => {
                  let sentence;
                  if (item.action === 'reassigned') sentence = `${item.actor_name} reassigned ${item.task_title}${item.to_user_name ? ` to ${item.to_user_name}` : ''}`;
                  else if (item.action === 'assigned') sentence = `${item.actor_name} assigned ${item.task_title}${item.to_user_name ? ` to ${item.to_user_name}` : ''}`;
                  else if (item.action === 'completed') sentence = `${item.actor_name} completed ${item.task_title}`;
                  else if (item.action === 'started') sentence = `${item.actor_name} started ${item.task_title}`;
                  else sentence = `${item.actor_name} created ${item.task_title}`;
                  return <li key={item.id} className="border-l-2 border-[#D7DEE6] pl-3"><p className="text-xs text-[#354B63]">{sentence}</p><time className="mt-0.5 block text-[10px] text-[#4F5F73]">{timeAgo(item.created_at)}</time></li>;
                })}
              </ol>
            ) : (
              <p className="rounded-md bg-[#F3F5F7] px-3 py-5 text-center text-xs text-[#4F5F73]">{activityLoading ? 'Loading activity…' : 'No activity yet. Task updates will appear here.'}</p>
            )}
          </section>
          <section className="space-y-3 xl:col-span-2" aria-label="Group projects">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#354B63]">Projects</h3>
                <p className="text-xs text-[#4F5F73]">Milestones and deliverables for this group.</p>
              </div>
              <button type="button" onClick={() => setProjectModal({})} className="rounded-md bg-[#35475C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#435B76]">New project</button>
            </div>
            {taskGroupProjects.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {taskGroupProjects.map((project) => (
                  <article key={project.id} className="rounded-lg border border-[#D7DEE6] bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase text-[#29384A]">{project.title}</h4>
                      <span className="shrink-0 rounded bg-[#EEF1F4] px-2 py-0.5 text-[9px] font-semibold capitalize text-[#435B76]">{String(project.status || 'planning').replaceAll('_', ' ')}</span>
                    </div>
                    {project.description && <p className="mt-1 text-xs text-[#4F5F73]">{project.description}</p>}
                    <p className="mt-2 text-[10px] text-[#4F5F73]">{pluralize(project.task_count || 0, 'task')}{project.deadline ? ` · Due ${new Date(project.deadline).toLocaleDateString()}` : ''}</p>
                  </article>
                ))}
              </div>
            ) : <p className="rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-5 text-center text-xs text-[#4F5F73]">No projects yet. Create one or start a poll to decide.</p>}
          </section>
          <div className="xl:col-span-2">
            <PollPanel groupId={selectedTaskGroup.id} onCreateProject={(initial) => setProjectModal(initial)} />
          </div>
        </div>
      ) : !selectedTaskGroup ? (
        <div className="rounded-xl border border-dashed border-[#D7DEE6] bg-white p-8 text-center"><p className="text-sm font-medium text-[#354B63]">No groups yet.</p><button type="button" onClick={() => setActiveTab('groups')} className="mt-3 rounded-md bg-[#35475C] px-4 py-2 text-xs font-semibold text-white">Browse groups</button></div>
      ) : (
        <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">{taskWorkspaceError || 'Unable to load this group’s tasks.'}<button type="button" onClick={() => openGroupTasks(selectedTaskGroup)} className="ml-3 rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800">Retry</button></div>
      )}
      {taskWorkspaceError && taskWorkspace ? <p role="alert" className="text-xs font-semibold text-red-600">{taskWorkspaceError}</p> : null}
    </div>
  );
};

export default MyTasks;

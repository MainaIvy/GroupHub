import React, { useState, useEffect } from 'react';
import { safeArray } from '../../utils';
import { Clock, AlertTriangle, CheckCircle2, FileText, Trash2 } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { API_BASE } from '../../../apiConfig';
import axios from '../../../api';

const SubmissionTab = ({ ctx }) => {
  const { workspaceCompile, workspace, user, actions } = ctx;
  const isLeader = user?.id === workspace?.group?.leader_id;

  const compile = workspaceCompile || {};
  const allTasks = safeArray(workspace?.tasks);
  const members = safeArray(workspace?.members);

  const rootTasks = allTasks.filter((task) => !task.parent_task_id && task.title.trim().toLowerCase() !== 'compile and edit');
  const sectionsTotal = rootTasks.length;
  const sectionsDone = rootTasks.filter((task) => (task.status === 'completed' || task.progress_percentage >= 100)).length;

  const leafTasks = allTasks.filter((task) => !task.has_subtasks && task.title.trim().toLowerCase() !== 'compile and edit');

  const memberById = {};
  members.forEach((m) => { memberById[m.id] = m; });

  const [submission, setSubmission] = useState(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    const groupId = workspace?.group?.id;
    if (!groupId) return;
    setSubmissionLoading(true);
    axios
      .get(`${API_BASE}/api/accounts/groups/${groupId}/submissions/`, { headers: { Authorization: `Bearer ${window.localStorage.getItem('access_token')}` } })
      .then((response) => {
        const subs = response.data || [];
        setSubmission(subs.length > 0 ? subs[0] : null);
      })
      .catch((err) => setSubmissionError(err.response?.data?.error || "Unable to load submission."))
      .finally(() => setSubmissionLoading(false));
  }, [workspace?.group?.id]);

  const boardToDisplay = (boardStatus) => {
    if (boardStatus === 'done') return 'done';
    if (boardStatus === 'in_progress') return 'in_progress';
    return 'todo';
  };

  const statusChip = (boardStatus) => {
    const s = boardToDisplay(boardStatus);
    return ({
      done: 'bg-[#E3EAF2] text-[#35475C] border-[#D7DEE6]',
      in_progress: 'bg-[#EEF1F4] text-[#2F4A66] border-[#C9D5E2]',
      todo: 'bg-[#EEF1F4] text-[#33445A] border-[#D7DEE6]',
    }[s] || 'bg-[#EEF1F4] text-[#33445A] border-[#D7DEE6]');
  };

  const statusLabel = (boardStatus) => {
    const s = boardToDisplay(boardStatus);
    return { todo: 'To do', in_progress: 'In progress', done: 'Done' }[s];
  };

  const submissionStatusChip = (status) => {
    return ({
      submitted: 'bg-yellow-100 text-yellow-700',
      under_review: 'bg-blue-100 text-blue-700',
      revision_requested: 'bg-orange-100 text-orange-700',
      graded: 'bg-green-100 text-green-700',
    }[status] || 'bg-[#E3EAF2] text-[#35475C]');
  };

  const submissionStatusLabel = (status) => {
    return {
      submitted: 'Submitted',
      under_review: 'Under Review',
      revision_requested: 'Revision Requested',
      graded: 'Graded',
    }[status] || status;
  };

  const ownGrade = submission?.member_grades?.find(
    (mg) => mg.student_id === user?.id,
  );

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-[#D7DEE6] pb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#35475C]">Final submission</h2>
          <p className="mt-1 text-sm text-[#4F5F73]">Submit once the whole group plan is combined into one document.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#E3EAF2] bg-[#EEF1F4] px-3 py-2 text-[12px] font-medium text-[#2F4A66]">
          <Clock size={14} aria-hidden="true" />
          <span>{sectionsDone} of {sectionsTotal} task{sectionsTotal !== 1 ? 's' : ''} complete</span>
        </div>
      </div>

      {submissionLoading && <p className="text-[#4F5F73]">Loading submission…</p>}
      {submissionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{submissionError}</div>
      )}

      {submission && (
        <article className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1F2D3D]">Submission status</h3>
              <p className="text-[10px] text-[#4F5F73]">Submitted {new Date(submission.submitted_at).toLocaleDateString()}</p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${submissionStatusChip(submission.status)}`}>
              {submissionStatusLabel(submission.status)}
            </span>
          </div>

          {submission.published && (
            <div className="mt-4 rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] p-4">
              <h3 className="text-sm font-bold text-[#1F2D3D] mb-2">Your grade</h3>
              <div className="flex items-center gap-4 text-lg">
                <span className="text-[#0F3D6E] font-bold">{submission.grade != null ? submission.grade + '%' : 'Not graded'}</span>
                <span className="text-[#4F5F73]">out of {submission.project_max_marks || 100}</span>
              </div>
              {submission.feedback && (
                <p className="mt-2 text-sm text-[#1F2D3D]">{submission.feedback}</p>
              )}
              {ownGrade && (
                <div className="mt-3 rounded bg-white p-3 border border-[#E3EAF2]">
                  <p className="text-xs font-semibold text-[#4F5F73] mb-1">Your mark</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[#0F3D6E] font-bold">{ownGrade.final_mark != null ? ownGrade.final_mark + '%' : 'Pending'}</span>
                    {ownGrade.reason && <p className="text-sm text-[#1F2D3D] mt-1">{ownGrade.reason}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {!submission.published && submission.status === 'submitted' && (
            <div className="mt-4 rounded-lg border border-[#E3EAF2] bg-[#F4F7FC] p-3">
              <p className="text-sm text-[#4F5F73]">Your submission is pending review by your lecturer.</p>
            </div>
          )}
        </article>
      )}

      {compile.is_locked ? (
        <article className="rounded-lg border border-[#E3EAF2] bg-[#EEF1F4] p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-[#2F4A66]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-[#2F4A66]">{compile.lock_reason || 'Compile and edit is locked until all tasks are complete.'}</p>
              {compile.ready_to_combine && compile.can_override && <p className="mt-1 text-xs text-[#35475C]">The group leader can override with a reason.</p>}
            </div>
          </div>
        </article>
      ) : (
        <article className="rounded-lg border border-[#D7DEE6] bg-white p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#2F4A66]" aria-hidden="true" />
            <p className="text-sm text-[#1F2D3D]">All tasks are done. “Compile and edit” is unlocked.</p>
          </div>
        </article>
      )}

      <article className="rounded-lg border border-[#D7DEE6] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1F2D3D]">Per-subtask submissions</h3>
          <span className="text-xs text-[#4F5F73]">{leafTasks.length} subtask{leafTasks.length !== 1 ? 's' : ''}</span>
        </div>
        <p className="text-xs text-[#4F5F73] mb-3">Each member's proof of work appears under their subtask.</p>
        {leafTasks.length ? (
          <div className="space-y-3">
            {leafTasks.map((task) => {
              const workItems = safeArray(task.work_items);
              const member = memberById[task.assigned_to_id] || {};
              const parent = allTasks.find((t) => t.id === task.parent_task_id);
              const displayName = member.name || task.assigned_to_name || 'Unassigned';
              const displayAvatar = member.avatar || task.assigned_to_avatar;
              return (
                <article key={task.id} className="rounded-lg border border-[#E3EAF2] bg-[#EEF1F4] p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-[#1F2D3D] text-sm truncate">{task.title}</h4>
                      {parent && <p className="text-[10px] text-[#4F5F73] truncate">Under “{parent.title}”</p>}
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusChip(task.board_status)}`}>{statusLabel(task.board_status)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {task.assigned_to_id ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar name={displayName} avatar={displayAvatar} size={20} className="text-[9px]" />
                        <span className="text-[11px] text-[#4F5F73]">{displayName}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#4F5F73]">Unassigned</span>
                    )}
                    <span className="ml-auto text-[11px] text-[#4F5F73]">{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                  </div>
                  {workItems.length ? (
                    <div className="space-y-1">
                      {workItems.map((item) => {
                        const isOwner = item.author_id === user?.id;
                        return (
                          <div key={item.id} className="rounded border border-[#C9D5E2] bg-white p-2 text-xs">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-medium text-[#33445A]">{item.author_name}</span>
                              <span className="text-[#4F5F73]">{new Date(item.created_at).toLocaleDateString()}</span>
                              {isOwner && !actions?.busy && (
                                <button type="button" onClick={() => { if (window.confirm('Remove this proof of work?')) actions.deleteWorkItem(task.id, item.id); }} className="text-[10px] text-red-600 hover:text-red-700 underline hover:bg-red-50 px-1 py-0.5 rounded" title="Delete proof">
                                  <Trash2 size={10} />
                                </button>
                              )}
                            </div>
                            {item.note && <p className="whitespace-pre-wrap text-[11px] text-[#1F2D3D] mb-1">{item.note}</p>}
                            {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-[11px] text-[#435B76] underline">Open link</a>}
                            {item.file_url && <a href={item.file_url} target="_blank" rel="noreferrer" className="text-[11px] text-[#435B76] underline">Open {item.file_name}</a>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#4F5F73] italic">No submission yet</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[#4F5F73] italic">No subtasks yet.</p>
        )}
      </article>

      <article className="rounded-lg border border-[#D7DEE6] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1F2D3D] mb-3">Contribution</h3>
        <p className="text-xs text-[#4F5F73] mb-2">Each member’s work appears under their subtask. The lecturer sees the final plan beside individual contributions.</p>
        <div className="flex flex-wrap items-center gap-2">
          {safeArray(workspace?.members).map((member) => (
            <div key={member.id} className="flex items-center gap-2 rounded-lg bg-[#EEF1F4] px-2 py-1 text-[11px] font-medium text-[#33445A]">
              <span className="truncate max-w-[120px]">{member.name}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
};

export default SubmissionTab;

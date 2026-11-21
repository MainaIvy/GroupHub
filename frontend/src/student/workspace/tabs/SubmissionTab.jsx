import React from 'react';
import { safeArray } from '../../utils';
import { Clock, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';

const SubmissionTab = ({ ctx }) => {
  const { workspaceCompile, workspace, user } = ctx;
  const isLeader = user?.id === workspace?.group?.leader_id;

  const compile = workspaceCompile || {};
  const sectionsTotal = safeArray(workspace?.tasks).filter((task) => !task.parent_task_id && task.title.trim().toLowerCase() !== 'compile and edit').length;
  const sectionsDone = safeArray(workspace?.tasks).filter((task) => !task.parent_task_id && task.title.trim().toLowerCase() !== 'compile and edit' && (task.status === 'completed' || task.progress_percentage >= 100)).length;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-[#D7DEE6] pb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#35475C]">Final submission</h2>
          <p className="mt-1 text-sm text-[#4F5F73]">Submit once the whole group plan is combined into one document.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#E3EAF2] bg-[#EEF1F4] px-3 py-2 text-[12px] font-medium text-[#2F4A66]">
          <Clock size={14} aria-hidden="true" />
          <span>{sectionsDone} of {sectionsTotal} tasks complete</span>
        </div>
      </div>

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
        <div className="flex items-center gap-2">
          <Copy size={16} className="text-[#4A6079]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1F2D3D]">Where to submit</p>
            <p className="mt-1 text-xs text-[#4F5F73]">Use the Submissions tab in your group workspace to hand in the final combined file.</p>
          </div>
        </div>
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

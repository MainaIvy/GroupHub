import React from 'react';
import { safeArray } from '../utils';

const SubmissionsPanel = ({ ctx, embedded = false }) => {
  const { groups, setActiveTab, submissionGroupId, setSubmissionGroupId, submissions, submissionBalance, submissionsLoading, submissionBusy, submissionError, submissionMessage, submissionForm, setSubmissionForm, submitGroupSubmission } = ctx;

  return (
    <section className="space-y-5">
      {embedded ? <h3 className="text-lg font-bold text-[#1F2D3D]">Submissions</h3> : (
      <div className="flex flex-col gap-3 border-b border-[#D7DEE6] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#35475C]">Submissions</h2>
          <p className="mt-1 text-sm text-[#4F5F73]">Submit your group’s work and review previous submissions.</p>
        </div>
        <label className="text-xs font-semibold text-[#435B76]">Group
          <select value={submissionGroupId || groups[0]?.id || ''} onChange={(event) => setSubmissionGroupId(event.target.value)} className="ml-2 min-w-48 rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#29384A]">
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
      </div>
      )}
      {!groups.length ? (
        <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-8 text-center"><p className="text-sm text-[#596579]">Join a group before submitting project work.</p><button type="button" onClick={() => setActiveTab('groups')} className="mt-3 rounded-md bg-[#35475C] px-4 py-2 text-xs font-semibold text-white">Browse groups</button></div>
      ) : submissionsLoading ? (
        <p className="rounded-lg border border-[#D7DEE6] bg-white p-8 text-center text-sm text-[#4F5F73]">Loading submissions…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="space-y-5">
            <form onSubmit={submitGroupSubmission} className="space-y-4 rounded-lg border border-[#D7DEE6] bg-white p-5">
              <div><h3 className="text-sm font-semibold text-[#35475C]">Submit project work</h3><p className="mt-1 text-xs text-[#4F5F73]">Add a GitHub link, proof, and optional screenshot.</p></div>
              <label className="block text-xs font-semibold text-[#435B76]">GitHub link <span className="font-normal text-[#4F5F73]">(optional)</span>
                <input type="url" value={submissionForm.github_url} onChange={(event) => setSubmissionForm((current) => ({ ...current, github_url: event.target.value }))} placeholder="https://github.com/group/project" className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
              </label>
              <label className="block text-xs font-semibold text-[#435B76]">Proof of work
                <textarea required rows={4} value={submissionForm.proof_text} onChange={(event) => setSubmissionForm((current) => ({ ...current, proof_text: event.target.value }))} placeholder="Describe what your group completed…" className="mt-1.5 w-full resize-y rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
              </label>
              <label className="block text-xs font-semibold text-[#435B76]">Screenshot <span className="font-normal text-[#4F5F73]">(optional)</span>
                <input id="submission-screenshot" type="file" accept="image/*" onChange={(event) => setSubmissionForm((current) => ({ ...current, screenshot: event.target.files?.[0] || null }))} className="mt-1.5 block w-full rounded-md border border-[#CBD5E1] bg-white p-2 text-xs text-[#435B76]" />
              </label>
              <label className="block text-xs font-semibold text-[#435B76]">Shared documents or photos <span className="font-normal text-[#4F5F73]">(up to 5 files, 10 MB each)</span>
                <input id="submission-attachments" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => setSubmissionForm((current) => ({ ...current, attachments: Array.from(event.target.files || []) }))} className="mt-1.5 block w-full rounded-md border border-[#CBD5E1] bg-white p-2 text-xs text-[#435B76]" />
              </label>
              {submissionError && <p role="alert" className="text-xs text-red-700">{submissionError}</p>}
              {submissionMessage && <p role="status" className="text-xs text-[#435B76]">{submissionMessage}</p>}
              <div className="flex justify-end border-t border-[#E4E9EF] pt-3"><button disabled={submissionBusy || !submissionForm.proof_text.trim()} className="rounded-md bg-[#35475C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4A6079] disabled:opacity-50">{submissionBusy ? 'Submitting…' : 'Submit work'}</button></div>
            </form>
            <section className="rounded-lg border border-[#D7DEE6] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#35475C]">Group submissions</h3>
              <p className="mt-1 text-[10px] text-[#4F5F73]">Visible to everyone in this group.</p>
              <div className="mt-3 space-y-3">
                {submissions.length ? submissions.map((submission) => (
                  <article key={submission.id} className="rounded-md border border-[#E4E9EF] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold text-[#354B63]">{submission.project_title}</h4><span className="rounded-full bg-[#E4E9EF] px-2.5 py-1 text-[10px] font-semibold capitalize text-[#435B76]">{submission.status}</span></div>
                    <p className="mt-1 text-[10px] text-[#4F5F73]">Submitted by {submission.submitted_by_name} · {new Date(submission.submitted_at).toLocaleDateString()}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-[#435B76]">{submission.proof_text}</p>
                    {submission.github_url && <a href={submission.github_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-[#435B76] underline">Open GitHub link</a>}
                    {submission.screenshot_url && <a href={submission.screenshot_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-medium text-[#435B76] underline">View screenshot</a>}
                    {safeArray(submission.attachments).map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-medium text-[#435B76] underline">Open {attachment.name}</a>)}
                    {submission.feedback && <p className="mt-2 rounded bg-[#F3F5F7] p-2 text-xs text-[#435B76]">Feedback: {submission.feedback}</p>}
                  </article>
                )) : <p className="rounded-md bg-[#F3F5F7] px-3 py-6 text-center text-xs text-[#4F5F73]">No submissions yet for this group.</p>}
              </div>
            </section>
          </div>
          <aside className="h-fit rounded-lg border border-[#D7DEE6] bg-white p-5">
            <h3 className="text-sm font-semibold text-[#35475C]">Member contributions</h3>
            <p className="mt-1 text-xs text-[#4F5F73]">Points assigned, points completed and on-time rate for each member.</p>
            <div className="mt-4 space-y-4">
              {safeArray(submissionBalance?.members).map((member) => (
                <div key={member.user_id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate font-medium text-[#354B63]">{member.name}</span><span className="shrink-0 text-[#4F5F73]">{Number(member.share_percent).toFixed(1)}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E4E9EF]"><div className="h-full rounded-full bg-[#4A6079]" style={{ width: `${Math.min(100, Number(member.share_percent || 0))}%` }} /></div>
                  <dl className="mt-1 grid grid-cols-3 gap-2 text-[13px] text-[#4F5F73]">
                    <div><dt>Assigned</dt><dd className="font-semibold text-[#1F2D3D]">{member.points_assigned} pts</dd></div>
                    <div><dt>Completed</dt><dd className="font-semibold text-[#1F2D3D]">{member.points_completed} pts</dd></div>
                    <div><dt>On time</dt><dd className="font-semibold text-[#1F2D3D]">{member.tasks_completed ? `${Math.round(member.on_time_rate)}%` : '—'}</dd></div>
                  </dl>
                </div>
              ))}
              {!submissionBalance?.members?.length && <p className="rounded-md bg-[#F3F5F7] p-3 text-xs text-[#4F5F73]">Contribution shares appear once tasks have weights and owners.</p>}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};

export default SubmissionsPanel;

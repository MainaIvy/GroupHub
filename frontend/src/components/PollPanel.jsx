import React, { useEffect, useState } from 'react';
import axios from '../api';
import { BarChart3, Plus } from 'lucide-react';

const fullName = (person) => `${person.first_name} ${person.last_name}`.trim() || 'Student';

const PollCard = ({ poll, onChange, onCreateProject }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newText, setNewText] = useState('');
  const [newPitch, setNewPitch] = useState('');

  const run = async (request) => {
    setBusy(true);
    setError('');
    try {
      const response = await request();
      onChange(response.data);
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const closed = poll.status === 'closed';
  const maxVotes = Math.max(1, ...poll.options.map((option) => option.votes));

  return (
    <article className="space-y-3 rounded-lg border border-[#D7DEE6] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[#29384A]">{poll.question}</h4>
          <p className="mt-0.5 text-[10px] text-[#718094]">
            By {poll.created_by_name} · {poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}
            {!closed && poll.closes_at ? ` · closes ${new Date(poll.closes_at).toLocaleString()}` : ''}
          </p>
        </div>
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${closed ? 'bg-[#EEF1F4] text-[#435B76]' : 'bg-[#EEF1F4] text-[#4A6079]'}`}>{closed ? 'Closed' : 'Open'}</span>
      </div>

      <ul className="space-y-2.5">
        {poll.options.map((option) => {
          const mine = poll.my_vote === option.id;
          const isWinner = poll.winner_option_id === option.id;
          const tied = poll.tied_option_ids.includes(option.id);
          return (
            <li key={option.id} className={`rounded-md border p-2.5 ${isWinner ? 'border-[#4A6079] bg-[#F1F8F4]' : 'border-[#E4E9EF]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-[#29384A]">{option.text}{isWinner ? ' · Winner' : ''}</span>
                  {option.pitch && <p className="mt-0.5 text-[11px] text-[#435B76]">{option.pitch}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-bold text-[#4A6079]" aria-label={`${option.votes} votes`}>{option.votes}</span>
                  {poll.can_vote && <button type="button" disabled={busy} onClick={() => run(() => axios.post(`/api/accounts/polls/${poll.id}/vote/`, { option_id: option.id }))} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${mine ? 'bg-[#4A6079] text-white' : 'border border-[#D7DEE6] text-[#4A6079] hover:bg-[#F3F6F4]'} disabled:opacity-50`}>{mine ? 'Your vote' : 'Vote'}</button>}
                  {poll.can_pick_winner && tied && <button type="button" disabled={busy} onClick={() => run(() => axios.post(`/api/accounts/polls/${poll.id}/winner/`, { option_id: option.id }))} className="rounded-md bg-[#35475C] px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50">Pick as winner</button>}
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E4E9EF]"><div className="h-full rounded-full bg-[#4A6079] transition-all" style={{ width: `${(option.votes / maxVotes) * 100}%` }} /></div>
              <p className="mt-1.5 text-[10px] text-[#718094]">{option.voters.length ? `Voted: ${option.voters.map(fullName).join(', ')}` : 'No votes yet'}</p>
            </li>
          );
        })}
      </ul>

      {poll.needs_leader_pick && <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-900">It's a tie. {poll.can_pick_winner ? 'As group leader, pick the winner above.' : 'The group leader will pick the winner.'}</p>}
      {closed && !poll.needs_leader_pick && !poll.winner && <p className="text-[11px] text-[#718094]">Nobody voted, so there is no winner.</p>}

      {poll.can_add_option && (
        <form onSubmit={async (event) => { event.preventDefault(); if (await run(() => axios.post(`/api/accounts/polls/${poll.id}/options/`, { text: newText, pitch: newPitch }))) { setNewText(''); setNewPitch(''); } }} className="flex flex-wrap gap-2">
          <input value={newText} onChange={(event) => setNewText(event.target.value)} maxLength={200} placeholder="Add an option" aria-label="New option" className="min-w-32 flex-1 rounded-md border border-[#CBD5E1] px-2.5 py-1.5 text-xs" />
          <input value={newPitch} onChange={(event) => setNewPitch(event.target.value)} placeholder="Short pitch (optional)" aria-label="Pitch for the new option" className="min-w-32 flex-2 rounded-md border border-[#CBD5E1] px-2.5 py-1.5 text-xs" />
          <button type="submit" disabled={busy || !newText.trim()} className="rounded-md border border-[#D7DEE6] px-3 py-1.5 text-[10px] font-semibold text-[#4A6079] disabled:opacity-50">Add option</button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {poll.can_close && <button type="button" disabled={busy} onClick={() => run(() => axios.post(`/api/accounts/polls/${poll.id}/close/`))} className="rounded-md border border-[#D7DEE6] px-3 py-1.5 text-[10px] font-semibold text-[#435B76] hover:bg-[#F3F6F4] disabled:opacity-50">Close poll</button>}
        {closed && poll.winner && onCreateProject && <button type="button" onClick={() => onCreateProject({ title: poll.winner.text, description: poll.winner.pitch })} className="rounded-md bg-[#4A6079] px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-[#35475C]">Create project from this</button>}
      </div>
      {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </article>
  );
};

const emptyForm = { question: '', options: ['', ''], closesAt: '', allowNew: true };

const PollPanel = ({ groupId, defaultOpen = true, onCreateProject }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    const load = () => axios.get(`/api/accounts/groups/${groupId}/polls/`)
      .then((response) => { if (!cancelled) { setPolls(Array.isArray(response.data) ? response.data : []); setError(''); } })
      .catch((requestError) => { if (!cancelled) setError(requestError.response?.data?.error || 'Unable to load polls.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    load();
    const timer = window.setInterval(load, 8000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [groupId]);

  const replacePoll = (updated) => setPolls((current) => current.map((poll) => (poll.id === updated.id ? updated : poll)));

  const createPoll = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const response = await axios.post(`/api/accounts/groups/${groupId}/polls/`, {
        question: form.question,
        options: form.options.filter((text) => text.trim()).map((text) => ({ text })),
        closes_at: form.closesAt ? new Date(form.closesAt).toISOString() : null,
        allow_new_options: form.allowNew,
      });
      setPolls((current) => [response.data, ...current]);
      setForm(emptyForm);
      setCreating(false);
    } catch (requestError) {
      setFormError(requestError.response?.data?.error || 'Unable to create this poll.');
    } finally {
      setBusy(false);
    }
  };

  const openCount = polls.filter((poll) => poll.status === 'open').length;

  return (
    <section className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4]" aria-label="Group polls">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-xs font-semibold text-[#29384A]"><BarChart3 size={15} aria-hidden="true" /> Polls{openCount ? ` · ${openCount} open` : ''}</span>
        <span className="text-[10px] text-[#718094]">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#E4E9EF] p-4">
          {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={() => setCreating((value) => !value)} className="inline-flex items-center gap-1.5 rounded-md bg-[#35475C] px-3 py-1.5 text-[10px] font-semibold text-white"><Plus size={12} aria-hidden="true" /> {creating ? 'Cancel' : 'New poll'}</button>
          </div>
          {creating && (
            <form onSubmit={createPoll} className="space-y-2.5 rounded-lg border border-[#D7DEE6] bg-white p-4">
              <input required value={form.question} onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))} maxLength={300} placeholder="What should we decide? e.g. Which project should we build?" aria-label="Poll question" className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-xs" />
              {form.options.map((text, index) => (
                <input key={index} value={text} onChange={(event) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)) }))} maxLength={200} placeholder={`Option ${index + 1}`} aria-label={`Option ${index + 1}`} className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-xs" />
              ))}
              <button type="button" onClick={() => setForm((current) => ({ ...current, options: [...current.options, ''] }))} className="text-[10px] font-semibold text-[#4A6079] underline">Add another option</button>
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-[10px] font-semibold text-[#435B76]">Closes at (optional)
                  <input type="datetime-local" value={form.closesAt} onChange={(event) => setForm((current) => ({ ...current, closesAt: event.target.value }))} className="mt-1 block rounded-md border border-[#CBD5E1] px-2 py-1.5 text-xs" />
                </label>
                <label className="flex items-center gap-2 text-[10px] font-semibold text-[#435B76]"><input type="checkbox" checked={form.allowNew} onChange={(event) => setForm((current) => ({ ...current, allowNew: event.target.checked }))} /> Let members add options</label>
              </div>
              {formError && <p role="alert" className="text-xs font-medium text-red-700">{formError}</p>}
              <button type="submit" disabled={busy} className="rounded-md bg-[#4A6079] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create poll'}</button>
            </form>
          )}
          {loading ? <p className="text-xs text-[#718094]">Loading polls…</p> : polls.length ? polls.map((poll) => <PollCard key={poll.id} poll={poll} onChange={replacePoll} onCreateProject={onCreateProject} />) : <p className="rounded-md bg-white px-3 py-5 text-center text-xs text-[#718094]">No polls yet. Start one to decide on a project together.</p>}
        </div>
      )}
    </section>
  );
};

export default PollPanel;

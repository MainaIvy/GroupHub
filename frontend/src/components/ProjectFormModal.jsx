import React, { useState } from 'react';
import axios from '../api';

const ProjectFormModal = ({ groupId, initial, onClose, onCreated }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await axios.post(`/api/accounts/groups/${groupId}/projects/`, {
        title,
        description,
        deadline: deadline || null,
      });
      onCreated(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to create this project.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="relative w-full max-w-md space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-2xl" aria-label="New project">
        <button type="button" onClick={onClose} aria-label="Close project form" className="absolute right-4 top-4 rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500">✕</button>
        <h2 className="pr-10 text-base font-black text-[#1C1C1E]">New project</h2>
        <label className="block text-xs font-bold text-stone-600">Title
          <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-stone-600">Description
          <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-stone-600">Deadline <span className="font-normal text-stone-500">(optional)</span>
          <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-normal" />
        </label>
        {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600">Cancel</button>
          <button type="submit" disabled={busy || !title.trim()} className="rounded-lg bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? 'Creating…' : 'Create project'}</button>
        </div>
      </form>
    </div>
  );
};

export default ProjectFormModal;

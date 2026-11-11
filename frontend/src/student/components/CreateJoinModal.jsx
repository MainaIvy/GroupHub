import React from 'react';

const CreateJoinModal = ({ ctx }) => {
  const { units, showModal, setShowModal, modalTab, setModalTab, error, newGroupName, setNewGroupName, selectedCourse, setSelectedCourse, selectedUnitId, setSelectedUnitId, maxMembers, setMaxMembers, inviteUsernames, setInviteUsernames, createBusy, inviteCodeInput, inviteError, joinBusy, courseOptions, handleCreateSubmit, handleInviteInputChange, handleJoinSubmit } = ctx;

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 border border-stone-200/60 shadow-xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-150">
        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-stone-50 border border-stone-200 text-stone-400 hover:text-[#1C1C1E] flex items-center justify-center text-xs">✕</button>

        <div className="flex items-center gap-2 mb-5 border-b border-stone-100 pb-3">
          <button type="button" onClick={() => setModalTab('create')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${modalTab === 'create' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'bg-stone-50 text-stone-400 border border-stone-200/60'}`}>Create Group</button>
          <button type="button" onClick={() => setModalTab('join')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${modalTab === 'join' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'bg-stone-50 text-stone-400 border border-stone-200/60'}`}>Join Group</button>
        </div>

        {modalTab === 'create' ? (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Group Workspace Title</label>
              <input type="text" required placeholder="e.g., Network Alpha Space" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-stone-500 text-[#1C1C1E] font-medium"/>
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Associated Curriculum Unit</label>
              <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none text-[#1C1C1E] font-medium">
                {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="group-unit" className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Unit for this group</label>
              <select
                id="group-unit"
                value={selectedUnitId}
                onChange={(event) => setSelectedUnitId(event.target.value)}
                className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-stone-500 text-[#1C1C1E] font-medium"
              >
                <option value="">Choose a unit (optional)</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-stone-500">Choosing a unit links it to this group.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Group size
                <input type="number" min="2" max="32767" required value={maxMembers} onChange={(event) => setMaxMembers(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-[#1C1C1E]" />
              </label>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Invite classmates <span className="font-normal normal-case">(optional)</span>
                <input type="text" value={inviteUsernames} onChange={(event) => setInviteUsernames(event.target.value)} placeholder="Admission numbers, separated by commas" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-[#1C1C1E] placeholder:text-stone-400" />
              </label>
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button type="submit" disabled={createBusy || !newGroupName.trim() || Number(maxMembers) < 2} className="w-full mt-2 bg-[#1C1C1E] text-white py-2.5 rounded-xl text-xs font-bold hover:opacity-95 disabled:opacity-40 transition shadow-md border border-stone-800">
              {createBusy ? 'Creating group…' : 'Create group'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">6-Digit Access Token String</label>
              <input type="text" required placeholder="e.g., GHW823" value={inviteCodeInput} onChange={(e) => handleInviteInputChange(e.target.value)} className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-center font-mono tracking-widest focus:outline-none focus:border-stone-500 text-[#1C1C1E]"/>
              {inviteError && <div className="mt-2 text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg text-center border border-red-100">{inviteError}</div>}
            </div>
            <button type="submit" disabled={joinBusy || inviteCodeInput.length !== 6} className="w-full mt-2 bg-[#1C1C1E] text-white py-2.5 rounded-xl text-xs font-bold hover:opacity-95 disabled:opacity-40 transition shadow-md border border-stone-800">
              {joinBusy ? 'Validating Allocation Key...' : 'Access Shared Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateJoinModal;

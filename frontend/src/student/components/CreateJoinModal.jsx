import React from 'react';

const CreateJoinModal = ({ ctx }) => {
  const { units, showModal, setShowModal, modalTab, setModalTab, error, newGroupName, setNewGroupName, selectedCourse, setSelectedCourse, selectedUnitId, setSelectedUnitId, maxMembers, setMaxMembers, inviteUsernames, setInviteUsernames, createBusy, inviteCodeInput, inviteError, joinBusy, courseOptions, handleCreateSubmit, handleInviteInputChange, handleJoinSubmit } = ctx;

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-[#35475C]/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 border border-[#D5DDE6] shadow-xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between gap-2 mb-5 border-b border-[#D7DEE6] pb-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setModalTab('create')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${modalTab === 'create' ? 'bg-[#4A6079] text-white shadow-sm hover:bg-[#35475C]' : 'bg-[#EEF1F4] text-[#1F2D3D] border border-[#D7DEE6]'}`}>Create Group</button>
            <button type="button" onClick={() => setModalTab('join')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${modalTab === 'join' ? 'bg-[#4A6079] text-white shadow-sm hover:bg-[#35475C]' : 'bg-[#EEF1F4] text-[#1F2D3D] border border-[#D7DEE6]'}`}>Join Group</button>
          </div>
          <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg bg-[#EEF1F4] border border-[#D7DEE6] text-[#4F5F73] hover:bg-[#D5DDE6] hover:text-[#35475C] flex items-center justify-center text-xs">✕</button>
        </div>

        {modalTab === 'create' ? (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-[#4A6079] uppercase tracking-wider">Group Workspace Title</label>
              <input type="text" required placeholder="e.g., Network Alpha Space" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="mt-1.5 w-full bg-white border border-[#D7DEE6] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#7189A3] text-[#1F2D3D] font-medium"/>
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#4A6079] uppercase tracking-wider">Associated Curriculum Unit</label>
              <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="mt-1.5 w-full bg-white border border-[#D7DEE6] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#7189A3] text-[#1F2D3D] font-medium">
                {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="group-unit" className="block text-[10px] font-black text-[#4A6079] uppercase tracking-wider">Unit for this group</label>
              <select
                id="group-unit"
                value={selectedUnitId}
                onChange={(event) => setSelectedUnitId(event.target.value)}
                className="mt-1.5 w-full bg-white border border-[#D7DEE6] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#7189A3] text-[#1F2D3D] font-medium"
              >
                <option value="">Choose a unit (optional)</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-[#4A6079]">Choosing a unit links it to this group.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-[10px] font-black text-[#4A6079] uppercase tracking-wider">Group size
                <input type="number" min="2" max="32767" required value={maxMembers} onChange={(event) => setMaxMembers(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D7DEE6] bg-white px-3 py-2 text-xs font-medium text-[#1F2D3D] focus:outline-none focus:ring-2 focus:ring-[#7189A3]" />
              </label>
              <label className="block text-[10px] font-black text-[#4A6079] uppercase tracking-wider">Invite classmates <span className="font-normal normal-case">(optional)</span>
                <input type="text" value={inviteUsernames} onChange={(event) => setInviteUsernames(event.target.value)} placeholder="Admission numbers, separated by commas" className="mt-1.5 w-full rounded-xl border border-[#D7DEE6] bg-white px-3 py-2 text-xs font-medium text-[#1F2D3D] placeholder:text-[#4F5F73] focus:outline-none focus:ring-2 focus:ring-[#7189A3]" />
              </label>
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button type="submit" disabled={createBusy || !newGroupName.trim() || Number(maxMembers) < 2} className={`w-full mt-2 py-2.5 rounded-xl text-xs font-bold hover:opacity-95 disabled:opacity-40 transition shadow-md ${createBusy || !newGroupName.trim() || Number(maxMembers) < 2 ? 'bg-[#D7DEE6] text-[#4F5F73] border border-[#D7DEE6]' : 'bg-[#4A6079] text-white border border-[#4A6079] hover:bg-[#35475C]'}`}>
              {createBusy ? 'Creating group…' : 'Create group'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-[#4A6079] uppercase tracking-wider">6-Digit Access Token String</label>
              <input type="text" required placeholder="e.g., GHW823" value={inviteCodeInput} onChange={(e) => handleInviteInputChange(e.target.value)} className="mt-1.5 w-full bg-white border border-[#D7DEE6] rounded-xl px-3 py-2 text-xs text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#7189A3] text-[#1F2D3D]"/>
              {inviteError && <div className="mt-2 text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg text-center border border-red-100">{inviteError}</div>}
            </div>
            <button type="submit" disabled={joinBusy || inviteCodeInput.length !== 6} className={`w-full mt-2 py-2.5 rounded-xl text-xs font-bold hover:opacity-95 disabled:opacity-40 transition shadow-md ${joinBusy || inviteCodeInput.length !== 6 ? 'bg-[#D7DEE6] text-[#4F5F73] border border-[#D7DEE6]' : 'bg-[#4A6079] text-white border border-[#4A6079] hover:bg-[#35475C]'}`}>
              {joinBusy ? 'Validating Allocation Key...' : 'Access Shared Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateJoinModal;

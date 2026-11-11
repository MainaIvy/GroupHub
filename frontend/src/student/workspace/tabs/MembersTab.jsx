import React, { useState } from 'react';
import { LogOut, UserPlus } from 'lucide-react';
import axios from '../../../api';
import { btnSecondary } from '../../design';
import Avatar from '../../components/Avatar';
import ConfirmDialog from '../../components/ConfirmDialog';
import FindClassmatesPanel from '../../../components/FindClassmatesPanel';

const heading = 'mb-3 text-base font-bold text-[#1F2D3D]';
const card = 'rounded-xl border border-[#D7DEE6] bg-white p-4';

const roleLabel = (member) => (member.is_leader ? 'Leader' : member.role === 'admin' ? 'Admin' : 'Member');

const MembersTab = ({ group, members, isLeader, joinRequests, access, onLeft, onLeaveError, setGroups }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    setLeaving(true);
    try {
      await axios.post(`/api/accounts/groups/${group.id}/leave/`, {});
      setGroups((current) => current.filter((item) => item.id !== group.id));
      onLeft();
    } catch (requestError) {
      setConfirmOpen(false);
      onLeaveError(requestError.response?.data?.error || 'Unable to leave this group.');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className={card} aria-labelledby="mem-list">
        <h3 id="mem-list" className={heading}>Members ({members.length}{group.max_members ? ` / ${group.max_members}` : ''})</h3>
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#EEF1F4] px-3 py-2">
              <span className="flex min-w-0 items-center gap-2"><Avatar name={member.name} /><span className="truncate text-[15px] font-medium text-[#1F2D3D]">{member.name}</span></span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[13px] font-semibold ${member.is_leader ? 'bg-[#E3EAF2] text-[#2F4A66]' : 'bg-white text-[#33445A]'}`}>{roleLabel(member)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-[#E3EAF2] pt-4">
          {isLeader ? <p className="text-sm text-[#4F5F73]">You lead this group, so you can’t leave it. Delete it from the Groups page instead.</p> : (
            <button type="button" onClick={() => setConfirmOpen(true)} className={btnSecondary}><LogOut size={16} aria-hidden="true" /> Leave group</button>
          )}
        </div>
      </section>

      <div className="space-y-4">
        <section className={card} aria-labelledby="mem-requests">
          <h3 id="mem-requests" className={heading}>Join requests</h3>
          {joinRequests.length ? (
            <ul className="space-y-2">
              {joinRequests.map((item) => (
                <li key={item.id} className="rounded-lg bg-[#EEF1F4] px-3 py-2">
                  <p className="text-sm text-[#1F2D3D]">{item.message || item.title}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={access.busyId === item.id} onClick={() => access.declineRequest(item)} className={btnSecondary}>Decline</button>
                    <button type="button" disabled={access.busyId === item.id} onClick={() => access.approveRequest(item)} className="inline-flex h-10 items-center rounded-lg bg-[#35475C] px-4 text-sm font-semibold text-white hover:bg-[#435B76] disabled:opacity-60">Approve</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-[#4F5F73]">No one is waiting for approval.</p>}
          {access.error ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{access.error}</p> : null}
        </section>

        <section className={card} aria-labelledby="mem-invite">
          <h3 id="mem-invite" className={`${heading} flex items-center gap-2`}><UserPlus size={18} aria-hidden="true" /> Invite classmates</h3>
          {group.unit_id ? <FindClassmatesPanel unitId={group.unit_id} groupId={group.id} /> : <p className="text-sm text-[#4F5F73]">This group isn’t linked to a unit, so there are no classmates to search. Share the join code instead.</p>}
        </section>
      </div>

      <ConfirmDialog open={confirmOpen} title="Leave this group?" message={`You will lose access to ${group.name}. Your tasks stay with the group.`} confirmLabel="Leave group" busy={leaving} onConfirm={leave} onCancel={() => setConfirmOpen(false)} />
    </div>
  );
};

export default MembersTab;

import React, { useEffect, useState } from 'react';
import axios from '../api';

const UnitGroupsPanel = ({ unitId, hasGroup }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios.get(`/api/accounts/units/${unitId}/groups/`)
      .then((response) => { if (!cancelled) setGroups(Array.isArray(response.data) ? response.data : []); })
      .catch((requestError) => { if (!cancelled) setError(requestError.response?.data?.error || 'Unable to load groups for this unit.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [unitId]);

  const requestToJoin = async (group) => {
    setBusyId(group.id);
    setError('');
    try {
      await axios.post(`/api/accounts/groups/${group.id}/join-requests/`);
      setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, request_pending: true } : item)));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to send your request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2 py-1">
      <h4 className="text-xs font-semibold text-[#17332F]">Groups for this unit</h4>
      {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
      {loading ? <p className="text-xs text-[#789089]">Loading groups…</p> : groups.length ? (
        <ul className="divide-y divide-[#EEF3F0]">
          {groups.map((group) => (
            <li key={group.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="block text-xs font-semibold text-[#17332F]">{group.name}</span>
                <span className="text-[10px] text-[#789089]">
                  {group.members_count}{group.max_members ? ` of ${group.max_members}` : ''} members · Led by {group.leader_name}
                </span>
              </div>
              <button
                type="button"
                disabled={hasGroup || group.request_pending || busyId === group.id}
                onClick={() => requestToJoin(group)}
                className="shrink-0 rounded-md border border-[#DDE7E2] px-3 py-1.5 text-[10px] font-semibold text-[#1F6B5C] hover:bg-[#F3F6F4] disabled:opacity-50"
              >
                {group.request_pending ? 'Request sent' : 'Request to join'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md bg-[#F3F6F4] px-3 py-4 text-center text-xs text-[#789089]">No open groups for this unit yet. Create one and invite your classmates.</p>
      )}
      {hasGroup && groups.length > 0 && <p className="text-[10px] text-[#789089]">You are already in a group for this unit.</p>}
    </div>
  );
};

export default UnitGroupsPanel;

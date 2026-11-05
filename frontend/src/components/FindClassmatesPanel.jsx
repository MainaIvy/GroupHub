import React, { useEffect, useState } from 'react';
import axios from '../api';

const fullName = (person) => `${person.first_name} ${person.last_name}`.trim() || 'Student';

// With groupId, invites are sent to the server; without it, picks are kept in `selected` until the group exists.
const FindClassmatesPanel = ({ unitId, groupId = null, selected = [], onSelectedChange }) => {
  const [query, setQuery] = useState('');
  const [classmates, setClassmates] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!unitId) return undefined;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      axios.get(`/api/accounts/units/${unitId}/classmates/`, { params: { q: query.trim() } })
        .then((response) => {
          if (cancelled) return;
          setClassmates(Array.isArray(response.data) ? response.data : []);
          setError('');
        })
        .catch((requestError) => {
          if (!cancelled) setError(requestError.response?.data?.error || 'Unable to load classmates.');
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [unitId, query]);

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    axios.get(`/api/accounts/groups/${groupId}/invites/`)
      .then((response) => { if (!cancelled) setInvites(Array.isArray(response.data) ? response.data : []); })
      .catch(() => { if (!cancelled) setInvites([]); });
    return () => { cancelled = true; };
  }, [groupId]);

  const invitedIds = new Set(groupId ? invites.map((invite) => invite.student_id) : selected.map((person) => person.id));

  const invite = async (person) => {
    if (!groupId) {
      onSelectedChange?.([...selected, person]);
      return;
    }
    setBusyId(person.id);
    setError('');
    try {
      const response = await axios.post(`/api/accounts/groups/${groupId}/invites/`, { student_id: person.id });
      setInvites((current) => [response.data, ...current]);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to send this invite.');
    } finally {
      setBusyId(null);
    }
  };

  const cancelInvite = async (item) => {
    if (!groupId) {
      onSelectedChange?.(selected.filter((person) => person.id !== item.id));
      return;
    }
    setBusyId(item.student_id);
    setError('');
    try {
      await axios.delete(`/api/accounts/groups/${groupId}/invites/${item.id}/`);
      setInvites((current) => current.filter((entry) => entry.id !== item.id));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to cancel this invite.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingList = groupId ? invites : selected;

  return (
    <section className="space-y-3 rounded-lg border border-[#DDE7E2] bg-white p-4" aria-label="Find classmates">
      <div>
        <h4 className="text-sm font-semibold text-[#17332F]">Find classmates</h4>
        <p className="mt-0.5 text-[10px] text-[#789089]">Students in this unit, programme, year and semester. Contact details stay private.</p>
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name"
        aria-label="Search classmates by name"
        className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-xs text-[#17332F] outline-none focus:border-[#1F6B5C]"
      />
      {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
      {loading ? <p className="text-xs text-[#789089]">Loading classmates…</p> : classmates.length ? (
        <ul className="max-h-48 divide-y divide-[#EEF3F0] overflow-y-auto">
          {classmates.map((person) => {
            const invited = invitedIds.has(person.id);
            return (
              <li key={person.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[#17332F]">{fullName(person)}</span>
                  {person.has_group && <span className="text-[10px] text-[#789089]">Already in a group for this unit</span>}
                </div>
                <button
                  type="button"
                  disabled={invited || person.has_group || busyId === person.id}
                  onClick={() => invite(person)}
                  className="shrink-0 rounded-md bg-[#1F6B5C] px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                >
                  {invited ? 'Invited' : 'Invite'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md bg-[#F3F6F4] px-3 py-4 text-center text-xs text-[#789089]">
          {query.trim() ? 'No classmates match your search.' : 'No other classmates found for this unit yet.'}
        </p>
      )}
      <div>
        <h5 className="text-[11px] font-semibold text-[#47645D]">{groupId ? 'Pending invites' : 'Classmates to invite after you create the group'}</h5>
        {pendingList.length ? (
          <ul className="mt-1.5 space-y-1.5">
            {pendingList.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-[#F3F6F4] px-3 py-1.5">
                <span className="truncate text-xs text-[#17332F]">{fullName(item)}</span>
                <button type="button" disabled={busyId === item.student_id} onClick={() => cancelInvite(item)} className="shrink-0 text-[10px] font-semibold text-red-700 hover:underline">Cancel</button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-[11px] text-[#789089]">{groupId ? 'No pending invites.' : 'Nobody selected yet.'}</p>}
      </div>
    </section>
  );
};

export default FindClassmatesPanel;

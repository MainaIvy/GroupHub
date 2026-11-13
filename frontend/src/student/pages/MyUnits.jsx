import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Users, Plus, LogIn, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { pluralize } from '../utils';
import axios from '../../api';
import { getStoredToken } from '../utils';

const MyUnits = ({ ctx }) => {
  const {
    units, groups, academic, setActiveTab,
    error, setError, openGroupDetails,
  } = ctx;
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [expandedUnit, setExpandedUnit] = useState(null);
  const [unitGroups, setUnitGroups] = useState({});
  const [loadingGroups, setLoadingGroups] = useState({});
  const [joinRequestStates, setJoinRequestStates] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { unitId: routeUnitId } = useParams();

  const initialUnitId = routeUnitId || location.state?.unit;

  useEffect(() => {
    if (initialUnitId && selectedUnitId !== String(initialUnitId)) {
      setSelectedUnitId(String(initialUnitId));
      setExpandedUnit(String(initialUnitId));
      fetchUnitGroups(String(initialUnitId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUnitId]);

  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null;
    return units.find((u) => String(u.id) === String(selectedUnitId));
  }, [units, selectedUnitId]);

  const userGroupForSelectedUnit = useMemo(() => {
    if (!selectedUnitId) return null;
    return groups.find((g) => String(g.unit_id) === String(selectedUnitId));
  }, [groups, selectedUnitId]);

  const academicText = useMemo(() => {
    if (!academic) return '';
    return `${academic.course_name || academic.course || ''} · Year ${academic.year_of_study} · Semester ${academic.semester}`;
  }, [academic]);

  const fetchUnitGroups = async (unitId) => {
    setLoadingGroups(prev => ({ ...prev, [unitId]: true }));
    try {
      const token = getStoredToken();
      const response = await axios.get(`/api/accounts/units/${unitId}/groups/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data || [];
      setUnitGroups(prev => ({ ...prev, [unitId]: data }));
      const pending = new Set(data.filter((g) => g.request_pending).map((g) => String(g.id)));
      setJoinRequestStates(prev => ({ ...prev, [unitId]: pending }));
    } catch (err) {
      console.error('Failed to load unit groups:', err);
      setUnitGroups(prev => ({ ...prev, [unitId]: [] }));
    } finally {
      setLoadingGroups(prev => ({ ...prev, [unitId]: false }));
    }
  };

  const handleRequestJoin = async (groupId) => {
    const token = getStoredToken();
    try {
      await axios.post(`/api/accounts/groups/${groupId}/join-requests/`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJoinRequestStates(prev => {
        const next = { ...prev };
        if (selectedUnitId) next[selectedUnitId] = new Set([...(next[selectedUnitId] || []), String(groupId)]);
        return next;
      });
      setSuccessMessage('Join request sent.');
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchUnitGroups(selectedUnitId);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to send join request.');
    }
  };

  const handleCancelRequest = async (groupId) => {
    setJoinRequestStates(prev => {
      const next = { ...prev };
      if (selectedUnitId) {
        next[selectedUnitId] = new Set([...(next[selectedUnitId] || [])].filter((id) => id !== String(groupId)));
      }
      return next;
    });
    setSuccessMessage('Join request cancelled.');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const openJoinForUnit = () => {
    if (ctx.setInviteCodeInput) ctx.setInviteCodeInput('');
    if (ctx.setInviteError) ctx.setInviteError('');
    ctx.setShowModal(true);
    ctx.setModalTab('join');
  };

  const openCreateForUnit = (unit) => {
    if (ctx.setSelectedCourse) ctx.setSelectedCourse(unit?.course || academic?.course_name || '');
    if (ctx.setSelectedUnitId) ctx.setSelectedUnitId(unit?.id ? String(unit.id) : '');
    if (ctx.setModalTab) ctx.setModalTab('create');
    if (ctx.setShowModal) ctx.setShowModal(true);
    if (ctx.setError) ctx.setError('');
  };

  const groupsForSelectedUnit = useMemo(() => {
    return unitGroups[selectedUnitId] || [];
  }, [unitGroups, selectedUnitId]);

  const pendingRequestsForUnit = useMemo(() => {
    return joinRequestStates[selectedUnitId] || new Set();
  }, [joinRequestStates, selectedUnitId]);

  if (!units.length) {
    return (
      <section className="space-y-6">
        <PageHeader title="My units" subtitle="No units available yet." />
        <EmptyState
          icon={BookOpen}
          title="No units to show yet"
          description="Units appear once your course, year and semester are set in Settings."
          actionLabel="Go to Settings"
          onAction={() => setActiveTab('settings')}
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader title="My units" subtitle={academicText || 'Your current academic enrollment.'} />

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          {error} <button type="button" onClick={() => setError('')} className="font-semibold underline text-red-800">Dismiss</button>
        </p>
      )}

      {successMessage && (
        <p role="status" className="rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] px-4 py-2 text-sm font-semibold text-[#35475C]">
          {successMessage}
        </p>
      )}

      {/* Selected unit detail panel */}
      {selectedUnit && (
        <section className="rounded-xl border border-[#D5DDE6] bg-white p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-[#35475C] uppercase text-sm">{selectedUnit.code}</span>
                <span className="rounded-full bg-[#EEF1F4] px-2 py-0.5 text-[10px] font-medium text-[#4F5F73]">Unit</span>
              </div>
              <h2 className="text-lg font-bold text-[#1F2D3D]">{selectedUnit.name}</h2>
              <p className="mt-1 text-sm text-[#4F5F73]">{academicText}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setExpandedUnit(selectedUnitId); setSelectedUnitId(selectedUnitId); fetchUnitGroups(selectedUnitId); }}
                disabled={expandedUnit === selectedUnitId}
                className="flex-1 h-10 rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] px-3 text-sm font-semibold text-[#35475C] hover:bg-[#D7DEE6] disabled:opacity-60"
              >
                View groups in this unit
              </button>
              <button
                type="button"
                onClick={() => openJoinForUnit(selectedUnit)}
                disabled={userGroupForSelectedUnit !== null}
                className="flex-1 h-10 rounded-lg border border-[#D7DEE6] bg-white px-3 text-sm font-semibold text-[#1F2D3D] hover:bg-[#EEF1F4] disabled:opacity-60"
              >
                <LogIn size={14} className="mr-1.5" aria-hidden="true" /> Join with code
              </button>
              <button
                type="button"
                onClick={() => openCreateForUnit(selectedUnit)}
                disabled={userGroupForSelectedUnit !== null}
                className="flex-1 h-10 rounded-lg bg-[#4A6079] px-3 text-sm font-semibold text-white hover:bg-[#35475C] disabled:opacity-60"
              >
                <Plus size={14} className="mr-1.5" aria-hidden="true" /> Create group
              </button>
            </div>
          </div>

          {userGroupForSelectedUnit ? (
            <div className="mt-4 rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] p-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#4A6079]" aria-hidden="true" />
                <span className="font-semibold text-[#1F2D3D]">Your group: {userGroupForSelectedUnit.name}</span>
              </div>
              <p className="mt-1 text-sm text-[#4F5F73]">
                You already belong to a group for this unit. Create group and request to join are disabled.
              </p>
              <button
                type="button"
                onClick={() => openGroupDetails(userGroupForSelectedUnit)}
                className="mt-3 h-10 rounded-lg bg-[#4A6079] px-4 text-sm font-semibold text-white hover:bg-[#35475C]"
              >
                Open workspace
              </button>
            </div>
          ) : null}

          {/* Groups in this unit */}
          <section className="mt-6">
            <h3 className="text-base font-bold text-[#1F2D3D] mb-3">Groups in this unit</h3>
            {loadingGroups[selectedUnitId] ? (
              <LoadingState label="Loading groups…" rows={2} />
            ) : groupsForSelectedUnit.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D7DEE6] bg-white p-8 text-center">
                <BookOpen size={24} className="mx-auto mb-2 text-[#4F5F73]" aria-hidden="true" />
                <p className="text-sm font-medium text-[#1F2D3D]">No groups in this unit yet.</p>
                <p className="mt-1 text-sm text-[#4F5F73]">Create the first one.</p>
                <button
                  type="button"
                  onClick={() => openCreateForUnit(selectedUnit)}
                  className="mt-3 h-10 rounded-lg bg-[#4A6079] px-4 text-sm font-semibold text-white hover:bg-[#35475C]"
                >
                  <Plus size={14} className="mr-1.5" aria-hidden="true" /> Create group
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {groupsForSelectedUnit.map((group) => {
                  const isPending = pendingRequestsForUnit.has(String(group.id));
                  const isMember = group.is_member;
                  const isFull = group.is_full;
                  const isLocked = group.is_locked;
                  return (
                    <div key={group.id} className="rounded-xl border border-[#D7DEE6] bg-white p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1F2D3D]">{group.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${isMember ? 'bg-[#E3EAF2] text-[#35475C]' : 'bg-[#EEF1F4] text-[#4F5F73]'}`}>
                            {pluralize(group.members_count, 'member')} / {group.max_members || '∞'}
                          </span>
                          <span className={`text-[10px] font-semibold ${isLocked ? 'text-red-600' : isFull ? 'text-[#4A6079]' : 'text-[#35475C]'}`}>
                            {isLocked ? 'Locked' : isFull ? 'Full' : isMember ? 'Member' : 'Open'}
                          </span>
                        </div>
                        <span className="text-xs text-[#4F5F73]">Led by {group.leader_name}</span>
                      </div>
                      {isMember ? (
                        <button
                          type="button"
                          onClick={() => openGroupDetails(group)}
                          className="w-full h-10 rounded-lg bg-[#4A6079] px-4 text-sm font-semibold text-white hover:bg-[#35475C]"
                        >
                          Open workspace
                        </button>
                      ) : isPending ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#4F5F73]">Request sent</span>
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(group.id)}
                            className="text-[11px] font-semibold text-[#4A6079] underline hover:text-[#35475C]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isFull ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-[#E3EAF2] px-2 py-0.5 text-[#35475C]">
                          Full — cannot join
                        </span>
                      ) : isLocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-[#FEE2E2] px-2 py-0.5 text-red-700">
                          Locked — not accepting members
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestJoin(group.id)}
                          className="w-full h-10 rounded-lg border border-[#D7DEE6] bg-white px-4 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4]"
                        >
                          Request to join
                        </button>
                      )}
                    </div>
                  )
                }
                )}
              </div>
            )}
          </section>
        </section>
      )}

      {/* All units list */}
      <section className="rounded-xl border border-[#D5DDE6] bg-white p-6">
        <h3 className="text-base font-bold text-[#1F2D3D] mb-4">All your units</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {units.map((unit) => {
            const userGroup = groups.find((g) => String(g.unit_id) === String(unit.id));
            const isSelected = String(unit.id) === selectedUnitId;
            return (
              <article
                key={unit.id}
                className={`rounded-xl border p-4 transition-colors cursor-pointer ${isSelected ? 'border-[#4A6079] bg-[#EEF1F4]' : 'border-[#D5DDE6] bg-white hover:bg-[#EEF1F4] hover:shadow-sm'}`}
                onClick={() => navigate(`/student/units/${unit.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/student/units/${unit.id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="block font-mono font-bold text-[#35475C] uppercase text-sm">{unit.code}</span>
                  <ChevronRight size={14} className={`text-[#4A6079] ${isSelected ? 'text-[#35475C]' : ''}`} aria-hidden="true" />
                </div>
                <h4 className="block text-sm font-semibold text-[#1F2D3D]">{unit.name}</h4>
                <p className="mt-0.5 text-[11px] text-[#4F5F73]">{academicText}</p>
                {userGroup && (
                  <div className="mt-3 flex items-center gap-2">
                    <Users size={14} className="text-[#4A6079]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[#35475C]">Your group: {userGroup.name}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
};

export default MyUnits;

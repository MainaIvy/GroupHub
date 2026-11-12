import React, { useState, useEffect, useMemo } from 'react';
import { Table } from 'antd';
import { BookOpen, ChevronDown, ChevronRight, Users, Plus, ExternalLink } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { pluralize } from '../utils';
import axios from '../../api';

const MyUnits = ({ ctx }) => {
  const { groups, setActiveTab, openGroupDetails } = ctx;
  const [expandedUnits, setExpandedUnits] = useState({});
  const [unitGroups, setUnitGroups] = useState({});
  const [loadingGroups, setLoadingGroups] = useState({});

  const fetchUnitGroups = async (unitId) => {
    setLoadingGroups(prev => ({ ...prev, [unitId]: true }));
    try {
      // Use the endpoint that returns open groups for the unit
      const response = await axios.get(`/api/accounts/units/${unitId}/groups/`);
      setUnitGroups(prev => ({ ...prev, [unitId]: response.data || [] }));
    } catch (err) {
      console.error('Failed to load unit groups:', err);
      setUnitGroups(prev => ({ ...prev, [unitId]: [] }));
    } finally {
      setLoadingGroups(prev => ({ ...prev, [unitId]: false }));
    }
  };

  const toggleExpand = (unitId) => {
    setExpandedUnits(prev => ({ ...prev, [unitId]: !prev[unitId] }));
    if (!expandedUnits[unitId] && !unitGroups[unitId]) {
      fetchUnitGroups(unitId);
    }
  };

  const getUserGroupForUnit = (unitId) => {
    return groups.find(group => String(group.unit_id) === String(unitId));
  };

  const unitsWithGroups = useMemo(() => {
    return ctx.visibleUnits.map(unit => ({
      ...unit,
      userGroup: getUserGroupForUnit(unit.id),
    }));
  }, [ctx.visibleUnits, groups]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="My units"
        subtitle={ctx.academic ? `${ctx.academic.course_name} · Year ${ctx.academic.year_of_study} · Semester ${ctx.academic.semester}` : 'Your current academic enrollment.'}
      />
      {ctx.dashboardError ? <ErrorState message={ctx.dashboardError} onRetry={ctx.reloadDashboard} /> : unitsWithGroups.length ? (
        <Table
          rowKey="id"
          dataSource={unitsWithGroups}
          pagination={false}
          scroll={{ x: 700 }}
          expandedRowRender={(record) => expandedUnits[record.id] ? (
            <div className="p-4 space-y-3 bg-[#F8FAFC]">
              {loadingGroups[record.id] ? (
                <LoadingState label="Loading groups…" rows={2} />
              ) : unitGroups[record.id] && unitGroups[record.id].length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[#1F2D3D] flex items-center gap-2">
                    <Users size={14} className="text-[#4A6079]" aria-hidden="true" />
                    Open groups in this unit
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {unitGroups[record.id].map((group) => (
                      <div key={group.id} className="rounded-lg border border-[#D7DEE6] bg-white p-3 hover:border-[#4A6079] transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#1F2D3D]">{group.name}</span>
                            <span className="rounded-full bg-[#EEF1F4] px-2 py-0.5 text-[12px] font-semibold text-[#33445A]">
                              {pluralize(group.members_count, 'member')} / {group.max_members || '∞'}
                            </span>
                          </div>
                          {group.request_pending ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-700">Request pending</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openGroupDetails(group)}
                              className="h-8 rounded-lg border border-[#D7DEE6] px-3 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4]"
                            >
                              Request to join
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#4F5F73]">Led by {group.leader_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-[#4F5F73]">No open groups in this unit yet.</p>
                  <p className="mt-1 text-xs text-[#64748B]">Create a group from the Groups page to start one.</p>
                </div>
              )}
            </div>
          ) : null}
          columns={[
            {
              title: 'Unit code',
              dataIndex: 'code',
              key: 'code',
              width: 120,
              render: (code) => <span className="font-mono text-sm font-semibold text-[#35475C]">{code}</span>,
            },
            {
              title: 'Unit name',
              dataIndex: 'name',
              key: 'name',
              width: 280,
              render: (name) => <span className="text-sm font-medium capitalize text-[#1F2D3D]">{name}</span>,
            },
            {
              title: 'Group',
              key: 'group',
              width: 200,
              render: (_, unit) => {
                const userGroup = unit.userGroup;
                if (userGroup) {
                  return (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-[#33445A]">
                        <Users size={14} className="text-[#4A6079]" aria-hidden="true" />
                        {userGroup.name}
                      </span>
                      <span className="text-xs text-[#4F5F73]">{pluralize(userGroup.members_count || 0, 'member')}</span>
                      <button
                        type="button"
                        onClick={() => openGroupDetails(userGroup)}
                        className="ml-2 h-8 rounded-lg border border-[#D7DEE6] px-3 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4]"
                      >
                        Open
                      </button>
                    </div>
                  );
                }
                return (
                  <span className="flex items-center gap-1.5 text-sm text-[#4F5F73]">
                    <Users size={14} className="opacity-50" aria-hidden="true" />
                    No group yet
                  </span>
                );
              },
            },
            {
              title: '',
              key: 'expand',
              width: 56,
              render: (_, unit) => (
                <button
                  type="button"
                  onClick={() => toggleExpand(unit.id)}
                  aria-expanded={expandedUnits[unit.id]}
                  aria-label={expandedUnits[unit.id] ? 'Collapse' : 'Expand'}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4] hover:text-[#1F2D3D]"
                >
                  {expandedUnits[unit.id] ? (
                    <ChevronUp size={16} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} aria-hidden="true" />
                  )}
                </button>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState
          icon={BookOpen}
          title={ctx.units.length ? 'No units match your search' : 'No units to show yet'}
          description={ctx.units.length ? 'Try a different search term.' : 'Units appear once your course, year and semester are set in Settings.'}
          actionLabel={ctx.units.length ? undefined : 'Go to Settings'}
          onAction={ctx.units.length ? undefined : () => setActiveTab('settings')}
        />
      )}
    </section>
  );
};

export default MyUnits;
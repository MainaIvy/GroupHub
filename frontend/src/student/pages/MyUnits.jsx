import React from 'react';
import { Table } from 'antd';
import { BookOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { pluralize } from '../utils';

const MyUnits = ({ ctx }) => {
  const { groups, units, academic, visibleUnits, openGroupDetails, setActiveTab, dashboardError, reloadDashboard } = ctx;

  return (
    <section className="space-y-6">
      <PageHeader
        title="My units"
        subtitle={academic ? `${academic.course_name} · Year ${academic.year_of_study} · Semester ${academic.semester}` : 'Your current academic enrollment.'}
      />
      {dashboardError ? <ErrorState message={dashboardError} onRetry={reloadDashboard} /> : visibleUnits.length ? (
        <Table
          rowKey="id"
          dataSource={visibleUnits}
          pagination={false}
          scroll={{ x: 560 }}
          columns={[
            { title: 'Unit code', dataIndex: 'code', key: 'code', width: 140, render: (code) => <span className="font-mono text-sm font-semibold text-[#35475C]">{code}</span> },
            { title: 'Unit name', dataIndex: 'name', key: 'name', render: (name) => <span className="text-sm font-medium capitalize text-[#1F2D3D]">{name}</span> },
            {
              title: 'Group',
              key: 'group',
              render: (_, unit) => {
                const unitGroup = groups.find((group) => String(group.unit_id) === String(unit.id));
                return unitGroup ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-[#33445A]">{unitGroup.name} · {pluralize(unitGroup.members_count || 0, 'member')}</span>
                    <button type="button" onClick={() => openGroupDetails(unitGroup)} className="h-10 rounded-lg border border-[#D7DEE6] px-4 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4]">Open</button>
                  </div>
                ) : <span className="text-sm text-[#4F5F73]">No group yet</span>;
              },
            },
          ]}
        />
      ) : (
        <EmptyState
          icon={BookOpen}
          title={units.length ? 'No units match your search' : 'No units to show yet'}
          description={units.length ? 'Try a different search term.' : 'Units appear once your course, year and semester are set in Settings.'}
          actionLabel={units.length ? undefined : 'Go to Settings'}
          onAction={units.length ? undefined : () => setActiveTab('settings')}
        />
      )}
    </section>
  );
};

export default MyUnits;

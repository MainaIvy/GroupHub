import React, { useEffect, useState } from 'react';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  DownloadOutlined,
  FileDoneOutlined,
  FileOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LogoutOutlined,
  NotificationOutlined,
  PlusOutlined,
  ReadOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  UserAddOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { API_BASE } from '../apiConfig';

/*
  Palette (modern indigo/slate):
    bg      #F8FAFC   page background
    card    #FFFFFF   panels and stat cards
    ink     #0F172A   text, rail, primary buttons
    indigo  #4F46E5   primary actions, active rail icon
    indigoL #E0E7FF   soft fills
    line    #E2E8F0   borders
    muted   #64748B   secondary text
    success #10B981   success states
    warning #F59E0B   warning states
    danger  #EF4444   danger states
*/

const tokenHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });

const tabs = [
  'Overview',
  'Users',
  'Lecturers',
  'Import',
  'Import History',
  'Units',
  'Units and lecturers',
  'Groups',
  'Catalog',
  'Settings',
  'Announcements',
  'Audit log',
];

const tabIcons = {
  Overview: <DashboardOutlined />,
  Users: <UserOutlined />,
  Lecturers: <UserAddOutlined />,
  Import: <UploadOutlined />,
  'Import History': <HistoryOutlined />,
  Units: <WarningOutlined />,
  'Units and lecturers': <ReadOutlined />,
  Groups: <UsergroupAddOutlined />,
  Catalog: <AppstoreOutlined />,
  Settings: <SettingOutlined />,
  Announcements: <NotificationOutlined />,
  'Audit log': <AuditOutlined />,
};

const endpoints = {
  Overview: `${API_BASE}/api/accounts/admin/overview/`,
  Users: `${API_BASE}/api/accounts/admin/users/`,
  Lecturers: `${API_BASE}/api/accounts/admin/rosters/`,
  Import: `${API_BASE}/api/accounts/admin/roster/template/`,
  'Import History': `${API_BASE}/api/accounts/admin/import/history/`,
  'Units and lecturers': `${API_BASE}/api/accounts/admin/assignments/`,
  Groups: `${API_BASE}/api/accounts/admin/groups/`,
  Catalog: `${API_BASE}/api/accounts/admin/catalog/`,
  Settings: `${API_BASE}/api/accounts/admin/settings/`,
  Announcements: `${API_BASE}/api/accounts/admin/announcements/`,
  'Audit log': `${API_BASE}/api/accounts/admin/audit/`,
};

const ui = {
  input:
    'rounded-xl border border-[#CBD5E1] bg-white p-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#4F46E5] focus:ring-2 focus-ring-[#4F46E5]/15',
  primary:
    'rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] disabled:opacity-50',
  ghost:
    'rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-[#F1F5F9]',
};

const STATUS_COLORS = { active: '#10B981', approved: '#10B981', pending: '#F59E0B', suspended: '#EF4444' };

function StatusDot({ value }) {
  const key = String(value ?? '').toLowerCase();
  return (
    <span className="inline-flex items-center gap-2 capitalize">
      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[key] || '#94A3B8' }} />
      {value ?? '—'}
    </span>
  );
}

function Stat({ label, value, icon, highlight }) {
  return (
    <div
      className={`flex items-center justify-between rounded-3xl p-5 shadow-sm ${
        highlight ? 'bg-[#0F172A] text-white' : 'bg-white text-[#0F172A]'
      }`}
    >
      <div>
        <p className="text-3xl font-bold">{value ?? '—'}</p>
        <p className={`mt-1 text-sm ${highlight ? 'text-white/60' : 'text-[#64748B]'}`}>{label}</p>
      </div>
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
          highlight ? 'bg-[#4F46E5] text-[#0F172A]' : 'bg-[#E0E7FF] text-[#0F172A]'
        }`}
      >
        {icon}
      </span>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#0F172A]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SeeAll({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4338CA]"
    >
      See all <ArrowRightOutlined />
    </button>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [state, setState] = useState({ loading: true, error: '' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [greeting, setGreeting] = useState('');

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    setGreeting(`${timeGreeting}, Administrator`);
  }, [timeGreeting]);

  const load = async (activeTab = tab) => {
    setState({ loading: true, error: '' });
    try {
      const url =
        activeTab === 'Users' && search
          ? `${endpoints[activeTab]}?search=${encodeURIComponent(search)}`
          : endpoints[activeTab];
      const response = await fetch(url, { headers: tokenHeaders() });
      let payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.detail || 'Unable to load administrator data.');
      if (activeTab === 'Overview') {
        const unassignedResponse = await fetch(`${API_BASE}/api/accounts/admin/assignments/unassigned/`, { headers: tokenHeaders() });
        payload.unassigned = await unassignedResponse.json().catch(() => []);
      }
      if (activeTab === 'Units and lecturers') {
        const [catalogResponse, usersResponse, pendingResponse, unassignedResponse, termsResponse] = await Promise.all([
          fetch(`${API_BASE}/api/accounts/admin/catalog/`, { headers: tokenHeaders() }),
          fetch(`${API_BASE}/api/accounts/admin/users/?user_type=lecturer`, { headers: tokenHeaders() }),
          fetch(`${API_BASE}/api/accounts/admin/assignments/pending/`, { headers: tokenHeaders() }),
          fetch(`${API_BASE}/api/accounts/admin/assignments/unassigned/`, { headers: tokenHeaders() }),
          fetch(`${API_BASE}/api/accounts/admin/terms/`, { headers: tokenHeaders() }),
        ]);
        payload = {
          assignments: payload,
          catalog: await catalogResponse.json(),
          lecturers: (await usersResponse.json()).filter((user) => user.user_type === 'lecturer'),
          pending: await pendingResponse.json(),
          unassigned: await unassignedResponse.json(),
          terms: await termsResponse.json(),
        };
      }
      if (activeTab === 'Lecturers') {
        const rostersResponse = await fetch(`${API_BASE}/api/accounts/admin/rosters/`, { headers: tokenHeaders() });
        payload = await rostersResponse.json().catch(() => []);
      }
      if (activeTab === 'Import History') {
        const historyResponse = await fetch(`${API_BASE}/api/accounts/admin/import/history/`, { headers: tokenHeaders() });
        payload = await historyResponse.json().catch(() => []);
      }
      if (activeTab === 'Units') {
        const unassignedResponse = await fetch(`${API_BASE}/api/accounts/admin/assignments/unassigned/`, { headers: tokenHeaders() });
        payload = await unassignedResponse.json().catch(() => []);
      }
      setData(payload);
    } catch (requestError) {
      setState({ loading: false, error: requestError.message });
      return;
    }
    setState({ loading: false, error: '' });
  };

  useEffect(() => {
    load();
  }, [tab]);

  // Switch tab (or reload it when it is already open).
  const goTo = (name) => {
    if (name === tab) {
      load(name);
      return;
    }
    setTab(name);
    setData(null);
  };

  const runSearch = () => {
    if (tab !== 'Users') goTo('Users');
    else load('Users');
  };

  const action = async (url, options = {}) => {
    if (options.confirm && !window.confirm(options.confirm)) return;
    const response = await fetch(url, { ...options, headers: { ...tokenHeaders(), 'Content-Type': 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState({ loading: false, error: payload.error || 'Action failed.' });
      return;
    }
    load();
  };

  const downloadExport = async (type) => {
    const response = await fetch(`${API_BASE}/api/accounts/admin/export/${type}/`, { headers: tokenHeaders() });
    if (!response.ok) {
      setState({ loading: false, error: 'Export failed.' });
      return;
    }
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${type}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const renderTable = (rows, columns) => (
    <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            {columns.map((column) => (
              <th key={column.key} className="px-5 py-4">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows?.map((row) => (
            <tr key={row.id} className="border-b border-[#E2E8F0] text-[#0F172A] last:border-0 hover:bg-[#F1F5F9]">
              {columns.map((column) => (
                <td key={column.key} className="px-5 py-3.5">
                  {column.render ? column.render(row) : (row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows?.length && <p className="p-10 text-center text-[#64748B]">No records found.</p>}
    </div>
  );

  const quickActions = [
    { label: 'Add a user', icon: <PlusOutlined />, run: () => { setShowCreateUser(true); goTo('Users'); } },
    { label: 'Import the catalogue', icon: <UploadOutlined />, run: () => goTo('Catalog') },
    { label: 'Post an announcement', icon: <NotificationOutlined />, run: () => goTo('Announcements') },
  ];

  // data is null for a moment after switching tabs, so treat that as loading.
  const waiting = state.loading || (data == null && !state.error);

  let content = null;
  if (waiting) {
    content = (
      <div className="rounded-3xl bg-white p-12 text-center text-[#64748B] shadow-sm">
        Loading {tab.toLowerCase()}...
      </div>
    );
  } else if (state.error) {
    content = (
      <div className="rounded-3xl bg-[#FEE2E2] p-5 text-[#EF4444]">
        {state.error}{' '}
        <button type="button" onClick={() => load()} className="ml-3 font-semibold underline">
          Retry
        </button>
      </div>
    );
  } else if (tab === 'Overview') {
    content = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Users" value={data.users} icon={<TeamOutlined />} />
          <Stat label="Groups" value={data.groups} icon={<UsergroupAddOutlined />} />
          <Stat label="Tasks" value={data.tasks} icon={<CheckSquareOutlined />} />
          <Stat label="Submissions" value={data.submissions} icon={<FileDoneOutlined />} highlight />
          <Stat
            label="Units w/o lecturer (current term)"
            value={data.unassigned?.length ?? 0}
            icon={<WarningOutlined />}
            highlight
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel title="At-risk groups" action={<SeeAll onClick={() => goTo('Groups')} />}>
              {data.at_risk_groups?.length ? (
                <ul className="divide-y divide-[#E2E8F0]">
                  {data.at_risk_groups.map((group) => (
                    <li key={group.id} className="flex items-center justify-between py-3 text-sm">
                      <span className="font-medium text-[#0F172A]">{group.name}</span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-semibold text-[#EF4444]">
                        <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                        At risk
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[#64748B]">
                  <CheckCircleOutlined className="text-3xl text-[#10B981]" />
                  No at-risk groups. Every group is on track.
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Quick actions">
            <ul className="space-y-2">
              {quickActions.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={item.run}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-sm text-[#0F172A] transition hover:bg-[#F1F5F9]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E0E7FF] text-[#0F172A]">
                      {item.icon}
                    </span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    <ArrowRightOutlined className="text-xs text-[#C9A227]" />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </>
    );
  } else if (tab === 'Catalog') {
    content = (
      <>
        <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            action(`${API_BASE}/api/accounts/admin/catalog/import/`, { method: 'POST', confirm: 'Import the Excel catalogue now?' })
          }
          className={ui.primary}
        >
          Run Excel import
        </button>
      </div>
        {renderTable(data?.units, [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Unit' },
          { key: 'course__name', label: 'Programme' },
          { key: 'year_of_study', label: 'Year' },
          { key: 'semester', label: 'Semester' },
        ])}
      </>
    );
  } else if (tab === 'Settings') {
    content = (
      <SettingsForm
        values={data}
        onSave={(values) => action(endpoints.Settings, { method: 'PUT', body: JSON.stringify(values) })}
      />
    );
  } else if (tab === 'Announcements') {
    content = (
      <AnnouncementForm
        onSave={(values) => action(endpoints.Announcements, { method: 'POST', body: JSON.stringify(values) })}
      />
    );
  } else if (tab === 'Users') {
    content = (
      <>
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowCreateUser((visible) => !visible)} className={ui.primary}>
            {showCreateUser ? 'Close form' : '＋ Add user'}
          </button>
          <button type="button" onClick={() => downloadExport('users')} className={ui.ghost}>
            Export users
          </button>
        </div>
        {showCreateUser && (
          <UserCreateForm
            onCreated={() => {
              setShowCreateUser(false);
              load();
            }}
          />
        )}
        {renderTable(data, [
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', render: (row) => <span className="capitalize">{row.role ?? '—'}</span> },
          { key: 'status', label: 'Status', render: (row) => <StatusDot value={row.status} /> },
          {
            key: 'id',
            label: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {row.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => action(`${API_BASE}/api/accounts/admin/users/${row.id}/approve/`, { method: 'POST' })}
                    className="rounded-lg bg-[#E0E7FF] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#FCD34D]"
                  >
                    Approve
                  </button>
                )}
                {row.status === 'suspended' ? (
                  <button
                    type="button"
                    onClick={() => action(`${API_BASE}/api/accounts/admin/users/${row.id}/reactivate/`, { method: 'POST' })}
                    className="rounded-lg bg-[#D1FAE5] px-3 py-1.5 text-xs font-semibold text-[#047857] hover:bg-[#A7F3D0]"
                  >
                    Reactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      action(`${API_BASE}/api/accounts/admin/users/${row.id}/suspend/`, { method: 'POST', confirm: 'Suspend this user?' })
                    }
                    className="rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-xs font-semibold text-[#EF4444] hover:bg-[#FECACA]"
                  >
                    Suspend
                  </button>
                )}
              </div>
            ),
          },
        ])}
      </>
    );
  } else if (tab === 'Units and lecturers') {
    content = <AssignmentManager data={data} onAction={action} onReload={() => load()} />;
  } else if (tab === 'Lecturers') {
    content = <LecturersManager onReload={() => load()} />;
  } else if (tab === 'Import') {
    content = <ImportManager onReload={() => load()} />;
  } else if (tab === 'Import History') {
    content = <ImportHistoryManager onReload={() => load()} />;
  } else if (tab === 'Units') {
    content = <UnitsManager />;
  } else if (tab === 'Groups') {
    content = <GroupsManager data={data} onAction={action} />;
  } else {
    content = renderTable(data, [
      { key: 'actor', label: 'Actor' },
      { key: 'action', label: 'Action' },
      { key: 'target_type', label: 'Target' },
      { key: 'created_at', label: 'Created' },
    ]);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="flex min-h-screen">
        {/* Collapsible sidebar */}
        <aside
          className={`sticky top-2 z-30 m-2 flex h-[calc(100vh-1rem)] flex-col items-center self-start rounded-[28px] bg-[#0F172A] py-4 text-white sm:top-3 sm:m-3 sm:h-[calc(100vh-1.5rem)] transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-14'
          }`}
        >
          <div className="mb-6 flex items-center justify-between px-3">
            <div className="flex h-10 w-10 items-center justify-center text-2xl text-[#4F46E5]">
              <TeamOutlined />
            </div>
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
              >
                <ArrowRightOutlined className="text-sm" />
              </button>
            )}
          </div>

          {sidebarOpen && (
            <div className="px-2">
              <h2 className="px-3 mb-4 text-sm font-semibold text-[#4F46E5] tracking-wider uppercase">GroupHub Admin</h2>
            </div>
          )}

          <nav className="flex flex-1 flex-col items-center gap-1">
            {tabs.map((item) => {
              const active = tab === item;
              return (
                <div key={item} className="group relative w-full">
                  <button
                    type="button"
                    aria-label={item}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => goTo(item)}
                    className={`flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-lg transition ${
                      active
                        ? 'bg-[#4F46E5]/10 text-[#4F46E5]'
                        : 'text-[#94A3B8] hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tabIcons[item]}
                    {sidebarOpen && <span className="flex-1 text-sm font-medium">{item}</span>}
                  </button>
                  {sidebarOpen && (
                    <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">
                      {item}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>

          {sidebarOpen && (
            <div className="mt-auto px-3 pb-4">
              <p className="text-xs text-[#94A3B8] mb-3">{greeting}</p>
              <button
                type="button"
                onClick={() => {
                  localStorage.clear();
                  window.location.href = '/login';
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                <LogoutOutlined className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}

          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
              title="Collapse sidebar"
            >
              <ArrowLeftOutlined className="text-sm" />
            </button>
          )}
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-4 px-3 py-5 sm:px-4 md:px-8">
            <h2 className="text-xl font-bold md:text-2xl">{tab === 'Overview' ? 'Dashboard' : tab}</h2>

            <div className="mx-auto hidden w-full max-w-sm items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 sm:flex">
              <SearchOutlined className="text-[#64748B]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && runSearch()}
                placeholder="Search users"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#B3ADA5]"
              />
            </div>

            <div className="ml-auto flex items-center gap-3 sm:ml-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F172A] text-sm font-bold text-[#4F46E5]">
                A
              </span>
              <div className="hidden leading-tight lg:block">
                <p className="text-sm font-semibold">{greeting || 'Administrator'}</p>
                <p className="text-xs text-[#64748B]">Zetech University</p>
              </div>
            </div>
          </header>

          <main className="p-3 pt-1 sm:p-4 sm:pt-1 md:p-8 md:pt-1">{content}</main>
        </div>
      </div>
    </div>
  );
}

function SettingsForm({ values, onSave }) {
  const [form, setForm] = useState(values);
  const fields = [
    ['allowed_email_domain', 'Allowed email domain'],
    ['default_group_size', 'Default group size'],
    ['minimum_points', 'Minimum points'],
    ['warning', 'Warning threshold (%)'],
    ['critical', 'Critical threshold (%)'],
    ['quiet_days', 'Quiet days'],
    ['overdue_count', 'Overdue task count'],
    ['file_size_limit', 'File size limit (MB)'],
  ];
  return (
    <div className="max-w-xl rounded-3xl bg-white p-6 shadow-sm">
      <div className="grid gap-4">
        {fields.map(([key, label]) => (
          <label key={key} className="text-sm font-medium text-[#0F172A]">
            {label}
            <input
              type={key === 'file_size_limit' ? 'number' : 'text'}
              className={`mt-1 w-full ${ui.input}`}
              value={form?.[key] ?? ''}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSave({ ...form, file_size_limit: form?.file_size_limit ? Number(form.file_size_limit) * 1024 * 1024 : form?.file_size_limit })}
        className={`mt-5 ${ui.primary}`}
      >
        Save settings
      </button>
    </div>
  );
}

function AnnouncementForm({ onSave }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  return (
    <div className="max-w-xl rounded-3xl bg-white p-6 shadow-sm">
      <div className="grid gap-4">
        <input
          className={ui.input}
          placeholder="Title"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <textarea
          className={ui.input}
          placeholder="Message"
          rows="6"
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
        />
        <select
          className={ui.input}
          value={form.audience}
          onChange={(event) => setForm({ ...form, audience: event.target.value })}
        >
          <option value="all">Everyone</option>
          <option value="programme">Programme</option>
          <option value="unit">Unit</option>
        </select>
      </div>
      <button type="button" onClick={() => onSave(form)} className={`mt-5 ${ui.primary}`}>
        Send announcement
      </button>
    </div>
  );
}

function AssignmentManager({ data, onAction, onReload }) {
  const [form, setForm] = useState({ lecturer_id: '', unit_id: '', term_id: '' });
  const units = data.catalog?.units || [];
  const addAssignment = (event) => {
    event.preventDefault();
    onAction(`${API_BASE}/api/accounts/admin/assignments/`, {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setForm({ lecturer_id: '', unit_id: '', term_id: '' });
  };
  return (
    <div className="space-y-5">
      <form onSubmit={addAssignment} className="grid gap-3 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-4">
        <select
          required
          value={form.lecturer_id}
          onChange={(event) => setForm({ ...form, lecturer_id: event.target.value })}
          className={ui.input}
        >
          <option value="">Lecturer</option>
          {(data.lecturers || []).map((lecturer) => (
            <option key={lecturer.id} value={lecturer.id}>
              {lecturer.name} · {lecturer.staff_id}
            </option>
          ))}
        </select>
        <select
          required
          value={form.unit_id}
          onChange={(event) => setForm({ ...form, unit_id: event.target.value })}
          className={ui.input}
        >
          <option value="">Unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.code} · {unit.name} · {unit.course__name}
            </option>
          ))}
        </select>
        <select
          required
          value={form.term_id}
          onChange={(event) => setForm({ ...form, term_id: event.target.value })}
          className={ui.input}
        >
          <option value="">Year & semester</option>
          {(data.catalog?.terms || []).map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
        <button type="submit" className={ui.primary}>
          ＋ Assign unit
        </button>
      </form>

      {renderLoadCards(data.lecturers)}

      <Panel title="Units with no lecturer">
        <div className="flex flex-wrap gap-2">
          {(data.unassigned || []).map((unit) => (
            <span key={unit.id} className="rounded-full bg-[#E0E7FF] px-3 py-1 text-xs font-semibold text-[#0F172A]">
              {unit.code} · {unit.course__name}
            </span>
          ))}
          {!(data.unassigned || []).length && <p className="text-sm text-[#64748B]">Every unit has a lecturer.</p>}
        </div>
      </Panel>

      <Panel title="Academic terms">
        <div className="space-y-2">
          {(data.terms || []).map((term) => (
            <div key={term.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm">
              <span className="font-semibold text-[#0F172A]">{term.name} {term.is_current && <span className="ml-2 rounded-full bg-[#10B981] px-2 py-0.5 text-[10px] text-white">Current</span>}</span>
              {!term.is_current && (
                <button type="button" onClick={() => onAction(`${API_BASE}/api/accounts/admin/terms/${term.id}/make_current/`, { method: 'POST' })} className="rounded-lg border border-[#CBD5E1] px-3 py-1 text-xs font-semibold">Make current</button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onAction(`${API_BASE}/api/accounts/admin/rollover/`, { method: 'POST', body: JSON.stringify({ confirm: true }), confirm: 'Roll over the current term? Students advance a semester, groups are archived, and approved assignments are copied as pending.' })}
          className={`mt-4 ${ui.primary}`}
        >
          Roll over current term
        </button>
      </Panel>

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              <th className="px-5 py-4">Lecturer</th>
              <th className="px-5 py-4">Unit</th>
              <th className="px-5 py-4">Term</th>
              <th className="px-5 py-4">Load</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data.assignments || []).map((row) => (
              <tr key={row.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F1F5F9]">
                <td className="px-5 py-3.5">
                  {row.lecturer?.name}
                  <span className="block text-xs text-[#64748B]">{row.lecturer?.staff_id}</span>
                </td>
                <td className="px-5 py-3.5">
                  {row.unit_code} · {row.unit}
                </td>
                <td className="px-5 py-3.5">{row.term}</td>
                <td className="px-5 py-3.5">{row.lecturer_load} units</td>
                <td className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      onAction(`${API_BASE}/api/accounts/admin/assignments/${row.id}/`, {
                        method: 'DELETE',
                        confirm: 'Remove this unit assignment?',
                      })
                    }
                    className="rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-xs font-semibold text-[#EF4444] hover:bg-[#FECACA]"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(data.assignments || []).length && <p className="p-10 text-center text-[#64748B]">No lecturer assignments yet.</p>}
      </div>

      <button type="button" onClick={onReload} className={ui.ghost}>
        Refresh assignments
      </button>
    </div>
  );
}

function renderLoadCards(lecturers = []) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lecturers.map((lecturer) => (
        <div key={lecturer.id} className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-[#0F172A]">{lecturer.name}</p>
          <p className="text-xs text-[#64748B]">{lecturer.staff_id || lecturer.email}</p>
          <p className="mt-3 text-2xl font-bold text-[#0F172A]">
            {lecturer.load_count ?? '—'} <span className="text-sm font-normal text-[#64748B]">assigned units</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function UserCreateForm({ onCreated }) {
  const [catalog, setCatalog] = useState({ departments: [], programmes: [], units: [], terms: [] });
  const [role, setRole] = useState('lecturer');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    staff_id: '',
    admission_number: '',
    department: '',
    course_id: '',
    level: '',
    unit_id: '',
    term_id: '',
    year: '',
    semester: '',
  });
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/accounts/admin/catalog/`, { headers: tokenHeaders() })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Unable to load the academic catalogue.'))))
      .then(setCatalog)
      .catch((requestError) => setError(requestError.message));
  }, []);

  const courses = catalog.programmes.filter((course) => !form.department || course.department === form.department);
  const selectedTerm = catalog.terms.find((term) => String(term.id) === String(form.term_id));
  const courseUnits = catalog.units.filter(
    (unit) =>
      String(unit.course_id) === String(form.course_id) &&
      (!form.level || unit.academic_level === form.level) &&
      (!selectedTerm ||
        (String(unit.year_of_study) === String(selectedTerm.year) && String(unit.semester) === String(selectedTerm.semester))),
  );
  const levels = [
    ...new Set(
      catalog.units
        .filter((unit) => String(unit.course_id) === String(form.course_id))
        .map((unit) => unit.academic_level)
        .filter(Boolean),
    ),
  ];

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const addAssignment = () => {
    const unit = courseUnits.find((item) => String(item.id) === String(form.unit_id));
    const term = catalog.terms.find((item) => String(item.id) === String(form.term_id));
    if (!unit || !term || assignments.some((item) => item.unit_id === unit.id && item.term_id === term.id)) return;
    setAssignments((current) => [
      ...current,
      { unit_id: unit.id, term_id: term.id, label: `${unit.code} · ${unit.name} — ${term.name}` },
    ]);
    update('unit_id', '');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form, user_type: role, assignments };
    const response = await fetch(`${API_BASE}/api/accounts/admin/users/create/`, {
      method: 'POST',
      headers: { ...tokenHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(result.error || 'Unable to create user.');
      return;
    }
    onCreated();
  };

  const departmentSelect = (
    <select
      required
      value={form.department}
      onChange={(event) => {
        update('department', event.target.value);
        update('course_id', '');
      }}
      className={ui.input}
    >
      <option value="">Department</option>
      {catalog.departments.map((department) => (
        <option key={department} value={department}>
          {department}
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={submit} className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#0F172A]">Create account</h3>
          <p className="text-sm text-[#64748B]">Use the catalogue to assign the correct academic structure.</p>
        </div>
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setAssignments([]);
          }}
          className={ui.input}
        >
          <option value="lecturer">Lecturer</option>
          <option value="student">Student</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input required placeholder="Full name" value={form.full_name} onChange={(event) => update('full_name', event.target.value)} className={ui.input} />
        <input required type="email" placeholder="Email address" value={form.email} onChange={(event) => update('email', event.target.value)} className={ui.input} />
        <input required type="password" placeholder="Temporary password" value={form.password} onChange={(event) => update('password', event.target.value)} className={ui.input} />

        {role === 'lecturer' ? (
          <>
            <input required placeholder="Staff ID" value={form.staff_id} onChange={(event) => update('staff_id', event.target.value)} className={ui.input} />
            {departmentSelect}
            <select
              required
              value={form.course_id}
              onChange={(event) => {
                update('course_id', event.target.value);
                update('level', '');
                update('term_id', '');
              }}
              className={ui.input}
            >
              <option value="">Course / programme</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.name}
                </option>
              ))}
            </select>
            <select
              value={form.level}
              onChange={(event) => {
                update('level', event.target.value);
                update('term_id', '');
              }}
              className={ui.input}
            >
              <option value="">Academic level</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <select
              value={form.term_id}
              onChange={(event) => {
                update('term_id', event.target.value);
                update('unit_id', '');
              }}
              className={ui.input}
            >
              <option value="">Year & semester</option>
              {catalog.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
            <select value={form.unit_id} onChange={(event) => update('unit_id', event.target.value)} className={ui.input}>
              <option value="">Unit</option>
              {courseUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  Year {unit.year_of_study}, Sem {unit.semester} · {unit.code} · {unit.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={addAssignment} className={ui.ghost}>
              ＋ Add unit
            </button>
          </>
        ) : (
          <>
            <input required placeholder="Admission number" value={form.admission_number} onChange={(event) => update('admission_number', event.target.value)} className={ui.input} />
            {departmentSelect}
            <select required value={form.course_id} onChange={(event) => update('course_id', event.target.value)} className={ui.input}>
              <option value="">Course / programme</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.name}
                </option>
              ))}
            </select>
            <select required value={form.year} onChange={(event) => update('year', event.target.value)} className={ui.input}>
              <option value="">Year of study</option>
              {[...new Set(courseUnits.map((unit) => unit.year_of_study))].sort().map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
            <select required value={form.semester} onChange={(event) => update('semester', event.target.value)} className={ui.input}>
              <option value="">Semester</option>
              {[1, 2].map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {role === 'lecturer' && (
        <div className="mt-4 rounded-xl bg-[#F1F5F9] p-3 text-sm">
          {assignments.length ? (
            assignments.map((assignment) => (
              <div key={`${assignment.unit_id}-${assignment.term_id}`} className="flex items-center justify-between border-b border-[#E2E8F0] py-2 last:border-0">
                <span>{assignment.label}</span>
                <button
                  type="button"
                  onClick={() => setAssignments((current) => current.filter((item) => item !== assignment))}
                  className="font-semibold text-[#EF4444]"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <span className="text-[#64748B]">No units assigned yet. You can create the lecturer now and assign units later.</span>
          )}
        </div>
      )}

      {error && <p className="mt-3 rounded-lg bg-[#FEE2E2] p-3 text-sm text-[#EF4444]">{error}</p>}
      <button disabled={saving} type="submit" className={`mt-4 ${ui.primary}`}>
        {saving ? 'Creating...' : `Create ${role}`}
      </button>
    </form>
  );
}

function LecturersManager({ onReload }) {
  const [roster, setRoster] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', department: '', staff_id: '', status: 'invited' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/accounts/admin/rosters/`, { headers: tokenHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load roster'))))
      .then(setRoster)
      .catch((e) => setError(e.message));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const url = editingId ? `${API_BASE}/api/accounts/admin/rosters/${editingId}/` : `${API_BASE}/api/accounts/admin/rosters/create/`;
    const method = editingId ? 'PATCH' : 'POST';
    try {
      const response = await fetch(url, {
        method,
        headers: { ...tokenHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Save failed');
      setForm({ email: '', full_name: '', department: '', staff_id: '', status: 'invited' });
      setEditingId(null);
      setShowAdd(false);
      onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setForm({ email: item.email, full_name: item.full_name, department: item.department, staff_id: item.staff_id || '', status: item.status });
    setEditingId(item.id);
    setShowAdd(true);
  };

  const resendInstructions = async (item) => {
    if (!window.confirm(`Resend sign-in instructions to ${item.email}?`)) return;
    try {
      await fetch(`${API_BASE}/api/accounts/admin/rosters/resend/`, {
        method: 'POST',
        headers: { ...tokenHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: item.email }),
      });
      alert('Sign-in instructions sent (printed to backend console).');
    } catch {
      alert('Failed to send instructions.');
    }
  };

  const deactivate = async (item) => {
    if (!window.confirm(`Deactivate ${item.full_name}?`)) return;
    try {
      await fetch(`${API_BASE}/api/accounts/admin/rosters/${item.id}/`, {
        method: 'PATCH',
        headers: { ...tokenHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deactivated' }),
      });
      onReload();
    } catch {
      alert('Failed to deactivate.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#0F172A]">Lecturer Roster</h3>
        <button onClick={() => { setForm({ email: '', full_name: '', department: '', staff_id: '', status: 'invited' }); setEditingId(null); setShowAdd(true); }} className={ui.primary}>
          ＋ Add lecturer
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-semibold text-[#0F172A]">{editingId ? 'Edit lecturer' : 'Add lecturer'}</h4>
            <button type="button" onClick={() => { setShowAdd(false); setEditingId(null); setForm({ email: '', full_name: '', department: '', staff_id: '', status: 'invited' }); }} className="text-slate-500 hover:text-slate-800">✕</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input required placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={ui.input} disabled={editingId} />
            <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={ui.input} />
            <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={ui.input} />
            <input placeholder="Staff ID" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} className={ui.input} />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={ui.input}>
              <option value="invited">Invited</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className={ui.primary}>{saving ? 'Saving…' : (editingId ? 'Update' : 'Add')}</button>
            <button type="button" onClick={() => { setShowAdd(false); setEditingId(null); setForm({ email: '', full_name: '', department: '', staff_id: '', status: 'invited' }); }} className={ui.ghost}>Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Department</th>
              <th className="px-5 py-4">Staff ID</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((item) => (
              <tr key={item.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F1F5F9]">
                <td className="px-5 py-3.5 font-medium text-[#0F172A]">{item.full_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{item.email}</td>
                <td className="px-5 py-3.5">{item.department || '—'}</td>
                <td className="px-5 py-3.5">{item.staff_id || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    item.status === 'active' ? 'bg-green-100 text-green-800' :
                    item.status === 'invited' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-2">
                    {!editingId && <button onClick={() => startEdit(item)} className={ui.ghost}>Edit</button>}
                    {item.status !== 'active' && <button onClick={() => resendInstructions(item)} className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-200">Resend sign-in</button>}
                    {item.status === 'active' && <button onClick={() => deactivate(item)} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200">Deactivate</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!roster.length && <tr><td colSpan={6} className="p-10 text-center text-[#64748B]">No lecturers in roster yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupsManager({ data, onAction }) {
  const [openGroup, setOpenGroup] = useState(null);
  const [filterUnit, setFilterUnit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const rows = (data || []).filter((row) => {
    if (filterUnit && row.unit !== filterUnit) return false;
    if (filterStatus === 'active' && (row.archived || row.locked)) return false;
    if (filterStatus === 'archived' && !row.archived) return false;
    if (filterStatus === 'locked' && !row.locked) return false;
    const term = (search || '').toLowerCase();
    return (
      row.name.toLowerCase().includes(term) ||
      row.unit.toLowerCase().includes(term) ||
      row.lecturer.toLowerCase().includes(term) ||
      row.supervising_lecturers.some((s) => s.toLowerCase().includes(term)) ||
      (row.leader || '').toLowerCase().includes(term)
    );
  });

  const units = Array.from(new Set(rows.map((r) => r.unit).filter(Boolean)));

  const openDrawer = (row) => {
    setOpenGroup(row);
  };

  const closeDrawer = () => setOpenGroup(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#0F172A]">Groups</h3>
          <p className="text-sm text-[#64748B]">{rows.length} group(s)</p>
        </div>
        <button
          type="button"
          onClick={() => onAction(`${API_BASE}/api/accounts/admin/groups/create/`, { method: 'POST', body: JSON.stringify({ name: 'New Group' }) })}
          className={ui.primary}
        >
          ＋ Create group
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Search group, unit, lecturer, leader…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={ui.input}
        />
        <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className={ui.input}>
          <option value="">All units</option>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={ui.input}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="locked">Locked</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              <th className="px-5 py-4 cursor-pointer">Group</th>
              <th className="px-5 py-4">Unit</th>
              <th className="px-5 py-4">Supervising lecturers</th>
              <th className="px-5 py-4">Leader</th>
              <th className="px-5 py-4">Members</th>
              <th className="px-5 py-4">Health</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F1F5F9] group"
                onClick={() => openDrawer(row)}
              >
                <td className="px-5 py-3.5 font-medium text-[#0F172A]">{row.name}</td>
                <td className="px-5 py-3.5">{row.unit}</td>
                <td className="px-5 py-3.5 text-sm">
                  {row.supervising_lecturers.length ? (
                    row.supervising_lecturers.map((s, i) => (
                      <span key={i} className="inline-block mb-1 rounded-full bg-[#E0E7FF] px-2 py-0.5 text-xs text-[#0F172A]">{s}</span>
                    ))
                  ) : (
                    <span className="text-xs text-[#64748B]">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5">{row.leader || '—'}</td>
                <td className="px-5 py-3.5">{row.members}</td>
                  <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    row.health?.status === 'at_risk' ? 'bg-[#FEE2E2] text-[#EF4444]' :
                    row.health?.status === 'quiet' ? 'bg-[#E0E7FF] text-[#F59E0B]' :
                    'bg-[#D1FAE5] text-[#047857]'
                  }`}>
                    {String(row.health?.status || '').replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-2">
                    {!row.locked && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAction(`${API_BASE}/api/accounts/admin/groups/${row.id}/lock/`, { method: 'POST', confirm: 'Lock this group?' }) }}
                        className="rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-xs font-semibold text-[#EF4444] hover:bg-[#FECACA]"
                      >
                        Lock
                      </button>
                    )}
                    {row.locked && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAction(`${API_BASE}/api/accounts/admin/groups/${row.id}/lock/`, { method: 'DELETE', confirm: 'Unlock this group?' }) }}
                        className="rounded-lg bg-[#D1FAE5] px-3 py-1.5 text-xs font-semibold text-[#047857] hover:bg-[#A7F3D0]"
                      >
                        Unlock
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onAction(`${API_BASE}/api/accounts/admin/groups/${row.id}/archive/`, { method: 'POST', confirm: 'Archive this group?' }) }}
                      className="rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-xs font-semibold text-[#EF4444] hover:bg-[#FECACA]"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenGroup(row) }}
                      className="rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#E0E7FF]"
                    >
                      Open
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-[#64748B]">No groups found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Open drawer */}
      {openGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[#0F172A]/60 backdrop-blur-sm"
            onClick={closeDrawer}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl border border-[#CBD5E1]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#0F172A]">Group details — {openGroup.name}</h3>
              <button type="button" onClick={closeDrawer} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#E2E8F0] p-4">
                <h4 className="font-semibold text-[#0F172A] mb-3">Members</h4>
                <div className="text-sm text-[#64748B] text-center py-8">Loading members…</div>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] p-4">
                <h4 className="font-semibold text-[#0F172A] mb-3">Health & activity</h4>
                <p className="text-sm text-[#64748B] mb-2">Health: <span className="font-medium text-[#0F172A]">{String(openGroup.health?.status || '').replace('_', ' ')}</span></p>
                <p className="text-sm text-[#64748B] mb-2">At risk: {openGroup.at_risk ? 'Yes' : 'No'}</p>
                <p className="text-sm text-[#64748B]">Members: {openGroup.members}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E2E8F0] p-4">
              <h4 className="font-semibold text-[#0F172A] mb-3">Join code</h4>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#0F172A]">{openGroup.join_code}</span>
                <button
                  type="button"
                  onClick={() => onAction(`${API_BASE}/api/accounts/admin/groups/${openGroup.id}/regenerate-code/`, { method: 'POST' })}
                  className="rounded-lg bg-[#0F172A] px-3 py-1 text-xs font-semibold text-white"
                >
                  Regenerate
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onAction(`${API_BASE}/api/accounts/admin/groups/${openGroup.id}/archive/`, { method: 'POST', confirm: 'Archive this group?' })}
                className="rounded-lg bg-[#FEE2E2] px-4 py-2 text-xs font-semibold text-[#EF4444] hover:bg-[#FECACA]"
              >
                Archive group
              </button>
              <button
                type="button"
                onClick={closeDrawer}
                className={ui.ghost}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportManager({ onReload }) {
  const [importType, setImportType] = useState('lecturer');
  const [mode, setMode] = useState('add');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isUnits = importType === 'units';
  const templateUrl = isUnits ? `${API_BASE}/api/accounts/admin/units/template/` : `${API_BASE}/api/accounts/admin/roster/template/`;
  const previewUrl = `${API_BASE}/api/accounts/admin/${isUnits ? 'units/import/preview/' : 'roster/import/preview/'}`;
  const commitUrl = `${API_BASE}/api/accounts/admin/${isUnits ? 'units/import/' : 'roster/import/commit/'}`;

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setPreview(null);
    setError('');
    setSuccess('');
  };

  const handlePreview = async () => {
    if (!file) { setError('Select a file first.'); return; }
    setPreviewLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      const response = await fetch(previewUrl, { method: 'POST', headers: tokenHeaders(), body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Preview failed');
      setPreview(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview) { setError('No preview data.'); return; }
    setCommitLoading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      const response = await fetch(commitUrl, { method: 'POST', headers: tokenHeaders(), body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Commit failed');
      setSuccess('Import committed successfully.');
      setFile(null);
      setPreview(null);
      onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setCommitLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[#0F172A]">Import {isUnits ? 'Units' : 'Lecturer Roster'}</h3>
        </div>
        <div className="flex gap-1 rounded-lg border border-[#CBD5E1] bg-white">
          <button
            type="button"
            onClick={() => setImportType('lecturer')}
            className={`px-4 py-1.5 text-xs font-medium transition ${importType === 'lecturer' ? 'bg-[#4F46E5] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}
          >
            Lecturers
          </button>
          <button
            type="button"
            onClick={() => setImportType('units')}
            className={`px-4 py-1.5 text-xs font-medium transition ${importType === 'units' ? 'bg-[#4F46E5] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}
          >
            Units
          </button>
        </div>
        <a href={templateUrl} className={ui.ghost} download>Download CSV template</a>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-[#4F46E5] mb-1">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={ui.input}>
              <option value="add">Add (create new records)</option>
              <option value="replace">Replace existing records</option>
            </select>
            <p className="mt-1 text-xs text-[#64748B]">{isUnits ? 'Replace will update existing units by code+course.' : 'Replace will end-date old active assignments for this term.'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4F46E5] mb-1">CSV / XLSX file</label>
            <input type="file" accept=".csv,.xlsx" onChange={handleFileChange} className={ui.input} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePreview} disabled={previewLoading || !file} className={ui.primary}>{previewLoading ? 'Previewing…' : 'Preview'}</button>
          <button onClick={handleCommit} disabled={commitLoading || !preview} className={ui.primary}>{commitLoading ? 'Committing…' : 'Commit import'}</button>
          {preview && <button onClick={() => setPreview(null)} className={ui.ghost}>Clear</button>}
        </div>
        {error && <p className="mt-3 text-sm text-[#EF4444]">{error}</p>}
        {success && <p className="mt-3 text-sm text-[#10B981]">{success}</p>}

        {preview && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="rounded-lg bg-[#E0E7FF] p-3"><span className="font-semibold text-[#0F172A]">Total rows:</span> {preview.summary.total ?? preview.summary.created + preview.summary.updated + preview.summary.errors}</div>
              {isUnits ? (
                <>
                  <div className="rounded-lg bg-[#10B981]/10 p-3"><span className="font-semibold text-[#0F172A]">Created:</span> {preview.summary.created}</div>
                  <div className="rounded-lg bg-[#10B981]/10 p-3"><span className="font-semibold text-[#0F172A]">Updated:</span> {preview.summary.updated}</div>
                </>
              ) : (
                <>
                  <div className="rounded-lg bg-green-50 p-3"><span className="font-semibold text-[#0F172A]">Valid:</span> {preview.summary.valid}</div>
                  <div className="rounded-lg bg-red-50 p-3"><span className="font-semibold text-[#0F172A]">Errors:</span> {preview.summary.errors}</div>
                  <div className="rounded-lg bg-blue-50 p-3"><span className="font-semibold text-[#0F172A]">New lecturers:</span> {preview.summary.new_lecturers}</div>
                  <div className="rounded-lg bg-violet-50 p-3"><span className="font-semibold text-[#0F172A]">Existing lecturers:</span> {preview.summary.existing_lecturers}</div>
                </>
              )}
              <div className="rounded-lg bg-[#EF4444]/10 p-3"><span className="font-semibold text-[#0F172A]">Errors:</span> {preview.summary.errors}</div>
            </div>

            {preview.errors.length && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="font-semibold text-red-800 mb-2">Errors:</p>
                <ul className="text-sm text-red-700 space-y-1 max-h-48 overflow-y-auto">
                  {preview.errors.slice(0, 20).map((err, i) => <li key={i}>Row {err.row}: {err.error}</li>)}
                  {preview.errors.length > 20 && <li>...and {preview.errors.length - 20} more</li>}
                </ul>
              </div>
            )}

            {preview.matched_rows.length && (
              <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      {isUnits ? (
                        <>
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Unit Code</th>
                          <th className="px-3 py-2">Unit Name</th>
                          <th className="px-3 py-2">Course Code</th>
                          <th className="px-3 py-2">Year</th>
                          <th className="px-3 py-2">Semester</th>
                          <th className="px-3 py-2">Academic Level</th>
                          <th className="px-3 py-2">Max Members</th>
                          <th className="px-3 py-2">Status</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Department</th>
                          <th className="px-3 py-2">Programme</th>
                          <th className="px-3 py-2">Unit</th>
                          <th className="px-3 py-2">Staff ID</th>
                          <th className="px-3 py-2">New?</th>
                          <th className="px-3 py-2">Units</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.matched_rows.map((row) => (
                      <tr key={row.row} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F1F5F9]">
                        {isUnits ? (
                          <>
                            <td className="px-3 py-2">{row.row}</td>
                            <td className="px-3 py-2 font-mono text-[#0F172A]">{row.unit_code}</td>
                            <td className="px-3 py-2">{row.unit_name}</td>
                            <td className="px-3 py-2">{row.course_code}</td>
                            <td className="px-3 py-2">{row.year_of_study}</td>
                            <td className="px-3 py-2">{row.semester}</td>
                            <td className="px-3 py-2">{row.academic_level || '—'}</td>
                            <td className="px-3 py-2">{row.default_max_members}</td>
                            <td className="px-3 py-2">{row.is_new_unit ? <span className="text-green-600 font-medium">New</span> : <span className="text-[#64748B]">Existing</span>}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2">{row.row}</td>
                            <td className="px-3 py-2">{row.email}</td>
                            <td className="px-3 py-2">{row.full_name}</td>
                            <td className="px-3 py-2">{row.department}</td>
                            <td className="px-3 py-2">{row.programme_name}</td>
                            <td className="px-3 py-2">{row.unit_name}</td>
                            <td className="px-3 py-2">{row.staff_id || '—'}</td>
                            <td className="px-3 py-2">{row.is_new_lecturer ? <span className="text-green-600 font-medium">New</span> : <span className="text-[#64748B]">Existing</span>}</td>
                            <td className="px-3 py-2">{row.units_affected}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ImportHistoryManager({ onReload }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/accounts/admin/import/history/`, { headers: tokenHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load history'))))
      .then(setHistory)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handleUndo = async (batch) => {
    if (!window.confirm(`Undo import "${batch.file_name}"? This will end-date the assignments from this batch.`)) return;
    try {
      await fetch(`${API_BASE}/api/accounts/admin/import/${batch.id}/undo/`, { method: 'POST', headers: tokenHeaders() });
      onReload();
    } catch {
      alert('Failed to undo import.');
    }
  };

  if (loading) return <div className="text-center text-[#64748B] py-10">Loading history...</div>;

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-[#0F172A]">Import History</h3>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              <th className="px-5 py-4">File</th>
              <th className="px-5 py-4">Mode</th>
              <th className="px-5 py-4">Created by</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Summary</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((batch) => (
              <tr key={batch.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F1F5F9]">
                <td className="px-5 py-3.5 font-medium text-[#0F172A]">{batch.file_name}</td>
                <td className="px-5 py-3.5">{batch.mode}</td>
                <td className="px-5 py-3.5">{batch.created_by}</td>
                <td className="px-5 py-3.5">{new Date(batch.created_at).toLocaleString()}</td>
                <td className="px-5 py-3.5 text-sm text-[#64748B]">
                  {batch.summary.created_rosters} rosters, {batch.summary.created_assignments} assignments
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    batch.status === 'committed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {batch.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {batch.status === 'committed' && (
                    <button onClick={() => handleUndo(batch)} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200">Undo</button>
                  )}
                </td>
              </tr>
            ))}
            {!history.length && <tr><td colSpan={7} className="p-10 text-center text-[#64748B]">No imports yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnitsManager() {
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/accounts/admin/assignments/unassigned/`, { headers: tokenHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load units'))))
      .then(setUnassigned)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-[#64748B] py-10">Loading units...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#0F172A]">Units with no lecturer (current term)</h3>
        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">{unassigned.length} unassigned</span>
      </div>
      {unassigned.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center text-[#64748B] shadow-sm">
          <CheckCircleOutlined className="mx-auto h-12 w-12 text-green-600" />
          <p className="mt-4 text-lg font-medium text-[#0F172A]">Every unit has a lecturer</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                <th className="px-5 py-4">Code</th>
                <th className="px-5 py-4">Unit</th>
                <th className="px-5 py-4">Programme</th>
                <th className="px-5 py-4">Year</th>
                <th className="px-5 py-4">Semester</th>
              </tr>
            </thead>
            <tbody>
              {unassigned.map((unit) => (
                <tr key={unit.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F1F5F9]">
                  <td className="px-5 py-3.5 font-mono text-[#0F172A]">{unit.code}</td>
                  <td className="px-5 py-3.5">{unit.name}</td>
                  <td className="px-5 py-3.5">{unit.course__name}</td>
                  <td className="px-5 py-3.5">Year {unit.year_of_study}</td>
                  <td className="px-5 py-3.5">Semester {unit.semester}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
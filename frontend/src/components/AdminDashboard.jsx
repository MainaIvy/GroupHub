import React, { useEffect, useState } from 'react';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  DownloadOutlined,
  FileDoneOutlined,
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
} from '@ant-design/icons';

/*
  Palette (cream / black / yellow):
    cream   #F3EFEA   page background
    card    #FFFFFF   panels and stat cards
    ink     #1C1C1C   text, rail, primary buttons, highlighted card
    yellow  #F5C842   active rail icon and accents
    butter  #FBF0C9   soft fills
    line    #E6E0D8   borders
    muted   #8B8680   secondary text
*/

const tokenHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });

const tabs = ['Overview', 'Users', 'Units and lecturers', 'Groups', 'Catalog', 'Settings', 'Announcements', 'Audit log'];

const tabIcons = {
  Overview: <DashboardOutlined />,
  Users: <UserOutlined />,
  'Units and lecturers': <ReadOutlined />,
  Groups: <UsergroupAddOutlined />,
  Catalog: <AppstoreOutlined />,
  Settings: <SettingOutlined />,
  Announcements: <NotificationOutlined />,
  'Audit log': <AuditOutlined />,
};

const endpoints = {
  Overview: '/api/accounts/admin/overview/',
  Users: '/api/accounts/admin/users/',
  'Units and lecturers': '/api/accounts/admin/assignments/',
  Groups: '/api/accounts/admin/groups/',
  Catalog: '/api/accounts/admin/catalog/',
  Settings: '/api/accounts/admin/settings/',
  Announcements: '/api/accounts/admin/announcements/',
  'Audit log': '/api/accounts/admin/audit/',
};

const ui = {
  input:
    'rounded-xl border border-[#DDD6CC] bg-white p-3 text-sm text-[#1C1C1C] placeholder:text-[#B3ADA5] outline-none focus:border-[#1C1C1C] focus:ring-2 focus:ring-[#1C1C1C]/15',
  primary:
    'rounded-xl bg-[#1C1C1C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#333333] disabled:opacity-50',
  ghost:
    'rounded-xl border border-[#DDD6CC] bg-white px-4 py-2.5 text-sm font-semibold text-[#1C1C1C] transition hover:bg-[#FBF0C9]',
};

const STATUS_COLORS = { active: '#3F9B67', approved: '#3F9B67', pending: '#D99A4E', suspended: '#B3263A' };

function StatusDot({ value }) {
  const key = String(value ?? '').toLowerCase();
  return (
    <span className="inline-flex items-center gap-2 capitalize">
      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[key] || '#B9A5A8' }} />
      {value ?? '—'}
    </span>
  );
}

function Stat({ label, value, icon, highlight }) {
  return (
    <div
      className={`flex items-center justify-between rounded-3xl p-5 shadow-sm ${
        highlight ? 'bg-[#1C1C1C] text-white' : 'bg-white text-[#1C1C1C]'
      }`}
    >
      <div>
        <p className="text-3xl font-bold">{value ?? '—'}</p>
        <p className={`mt-1 text-sm ${highlight ? 'text-white/60' : 'text-[#8B8680]'}`}>{label}</p>
      </div>
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
          highlight ? 'bg-[#F5C842] text-[#1C1C1C]' : 'bg-[#FBF0C9] text-[#1C1C1C]'
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
        <h3 className="font-semibold text-[#1C1C1C]">{title}</h3>
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
      className="rounded-lg bg-[#1C1C1C] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#333333]"
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
      if (activeTab === 'Units and lecturers') {
        const [catalogResponse, usersResponse] = await Promise.all([
          fetch('/api/accounts/admin/catalog/', { headers: tokenHeaders() }),
          fetch('/api/accounts/admin/users/?user_type=lecturer', { headers: tokenHeaders() }),
        ]);
        payload = {
          assignments: payload,
          catalog: await catalogResponse.json(),
          lecturers: (await usersResponse.json()).filter((user) => user.user_type === 'lecturer'),
        };
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
    const response = await fetch(`/api/accounts/admin/export/${type}/`, { headers: tokenHeaders() });
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
          <tr className="border-b border-[#E6E0D8] text-xs font-semibold uppercase tracking-wide text-[#8B8680]">
            {columns.map((column) => (
              <th key={column.key} className="px-5 py-4">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows?.map((row) => (
            <tr key={row.id} className="border-b border-[#EFEAE3] text-[#1C1C1C] last:border-0 hover:bg-[#F7F4EF]">
              {columns.map((column) => (
                <td key={column.key} className="px-5 py-3.5">
                  {column.render ? column.render(row) : (row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows?.length && <p className="p-10 text-center text-[#8B8680]">No records found.</p>}
    </div>
  );

  const quickActions = [
    { label: 'Add a user', icon: <PlusOutlined />, run: () => { setShowCreateUser(true); goTo('Users'); } },
    { label: 'Import the catalogue', icon: <UploadOutlined />, run: () => goTo('Catalog') },
    { label: 'Export users (CSV)', icon: <DownloadOutlined />, run: () => downloadExport('users') },
    { label: 'Post an announcement', icon: <NotificationOutlined />, run: () => goTo('Announcements') },
  ];

  // data is null for a moment after switching tabs, so treat that as loading.
  const waiting = state.loading || (data == null && !state.error);

  let content = null;
  if (waiting) {
    content = (
      <div className="rounded-3xl bg-white p-12 text-center text-[#8B8680] shadow-sm">
        Loading {tab.toLowerCase()}...
      </div>
    );
  } else if (state.error) {
    content = (
      <div className="rounded-3xl bg-[#FBE4E6] p-5 text-[#B3263A]">
        {state.error}{' '}
        <button type="button" onClick={() => load()} className="ml-3 font-semibold underline">
          Retry
        </button>
      </div>
    );
  } else if (tab === 'Overview') {
    content = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Users" value={data.users} icon={<TeamOutlined />} />
          <Stat label="Groups" value={data.groups} icon={<UsergroupAddOutlined />} />
          <Stat label="Tasks" value={data.tasks} icon={<CheckSquareOutlined />} />
          <Stat label="Submissions" value={data.submissions} icon={<FileDoneOutlined />} highlight />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel title="At-risk groups" action={<SeeAll onClick={() => goTo('Groups')} />}>
              {data.at_risk_groups?.length ? (
                <ul className="divide-y divide-[#EFEAE3]">
                  {data.at_risk_groups.map((group) => (
                    <li key={group.id} className="flex items-center justify-between py-3 text-sm">
                      <span className="font-medium text-[#1C1C1C]">{group.name}</span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#FBE4E6] px-3 py-1 text-xs font-semibold text-[#B3263A]">
                        <span className="h-2 w-2 rounded-full bg-[#B3263A]" />
                        At risk
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[#8B8680]">
                  <CheckCircleOutlined className="text-3xl text-[#3F9B67]" />
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
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-sm text-[#1C1C1C] transition hover:bg-[#F7F4EF]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FBF0C9] text-[#1C1C1C]">
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
              action('/api/accounts/admin/catalog/import/', { method: 'POST', confirm: 'Import the Excel catalogue now?' })
            }
            className={ui.primary}
          >
            Run Excel import
          </button>
          <button type="button" onClick={() => downloadExport('users')} className={ui.ghost}>
            Export users
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
                    onClick={() => action(`/api/accounts/admin/users/${row.id}/approve/`, { method: 'POST' })}
                    className="rounded-lg bg-[#FBF0C9] px-3 py-1.5 text-xs font-semibold text-[#1C1C1C] hover:bg-[#F5E3A5]"
                  >
                    Approve
                  </button>
                )}
                {row.status === 'suspended' ? (
                  <button
                    type="button"
                    onClick={() => action(`/api/accounts/admin/users/${row.id}/reactivate/`, { method: 'POST' })}
                    className="rounded-lg bg-[#E3F1E8] px-3 py-1.5 text-xs font-semibold text-[#2F7A4B] hover:bg-[#D2E8DA]"
                  >
                    Reactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      action(`/api/accounts/admin/users/${row.id}/suspend/`, { method: 'POST', confirm: 'Suspend this user?' })
                    }
                    className="rounded-lg bg-[#FBE4E6] px-3 py-1.5 text-xs font-semibold text-[#B3263A] hover:bg-[#F6D3D7]"
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
  } else if (tab === 'Groups') {
    content = renderTable(data, [
      { key: 'name', label: 'Group' },
      { key: 'unit', label: 'Unit' },
      { key: 'lecturer', label: 'Lecturer' },
      { key: 'members', label: 'Members' },
      {
        key: 'at_risk',
        label: 'At risk',
        render: (row) =>
          row.at_risk ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FBE4E6] px-3 py-1 text-xs font-semibold text-[#B3263A]">
              <span className="h-2 w-2 rounded-full bg-[#B3263A]" />
              At risk
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F7A4B]">
              <span className="h-2 w-2 rounded-full bg-[#3F9B67]" />
              On track
            </span>
          ),
      },
      {
        key: 'id',
        label: 'Actions',
        render: (row) => (
          <button
            type="button"
            onClick={() => action(`/api/accounts/admin/groups/${row.id}/archive/`, { method: 'POST', confirm: 'Archive this group?' })}
            className="rounded-lg bg-[#FBE4E6] px-3 py-1.5 text-xs font-semibold text-[#B3263A] hover:bg-[#F6D3D7]"
          >
            Archive
          </button>
        ),
      },
    ]);
  } else {
    content = renderTable(data, [
      { key: 'actor', label: 'Actor' },
      { key: 'action', label: 'Action' },
      { key: 'target_type', label: 'Target' },
      { key: 'created_at', label: 'Created' },
    ]);
  }

  return (
    <div className="min-h-screen bg-[#F3EFEA] text-[#1C1C1C]">
      <div className="flex min-h-screen">
        {/* Slim floating icon rail */}
        <aside className="sticky top-2 z-30 m-2 flex h-[calc(100vh-1rem)] w-14 shrink-0 flex-col items-center self-start rounded-[28px] bg-[#1C1C1C] py-4 text-white sm:top-3 sm:m-3 sm:h-[calc(100vh-1.5rem)]">
          <div title="GroupHub Admin" className="mb-6 flex h-10 w-10 items-center justify-center text-2xl text-[#F5C842]">
            <TeamOutlined />
          </div>

          <nav className="flex flex-1 flex-col items-center gap-2">
            {tabs.map((item) => {
              const active = tab === item;
              return (
                <div key={item} className="group relative">
                  <button
                    type="button"
                    aria-label={item}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => goTo(item)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition ${
                      active ? 'bg-[#F5C842] text-[#1C1C1C]' : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tabIcons[item]}
                  </button>
                  <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1C1C1C] px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">
                    {item}
                  </span>
                </div>
              );
            })}
          </nav>

          <div className="group relative">
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <LogoutOutlined />
            </button>
            <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1C1C1C] px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">
              Sign out
            </span>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-4 px-3 py-5 sm:px-4 md:px-8">
            <h2 className="text-xl font-bold md:text-2xl">{tab === 'Overview' ? 'Dashboard' : tab}</h2>

            <div className="mx-auto hidden w-full max-w-sm items-center gap-2 rounded-full border border-[#E6E0D8] bg-white px-4 py-2 sm:flex">
              <SearchOutlined className="text-[#8B8680]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && runSearch()}
                placeholder="Search users"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#B3ADA5]"
              />
            </div>

            <div className="ml-auto flex items-center gap-3 sm:ml-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C1C1C] text-sm font-bold text-[#F5C842]">
                A
              </span>
              <div className="hidden leading-tight lg:block">
                <p className="text-sm font-semibold">Administrator</p>
                <p className="text-xs text-[#8B8680]">Zetech University</p>
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
    ['file_size_limit', 'File size limit (bytes)'],
  ];
  return (
    <div className="max-w-xl rounded-3xl bg-white p-6 shadow-sm">
      <div className="grid gap-4">
        {fields.map(([key, label]) => (
          <label key={key} className="text-sm font-medium text-[#1C1C1C]">
            {label}
            <input
              className={`mt-1 w-full ${ui.input}`}
              value={form?.[key] ?? ''}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={() => onSave(form)} className={`mt-5 ${ui.primary}`}>
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
    onAction('/api/accounts/admin/assignments/', {
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

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E6E0D8] text-xs font-semibold uppercase tracking-wide text-[#8B8680]">
              <th className="px-5 py-4">Lecturer</th>
              <th className="px-5 py-4">Unit</th>
              <th className="px-5 py-4">Term</th>
              <th className="px-5 py-4">Load</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data.assignments || []).map((row) => (
              <tr key={row.id} className="border-b border-[#EFEAE3] last:border-0 hover:bg-[#F7F4EF]">
                <td className="px-5 py-3.5">
                  {row.lecturer?.name}
                  <span className="block text-xs text-[#8B8680]">{row.lecturer?.staff_id}</span>
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
                      onAction(`/api/accounts/admin/assignments/${row.id}/`, {
                        method: 'DELETE',
                        confirm: 'Remove this unit assignment?',
                      })
                    }
                    className="rounded-lg bg-[#FBE4E6] px-3 py-1.5 text-xs font-semibold text-[#B3263A] hover:bg-[#F6D3D7]"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(data.assignments || []).length && <p className="p-10 text-center text-[#8B8680]">No lecturer assignments yet.</p>}
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
          <p className="font-semibold text-[#1C1C1C]">{lecturer.name}</p>
          <p className="text-xs text-[#8B8680]">{lecturer.staff_id || lecturer.email}</p>
          <p className="mt-3 text-2xl font-bold text-[#1C1C1C]">
            {lecturer.load_count ?? '—'} <span className="text-sm font-normal text-[#8B8680]">assigned units</span>
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
    fetch('/api/accounts/admin/catalog/', { headers: tokenHeaders() })
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
    const response = await fetch('/api/accounts/admin/users/create/', {
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
          <h3 className="font-semibold text-[#1C1C1C]">Create account</h3>
          <p className="text-sm text-[#8B8680]">Use the catalogue to assign the correct academic structure.</p>
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
        <div className="mt-4 rounded-xl bg-[#F7F4EF] p-3 text-sm">
          {assignments.length ? (
            assignments.map((assignment) => (
              <div key={`${assignment.unit_id}-${assignment.term_id}`} className="flex items-center justify-between border-b border-[#E6E0D8] py-2 last:border-0">
                <span>{assignment.label}</span>
                <button
                  type="button"
                  onClick={() => setAssignments((current) => current.filter((item) => item !== assignment))}
                  className="font-semibold text-[#B3263A]"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <span className="text-[#8B8680]">No units assigned yet. You can create the lecturer now and assign units later.</span>
          )}
        </div>
      )}

      {error && <p className="mt-3 rounded-lg bg-[#FBE4E6] p-3 text-sm text-[#B3263A]">{error}</p>}
      <button disabled={saving} type="submit" className={`mt-4 ${ui.primary}`}>
        {saving ? 'Creating...' : `Create ${role}`}
      </button>
    </form>
  );
}
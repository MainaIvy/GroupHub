import React, { useEffect, useState } from 'react';

const tokenHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });
const tabs = ['Overview', 'Users', 'Units and lecturers', 'Groups', 'Catalog', 'Settings', 'Announcements', 'Audit log'];
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

function Stat({ label, value }) {
  return <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-[#0F3D6E]">{value ?? '—'}</p></div>;
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
      const url = activeTab === 'Users' && search ? `${endpoints[activeTab]}?search=${encodeURIComponent(search)}` : endpoints[activeTab];
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

  useEffect(() => { load(); }, [tab]);

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
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
      <table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-slate-500"><tr>{columns.map((column) => <th key={column.key} className="p-4">{column.label}</th>)}</tr></thead>
        <tbody>{rows?.map((row) => <tr key={row.id} className="border-b last:border-0">{columns.map((column) => <td key={column.key} className="p-4">{column.render ? column.render(row) : (row[column.key] ?? '—')}</td>)}</tr>)}</tbody>
      </table>
      {!rows?.length && <p className="p-8 text-center text-slate-500">No records found.</p>}
    </div>
  );

  let content = null;
  if (state.loading) content = <div className="rounded-2xl bg-white p-12 text-center text-slate-500">Loading {tab.toLowerCase()}...</div>;
  else if (state.error) content = <div className="rounded-2xl bg-red-50 p-5 text-red-700">{state.error} <button type="button" onClick={() => load()} className="ml-3 underline">Retry</button></div>;
  else if (tab === 'Overview') content = <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Users" value={data.users} /><Stat label="Groups" value={data.groups} /><Stat label="Tasks" value={data.tasks} /><Stat label="Submissions" value={data.submissions} /></div><section className="mt-6 rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-semibold text-[#0F3D6E]">At-risk groups</h2>{data.at_risk_groups?.length ? data.at_risk_groups.map((group) => <div key={group.id} className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{group.name}</div>) : <p className="mt-3 text-sm text-slate-500">No at-risk groups.</p>}</section></>;
  else if (tab === 'Catalog') content = <><div className="mb-4 flex gap-2"><button type="button" onClick={() => action('/api/accounts/admin/catalog/import/', { method: 'POST', confirm: 'Import the Excel catalogue now?' })} className="rounded-xl bg-[#0F3D6E] px-4 py-2 text-sm font-semibold text-white">Run Excel import</button><button type="button" onClick={() => downloadExport('users')} className="rounded-xl border px-4 py-2 text-sm">Export users</button></div>{renderTable(data?.units, [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Unit' }, { key: 'course__name', label: 'Programme' }, { key: 'year_of_study', label: 'Year' }, { key: 'semester', label: 'Semester' }])}</>;
  else if (tab === 'Settings') content = <SettingsForm values={data} onSave={(values) => action(endpoints.Settings, { method: 'PUT', body: JSON.stringify(values) })} />;
  else if (tab === 'Announcements') content = <AnnouncementForm onSave={(values) => action(endpoints.Announcements, { method: 'POST', body: JSON.stringify(values) })} />;
  else if (tab === 'Users') content = <><div className="mb-4 flex flex-wrap gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="Search users" className="rounded-xl border px-4 py-2" /><button type="button" onClick={() => load()} className="rounded-xl bg-[#0F3D6E] px-4 py-2 font-semibold text-white">Search</button><button type="button" onClick={() => setShowCreateUser((visible) => !visible)} className="rounded-xl bg-[#F57D67] px-4 py-2 font-semibold text-white">{showCreateUser ? 'Close form' : '＋ Add user'}</button></div>{showCreateUser && <UserCreateForm onCreated={() => { setShowCreateUser(false); load(); }} />}{renderTable(data, [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' }, { key: 'id', label: 'Actions', render: (row) => <div className="flex flex-wrap gap-2">{row.status === 'pending' && <button type="button" onClick={() => action(`/api/accounts/admin/users/${row.id}/approve/`, { method: 'POST' })} className="rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-700">Approve</button>}{row.status === 'suspended' ? <button type="button" onClick={() => action(`/api/accounts/admin/users/${row.id}/reactivate/`, { method: 'POST' })} className="rounded-lg bg-green-50 px-3 py-1.5 font-medium text-green-700">Reactivate</button> : <button type="button" onClick={() => action(`/api/accounts/admin/users/${row.id}/suspend/`, { method: 'POST', confirm: 'Suspend this user?' })} className="rounded-lg bg-red-50 px-3 py-1.5 font-medium text-red-700">Suspend</button>}</div> }])}</>;
  else if (tab === 'Units and lecturers') content = <AssignmentManager data={data} onAction={action} onReload={() => load()} />;
  else if (tab === 'Groups') content = renderTable(data, [{ key: 'name', label: 'Group' }, { key: 'unit', label: 'Unit' }, { key: 'lecturer', label: 'Lecturer' }, { key: 'members', label: 'Members' }, { key: 'at_risk', label: 'At risk' }, { key: 'id', label: 'Actions', render: (row) => <button type="button" onClick={() => action(`/api/accounts/admin/groups/${row.id}/archive/`, { method: 'POST', confirm: 'Archive this group?' })} className="text-red-700">Archive</button> }]);
  else content = renderTable(data, [{ key: 'actor', label: 'Actor' }, { key: 'action', label: 'Action' }, { key: 'target_type', label: 'Target' }, { key: 'created_at', label: 'Created' }]);

  return <div className="min-h-screen bg-[#EEF3FA] text-[#26303B]"><div className="flex min-h-screen"><aside className="w-64 bg-[#0F172A] p-5 text-white"><h1 className="mb-8 text-2xl font-bold">GroupHub Admin</h1>{tabs.map((item) => <button key={item} type="button" onClick={() => { setTab(item); setData(null); }} className={`mb-2 w-full rounded-xl px-3 py-3 text-left text-sm ${tab === item ? 'bg-[#F57D67]' : 'text-slate-300 hover:bg-white/10'}`}>{item}</button>)}<button type="button" onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="mt-8 text-sm text-slate-300">Sign out</button></aside><main className="flex-1 p-5 md:p-10"><div className="mb-6 flex items-center justify-between"><div><p className="text-sm text-slate-500">Administration</p><h2 className="text-3xl font-bold text-[#0F3D6E]">{tab}</h2></div><span className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">Zetech University</span></div>{content}</main></div></div>;
}

function SettingsForm({ values, onSave }) {
  const [form, setForm] = useState(values);
  return <div className="max-w-xl rounded-2xl bg-white p-6 shadow-sm"><div className="grid gap-4">{[['allowed_email_domain', 'Allowed email domain'], ['default_group_size', 'Default group size'], ['minimum_points', 'Minimum points'], ['file_size_limit', 'File size limit (bytes)']].map(([key, label]) => <label key={key} className="text-sm font-medium">{label}<input className="mt-1 w-full rounded-xl border p-3" value={form?.[key] ?? ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}</div><button type="button" onClick={() => onSave(form)} className="mt-5 rounded-xl bg-[#F57D67] px-5 py-3 font-semibold text-white">Save settings</button></div>;
}

function AnnouncementForm({ onSave }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  return <div className="max-w-xl rounded-2xl bg-white p-6 shadow-sm"><div className="grid gap-4"><input className="rounded-xl border p-3" placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><textarea className="rounded-xl border p-3" placeholder="Message" rows="6" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /><select className="rounded-xl border p-3" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="all">Everyone</option><option value="programme">Programme</option><option value="unit">Unit</option></select></div><button type="button" onClick={() => onSave(form)} className="mt-5 rounded-xl bg-[#F57D67] px-5 py-3 font-semibold text-white">Send announcement</button></div>;
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
  return <div className="space-y-5">
    <form onSubmit={addAssignment} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-4">
      <select required value={form.lecturer_id} onChange={(event) => setForm({ ...form, lecturer_id: event.target.value })} className="rounded-xl border p-3"><option value="">Lecturer</option>{(data.lecturers || []).map((lecturer) => <option key={lecturer.id} value={lecturer.id}>{lecturer.name} · {lecturer.staff_id}</option>)}</select>
      <select required value={form.unit_id} onChange={(event) => setForm({ ...form, unit_id: event.target.value })} className="rounded-xl border p-3"><option value="">Unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name} · {unit.course__name}</option>)}</select>
      <select required value={form.term_id} onChange={(event) => setForm({ ...form, term_id: event.target.value })} className="rounded-xl border p-3"><option value="">Year & semester</option>{(data.catalog?.terms || []).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select>
      <button type="submit" className="rounded-xl bg-[#F57D67] px-4 py-3 font-semibold text-white">＋ Assign unit</button>
    </form>
    {renderLoadCards(data.lecturers)}
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-slate-500"><tr><th className="p-4">Lecturer</th><th className="p-4">Unit</th><th className="p-4">Term</th><th className="p-4">Load</th><th className="p-4">Actions</th></tr></thead><tbody>{(data.assignments || []).map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-4">{row.lecturer?.name}<span className="block text-xs text-slate-500">{row.lecturer?.staff_id}</span></td><td className="p-4">{row.unit_code} · {row.unit}</td><td className="p-4">{row.term}</td><td className="p-4">{row.lecturer_load} units</td><td className="p-4"><button type="button" onClick={() => onAction(`/api/accounts/admin/assignments/${row.id}/`, { method: 'DELETE', confirm: 'Remove this unit assignment?' })} className="rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-red-700">Remove</button></td></tr>)}</tbody></table>{!(data.assignments || []).length && <p className="p-8 text-center text-slate-500">No lecturer assignments yet.</p>}</div>
    <button type="button" onClick={onReload} className="rounded-xl border px-4 py-2 text-sm font-semibold text-[#0F3D6E]">Refresh assignments</button>
  </div>;
}

function renderLoadCards(lecturers = []) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{lecturers.map((lecturer) => <div key={lecturer.id} className="rounded-2xl bg-white p-4 shadow-sm"><p className="font-semibold text-[#0F3D6E]">{lecturer.name}</p><p className="text-xs text-slate-500">{lecturer.staff_id || lecturer.email}</p><p className="mt-3 text-2xl font-bold">{lecturer.load_count ?? '—'} <span className="text-sm font-normal text-slate-500">assigned units</span></p></div>)}</div>;
}

function UserCreateForm({ onCreated }) {
  const [catalog, setCatalog] = useState({ departments: [], programmes: [], units: [], terms: [] });
  const [role, setRole] = useState('lecturer');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', staff_id: '', admission_number: '', department: '', course_id: '', level: '', unit_id: '', term_id: '', year: '', semester: '' });
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/accounts/admin/catalog/', { headers: tokenHeaders() })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load the academic catalogue.')))
      .then(setCatalog)
      .catch((requestError) => setError(requestError.message));
  }, []);

  const courses = catalog.programmes.filter((course) => !form.department || course.department === form.department);
  const selectedTerm = catalog.terms.find((term) => String(term.id) === String(form.term_id));
  const courseUnits = catalog.units.filter((unit) => (
    String(unit.course_id) === String(form.course_id)
    && (!form.level || unit.academic_level === form.level)
    && (!selectedTerm || (String(unit.year_of_study) === String(selectedTerm.year) && String(unit.semester) === String(selectedTerm.semester)))
  ));
  const levels = [...new Set(catalog.units.filter((unit) => String(unit.course_id) === String(form.course_id)).map((unit) => unit.academic_level).filter(Boolean))];
  const terms = catalog.terms.filter((term) => !form.year || String(term.year) === String(form.year));

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const addAssignment = () => {
    const unit = courseUnits.find((item) => String(item.id) === String(form.unit_id));
    const term = catalog.terms.find((item) => String(item.id) === String(form.term_id));
    if (!unit || !term || assignments.some((item) => item.unit_id === unit.id && item.term_id === term.id)) return;
    setAssignments((current) => [...current, { unit_id: unit.id, term_id: term.id, label: `${unit.code} · ${unit.name} — ${term.name}` }]);
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

  return <form onSubmit={submit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[#0F3D6E]">Create account</h3><p className="text-sm text-slate-500">Use the catalogue to assign the correct academic structure.</p></div><select value={role} onChange={(event) => { setRole(event.target.value); setAssignments([]); }} className="rounded-xl border p-2"><option value="lecturer">Lecturer</option><option value="student">Student</option></select></div>
    <div className="grid gap-3 md:grid-cols-3">
      <input required placeholder="Full name" value={form.full_name} onChange={(event) => update('full_name', event.target.value)} className="rounded-xl border p-3" />
      <input required type="email" placeholder="Email address" value={form.email} onChange={(event) => update('email', event.target.value)} className="rounded-xl border p-3" />
      <input required type="password" placeholder="Temporary password" value={form.password} onChange={(event) => update('password', event.target.value)} className="rounded-xl border p-3" />
      {role === 'lecturer' ? <><input required placeholder="Staff ID" value={form.staff_id} onChange={(event) => update('staff_id', event.target.value)} className="rounded-xl border p-3" /><select required value={form.department} onChange={(event) => { update('department', event.target.value); update('course_id', ''); }} className="rounded-xl border p-3"><option value="">Department</option>{catalog.departments.map((department) => <option key={department} value={department}>{department}</option>)}</select><select required value={form.course_id} onChange={(event) => { update('course_id', event.target.value); update('level', ''); update('term_id', ''); }} className="rounded-xl border p-3"><option value="">Course / programme</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select><select value={form.level} onChange={(event) => { update('level', event.target.value); update('term_id', ''); }} className="rounded-xl border p-3"><option value="">Academic level</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select><select value={form.term_id} onChange={(event) => { update('term_id', event.target.value); update('unit_id', ''); }} className="rounded-xl border p-3"><option value="">Year & semester</option>{catalog.terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select><select value={form.unit_id} onChange={(event) => update('unit_id', event.target.value)} className="rounded-xl border p-3"><option value="">Unit</option>{courseUnits.map((unit) => <option key={unit.id} value={unit.id}>Year {unit.year_of_study}, Sem {unit.semester} · {unit.code} · {unit.name}</option>)}</select><button type="button" onClick={addAssignment} className="rounded-xl border-2 border-[#0F3D6E] px-3 py-2 font-semibold text-[#0F3D6E]">＋ Add unit</button></> : <><input required placeholder="Admission number" value={form.admission_number} onChange={(event) => update('admission_number', event.target.value)} className="rounded-xl border p-3" /><select required value={form.department} onChange={(event) => { update('department', event.target.value); update('course_id', ''); }} className="rounded-xl border p-3"><option value="">Department</option>{catalog.departments.map((department) => <option key={department} value={department}>{department}</option>)}</select><select required value={form.course_id} onChange={(event) => update('course_id', event.target.value)} className="rounded-xl border p-3"><option value="">Course / programme</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select><select required value={form.year} onChange={(event) => update('year', event.target.value)} className="rounded-xl border p-3"><option value="">Year of study</option>{[...new Set(courseUnits.map((unit) => unit.year_of_study))].sort().map((year) => <option key={year} value={year}>Year {year}</option>)}</select><select required value={form.semester} onChange={(event) => update('semester', event.target.value)} className="rounded-xl border p-3"><option value="">Semester</option>{[1, 2].map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}</select></>}
    </div>
    {role === 'lecturer' && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{assignments.length ? assignments.map((assignment) => <div key={`${assignment.unit_id}-${assignment.term_id}`} className="flex items-center justify-between border-b py-2 last:border-0"><span>{assignment.label}</span><button type="button" onClick={() => setAssignments((current) => current.filter((item) => item !== assignment))} className="font-semibold text-red-600">Remove</button></div>) : <span className="text-slate-500">No units assigned yet. You can create the lecturer now and assign units later.</span>}</div>}
    {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button disabled={saving} type="submit" className="mt-4 rounded-xl bg-[#F57D67] px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Creating...' : `Create ${role}`}</button>
  </form>;
}

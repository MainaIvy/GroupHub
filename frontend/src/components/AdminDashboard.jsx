import { useEffect, useMemo, useState } from 'react';

const API_BASE = '/api/accounts/admin';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const adminUser = JSON.parse(localStorage.getItem('user') || 'null');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();
      if (role !== 'all') params.set('role', role);
      if (search.trim()) params.set('search', search.trim());

      const response = await fetch(`${API_BASE}/users/?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load users.');
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminUser?.is_staff) {
      window.location.href = '/login';
      return;
    }
    loadUsers();
    // Load once when the admin area opens; filters are applied by the Refresh button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (user) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE}/users/${user.id}/${action}/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Unable to update account.');
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, is_active: data.is_active } : item)),
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const stats = useMemo(
    () => ({
      total: users.length,
      students: users.filter((user) => user.user_type === 'student').length,
      lecturers: users.filter((user) => user.user_type === 'lecturer').length,
      inactive: users.filter((user) => !user.is_active).length,
    }),
    [users],
  );

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#123B5D] px-6 py-4 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">GroupHub</p>
            <h1 className="text-2xl font-bold">Administration</h1>
          </div>
          <button onClick={logout} className="rounded-lg border border-white/40 px-4 py-2 text-sm hover:bg-white/10">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <div>
          <h2 className="text-3xl font-bold text-[#123B5D]">System overview</h2>
          <p className="mt-1 text-slate-600">Manage registered users and account access.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Registered users', stats.total],
            ['Students', stats.students],
            ['Lecturers', stats.lecturers],
            ['Inactive accounts', stats.inactive],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold text-[#123B5D]">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, username, or email"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-[#159A9C] focus:ring-2 focus:ring-[#159A9C]/20"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-[#159A9C]"
            >
              <option value="all">All roles</option>
              <option value="student">Students</option>
              <option value="lecturer">Lecturers</option>
            </select>
            <button onClick={loadUsers} className="rounded-lg bg-[#159A9C] px-5 py-2 font-semibold text-white hover:bg-[#117d7f]">
              Refresh
            </button>
          </div>

          {error && <p className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {loading ? (
            <p className="p-8 text-center text-slate-500">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#123B5D]">{user.name}</p>
                        <p className="text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-5 py-4 capitalize text-slate-700">{user.user_type}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.is_active ? 'bg-teal-50 text-[#159A9C]' : 'bg-slate-100 text-slate-500'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => updateStatus(user)} className="font-semibold text-[#159A9C] hover:underline">
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && <p className="p-8 text-center text-slate-500">No users found.</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;

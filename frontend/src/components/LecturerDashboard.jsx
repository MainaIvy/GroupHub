import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  X
} from 'lucide-react';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'MAIN' },
  { id: 'progress', label: 'Analytics', icon: BarChart3, section: 'MAIN' },
  { id: 'groups', label: 'My Units', icon: BookOpen, section: 'MAIN' },
  { id: 'submissions', label: 'Assessments', icon: ClipboardList, section: 'WORK' },
  { id: 'chat', label: 'Students', icon: Users, section: 'WORK' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'ACCOUNT' }
];

const statCards = [
  { label: 'Total Students', key: 'total_students', icon: Users, tone: 'blue' },
  { label: 'Teaching Units', key: 'total_units', icon: BookOpen, tone: 'pink' },
  { label: 'Pending to Grade', key: 'pending_submissions', icon: CheckSquare, tone: 'yellow' },
  { label: 'Assessments Created', key: 'projects', icon: ClipboardList, tone: 'green' },
  { label: 'Avg. Class Performance', value: '—', icon: BarChart3, tone: 'lavender' }
];

const toneStyles = {
  pink: 'bg-[#FDEDEE] dark:bg-[#30202a]',
  blue: 'bg-[#E8EFFB] dark:bg-[#202c45]',
  yellow: 'bg-[#FFF5DB] dark:bg-[#352d1d]',
  green: 'bg-[#E6F5EC] dark:bg-[#1d3329]',
  lavender: 'bg-[#F3ECFA] dark:bg-[#302840]'
};

const apiHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });

const LecturerDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('groups');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [selectedChatRoom, setSelectedChatRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isFetchingDashboard, setIsFetchingDashboard] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', unit_id: '', max_members: 5 });

  const user = dashboardData?.user;
  const groups = useMemo(() => dashboardData?.groups || [], [dashboardData]);
  const units = useMemo(() => dashboardData?.units || [], [dashboardData]);
  const submissions = useMemo(() => dashboardData?.recent_submissions || [], [dashboardData]);
  const firstName = user?.first_name || 'Lecturer';
  const initials = `${user?.first_name?.[0] || 'U'}${user?.last_name?.[0] || ''}`;

  const fetchDashboardData = async () => {
    if (isFetchingDashboard) return;
    setIsFetchingDashboard(true);
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const response = await axios.get('/api/accounts/dashboard/lecturer/', { headers: apiHeaders() });
      setDashboardData(response.data);
    } catch (requestError) {
      if (requestError?.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }
      const detail = requestError?.response?.data?.error || requestError?.response?.data?.detail;
      setError(detail || `Failed to load dashboard data${requestError?.response?.status ? ` (HTTP ${requestError.response.status})` : ''}`);
    } finally {
      setLoading(false);
      setIsFetchingDashboard(false);
    }
  };

  const fetchChatRooms = async () => {
    try {
      const response = await axios.get('/api/accounts/chat/rooms/', { headers: apiHeaders() });
      setChatRooms(response.data);
    } catch (requestError) {
      console.error('Error fetching chat rooms:', requestError);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const response = await axios.get('/api/accounts/chat/unread-counts/', { headers: apiHeaders() });
      setUnreadCounts(response.data);
    } catch (requestError) {
      console.error('Error fetching unread counts:', requestError);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // The request function intentionally runs once when the dashboard mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') {
      fetchChatRooms();
      fetchUnreadCounts();
    }
  }, [activeTab]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return undefined;
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000', {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5
    });
    socket.on('new_message', (message) => {
      if (selectedChatRoom?.id === message.room_id) setMessages((current) => [...current, message]);
      else setUnreadCounts((current) => ({ ...current, [message.room_id]: (current[message.room_id] || 0) + 1 }));
    });
    return () => socket.disconnect();
  }, [selectedChatRoom]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const filteredGroups = useMemo(() => groups.filter((group) => {
    const query = searchQuery.toLowerCase();
    return group.name?.toLowerCase().includes(query) || group.course?.toLowerCase().includes(query);
  }), [groups, searchQuery]);

  const filteredSubmissions = useMemo(() => submissions.filter((submission) => {
    const query = searchQuery.toLowerCase();
    return submission.project_title?.toLowerCase().includes(query) || submission.submitted_by?.toLowerCase().includes(query);
  }), [submissions, searchQuery]);

  const selectChatRoom = async (room) => {
    setSelectedChatRoom(room);
    setChatLoading(true);
    try {
      const response = await axios.get(`/api/accounts/chat/messages/${room.id}/`, { headers: apiHeaders() });
      setMessages(response.data);
    } catch (requestError) {
      console.error('Error fetching messages:', requestError);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChatRoom) return;
    try {
      const response = await axios.post(
        `/api/accounts/chat/send/${selectedChatRoom.id}/`,
        { content: newMessage },
        { headers: apiHeaders() }
      );
      setMessages((current) => [...current, response.data]);
      setNewMessage('');
    } catch (requestError) {
      console.error('Error sending message:', requestError);
    }
  };

  const messageStudent = async (student) => {
    try {
      const response = await axios.post(
        '/api/accounts/chat/direct/',
        { user_id: student.id },
        { headers: apiHeaders() }
      );
      await fetchChatRooms();
      setSelectedChatRoom(response.data);
      setActiveTab('chat');
      setMessages([]);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to start a conversation.');
    }
  };

  const createGroup = async (event) => {
    event.preventDefault();
    try {
      await axios.post('/api/accounts/groups/create/', groupForm, { headers: apiHeaders() });
      setGroupForm({ name: '', unit_id: '', max_members: 5 });
      setShowGroupForm(false);
      await fetchDashboardData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to create group.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF3FA] dark:bg-[#0B1120] flex items-center justify-center">
        <div className="text-center text-[#0F3D6E] dark:text-[#E8EEF9]">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D5E3D6] border-t-[#6DB6E6]" />
          <p className="text-sm font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#EEF3FA] dark:bg-[#0B1120] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-[#E3E9F2] bg-white p-8 text-center shadow-sm dark:border-[#1E2940] dark:bg-[#121A2D]">
          <p className="mb-5 text-[#E5484D]">{error}</p>
          <button onClick={fetchDashboardData} className="rounded-xl bg-[#0F3D6E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#174f89]">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const activeSection = activeTab === 'dashboard' ? 'Dashboard' : navigation.find((item) => item.id === activeTab)?.label;
  const statValues = {
    total_students: dashboardData?.stats?.total_students || 0,
    total_units: dashboardData?.stats?.total_units || units.length,
    pending_submissions: dashboardData?.stats?.pending_submissions || 0,
    projects: groups.reduce((total, group) => total + (group.projects?.length || 0), 0)
  };

  return (
    <div className="min-h-screen bg-[#EEF3FA] text-[#12294A] dark:bg-[#0B1120] dark:text-[#E8EEF9]">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-30 w-60 transform border-r border-[#E3E9F2] bg-white p-5 transition-transform dark:border-[#1E2940] dark:bg-[#121A2D] md:static md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-full flex-col">
            <div className="mb-10 flex items-center justify-between">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-3 text-left">
                {/* <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F3D6E] text-lg font-bold text-white">G</span> */}
                <span>
                  <span className="block text-lg font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">GroupHub</span>
                  <span className="block text-[10px] font-semibold tracking-[0.16em] text-[#6B7A90]">LECTURER WORKSPACE</span>
                </span>
              </button>
              <button onClick={() => setMobileNavOpen(false)} className="md:hidden" aria-label="Close navigation"><X size={20} /></button>
            </div>

            {['MAIN', 'WORK', 'ACCOUNT'].map((section) => (
              <div key={section} className="mb-7">
                <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.18em] text-[#8A97AF]">{section}</p>
                {navigation.filter((item) => item.section === section).map((item) => {
                  const Icon = item.icon;
                  const count = item.id === 'chat' ? unreadCounts?.total || 0 : item.id === 'submissions' ? dashboardData?.stats?.pending_submissions || 0 : 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setMobileNavOpen(false); }}
                      className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeTab === item.id ? 'bg-[#E8F3FB] text-[#0F3D6E] dark:bg-[#26365a] dark:text-[#E8EEF9]' : 'text-[#6B7A90] hover:bg-[#EEF3FA] dark:hover:bg-[#1E2940]'}`}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      <span>{item.label}</span>
                      {count > 0 && <span className="ml-auto rounded-full bg-[#6DB6E6] px-2 py-0.5 text-[10px] text-[#0F3D6E]">{count}</span>}
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="mt-auto border-t border-[#E3E9F2] pt-5 dark:border-[#1E2940]">
              <button onClick={() => setDarkMode((value) => !value)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#6B7A90] hover:bg-[#EEF3FA] dark:hover:bg-[#1E2940]">
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                <span className={`ml-auto h-5 w-9 rounded-full p-0.5 ${darkMode ? 'bg-[#6B84D6]' : 'bg-[#D5E3D6]'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${darkMode ? 'translate-x-4' : ''}`} /></span>
              </button>
              <div className="mt-5 flex items-center gap-3 border-t border-[#E3E9F2] pt-5 dark:border-[#1E2940]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6DB6E6] text-sm font-bold text-[#0F3D6E]">{initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{user?.first_name} {user?.last_name}</span>
                  <span className="block text-xs capitalize text-[#6B7A90]">{user?.user_type || 'Lecturer'}</span>
                </span>
                <button onClick={handleLogout} aria-label="Log out" className="text-[#6B7A90] hover:text-[#E5484D]"><LogOut size={17} /></button>
              </div>
            </div>
          </div>
        </aside>

        {mobileNavOpen && <button className="fixed inset-0 z-20 bg-[#12294A]/30 md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close menu overlay" />}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-[#E3E9F2] bg-white/95 px-5 py-4 backdrop-blur dark:border-[#1E2940] dark:bg-[#121A2D]/95 lg:px-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setMobileNavOpen(true)} className="md:hidden" aria-label="Open navigation"><Menu size={22} /></button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#6B7A90]">Lecturer Workspace</p>
                <h1 className="truncate text-xl font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">{activeSection}</h1>
              </div>
              {activeTab === 'dashboard' && (
                <div className="relative hidden w-64 md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A97AF]" size={17} />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search groups..." className="w-full rounded-xl border border-[#E3E9F2] bg-[#EEF3FA] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#6DB6E6] dark:border-[#1E2940] dark:bg-[#0B1120]" />
                </div>
              )}
              <button className="relative rounded-xl p-2 text-[#6B7A90] hover:bg-[#EEF3FA] dark:hover:bg-[#1E2940]" aria-label="Notifications"><Bell size={19} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#E5484D]" /></button>
              <button onClick={() => setDarkMode((value) => !value)} className="rounded-xl p-2 text-[#6B7A90] hover:bg-[#EEF3FA] dark:hover:bg-[#1E2940]" aria-label="Toggle dark mode">{darkMode ? <Sun size={19} /> : <Moon size={19} />}</button>
              <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#6DB6E6] text-sm font-bold text-[#0F3D6E] sm:flex">{initials}</span>
            </div>
          </header>

          <main className="mx-auto max-w-[1500px] p-5 lg:p-8">
            {activeTab === 'dashboard' && (
              <>
                <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                  <div><p className="text-sm text-[#6B7A90]">Welcome back, {firstName}</p><h2 className="mt-1 text-2xl font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">Lecturer Dashboard</h2></div>
                  <button onClick={() => setActiveTab('groups')} className="flex items-center gap-2 rounded-xl bg-[#0F3D6E] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#174f89]"><BookOpen size={17} /> Manage units</button>
                </div>

                <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {statCards.map((card) => {
                    const Icon = card.icon;
                    const value = card.value ?? statValues[card.key];
                    return <div key={card.label} className={`rounded-2xl border border-white/70 p-5 shadow-sm dark:border-[#1E2940] ${toneStyles[card.tone]}`}><div className="mb-5 flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/80 bg-white/70 text-[#0F3D6E] dark:border-[#384663] dark:bg-[#121A2D] dark:text-[#9ccdf0]"><Icon size={18} /></span><span className="text-2xl font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">{value}</span></div><p className="text-sm font-semibold text-[#12294A] dark:text-[#E8EEF9]">{card.label}</p><p className="mt-1 text-xs text-[#6B7A90]">From your current groups</p></div>;
                  })}
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)]">
                  <section className="rounded-2xl border border-[#E3E9F2] bg-white p-5 shadow-sm dark:border-[#1E2940] dark:bg-[#121A2D]">
                    <div className="mb-6 flex items-center justify-between"><div><h3 className="text-lg font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">Assessment Completion</h3><p className="mt-1 text-xs text-[#6B7A90]">Activity across your units</p></div><select className="rounded-lg border border-[#E3E9F2] bg-[#EEF3FA] px-2 py-1.5 text-xs text-[#6B7A90] outline-none dark:border-[#1E2940] dark:bg-[#0B1120]"><option>Current term</option></select></div>
                    <div className="flex h-56 items-end gap-3 border-b border-[#E3E9F2] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_54px,#E3E9F2_55px)] px-2 pt-5 dark:border-[#1E2940] dark:bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_54px,#1E2940_55px)]">
                      {(groups.length ? groups : [{ name: 'No units' }]).slice(0, 6).map((group, index) => { const submitted = group.projects?.length ? 55 + (index * 7) % 35 : 12; const pending = Math.max(12, 100 - submitted); return <div key={group.id || group.name} className="flex min-w-0 flex-1 items-end justify-center gap-1">{<div className="w-3 rounded-t-md bg-[#6DB6E6]" style={{ height: `${submitted}%` }} />}{<div className="w-3 rounded-t-md bg-[#D5E3D6]" style={{ height: `${pending}%` }} />}</div>; })}
                    </div>
                    <div className="mt-4 flex justify-center gap-5 text-xs text-[#6B7A90]"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#6DB6E6]" />Submitted</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#D5E3D6]" />Pending</span></div>
                  </section>

                  <section className="rounded-2xl border border-[#E3E9F2] bg-white p-5 shadow-sm dark:border-[#1E2940] dark:bg-[#121A2D]"><h3 className="mb-4 text-lg font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">Quick Actions</h3><div className="space-y-3">{[['submissions', 'Review Pending Grades', ClipboardList], ['chat', 'Manage Students', Users], ['groups', 'Create Assessment', CheckSquare]].map(([tab, label, ActionIcon]) => <button key={label} onClick={() => setActiveTab(tab)} className="flex w-full items-center gap-3 rounded-xl bg-[#E8F3FB] px-3 py-3 text-left text-sm font-semibold text-[#0F3D6E] transition hover:bg-[#d7ebf8] dark:bg-[#1d3049] dark:text-[#E8EEF9]">{React.createElement(ActionIcon, { size: 17 })}<span>{label}</span><ChevronRight className="ml-auto" size={16} /></button>)}</div></section>
                </div>

                <section className="mt-6 rounded-2xl border border-[#E3E9F2] bg-white p-5 shadow-sm dark:border-[#1E2940] dark:bg-[#121A2D]"><div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">Your Units</h3><p className="mt-1 text-xs text-[#6B7A90]">Click a unit to view its students and groups</p></div><button onClick={() => setActiveTab('groups')} className="text-sm font-bold text-[#0F3D6E] dark:text-[#9ccdf0]">View all</button></div>{units.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{units.map((unit) => <button type="button" key={unit.id} onClick={() => { setSelectedUnitId(unit.id); setActiveTab('groups'); }} className="rounded-xl border border-[#E3E9F2] bg-[#E8F3FB]/60 p-4 text-left transition hover:border-[#6DB6E6] hover:shadow-md dark:border-[#1E2940] dark:bg-[#182943]"><div className="mb-5 flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#b9dced] bg-white text-[#0F3D6E] dark:bg-[#121A2D] dark:text-[#9ccdf0]"><BookOpen size={17} /></span><span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#6B7A90] dark:bg-[#121A2D]">{unit.group_count} groups</span></div><h4 className="font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">{unit.code} · {unit.name}</h4><p className="mt-1 text-xs text-[#6B7A90]">{unit.course_name} · Year {unit.year_of_study}, Semester {unit.semester}</p><div className="mt-5 flex gap-4 text-xs text-[#6B7A90]"><span className="flex items-center gap-1"><Users size={14} />{unit.student_count} students</span><span className="flex items-center gap-1"><ClipboardList size={14} />{unit.group_count} groups</span></div></button>)}</div> : <p className="rounded-xl bg-[#EEF3FA] p-6 text-center text-sm text-[#6B7A90] dark:bg-[#0B1120]">No teaching units have been assigned yet.</p>}</section>
              </>
            )}

            {activeTab === 'groups' && <Panel title="My Units" description="Students registered for the units you teach, with their groups and contact links." content={<div className="space-y-5"><button type="button" onClick={() => setShowGroupForm((visible) => !visible)} className="rounded-xl bg-[#0F3D6E] px-4 py-2 text-sm font-bold text-white">＋ Create group</button>{showGroupForm && <form onSubmit={createGroup} className="grid gap-3 rounded-2xl bg-[#E8F3FB] p-4 md:grid-cols-4"><input required placeholder="Group name" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} className="rounded-xl border p-3" /><select required value={groupForm.unit_id} onChange={(event) => setGroupForm({ ...groupForm, unit_id: event.target.value })} className="rounded-xl border p-3"><option value="">Assigned unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select><input required min="2" type="number" value={groupForm.max_members} onChange={(event) => setGroupForm({ ...groupForm, max_members: event.target.value })} className="rounded-xl border p-3" /><button className="rounded-xl bg-[#F57D67] px-4 py-2 font-bold text-white">Save group</button></form>}{units.length ? units.filter((unit) => !selectedUnitId || unit.id === selectedUnitId).map((unit) => <section key={unit.id} className="rounded-2xl border border-[#E3E9F2] p-5 dark:border-[#1E2940]"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">{unit.code} · {unit.name}</h3><p className="mt-1 text-xs text-[#6B7A90]">{unit.course_code} · Year {unit.year_of_study}, Semester {unit.semester}</p></div><div className="flex gap-2 text-xs font-semibold"><span className="rounded-full bg-[#E8EFFB] px-3 py-1 text-[#0F3D6E]">{unit.student_count} students</span><span className="rounded-full bg-[#E6F5EC] px-3 py-1 text-[#22764F]">{unit.group_count} groups</span></div></div>{unit.students?.length ? <div className="grid gap-2 md:grid-cols-2">{unit.students.map((student) => <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#EEF3FA] px-3 py-2.5 dark:bg-[#0B1120]"><div className="min-w-0"><p className="truncate text-sm font-semibold">{student.name}</p><p className="truncate text-xs text-[#6B7A90]">{student.email}</p></div><button onClick={() => messageStudent(student)} className="shrink-0 rounded-lg bg-[#0F3D6E] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#174f89]">Message</button></div>)}</div> : <p className="text-sm text-[#6B7A90]">No registered students for this unit yet.</p>}</section>) : <EmptyState text="No teaching units have been assigned yet." />}</div>} />}
            {activeTab === 'progress' && <Panel title="Analytics" description="Track assessment activity across your units." content={<div className="rounded-xl bg-[#E8F3FB] p-6 text-sm text-[#6B7A90] dark:bg-[#182943]">Analytics will appear here as assessment data is recorded.</div>} />}
            {activeTab === 'submissions' && <Panel title="Assessments" description="Review recent student submissions." content={filteredSubmissions.length ? <div className="space-y-3">{filteredSubmissions.map((submission) => <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E3E9F2] p-4 dark:border-[#1E2940]"><div><p className="font-bold">{submission.project_title}</p><p className="text-xs text-[#6B7A90]">Submitted by {submission.submitted_by}</p></div><span className="rounded-full bg-[#E6F5EC] px-3 py-1 text-xs font-bold capitalize text-[#22A06B]">{submission.status}</span></div>)}</div> : <EmptyState text="No submissions yet." />} />}
            {activeTab === 'settings' && <Panel title="Settings" description="Manage your portal preferences." content={<button onClick={() => setDarkMode((value) => !value)} className="flex items-center gap-3 rounded-xl bg-[#EEF3FA] px-4 py-3 text-sm font-semibold dark:bg-[#0B1120]">{darkMode ? <Sun size={18} /> : <Moon size={18} />} Switch to {darkMode ? 'light' : 'dark'} mode</button>} />}
            {activeTab === 'chat' && <Panel title="Students" description="Open a conversation with your groups." content={<div className="grid gap-4 lg:grid-cols-[280px_1fr]">{<div className="space-y-2">{chatRooms.length ? chatRooms.map((room) => <button key={room.id} onClick={() => selectChatRoom(room)} className={`w-full rounded-xl p-3 text-left text-sm ${selectedChatRoom?.id === room.id ? 'bg-[#E8F3FB] text-[#0F3D6E]' : 'bg-[#EEF3FA] dark:bg-[#0B1120]'}`}>{room.name || `Chat room ${room.id}`}</button>) : <EmptyState text="No chat rooms available." />}</div>}{<div className="min-h-64 rounded-xl bg-[#EEF3FA] p-4 dark:bg-[#0B1120]">{selectedChatRoom ? <><div className="mb-4 space-y-2">{chatLoading ? <p className="text-sm text-[#6B7A90]">Loading messages...</p> : messages.map((message, index) => <p key={message.id || index} className="rounded-lg bg-white p-2 text-sm dark:bg-[#121A2D]">{message.content}</p>)}</div><div className="flex gap-2"><input value={newMessage} onChange={(event) => setNewMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} className="min-w-0 flex-1 rounded-xl border border-[#E3E9F2] bg-white px-3 py-2 text-sm dark:border-[#1E2940] dark:bg-[#121A2D]" placeholder="Write a message..." /><button onClick={sendMessage} className="rounded-xl bg-[#0F3D6E] px-4 text-sm font-bold text-white">Send</button></div></> : <p className="text-sm text-[#6B7A90]">Select a chat room to view messages.</p>}</div>}</div>} />}
          </main>
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, description, content }) => <section className="rounded-2xl border border-[#E3E9F2] bg-white p-6 shadow-sm dark:border-[#1E2940] dark:bg-[#121A2D]"><h2 className="text-xl font-bold text-[#0F3D6E] dark:text-[#E8EEF9]">{title}</h2><p className="mb-6 mt-1 text-sm text-[#6B7A90]">{description}</p>{content}</section>;
const UnitSummary = ({ group }) => <div className="rounded-xl border border-[#E3E9F2] bg-[#E8F3FB]/60 p-4 dark:border-[#1E2940] dark:bg-[#182943]"><BookOpen size={20} className="mb-4 text-[#0F3D6E] dark:text-[#9ccdf0]" /><h3 className="font-bold">{group.name}</h3><p className="mt-1 text-sm text-[#6B7A90]">{group.course} · Year {group.year_of_study}</p><p className="mt-4 text-xs text-[#6B7A90]">{group.members_count || 0} students · {group.projects?.length || 0} projects</p></div>;
const EmptyState = ({ text }) => <p className="rounded-xl bg-[#EEF3FA] p-6 text-center text-sm text-[#6B7A90] dark:bg-[#0B1120]">{text}</p>;

export default LecturerDashboard;

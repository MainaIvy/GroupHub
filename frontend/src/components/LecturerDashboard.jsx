import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Bell, Search, CalendarDays, SlidersHorizontal, LogOut } from 'lucide-react';
import { LogoutOutlined } from '@ant-design/icons';


const LecturerDashboard = () => {

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [salutation, setSalutation] = useState('');

  // Sidebar

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'progress', label: 'Progress', icon: '📈' },
    { id: 'groups', label: 'Groups', icon: '👥' },
    { id: 'submissions', label: 'Submissions', icon: '📝' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'profile', label: 'Profile', icon: '👤' }
  ];

  // Data for dashboard
  const [students, setStudents] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);

  // NOTE: students state is currently fetched for future chat enhancements.
  // ESLint currently flags it as unused, so we explicitly mark it as used.
  // eslint-disable-next-line no-unused-vars
  void students;
  const [selectedChatRoom, setSelectedChatRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Notifications + chat
  const [unreadCounts, setUnreadCounts] = useState({});





  const [isFetchingDashboard, setIsFetchingDashboard] = useState(false);

  // Real-time greeting
  useEffect(() => {
    const updateSalutation = () => {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Good morning' : 'Good afternoon';
      const title = dashboardData?.user?.title || 'Mr.';
      const name = dashboardData?.user?.first_name || 'Test Test';
      setSalutation(`${greeting}, ${title} ${name}`);
    };

    updateSalutation();
    const interval = setInterval(updateSalutation, 60000);
    return () => clearInterval(interval);
  }, [dashboardData]);

  useEffect(() => {
    fetchDashboardData();

    if (activeTab === 'chat') {
      fetchStudents();
      fetchChatRooms();
      fetchUnreadCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Socket connection management
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });



    newSocket.on('new_message', (message) => {
      if (selectedChatRoom && message.room_id === selectedChatRoom.id) {
        setMessages((prev) => [...prev, message]);
        markRoomNotificationsRead(message.room_id);
      } else {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.room_id]: (prev[message.room_id] || 0) + 1
        }));
      }

    });

    return () => newSocket.disconnect();

  }, [selectedChatRoom]);

  const fetchDashboardData = async () => {
    if (isFetchingDashboard) return;

    setIsFetchingDashboard(true);
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const response = await axios.get('/api/accounts/dashboard/lecturer/', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDashboardData(response.data);
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        setError('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
      setIsFetchingDashboard(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
  };

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('/api/accounts/students/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(response.data);
    } catch (e) {
      console.error('Error fetching students:', e);
    }
  };

  const fetchChatRooms = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('/api/accounts/chat/rooms/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatRooms(response.data);
    } catch (e) {
      console.error('Error fetching chat rooms:', e);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('/api/accounts/chat/unread-counts/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCounts(response.data);
    } catch (e) {
      console.error('Error fetching unread counts:', e);
    }
  };

  const selectChatRoom = async (room) => {

    setSelectedChatRoom(room);
    setChatLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`/api/accounts/chat/messages/${room.id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (e) {
      console.error('Error fetching messages:', e);
    } finally {
      setChatLoading(false);
    }
  };



  const sendMessage = async () => {

    if (!newMessage.trim() || !selectedChatRoom) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(
        `/api/accounts/chat/send/${selectedChatRoom.id}/`,
        { content: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages((prev) => [...prev, response.data]);
      setNewMessage('');
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  const markRoomNotificationsRead = async (roomId) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        `/api/accounts/chat/mark-read/${roomId}/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUnreadCounts((prev) => ({ ...prev, [roomId]: 0 }));
    } catch (e) {
      console.error('Error marking notifications as read:', e);
    }
  };

  const filteredGroups =
    dashboardData?.groups?.filter(
      (g) =>
        g.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.course?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.year_of_study?.toString().includes(searchQuery)
    ) || [];

  const filteredSubmissions =
    dashboardData?.recent_submissions?.filter(
      (s) =>
        s.project_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.submitted_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.status?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex"
      style={{
        backgroundColor: '#f5f4f1',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      }}
    >
      {/* Sidebar */}
      <aside className="w-52" style={{ backgroundColor: '#16162a', minHeight: '100vh' }}>
        <div className="p-5">
          <button
            onClick={() => setActiveTab('profile')}
            className="w-full flex items-center gap-3 text-white transition-colors"
            aria-label="GroupHub"
          >
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#F57D67' }}
            >
              <span className="font-bold text-lg" style={{ color: '#16162a' }}>
                G
              </span>
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-xl font-bold">GroupHub</span>
              <span className="text-[11px] tracking-wider text-gray-400 uppercase">LECTURER PORTAL</span>
            </div>
          </button>
        </div>

        <nav className="mt-2">
          <div className="px-4">
            {/* MAIN */}
            <div className="mt-4">
              <div className="text-[11px] tracking-wider text-gray-400 uppercase mb-2">MAIN</div>
              {['dashboard', 'progress', 'groups'].map((id) => {
                const item = sidebarItems.find((x) => x.id === id);
                if (!item) return null;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`w-full flex items-center px-3 py-2.5 mb-1 text-left rounded-lg transition-colors ${
                      activeTab === id
                        ? 'bg-[rgba(245,125,103,0.15)] text-[#F57D67]'
                        : 'text-[rgba(255,255,255,0.45)] hover:bg-white/5'
                    }`}
                  >
                    <span className="mr-3 text-base">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* WORK */}
            <div className="mt-4">
              <div className="text-[11px] tracking-wider text-gray-400 uppercase mb-2">WORK</div>

              {['submissions', 'chat'].map((id) => {
                const item = sidebarItems.find((x) => x.id === id);
                if (!item) return null;

                const showPill = id === 'submissions' || id === 'chat';
                const pillValue = id === 'chat' ? (unreadCounts?.total || 0) : 2;

                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`w-full flex items-center px-3 py-2.5 mb-1 text-left rounded-lg transition-colors ${
                      activeTab === id
                        ? 'bg-[rgba(245,125,103,0.15)] text-[#F57D67]'
                        : 'text-[rgba(255,255,255,0.45)] hover:bg-white/5'
                    }`}
                  >
                    <span className="mr-3 text-base">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>

                    {showPill && (
                      <span
                        className={`ml-auto text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          activeTab === id
                            ? 'bg-[#F57D67] text-[#16162a]'
                            : 'bg-[#F57D67] text-[#16162a] opacity-90'
                        }`}
                      >
                        {pillValue}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ACCOUNT */}
            <div className="mt-4">
              <div className="text-[11px] tracking-wider text-gray-400 uppercase mb-2">ACCOUNT</div>
              {['settings', 'profile'].map((id) => {
                const item = sidebarItems.find((x) => x.id === id);
                if (!item) return null;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`w-full flex items-center px-3 py-2.5 mb-1 text-left rounded-lg transition-colors ${
                      activeTab === id
                        ? 'bg-[rgba(245,125,103,0.15)] text-[#F57D67]'
                        : 'text-[rgba(255,255,255,0.45)] hover:bg-white/5'
                    }`}
                  >
                    <span className="mr-3 text-base">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Bottom user card */}
        <div className="absolute bottom-0 w-52 p-4" style={{ backgroundColor: '#16162a' }}>
          <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: '#16162a' }}>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#1F2633' }}
            >
              <span className="text-white font-semibold text-sm">
                {dashboardData?.user?.first_name?.[0] || 'U'}
                {dashboardData?.user?.last_name?.[0] || ''}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-white font-medium text-sm truncate">
                {dashboardData?.user?.first_name} {dashboardData?.user?.last_name}
              </div>
              <div className="text-[11px] tracking-wide text-gray-400 uppercase truncate">
                {dashboardData?.user?.user_type || 'Lecturer'}
              </div>
            </div>

            <button onClick={handleLogout} className="text-[#F57D67] hover:text-white transition-colors" aria-label="Logout">
              <LogoutOutlined />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className={`shadow-sm border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <div className="px-6 py-4">
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <span className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {salutation}
                </span>
              </div>

              <div className="flex-1" />

              {activeTab === 'dashboard' && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-400">🔍</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Search groups and submissions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-64 pl-10 pr-4 py-1 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              )}

              <button
                onClick={toggleDarkMode}
                className={`ml-4 p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <span className="text-xl">{darkMode ? '☀️' : '🌙'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className={`overflow-hidden rounded-xl shadow-sm bg-white ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="py-5 px-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">👥</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className={`text-sm font-medium truncate ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                            Total Groups
                          </dt>
                          <dd className={`text-3xl font-bold text-slate-800 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                            {dashboardData?.stats?.total_groups || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`overflow-hidden shadow rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">🎓</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className={`text-sm font-medium truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Total Students
                          </dt>
                          <dd className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {dashboardData?.stats?.total_students || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`overflow-hidden shadow rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">📋</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className={`text-sm font-medium truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Pending Submissions
                          </dt>
                          <dd className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {dashboardData?.stats?.pending_submissions || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`shadow rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>My Groups</h3>
                    {dashboardData?.groups?.length ? (
                      filteredGroups.length ? (
                        <div className="space-y-4">
                          {filteredGroups.map((group) => (
                            <div
                              key={group.id}
                              className={`border rounded-lg p-4 transition-shadow hover:shadow-md ${
                                darkMode ? 'border-gray-700 bg-gray-700 hover:bg-gray-600' : 'border-gray-200 hover:shadow-md'
                              }`}
                            >
                              <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{group.name}</h4>
                              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {group.course} - Year {group.year_of_study}
                              </p>
                              <div className={`mt-2 flex justify-between text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                <span>Members: {group.members_count}</span>
                                <span>Projects: {group.projects?.length || 0}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No groups match your search.</p>
                      )
                    ) : (
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No groups yet.</p>
                    )}
                  </div>
                </div>

                <div className={`shadow rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Recent Submissions</h3>
                    {filteredSubmissions.length ? (
                      <div className="space-y-4">
                        {filteredSubmissions.map((submission) => (
                          <div
                            key={submission.id}
                            className={`border rounded-lg p-4 transition-shadow hover:shadow-md ${
                              darkMode ? 'border-gray-700 bg-gray-700 hover:bg-gray-600' : 'border-gray-200 hover:shadow-md'
                            }`}
                          >
                            <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{submission.project_title}</h4>
                            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              Submitted by: {submission.submitted_by}
                            </p>
                            <div className={`mt-2 flex justify-between text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              <span>Status: {submission.status}</span>
                              <span>{new Date(submission.submitted_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No submissions match your search.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'groups' && (
            <div className={`shadow rounded-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Groups Management</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Groups management functionality coming soon...</p>
            </div>
          )}

          {activeTab === 'submissions' && (
            <div className={`shadow rounded-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Submissions Review</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Submissions review functionality coming soon...</p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={`shadow rounded-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Application Settings</h3>
              <div className="space-y-6">
                <div>
                  <h4 className={`text-md font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Appearance</h4>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Dark Mode</span>
                    <button
                      onClick={toggleDarkMode}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        darkMode ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          darkMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className={`shadow rounded-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Profile Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Name</label>
                  <p className={`mt-1 text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {dashboardData?.user?.first_name} {dashboardData?.user?.last_name}
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                  <p className={`mt-1 text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.user?.email}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>User Type</label>
                  <p className={`mt-1 text-sm capitalize ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.user?.user_type}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className={`h-screen flex ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
              <div className={`w-80 border-r ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'}`}>
                <div className={`p-4 border-b ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Chats</h2>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {chatRooms?.filter((room) => room.type === 'group').map((room) => (
                    <button
                      key={room.id}
                      onClick={() => selectChatRoom(room)}
                      className={`w-full p-3 flex items-center space-x-3 hover:bg-gray-100 transition-colors ${
                        selectedChatRoom?.id === room.id
                          ? darkMode ? 'bg-gray-700' : 'bg-blue-50'
                          : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">👥</div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{room.name}</div>
                      </div>
                    </button>
                  ))}

                  {chatRooms?.filter((room) => room.type === 'direct').map((room) => (
                    <button
                      key={room.id}
                      onClick={() => selectChatRoom(room)}
                      className={`w-full p-3 flex items-center space-x-3 hover:bg-gray-100 transition-colors ${
                        selectedChatRoom?.id === room.id
                          ? darkMode ? 'bg-gray-700' : 'bg-blue-50'
                          : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {room.name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{room.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                {selectedChatRoom ? (
                  <>
                    <div className={`p-4 border-b flex items-center space-x-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">💬</div>
                      <div>
                        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedChatRoom.name}</h3>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {selectedChatRoom.type === 'group' ? 'Group Chat' : 'Direct Message'}
                        </p>
                      </div>
                    </div>

                    <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                      {chatLoading ? (
                        <div className="flex justify-center items-center h-full">Loading messages...</div>
                      ) : messages.length ? (
                        messages.map((m, idx) => {
                          const isOwn = m.sender?.id === dashboardData?.user?.id;
                          return (
                            <div key={m.id || idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                              <div
                                className={`px-4 py-2 rounded-2xl shadow-sm ${
                                  isOwn
                                    ? 'bg-blue-600 text-white rounded-br-md'
                                    : darkMode
                                      ? 'bg-gray-700 text-white rounded-bl-md'
                                      : 'bg-white text-gray-900 rounded-bl-md'
                                }`}
                              >
                                <p className="text-sm">{m.content}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex justify-center items-center h-full">No messages yet</div>
                      )}
                    </div>

                    <div className={`p-4 border-t ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                      <div className="flex space-x-3">
                        <input
                          type="text"
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') sendMessage();
                          }}
                          className={`flex-1 px-4 py-3 pr-12 rounded-full border ${
                            darkMode
                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                              : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                          className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">Select a conversation to start messaging</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default LecturerDashboard;


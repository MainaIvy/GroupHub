import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  BarChart3, Bell, BookOpen, CheckSquare, ClipboardList, FileSpreadsheet,
  LayoutDashboard, LogOut, Menu, MessageSquare, Moon, Search, Settings, Sun, Users, X,
  Plus, ChevronDown, Clock, CheckCircle2, MoreHorizontal, Calendar as CalendarIcon,
  HelpCircle, Upload
} from 'lucide-react';

const API = '/api/accounts';
const auth = () => ({ Authorization: 'Bearer ' + window.localStorage.getItem('access_token') });

const tabs = [
  ['dashboard', 'Dashboard', LayoutDashboard], 
  ['analytics', 'Analytics', BarChart3],
  ['units', 'Course', BookOpen], 
  ['students', 'Students', Users],
  ['assessments', 'Assessments', ClipboardList], 
  ['messages', 'Messages', MessageSquare],
  ['settings', 'Setting', Settings]
];

// --- Reusable Components ---

const Panel = ({ title, description, action, children, className = "" }) => (
  <section className={`rounded-2xl border border-[#E3E9F2] bg-white p-6 shadow-sm dark:border-[#1E2940] dark:bg-[#121A2D] ${className}`}>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-[#0F3D6E] dark:text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#6B7A90]">{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Field = ({ className = '', ...props }) => (
  <input {...props} className={`rounded-xl border border-[#E3E9F2] bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#6DB6E6] dark:border-[#1E2940] dark:bg-[#0B1120] ${className}`} />
);

const Empty = ({ children }) => (
  <p className="rounded-xl bg-[#EEF3FA] p-8 text-center text-sm text-[#6B7A90] dark:bg-[#0B1120]">{children}</p>
);

const StatCard = ({ icon: Icon, value, label, subtext, colorClass }) => (
  <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm dark:bg-[#121A2D]">
    <div className="flex items-center justify-between">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClass}`}>
        <Icon size={20} />
      </div>
      <b className="text-2xl font-extrabold text-[#0F3D6E] dark:text-white">{value}</b>
    </div>
    <p className="mt-4 text-sm font-bold text-[#12294A] dark:text-gray-200">{label}</p>
    <p className="mt-1 text-xs text-[#6B7A90]">{subtext}</p>
  </div>
);

export default function LecturerDashboard() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState('');
  const [unitId, setUnitId] = useState('');
  const [detail, setDetail] = useState(null);
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '', status: 'reviewed' });
  const [gradingMode, setGradingMode] = useState('student');
  const [gradingGroupId, setGradingGroupId] = useState('');
  const [groupSubmissions, setGroupSubmissions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  
  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const units = data?.units || [];
  const groups = data?.groups || [];
  const submissions = data?.recent_submissions || [];
  const user = data?.user;
  const selectedUnit = units.find((unit) => String(unit.id) === String(unitId));
  const students = selectedUnit?.students || [];
  const filteredStudents = students.filter((student) => `${student.name} ${student.email}`.toLowerCase().includes(query.toLowerCase()));
  const pending = submissions.filter((submission) => submission.status === 'submitted');
  const totalAssessments = units.reduce((sum, unit) => sum + (unit.assessment_count || 0), 0);
  const avgCompletion = units.length ? Math.round(units.reduce((sum, unit) => sum + (unit.completion_percentage || 0), 0) / units.length) : 0;
  const rows = gradingMode === 'group' && gradingGroupId ? groupSubmissions : submissions;

  const load = async () => {
    try { const response = await axios.get(`${API}/dashboard/lecturer/`, { headers: auth() }); setData(response.data); } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to load dashboard.'); } finally { setLoading(false); }
  };
  
  useEffect(() => { load(); }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('darkMode', String(dark)); }, [dark]);
  useEffect(() => { if (tab === 'messages') axios.get(`${API}/chat/rooms/`, { headers: auth() }).then((response) => setRooms(response.data)).catch(() => setError('Unable to load messages.')); }, [tab]);
  useEffect(() => { if (gradingMode === 'group' && gradingGroupId) axios.get(`${API}/groups/${gradingGroupId}/submissions/`, { headers: auth() }).then((response) => setGroupSubmissions(response.data)).catch(() => setError('Unable to load group submissions.')); }, [gradingMode, gradingGroupId]);

  // Close notifications on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openDetails = (title, items) => setDetail({ title, items });
  const openPending = () => setDetail({ title: 'Pending grades', submissions: pending });
  const openSubmission = (submission) => { setGradeForm({ grade: submission.grade ?? '', feedback: submission.feedback || '', status: submission.status === 'submitted' ? 'reviewed' : submission.status }); setDetail(submission); };
  
  const grade = async (event) => {
    event.preventDefault();
    try { await axios.patch(`${API}/submissions/${detail.id}/grade/`, gradeForm, { headers: auth() }); setNotice('Grade saved successfully.'); setDetail(null); load(); if (gradingGroupId) { const response = await axios.get(`${API}/groups/${gradingGroupId}/submissions/`, { headers: auth() }); setGroupSubmissions(response.data); } } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to save grade.'); }
  };
  
  const openGroup = async (group) => {
    try { const response = await axios.get(`${API}/groups/${group.id}/workspace/`, { headers: auth() }); setDetail({ title: group.name, group: response.data }); } catch { setError('Unable to load group progress.'); }
  };
  
  const selectRoom = async (selected) => { setRoom(selected); try { const response = await axios.get(`${API}/chat/messages/${selected.id}/`, { headers: auth() }); setMessages(response.data); } catch { setError('Unable to load messages.'); } };
  const sendMessage = async () => { if (!draft.trim() || !room) return; try { const response = await axios.post(`${API}/chat/send/${room.id}/`, { content: draft }, { headers: auth() }); setMessages((current) => [...current, response.data]); setDraft(''); } catch { setError('Unable to send message.'); } };
  const exportStudents = () => { const rowsToExport = units.flatMap((unit) => (unit.students || []).map((student) => ({ Name: student.name, Email: student.email, Unit: unit.code, Programme: student.course || '' }))); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rowsToExport), 'Students'); XLSX.writeFile(workbook, 'my-unit-students.xlsx'); };
  const demo = async (method) => { try { const response = await axios({ method, url: `${API}/lecturer/demo-data/`, headers: auth() }); setNotice(method === 'post' ? `${response.data.students_created} students and ${response.data.groups_created} groups created.` : 'Demo data deleted.'); load(); } catch (requestError) { setError(requestError.response?.data?.error || 'Demo data action failed.'); } };
  const logout = () => { localStorage.clear(); window.location.href = '/login'; };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F4F7FC] text-[#0F3D6E]">Loading your lecturer workspace...</div>;

  return (
    <div className="min-h-screen bg-[#F4F7FC] text-[#12294A] dark:bg-[#0B1120] dark:text-[#E8EEF9] font-sans">
      <div className="flex min-h-screen">
        
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-30 w-[260px] transform border-r border-[#E3E9F2] bg-white p-5 transition-transform dark:border-[#1E2940] dark:bg-[#121A2D] md:static md:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-full flex-col">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6DB6E6] text-white">
                  <BookOpen size={20} />
                </div>
                <b className="text-xl font-bold text-[#0F3D6E] dark:text-white">SchoolMax</b>
              </div>
              <button onClick={() => setMobile(false)} className="md:hidden"><X size={20} /></button>
            </div>
            
            <div className="space-y-1">
              {tabs.map(([id, label, icon]) => (
                <button 
                  key={id} 
                  onClick={() => { setTab(id); setMobile(false); }} 
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${tab === id ? 'bg-[#6DB6E6] text-white shadow-md' : 'text-[#6B7A90] hover:bg-[#EEF3FA] dark:hover:bg-[#1E2940]'}`}
                >
                  {React.createElement(icon, { size: 18 })}
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-1">
               <button className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-[#6B7A90] hover:bg-[#EEF3FA] dark:hover:bg-[#1E2940]">
                  <Upload size={18} /> Import LMS
               </button>
               <button className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-[#6B7A90] hover:bg-[#EEF3FA] dark:hover:bg-[#1E2940]">
                  <HelpCircle size={18} /> Help center
               </button>
            </div>

            <div className="mt-auto border-t border-[#E3E9F2] pt-6 dark:border-[#1E2940]">
              <button onClick={() => setDark((value) => !value)} className="flex w-full items-center gap-3 text-sm font-semibold text-[#6B7A90] transition-colors hover:text-[#0F3D6E] dark:hover:text-white">
                {dark ? <Sun size={18} /> : <Moon size={18} />}
                {dark ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
          
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[#E3E9F2] bg-white px-6 py-3 dark:border-[#1E2940] dark:bg-[#121A2D]">
            <div className="flex items-center gap-4 flex-1">
              <button onClick={() => setMobile(true)} className="md:hidden"><Menu size={22} /></button>
              <div className="relative w-full max-w-md hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A97AF]" size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className="w-full rounded-full border border-[#E3E9F2] bg-[#F4F7FC] py-2.5 pl-10 pr-4 text-sm outline-none dark:border-[#1E2940] dark:bg-[#0B1120]" />
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative rounded-full p-2 text-[#6B7A90] hover:bg-[#F4F7FC] transition-colors dark:hover:bg-[#1E2940]"
                >
                  <Bell size={20} />
                  {pending.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white dark:border-[#121A2D]"></span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#E3E9F2] bg-white p-2 shadow-lg dark:border-[#1E2940] dark:bg-[#121A2D] z-50">
                    <div className="flex justify-between items-center p-3 border-b border-[#E3E9F2] dark:border-[#1E2940]">
                      <h3 className="font-bold text-sm">Notifications</h3>
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{pending.length} new</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {pending.length > 0 ? pending.map(sub => (
                        <button key={sub.id} onClick={() => { openSubmission(sub); setShowNotifications(false); }} className="w-full text-left p-3 hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] border-b border-[#E3E9F2] dark:border-[#1E2940] last:border-0 transition-colors">
                          <p className="text-sm font-semibold text-[#0F3D6E] dark:text-white">{sub.project_title}</p>
                          <p className="text-xs text-[#6B7A90] mt-1">Submitted by {sub.submitted_by || sub.submitted_by_name}</p>
                        </button>
                      )) : (
                        <p className="p-4 text-center text-sm text-[#6B7A90]">No new notifications</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="flex items-center gap-3 pl-6 border-l border-[#E3E9F2] dark:border-[#1E2940]">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-[#6B7A90]">Welcome back</p>
                  <p className="text-sm font-bold text-[#0F3D6E] dark:text-white">{user?.first_name} {user?.last_name}</p>
                </div>
                <div className="h-10 w-10 overflow-hidden rounded-full bg-[#E8F3FB] border-2 border-white shadow-sm flex items-center justify-center font-bold text-[#0F3D6E]">
                  {user?.first_name?.[0] || 'L'}
                </div>
                <button onClick={logout} className="ml-2 text-[#6B7A90] hover:text-red-500 transition-colors" title="Logout">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </header>

          {/* Scrollable Main Area */}
          <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
            {error && <Notice tone="error" text={error} clear={() => setError('')} />}
            {notice && <Notice text={notice} clear={() => setNotice('')} />}
            
            {tab === 'dashboard' && (
              <>
                {/* Dashboard Header & Add Course Button */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                  <h1 className="text-2xl font-bold text-[#0F3D6E] dark:text-white">Teacher Dashboard</h1>
                  <button className="flex items-center gap-2 rounded-xl bg-[#0F3D6E] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#154e8a] transition-colors">
                    <Plus size={18} /> Add Course <ChevronDown size={16} className="ml-1 opacity-70" />
                  </button>
                </div>

                {/* Stats Row */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={Clock} value={pending.length} label="Pending to Grade" subtext="-5 from yesterday" colorClass="bg-yellow-50 text-yellow-500" />
                  <StatCard icon={Users} value={units.reduce((sum, unit) => sum + (unit.student_count || 0), 0)} label="Total Students" subtext="+8 new this semester" colorClass="bg-blue-50 text-blue-500" />
                  <StatCard icon={CheckCircle2} value={avgCompletion + '%'} label="Average Completion" subtext="Across all active courses" colorClass="bg-green-50 text-green-500" />
                  <StatCard icon={BookOpen} value={units.length} label="Active Courses" subtext="Currently teaching" colorClass="bg-purple-50 text-purple-500" />
                </div>

                {/* Charts & Quick Actions Row */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <Panel title="Assessment Completion" action={
                      <button className="flex items-center gap-2 text-sm font-semibold text-[#0F3D6E] bg-[#F4F7FC] px-3 py-1.5 rounded-lg">
                        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} <ChevronDown size={14} />
                      </button>
                    }>
                      <div className="mt-4 flex h-64 items-end justify-between gap-4 border-b border-[#E3E9F2] pb-2 px-2">
                        {units.map((unit) => {
                          const comp = unit.completion_percentage || 0;
                          return (
                            <div key={unit.id} className="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer">
                              <div className="relative w-full max-w-[40px] flex items-end justify-center gap-1 h-full">
                                {/* Submitted Bar */}
                                <div className="w-4 rounded-t bg-[#6DB6E6] transition-all group-hover:bg-[#0F3D6E]" style={{ height: `${Math.max(5, comp)}%` }}></div>
                                {/* Pending Bar */}
                                <div className="w-4 rounded-t bg-[#E3E9F2] dark:bg-[#26365a] transition-all" style={{ height: `${Math.max(5, 100 - comp)}%` }}></div>
                                
                                {/* Tooltip */}
                                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 bg-[#0F3D6E] text-white text-xs py-1 px-2 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                                  {comp}% Complete
                                </div>
                              </div>
                              <span className="mt-3 text-[10px] font-bold text-[#6B7A90] text-center uppercase tracking-wider truncate w-full max-w-[80px]">
                                {unit.code}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7A90]"><span className="w-3 h-3 rounded-full bg-[#6DB6E6]"></span> Submitted</div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7A90]"><span className="w-3 h-3 rounded-full bg-[#E3E9F2]"></span> Pending</div>
                      </div>
                    </Panel>
                  </div>

                  <div>
                    <Panel title="Quick Actions">
                      <div className="space-y-3 mt-2">
                        <button onClick={openPending} className="w-full flex items-center justify-between rounded-xl bg-[#F4F7FC] p-4 text-sm font-bold text-[#0F3D6E] transition-colors hover:bg-[#E8F3FB] dark:bg-[#0B1120] dark:hover:bg-[#1E2940]">
                          <div className="flex items-center gap-3"><CheckSquare size={18} /> Review Pending Grades</div>
                          <span className="text-[#8A97AF]">→</span>
                        </button>
                        <button onClick={() => setTab('students')} className="w-full flex items-center justify-between rounded-xl bg-[#F4F7FC] p-4 text-sm font-bold text-[#0F3D6E] transition-colors hover:bg-[#E8F3FB] dark:bg-[#0B1120] dark:hover:bg-[#1E2940]">
                          <div className="flex items-center gap-3"><Users size={18} /> Manage Students</div>
                          <span className="text-[#8A97AF]">→</span>
                        </button>
                        <button onClick={() => setTab('assessments')} className="w-full flex items-center justify-between rounded-xl bg-[#F4F7FC] p-4 text-sm font-bold text-[#0F3D6E] transition-colors hover:bg-[#E8F3FB] dark:bg-[#0B1120] dark:hover:bg-[#1E2940]">
                          <div className="flex items-center gap-3"><BookOpen size={18} /> Create Assessments</div>
                          <span className="text-[#8A97AF]">→</span>
                        </button>
                      </div>
                    </Panel>
                  </div>
                </div>

                {/* Your Courses Row */}
                <div className="mt-8">
                  <h2 className="text-lg font-bold text-[#0F3D6E] dark:text-white mb-4">Your Courses</h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {units.map((unit) => (
                      <div key={unit.id} onClick={() => { setUnitId(unit.id); setTab('students'); }} className="cursor-pointer rounded-2xl border border-[#E3E9F2] bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-[#1E2940] dark:bg-[#121A2D]">
                        <div className="flex items-center justify-between">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F3FB] text-[#0F3D6E]">
                            <BookOpen size={20} />
                          </div>
                          <span className="rounded-full bg-[#F4F7FC] px-3 py-1 text-xs font-bold text-[#6B7A90] dark:bg-[#0B1120]">
                            {(unit.assessment_count || 0) - (unit.completed_assessments || 0)} Pending
                          </span>
                        </div>
                        <h3 className="mt-4 font-bold text-[#0F3D6E] dark:text-white">{unit.name}</h3>
                        <p className="mt-1 text-xs text-[#6B7A90]">{unit.course_name}</p>
                        
                        <div className="mt-5 flex items-center justify-between border-t border-[#E3E9F2] pt-4 dark:border-[#1E2940]">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7A90]">
                            <Users size={14} /> {unit.student_count} Students
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7A90]">
                            <ClipboardList size={14} /> {unit.assessment_count || 0} Assessments
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calendar Section */}
                <div className="mt-6">
                   <TeachingCalendar month={calendarMonth} setMonth={setCalendarMonth} units={units} />
                </div>
              </>
            )}

            {/* --- Other Tabs (Keeping logic but adapting generic styling) --- */}
            {tab === 'analytics' && <Panel title="Assessment analytics" description="Completion across the units you teach."><Chart units={units} onSelect={(unit) => openDetails(unit.code, [{ label: 'Students', value: unit.student_count }, { label: 'Groups', value: unit.group_count }, { label: 'Completion', value: `${unit.completion_percentage || 0}%` }])} /></Panel>}
            {tab === 'units' && <Panel title="My Units" description="Every unit assigned to you. Select a unit to see its students and assessment activity."><UnitGrid units={units} onSelect={(unit) => { setUnitId(unit.id); setTab('students'); }} /></Panel>}
            {tab === 'groups' && <Groups groups={groups} onOpen={openGroup} />}
            {tab === 'students' && <Students units={units} selectedUnit={selectedUnit} unitId={unitId} setUnitId={setUnitId} students={filteredStudents} exportStudents={exportStudents} />}
            {tab === 'assessments' && <Assessments groups={groups} rows={rows} gradingMode={gradingMode} setGradingMode={setGradingMode} gradingGroupId={gradingGroupId} setGradingGroupId={setGradingGroupId} openSubmission={openSubmission} />}
            {tab === 'messages' && <Messages rooms={rooms} room={room} messages={messages} draft={draft} setDraft={setDraft} selectRoom={selectRoom} sendMessage={sendMessage} user={user} />}
            {tab === 'settings' && (
              <Panel title="Settings" description="Manage your profile and dashboard preview data." action={<div className="flex gap-2"><button onClick={() => demo('post')} className="rounded-xl bg-[#0F3D6E] px-3 py-2 text-xs font-bold text-white">Create demo data</button><button onClick={() => demo('delete')} className="rounded-xl border border-[#E5484D] px-3 py-2 text-xs font-bold text-[#E5484D]">Delete demo data</button></div>}>
                <p className="text-sm text-[#6B7A90]">Use demo data to preview students, groups, assessments, charts, and messages.</p>
              </Panel>
            )}

          </main>
        </div>
      </div>

      {detail && <Detail detail={detail} close={() => setDetail(null)} openSubmission={openSubmission} gradeForm={gradeForm} setGradeForm={setGradeForm} grade={grade} />}
    </div>
  );
}

// --- Sub-Components for Tabs ---

function UnitGrid({ units, onSelect }) { return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{units.map((unit) => <button key={unit.id} onClick={() => onSelect(unit)} className="rounded-2xl border border-[#DDEAF2] bg-[#E8F3FB] p-4 text-left dark:border-[#1E2940] dark:bg-[#182943] transition-transform hover:-translate-y-1"><div className="flex justify-between"><BookOpen size={19} className="text-[#0F3D6E]" /><span className="text-xs font-bold text-[#6B7A90]">{unit.completion_percentage || 0}% complete</span></div><h3 className="mt-5 font-bold text-[#0F3D6E] dark:text-white">{unit.code} · {unit.name}</h3><p className="mt-1 text-xs text-[#6B7A90]">{unit.course_name}</p><div className="mt-5 flex justify-between text-xs text-[#6B7A90]"><span>{unit.student_count} students</span><span>{unit.assessment_count || 0} assessments</span></div><div className="mt-3 h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-[#6DB6E6]" style={{ width: `${unit.completion_percentage || 0}%` }} /></div></button>)}</div>; }

function Groups({ groups, onOpen }) { return <Panel title="Groups" description="See what each group is doing and open its full workspace."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groups.map((group) => <button key={group.id} onClick={() => onOpen(group)} className="rounded-2xl border border-[#E3E9F2] p-4 text-left dark:border-[#1E2940] hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"><div className="flex justify-between"><Users className="text-[#0F3D6E]" /><span className="text-xs text-[#6B7A90]">{group.members_count} members</span></div><h3 className="mt-4 font-bold">{group.name}</h3><p className="text-xs text-[#6B7A90]">{group.unit_code || group.course}</p><p className="mt-4 text-sm text-[#6B7A90]">{group.projects?.length || 0} projects · click for progress</p></button>)}</div>{!groups.length && <Empty>No groups found.</Empty>}</Panel>; }

function Students({ units, selectedUnit, unitId, setUnitId, students, exportStudents }) { return <Panel title="Students" description="A table of students registered for each unit." action={<button onClick={exportStudents} className="flex items-center gap-2 rounded-xl border border-[#E3E9F2] px-4 py-2 text-sm font-bold hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"><FileSpreadsheet size={16} />Export</button>}><select value={unitId} onChange={(event) => setUnitId(event.target.value)} className="mb-6 w-full max-w-md rounded-xl border border-[#E3E9F2] bg-white p-3 text-sm outline-none dark:bg-[#0B1120]"><option value="">Select unit to view students</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select>{selectedUnit ? <div className="overflow-x-auto"><table className="w-full text-left text-sm whitespace-nowrap"><thead><tr className="border-b border-[#E3E9F2] text-xs uppercase text-[#6B7A90] bg-[#F4F7FC] dark:bg-[#0B1120]"><th className="p-4 rounded-tl-lg">Student</th><th className="p-4">Email</th><th className="p-4">Programme</th><th className="p-4 rounded-tr-lg">Year</th></tr></thead><tbody>{students.map((student) => <tr key={student.id} className="border-b border-[#E3E9F2] dark:border-[#1E2940] hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"><td className="p-4 font-semibold text-[#0F3D6E] dark:text-white">{student.name}</td><td className="p-4 text-[#6B7A90]">{student.email}</td><td className="p-4">{student.course || '—'}</td><td className="p-4">{student.year_of_study || '—'}</td></tr>)}</tbody></table>{!students.length && <div className="mt-4"><Empty>No students in this unit.</Empty></div>}</div> : <div className="mt-4"><Empty>Select a unit above to view its students.</Empty></div>}</Panel>; }

function Assessments({ groups, rows, gradingMode, setGradingMode, gradingGroupId, setGradingGroupId, openSubmission }) { return <Panel title="Assessments" description="Grade individual students or select a group and update each student's grade." action={<div className="flex gap-2 bg-[#F4F7FC] p-1 rounded-xl dark:bg-[#0B1120]"><button onClick={() => setGradingMode('student')} className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${gradingMode === 'student' ? 'bg-white text-[#0F3D6E] shadow-sm dark:bg-[#1E2940] dark:text-white' : 'text-[#6B7A90] hover:text-[#0F3D6E]'}`}>Per student</button><button onClick={() => setGradingMode('group')} className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${gradingMode === 'group' ? 'bg-white text-[#0F3D6E] shadow-sm dark:bg-[#1E2940] dark:text-white' : 'text-[#6B7A90] hover:text-[#0F3D6E]'}`}>Per group</button></div>}>{gradingMode === 'group' && <select value={gradingGroupId} onChange={(event) => setGradingGroupId(event.target.value)} className="mb-6 w-full max-w-md rounded-xl border border-[#E3E9F2] p-3 text-sm outline-none dark:bg-[#0B1120]"><option value="">Select group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((submission) => <button key={submission.id} onClick={() => openSubmission(submission)} className="rounded-xl border border-[#E3E9F2] p-5 text-left dark:border-[#1E2940] hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"><div className="flex justify-between items-start"><b className="text-[#0F3D6E] dark:text-white pr-4">{submission.project_title}</b><span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${submission.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{submission.status}</span></div><p className="mt-2 text-sm text-[#6B7A90]">{submission.submitted_by || submission.submitted_by_name}</p><p className="mt-4 font-bold text-[#0F3D6E] dark:text-white">{submission.grade == null ? 'Not graded' : `${submission.grade}%`}</p></button>)}</div>{!rows.length && <Empty>Select a group or wait for submissions.</Empty>}</Panel>; }

function Messages({ rooms, room, messages, draft, setDraft, selectRoom, sendMessage, user }) { return <Panel title="Messages" description="WhatsApp-style group conversations with clear senders and recipients."><div className="grid gap-4 lg:grid-cols-[280px_1fr] h-[600px]"><div className="space-y-2 overflow-y-auto pr-2">{rooms.map((item) => <button key={item.id} onClick={() => selectRoom(item)} className={`w-full rounded-xl p-4 text-left text-sm font-bold transition-colors ${room?.id === item.id ? 'bg-[#E8F3FB] text-[#0F3D6E] dark:bg-[#1E2940] dark:text-white' : 'bg-[#F4F7FC] text-[#6B7A90] hover:bg-[#E3E9F2] dark:bg-[#0B1120] dark:hover:bg-[#1E2940]'}`}>{item.name}</button>)}</div><div className="flex flex-col rounded-xl bg-[#F4F7FC] p-4 dark:bg-[#0B1120]">{room ? <><div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">{messages.map((message) => <div key={message.id} className={`flex ${message.sender?.id === user?.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl p-3 text-sm ${message.sender?.id === user?.id ? 'bg-[#D9FDD3] text-[#12294A]' : 'bg-white text-[#12294A] dark:bg-[#121A2D] dark:text-[#E8EEF9]'}`}><p className="mb-1 text-[10px] font-bold opacity-60">{message.sender?.id === user?.id ? 'You → Group' : `${message.sender?.first_name || ''} ${message.sender?.last_name || ''} → You`}</p><p>{message.content}</p><time className="mt-1 block text-[10px] opacity-50">{message.timestamp ? new Date(message.timestamp).toLocaleString() : ''}</time></div></div>)}</div><div className="flex gap-2"><Field className="flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." onKeyDown={(e) => e.key === 'Enter' && sendMessage()} /><button onClick={sendMessage} className="rounded-xl bg-[#0F3D6E] px-6 font-bold text-white transition-colors hover:bg-[#154e8a]">Send</button></div></> : <Empty>Select a group conversation.</Empty>}</div></div></Panel>; }

function TeachingCalendar({ month, setMonth, units }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const first = new Date(year, monthIndex, 1).getDay();
  
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Panel 
      title="Teaching Calendar" 
      description="Your weekday teaching days for the current month." 
      action={
        <div className="flex items-center gap-3 bg-[#F4F7FC] px-3 py-1.5 rounded-lg dark:bg-[#0B1120]">
          <button onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} className="text-[#6B7A90] hover:text-[#0F3D6E] font-bold px-2">‹</button>
          <b className="text-sm text-[#0F3D6E] dark:text-white min-w-[100px] text-center">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</b>
          <button onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} className="text-[#6B7A90] hover:text-[#0F3D6E] font-bold px-2">›</button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-2 text-center">
        {weekdays.map(day => <div key={day} className="text-xs font-bold text-[#6B7A90] uppercase py-2">{day}</div>)}
        
        {Array.from({ length: first }).map((_, index) => <div key={`empty-${index}`} />)}
        
        {Array.from({ length: days }, (_, index) => {
          const date = index + 1;
          const weekday = new Date(year, monthIndex, date).getDay();
          const isTeaching = weekday > 0 && weekday < 6; // Mon-Fri
          const isToday = new Date().toDateString() === new Date(year, monthIndex, date).toDateString();
          
          return (
            <div 
              key={date} 
              className={`min-h-[80px] rounded-xl border p-2 text-left transition-colors flex flex-col
                ${isTeaching ? 'border-[#B9DCEC] bg-[#E8F3FB] dark:border-[#26365a] dark:bg-[#182943]' : 'border-transparent bg-[#F4F7FC] dark:bg-[#121A2D]'} 
                ${isToday ? 'ring-2 ring-[#6DB6E6] ring-offset-2 dark:ring-offset-[#121A2D]' : ''}
              `}
            >
              <b className={`text-sm ${isToday ? 'bg-[#6DB6E6] text-white h-6 w-6 rounded-full flex items-center justify-center' : 'text-[#0F3D6E] dark:text-gray-300'}`}>{date}</b>
              {isTeaching && (
                <div className="mt-2 space-y-1 overflow-hidden">
                  {units.slice(0, 2).map(unit => (
                    <div key={unit.id} className="text-[9px] font-bold text-[#0F3D6E] bg-white/60 dark:bg-[#0B1120]/60 truncate px-1 py-0.5 rounded">
                      {unit.code}
                    </div>
                  ))}
                  {units.length > 2 && <div className="text-[9px] text-[#6B7A90] pl-1">+{units.length - 2} more</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Chart({ units, onSelect }) { return <div className="flex h-72 items-end gap-3 border-b border-[#E3E9F2] px-4 pb-2">{units.map((unit) => <button key={unit.id} onClick={() => onSelect(unit)} className="flex h-full flex-1 items-end justify-center gap-1 group" title={`${unit.code} completion`}><span className="w-6 rounded-t bg-[#6DB6E6] transition-all group-hover:bg-[#0F3D6E]" style={{ height: `${Math.max(5, unit.completion_percentage || 0)}%` }} /><span className="w-6 rounded-t bg-[#E3E9F2]" style={{ height: `${Math.max(5, 100 - (unit.completion_percentage || 0))}%` }} /></button>)}</div>; }

function Detail({ detail, close, openSubmission, gradeForm, setGradeForm, grade }) { return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#121A2D]"><div className="mb-5 flex justify-between items-center border-b border-[#E3E9F2] pb-4 dark:border-[#1E2940]"><h2 className="text-xl font-bold text-[#0F3D6E] dark:text-white">{detail.title || detail.project_title}</h2><button onClick={close} className="p-1 rounded-full hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"><X size={20} /></button></div>{detail.submissions ? detail.submissions.map((submission) => <button key={submission.id} onClick={() => openSubmission(submission)} className="mb-2 w-full rounded-xl bg-[#F4F7FC] p-4 text-left hover:bg-[#E8F3FB] dark:bg-[#0B1120] dark:hover:bg-[#1E2940] transition-colors"><b className="text-[#0F3D6E] dark:text-white">{submission.project_title}</b><p className="text-sm text-[#6B7A90] mt-1">{submission.submitted_by || submission.submitted_by_name}</p></button>) : detail.group ? <><div className="rounded-xl bg-[#E8F3FB] p-4 dark:bg-[#182943]"><b className="text-3xl text-[#0F3D6E] dark:text-white">{detail.group.project_progress ?? detail.groupData?.project_progress ?? 0}%</b><p className="text-xs font-bold text-[#6B7A90] uppercase tracking-wide mt-1">Overall Progress</p></div><h3 className="mt-6 font-bold text-[#0F3D6E] dark:text-white mb-3">Activity and tasks</h3>{(detail.group.tasks || detail.groupData?.tasks || []).map((task) => <div key={task.id} className="mt-2 rounded-xl border border-[#E3E9F2] p-4 dark:border-[#1E2940]"><p className="font-bold text-[#12294A] dark:text-gray-200">{task.title}</p><div className="flex justify-between items-center mt-2"><p className="text-xs font-semibold text-[#6B7A90] bg-[#F4F7FC] px-2 py-1 rounded dark:bg-[#0B1120]">{task.status}</p><p className="text-sm font-bold text-[#0F3D6E] dark:text-white">{task.progress_percentage}%</p></div></div>)}</> : detail.id ? <form onSubmit={grade} className="space-y-4"><div className="rounded-xl bg-[#F4F7FC] p-4 dark:bg-[#0B1120]"><p className="text-sm text-[#6B7A90]">Student: <b className="text-[#12294A] dark:text-gray-200">{detail.submitted_by || detail.submitted_by_name}</b></p></div><label className="block text-sm font-bold text-[#12294A] dark:text-gray-200">Grade (%)<Field className="mt-2 w-full" type="number" min="0" max="100" value={gradeForm.grade} onChange={(event) => setGradeForm({ ...gradeForm, grade: event.target.value })} /></label><label className="block text-sm font-bold text-[#12294A] dark:text-gray-200">Feedback<textarea className="mt-2 min-h-[120px] w-full rounded-xl border border-[#E3E9F2] p-3 text-sm outline-none focus:border-[#6DB6E6] dark:border-[#1E2940] dark:bg-[#0B1120]" placeholder="Enter feedback here..." value={gradeForm.feedback} onChange={(event) => setGradeForm({ ...gradeForm, feedback: event.target.value })} /></label><button className="w-full rounded-xl bg-[#0F3D6E] py-3 font-bold text-white transition-colors hover:bg-[#154e8a]">Save Grade</button></form> : detail.items?.map((item) => <div key={item.label} className="mb-2 flex justify-between rounded-xl bg-[#F4F7FC] p-4 dark:bg-[#0B1120]"><span className="text-[#6B7A90]">{item.label}</span><b className="text-[#0F3D6E] dark:text-white">{item.value}</b></div>)}</div></div>; }

function Notice({ text, clear, tone }) { return <div className={`rounded-xl px-4 py-3 text-sm flex justify-between items-center ${tone === 'error' ? 'bg-[#FFF1F1] text-[#B42318] border border-[#FDA29B]' : 'bg-[#F0FFF4] text-[#22764F] border border-[#A6F4C5]'}`}><span>{text}</span><button onClick={clear} className="font-bold text-lg leading-none hover:opacity-70">&times;</button></div>; }
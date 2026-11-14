import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  Bell,
  BookOpen,
  CheckSquare,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  X,
  Plus,
  ChevronDown,
  Clock,
  CheckCircle2,
  Camera,
  Eye,
  EyeOff,
  Shield,
  User,
  GraduationCap,
  Palette,
  Database,
  UserPlus,
  AtSign,
  AlarmClock,
  TrendingUp,
  CalendarDays,
  Copy,
  Paperclip,
  Smile,
  Mic,
  Send,
  UsersRound,
  MoreHorizontal,
  UserRound,
} from "lucide-react";

const API = "/api/accounts";
const auth = () => ({
  Authorization: "Bearer " + window.localStorage.getItem("access_token"),
});

const tabs = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["units", "Course", BookOpen],
  ["students", "Students", Users],
  ["assessments", "Assessments", ClipboardList],
  ["messages", "Messages", MessageSquare],
  ["settings", "Settings", Settings],
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// --- Reusable Components ---

const Panel = ({ title, description, action, children, className = "" }) => (
  <section
    className={`rounded-2xl border border-[#E3E9F2] bg-white p-6 shadow-sm dark:border-[#1E2940] dark:bg-[#121A2D] ${className}`}
  >
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-[#0F3D6E] dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-[#6B7A90]">{description}</p>
        )}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Field = ({ className = "", ...props }) => (
  <input
    {...props}
    className={`rounded-xl border border-[#E3E9F2] bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#6DB6E6] dark:border-[#1E2940] dark:bg-[#0B1120] ${className}`}
  />
);

const Empty = ({ children }) => (
  <p className="rounded-xl bg-[#EEF3FA] p-8 text-center text-sm text-[#6B7A90] dark:bg-[#0B1120]">
    {children}
  </p>
);

const StatCard = ({ icon: Icon, value, label, subtext, colorClass }) => (
  <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm dark:bg-[#121A2D]">
    <div className="flex items-center justify-between">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClass}`}
      >
        <Icon size={20} />
      </div>
      <b className="text-2xl font-extrabold text-[#0F3D6E] dark:text-white">
        {value}
      </b>
    </div>
    <p className="mt-4 text-sm font-bold text-[#12294A] dark:text-gray-200">
      {label}
    </p>
    <p className="mt-1 text-xs text-[#6B7A90]">{subtext}</p>
  </div>
);

export default function LecturerDashboard() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dark, setDark] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [unitId, setUnitId] = useState("");
  const [detail, setDetail] = useState(null);
  const [gradeForm, setGradeForm] = useState({
    grade: "",
    feedback: "",
    status: "reviewed",
  });
  const [gradingMode, setGradingMode] = useState("student");
  const [gradingGroupId, setGradingGroupId] = useState("");
  const [groupSubmissions, setGroupSubmissions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [members, setMembers] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const units = data?.units || [];
  const groups = data?.groups || [];
  const submissions = data?.recent_submissions || [];
  const user = data?.user;
  const selectedUnit = units.find((unit) => String(unit.id) === String(unitId));
  const students = selectedUnit?.students || [];
  const filteredStudents = students.filter((student) =>
    `${student.name} ${student.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const pending = submissions.filter(
    (submission) => submission.status === "submitted",
  );
  const avgCompletion = units.length
    ? Math.round(
        units.reduce(
          (sum, unit) => sum + (unit.completion_percentage || 0),
          0,
        ) / units.length,
      )
    : 0;
  const rows =
    gradingMode === "group" && gradingGroupId ? groupSubmissions : submissions;

  const load = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/lecturer/`, {
        headers: auth(),
      });
      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("darkMode", String(dark));
  }, [dark]);
  useEffect(() => {
    if (tab === "messages")
      axios
        .get(`${API}/chat/rooms/`, { headers: auth() })
        .then((response) => setRooms(response.data))
        .catch(() => setError("Unable to load messages."));
  }, [tab]);
  useEffect(() => {
    if (gradingMode === "group" && gradingGroupId)
      axios
        .get(`${API}/groups/${gradingGroupId}/submissions/`, {
          headers: auth(),
        })
        .then((response) => setGroupSubmissions(response.data))
        .catch(() => setError("Unable to load group submissions."));
  }, [gradingMode, gradingGroupId]);

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

  const openPending = () =>
    setDetail({ title: "Pending grades", submissions: pending });
  const openSubmission = (submission) => {
    setGradeForm({
      grade: submission.grade ?? "",
      feedback: submission.feedback || "",
      status:
        submission.status === "submitted" ? "reviewed" : submission.status,
    });
    setDetail(submission);
  };

  const grade = async (event) => {
    event.preventDefault();
    try {
      await axios.patch(`${API}/submissions/${detail.id}/grade/`, gradeForm, {
        headers: auth(),
      });
      setNotice("Grade saved successfully.");
      setDetail(null);
      load();
      if (gradingGroupId) {
        const response = await axios.get(
          `${API}/groups/${gradingGroupId}/submissions/`,
          { headers: auth() },
        );
        setGroupSubmissions(response.data);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to save grade.");
    }
  };

  const openGroup = async (group) => {
    try {
      const response = await axios.get(`${API}/groups/${group.id}/workspace/`, {
        headers: auth(),
      });
      setDetail({ title: group.name, group: response.data });
    } catch {
      setError("Unable to load group progress.");
    }
  };

  const selectRoom = async (selected) => {
    setRoom(selected);
    setMessageSearch("");
    setSelectedFile(null);
    setMembers([]);
    try {
      const [response, membersResponse] = await Promise.all([
        axios.get(`${API}/chat/messages/${selected.id}/`, {
          headers: auth(),
        }),
        selected.group_id
          ? axios.get(`${API}/groups/${selected.group_id}/members/`, {
              headers: auth(),
            })
          : Promise.resolve({ data: [] }),
      ]);
      setMessages(response.data);
      setMembers(membersResponse.data);
    } catch {
      setError("Unable to load messages.");
    }
  };
  const sendMessage = async () => {
    if ((!draft.trim() && !selectedFile) || !room) return;
    try {
      const body = new FormData();
      body.append("content", draft);
      if (selectedFile) body.append("attachment", selectedFile);
      const response = await axios.post(
        `${API}/chat/send/${room.id}/`,
        body,
        { headers: auth() },
      );
      setMessages((current) => [...current, response.data]);
      setDraft("");
      setSelectedFile(null);
    } catch {
      setError("Unable to send message.");
    }
  };
  const exportStudents = () => {
    const rowsToExport = units.flatMap((unit) =>
      (unit.students || []).map((student) => ({
        Name: student.name,
        Email: student.email,
        Unit: unit.code,
        Programme: student.course || "",
      })),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rowsToExport),
      "Students",
    );
    XLSX.writeFile(workbook, "my-unit-students.xlsx");
  };
  const demo = async (method) => {
    try {
      const response = await axios({
        method,
        url: `${API}/lecturer/demo-data/`,
        headers: auth(),
      });
      setNotice(
        method === "post"
          ? `${response.data.students_created} students and ${response.data.groups_created} groups created.`
          : "Demo data deleted.",
      );
      load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "Demo data action failed.",
      );
    }
  };
  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FC] text-[#0F3D6E]">
        Loading your lecturer workspace...
      </div>
    );

  return (
    <div className="lecturer-root min-h-screen bg-[#E4E9EF] text-[#33445A] dark:bg-[#0B1120] dark:text-[#E8EEF9]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-[260px] transform border-r border-[#E3E9F2] bg-white p-5 transition-transform dark:border-[#1E2940] dark:bg-[#121A2D] md:static md:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex h-full flex-col">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6DB6E6] text-white">
                  <BookOpen size={20} />
                </div>
                <b className="text-xl font-bold text-[#0F3D6E] dark:text-white">
                  GroupHub
                </b>
              </div>
              <button onClick={() => setMobile(false)} className="md:hidden">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-1">
              {tabs.map(([id, label, icon]) => (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    setMobile(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${tab === id ? "bg-[#6DB6E6] text-white shadow-md" : "text-[#6B7A90] hover:bg-[#EEF3FA] dark:hover:bg-[#1E2940]"}`}
                >
                  {React.createElement(icon, { size: 18 })}
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-auto border-t border-[#E3E9F2] pt-6 dark:border-[#1E2940]">
              <button
                onClick={() => setDark((value) => !value)}
                className="flex w-full items-center gap-3 text-sm font-semibold text-[#6B7A90] transition-colors hover:text-[#0F3D6E] dark:hover:text-white"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
                {dark ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[#E3E9F2] bg-white px-6 py-3 dark:border-[#1E2940] dark:bg-[#121A2D]">
            <div className="flex items-center gap-4 flex-1">
              <button onClick={() => setMobile(true)} className="md:hidden">
                <Menu size={22} />
              </button>
              <div className="relative w-full max-w-md hidden md:block">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A97AF]"
                  size={18}
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-full border border-[#E3E9F2] bg-[#F4F7FC] py-2.5 pl-10 pr-4 text-sm outline-none dark:border-[#1E2940] dark:bg-[#0B1120]"
                />
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
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        {pending.length} new
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {pending.length > 0 ? (
                        pending.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => {
                              openSubmission(sub);
                              setShowNotifications(false);
                            }}
                            className="w-full text-left p-3 hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] border-b border-[#E3E9F2] dark:border-[#1E2940] last:border-0 transition-colors"
                          >
                            <p className="text-sm font-semibold text-[#0F3D6E] dark:text-white">
                              {sub.project_title}
                            </p>
                            <p className="text-xs text-[#6B7A90] mt-1">
                              Submitted by{" "}
                              {sub.submitted_by || sub.submitted_by_name}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="p-4 text-center text-sm text-[#6B7A90]">
                          No new notifications
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="relative flex items-center gap-3 pl-6 border-l border-[#E3E9F2] dark:border-[#1E2940]">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-[#4F5F73]">{greeting()}</p>
                  <p className="text-sm font-bold text-[#0F3D6E] dark:text-white">
                    {user?.first_name} {user?.last_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileMenu((current) => !current)}
                  className="h-10 w-10 overflow-hidden rounded-full bg-[#E8F3FB] border-2 border-white shadow-sm flex items-center justify-center font-bold text-[#0F3D6E]"
                  aria-label="Open profile menu"
                  aria-expanded={showProfileMenu}
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user?.first_name?.[0] || "L"
                  )}
                </button>
                {showProfileMenu && (
                  <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-[#D7DEE6] bg-white p-3 text-left shadow-xl">
                    <p className="text-sm font-bold text-[#1F2D3D]">{user?.first_name} {user?.last_name}</p>
                    <p className="mt-1 text-xs text-[#4F5F73]">{user?.department || "Lecturer"}</p>
                    <p className="text-xs text-[#4F5F73]">{user?.email}</p>
                    <div className="my-3 border-t border-[#EEF1F4]" />
                    <button type="button" onClick={() => { setTab("settings"); setShowProfileMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#33445A] hover:bg-[#EEF1F4]">
                      <Settings size={16} /> Settings
                    </button>
                    <button type="button" onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50">
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Scrollable Main Area */}
          <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
            {error && (
              <Notice tone="error" text={error} clear={() => setError("")} />
            )}
            {notice && <Notice text={notice} clear={() => setNotice("")} />}
            {data?.pending_approval && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                Waiting for approval. Your unit claims are pending an administrator's review.
              </div>
            )}

            {tab === "dashboard" && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                {/* LEFT: main dashboard content */}
                <div className="min-w-0 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold text-[#0F3D6E] dark:text-white">
                      {greeting()}, {user?.first_name || "there"}
                    </h1>
                    <button className="flex items-center gap-2 rounded-xl bg-[#0F3D6E] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#154e8a] transition-colors">
                      <Plus size={18} /> Add Course{" "}
                      <ChevronDown size={16} className="ml-1 opacity-70" />
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                    <StatCard
                      icon={Clock}
                      value={pending.length}
                      label="Pending to Grade"
                      subtext="-5 from yesterday"
                      colorClass="bg-yellow-50 text-yellow-500"
                    />
                    <StatCard
                      icon={Users}
                      value={units.reduce(
                        (sum, unit) => sum + (unit.student_count || 0),
                        0,
                      )}
                      label="Total Students"
                      subtext="+8 new this semester"
                      colorClass="bg-blue-50 text-blue-500"
                    />
                    <StatCard
                      icon={CheckCircle2}
                      value={avgCompletion + "%"}
                      label="Average Completion"
                      subtext="Across all active courses"
                      colorClass="bg-green-50 text-green-500"
                    />
                    <StatCard
                      icon={BookOpen}
                      value={units.length}
                      label="Active Courses"
                      subtext="Currently teaching"
                      colorClass="bg-purple-50 text-purple-500"
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <Panel
                        title="Assessment Completion"
                        action={
                          <label className="flex items-center gap-2 rounded-lg bg-[#E8F3FB] px-3 py-1.5 text-sm font-semibold text-[#35475C]">
                            <span className="sr-only">Chart month</span>
                            <select
                              value={`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`}
                              onChange={(event) => {
                                const [year, month] = event.target.value.split("-").map(Number);
                                setCalendarMonth(new Date(year, month, 1));
                              }}
                              className="cursor-pointer bg-transparent outline-none"
                            >
                              {Array.from({ length: 12 }, (_, month) => {
                                const date = new Date(calendarMonth.getFullYear(), month, 1);
                                return <option key={month} value={`${date.getFullYear()}-${month}`}>{date.toLocaleString("default", { month: "long", year: "numeric" })}</option>;
                              })}
                            </select>
                            <ChevronDown size={14} />
                          </label>
                        }
                      >
                        <div className="relative mt-4 flex h-64 items-end justify-between gap-3 border-b border-[#D7DEE6] px-8 pb-2 pt-5 dark:border-[#1E2940]">
                          <div className="pointer-events-none absolute inset-x-8 top-5 bottom-8 flex flex-col justify-between text-[10px] font-semibold text-[#7189A3]">
                            {[100, 75, 50, 25, 0].map((value) => <div key={value} className="flex items-center gap-2"><span className="w-6 text-right">{value}%</span><span className="h-px flex-1 bg-[#E3EAF1]" /></div>)}
                          </div>
                          {units.map((unit) => {
                            const comp = unit.completion_percentage || 0;
                            return (
                              <div
                                key={unit.id}
                                className="group relative z-10 flex h-full flex-1 cursor-pointer flex-col items-center justify-end"
                              >
                                <div className="relative flex h-full w-full max-w-[56px] items-end justify-center gap-1">
                                  <div
                                    className="w-5 rounded-t-md bg-[#6DB6E6] transition-all group-hover:bg-[#35475C]"
                                    style={{ height: `${Math.max(5, comp)}%` }}
                                  />
                                  <div
                                    className="w-5 rounded-t-md bg-[#DCE8DF] transition-all"
                                    style={{
                                      height: `${Math.max(5, 100 - comp)}%`,
                                    }}
                                  />
                                  <div className="absolute -top-8 rounded-md bg-[#35475C] px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                                    {comp}% Complete
                                  </div>
                                </div>
                                <span className="mt-3 w-full max-w-[96px] truncate text-center text-[10px] font-bold uppercase tracking-wide text-[#4F5F73]">
                                  {unit.code}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-center gap-6 mt-4">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7A90]">
                            <span className="w-3 h-3 rounded-full bg-[#6DB6E6]"></span>{" "}
                            Submitted
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7A90]">
                            <span className="h-3 w-3 rounded-full bg-[#DCE8DF]"></span>{" "}
                            Pending
                          </div>
                        </div>
                      </Panel>
                    </div>

                    <div>
                      <Panel title="Quick Actions">
                        <div className="space-y-3 mt-2">
                          <button
                            onClick={openPending}
                            className="w-full flex items-center justify-between rounded-xl bg-[#F4F7FC] p-4 text-sm font-bold text-[#0F3D6E] transition-colors hover:bg-[#E8F3FB] dark:bg-[#0B1120] dark:text-white dark:hover:bg-[#1E2940]"
                          >
                            <div className="flex items-center gap-3">
                              <CheckSquare size={18} /> Review Pending Grades
                            </div>
                            <span className="text-[#8A97AF]">→</span>
                          </button>
                          <button
                            onClick={() => setTab("students")}
                            className="w-full flex items-center justify-between rounded-xl bg-[#F4F7FC] p-4 text-sm font-bold text-[#0F3D6E] transition-colors hover:bg-[#E8F3FB] dark:bg-[#0B1120] dark:text-white dark:hover:bg-[#1E2940]"
                          >
                            <div className="flex items-center gap-3">
                              <Users size={18} /> Manage Students
                            </div>
                            <span className="text-[#8A97AF]">→</span>
                          </button>
                          <button
                            onClick={() => setTab("assessments")}
                            className="w-full flex items-center justify-between rounded-xl bg-[#F4F7FC] p-4 text-sm font-bold text-[#0F3D6E] transition-colors hover:bg-[#E8F3FB] dark:bg-[#0B1120] dark:text-white dark:hover:bg-[#1E2940]"
                          >
                            <div className="flex items-center gap-3">
                              <BookOpen size={18} /> Create Assessments
                            </div>
                            <span className="text-[#8A97AF]">→</span>
                          </button>
                        </div>
                      </Panel>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-[#0F3D6E] dark:text-white mb-4">
                      Your Courses
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                      {units.map((unit) => (
                        <div
                          key={unit.id}
                          onClick={() => {
                            setUnitId(unit.id);
                            setTab("students");
                          }}
                          className="cursor-pointer rounded-2xl border border-[#E3E9F2] bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-[#1E2940] dark:bg-[#121A2D]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F3FB] text-[#0F3D6E]">
                              <BookOpen size={20} />
                            </div>
                            <span className="rounded-full bg-[#F4F7FC] px-3 py-1 text-xs font-bold text-[#6B7A90] dark:bg-[#0B1120]">
                              {(unit.assessment_count || 0) -
                                (unit.completed_assessments || 0)}{" "}
                              Pending
                            </span>
                          </div>
                          <h3 className="mt-4 font-bold text-[#0F3D6E] dark:text-white">
                            {unit.name}
                          </h3>
                          <p className="mt-1 text-xs text-[#6B7A90]">
                            {unit.course_name}
                          </p>
                          <div className="mt-5 flex items-center justify-between border-t border-[#E3E9F2] pt-4 dark:border-[#1E2940]">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7A90]">
                              <Users size={14} /> {unit.student_count} Students
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7A90]">
                              <ClipboardList size={14} />{" "}
                              {unit.assessment_count || 0} Assessments
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RIGHT: calendar sidebar */}
                <aside className="self-start xl:sticky xl:top-0">
                  <TeachingCalendar
                    month={calendarMonth}
                    setMonth={setCalendarMonth}
                    units={units}
                  />
                </aside>
              </div>
            )}

            {/* --- Other Tabs --- */}
            {tab === "units" && (
              <Panel
                title="My Units"
                description="Every unit assigned to you. Select a unit to see its students and assessment activity."
              >
                <UnitGrid
                  units={units}
                  onSelect={(unit) => {
                    setUnitId(unit.id);
                    setTab("students");
                  }}
                />
              </Panel>
            )}
            {tab === "groups" && <Groups groups={groups} onOpen={openGroup} />}
            {tab === "students" && (
              <Students
                units={units}
                selectedUnit={selectedUnit}
                unitId={unitId}
                setUnitId={setUnitId}
                students={filteredStudents}
                exportStudents={exportStudents}
              />
            )}
            {tab === "assessments" && (
              <Assessments
                groups={groups}
                rows={rows}
                gradingMode={gradingMode}
                setGradingMode={setGradingMode}
                gradingGroupId={gradingGroupId}
                setGradingGroupId={setGradingGroupId}
                openSubmission={openSubmission}
              />
            )}
            {tab === "messages" && (
              <Messages
                rooms={rooms}
                room={room}
                messages={messages}
                draft={draft}
                setDraft={setDraft}
                selectRoom={selectRoom}
                sendMessage={sendMessage}
                user={user}
                roomSearch={roomSearch}
                setRoomSearch={setRoomSearch}
                messageSearch={messageSearch}
                setMessageSearch={setMessageSearch}
                members={members}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                fileRef={fileRef}
              />
            )}
            {tab === "settings" && (
              <SettingsTab
                user={user}
                dark={dark}
                setDark={setDark}
                demo={demo}
                logout={logout}
                setNotice={setNotice}
                setError={setError}
                reload={load}
              />
            )}
          </main>
        </div>
      </div>

      {detail && (
        <Detail
          detail={detail}
          close={() => setDetail(null)}
          openSubmission={openSubmission}
          gradeForm={gradeForm}
          setGradeForm={setGradeForm}
          grade={grade}
        />
      )}
    </div>
  );
}

// --- Settings ---

const TITLES = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."];

const NOTIFICATION_OPTIONS = [
  [
    "new_submission",
    "New submission",
    "A student or group submits work",
    ClipboardList,
  ],
  [
    "late_submission",
    "Late submission",
    "Work arrives after the deadline",
    AlarmClock,
  ],
  [
    "new_messages",
    "New messages",
    "Direct and group chat messages",
    MessageSquare,
  ],
  ["mentions", "@mentions in chat", "Someone mentions you", AtSign],
  [
    "group_progress",
    "Group progress updates",
    "Milestones and task changes in groups",
    TrendingUp,
  ],
  [
    "new_enrollment",
    "New student enrolled",
    "Students join one of your units",
    UserPlus,
  ],
];

const SettingsCard = ({ icon: Icon, title, description, children }) => (
  <section className="rounded-2xl border border-[#E3E9F2] bg-white p-6 shadow-sm dark:border-[#1E2940] dark:bg-[#121A2D]">
    <div className="mb-1 flex items-center gap-2 text-[#0F3D6E] dark:text-white">
      <Icon size={16} />
      <h2 className="text-sm font-bold">{title}</h2>
    </div>
    {description ? (
      <p className="mb-5 text-xs text-[#6B7A90]">{description}</p>
    ) : (
      <div className="mb-4" />
    )}
    {children}
  </section>
);

const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#0F3D6E]" : "bg-[#D5DDE9] dark:bg-[#26365a]"}`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
    />
  </button>
);

const SelectBox = ({ className = "", children, ...props }) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-[#E3E9F2] bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#6DB6E6] dark:border-[#1E2940] dark:bg-[#0B1120] ${className}`}
  >
    {children}
  </select>
);

function PasswordField({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-[#12294A] dark:text-gray-200">
        {label}
      </span>
      <div className="relative">
        <Field
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A97AF] hover:text-[#0F3D6E] dark:hover:text-white"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function SettingsTab({
  user,
  dark,
  setDark,
  demo,
  logout,
  setNotice,
  setError,
  reload,
}) {
  const [profile, setProfile] = useState({
    title: "",
    first_name: "",
    last_name: "",
    phone: "",
    department: "",
    staff_id: "",
    office: "",
    office_hours: "",
    bio: "",
  });
  const [notifications, setNotifications] = useState(
    Object.fromEntries(NOTIFICATION_OPTIONS.map(([key]) => [key, true])),
  );
  const [emailDigest, setEmailDigest] = useState("instant");
  const [grading, setGrading] = useState({
    default_status: "reviewed",
    release_grades: true,
    signature: "",
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const fileRef = useRef(null);

  // Load saved values from the user object
  useEffect(() => {
    if (!user) return;
    setProfile({
      title: user.title || user.salutation || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: user.phone || "",
      department: user.department || "",
      staff_id: user.staff_id || "",
      office: user.office || "",
      office_hours: user.office_hours || "",
      bio: user.bio || "",
    });
    if (user.notification_preferences)
      setNotifications((cur) => ({ ...cur, ...user.notification_preferences }));
    if (user.email_digest) setEmailDigest(user.email_digest);
    if (user.grading_defaults)
      setGrading((cur) => ({ ...cur, ...user.grading_defaults }));
  }, [user]);

  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  const setP = (key) => (e) =>
    setProfile((cur) => ({ ...cur, [key]: e.target.value }));
  const initials =
    `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() ||
    "L";
  const avatar = photoPreview || user?.avatar;

  const choosePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setError("Please choose an image file.");
    if (file.size > 2 * 1024 * 1024)
      return setError("Photo must be smaller than 2 MB.");
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const saveSettings = async () => {
    if (!profile.first_name.trim() || !profile.last_name.trim())
      return setError("First name and last name are required.");
    setSaving(true);
    try {
      await axios.patch(
        `${API}/lecturer/settings/`,
        {
          ...profile,
          notification_preferences: notifications,
          email_digest: emailDigest,
          grading_defaults: grading,
        },
        { headers: auth() },
      );
      if (photo) {
        const form = new FormData();
        form.append("avatar", photo);
        await axios.post(`${API}/profile/avatar/`, form, {
          headers: auth(),
        });
        setPhoto(null);
      }
      setNotice("Settings saved successfully.");
      reload();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "Unable to save settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
    if (!passwords.current || !passwords.next)
      return setError("Enter your current and new password.");
    if (passwords.next.length < 8)
      return setError("New password must be at least 8 characters.");
    if (passwords.next !== passwords.confirm)
      return setError("New passwords do not match.");
    setSavingPassword(true);
    try {
      await axios.post(
        `${API}/change-password/`,
        { current_password: passwords.current, new_password: passwords.next },
        { headers: auth() },
      );
      setPasswords({ current: "", next: "", confirm: "" });
      setNotice("Password updated successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to update password. Check your current password.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const strength = (() => {
    const p = passwords.next;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = [
    "",
    "bg-red-400",
    "bg-orange-400",
    "bg-yellow-400",
    "bg-green-500",
  ][strength];

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E3E9F2] pb-4 dark:border-[#1E2940]">
        <h1 className="text-2xl font-bold text-[#0F3D6E] dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#6B7A90]">
          Manage your account, teaching details, and preferences.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          <SettingsCard
            icon={User}
            title="Profile picture"
            description="Visible to students and group members."
          >
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F3FB] text-xl font-bold text-[#0F3D6E] dark:bg-[#182943] dark:text-white">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={choosePhoto}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl bg-[#0F3D6E] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#154e8a]"
                >
                  <Camera size={16} /> Choose photo
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      setPhotoPreview("");
                    }}
                    className="rounded-xl border border-[#E3E9F2] px-4 py-2.5 text-sm font-bold text-[#6B7A90] hover:bg-[#F4F7FC] dark:border-[#1E2940] dark:hover:bg-[#1E2940]"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-[#6B7A90]">
              JPG or PNG, up to 2 MB. Save settings to apply.
            </p>
          </SettingsCard>

          <SettingsCard icon={User} title="Personal details">
            <div className="grid gap-4 sm:grid-cols-[110px_1fr_1fr]">
              <div>
                <span className="mb-1.5 block text-xs font-bold">Title</span>
                <SelectBox value={profile.title} onChange={setP("title")}>
                  <option value="">—</option>
                  {TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </SelectBox>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-bold">
                  First name
                </span>
                <Field
                  className="w-full"
                  value={profile.first_name}
                  onChange={setP("first_name")}
                />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-bold">
                  Last name
                </span>
                <Field
                  className="w-full"
                  value={profile.last_name}
                  onChange={setP("last_name")}
                />
              </div>
            </div>

            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-bold">
                Email (read-only)
              </span>
              <Field
                className="w-full cursor-not-allowed bg-[#EEF3FA] text-[#6B7A90]"
                value={user?.email || ""}
                readOnly
              />
              <p className="mt-1.5 text-xs text-[#6B7A90]">
                Email cannot be changed. Contact support if you need to update
                it.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-bold">
                  Phone number
                </span>
                <Field
                  className="w-full"
                  type="tel"
                  placeholder="+254 700 000 000"
                  value={profile.phone}
                  onChange={setP("phone")}
                />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-bold">Staff ID</span>
                <Field
                  className="w-full"
                  value={profile.staff_id}
                  onChange={setP("staff_id")}
                />
              </div>
            </div>

            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-bold">Bio</span>
              <textarea
                value={profile.bio}
                onChange={setP("bio")}
                maxLength={300}
                placeholder="A short introduction students will see on your profile."
                className="min-h-[90px] w-full rounded-xl border border-[#E3E9F2] bg-white p-3 text-sm outline-none transition-colors focus:border-[#6DB6E6] dark:border-[#1E2940] dark:bg-[#0B1120]"
              />
              <p className="mt-1 text-right text-[11px] text-[#8A97AF]">
                {profile.bio.length}/300
              </p>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={GraduationCap}
            title="Teaching details"
            description="Shown to students so they know how to reach you."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-bold">
                  Department
                </span>
                <Field
                  className="w-full"
                  placeholder="e.g. School of Law"
                  value={profile.department}
                  onChange={setP("department")}
                />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-bold">
                  Office location
                </span>
                <Field
                  className="w-full"
                  placeholder="e.g. Block B, Room 204"
                  value={profile.office}
                  onChange={setP("office")}
                />
              </div>
            </div>
            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-bold">
                Office hours
              </span>
              <Field
                className="w-full"
                placeholder="e.g. Tue & Thu, 2:00 – 4:00 PM"
                value={profile.office_hours}
                onChange={setP("office_hours")}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={ClipboardList}
            title="Grading defaults"
            description="Applied whenever you open a submission to grade."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-bold">
                  Default status after grading
                </span>
                <SelectBox
                  value={grading.default_status}
                  onChange={(e) =>
                    setGrading({ ...grading, default_status: e.target.value })
                  }
                >
                  <option value="reviewed">Reviewed</option>
                  <option value="returned">Returned for revision</option>
                  <option value="graded">Graded</option>
                </SelectBox>
              </div>
              <div className="flex items-end">
                <div className="flex w-full items-center justify-between rounded-xl border border-[#E3E9F2] px-4 py-2.5 dark:border-[#1E2940]">
                  <span className="text-sm font-semibold">
                    Release grades to students
                  </span>
                  <Toggle
                    checked={grading.release_grades}
                    onChange={(v) =>
                      setGrading({ ...grading, release_grades: v })
                    }
                    label="Release grades to students"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-bold">
                Feedback signature
              </span>
              <Field
                className="w-full"
                placeholder="e.g. Regards, Dr. Smith"
                value={grading.signature}
                onChange={(e) =>
                  setGrading({ ...grading, signature: e.target.value })
                }
              />
            </div>
          </SettingsCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <SettingsCard
            icon={Shield}
            title="Change password"
            description="Use your current password to confirm the change."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <PasswordField
                label="Current password"
                value={passwords.current}
                onChange={(v) => setPasswords({ ...passwords, current: v })}
                autoComplete="current-password"
              />
              <PasswordField
                label="New password"
                value={passwords.next}
                onChange={(v) => setPasswords({ ...passwords, next: v })}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirm new password"
                value={passwords.confirm}
                onChange={(v) => setPasswords({ ...passwords, confirm: v })}
                autoComplete="new-password"
              />
            </div>
            {passwords.next && (
              <div className="mt-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <span
                      key={n}
                      className={`h-1.5 flex-1 rounded-full ${n <= strength ? strengthColor : "bg-[#E3E9F2] dark:bg-[#26365a]"}`}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-[#6B7A90]">
                  Strength: {strengthLabel}. Use 8+ characters with upper and
                  lower case letters, numbers and symbols.
                </p>
              </div>
            )}
            {passwords.confirm && passwords.next !== passwords.confirm && (
              <p className="mt-3 text-xs font-semibold text-red-500">
                Passwords do not match.
              </p>
            )}
            <div className="mt-5 flex justify-end border-t border-[#E3E9F2] pt-4 dark:border-[#1E2940]">
              <button
                onClick={updatePassword}
                disabled={savingPassword}
                className="rounded-xl bg-[#0F3D6E] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#154e8a] disabled:opacity-60"
              >
                {savingPassword ? "Updating..." : "Update password"}
              </button>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Bell}
            title="Notification preferences"
            description="Choose which notifications you want to receive."
          >
            <div className="space-y-1">
              {NOTIFICATION_OPTIONS.map(([key, label, hint, Icon]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-xl px-2 py-2.5 hover:bg-[#F4F7FC] dark:hover:bg-[#0B1120]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF3FA] text-[#6B7A90] dark:bg-[#1E2940]">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="truncate text-xs text-[#6B7A90]">{hint}</p>
                    </div>
                  </div>
                  <Toggle
                    checked={!!notifications[key]}
                    onChange={(v) =>
                      setNotifications({ ...notifications, [key]: v })
                    }
                    label={label}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[#E3E9F2] pt-4 dark:border-[#1E2940]">
              <span className="mb-1.5 block text-xs font-bold">
                Email notifications
              </span>
              <SelectBox
                value={emailDigest}
                onChange={(e) => setEmailDigest(e.target.value)}
              >
                <option value="instant">Send immediately</option>
                <option value="daily">Daily summary</option>
                <option value="weekly">Weekly summary</option>
                <option value="off">Don't send emails</option>
              </SelectBox>
            </div>
          </SettingsCard>

          <SettingsCard icon={Palette} title="Appearance">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Dark mode</p>
                <p className="text-xs text-[#6B7A90]">
                  Easier on the eyes when marking late.
                </p>
              </div>
              <Toggle checked={dark} onChange={setDark} label="Dark mode" />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={Database}
            title="Demo data"
            description="Preview students, groups, assessments, charts and messages with sample data."
          >
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => demo("post")}
                className="rounded-xl bg-[#0F3D6E] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#154e8a]"
              >
                Create demo data
              </button>
              <button
                onClick={() => demo("delete")}
                className="rounded-xl border border-[#E5484D] px-4 py-2.5 text-sm font-bold text-[#E5484D] transition-colors hover:bg-[#FFF1F1] dark:hover:bg-[#2a1518]"
              >
                Delete demo data
              </button>
            </div>
          </SettingsCard>

          <SettingsCard icon={LogOut} title="Session">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[#6B7A90]">
                Sign out of GroupHub on this device.
              </p>
              <button
                onClick={logout}
                className="rounded-xl border border-[#E3E9F2] px-4 py-2.5 text-sm font-bold text-[#12294A] transition-colors hover:bg-[#F4F7FC] dark:border-[#1E2940] dark:text-white dark:hover:bg-[#1E2940]"
              >
                Log out
              </button>
            </div>
          </SettingsCard>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-4 border-t border-[#E3E9F2] bg-white/90 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8 dark:border-[#1E2940] dark:bg-[#0B1120]/90">
        <p className="hidden text-xs text-[#6B7A90] sm:block">
          Saves your profile, teaching details, grading defaults and
          notifications. Password is updated separately.
        </p>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="ml-auto rounded-xl bg-[#0F3D6E] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#154e8a] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}

// --- Sub-Components for Tabs ---

function UnitGrid({ units, onSelect }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {units.map((unit) => (
        <button
          key={unit.id}
          onClick={() => onSelect(unit)}
          className="rounded-2xl border border-[#DDEAF2] bg-[#E8F3FB] p-4 text-left dark:border-[#1E2940] dark:bg-[#182943] transition-transform hover:-translate-y-1"
        >
          <div className="flex justify-between">
            <BookOpen size={19} className="text-[#0F3D6E]" />
            <span className="text-xs font-bold text-[#6B7A90]">
              {unit.completion_percentage || 0}% complete
            </span>
          </div>
          <h3 className="mt-5 font-bold text-[#0F3D6E] dark:text-white">
            {unit.code} · {unit.name}
          </h3>
          <p className="mt-1 text-xs text-[#6B7A90]">{unit.course_name}</p>
          <div className="mt-5 flex justify-between text-xs text-[#6B7A90]">
            <span>{unit.student_count} students</span>
            <span>{unit.assessment_count || 0} assessments</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white">
            <div
              className="h-2 rounded-full bg-[#6DB6E6]"
              style={{ width: `${unit.completion_percentage || 0}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

function Groups({ groups, onOpen }) {
  return (
    <Panel
      title="Groups"
      description="See what each group is doing and open its full workspace."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onOpen(group)}
            className="rounded-2xl border border-[#E3E9F2] p-4 text-left dark:border-[#1E2940] hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"
          >
            <div className="flex justify-between">
              <Users className="text-[#0F3D6E]" />
              <span className="text-xs text-[#6B7A90]">
                {group.members_count} members
              </span>
            </div>
            <h3 className="mt-4 font-bold">{group.name}</h3>
            <p className="text-xs text-[#6B7A90]">
              {group.unit_code || group.course}
            </p>
            <p className="mt-4 text-sm text-[#6B7A90]">
              {group.projects?.length || 0} projects · click for progress
            </p>
          </button>
        ))}
      </div>
      {!groups.length && <Empty>No groups found.</Empty>}
    </Panel>
  );
}

function Students({
  units,
  selectedUnit,
  unitId,
  setUnitId,
  students,
  exportStudents,
}) {
  return (
    <Panel
      title={<span className="flex items-center gap-2"><Users size={18} aria-hidden="true" /> Students</span>}
      description="A table of students registered for each unit."
      action={
        <button
          onClick={exportStudents}
          className="flex items-center gap-2 rounded-xl border border-[#E3E9F2] px-4 py-2 text-sm font-bold hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"
        >
          <FileSpreadsheet size={16} />
          Export
        </button>
      }
    >
      <div className="relative mb-6 w-full max-w-md">
        <BookOpen size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6079]" aria-hidden="true" />
        <select
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
          className="w-full rounded-xl border border-[#E3E9F2] bg-white py-3 pl-10 pr-3 text-sm outline-none dark:bg-[#0B1120]"
        >
          <option value="">Select unit to view students</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.code} · {unit.name}
            </option>
          ))}
        </select>
      </div>
      {selectedUnit ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#E3E9F2] text-xs uppercase text-[#6B7A90] bg-[#F4F7FC] dark:bg-[#0B1120]">
                <th className="p-4 rounded-tl-lg"><span className="inline-flex items-center gap-2"><User size={14} /> Student</span></th>
                <th className="p-4"><span className="inline-flex items-center gap-2"><AtSign size={14} /> Email</span></th>
                <th className="p-4"><span className="inline-flex items-center gap-2"><GraduationCap size={14} /> Programme</span></th>
                <th className="p-4 rounded-tr-lg"><span className="inline-flex items-center gap-2"><CalendarDays size={14} /> Year</span></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-[#E3E9F2] dark:border-[#1E2940] hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"
                >
                  <td className="p-4 font-semibold text-[#0F3D6E] dark:text-white">
                    <span className="inline-flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D7DEE6] text-[#35475C]"><User size={14} /></span>{student.name}</span>
                  </td>
                  <td className="p-4 text-[#6B7A90]"><span className="inline-flex items-center gap-2"><AtSign size={14} className="text-[#7189A3]" />{student.email}</span></td>
                  <td className="p-4"><span className="inline-flex items-center gap-2"><GraduationCap size={14} className="text-[#7189A3]" />{student.course || "—"}</span></td>
                  <td className="p-4"><span className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-[#7189A3]" />{student.year_of_study || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <div className="mt-4">
              <Empty>No students in this unit.</Empty>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <Empty>Select a unit above to view its students.</Empty>
        </div>
      )}
    </Panel>
  );
}

function Assessments({
  groups,
  rows,
  gradingMode,
  setGradingMode,
  gradingGroupId,
  setGradingGroupId,
  openSubmission,
}) {
  return (
    <Panel
      title="Assessments"
      description="Grade individual students or select a group and update each student's grade."
      action={
        <div className="flex gap-2 bg-[#F4F7FC] p-1 rounded-xl dark:bg-[#0B1120]">
          <button
            onClick={() => setGradingMode("student")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${gradingMode === "student" ? "bg-white text-[#0F3D6E] shadow-sm dark:bg-[#1E2940] dark:text-white" : "text-[#6B7A90] hover:text-[#0F3D6E]"}`}
          >
            Per student
          </button>
          <button
            onClick={() => setGradingMode("group")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${gradingMode === "group" ? "bg-white text-[#0F3D6E] shadow-sm dark:bg-[#1E2940] dark:text-white" : "text-[#6B7A90] hover:text-[#0F3D6E]"}`}
          >
            Per group
          </button>
        </div>
      }
    >
      {gradingMode === "group" && (
        <select
          value={gradingGroupId}
          onChange={(event) => setGradingGroupId(event.target.value)}
          className="mb-6 w-full max-w-md rounded-xl border border-[#E3E9F2] p-3 text-sm outline-none dark:bg-[#0B1120]"
        >
          <option value="">Select group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((submission) => (
          <button
            key={submission.id}
            onClick={() => openSubmission(submission)}
            className="rounded-xl border border-[#E3E9F2] p-5 text-left dark:border-[#1E2940] hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"
          >
            <div className="flex justify-between items-start">
              <b className="text-[#0F3D6E] dark:text-white pr-4">
                {submission.project_title}
              </b>
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${submission.status === "submitted" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}
              >
                {submission.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#6B7A90]">
              {submission.submitted_by || submission.submitted_by_name}
            </p>
            <p className="mt-4 font-bold text-[#0F3D6E] dark:text-white">
              {submission.grade == null ? "Not graded" : `${submission.grade}%`}
            </p>
          </button>
        ))}
      </div>
      {!rows.length && <Empty>Select a group or wait for submissions.</Empty>}
    </Panel>
  );
}

function Messages({
  rooms,
  room,
  messages,
  draft,
  setDraft,
  selectRoom,
  sendMessage,
  user,
  roomSearch,
  setRoomSearch,
  messageSearch,
  setMessageSearch,
  members,
  selectedFile,
  setSelectedFile,
  fileRef,
}) {
  const visibleRooms = rooms.filter((item) =>
    item.name.toLowerCase().includes(roomSearch.toLowerCase()),
  );
  const visibleMessages = messages.filter((message) => {
    const query = messageSearch.toLowerCase();
    return !query || message.content?.toLowerCase().includes(query)
      || `${message.sender?.first_name || ""} ${message.sender?.last_name || ""}`
        .toLowerCase()
        .includes(query);
  });
  const displayName = (member) =>
    `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";

  return (
    <section className="grid h-[min(74vh,760px)] min-h-[520px] overflow-hidden rounded-xl border border-[#D7DEE6] bg-white md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_230px]">
      <aside className="flex min-h-0 flex-col border-r border-[#D7DEE6] bg-[#F8FAFC]">
        <div className="flex items-center justify-between border-b border-[#D7DEE6] px-4 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#1F2D3D]">Messages</h2>
            <p className="mt-0.5 text-xs text-[#4F5F73]">Group and private conversations</p>
          </div>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D7DEE6] bg-white text-[#35475C]" title="New conversation">
            <UsersRound size={15} />
          </button>
        </div>
        <label className="relative mx-3 my-3 block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4F5F73]" />
          <input value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder="Search chats" className="h-8 w-full rounded-md border border-[#D7DEE6] bg-white pl-8 pr-2 text-sm outline-none focus:border-[#35475C]" />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {visibleRooms.map((item) => (
            <button key={item.id} type="button" onClick={() => selectRoom(item)} className={`mb-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-3 text-left ${room?.id === item.id ? "bg-[#D7DEE6]" : "hover:bg-[#EEF1F4]"}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D7DEE6] text-[#35475C]"><UsersRound size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#1F2D3D]">{item.name}</span><span className="mt-1 block truncate text-xs text-[#4F5F73]">{item.last_message || "Start a conversation"}</span></span>
              <MoreHorizontal size={16} className="shrink-0 text-[#4F5F73]" />
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col bg-[#F8FAFC]">
        {room ? (
          <>
            <div className="flex items-center gap-3 border-b border-[#D7DEE6] bg-white px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D7DEE6] text-[#35475C]"><UsersRound size={17} /></span>
              <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#1F2D3D]">{room.name}</h3><p className="text-xs text-[#4F5F73]">{members.length} members · Group chat</p></div>
              <span className="ml-auto text-xs text-[#4F5F73]">• Live</span>
            </div>
            <label className="relative mx-4 my-3 block">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4F5F73]" />
              <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search in this conversation..." className="h-9 w-full rounded-md border border-[#D7DEE6] bg-white pl-8 pr-3 text-sm outline-none focus:border-[#35475C]" />
            </label>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
              {visibleMessages.map((message) => {
                const own = Number(message.sender?.id) === Number(user?.id);
                return <div key={message.id} className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
                  {!own && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D7DEE6] text-[#35475C]"><UserRound size={15} /></span>}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${own ? "bg-[#35475C] text-white" : "border border-[#D7DEE6] bg-white text-[#1F2D3D]"}`}>
                    <p className="mb-1 text-[10px] font-bold opacity-70">{own ? "You" : displayName(message.sender)} <time className="ml-1 font-normal">{message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</time></p>
                    {message.content && <p>{message.content}</p>}
                    {message.attachment_name && <p className="mt-1 text-xs opacity-80">📎 {message.attachment_name}</p>}
                  </div>
                  {own && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D7DEE6] text-[#35475C]"><UserRound size={15} /></span>}
                </div>;
              })}
            </div>
            <form className="border-t border-[#D7DEE6] bg-white p-3" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
              <div className="flex items-center gap-1 rounded-lg border border-[#D7DEE6] px-2 py-1.5">
                <input ref={fileRef} type="file" className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
                <button type="button" onClick={() => fileRef.current?.click()} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4]" title="Attach a document"><Paperclip size={18} /></button>
                <button type="button" onClick={() => setDraft((current) => `${current} 😊`)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4]" title="Add emoji"><Smile size={18} /></button>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4]" title="Record voice note"><Mic size={18} /></button>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={selectedFile?.name || "Write a message..."} className="min-w-0 flex-1 border-0 px-2 text-sm outline-none" />
                <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#35475C] text-white hover:bg-[#435B76]" title="Send message"><Send size={17} /></button>
              </div>
              <p className="mt-1.5 pl-2 text-xs text-[#94A8A1]">Documents are saved to this conversation · 10 MB max</p>
            </form>
          </>
        ) : <Empty>Select a group conversation.</Empty>}
      </div>

      <aside className="hidden min-h-0 flex-col border-l border-[#D7DEE6] bg-white xl:flex">
        <div className="border-b border-[#D7DEE6] px-4 py-4">
          <h3 className="text-xs font-bold text-[#1F2D3D]">Group info</h3>
          <p className="mt-1 truncate text-xs text-[#4F5F73]">{room?.name || "Select a conversation"}</p>
          {room?.join_code && <div className="mt-3 rounded-md bg-[#EEF1F4] p-2"><span className="block text-xs font-semibold uppercase tracking-wide text-[#4F5F73]">Invite code</span><div className="mt-1 flex items-center justify-between"><code className="text-sm font-bold tracking-wider text-[#35475C]">{room.join_code}</code><button type="button" onClick={() => navigator.clipboard?.writeText(room.join_code)} title="Copy invite code" className="text-[#4F5F73]"><Copy size={13} /></button></div></div>}
          {room?.description && <p className="mt-2 text-xs leading-4 text-[#4F5F73]">{room.description}</p>}
        </div>
        <div className="border-b border-[#D7DEE6] px-4 py-4"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wide text-[#4F5F73]">Members</h4><span className="text-xs text-[#4F5F73]">{members.length}</span></div><div className="mt-3 space-y-2.5">{members.slice(0, 8).map((member) => <div key={member.id} className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D7DEE6] text-xs font-semibold text-[#35475C]">{`${member.student?.first_name?.[0] || ""}${member.student?.last_name?.[0] || ""}`.toUpperCase() || "U"}</span><span className="truncate text-xs font-medium text-[#1F2D3D]">{displayName(member.student)}</span></div>)}</div></div>
        <div className="flex-1 px-4 py-4"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wide text-[#4F5F73]">Shared files</h4><span className="text-xs text-[#4F5F73]">{messages.filter((message) => message.attachment_url).length}</span></div><p className="mt-3 text-xs leading-4 text-[#94A8A1]">Documents shared in chat will be kept here.</p></div>
      </aside>
    </section>
  );
}

function TeachingCalendar({ month, setMonth, units }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const first = new Date(year, monthIndex, 1).getDay();
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date();
  const todayIsTeaching = today.getDay() > 0 && today.getDay() < 6;

  return (
    <Panel title="Calendar" className="!p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
          className="h-8 w-8 rounded-lg text-lg font-bold text-[#6B7A90] transition-colors hover:bg-[#F4F7FC] hover:text-[#0F3D6E] dark:hover:bg-[#1E2940]"
        >
          ‹
        </button>
        <b className="text-sm text-[#0F3D6E] dark:text-white">
          {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </b>
        <button
          onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
          className="h-8 w-8 rounded-lg text-lg font-bold text-[#6B7A90] transition-colors hover:bg-[#F4F7FC] hover:text-[#0F3D6E] dark:hover:bg-[#1E2940]"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((d, i) => (
          <div
            key={i}
            className="py-1 text-[11px] font-bold uppercase text-[#8A97AF]"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: first }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = i + 1;
          const d = new Date(year, monthIndex, date);
          const isTeaching = d.getDay() > 0 && d.getDay() < 6;
          const isToday = today.toDateString() === d.toDateString();
          return (
            <div
              key={date}
              className={`relative flex aspect-square items-center justify-center rounded-lg text-xs font-semibold transition-colors
                ${
                  isToday
                    ? "bg-[#6DB6E6] text-white shadow-sm"
                    : isTeaching
                      ? "text-[#0F3D6E] hover:bg-[#E8F3FB] dark:text-gray-200 dark:hover:bg-[#1E2940]"
                      : "text-[#B3BDCC] dark:text-[#4A5878]"
                }`}
            >
              {date}
              {isTeaching && !isToday && units.length > 0 && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#6DB6E6]" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-[#E3E9F2] pt-4 dark:border-[#1E2940]">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6B7A90]">
          Today ·{" "}
          {today.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </p>
        {todayIsTeaching && units.length ? (
          <div className="space-y-2">
            {units.slice(0, 4).map((unit) => (
              <div
                key={unit.id}
                className="flex items-center gap-3 rounded-xl bg-[#F4F7FC] p-3 dark:bg-[#0B1120]"
              >
                <span className="h-8 w-1 rounded-full bg-[#6DB6E6]" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#0F3D6E] dark:text-white">
                    {unit.code}
                  </p>
                  <p className="truncate text-[11px] text-[#6B7A90]">
                    {unit.name}
                  </p>
                </div>
              </div>
            ))}
            {units.length > 4 && (
              <p className="pl-1 text-[11px] text-[#6B7A90]">
                +{units.length - 4} more
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#6B7A90]">No classes today.</p>
        )}
      </div>
    </Panel>
  );
}

function Detail({
  detail,
  close,
  openSubmission,
  gradeForm,
  setGradeForm,
  grade,
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#121A2D]">
        <div className="mb-5 flex justify-between items-center border-b border-[#E3E9F2] pb-4 dark:border-[#1E2940]">
          <h2 className="text-xl font-bold text-[#0F3D6E] dark:text-white">
            {detail.title || detail.project_title}
          </h2>
          <button
            onClick={close}
            className="p-1 rounded-full hover:bg-[#F4F7FC] dark:hover:bg-[#1E2940] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {detail.submissions ? (
          detail.submissions.map((submission) => (
            <button
              key={submission.id}
              onClick={() => openSubmission(submission)}
              className="mb-2 w-full rounded-xl bg-[#F4F7FC] p-4 text-left hover:bg-[#E8F3FB] dark:bg-[#0B1120] dark:hover:bg-[#1E2940] transition-colors"
            >
              <b className="text-[#0F3D6E] dark:text-white">
                {submission.project_title}
              </b>
              <p className="text-sm text-[#6B7A90] mt-1">
                {submission.submitted_by || submission.submitted_by_name}
              </p>
            </button>
          ))
        ) : detail.group ? (
          <>
            <div className="rounded-xl bg-[#E8F3FB] p-4 dark:bg-[#182943]">
              <b className="text-3xl text-[#0F3D6E] dark:text-white">
                {detail.group.project_progress ??
                  detail.groupData?.project_progress ??
                  0}
                %
              </b>
              <p className="text-xs font-bold text-[#6B7A90] uppercase tracking-wide mt-1">
                Overall Progress
              </p>
            </div>
            <h3 className="mt-6 font-bold text-[#0F3D6E] dark:text-white mb-3">
              Activity and tasks
            </h3>
            {(detail.group.tasks || detail.groupData?.tasks || []).map(
              (task) => (
                <div
                  key={task.id}
                  className="mt-2 rounded-xl border border-[#E3E9F2] p-4 dark:border-[#1E2940]"
                >
                  <p className="font-bold text-[#12294A] dark:text-gray-200">
                    {task.title}
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs font-semibold text-[#6B7A90] bg-[#F4F7FC] px-2 py-1 rounded dark:bg-[#0B1120]">
                      {task.status}
                    </p>
                    <p className="text-sm font-bold text-[#0F3D6E] dark:text-white">
                      {task.progress_percentage}%
                    </p>
                  </div>
                </div>
              ),
            )}
          </>
        ) : detail.id ? (
          <form onSubmit={grade} className="space-y-4">
            <div className="rounded-xl bg-[#F4F7FC] p-4 dark:bg-[#0B1120]">
              <p className="text-sm text-[#6B7A90]">
                Student:{" "}
                <b className="text-[#12294A] dark:text-gray-200">
                  {detail.submitted_by || detail.submitted_by_name}
                </b>
              </p>
            </div>
            <label className="block text-sm font-bold text-[#12294A] dark:text-gray-200">
              Grade (%)
              <Field
                className="mt-2 w-full"
                type="number"
                min="0"
                max="100"
                value={gradeForm.grade}
                onChange={(event) =>
                  setGradeForm({ ...gradeForm, grade: event.target.value })
                }
              />
            </label>
            <label className="block text-sm font-bold text-[#12294A] dark:text-gray-200">
              Feedback
              <textarea
                className="mt-2 min-h-[120px] w-full rounded-xl border border-[#E3E9F2] p-3 text-sm outline-none focus:border-[#6DB6E6] dark:border-[#1E2940] dark:bg-[#0B1120]"
                placeholder="Enter feedback here..."
                value={gradeForm.feedback}
                onChange={(event) =>
                  setGradeForm({ ...gradeForm, feedback: event.target.value })
                }
              />
            </label>
            <button className="w-full rounded-xl bg-[#0F3D6E] py-3 font-bold text-white transition-colors hover:bg-[#154e8a]">
              Save Grade
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function Notice({ text, clear, tone }) {
  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm flex justify-between items-center ${tone === "error" ? "bg-[#FFF1F1] text-[#B42318] border border-[#FDA29B]" : "bg-[#F0FFF4] text-[#22764F] border border-[#A6F4C5]"}`}
    >
      <span>{text}</span>
      <button
        onClick={clear}
        className="font-bold text-lg leading-none hover:opacity-70"
      >
        &times;
      </button>
    </div>
  );
}

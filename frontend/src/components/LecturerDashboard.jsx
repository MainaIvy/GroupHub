import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { id: 'overview', label: 'Overview', icon: '▣' },
  { id: 'projects', label: 'Projects', icon: '◫' },
  { id: 'groups', label: 'Groups', icon: '◌' },
  { id: 'submissions', label: 'Submissions', icon: '▤' },
  { id: 'chat', label: 'Chat', icon: '◍' },
  { id: 'schedule', label: 'Schedule', icon: '☰' },
  { id: 'profile', label: 'Profile', icon: '◐' },
];

const emptyDashboardState = {
  metrics: [],
  projectTree: [],
  workload: [],
  groups: [],
  groupMembers: [],
  activityLog: [],
  submissions: [],
  schedule: [],
  units: [],
  profile: {},
};

const getProgressColor = (value) => {
  if (value >= 75) return '#22C55E';
  if (value >= 50) return '#F59E0B';
  return '#EF4444';
};

const statusTagStyles = {
  'On track': 'bg-[#DCFCE7] text-[#166534]',
  'At risk': 'bg-[#FDECC8] text-[#92400E]',
  Watch: 'bg-[#FDECC8] text-[#92400E]',
  Critical: 'bg-[#FDE2DC] text-[#9A3412]',
  Submitted: 'bg-[#DCFCE7] text-[#166534]',
  'Needs sign-off': 'bg-[#FDECC8] text-[#92400E]',
  'Awaiting revision': 'bg-[#FDE2DC] text-[#9A3412]',
  'In progress': 'bg-[#EAF3FF] text-[#2E5C8A]',
};

const statusPill = (status) =>
  `inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
    statusTagStyles[status] || 'bg-[#F0EDE4] text-[#57534E]'
  }`;

const formatInitials = (user) => {
  const first = String(user?.first_name || user?.firstName || '').trim().split(/\s+/)[0] || '';
  const last = String(user?.last_name || user?.lastName || '').trim().split(/\s+/)[0] || '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'U';
};

function LecturerDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [greeting, setGreeting] = useState('Good morning');
  const [storedUser, setStoredUser] = useState(null);
  const [dashboardData, setDashboardData] = useState(emptyDashboardState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    try {
      setStoredUser(stored ? JSON.parse(stored) : null);
    } catch {
      setStoredUser(null);
    }

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/accounts/dashboard/lecturer/', {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return;
          }
          throw new Error('Dashboard endpoint unavailable');
        }

        const payload = await response.json();
        const units = payload.assigned_units || payload.department_units || payload.units || [];
        const groups = [
          ...(payload.active_groups || []),
          ...(payload.archived_groups || []),
          ...(payload.groups || []),
        ];
        const profile = payload.lecturer || payload.user || {};
        const projects = groups.flatMap((group) => (group.projects || []).map((project) => ({
          ...project,
          group_name: group.name,
          course: group.course,
        })));

        const nextDashboard = {
          ...emptyDashboardState,
          profile,
          groups,
          units,
          metrics: [
            { label: 'Assigned units', value: units.length, change: '+0%' },
            { label: 'Active groups', value: groups.length, change: '+0%' },
            { label: 'Students tracked', value: groups.reduce((sum, group) => sum + Number(group.members_count || 0), 0), change: '+0%' },
            { label: 'Department', value: profile.department || 'Faculty', change: 'Live' },
          ],
          projectTree: projects.map((project, index) => ({
            id: project.id || index,
            title: project.title || project.name || `Project ${index + 1}`,
            milestone: project.group_name || project.description || 'Group project',
            tasks: project.tasks || [],
          })),
          workload: groups.slice(0, 4).map((group, index) => ({
            name: group.name || `Group ${index + 1}`,
            value: 35 + (index * 16) % 55,
          })),
          activityLog: groups.slice(0, 4).map((group, index) => ({
            time: `${index + 1}h ago`,
            event: group.name || `Group ${index + 1}`,
            target: `${group.members_count || 0} members active`,
          })),
          submissions: (payload.recent_submissions || payload.submissions || []).map((submission, index) => ({
            id: submission.id || index,
            group: submission.project_title || submission.group || 'Group submission',
            repo: submission.submitted_by || submission.repo || '',
            status: submission.status || 'Submitted',
          })),
          schedule: [
            { day: 'Mon', items: ['Unit brief', 'Group check-in'] },
            { day: 'Tue', items: ['Progress review'] },
            { day: 'Wed', items: ['Mentor session'] },
            { day: 'Thu', items: ['Submission check'] },
            { day: 'Fri', items: ['Portfolio review'] },
            { day: 'Sat', items: [] },
            { day: 'Sun', items: [] },
          ],
        };

        setDashboardData(nextDashboard);
      } catch {
        setDashboardData(emptyDashboardState);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    return () => controller.abort();
  }, []);

  const filteredGroups = useMemo(() => {
    const groups = dashboardData.groups || [];
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter((group) => (
      (group.name || '').toLowerCase().includes(query)
      || (group.unit_code || group.course || '').toLowerCase().includes(query)
    ));
  }, [dashboardData.groups, searchQuery]);

  const filteredMembers = useMemo(() => {
    const members = dashboardData.groupMembers || [];
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter((member) => (
      (member.name || '').toLowerCase().includes(query)
      || (member.role || '').toLowerCase().includes(query)
    ));
  }, [dashboardData.groupMembers, searchQuery]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const goToGroupChat = (groupId) => navigate(`/groups/${groupId}/chat`);

  const renderEmptyState = (title, subtitle) => (
    <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-[#E5DFD0] bg-[#FAF7EF] p-8 text-center">
      <div>
        <div className="text-lg font-semibold text-[#1A1A1A]">{title}</div>
        <div className="mt-2 text-sm text-[#8A8374]">{subtitle}</div>
      </div>
    </div>
  );

  const renderOverview = () => {
    const metrics = dashboardData.metrics || [];
    const projectTree = dashboardData.projectTree || [];
    const workload = dashboardData.workload || [];
    const activityLog = dashboardData.activityLog || [];

    return (
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.length ? (
            metrics.map((metric) => (
              <div key={metric.label} className="rounded-3xl border border-[#EDE7D8] bg-white p-5 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
                <div className="text-xs font-medium text-[#9C9484]">{metric.label}</div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="text-3xl font-bold text-[#1A1A1A]">{metric.value}</div>
                  <span className="rounded-full bg-[#FDECC8] px-2.5 py-1 text-[10px] font-semibold text-[#92400E]">{metric.change}</span>
                </div>
              </div>
            ))
          ) : (
            renderEmptyState('No overview metrics', 'The dashboard is ready to receive academic data from the backend.')
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-[#9C9484]">Task decomposition</div>
                <h2 className="mt-1 text-xl font-bold text-[#1A1A1A]">Unit and project oversight</h2>
              </div>
              <button type="button" className="rounded-full bg-[#141414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A2A]">
                + Add milestone
              </button>
            </div>

            {projectTree.length ? (
              <div className="space-y-4">
                {projectTree.map((project) => (
                  <div key={project.id} className="rounded-2xl border border-[#EDE7D8] bg-[#FAF7EF] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-[#1A1A1A]">{project.title}</div>
                        <div className="text-xs text-[#9C9484]">{project.milestone}</div>
                      </div>
                      <span className="rounded-full bg-[#F0EDE4] px-3 py-1 text-[10px] font-semibold text-[#57534E]">Project</span>
                    </div>
                    <div className="space-y-2.5">
                      {(project.tasks || []).map((task) => (
                        <div key={task.id} className="rounded-xl border border-[#EDE7D8] bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-semibold text-[#1A1A1A]">{task.title}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#9C9484]">{task.assignee}</span>
                              <span className="rounded-full bg-[#EAF3FF] px-2.5 py-1 text-[10px] font-semibold text-[#2E5C8A]">{task.weight} pts</span>
                              <span className={statusPill(task.status)}>{task.status}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              renderEmptyState('No project data yet', 'The backend will populate the project tree for your units.')
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
              <div className="mb-1 text-xs font-medium text-[#9C9484]">Workload balance</div>
              <h3 className="text-xl font-bold text-[#1A1A1A]">Group distribution</h3>
              {workload.length ? (
                <div className="mt-5 space-y-4">
                  {workload.map((person) => (
                    <div key={person.name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-[#1A1A1A]">{person.name}</span>
                        <span className="text-[#9C9484]">{person.value}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#F0EDE4]">
                        <div className="h-full rounded-full" style={{ width: `${person.value}%`, backgroundColor: getProgressColor(person.value) }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-[#9C9484]">No workload data available.</div>
              )}
            </div>

            <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
              <div className="mb-3 text-xs font-medium text-[#9C9484]">Risk signal</div>
              <div className="rounded-2xl bg-[#FDECC8] p-4 text-sm text-[#92400E]">
                At-risk criteria: low engagement, delayed milestones, or students carrying more than 60% of the work.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
          <div className="mb-4 text-xs font-medium text-[#9C9484]">Activity log</div>
          <h3 className="text-xl font-bold text-[#1A1A1A]">Chronological evidence trail</h3>
          {activityLog.length ? (
            <div className="mt-4 space-y-2.5">
              {activityLog.map((entry) => (
                <div key={`${entry.time}-${entry.event}`} className="rounded-2xl border border-[#EDE7D8] bg-[#FAF7EF] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-[#1A1A1A]">{entry.event}</div>
                    <span className="text-[10px] font-medium text-[#9C9484]">{entry.time}</span>
                  </div>
                  <div className="mt-1 text-sm text-[#57534E]">{entry.target}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-[#9C9484]">No activity history has been loaded yet.</div>
          )}
        </section>
      </div>
    );
  };

  const renderProjects = () => {
    const projectTree = dashboardData.projectTree || [];
    return (
      <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#9C9484]">Projects</div>
            <h2 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Portfolio overview</h2>
          </div>
          <button type="button" className="rounded-full bg-[#141414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A2A]">
            + New project
          </button>
        </div>
        {projectTree.length ? (
          <div className="space-y-4">
            {projectTree.map((project) => (
              <div key={project.id} className="rounded-2xl border border-[#EDE7D8] bg-[#FAF7EF] p-4">
                <div className="text-lg font-semibold text-[#1A1A1A]">{project.title}</div>
                <div className="text-xs text-[#9C9484]">{project.milestone}</div>
              </div>
            ))}
          </div>
        ) : (
          renderEmptyState('No project records', 'Project hierarchy will appear here once your backend data is connected.')
        )}
      </div>
    );
  };

  const renderGroups = () => (
    <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-[#9C9484]">Groups</div>
          <h2 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Student groups</h2>
        </div>
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search groups"
          className="w-64 rounded-full border border-[#EDE7D8] bg-[#FAF7EF] px-4 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#9C9484] focus:border-[#141414] focus:outline-none"
        />
      </div>

      {filteredGroups.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredGroups.map((group) => (
            <div key={group.id} className="rounded-2xl border border-[#EDE7D8] bg-[#FAF7EF] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[#1A1A1A]">{group.name}</div>
                  <div className="mt-0.5 text-xs text-[#9C9484]">{group.unit_code || group.unitCode || group.course || 'Unit'} · {group.members_count || group.memberCount || 0} members</div>
                </div>
                <span className={statusPill(group.status || 'On track')}>{group.status || 'On track'}</span>
              </div>
              <div className="mt-3 text-xs text-[#9C9484]">Submitted work: {group.members_count || group.memberCount || 0} active contributors</div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToGroupChat(group.id)}
                  className="rounded-full bg-[#141414] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2A2A2A]"
                >
                  Go to chat →
                </button>
                <button type="button" className="rounded-full border border-[#EDE7D8] bg-white px-4 py-2 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F0EDE4]">
                  View group
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        renderEmptyState('No student groups', 'Once the group roster is available, it will show here.')
      )}

      <div className="mt-8">
        <div className="mb-3 text-xs font-medium text-[#9C9484]">Accountability view</div>
        {filteredMembers.length ? (
          <div className="space-y-3">
            {filteredMembers.map((member) => (
              <div key={member.name} className="rounded-2xl border border-[#EDE7D8] bg-[#FAF7EF] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1A1A1A]">{member.name}</span>
                      {member.badge && <span className="rounded-full bg-[#EAF3FF] px-2.5 py-0.5 text-[10px] font-semibold text-[#2E5C8A]">{member.badge}</span>}
                    </div>
                    <div className="text-xs text-[#9C9484]">{member.role}</div>
                  </div>
                  <span className={statusPill(member.status || 'On track')}>{member.status || 'On track'}</span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-[#9C9484]">
                    <span>Contribution</span>
                    <span>{member.contribution || 0}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F0EDE4]">
                    <div className="h-full rounded-full" style={{ width: `${member.contribution || 0}%`, backgroundColor: getProgressColor(member.contribution || 0) }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[#9C9484]">No member data yet.</div>
        )}
      </div>
    </div>
  );

  const renderSubmissions = () => {
    const submissions = dashboardData.submissions || [];
    return (
      <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#9C9484]">Submissions</div>
            <h2 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Review board</h2>
          </div>
        </div>
        {submissions.length ? (
          <div className="space-y-3">
            {submissions.map((submission) => (
              <div key={submission.id || submission.group} className="rounded-2xl border border-[#EDE7D8] bg-[#FAF7EF] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-[#1A1A1A]">{submission.group}</div>
                  <span className={statusPill(submission.status || 'Submitted')}>{submission.status || 'Submitted'}</span>
                </div>
                <div className="mt-2 text-xs text-[#9C9484]">Repo: {submission.repo || 'Live backend pull'}</div>
              </div>
            ))}
          </div>
        ) : (
          renderEmptyState('No submissions', 'Submission records will appear here when the backend is connected.')
        )}
      </div>
    );
  };

  const renderChatInbox = () => {
    const groups = dashboardData.groups || [];
    return (
      <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
        <div className="mb-5">
          <div className="text-xs font-medium text-[#9C9484]">Chat</div>
          <h2 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Your group chats</h2>
          <p className="mt-1 text-sm text-[#9C9484]">Open a group to see its live chat, task updates, and comments in one feed.</p>
        </div>
        {groups.length ? (
          <div className="space-y-2.5">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => goToGroupChat(group.id)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#EDE7D8] bg-[#FAF7EF] p-4 text-left hover:bg-[#F0EDE4]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-[#1A1A1A]">{group.name}</div>
                    {Number(group.unread_count || 0) > 0 && (
                      <span className="rounded-full bg-[#E8622C] px-2 py-0.5 text-[10px] font-bold text-white">
                        {group.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[#9C9484]">{group.unit_code || group.unitCode || group.course || 'Unit'} · {group.members_count || group.memberCount || 0} members</div>
                  <div className="mt-2 truncate text-xs text-[#57534E]">{group.last_message_preview || 'No messages yet'}</div>
                </div>
                <div className="text-right text-[10px] text-[#9C9484]">
                  <div>{group.last_message_time ? new Date(group.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  <div className="mt-1">Open →</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          renderEmptyState('No group chats yet', 'Chats appear here once groups are formed for your units.')
        )}
      </div>
    );
  };

  const renderSchedule = () => {
    const schedule = dashboardData.schedule || [];
    return (
      <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
        <div className="mb-5">
          <div className="text-xs font-medium text-[#9C9484]">Schedule</div>
          <h2 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Weekly planner</h2>
        </div>
        {schedule.length ? (
          <div className="grid gap-3 md:grid-cols-7">
            {schedule.map((day) => (
              <div key={day.day} className="rounded-2xl border border-[#EDE7D8] bg-[#FAF7EF] p-3">
                <div className="mb-2 text-center text-xs font-semibold text-[#9C9484]">{day.day}</div>
                <div className="space-y-2">
                  {day.items.length ? (
                    day.items.map((item, index) => (
                      <div key={`${day.day}-${index}`} className="rounded-lg bg-[#FDECC8] px-2 py-1.5 text-[11px] text-[#92400E]">{item}</div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#EDE7D8] px-2 py-3 text-center text-[10px] text-[#B8B0A0]">free</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          renderEmptyState('No schedule data', 'The weekly planner will populate from backend deadlines.')
        )}
      </div>
    );
  };

  const renderProfile = () => {
    const profile = dashboardData.profile || {};
    return (
      <div className="rounded-3xl border border-[#EDE7D8] bg-white p-6 shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
        <div className="mb-5 text-xs font-medium text-[#9C9484]">Profile</div>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8622C] text-lg font-bold text-white">
            {formatInitials(storedUser || profile)}
          </div>
          <div>
            <div className="text-xl font-bold text-[#1A1A1A]">
              {(storedUser?.first_name || profile.first_name || 'Lecturer')} {(storedUser?.last_name || profile.last_name || 'Profile')}
            </div>
            <div className="text-sm text-[#9C9484]">{profile.department || storedUser?.department || 'Department not set'}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'projects': return renderProjects();
      case 'groups': return renderGroups();
      case 'submissions': return renderSubmissions();
      case 'chat': return renderChatInbox();
      case 'schedule': return renderSchedule();
      case 'profile': return renderProfile();
      default: return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8] text-[#1A1A1A]" style={{ fontFamily: 'Inter, Segoe UI, sans-serif' }}>
      <div className="flex min-h-screen">
        <aside className="relative flex w-64 flex-col justify-between bg-[#141414] p-5 text-white">
          <div>
            <div className="mb-8 flex items-center gap-3 px-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8622C] text-lg font-bold text-white">G</div>
              <div>
                <div className="text-lg font-bold tracking-tight">GroupHub</div>
                <div className="text-[10px] text-[#8A8374]">Lecturer portal</div>
              </div>
            </div>

            <nav className="space-y-1.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-medium transition ${
                    activeTab === item.id ? 'bg-[#F5F1E8] text-[#141414]' : 'text-[#B8B0A0] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="w-5 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2E5C8A] text-sm font-bold text-white">
              {formatInitials(storedUser)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{storedUser?.first_name || 'Lecturer'} {storedUser?.last_name || 'Profile'}</div>
              <div className="truncate text-[10px] text-[#8A8374]">Faculty oversight</div>
            </div>
            <button type="button" onClick={handleLogout} className="rounded-full px-2 py-1 text-xs text-[#B8B0A0] hover:text-white">
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          <header className="px-8 pt-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#9C9484]">GroupHub / lecturer workspace</div>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1A1A1A]">{greeting}, {storedUser?.first_name || 'Dr.'} {storedUser?.last_name || 'Lecturer'}</h1>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9C9484]">⌕</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search groups or members"
                    className="w-72 rounded-full border border-[#EDE7D8] bg-white py-3 pl-10 pr-4 text-sm text-[#1A1A1A] placeholder:text-[#9C9484] focus:border-[#141414] focus:outline-none"
                  />
                </div>
                <button type="button" className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#EDE7D8] bg-white text-[#1A1A1A]">
                  🔔
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#E8622C] text-[10px] font-bold text-white">3</span>
                </button>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#141414] text-sm font-bold text-white">
                  {formatInitials(storedUser)}
                </div>
              </div>
            </div>
          </header>

          <div className="p-8">
            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-[#EDE7D8] bg-white p-6 text-sm text-[#9C9484] shadow-[0_2px_12px_rgba(20,20,20,0.05)]">
                Loading lecturer dashboard...
              </div>
            ) : (
              renderTabContent()
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default LecturerDashboard;

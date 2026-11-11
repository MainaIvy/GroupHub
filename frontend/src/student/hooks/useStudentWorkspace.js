import { useEffect, useMemo, useState } from 'react';
import axios from '../../api';
import { API, getStoredToken, safeArray, safeDate, startOfDay, formatISODateOnly } from '../utils';

export default function useStudentWorkspace() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [units, setUnits] = useState([]);
  const [academic, setAcademic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardKey, setDashboardKey] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('create');
  const [error, setError] = useState(''); // kept (eslint in this project flags unused vars)

  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsCatalog, setSettingsCatalog] = useState([]);
  const [settingsForm, setSettingsForm] = useState({ first_name: '', last_name: '', course_id: '', year_of_study: '', semester: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLoadError, setSettingsLoadError] = useState('');
  const [settingsLoadKey, setSettingsLoadKey] = useState(0);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [newGroupName, setNewGroupName] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [maxMembers, setMaxMembers] = useState('6');
  const [inviteUsernames, setInviteUsernames] = useState('');
  const [groupMenuId, setGroupMenuId] = useState(null);

  const [chatGroupId, setChatGroupId] = useState(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [selectedTaskGroup, setSelectedTaskGroup] = useState(null);
  const [taskWorkspace, setTaskWorkspace] = useState(null);
  const [taskBalance, setTaskBalance] = useState(null);
  const [taskWorkspaceLoading, setTaskWorkspaceLoading] = useState(false);
  const [taskWorkspaceError, setTaskWorkspaceError] = useState('');
  const [groupActivity, setGroupActivity] = useState([]);
  const [taskGroupProjects, setTaskGroupProjects] = useState([]);
  const [projectModal, setProjectModal] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [selectedGroupDetail, setSelectedGroupDetail] = useState(null);
  const [groupDetailWorkspace, setGroupDetailWorkspace] = useState(null);
  const [groupDetailLoading, setGroupDetailLoading] = useState(false);
  const [groupDetailError, setGroupDetailError] = useState('');
  const [groupComments, setGroupComments] = useState([]);
  const [groupCommentsLoading, setGroupCommentsLoading] = useState(false);
  const [groupCommentsError, setGroupCommentsError] = useState('');
  const [submissionGroupId, setSubmissionGroupId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [submissionBalance, setSubmissionBalance] = useState(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [submissionForm, setSubmissionForm] = useState({ github_url: '', proof_text: '', screenshot: null, attachments: [] });
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState('create');
  const [parentTaskId, setParentTaskId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedToId: '', weight: 1, dueDate: '' });
  const [taskBalanceWarning, setTaskBalanceWarning] = useState('');
  const [taskProjectedBalance, setTaskProjectedBalance] = useState(null);
  const [taskProjectionLoading, setTaskProjectionLoading] = useState(false);
  const [taskBalanceConfirmed, setTaskBalanceConfirmed] = useState(false);
  const [taskOverrideReason, setTaskOverrideReason] = useState('');
  const [taskCommentDrafts, setTaskCommentDrafts] = useState({});
  const [taskCommentBusyId, setTaskCommentBusyId] = useState(null);
  const [taskBusy, setTaskBusy] = useState(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (activeTab !== 'settings') return undefined;
    let cancelled = false;
    const token = getStoredToken();
    const headers = { Authorization: `Bearer ${token}` };
    setSettingsLoadError('');
    setSettingsLoading(true);
    Promise.all([
      axios.get('/api/accounts/profile/settings/', { headers }),
      axios.get('/api/accounts/academic/courses/'),
    ]).then(([profileResponse, coursesResponse]) => {
      if (cancelled) return;
      const profile = profileResponse.data || {};
      setSettingsForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        course_id: profile.course_id ? String(profile.course_id) : '',
        year_of_study: profile.year_of_study ? String(profile.year_of_study) : '',
        semester: profile.semester ? String(profile.semester) : '',
      });
      setSettingsCatalog(safeArray(coursesResponse.data?.courses));
    }).catch((requestError) => {
      if (!cancelled) setSettingsLoadError(requestError.response?.data?.error || 'Unable to load account settings.');
    }).finally(() => {
      if (!cancelled) setSettingsLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, settingsLoadKey]);

  const selectedSettingsCourse = settingsCatalog.find((course) => String(course.id) === settingsForm.course_id);
  const settingsYears = Object.keys(selectedSettingsCourse?.structure || {}).sort((a, b) => Number(a) - Number(b));
  const settingsSemesters = selectedSettingsCourse?.structure?.[settingsForm.year_of_study] || [];

  const handleSettingsSubmit = async (event) => {
    event.preventDefault();
    setSettingsBusy(true);
    setSettingsError('');
    setSettingsMessage('');
    try {
      const response = await axios.patch('/api/accounts/profile/settings/', settingsForm, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      const profile = response.data;
      const course = settingsCatalog.find((item) => String(item.id) === String(profile.course_id));
      const nextUser = {
        ...user,
        ...profile,
        course: course?.name || profile.course || '',
        enrolled_course_id: profile.course_id || null,
      };
      setUser(nextUser);
      localStorage.setItem('user', JSON.stringify(nextUser));
      setAcademic(course ? {
        course_id: course.id,
        course_code: course.code,
        course_name: course.name,
        year_of_study: profile.year_of_study,
        semester: profile.semester,
      } : profile.course ? {
        course_name: profile.course,
        year_of_study: profile.year_of_study,
        semester: profile.semester,
      } : null);
      setSettingsMessage('Profile settings saved.');
    } catch (requestError) {
      setSettingsError(requestError.response?.data?.error || 'Unable to save profile settings.');
    } finally {
      setSettingsBusy(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError('');
    setPasswordMessage('');
    try {
      const response = await axios.post('/api/accounts/profile/change-password/', passwordForm, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      setPasswordMessage(response.data?.message || 'Password changed.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (requestError) {
      setPasswordError(requestError.response?.data?.error || 'Unable to change password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setDashboardError('');
      try {
        const token = getStoredToken();
        if (!token) {
          window.location.href = '/login';
          return;
        }

        const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
        const dashRes = await axios.get(API.studentDashboard, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dash = dashRes?.data ?? {};
        const dashboardUser = dash?.user || {};
        const fetchedUser = {
          ...storedUser,
          ...dashboardUser,
          first_name: dashboardUser.first_name || storedUser?.first_name || dashboardUser.full_name?.split(' ')[0] || 'Student',
          last_name: dashboardUser.last_name || storedUser?.last_name || dashboardUser.full_name?.split(' ').slice(1).join(' ') || '',
          course: dash?.academic?.course_name || dashboardUser.course || storedUser?.course || '',
          enrolled_course_id: dash?.academic?.course_id || dashboardUser.course_id || storedUser?.enrolled_course_id || null,
        };
        const fetchedGroups = safeArray(dash?.groups);
        const rawTasks = safeArray(dash?.tasks?.pending || dash?.tasks || dash?.recent_tasks || []);
        const normalizedTasks = rawTasks.map((t) => ({
          ...t,
          due_date: t?.due_date ?? t?.deadline ?? null,
          project_name: t?.project_name ?? t?.project ?? t?.title ?? null,
          status: t?.status ?? 'pending',
        }));

        setUser(fetchedUser);
        localStorage.setItem('user', JSON.stringify(fetchedUser));
        setGroups(fetchedGroups);
        setTasks(normalizedTasks);
        setUnits(safeArray(dash?.units));
        setAcademic(dash?.academic || null);
      } catch (err) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        setDashboardError('We could not load your dashboard.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [dashboardKey]);

  const reloadDashboard = () => setDashboardKey((key) => key + 1);

  const refreshGroups = async () => {
    try {
      const response = await axios.get(API.studentDashboard);
      setGroups(safeArray(response?.data?.groups));
      setUnits(safeArray(response?.data?.units));
    } catch {
      setError('Unable to refresh your groups.');
    }
  };

  useEffect(() => {
    if (selectedGroupDetail?.id) setSubmissionGroupId(String(selectedGroupDetail.id));
  }, [selectedGroupDetail?.id]);

  useEffect(() => {
    if (!submissionGroupId) return undefined;
    let cancelled = false;
    const token = getStoredToken();
    const headers = { Authorization: `Bearer ${token}` };
    setSubmissionsLoading(true);
    setSubmissionError('');
    Promise.all([
      axios.get(`/api/accounts/groups/${submissionGroupId}/submissions/`, { headers }),
      axios.get(`/api/accounts/groups/${submissionGroupId}/balance/`, { headers }),
    ]).then(([submissionResponse, balanceResponse]) => {
      if (cancelled) return;
      setSubmissions(safeArray(submissionResponse.data));
      setSubmissionBalance(balanceResponse.data);
    }).catch((requestError) => {
      if (!cancelled) setSubmissionError(requestError.response?.data?.error || 'Unable to load group submissions.');
    }).finally(() => {
      if (!cancelled) setSubmissionsLoading(false);
    });
    return () => { cancelled = true; };
  }, [submissionGroupId]);

  useEffect(() => {
    if (activeTab !== 'group-detail' || !selectedGroupDetail?.id) return undefined;
    let cancelled = false;
    const loadComments = async () => {
      try {
        const response = await axios.get(`/api/accounts/groups/${selectedGroupDetail.id}/comments/`, {
          headers: { Authorization: `Bearer ${getStoredToken()}` },
        });
        if (!cancelled) {
          setGroupComments(safeArray(response.data));
          setGroupCommentsError('');
        }
      } catch (requestError) {
        if (!cancelled) {
          setGroupComments([]);
          setGroupCommentsError(requestError.response?.data?.error || 'Unable to load lecturer comments.');
        }
      } finally {
        if (!cancelled) setGroupCommentsLoading(false);
      }
    };
    setGroupCommentsLoading(true);
    loadComments();
    const interval = window.setInterval(loadComments, 10000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [activeTab, selectedGroupDetail?.id]);

  const submitGroupSubmission = async (event) => {
    event.preventDefault();
    if (!submissionGroupId || submissionBusy) return;
    setSubmissionBusy(true);
    setSubmissionError('');
    setSubmissionMessage('');
    try {
      const body = new FormData();
      body.append('proof_text', submissionForm.proof_text.trim());
      body.append('github_url', submissionForm.github_url.trim());
      if (submissionForm.screenshot) body.append('screenshot', submissionForm.screenshot);
      submissionForm.attachments.forEach((file) => body.append('attachments', file));
      const response = await axios.post(`/api/accounts/groups/${submissionGroupId}/submissions/`, body, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      setSubmissions((current) => [response.data, ...current]);
      setSubmissionForm({ github_url: '', proof_text: '', screenshot: null, attachments: [] });
      const input = document.getElementById('submission-screenshot');
      if (input) input.value = '';
      const attachmentInput = document.getElementById('submission-attachments');
      if (attachmentInput) attachmentInput.value = '';
      setSubmissionMessage('Submission received.');
    } catch (requestError) {
      setSubmissionError(requestError.response?.data?.error || 'Unable to submit your work.');
    } finally {
      setSubmissionBusy(false);
    }
  };

  const courseOptions = useMemo(() => {
    const explicit = safeArray(user?.courses);
    const fromGroups = safeArray(groups).map((g) => g?.course).filter(Boolean);
    const set = new Set([
      ...explicit.map((c) => (typeof c === 'string' ? c : c?.name)),
      ...fromGroups,
      user?.course,
      academic?.course_name,
    ]);
    return Array.from(set).filter(Boolean);
  }, [academic, groups, user]);

  useEffect(() => {
    if (!showModal) return;
    if (!courseOptions.length) return;
    if (!selectedCourse) setSelectedCourse(courseOptions[0]);
  }, [showModal, courseOptions, selectedCourse]);

  const welcomeName = useMemo(() => {
    const first = user?.first_name;
    const last = user?.last_name;
    const derived = `${first || ''} ${last || ''}`.trim();
    return derived.split(' ')[0] || 'Student';
  }, [user]);
  const avatarInitials = [user?.first_name, user?.last_name]
    .map((name) => String(name || '').trim().split(/\s+/)[0]?.[0] || '')
    .join('')
    .toUpperCase() || 'S';

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return `Good morning, ${welcomeName}`;
    if (h < 18) return `Good afternoon, ${welcomeName}`;
    return `Good evening, ${welcomeName}`;
  }, [now, welcomeName]);

  const activeGroupsCount = groups.length;
  const searchText = searchQuery.trim().toLowerCase();
  const visibleUnits = searchText
    ? units.filter((unit) => `${unit.code} ${unit.name}`.toLowerCase().includes(searchText))
    : units;
  const searchResults = searchText ? [
    ...groups
      .filter((group) => `${group.name} ${group.course || ''}`.toLowerCase().includes(searchText))
      .map((group) => ({ id: `group-${group.id}`, label: group.name, detail: group.course || 'Group', tab: 'groups' })),
    ...tasks
      .filter((task) => `${task.title} ${task.project_name || ''}`.toLowerCase().includes(searchText))
      .map((task) => ({ id: `task-${task.id}`, label: task.title, detail: task.project_name || 'Task', tab: 'tasks' })),
    ...units
      .filter((unit) => `${unit.code} ${unit.name}`.toLowerCase().includes(searchText))
      .map((unit) => ({ id: `unit-${unit.id}`, label: unit.code, detail: unit.name, tab: 'units' })),
  ].slice(0, 8) : [];
  const visibleGroups = searchText
    ? groups.filter((group) => `${group.name} ${group.course}`.toLowerCase().includes(searchText))
    : groups;
  const assignmentsDueCount = useMemo(() => {
    const tNow = new Date();
    const today = startOfDay(tNow).getTime();
    const horizon = today + 14 * 24 * 60 * 60 * 1000;
    return safeArray(tasks).filter((t) => {
      const due = safeDate(t?.due_date);
      if (!due) return false;
      const dueDay = startOfDay(due).getTime();
      return dueDay >= today && dueDay <= horizon && String(t?.status || '').toLowerCase() !== 'completed';
    }).length;
  }, [tasks]);

  const completedWorkCount = useMemo(() => {
    return safeArray(tasks).filter((t) => {
      const status = String(t?.status || '').toLowerCase();
      return status === 'completed';
    }).length;
  }, [tasks]);

  const completionRatePercentage = useMemo(() => {
    if (tasks.length === 0) return '0%';
    const percentage = Math.round((completedWorkCount / tasks.length) * 100);
    return `${percentage}% completion rate`;
  }, [tasks, completedWorkCount]);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    return new Date();
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  const deadlineByDay = useMemo(() => {
    const map = new Map();
    const nowStart = startOfDay(now).getTime();

    for (const t of safeArray(tasks)) {
      const due = safeDate(t?.due_date);
      if (!due) continue;

      const dateKey = formatISODateOnly(due);
      if (!dateKey) continue;

      const isOverdue = startOfDay(due).getTime() < nowStart && String(t.status || '').toLowerCase() !== 'completed';
      const entries = map.get(dateKey) || [];
      entries.push({ ...t, isOverdue });
      map.set(dateKey, entries);
    }
    return map;
  }, [tasks, now]);

  const selectedDayTasks = selectedCalendarDay ? deadlineByDay.get(selectedCalendarDay) || [] : [];
  const upcomingTasks = useMemo(() => {
    const today = startOfDay(now).getTime();
    const horizon = today + 14 * 24 * 60 * 60 * 1000;
    return safeArray(tasks)
      .filter((task) => {
        const due = safeDate(task.due_date);
        return due && startOfDay(due).getTime() >= today && startOfDay(due).getTime() <= horizon
          && String(task.status || '').toLowerCase() !== 'completed';
      })
      .sort((left, right) => new Date(left.due_date) - new Date(right.due_date));
  }, [tasks, now]);

  const openCreateModal = (courseCode = '', unit = null) => {
    if (typeof courseCode === 'string' && courseCode) {
      setSelectedCourse(courseCode);
    }
    setSelectedUnitId(unit?.id ? String(unit.id) : '');
    setMaxMembers('6');
    setInviteUsernames('');
    setModalTab('create');
    setInviteError('');
    setError('');
    setShowModal(true);
  };

  const openJoinModal = () => {
    setModalTab('join');
    setInviteError('');
    setShowModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e?.preventDefault?.();
    if (createBusy) return;

    const token = getStoredToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const name = (newGroupName || '').trim();
    const course = (selectedCourse || '').trim();
    if (!name || !course) return;

    setCreateBusy(true);
    setError('');

    try {
      const payload = {
        name,
        course,
        year_of_study: user?.year_of_study || academic?.year_of_study || '1',
        unit_id: selectedUnitId || null,
        max_members: Number(maxMembers),
        invite_usernames: inviteUsernames.split(',').map((value) => value.trim()).filter(Boolean),
      };
      const res = await axios.post(API.createGroup, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const createdGroup = res?.data?.group ?? res?.data?.created_group ?? null;
      if (createdGroup) {
        setGroups((prev) => [...prev, createdGroup]);
      }
      setShowModal(false);
      setNewGroupName('');
      setSelectedUnitId('');
      setInviteUsernames('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || 'Create group failed');
    } finally {
      setCreateBusy(false);
    }
  };

  const handleInviteInputChange = (value) => {
    const upper = String(value || '').toUpperCase();
    setInviteCodeInput(upper.replace(/[^A-Z0-9]/g, '').slice(0, 6));
    setInviteError('');
  };

  const handleJoinSubmit = async (e) => {
    e?.preventDefault?.();
    if (joinBusy) return;

    const token = getStoredToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const code = (inviteCodeInput || '').trim();
    if (!code || code.length !== 6) return;

    setJoinBusy(true);
    setInviteError('');

    try {
      await axios.post(API.joinGroup, { code }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowModal(false);
      setLoading(true);

      const dashRes = await axios.get(API.studentDashboard, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const dash = dashRes?.data ?? {};
      setGroups(safeArray(dash?.groups));
      setInviteCodeInput('');
    } catch (err) {
      setInviteError(err?.response?.data?.error || 'Unable to join group');
    } finally {
      setLoading(false);
      setJoinBusy(false);
    }
  };

  const openGroupTasks = async (group) => {
    setSelectedTaskGroup(group);
    setTaskWorkspace(null);
    setTaskBalance(null);
    setGroupActivity([]);
    setTaskGroupProjects([]);
    setTaskWorkspaceLoading(true);
    setActivityLoading(true);
    setTaskWorkspaceError('');
    try {
      const token = getStoredToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [detailsResponse, balanceResponse, activityResponse, commentsResponse, projectsResponse] = await Promise.all([
        axios.get(`/api/accounts/groups/${group.id}/workspace/`, { headers }),
        axios.get(`/api/accounts/groups/${group.id}/balance/`, { headers }),
        axios.get(`/api/accounts/groups/${group.id}/activity/`, { headers }),
        axios.get(`/api/accounts/groups/${group.id}/comments/`, { headers }),
        axios.get(`/api/accounts/groups/${group.id}/projects/`, { headers }).catch(() => ({ data: [] })),
      ]);
      setTaskGroupProjects(safeArray(projectsResponse.data));
      setTaskWorkspace(detailsResponse.data);
      setTaskBalance(balanceResponse.data);
      setGroupActivity(safeArray(activityResponse.data));
      setGroupComments(safeArray(commentsResponse.data));
      return detailsResponse.data;
    } catch (err) {
      setTaskWorkspaceError(err?.response?.data?.error || 'Unable to load this group’s tasks.');
      return null;
    } finally {
      setTaskWorkspaceLoading(false);
      setActivityLoading(false);
    }
  };

  const openGroupDetails = async (group) => {
    setSelectedGroupDetail(group);
    setGroupDetailWorkspace(null);
    setGroupComments([]);
    setGroupDetailError('');
    setGroupDetailLoading(true);
    setActiveTab('group-detail');
    try {
      const response = await axios.get(`/api/accounts/groups/${group.id}/workspace/`, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      setGroupDetailWorkspace(response.data);
    } catch (requestError) {
      setGroupDetailError(requestError.response?.data?.error || 'Unable to load this group.');
    } finally {
      setGroupDetailLoading(false);
    }
  };

  const openReferencedTask = async (taskId, groupId) => {
    const group = groups.find((item) => String(item.id) === String(groupId)) || selectedGroupDetail;
    if (!group) return;
    setActiveTab('tasks');
    await openGroupTasks(group);
    window.setTimeout(() => document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  };

  const openChatTaskAssignment = async (groupId) => {
    const group = groups.find((item) => String(item.id) === String(groupId));
    if (!group) return;
    const workspace = await openGroupTasks(group);
    if (!workspace) return;
    setTaskModalMode('create');
    setEditingTask(null);
    setParentTaskId(null);
    setTaskForm({
      title: '',
      description: '',
      assignedToId: String(workspace.members?.[0]?.id || ''),
      projectId: String(workspace.group?.projects?.[0]?.id || ''),
      weight: 1,
      dueDate: '',
    });
    setTaskBalanceWarning('');
    setTaskProjectedBalance(null);
    setTaskBalanceConfirmed(false);
    setTaskOverrideReason('');
    setTaskModalOpen(true);
    setActiveTab('tasks');
  };

  const openTaskModal = (mode, task = null, parentId = null) => {
    setTaskModalMode(mode);
    setEditingTask(task);
    setParentTaskId(parentId);
    setTaskForm({
      title: task?.title || '',
      description: task?.description || '',
      assignedToId: task?.assigned_to_id ? String(task.assigned_to_id) : String(taskWorkspace?.members?.[0]?.id || ''),
      projectId: task?.project_id
        ? String(task.project_id)
        : String(taskWorkspace?.tasks?.find((item) => item.id === parentId)?.project_id || taskWorkspace?.group?.projects?.[0]?.id || ''),
      weight: Number(task?.weight || 1),
      dueDate: task?.due_date ? String(task.due_date).slice(0, 10) : '',
    });
    setTaskBalanceWarning('');
    setTaskProjectedBalance(null);
    setTaskBalanceConfirmed(false);
    setTaskOverrideReason('');
    setTaskModalOpen(true);
  };

  useEffect(() => {
    if (!taskModalOpen || !selectedTaskGroup || !taskForm.assignedToId) {
      setTaskProjectedBalance(null);
      setTaskProjectionLoading(false);
      return undefined;
    }
    let cancelled = false;
    setTaskProjectionLoading(true);
    setTaskBalanceConfirmed(false);
    setTaskBalanceWarning('');
    axios.post(`/api/accounts/groups/${selectedTaskGroup.id}/balance/`, {
      assigned_to_id: Number(taskForm.assignedToId),
      weight: Number(taskForm.weight),
      exclude_task_id: taskModalMode === 'reassign' ? editingTask?.id : null,
    }, { headers: { Authorization: `Bearer ${getStoredToken()}` } })
      .then((response) => {
        if (!cancelled) setTaskProjectedBalance(response.data);
      })
      .catch(() => {
        if (!cancelled) setTaskProjectedBalance(null);
      })
      .finally(() => {
        if (!cancelled) setTaskProjectionLoading(false);
      });
    return () => { cancelled = true; };
  }, [taskModalOpen, selectedTaskGroup, taskForm.assignedToId, taskForm.weight, taskModalMode, editingTask?.id]);

  const taskPreviewWarning = taskProjectedBalance?.requires_confirmation
    ? taskProjectedBalance.suggestion || 'This assignment would create an uneven workload.'
    : '';
  const taskTooEarlyToJudge = taskModalOpen && taskProjectedBalance?.warning_level === 'too_early';

  const handleTaskSubmit = async (event) => {
    event.preventDefault();
    if (taskBusy || !selectedTaskGroup) return;

    const token = getStoredToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    setTaskBusy(true);
    setTaskWorkspaceError('');
    try {
      if (taskModalMode === 'create' && !taskForm.dueDate) {
        setTaskWorkspaceError('Choose a due date before creating the task.');
        return;
      }
      if (taskModalMode === 'create' && safeArray(taskWorkspace?.group?.projects).length && !taskForm.projectId) {
        setTaskWorkspaceError('Choose a project for this task.');
        return;
      }
      if (taskModalMode === 'reassign' && String(taskForm.assignedToId) === String(editingTask?.assigned_to_id)) {
        setTaskWorkspaceError('Choose a different assignee.');
        return;
      }
      if (taskProjectedBalance?.requires_confirmation && !taskBalanceConfirmed) {
        setTaskBalanceWarning(taskProjectedBalance.suggestion || 'This assignment would create an uneven workload.');
        return;
      }
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        weight: Number(taskForm.weight),
        assigned_to_id: Number(taskForm.assignedToId),
        due_date: taskForm.dueDate || null,
        project_id: taskModalMode === 'create' ? (taskForm.projectId || null) : undefined,
        parent_task_id: parentTaskId,
        confirm_override: taskBalanceConfirmed,
        override_reason: taskOverrideReason.trim(),
      };
      const endpoint = taskModalMode === 'create'
        ? `/api/accounts/groups/${selectedTaskGroup.id}/tasks/assign/`
        : `/api/accounts/groups/${selectedTaskGroup.id}/tasks/${editingTask.id}/reassign/`;
      const response = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data?.balance_warning) {
        setTaskBalanceWarning(response.data.balance_warning);
        setTaskProjectedBalance(response.data.projection || null);
        setTaskBalanceConfirmed(false);
        return;
      }

      setTaskModalOpen(false);
      await openGroupTasks(selectedTaskGroup);
    } catch (err) {
      setTaskWorkspaceError(err?.response?.data?.error || 'Unable to save this task.');
    } finally {
      setTaskBusy(false);
    }
  };

  const handleTaskCommentSubmit = async (event, task) => {
    event.preventDefault();
    const content = String(taskCommentDrafts[task.id] || '').trim();
    if (!content || taskCommentBusyId === task.id || !selectedTaskGroup) return;
    setTaskCommentBusyId(task.id);
    setTaskWorkspaceError('');
    try {
      const response = await axios.post(
        `/api/accounts/groups/${selectedTaskGroup.id}/comments/`,
        { task_id: task.id, content },
        { headers: { Authorization: `Bearer ${getStoredToken()}` } },
      );
      setGroupComments((current) => [response.data, ...current]);
      setTaskCommentDrafts((current) => ({ ...current, [task.id]: '' }));
    } catch (requestError) {
      setTaskWorkspaceError(requestError.response?.data?.error || 'Unable to add this comment.');
    } finally {
      setTaskCommentBusyId(null);
    }
  };

  const handleTaskStatusChange = async (task, status) => {
    try {
      const token = getStoredToken();
      await axios.post(`/api/accounts/tasks/${task.id}/update-status/`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await openGroupTasks(selectedTaskGroup);
    } catch (requestError) {
      setTaskWorkspaceError(requestError.response?.data?.error || 'Unable to update task status.');
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!group) return;
    if (!group.is_leader) {
      setGroupMenuId(null);
      setError('Only the group leader can delete this group.');
      return;
    }
    try {
      const token = getStoredToken();
      await axios.delete(`/api/accounts/groups/${group.id}/delete/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroups((current) => current.filter((item) => item.id !== group.id));
      setGroupMenuId(null);
      if (selectedTaskGroup?.id === group.id) {
        setSelectedTaskGroup(null);
        setTaskWorkspace(null);
        setTaskBalance(null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to delete group.');
    }
  };

  const handleLeaveGroup = async (group) => {
    if (group.is_leader) {
      setGroupMenuId(null);
      setError('The group leader cannot leave. Delete the group instead.');
      return;
    }
    try {
      await axios.post(`/api/accounts/groups/${group.id}/leave/`, {}, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      setGroups((current) => current.filter((item) => item.id !== group.id));
      setGroupMenuId(null);
      if (selectedGroupDetail?.id === group.id) {
        setSelectedGroupDetail(null);
        setGroupDetailWorkspace(null);
        setActiveTab('groups');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to leave this group.');
    }
  };

  const taskTree = useMemo(() => {
    const nodes = new Map(safeArray(taskWorkspace?.tasks).map((task) => [task.id, { ...task, children: [] }]));
    const roots = [];
    for (const task of nodes.values()) {
      const parent = nodes.get(task.parent_task_id);
      if (parent) parent.children.push(task);
      else roots.push(task);
    }
    return roots;
  }, [taskWorkspace]);


  return {
    user,
    setUser,
    groups,
    setGroups,
    tasks,
    setTasks,
    units,
    setUnits,
    academic,
    setAcademic,
    loading,
    setLoading,
    showModal,
    setShowModal,
    modalTab,
    setModalTab,
    error,
    setError,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    settingsCatalog,
    setSettingsCatalog,
    settingsForm,
    setSettingsForm,
    settingsLoading,
    setSettingsLoading,
    settingsLoadError,
    setSettingsLoadError,
    settingsLoadKey,
    setSettingsLoadKey,
    settingsBusy,
    setSettingsBusy,
    settingsMessage,
    setSettingsMessage,
    settingsError,
    setSettingsError,
    passwordForm,
    setPasswordForm,
    passwordBusy,
    setPasswordBusy,
    passwordMessage,
    setPasswordMessage,
    passwordError,
    setPasswordError,
    newGroupName,
    setNewGroupName,
    selectedCourse,
    setSelectedCourse,
    selectedUnitId,
    setSelectedUnitId,
    maxMembers,
    setMaxMembers,
    inviteUsernames,
    setInviteUsernames,
    groupMenuId,
    setGroupMenuId,
    chatGroupId,
    setChatGroupId,
    createBusy,
    setCreateBusy,
    inviteCodeInput,
    setInviteCodeInput,
    inviteError,
    setInviteError,
    joinBusy,
    setJoinBusy,
    selectedTaskGroup,
    setSelectedTaskGroup,
    taskWorkspace,
    setTaskWorkspace,
    taskBalance,
    setTaskBalance,
    taskWorkspaceLoading,
    setTaskWorkspaceLoading,
    taskWorkspaceError,
    setTaskWorkspaceError,
    groupActivity,
    setGroupActivity,
    taskGroupProjects,
    setTaskGroupProjects,
    projectModal,
    setProjectModal,
    activityLoading,
    setActivityLoading,
    selectedGroupDetail,
    setSelectedGroupDetail,
    groupDetailWorkspace,
    setGroupDetailWorkspace,
    groupDetailLoading,
    setGroupDetailLoading,
    groupDetailError,
    setGroupDetailError,
    groupComments,
    setGroupComments,
    groupCommentsLoading,
    setGroupCommentsLoading,
    groupCommentsError,
    setGroupCommentsError,
    submissionGroupId,
    setSubmissionGroupId,
    submissions,
    setSubmissions,
    submissionBalance,
    setSubmissionBalance,
    submissionsLoading,
    setSubmissionsLoading,
    submissionBusy,
    setSubmissionBusy,
    submissionError,
    setSubmissionError,
    submissionMessage,
    setSubmissionMessage,
    submissionForm,
    setSubmissionForm,
    taskModalOpen,
    setTaskModalOpen,
    taskModalMode,
    setTaskModalMode,
    parentTaskId,
    setParentTaskId,
    editingTask,
    setEditingTask,
    taskForm,
    setTaskForm,
    taskBalanceWarning,
    setTaskBalanceWarning,
    taskProjectedBalance,
    setTaskProjectedBalance,
    taskProjectionLoading,
    setTaskProjectionLoading,
    taskBalanceConfirmed,
    setTaskBalanceConfirmed,
    taskOverrideReason,
    setTaskOverrideReason,
    taskCommentDrafts,
    setTaskCommentDrafts,
    taskCommentBusyId,
    setTaskCommentBusyId,
    taskBusy,
    setTaskBusy,
    now,
    setNow,
    calendarMonth,
    setCalendarMonth,
    selectedCalendarDay,
    setSelectedCalendarDay,
    selectedSettingsCourse,
    settingsYears,
    settingsSemesters,
    handleSettingsSubmit,
    handlePasswordSubmit,
    submitGroupSubmission,
    courseOptions,
    welcomeName,
    dashboardError,
    reloadDashboard,
    refreshGroups,
    avatarInitials,
    greeting,
    activeGroupsCount,
    searchText,
    visibleUnits,
    searchResults,
    visibleGroups,
    assignmentsDueCount,
    completedWorkCount,
    completionRatePercentage,
    deadlineByDay,
    selectedDayTasks,
    upcomingTasks,
    openCreateModal,
    openJoinModal,
    handleCreateSubmit,
    handleInviteInputChange,
    handleJoinSubmit,
    openGroupTasks,
    openGroupDetails,
    openReferencedTask,
    openChatTaskAssignment,
    openTaskModal,
    taskPreviewWarning,
    taskTooEarlyToJudge,
    handleTaskSubmit,
    handleTaskCommentSubmit,
    handleTaskStatusChange,
    handleDeleteGroup,
    handleLeaveGroup,
    taskTree,
  };
}

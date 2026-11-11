import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api';
import { Button, Calendar, Table } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  CircleHelp,
  Copy,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
  UsersRound,
} from 'lucide-react';

import Chat from './Chat';

const API = {
  studentDashboard: '/api/accounts/dashboard/student/',
  notifications: '/api/accounts/notifications/',
  createGroup: '/api/accounts/groups/create/',
  joinGroup: '/api/accounts/groups/join/'
};

function getStoredToken() {
  return localStorage.getItem('access_token');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pluralize(count, noun) {
  return `${count} ${noun}${Number(count) === 1 ? '' : 's'}`;
}

function timeAgo(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function safeDate(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date) {
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatISODateOnly(d) {
  const dt = safeDate(d);
  if (!dt) return null;
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const StudentDashboard = () => {
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

  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('create');
  const [error, setError] = useState(''); // kept (eslint in this project flags unused vars)

  const [activeTab, setActiveTab] = useState('dashboard');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!submissionGroupId && groups.length) setSubmissionGroupId(String(groups[0].id));
  }, [groups, submissionGroupId]);

  useEffect(() => {
    if (activeTab !== 'submissions' || !submissionGroupId) return undefined;
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
  }, [activeTab, submissionGroupId]);

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
    if (h < 12) return `Good morning, ${welcomeName} ✨`;
    if (h < 18) return `Good afternoon, ${welcomeName} ✨`;
    return `Good evening, ${welcomeName} ✨`;
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
    setTaskWorkspaceLoading(true);
    setActivityLoading(true);
    setTaskWorkspaceError('');
    try {
      const token = getStoredToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [detailsResponse, balanceResponse, activityResponse, commentsResponse] = await Promise.all([
        axios.get(`/api/accounts/groups/${group.id}/workspace/`, { headers }),
        axios.get(`/api/accounts/groups/${group.id}/balance/`, { headers }),
        axios.get(`/api/accounts/groups/${group.id}/activity/`, { headers }),
        axios.get(`/api/accounts/groups/${group.id}/comments/`, { headers }),
      ]);
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
    if (!group?.is_leader || !window.confirm(`Delete “${group.name}” and its group chat? This cannot be undone.`)) return;
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
    if (!window.confirm(`Leave “${group.name}”? You will need its join code to come back.`)) return;
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

  const renderTaskTree = (task, depth = 0) => (
    <article id={`task-${task.id}`} key={task.id} className="space-y-2">
      <div className={`rounded-lg border bg-white p-3 ${task.is_overdue ? 'border-red-300' : 'border-[#D7DEE6]'} ${depth ? 'ml-4' : ''}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {depth > 0 && <span className="rounded bg-[#E4E9EF] px-1.5 py-0.5 text-[9px] font-semibold text-[#435B76]">MICRO-TASK</span>}
              <h4 className="text-sm font-bold text-[#29384A]">{task.title}</h4>
              <span className="rounded px-2 py-0.5 text-[9px] font-semibold capitalize text-[#435B76] bg-[#EEF1F4]">{String(task.status).replaceAll('_', ' ')}</span>
              {task.is_overdue && <span className="rounded bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">Overdue</span>}
            </div>
            {task.description && <p className="mt-1 text-xs text-[#718094]">{task.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#718094]">
              <span>Owner: {task.assigned_to_name}</span>
              <span>Weight: {task.weight}</span>
              <span className={task.is_overdue ? 'font-bold text-red-700' : ''}>{task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString()}` : 'No due date'}</span>
              {task.completed_at && <span>Completed {new Date(task.completed_at).toLocaleDateString()}</span>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E4E9EF]">
                <div className="h-full rounded-full bg-[#4A6079] transition-all" style={{ width: `${Math.min(100, task.progress_percentage || 0)}%` }} />
              </div>
              <span className="w-9 text-right text-[10px] font-semibold text-[#435B76]">{task.progress_percentage || 0}%</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {task.is_parent && <button type="button" onClick={() => openTaskModal('create', null, task.id)} className="rounded-md border border-[#CBD5E1] px-2.5 py-2 text-[10px] font-semibold text-[#354B63] hover:bg-[#EEF1F4]">+ Micro-task</button>}
            {!task.is_parent && task.can_update_progress && (
              <select
                aria-label={`Update status for ${task.title}`}
                value={task.status}
                onChange={(event) => handleTaskStatusChange(task, event.target.value)}
                className="max-w-36 rounded-md border border-[#D7DEE6] bg-white px-2 py-2 text-[10px] capitalize text-[#354B63]"
              >
                {['pending', 'in_progress', 'completed'].map((status) => <option key={status} value={status}>{status === 'in_progress' ? 'In progress' : status === 'pending' ? 'Pending' : 'Completed'}</option>)}
              </select>
            )}
            {!task.is_parent && <button type="button" onClick={() => openTaskModal('reassign', task)} className="rounded-md border border-[#CBD5E1] px-2.5 py-2 text-[10px] font-semibold text-[#354B63] hover:bg-[#EEF1F4]">Reassign</button>}
          </div>
        </div>
      </div>
      <section className={`rounded-lg bg-white p-3 ${depth ? 'ml-4' : ''}`} aria-label={`Comments on ${task.title}`}>
        {groupComments.filter((comment) => Number(comment.task_id) === Number(task.id)).length ? (
          <ul className="mb-3 space-y-2">
            {groupComments.filter((comment) => Number(comment.task_id) === Number(task.id)).map((comment) => (
              <li key={comment.id} className="border-l-2 border-[#D7DEE6] pl-2.5">
                <p className="whitespace-pre-wrap text-xs text-[#354B63]">{comment.content}</p>
                <p className="mt-0.5 text-[9px] text-[#718094]">{comment.author_name}{comment.author_type === 'lecturer' ? ' · Lecturer' : ''} · {timeAgo(comment.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mb-2 text-[10px] text-[#8895A5]">No comments yet.</p>}
        <form onSubmit={(event) => handleTaskCommentSubmit(event, task)} className="flex items-end gap-2">
          <textarea rows={1} required value={taskCommentDrafts[task.id] || ''} onChange={(event) => setTaskCommentDrafts((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Add a comment…" aria-label={`Add a comment to ${task.title}`} className="min-h-9 flex-1 resize-y rounded-md border border-[#D7DEE6] px-2.5 py-2 text-xs text-[#354B63] outline-none focus:border-[#7189A3]" />
          <button type="submit" disabled={taskCommentBusyId === task.id || !String(taskCommentDrafts[task.id] || '').trim()} className="rounded-md bg-[#35475C] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50">{taskCommentBusyId === task.id ? 'Adding…' : 'Add'}</button>
        </form>
      </section>
      {task.children.length > 0 && <div className="space-y-2 border-l-2 border-[#CBD5E1] pl-2">{task.children.map((child) => renderTaskTree(child, depth + 1))}</div>}
    </article>
  );

  if (loading) {
    return (
      <div role="status" className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#E2E8F0] text-[#35475C]">
        <div aria-hidden="true" className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4A6079]" />
        <p className="text-sm">Loading your workspace…</p>
      </div>
    );
  }

  return (
    <div data-dashboard-theme="school" className="min-h-screen bg-[#E2E8F0] flex flex-col lg:flex-row text-[#29384A] font-sans antialiased selection:bg-[#D7DEE6] tracking-normal">
      
      {/* 🏛️ ARCHITECTURAL SIDEBAR NAVIGATION */}
      <aside className="w-full shrink-0 bg-[#35475C] text-white flex flex-col lg:justify-between lg:fixed lg:inset-y-0 lg:left-0 lg:h-full lg:w-64 z-30 px-4 py-3 lg:p-5 shadow-[4px_0_24px_rgba(53,71,92,0.10)]">
        <div>
          <div className="flex items-center px-2 py-1 lg:py-3">
            <div className="leading-tight">
              <div className="font-bold text-white text-base">GroupHub</div>
              <p className="text-[10px] text-[#CBD5E1] font-medium mt-0.5">Student workspace</p>
            </div>
          </div>

          <nav className="mt-3 lg:mt-8 grid grid-cols-3 gap-1 lg:block lg:space-y-1">
            <p className="hidden lg:block text-[10px] font-semibold text-[#CBD5E1] uppercase tracking-widest px-3 mb-2">Workspace</p>
            {[
              { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
              { id: 'groups', label: 'Groups', icon: UsersRound, badge: activeGroupsCount },
              { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
              { id: 'submissions', label: 'Submissions', icon: FileText },
              { id: 'units', label: 'My units', icon: BookOpen },
              { id: 'chat', label: 'Messages', icon: MessageSquare },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'chat') setChatGroupId(null);
                }}
                className={`w-full min-w-0 px-2 py-2 lg:px-3 lg:py-2.5 rounded-lg text-[10px] lg:text-xs font-semibold flex items-center justify-center lg:justify-between transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#D7DEE6] text-[#35475C] shadow-sm'
                    : 'text-[#D7DEE6] hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <tab.icon size={16} strokeWidth={1.9} aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </div>
                {tab.badge ? (
                  <span className={`inline-flex min-w-5 justify-center text-[10px] px-1.5 py-0.5 rounded-md font-bold ${activeTab === tab.id ? 'bg-white text-[#35475C]' : 'bg-white/10 text-white'}`}>
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>

        {/* PROFILE ANCHOR FOOTER CONTAINER */}
        <div className="hidden lg:flex border-t border-white/15 pt-4 flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-[#D7DEE6]">
              {avatarInitials}
            </div>
            <div className="leading-tight truncate max-w-[140px]">
              <div className="text-xs font-semibold text-white truncate">{`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Student'}</div>
              <span className="text-[10px] text-[#CBD5E1]">{user?.year_of_study ? `Year ${user.year_of_study} · ` : ''}Student</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-semibold text-[#F4B7A8] hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* 🚀 CENTRAL OPERATIONAL VIEW WRAPPER */}
      <div className="flex-1 min-w-0 lg:pl-64 flex flex-col min-h-screen">
        
        {/* TOP INTERACTIVE DESKTOP BAR */}
        <header className="min-h-16 bg-white border-b border-[#D7DEE6] px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <label className="relative w-full max-w-[230px] shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-[#F8E3ED] text-[#A64F70]">
                <Search size={14} aria-hidden="true" />
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search GroupHub"
                aria-label="Search groups and tasks"
                aria-controls="dashboard-search-results"
                aria-expanded={Boolean(searchText)}
                className="h-9 w-full rounded-lg border border-[#E6E9E7] bg-[#FAFBFA] pl-11 pr-3 text-xs text-[#29384A] outline-none focus:border-[#4A6079]"
              />
              {searchText && (
                <div id="dashboard-search-results" role="listbox" className="absolute left-0 top-full z-50 mt-2 max-h-80 w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[#D7DEE6] bg-white p-1.5 shadow-xl">
                  {searchResults.length ? searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      role="option"
                      onClick={() => {
                        setActiveTab(result.tab);
                        setSearchQuery('');
                      }}
                      className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-[#EEF1F4]"
                    >
                      <span className="text-xs font-semibold text-[#29384A]">{result.label}</span>
                      <span className="mt-0.5 text-[10px] text-[#718094]">{result.detail}</span>
                    </button>
                  )) : (
                    <p className="px-3 py-3 text-xs text-[#718094]">No groups, tasks, or units match “{searchQuery}”.</p>
                  )}
                </div>
              )}
            </label>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => { setNotificationsOpen(!notificationsOpen); setAvatarOpen(false); }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#35475C] text-white hover:bg-[#435B76]"
              >
                <Bell size={16} aria-hidden="true" />
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg border border-[#D7DEE6] bg-white p-4 shadow-lg">
                  <p className="text-xs font-semibold text-[#29384A]">Notifications</p>
                  <p className="mt-2 text-xs text-[#718094]">You’re all caught up.</p>
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setActiveTab('settings')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#35475C] text-white hover:bg-[#435B76]"
            >
              <Settings size={16} aria-hidden="true" />
            </button>
            <div className="relative">
            <button
              type="button"
              aria-label="Profile"
              aria-expanded={avatarOpen}
              onClick={() => { setAvatarOpen(!avatarOpen); setNotificationsOpen(false); }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#35475C] text-white hover:bg-[#435B76]"
            >
              <span className="text-[10px] font-bold">{avatarInitials}</span>
            </button>
            {avatarOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-[#D7DEE6] rounded-lg shadow-lg p-4 z-40">
                <p className="text-xs font-semibold text-[#29384A] truncate">{`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Student'}</p>
                <p className="text-[10px] text-[#718094] truncate mt-1">{academic?.course_name || user?.course || ''}</p>
                <p className="text-[10px] text-[#718094] mt-1 truncate">{user?.email || ''}</p>
                <button type="button" onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#A54136]">
                  <LogOut size={14} aria-hidden="true" /> Sign out
                </button>
              </div>
            )}
            </div>
          </div>
        </header>

        {/* COMPONENT VIEW CONTEXT SYSTEM */}
        <div className="flex-1 p-4 sm:p-6 xl:p-8 bg-[#E2E8F0]">
          {error ? <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"><span>{error}</span><button type="button" onClick={() => window.location.reload()} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100">Retry</button></div> : null}
          {activeTab === 'chat' ? (
            <div className="bg-white rounded-2xl border border-stone-200/50 p-6 min-h-[calc(100vh-140px)] shadow-sm">
              <Chat
                onCreateGroup={openCreateModal}
                onGroupDeleted={(groupId) => setGroups((current) => current.filter((group) => group.id !== groupId))}
                groupRefreshKey={groups.length}
                groupId={chatGroupId}
                onTaskReference={(taskId, groupId) => openReferencedTask(taskId, groupId)}
                onAssignTask={openChatTaskAssignment}
                groupTasks={chatGroupId === selectedTaskGroup?.id ? taskWorkspace?.tasks : selectedGroupDetail?.id === chatGroupId ? groupDetailWorkspace?.tasks : []}
              />
            </div>
          ) : activeTab === 'settings' ? (
            <div className="max-w-3xl space-y-6">
              <div className="border-b border-[#D7DEE6] pb-4">
                <h2 className="text-xl font-semibold text-[#35475C]">Settings</h2>
                <p className="mt-1 text-sm text-[#718094]">Update your account and academic details.</p>
              </div>

              {settingsLoading ? <p role="status" className="rounded-lg border border-[#D7DEE6] bg-white p-6 text-sm text-[#596579]">Loading account settings…</p> : null}
              {settingsLoadError && !settingsLoading ? <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700"><span>{settingsLoadError}</span><button type="button" onClick={() => setSettingsLoadKey((key) => key + 1)} className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50">Retry</button></div> : null}
              {!settingsLoading && !settingsLoadError ? <form onSubmit={handleSettingsSubmit} className="space-y-5 rounded-lg border border-[#D7DEE6] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#35475C]">Personal and academic details</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[#435B76]">
                    First name
                    <input required value={settingsForm.first_name} onChange={(event) => setSettingsForm((current) => ({ ...current, first_name: event.target.value }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76]">
                    Last name
                    <input value={settingsForm.last_name} onChange={(event) => setSettingsForm((current) => ({ ...current, last_name: event.target.value }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76] sm:col-span-2">
                    Programme
                    <select value={settingsForm.course_id} onChange={(event) => setSettingsForm((current) => ({ ...current, course_id: event.target.value, year_of_study: '', semester: '' }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]">
                      <option value="">Select programme</option>
                      {settingsCatalog.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76]">
                    Year of study
                    <select value={settingsForm.year_of_study} disabled={!settingsForm.course_id} onChange={(event) => setSettingsForm((current) => ({ ...current, year_of_study: event.target.value, semester: '' }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3] disabled:bg-[#EEF1F4]">
                      <option value="">Select year</option>
                      {settingsYears.map((year) => <option key={year} value={year}>Year {year}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76]">
                    Semester
                    <select value={settingsForm.semester} disabled={!settingsForm.year_of_study} onChange={(event) => setSettingsForm((current) => ({ ...current, semester: event.target.value }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3] disabled:bg-[#EEF1F4]">
                      <option value="">Select semester</option>
                      {settingsSemesters.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
                    </select>
                  </label>
                </div>
                {settingsError && <p role="alert" className="text-xs font-medium text-red-700">{settingsError}</p>}
                {settingsMessage && <p role="status" className="text-xs font-medium text-[#435B76]">{settingsMessage}</p>}
                <div className="flex justify-end border-t border-[#E4E9EF] pt-4">
                  <button type="submit" disabled={settingsBusy} className="rounded-md bg-[#35475C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4A6079] disabled:opacity-50">{settingsBusy ? 'Saving…' : 'Save settings'}</button>
                </div>
              </form> : null}

              {!settingsLoading && !settingsLoadError ? <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-lg border border-[#D7DEE6] bg-white p-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#35475C]">Change password</h3>
                  <p className="mt-1 text-xs text-[#718094]">Use your current password to confirm the change.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    ['current_password', 'Current password'],
                    ['new_password', 'New password'],
                    ['confirm_password', 'Confirm new password'],
                  ].map(([field, label]) => (
                    <label key={field} className="block text-xs font-semibold text-[#435B76]">
                      {label}
                      <input type="password" required autoComplete="new-password" value={passwordForm[field]} onChange={(event) => setPasswordForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
                    </label>
                  ))}
                </div>
                {passwordError && <p role="alert" className="text-xs font-medium text-red-700">{passwordError}</p>}
                {passwordMessage && <p role="status" className="text-xs font-medium text-[#435B76]">{passwordMessage}</p>}
                <div className="flex justify-end border-t border-[#E4E9EF] pt-4">
                  <button type="submit" disabled={passwordBusy} className="rounded-md border border-[#CBD5E1] bg-[#EEF1F4] px-4 py-2.5 text-xs font-semibold text-[#354B63] hover:bg-[#E4E9EF] disabled:opacity-50">{passwordBusy ? 'Updating…' : 'Update password'}</button>
                </div>
              </form> : null}
            </div>
          ) : activeTab === 'group-detail' ? (
            <section className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D7DEE6] pb-4">
                <div>
                  <button type="button" onClick={() => setActiveTab('groups')} className="mb-2 text-xs font-semibold text-[#4A6079] hover:underline">← Your groups</button>
                  <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-[#29384A]">{selectedGroupDetail?.name || 'Group'}</h2>{selectedGroupDetail?.is_leader && <span className="rounded-md bg-[#EEF1F4] px-2 py-1 text-[10px] font-semibold text-[#4A6079]">Leader</span>}</div>
                  <p className="mt-1 text-xs text-[#718094]">{selectedGroupDetail?.unit_code ? `${selectedGroupDetail.unit_code}${selectedGroupDetail.unit_name ? ` · ${selectedGroupDetail.unit_name}` : ''}` : selectedGroupDetail?.course || 'Group workspace'}</p>
                </div>
                {groupDetailWorkspace?.group?.join_code && <div className="flex items-center gap-3 rounded-md border border-[#D7DEE6] bg-white px-3 py-2"><div><span className="block text-[9px] font-semibold uppercase text-[#718094]">Join code</span><code className="text-sm font-bold tracking-widest text-[#4A6079]">{groupDetailWorkspace.group.join_code}</code></div><button type="button" title="Copy join code" aria-label="Copy join code" onClick={() => navigator.clipboard?.writeText(groupDetailWorkspace.group.join_code)} className="flex h-8 w-8 items-center justify-center rounded-md text-[#718094] hover:bg-[#EEF1F4]"><Copy size={15} aria-hidden="true" /></button></div>}
              </div>
              {groupDetailLoading ? <p className="rounded-lg border border-[#D7DEE6] bg-white p-8 text-center text-sm text-[#718094]">Loading group…</p> : groupDetailError ? <p role="alert" className="rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700">{groupDetailError}</p> : groupDetailWorkspace ? (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <section className="rounded-lg border border-[#D7DEE6] bg-white p-4"><h3 className="text-xs font-semibold text-[#718094]">Project progress</h3><p className="mt-2 text-2xl font-bold text-[#29384A]">{groupDetailWorkspace.project_progress}%</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E4E9EF]"><div className="h-full rounded-full bg-[#4A6079]" style={{ width: `${groupDetailWorkspace.project_progress}%` }} /></div><p className="mt-1 text-[10px] capitalize text-[#718094]">{String(groupDetailWorkspace.project_status || 'planning').replaceAll('_', ' ')}</p></section>
                    <section className="rounded-lg border border-[#D7DEE6] bg-white p-4"><h3 className="text-xs font-semibold text-[#718094]">Members</h3><p className="mt-2 text-2xl font-bold text-[#29384A]">{groupDetailWorkspace.members.length}{groupDetailWorkspace.group.max_members ? <span className="text-sm font-medium text-[#718094]"> / {groupDetailWorkspace.group.max_members}</span> : null}</p><p className="mt-1 text-[10px] text-[#718094]">Working in this group</p></section>
                    <section className="rounded-lg border border-[#D7DEE6] bg-white p-4"><h3 className="text-xs font-semibold text-[#718094]">Next deadline</h3><p className="mt-2 text-sm font-bold text-[#29384A]">{groupDetailWorkspace.group.next_deadline ? new Date(groupDetailWorkspace.group.next_deadline).toLocaleString() : 'No upcoming deadline'}</p><p className="mt-1 text-[10px] text-[#718094]">From a project or task</p></section>
                  </div>
                  <section className="rounded-lg border border-[#D7DEE6] bg-white p-5"><h3 className="text-sm font-semibold text-[#29384A]">Group members</h3><div className="mt-3 flex flex-wrap gap-2">{groupDetailWorkspace.members.map((member) => <span key={member.id} className="rounded-md bg-[#EEF1F4] px-3 py-2 text-xs font-medium text-[#4A6079]">{member.name}{member.is_leader ? ' · Leader' : ''}</span>)}</div></section>
                  <section className="rounded-lg border border-[#D7DEE6] bg-white p-5">
                    <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-[#29384A]">Lecturer comments</h3><p className="mt-1 text-[10px] text-[#718094]">Updates refresh automatically.</p></div>{groupCommentsLoading && <span className="text-[10px] text-[#718094]">Checking…</span>}</div>
                    {groupCommentsError ? <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-4 text-sm text-red-800">{groupCommentsError} Updates will be checked again shortly.</p> : groupComments.length ? <ol className="mt-3 space-y-3">{groupComments.map((comment) => <li key={comment.id} className="border-l-2 border-[#CBD5E1] pl-3"><p className="text-xs leading-5 text-[#354B63]">{comment.content}</p><p className="mt-1 text-[10px] text-[#718094]">{comment.author_name} · {comment.task_title} · {timeAgo(comment.created_at)}</p></li>)}</ol> : <p className="mt-3 rounded-md bg-[#E2E8F0] px-3 py-5 text-center text-xs text-[#718094]">{groupCommentsLoading ? 'Loading comments…' : 'No lecturer comments yet.'}</p>}
                  </section>
                  <section className="space-y-3"><h3 className="text-sm font-semibold text-[#29384A]">Group chat</h3><Chat key={`group-${selectedGroupDetail.id}`} groupId={selectedGroupDetail.id} groupTasks={groupDetailWorkspace.tasks} onCreateGroup={() => openCreateModal()} onTaskReference={openReferencedTask} onAssignTask={openChatTaskAssignment} /></section>
                </>
              ) : null}
            </section>
          ) : activeTab === 'tasks' ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-stone-200/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#1C1C1E] dark:text-stone-100">Group Tasks</h2>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">Weighted assignments and current workload by member.</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-stone-300">
                  <span>Group</span>
                  <select
                    value={selectedTaskGroup?.id || ''}
                    onChange={(event) => {
                      const group = groups.find((item) => String(item.id) === event.target.value);
                      if (group) openGroupTasks(group);
                    }}
                    className="min-w-44 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-[#1C1C1E] dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                  >
                    <option value="" disabled>Select a group</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
              </div>

              {!selectedTaskGroup && groups.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => openGroupTasks(group)}
                      className="rounded-xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900"
                    >
                      <span className="text-[10px] font-bold uppercase text-stone-400">{group.course || 'Group'}</span>
                      <span className="mt-1 block text-sm font-bold text-[#1C1C1E] dark:text-stone-100">{group.name}</span>
                    </button>
                  ))}
                </div>
              ) : taskWorkspaceLoading ? (
                <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">Loading group tasks…</div>
              ) : taskWorkspace ? (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#354B63]">{taskWorkspace.group?.project_title || taskWorkspace.group?.name || selectedTaskGroup.name}</h3>
                        <p className="text-xs text-[#718094]">{pluralize(safeArray(taskWorkspace.tasks).length, 'task')} · Project {taskWorkspace.project_status || 'planning'} · {taskWorkspace.project_progress || 0}% complete</p>
                        <div className="mt-2 h-2 w-52 max-w-full overflow-hidden rounded-full bg-[#E4E9EF]">
                          <div className="h-full rounded-full bg-[#4A6079] transition-all" style={{ width: `${Math.min(100, taskWorkspace.project_progress || 0)}%` }} />
                        </div>
                      </div>
                      {taskTree.length ? <button
                        type="button"
                        onClick={() => openTaskModal('create')}
                        className="rounded-lg bg-[#1C1C1E] px-3 py-2 text-xs font-bold text-white hover:opacity-90 dark:bg-stone-100 dark:text-stone-900"
                      >
                        + Create task
                      </button> : null}
                    </div>
                    {taskTree.length ? taskTree.map((task) => renderTaskTree(task)) : (
                      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-900"><p className="text-sm font-medium text-[#354B63]">No tasks yet.</p><button type="button" onClick={() => openTaskModal('create')} className="mt-3 rounded-md bg-[#35475C] px-4 py-2 text-xs font-semibold text-white">Create a task</button></div>
                    )}
                  </section>

                  <section className="h-fit rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#354B63]">Workload balance</h3>
                        <p className="mt-1 text-[10px] text-stone-500 dark:text-stone-400">Weighted task points by assignee</p>
                        <button type="button" title="Each task has a weight from 1 to 5. A member’s share is their assigned points divided by the group’s total points." aria-label="How is this calculated? Each task has a weight from 1 to 5. A member’s share is their assigned points divided by the group’s total points." className="mt-1 inline-flex items-center gap-1 text-[10px] text-stone-500 hover:text-stone-800"><CircleHelp size={12} aria-hidden="true" /> How is this calculated?</button>
                      </div>
                      <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-300">{pluralize(taskBalance?.total_points || 0, 'point')}</span>
                    </div>
                    <div className="space-y-4">
                      {safeArray(taskBalance?.members).map((member) => {
                        const level = member.warning_level || 'ok';
                        const fillColor = level === 'too_early' ? '#9CA3AF' : level === 'critical' ? '#C64F5D' : level === 'warning' ? '#D69A32' : '#4A6079';
                        const levelLabel = level === 'too_early' ? 'Too early to judge' : level === 'critical' ? 'Critical' : level === 'warning' ? 'Warning' : 'OK';
                        return (
                          <div key={member.user_id}>
                            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                              <span className="truncate font-bold text-[#1C1C1E] dark:text-stone-100">{member.name}</span>
                              <span className="shrink-0 font-semibold text-stone-600 dark:text-stone-300">{Number(member.share_percent).toFixed(1)}% · {pluralize(member.points_assigned, 'point')}</span>
                            </div>
                            <p className="mb-1 text-[10px] text-stone-500">{pluralize(member.points_assigned, 'point')} assigned · {pluralize(member.points_completed, 'point')} completed · {pluralize(member.tasks_completed, 'task')} completed · {Number(member.on_time_rate || 0).toFixed(0)}% on time</p>
                            <div className="relative h-3 rounded-full bg-stone-100 dark:bg-stone-700" aria-label={`${member.name}: ${Number(member.share_percent).toFixed(1)} percent share, ${levelLabel}`}>
                              <div className="dashboard-workload-fill h-full rounded-full transition-all" style={{ width: `${Math.min(100, Number(member.share_percent || 0))}%`, backgroundColor: fillColor }} />
                              <span className="absolute -top-1 h-5 w-0.5 bg-[#1C1C1E] dark:bg-white" style={{ left: `${Math.min(100, Number(member.fair_share || 0))}%` }} aria-hidden="true" />
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400">
                              <span>{level === 'too_early' ? 'Too early to judge' : level === 'critical' ? '● Critical' : level === 'warning' ? '▲ Warning' : '✓ OK'}</span>
                              <span>Fair share {Number(member.fair_share).toFixed(1)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {taskBalance?.suggestion && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[10px] text-amber-900">{taskBalance.suggestion}</p>}
                    {Number(taskBalance?.total_points || 0) < 6 && <p className="mt-2 text-[10px] font-semibold text-stone-500">Too early to judge the group balance below 6 points.</p>}
                    <p className="mt-4 border-t border-stone-100 pt-3 text-[10px] text-stone-500 dark:border-stone-700 dark:text-stone-400">Vertical marker indicates the fair-share target.</p>
                  </section>
                  <section className="h-fit rounded-xl border border-[#D7DEE6] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-[#354B63]">Activity</h3>
                        <p className="mt-1 text-[10px] text-[#718094]">Recent changes in this group</p>
                      </div>
                      {activityLoading && <span className="text-[10px] text-[#718094]">Loading…</span>}
                    </div>
                    {groupActivity.length ? (
                      <ol className="space-y-3">
                        {groupActivity.map((item) => {
                          let sentence;
                          if (item.action === 'reassigned') sentence = `${item.actor_name} reassigned ${item.task_title}${item.to_user_name ? ` to ${item.to_user_name}` : ''}`;
                          else if (item.action === 'assigned') sentence = `${item.actor_name} assigned ${item.task_title}${item.to_user_name ? ` to ${item.to_user_name}` : ''}`;
                          else if (item.action === 'completed') sentence = `${item.actor_name} completed ${item.task_title}`;
                          else if (item.action === 'started') sentence = `${item.actor_name} started ${item.task_title}`;
                          else sentence = `${item.actor_name} created ${item.task_title}`;
                          return <li key={item.id} className="border-l-2 border-[#D7DEE6] pl-3"><p className="text-xs text-[#354B63]">{sentence}</p><time className="mt-0.5 block text-[10px] text-[#718094]">{timeAgo(item.created_at)}</time></li>;
                        })}
                      </ol>
                    ) : (
                      <p className="rounded-md bg-[#F3F5F7] px-3 py-5 text-center text-xs text-[#718094]">{activityLoading ? 'Loading activity…' : 'No activity yet. Task updates will appear here.'}</p>
                    )}
                  </section>
                </div>
              ) : !selectedTaskGroup ? (
                <div className="rounded-xl border border-dashed border-[#D7DEE6] bg-white p-8 text-center"><p className="text-sm font-medium text-[#354B63]">No groups yet.</p><button type="button" onClick={() => setActiveTab('groups')} className="mt-3 rounded-md bg-[#35475C] px-4 py-2 text-xs font-semibold text-white">Browse groups</button></div>
              ) : (
                <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">{taskWorkspaceError || 'Unable to load this group’s tasks.'}<button type="button" onClick={() => openGroupTasks(selectedTaskGroup)} className="ml-3 rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800">Retry</button></div>
              )}
              {taskWorkspaceError && taskWorkspace ? <p role="alert" className="text-xs font-semibold text-red-600">{taskWorkspaceError}</p> : null}
            </div>
          ) : activeTab === 'submissions' ? (
            <section className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-[#D7DEE6] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#35475C]">Submissions</h2>
                  <p className="mt-1 text-sm text-[#718094]">Submit your group’s work and review previous submissions.</p>
                </div>
                <label className="text-xs font-semibold text-[#435B76]">Group
                  <select value={submissionGroupId || groups[0]?.id || ''} onChange={(event) => setSubmissionGroupId(event.target.value)} className="ml-2 min-w-48 rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#29384A]">
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
              </div>
              {!groups.length ? (
                <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-8 text-center"><p className="text-sm text-[#596579]">Join a group before submitting project work.</p><button type="button" onClick={() => setActiveTab('groups')} className="mt-3 rounded-md bg-[#35475C] px-4 py-2 text-xs font-semibold text-white">Browse groups</button></div>
              ) : submissionsLoading ? (
                <p className="rounded-lg border border-[#D7DEE6] bg-white p-8 text-center text-sm text-[#718094]">Loading submissions…</p>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
                  <div className="space-y-5">
                    <form onSubmit={submitGroupSubmission} className="space-y-4 rounded-lg border border-[#D7DEE6] bg-white p-5">
                      <div><h3 className="text-sm font-semibold text-[#35475C]">Submit project work</h3><p className="mt-1 text-xs text-[#718094]">Add a GitHub link, proof, and optional screenshot.</p></div>
                      <label className="block text-xs font-semibold text-[#435B76]">GitHub link <span className="font-normal text-[#718094]">(optional)</span>
                        <input type="url" value={submissionForm.github_url} onChange={(event) => setSubmissionForm((current) => ({ ...current, github_url: event.target.value }))} placeholder="https://github.com/group/project" className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
                      </label>
                      <label className="block text-xs font-semibold text-[#435B76]">Proof of work
                        <textarea required rows={4} value={submissionForm.proof_text} onChange={(event) => setSubmissionForm((current) => ({ ...current, proof_text: event.target.value }))} placeholder="Describe what your group completed…" className="mt-1.5 w-full resize-y rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
                      </label>
                      <label className="block text-xs font-semibold text-[#435B76]">Screenshot <span className="font-normal text-[#718094]">(optional)</span>
                        <input id="submission-screenshot" type="file" accept="image/*" onChange={(event) => setSubmissionForm((current) => ({ ...current, screenshot: event.target.files?.[0] || null }))} className="mt-1.5 block w-full rounded-md border border-[#CBD5E1] bg-white p-2 text-xs text-[#435B76]" />
                      </label>
                      <label className="block text-xs font-semibold text-[#435B76]">Shared documents or photos <span className="font-normal text-[#718094]">(up to 5 files, 10 MB each)</span>
                        <input id="submission-attachments" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => setSubmissionForm((current) => ({ ...current, attachments: Array.from(event.target.files || []) }))} className="mt-1.5 block w-full rounded-md border border-[#CBD5E1] bg-white p-2 text-xs text-[#435B76]" />
                      </label>
                      {submissionError && <p role="alert" className="text-xs text-red-700">{submissionError}</p>}
                      {submissionMessage && <p role="status" className="text-xs text-[#435B76]">{submissionMessage}</p>}
                      <div className="flex justify-end border-t border-[#E4E9EF] pt-3"><button disabled={submissionBusy || !submissionForm.proof_text.trim()} className="rounded-md bg-[#35475C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4A6079] disabled:opacity-50">{submissionBusy ? 'Submitting…' : 'Submit work'}</button></div>
                    </form>
                    <section className="rounded-lg border border-[#D7DEE6] bg-white p-5">
                      <h3 className="text-sm font-semibold text-[#35475C]">Group submissions</h3>
                      <p className="mt-1 text-[10px] text-[#718094]">Visible to everyone in this group.</p>
                      <div className="mt-3 space-y-3">
                        {submissions.length ? submissions.map((submission) => (
                          <article key={submission.id} className="rounded-md border border-[#E4E9EF] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold text-[#354B63]">{submission.project_title}</h4><span className="rounded-full bg-[#E4E9EF] px-2.5 py-1 text-[10px] font-semibold capitalize text-[#435B76]">{submission.status}</span></div>
                            <p className="mt-1 text-[10px] text-[#718094]">Submitted by {submission.submitted_by_name} · {new Date(submission.submitted_at).toLocaleDateString()}</p>
                            <p className="mt-2 whitespace-pre-wrap text-xs text-[#435B76]">{submission.proof_text}</p>
                            {submission.github_url && <a href={submission.github_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-[#435B76] underline">Open GitHub link</a>}
                            {submission.screenshot_url && <a href={submission.screenshot_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-medium text-[#435B76] underline">View screenshot</a>}
                            {safeArray(submission.attachments).map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-medium text-[#435B76] underline">Open {attachment.name}</a>)}
                            {submission.feedback && <p className="mt-2 rounded bg-[#F3F5F7] p-2 text-xs text-[#435B76]">Feedback: {submission.feedback}</p>}
                          </article>
                        )) : <p className="rounded-md bg-[#F3F5F7] px-3 py-6 text-center text-xs text-[#718094]">No submissions yet for this group.</p>}
                      </div>
                    </section>
                  </div>
                  <aside className="h-fit rounded-lg border border-[#D7DEE6] bg-white p-5">
                    <h3 className="text-sm font-semibold text-[#35475C]">Contribution share</h3>
                    <p className="mt-1 text-xs text-[#718094]">Task weight currently assigned to each group member.</p>
                    <div className="mt-4 space-y-4">
                      {safeArray(submissionBalance?.members).map((member) => (
                        <div key={member.user_id}>
                          <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-medium text-[#354B63]">{member.name}</span><span className="shrink-0 text-[#718094]">{Number(member.share_percent).toFixed(1)}%</span></div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#E4E9EF]"><div className="h-full rounded-full bg-[#4A6079]" style={{ width: `${Math.min(100, Number(member.share_percent || 0))}%` }} /></div>
                        </div>
                      ))}
                      {!submissionBalance?.members?.length && <p className="rounded-md bg-[#F3F5F7] p-3 text-xs text-[#718094]">Contribution shares appear once tasks have weights and owners.</p>}
                    </div>
                  </aside>
                </div>
              )}
            </section>
          ) : activeTab === 'units' ? (
            <section className="space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-[#D7DEE6] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#29384A]">My units</h2>
                  <p className="mt-1 text-xs text-[#718094]">
                    {academic ? `${academic.course_name} · Year ${academic.year_of_study} · Semester ${academic.semester}` : 'Your current academic enrollment.'}
                  </p>
                </div>
                <button type="button" onClick={() => openCreateModal()} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#4A6079] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} aria-hidden="true" /> Create group</button>
              </div>
              {visibleUnits.length ? (
                <Table
                  rowKey="id"
                  dataSource={visibleUnits}
                  pagination={false}
                  scroll={{ x: 560 }}
                  columns={[
                    {
                      title: 'Unit code',
                      dataIndex: 'code',
                      key: 'code',
                      width: 140,
                      render: (code) => <span className="font-mono text-xs font-semibold text-[#4A6079]">{code}</span>,
                    },
                    {
                      title: 'Unit name',
                      dataIndex: 'name',
                      key: 'name',
                      render: (name) => <span className="text-sm font-medium capitalize text-[#29384A]">{name}</span>,
                    },
                    {
                      title: 'Group',
                      key: 'group',
                      render: (_, unit) => {
                        const unitGroup = groups.find((group) => String(group.unit_id) === String(unit.id));
                        return unitGroup ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-[#718094]">{unitGroup.name} · {pluralize(unitGroup.members_count || 0, 'member')}</span>
                            <button type="button" onClick={() => openGroupDetails(unitGroup)} className="rounded-md border border-[#D7DEE6] px-3 py-1.5 text-[10px] font-semibold text-[#4A6079] hover:bg-[#E2E8F0]">Open</button>
                          </div>
                        ) : <span className="text-xs font-semibold text-[#718094]">No group yet</span>;
                      },
                    },
                  ]}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-[#CBD5E1] bg-white px-5 py-10 text-center text-sm text-[#718094]">
                  {units.length ? 'No units match your search.' : 'No units are available for your current programme and semester.'}
                </p>
              )}
            </section>
          ) : activeTab === 'groups' ? (
                <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-[#D7DEE6] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#29384A]">Your groups</h2>
                  <p className="mt-1 text-xs text-[#718094]">Projects and classmates you work with.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openJoinModal()} className="inline-flex items-center gap-2 border border-[#D7DEE6] bg-white px-3 py-2 text-xs font-semibold text-[#29384A] rounded-lg">
                    Join a group
                  </button>
                  <button onClick={() => openCreateModal()} className="inline-flex items-center gap-2 bg-[#4A6079] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#35475C]">
                    <Plus size={14} aria-hidden="true" /> Create group
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleGroups.map((group) => (
                  <article key={group.id} className="relative rounded-lg border border-[#D7DEE6] bg-white p-5 hover:border-[#CBD5E1]">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => openGroupDetails(group)} className="min-w-0 flex-1 text-left">
                        <span className="text-[10px] font-semibold text-[#4A6079]">{group.unit_code ? `${group.unit_code}${group.unit_name ? ` · ${group.unit_name}` : ''}` : group.course || 'Group'}</span>
                        <span className="mt-2 flex items-center gap-2"><span className="text-sm font-semibold text-[#29384A]">{group.name}</span>{group.is_leader && <span className="shrink-0 rounded-md bg-[#EEF1F4] px-2 py-0.5 text-[9px] font-semibold text-[#4A6079]">Leader</span>}</span>
                        <span className="mt-1 block text-xs text-[#718094]">{pluralize(group.members_count || 0, 'member')}{group.max_members ? ` of ${group.max_members}` : ''} · {pluralize(group.projects?.length || 0, 'project')}</span>
                      </button>
                      <div className="relative shrink-0">
                        <button type="button" aria-label={`Group actions for ${group.name}`} aria-expanded={groupMenuId === group.id} onClick={() => setGroupMenuId((current) => current === group.id ? null : group.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-[#718094] hover:bg-[#E2E8F0]"><MoreHorizontal size={17} aria-hidden="true" /></button>
                        {groupMenuId === group.id && <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-[#D7DEE6] bg-white p-1 shadow-lg">{group.is_leader ? <button type="button" role="menuitem" onClick={() => handleDeleteGroup(group)} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 size={13} aria-hidden="true" /> Delete group</button> : <button type="button" role="menuitem" onClick={() => handleLeaveGroup(group)} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium text-[#435B76] hover:bg-[#E2E8F0]"><LogOut size={13} aria-hidden="true" /> Leave group</button>}</div>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-[#EEF1F4] px-3 py-2">
                      <div><span className="block text-[9px] font-semibold uppercase text-[#718094]">Join code</span><code className="text-xs font-bold tracking-widest text-[#4A6079]">{group.join_code}</code></div>
                      <button type="button" title="Copy join code" aria-label={`Copy join code for ${group.name}`} onClick={() => navigator.clipboard?.writeText(group.join_code || '')} className="flex h-8 w-8 items-center justify-center rounded-md text-[#718094] hover:bg-white"><Copy size={14} aria-hidden="true" /></button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => { setChatGroupId(group.id); setActiveTab('chat'); }} className="flex-1 rounded-md border border-[#D7DEE6] px-3 py-2 text-xs font-semibold text-[#29384A] hover:bg-[#E2E8F0]">Open chat</button>
                      <button type="button" onClick={() => { setActiveTab('tasks'); openGroupTasks(group); }} className="flex-1 rounded-md bg-[#35475C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#435B76]">View tasks</button>
                    </div>
                  </article>
                ))}
                {!visibleGroups.length && <p className="col-span-full rounded-lg border border-dashed border-[#CBD5E1] bg-white px-5 py-10 text-center text-sm text-[#718094]">{groups.length ? 'No groups match your search.' : 'You haven’t joined a group yet. Join with a code or create one to start collaborating.'}</p>}
              </div>
            </div>
          ) : (
            
            /* DYNAMIC HIGHER-END STUDIO MATRIX CORE COMPONENT VIEW */
            <div className="space-y-6">
              
              {/* TOP HEADER LABELS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D7DEE6] pb-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4A6079]">Student workspace</p>
                  <h2 className="mt-1 text-2xl font-bold text-[#29384A]">{greeting}</h2>
                  <p className="text-sm text-[#718094] mt-1">Your groups, coursework, and deadlines in one place.</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={openJoinModal} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-xs font-semibold text-[#29384A] hover:bg-[#E2E8F0]">
                    Join with code
                  </button>
                  <button type="button" onClick={() => openCreateModal()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4A6079] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#35475C]">
                    <Plus size={15} aria-hidden="true" /> Create group
                  </button>
                </div>
              </div>

              {/* 📊 ROW 1: THE FOUR SYMMETRICAL DYNAMIC ANALYTIC COUNTER CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'My groups', count: activeGroupsCount, meta: `${activeGroupsCount} joined`, icon: UsersRound, border: 'border-l-[#4A6079]', iconStyle: 'bg-[#E4E9EF] text-[#4A6079]' },
                  { label: 'Upcoming · 14 days', count: assignmentsDueCount, meta: 'Tasks due in the next 14 days', icon: Clock3, border: 'border-l-[#D89B32]', iconStyle: 'bg-[#FFF3D9] text-[#96620C]' },
                  { label: 'Completed tasks', count: completedWorkCount, meta: completionRatePercentage, icon: CheckCircle2, border: 'border-l-[#4C83B6]', iconStyle: 'bg-[#EAF2FA] text-[#3D6F9F]' },
                  { label: 'My programme', count: user?.year_of_study ? `Year ${user.year_of_study}` : '—', meta: academic?.course_name || user?.course || '', icon: BookOpen, border: 'border-l-[#C76E5B]', iconStyle: 'bg-[#F9ECE8] text-[#A64F3E]' }
                ].map((card, idx) => (
                  <div key={idx} className={`min-w-0 bg-white p-4 rounded-lg border border-[#D7DEE6] border-l-4 ${card.border} flex items-center justify-between gap-2`}>
                    <div>
                      <div className="text-xl font-bold text-[#29384A]">{card.count}</div>
                      <p className="text-xs text-[#435B76] font-semibold mt-1">{card.label}</p>
                      <span className="text-[10px] text-[#718094] mt-1 block truncate max-w-40">{card.meta}</span>
                    </div>
                    <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${card.iconStyle}`}>
                      <card.icon size={18} strokeWidth={1.9} aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>

              {/* ROW 2: ADVANCED SIDE-BY-SIDE WIDGET PLACEMENTS LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(230px,0.82fr)_minmax(0,1.8fr)] gap-5">
                
                {/* COLUMN ONE CONTENT (WIDGET LAYOUTS: TEXTURED MONTH NAVIGATION CONSOLE) */}
                <div className="space-y-4">
                  
                  {/* STUDIO TEXTURED CARD COMPACT CALENDAR */}
                  <div className="student-dashboard-calendar rounded-lg border border-[#DDE7E2] bg-white p-5">
                    <Calendar
                      fullscreen={false}
                      value={dayjs(calendarMonth)}
                      onPanelChange={(date) => setCalendarMonth(date.toDate())}
                      headerRender={({ value, onChange }) => (
                        <div className="flex items-center justify-between px-2 pb-3">
                          <span className="font-medium">{value.format('MMMM YYYY')}</span>
                          <div className="flex gap-1">
                            <Button
                              onClick={() => {
                                const today = dayjs();
                                onChange(today);
                                setCalendarMonth(today.toDate());
                                setSelectedCalendarDay(null);
                              }}
                              size="small"
                              type="link"
                            >
                              Today
                            </Button>
                            <Button
                              aria-label="Previous month"
                              icon={<LeftOutlined />}
                              onClick={() => onChange(value.subtract(1, 'month'))}
                              size="small"
                              type="text"
                            />
                            <Button
                              aria-label="Next month"
                              icon={<RightOutlined />}
                              onClick={() => onChange(value.add(1, 'month'))}
                              size="small"
                              type="text"
                            />
                          </div>
                        </div>
                      )}
                      onSelect={(date) => {
                        const dateKey = date.format('YYYY-MM-DD');
                        setCalendarMonth(date.toDate());
                        setSelectedCalendarDay(deadlineByDay.has(dateKey) ? dateKey : null);
                      }}
                    />
                    {selectedCalendarDay && (
                      <div className="mt-4 border-t border-[#D7DEE6] pt-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-[#29384A]">Tasks for {new Date(`${selectedCalendarDay}T00:00:00`).toLocaleDateString()}</h4>
                          <button type="button" onClick={() => setSelectedCalendarDay(null)} className="text-[10px] font-medium text-[#4A6079]">Clear</button>
                        </div>
                        {selectedDayTasks.length ? <ul className="space-y-2">{selectedDayTasks.map((task) => <li key={task.id} className={`rounded-md px-3 py-2 ${task.is_overdue ? 'bg-red-50 text-red-800' : 'bg-[#E2E8F0] text-[#354B63]'}`}><p className="text-xs font-semibold">{task.title}</p><p className="mt-0.5 text-[10px]">{task.group_name || task.group || 'Group'} · {pluralize(task.weight || 1, 'point')}</p></li>)}</ul> : <p className="text-xs text-[#718094]">No tasks due that day.</p>}
                      </div>
                    )}
                  </div>

                </div>

                {/* TWIN CENTER AREA DISPLAY LOGICS SHELF PANEL (LIVE DEADLINES + CAPPED UNIT BOARDS) */}
                <div className="space-y-5">
                  
                  {/* LIVE DYNAMIC TASK TICKER DATA LIST */}
                  <div className="bg-white p-5 rounded-lg border border-[#D7DEE6]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[#29384A]">Upcoming tasks</h3>
                        <p className="mt-1 text-xs text-[#718094]">What needs your attention next.</p>
                      </div>
                      <button onClick={() => setActiveTab('tasks')} className="inline-flex items-center gap-1 text-xs text-[#4A6079] font-semibold hover:underline">All tasks <ArrowUpRight size={13} /></button>
                    </div>

                    <div className="space-y-2">
                      {upcomingTasks.length === 0 ? (
                        <p className="text-xs text-[#718094] text-center py-6">{tasks.length ? 'No tasks match your search.' : 'No upcoming tasks. Group assignments will appear here.'}</p>
                      ) : (
                        upcomingTasks.filter((task) => !searchText || `${task.title} ${task.project_name || ''} ${task.group_name || ''}`.toLowerCase().includes(searchText)).slice(0, 6).map((t) => {
                          const isDone = ['completed','done','submitted'].includes(String(t?.status || '').toLowerCase());
                          return (
                            <div key={t.id} className="flex items-center justify-between bg-stone-50/60 p-3 rounded-xl border border-stone-100 transition-colors hover:border-stone-200">
                              <div className="flex items-center gap-3">
                                <span className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <div>
                                  <h4 className="text-xs font-bold text-[#1C1C1E] leading-tight">{t.title}</h4>
                                  <p className="text-[10px] text-stone-500 mt-0.5">{t.group_name || t.group || t.project_name || 'Group'} · {pluralize(t.weight || 1, 'point')} · Due {safeDate(t.due_date)?.toLocaleDateString()}</p>
                                </div>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                                isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                              }`}>
                                {t.status || 'Pending'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 📚 LIVE FILTERED CORE CURRICULUM LIVE GRID PANEL (STRICT 6 MODULE FALLBACK BOUNDS) */}
                  <div className="bg-white p-5 rounded-2xl border border-stone-200/50 shadow-[0_12px_40px_rgba(0,0,0,0.015)] dark:border-stone-700 dark:bg-stone-900">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xs font-black text-[#1C1C1E] uppercase tracking-wider dark:text-stone-100">My Units</h3>
                        <p className="mt-1 text-[10px] font-semibold text-stone-500 dark:text-stone-400">
                          {academic
                            ? `${academic.course_name || academic.course_code} · Year ${academic.year_of_study} · Semester ${academic.semester}`
                            : (user?.course ? `${user.course}${user.year_of_study ? ` · Year ${user.year_of_study}` : ''}` : 'Academic enrollment not set')}
                        </p>
                      </div>
                    </div>

                      {safeArray(units).length ? (
                      <ul className="divide-y divide-stone-100 dark:divide-stone-700">
                        {units.map((unit) => (
                          <li key={unit.id}>
                            <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                              <span className="shrink-0 font-mono text-[10px] font-black text-[#354B63]">{unit.code}</span>
                              <span className="flex-1 text-xs font-semibold text-[#1C1C1E] dark:text-stone-100">{unit.name}</span>
                              {groups.find((group) => String(group.unit_id) === String(unit.id)) ? (() => {
                                const unitGroup = groups.find((group) => String(group.unit_id) === String(unit.id));
                                return <div className="flex items-center justify-between gap-3"><span className="text-[9px] font-semibold text-[#718094]">{unitGroup.name} · {pluralize(unitGroup.members_count || 0, 'member')}</span><button type="button" onClick={() => openGroupDetails(unitGroup)} className="rounded-md border border-[#D7DEE6] px-2.5 py-1.5 text-[9px] font-semibold text-[#4A6079]">Open</button></div>;
                              })() : <span className="text-[9px] font-semibold text-[#718094]">No group yet</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 px-4 py-6 text-center text-xs text-stone-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
                        No units are available for this course, year, and semester yet.
                      </p>
                    )}
                  </div>

                </div>

              </div>

            </div>
          )}
        </div>
      </div>

      {/* 🛠️ CENTRAL INTERACTIVE ACTION CONFIGURATION WINDOW */}
      {showModal && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-stone-200/60 shadow-xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-150">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-stone-50 border border-stone-200 text-stone-400 hover:text-[#1C1C1E] flex items-center justify-center text-xs">✕</button>

            <div className="flex items-center gap-2 mb-5 border-b border-stone-100 pb-3">
              <button type="button" onClick={() => setModalTab('create')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${modalTab === 'create' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'bg-stone-50 text-stone-400 border border-stone-200/60'}`}>Create Group</button>
              <button type="button" onClick={() => setModalTab('join')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${modalTab === 'join' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'bg-stone-50 text-stone-400 border border-stone-200/60'}`}>Join Group</button>
            </div>

            {modalTab === 'create' ? (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Group Workspace Title</label>
                  <input type="text" required placeholder="e.g., Network Alpha Space" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-stone-500 text-[#1C1C1E] font-medium"/>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Associated Curriculum Unit</label>
                  <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none text-[#1C1C1E] font-medium">
                    {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="group-unit" className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Unit for this group</label>
                  <select
                    id="group-unit"
                    value={selectedUnitId}
                    onChange={(event) => setSelectedUnitId(event.target.value)}
                    className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-stone-500 text-[#1C1C1E] font-medium"
                  >
                    <option value="">Choose a unit (optional)</option>
                    {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
                  </select>
                  <p className="mt-1 text-[10px] text-stone-500">Choosing a unit links it to this group.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Group size
                    <input type="number" min="2" max="32767" required value={maxMembers} onChange={(event) => setMaxMembers(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-[#1C1C1E]" />
                  </label>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">Invite classmates <span className="font-normal normal-case">(optional)</span>
                    <input type="text" value={inviteUsernames} onChange={(event) => setInviteUsernames(event.target.value)} placeholder="Admission numbers, separated by commas" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-[#1C1C1E] placeholder:text-stone-400" />
                  </label>
                </div>
                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
                <button type="submit" disabled={createBusy || !newGroupName.trim() || Number(maxMembers) < 2} className="w-full mt-2 bg-[#1C1C1E] text-white py-2.5 rounded-xl text-xs font-bold hover:opacity-95 disabled:opacity-40 transition shadow-md border border-stone-800">
                  {createBusy ? 'Creating group…' : 'Create group'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-wider">6-Digit Access Token String</label>
                  <input type="text" required placeholder="e.g., GHW823" value={inviteCodeInput} onChange={(e) => handleInviteInputChange(e.target.value)} className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-center font-mono tracking-widest focus:outline-none focus:border-stone-500 text-[#1C1C1E]"/>
                  {inviteError && <div className="mt-2 text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg text-center border border-red-100">{inviteError}</div>}
                </div>
                <button type="submit" disabled={joinBusy || inviteCodeInput.length !== 6} className="w-full mt-2 bg-[#1C1C1E] text-white py-2.5 rounded-xl text-xs font-bold hover:opacity-95 disabled:opacity-40 transition shadow-md border border-stone-800">
                  {joinBusy ? 'Validating Allocation Key...' : 'Access Shared Room'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 shadow-2xl dark:border-stone-700 dark:bg-stone-900">
            <button
              type="button"
              onClick={() => setTaskModalOpen(false)}
              aria-label="Close task dialog"
              className="absolute right-4 top-4 rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              ✕
            </button>
            <h2 className="pr-10 text-base font-black text-[#1C1C1E] dark:text-stone-100">
              {taskModalMode === 'create' ? (parentTaskId ? 'Create micro-task' : 'Create project task') : 'Reassign task'}
            </h2>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {parentTaskId
                ? `Under ${taskWorkspace?.tasks?.find((task) => task.id === parentTaskId)?.title || 'parent task'} · ${selectedTaskGroup?.name}`
                : selectedTaskGroup?.name}
            </p>

            <form onSubmit={handleTaskSubmit} className="mt-5 space-y-4">
              {taskModalMode === 'create' ? (
                <>
                  <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                    Task title
                    <input
                      required
                      maxLength={200}
                      value={taskForm.title}
                      onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                      className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </label>
                  <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                    Project
                    {safeArray(taskWorkspace?.group?.projects).length ? (
                      <select required disabled={Boolean(parentTaskId)} value={taskForm.projectId} onChange={(event) => setTaskForm((current) => ({ ...current, projectId: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] disabled:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100">
                        <option value="">Select a project</option>
                        {taskWorkspace.group.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                      </select>
                    ) : <span className="mt-1.5 block rounded-lg bg-stone-50 px-3 py-2.5 text-sm font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">Group project (created automatically)</span>}
                  </label>
                  <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                    Instructions
                    <textarea
                      rows={3}
                      value={taskForm.description}
                      onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                      className="mt-1.5 w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </label>
                  <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                    Due date
                    <input
                      type="date"
                      required
                      value={taskForm.dueDate}
                      onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                      className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    />
                  </label>
                </>
              ) : (
                <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-sm font-bold text-[#1C1C1E] dark:bg-stone-800 dark:text-stone-100">
                  {editingTask?.title}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                  Assignee
                  <select
                    required
                    value={taskForm.assignedToId}
                    onChange={(event) => {
                      setTaskForm((current) => ({ ...current, assignedToId: event.target.value }));
                      setTaskBalanceConfirmed(false);
                      setTaskBalanceWarning('');
                      setTaskProjectedBalance(null);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                  >
                    {safeArray(taskWorkspace?.members).map((member) => (
                      <option key={member.id} value={member.id} disabled={taskModalMode === 'reassign' && String(member.id) === String(editingTask?.assigned_to_id)}>{member.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-300">
                  Weight (1–5)
                  <select
                    value={taskForm.weight}
                    disabled={taskModalMode === 'reassign'}
                    onChange={(event) => {
                      setTaskForm((current) => ({ ...current, weight: Number(event.target.value) }));
                      setTaskBalanceConfirmed(false);
                      setTaskBalanceWarning('');
                      setTaskProjectedBalance(null);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#1C1C1E] disabled:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:disabled:bg-stone-700"
                  >
                    {[1, 2, 3, 4, 5].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
                  </select>
                </label>
              </div>

              {(taskBalanceWarning || taskPreviewWarning) ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100" role="status">
                  <p className="font-bold">{taskProjectedBalance?.level === 'critical' ? 'Critical workload warning' : 'Workload balance warning'}</p>
                  <p className="mt-1">{taskProjectedBalance?.suggestion || taskBalanceWarning || taskPreviewWarning}</p>
                  {taskProjectedBalance && <p className="mt-1 text-[10px]">Projected group total: {pluralize(taskProjectedBalance.total_points, 'point')}</p>}
                  <label className="mt-3 flex items-start gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={taskBalanceConfirmed}
                      onChange={(event) => setTaskBalanceConfirmed(event.target.checked)}
                      className="mt-0.5 accent-amber-700"
                    />
                    <span>I understand the imbalance and want to continue.</span>
                  </label>
                  <label className="mt-3 block font-semibold">
                    Reason (optional)
                    <textarea
                      rows={2}
                      value={taskOverrideReason}
                      onChange={(event) => setTaskOverrideReason(event.target.value)}
                      className="mt-1 w-full rounded-md border border-amber-300 bg-white px-2.5 py-2 text-xs text-stone-900 dark:border-amber-700 dark:bg-stone-900 dark:text-stone-100"
                    />
                  </label>
                </div>
              ) : null}
              {taskTooEarlyToJudge && <p role="status" className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-600">Too early to judge: the projected group total is below 6 points.</p>}

              {taskWorkspaceError ? <p role="alert" className="text-xs font-semibold text-red-600">{taskWorkspaceError}</p> : null}
              <div className="flex justify-end gap-2 border-t border-stone-100 pt-4 dark:border-stone-700">
                <button type="button" onClick={() => setTaskModalOpen(false)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800">Cancel</button>
                <button type="submit" disabled={taskBusy || taskProjectionLoading || (taskModalMode === 'create' && (!taskForm.title.trim() || !taskForm.dueDate || (safeArray(taskWorkspace?.group?.projects).length > 0 && !taskForm.projectId))) || !taskForm.assignedToId || (taskModalMode === 'reassign' && String(taskForm.assignedToId) === String(editingTask?.assigned_to_id))} className="rounded-lg bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900">
                  {taskBusy ? 'Saving…' : taskModalMode === 'create' ? 'Create task' : 'Save assignee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
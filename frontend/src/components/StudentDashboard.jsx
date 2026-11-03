import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Chat from './Chat';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const StudentDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupTasks, setGroupTasks] = useState([]);
  const [groupSubTab, setGroupSubTab] = useState('tasks');
  const [groupChatRoom, setGroupChatRoom] = useState(null);
  const [groupChatMessages, setGroupChatMessages] = useState([]);
  const [newGroupMessage, setNewGroupMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', due_date: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [salutation, setSalutation] = useState('');
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    taskReminders: true,
    groupUpdates: true
  });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [availableChats, setAvailableChats] = useState([]);

  const [messageNotifications, setMessageNotifications] = useState([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    course: '',
    year_of_study: '',
    description: ''
  });
  const [joinGroupCode, setJoinGroupCode] = useState('');

  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showAllTasksModal, setShowAllTasksModal] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [kanbanTasks, setKanbanTasks] = useState({
    todo: [],
    inProgress: [],
    done: []
  });



  // Status mapping


  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // SortableItem component
  const SortableItem = ({ id, children }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`${isDragging ? 'opacity-50' : ''}`}
      >
        {children}
      </div>
    );
  };

  // Drag and drop handler
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find the containers
    const activeContainer = active.data.current?.sortable?.containerId;
    const overContainer = over.data.current?.sortable?.containerId || over.id;

    if (activeContainer && overContainer) {
      if (activeContainer === overContainer) {
        // Reordering within the same column
        setKanbanTasks((prev) => {
          const container = prev[activeContainer];
          const activeIndex = container.findIndex((item) => item.id === activeId);
          const overIndex = container.findIndex((item) => item.id === overId);

          return {
            ...prev,
            [activeContainer]: arrayMove(container, activeIndex, overIndex),
          };
        });
      } else {
        // Moving between columns
        setKanbanTasks((prev) => {
          const activeItems = prev[activeContainer];
          const overItems = prev[overContainer];
          const activeIndex = activeItems.findIndex((item) => item.id === activeId);
          const overIndex = overItems.findIndex((item) => item.id === overId);

          const newActiveItems = [...activeItems];
          const newOverItems = [...overItems];
          const [movedItem] = newActiveItems.splice(activeIndex, 1);
          newOverItems.splice(overIndex, 0, movedItem);

          // Update task status
          updateTaskStatus(movedItem.id, overContainer);

          return {
            ...prev,
            [activeContainer]: newActiveItems,
            [overContainer]: newOverItems,
          };
        });
      }
    }
  };

  // Update salutation in real-time
  useEffect(() => {
    const updateSalutation = () => {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Good morning' : 'Good afternoon';
      const name = dashboardData?.user?.first_name || 'Student';
      setSalutation(`${greeting}, ${name}`);
    };

    updateSalutation();
    const interval = setInterval(updateSalutation, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [dashboardData]);

  useEffect(() => {
    fetchDashboardData();
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') {
      fetchAvailableChats();
    }
  }, [activeTab]);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      setSearchResults(null);
    }
  }, [searchQuery]);

  const performSearch = async (query) => {
    setIsSearching(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`/api/accounts/search/?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error performing search:', error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchAvailableChats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('/api/accounts/chat/rooms/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setAvailableChats(response.data);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      setAvailableChats([]);
    }
  };

  const selectChat = async (chat) => {
    setSelectedChat(chat);
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`/api/accounts/chat/messages/${chat.id}/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setChatMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setChatMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`/api/accounts/chat/send/${selectedChat.id}/`, {
        content: newMessage
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setChatMessages([...chatMessages, response.data]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const response = await axios.get('/api/accounts/dashboard/student/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        setError('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('/api/accounts/notifications/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchGroupTasks = async (groupId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`/api/accounts/groups/${groupId}/tasks/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setGroupTasks(response.data);

      // Categorize tasks for Kanban
      const categorized = {
        todo: response.data.filter(task => task.status === 'pending'),
        inProgress: response.data.filter(task => task.status === 'in_progress'),
        done: response.data.filter(task => task.status === 'completed')
      };
      setKanbanTasks(categorized);
    } catch (error) {
      console.error('Error fetching group tasks:', error);
    }
  };

  const fetchAllTasks = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('/api/accounts/tasks/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setAllTasks(response.data);
    } catch (error) {
      console.error('Error fetching all tasks:', error);
    }
  };



  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`/api/accounts/tasks/${taskId}/update-status/`, {
        status: newStatus
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      // Refresh group tasks
      if (selectedGroup) {
        fetchGroupTasks(selectedGroup.id);
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const createTask = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`/api/accounts/groups/${selectedGroup.id}/create-task/`, newTask, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setNewTask({ title: '', description: '', assigned_to: '', due_date: '' });
      setShowCreateTask(false);
      fetchGroupTasks(selectedGroup.id);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const createGroup = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post('/api/accounts/groups/create/', groupFormData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Group created:', response.data);
      setShowCreateGroupModal(false);
      setGroupFormData({ name: '', course: '', year_of_study: '', description: '' });
      fetchDashboardData(); // Refresh dashboard to show new group
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

  const joinGroup = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post('/api/accounts/groups/join/', {
        group_code: joinGroupCode
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Joined group:', response.data);
      setShowCreateGroupModal(false);
      setJoinGroupCode('');
      fetchDashboardData(); // Refresh dashboard to show joined group
    } catch (error) {
      console.error('Error joining group:', error);
      alert('Failed to join group. Please check the group code and try again.');
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`/api/accounts/notifications/${notificationId}/read/`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification read:', error);
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

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    setActiveTab('tasks');
    setGroupSubTab('tasks');
    fetchGroupTasks(group.id);
  };

  const fetchGroupChatRoom = async (groupId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`/api/accounts/groups/${groupId}/chat-room/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setGroupChatRoom(response.data);
      fetchGroupChatMessages(response.data.id);
    } catch (error) {
      console.error('Error fetching group chat room:', error);
      setGroupChatRoom(null);
    }
  };

  const fetchGroupChatMessages = async (roomId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`/api/accounts/chat/messages/${roomId}/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setGroupChatMessages(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching group chat messages:', error);
      setGroupChatMessages([]);
    }
  };

  const sendGroupMessage = async () => {
    if (!newGroupMessage.trim() || !groupChatRoom) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`/api/accounts/chat/send/${groupChatRoom.id}/`, {
        content: newGroupMessage
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setGroupChatMessages([...groupChatMessages, response.data]);
      setNewGroupMessage('');
    } catch (error) {
      console.error('Error sending group message:', error);
    }
  };



  const getDeadlineColor = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'bg-red-100 border-red-500 text-red-800'; // Overdue
    if (diffDays <= 1) return 'bg-red-100 border-red-500 text-red-800'; // Urgent
    if (diffDays <= 3) return 'bg-yellow-100 border-yellow-500 text-yellow-800'; // Soon
    if (diffDays <= 7) return 'bg-green-100 border-green-500 text-green-800'; // Later
    return 'bg-gray-100 border-gray-500 text-gray-800'; // Future
  };

  const getDeadlineIcon = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return '🚨'; // Overdue
    if (diffDays <= 1) return '🔴'; // Urgent
    if (diffDays <= 3) return '🟡'; // Soon
    if (diffDays <= 7) return '🟢'; // Later
    return '📅'; // Future
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-400 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
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
    <div className={`min-h-screen flex ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <aside className="w-64 bg-green-800 shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white mb-2">GroupHub</h1>
          <p className="text-green-200 text-sm">Student Portal</p>
        </div>

        <nav className="mt-6">
          <div className="px-6 mb-4">
            <p className="text-green-300 text-sm font-medium uppercase tracking-wider">Welcome back</p>
            <p className="text-white font-semibold">{dashboardData?.user?.first_name} {dashboardData?.user?.last_name}</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center px-6 py-3 text-left ${
                activeTab === 'dashboard'
                  ? 'bg-green-700 text-white border-r-4 border-green-400'
                  : 'text-green-300 hover:text-white hover:bg-green-700'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"></path>
              </svg>
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`w-full flex items-center px-6 py-3 text-left ${
                activeTab === 'tasks'
                  ? 'bg-green-700 text-white border-r-4 border-green-400'
                  : 'text-green-300 hover:text-white hover:bg-green-700'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Tasks
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center px-6 py-3 text-left relative ${
                activeTab === 'notifications'
                  ? 'bg-green-700 text-white border-r-4 border-green-400'
                  : 'text-green-300 hover:text-white hover:bg-green-700'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path>
              </svg>
              Notifications
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute right-4 top-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center px-6 py-3 text-left ${
                activeTab === 'profile'
                  ? 'bg-green-700 text-white border-r-4 border-green-400'
                  : 'text-green-300 hover:text-white hover:bg-green-700'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
              </svg>
              Profile
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center px-6 py-3 text-left ${
                activeTab === 'settings'
                  ? 'bg-green-700 text-white border-r-4 border-green-400'
                  : 'text-green-300 hover:text-white hover:bg-green-700'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"></path>
              </svg>
              Settings
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center px-6 py-3 text-left ${
                activeTab === 'chat'
                  ? 'bg-green-700 text-white border-r-4 border-green-400'
                  : 'text-green-300 hover:text-white hover:bg-green-700'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"></path>
              </svg>
              Chat
            </button>
          </div>
        </nav>

        <div className="absolute bottom-0 w-64 p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-red-300 hover:text-white hover:bg-red-700 rounded-md transition-colors"
          >
            <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"></path>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className={`shadow-sm border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <div className="px-6 py-4">
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <span className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{salutation}</span>
              </div>
              <div className="flex-1"></div>
              {activeTab === 'dashboard' && (
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-gray-400">🔍</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Search groups, tasks, or projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-64 pl-10 pr-4 py-1 rounded-lg border ${
                        darkMode
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </div>
              )}
              <div className="flex-1 flex justify-end">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <button
                      onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                      className={`p-2 rounded-lg relative ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    >
                      <span className="text-xl">🔔</span>
                      {messageNotifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {messageNotifications.length}
                        </span>
                      )}
                    </button>
                    {showNotificationDropdown && (
                      <div className={`absolute right-0 mt-2 w-80 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border rounded-lg shadow-lg z-50`}>
                        <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Message Notifications</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {messageNotifications.length > 0 ? (
                            messageNotifications.map((notification) => (
                              <div key={notification.id} className={`p-4 border-b ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <div className="flex items-start">
                                  <div className="flex-1">
                                    <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{notification.title}</h4>
                                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{notification.message}</p>
                                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{new Date(notification.timestamp).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center">
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No new message notifications</p>
                            </div>
                          )}
                        </div>
                        <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <button
                            onClick={() => {
                              setMessageNotifications([]);
                              setShowNotificationDropdown(false);
                            }}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  >
                    <span className="text-xl">{darkMode ? '☀️' : '🌙'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {activeTab === 'dashboard' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border overflow-hidden shadow rounded-lg`}>
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-700 font-bold">👥</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className={`text-sm font-medium truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Groups</dt>
                          <dd className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.stats?.total_groups || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border overflow-hidden shadow rounded-lg`}>
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-700 font-bold">🎓</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className={`text-sm font-medium truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Projects</dt>
                          <dd className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.stats?.active_projects || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border overflow-hidden shadow rounded-lg`}>
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-700 font-bold">📋</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className={`text-sm font-medium truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Pending Tasks</dt>
                          <dd className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.stats?.pending_tasks || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upcoming Deadlines */}
              {dashboardData?.upcoming_deadlines?.length > 0 && (
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg mb-8`}>
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Upcoming Deadlines</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dashboardData.upcoming_deadlines.map((deadline) => (
                        <div key={deadline.id} className={`border rounded-lg p-4 ${getDeadlineColor(deadline.due_date)}`}>
                          <div className="flex items-start">
                            <span className="text-2xl mr-3">{getDeadlineIcon(deadline.due_date)}</span>
                            <div className="flex-1">
                              <h4 className="font-medium">{deadline.title}</h4>
                              <p className="text-sm opacity-75">{deadline.project}</p>
                              <p className="text-sm opacity-75">Due: {new Date(deadline.due_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Search Results or Default Dashboard */}
              {isSearching ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
                  <p className={`mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Searching...</p>
                </div>
              ) : searchResults ? (
                <>
                  {/* Search Results */}
                  <div className="mb-8">
                    <h3 className={`text-xl font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Search Results for "{searchQuery}"</h3>
                  </div>

                  {/* Groups from Search */}
                  {searchResults.groups && searchResults.groups.length > 0 && (
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg mb-6`}>
                      <div className="px-4 py-5 sm:p-6">
                        <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Groups</h3>
                        <div className="space-y-4">
                          {searchResults.groups.map((group) => (
                            <div key={group.id} className={`${darkMode ? 'border-gray-700 hover:bg-gray-600' : 'border-gray-300 hover:bg-gray-50'} border rounded-lg p-4 cursor-pointer`} onClick={() => handleGroupClick(group)}>
                              <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{group.name}</h4>
                              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{group.course} - Year {group.year_of_study}</p>
                              <div className="mt-2">
                                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Projects: {group.projects?.length || 0}</p>
                                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Progress: {group.progress_percentage}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tasks from Search */}
                  {searchResults.tasks && searchResults.tasks.length > 0 && (
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg mb-6`}>
                      <div className="px-4 py-5 sm:p-6">
                        <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tasks</h3>
                        <div className="space-y-4">
                          {searchResults.tasks.map((task) => (
                            <div key={task.id} className={`${darkMode ? 'border-gray-700' : 'border-gray-300'} border rounded-lg p-4`}>
                              <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task.title}</h4>
                              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Project: {task.project}</p>
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status: {task.status}</p>
                              <div className="mt-2">
                                <div className="w-full bg-gray-300 rounded-full h-2">
                                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${task.progress_percentage}%` }}></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{task.progress_percentage}% complete</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Projects from Search */}
                  {searchResults.projects && searchResults.projects.length > 0 && (
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg`}>
                      <div className="px-4 py-5 sm:p-6">
                        <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Projects</h3>
                        <div className="space-y-4">
                          {searchResults.projects.map((project) => (
                            <div key={project.id} className={`${darkMode ? 'border-gray-700' : 'border-gray-300'} border rounded-lg p-4`}>
                              <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{project.name}</h4>
                              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{project.description}</p>
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Group: {project.group_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No Results */}
                  {(!searchResults.groups || searchResults.groups.length === 0) &&
                   (!searchResults.tasks || searchResults.tasks.length === 0) &&
                   (!searchResults.projects || searchResults.projects.length === 0) && (
                    <div className="text-center py-8">
                      <div className={`text-6xl mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>🔍</div>
                      <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>No results found</h3>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Try adjusting your search query</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Groups and Projects */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Groups */}
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg`}>
                      <div className="px-4 py-5 sm:p-6">
                        <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>My Groups</h3>
                        {dashboardData?.groups?.length > 0 ? (
                          <div className="space-y-4">
                            {dashboardData.groups.map((group) => (
                              <div key={group.id} className={`${darkMode ? 'border-gray-700 hover:bg-gray-600' : 'border-gray-300 hover:bg-gray-50'} border rounded-lg p-4 cursor-pointer`} onClick={() => handleGroupClick(group)}>
                                <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{group.name}</h4>
                                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{group.course} - Year {group.year_of_study}</p>
                                <div className="mt-2">
                                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Projects: {group.projects.length}</p>
                                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Progress: {group.progress_percentage}%</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className={`text-6xl mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>👥</div>
                            <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>No groups yet</h3>
                            <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Join or create a group to get started with collaborative projects</p>
                            <button
                              onClick={() => setShowCreateGroupModal(true)}
                              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                            >
                              Create/Join Group
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Tasks */}
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg`}>
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className={`text-lg leading-6 font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Recent Tasks</h3>
                          <button
                            onClick={() => {
                              fetchAllTasks();
                              setShowAllTasksModal(true);
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                          >
                            View All Tasks
                          </button>
                        </div>
                        {dashboardData?.recent_tasks?.length > 0 ? (
                          <div className="space-y-4">
                            {dashboardData.recent_tasks.map((task) => (
                              <div key={task.id} className={`${darkMode ? 'border-gray-700' : 'border-gray-300'} border rounded-lg p-4`}>
                                <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task.title}</h4>
                                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Project: {task.project}</p>
                                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status: {task.status}</p>
                                <div className="mt-2">
                                  <div className="w-full bg-gray-300 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${task.progress_percentage}%` }}></div>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{task.progress_percentage}% complete</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`text-gray-500 ${darkMode ? 'text-gray-400' : ''}`}>No recent tasks.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'tasks' && selectedGroup && (
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg`}>
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg leading-6 font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedGroup.name}</h3>
                  {selectedGroup.is_admin && groupSubTab === 'tasks' && (
                    <button
                      onClick={() => setShowCreateTask(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Create Task
                    </button>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 mb-6">
                  <button
                    onClick={() => setGroupSubTab('tasks')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      groupSubTab === 'tasks'
                        ? 'bg-blue-600 text-white'
                        : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Tasks
                  </button>
                  <button
                    onClick={() => {
                      setGroupSubTab('chat');
                      fetchGroupChatRoom(selectedGroup.id);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      groupSubTab === 'chat'
                        ? 'bg-blue-600 text-white'
                        : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Chat
                  </button>
                </div>

                {groupSubTab === 'tasks' && (
                  <>
                    {groupTasks.length > 0 ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* To Do Column */}
                          <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                            <h4 className={`font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>To Do</h4>
                            <SortableContext
                              items={kanbanTasks.todo.map(task => task.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-3">
                                {kanbanTasks.todo.map((task) => (
                                  <SortableItem key={task.id} id={task.id}>
                                    <div className={`${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'} border rounded-lg p-3 shadow-sm`}>
                                      <h5 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task.title}</h5>
                                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{task.description}</p>
                                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Assigned to: {task.assigned_to_name}</p>
                                      {task.due_date && (
                                        <p className="text-xs text-red-400">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                                      )}
                                      <div className="mt-2">
                                        <div className="w-full bg-gray-300 rounded-full h-1">
                                          <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${task.progress_percentage}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{task.progress_percentage}%</p>
                                      </div>
                                    </div>
                                  </SortableItem>
                                ))}
                              </div>
                            </SortableContext>
                          </div>

                          {/* In Progress Column */}
                          <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                            <h4 className={`font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>In Progress</h4>
                            <SortableContext
                              items={kanbanTasks.inProgress.map(task => task.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-3">
                                {kanbanTasks.inProgress.map((task) => (
                                  <SortableItem key={task.id} id={task.id}>
                                    <div className={`${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'} border rounded-lg p-3 shadow-sm`}>
                                      <h5 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task.title}</h5>
                                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{task.description}</p>
                                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Assigned to: {task.assigned_to_name}</p>
                                      {task.due_date && (
                                        <p className="text-xs text-red-400">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                                      )}
                                      <div className="mt-2">
                                        <div className="w-full bg-gray-300 rounded-full h-1">
                                          <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${task.progress_percentage}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{task.progress_percentage}%</p>
                                      </div>
                                    </div>
                                  </SortableItem>
                                ))}
                              </div>
                            </SortableContext>
                          </div>

                          {/* Done Column */}
                          <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                            <h4 className={`font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Done</h4>
                            <SortableContext
                              items={kanbanTasks.done.map(task => task.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-3">
                                {kanbanTasks.done.map((task) => (
                                  <SortableItem key={task.id} id={task.id}>
                                    <div className={`${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'} border rounded-lg p-3 shadow-sm`}>
                                      <h5 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{task.title}</h5>
                                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{task.description}</p>
                                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Assigned to: {task.assigned_to_name}</p>
                                      {task.due_date && (
                                        <p className="text-xs text-red-400">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                                      )}
                                      <div className="mt-2">
                                        <div className="w-full bg-gray-300 rounded-full h-1">
                                          <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${task.progress_percentage}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{task.progress_percentage}%</p>
                                      </div>
                                    </div>
                                  </SortableItem>
                                ))}
                              </div>
                            </SortableContext>
                          </div>
                        </div>
                      </DndContext>
                    ) : (
                      <p className={`text-gray-500 ${darkMode ? 'text-gray-400' : ''}`}>No tasks for this group.</p>
                    )}
                  </>
                )}

                {groupSubTab === 'chat' && groupChatRoom && (
                  <Chat roomId={groupChatRoom.id} />
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg`}>

              <div className="px-4 py-5 sm:p-6">
                <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Notifications</h3>
                {notifications.length > 0 ? (
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <div key={notification.id} className={`${darkMode ? 'border-gray-700' : 'border-gray-300'} border rounded-lg p-4 ${!notification.is_read ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-start">
                          <div className="flex-1">
                            <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{notification.title}</h4>
                            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{notification.message}</p>
                            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{new Date(notification.created_at).toLocaleString()}</p>
                          </div>
                          {!notification.is_read && (
                            <button
                              onClick={() => markNotificationRead(notification.id)}
                              className="ml-4 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-gray-500 ${darkMode ? 'text-gray-400' : ''}`}>No notifications.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg`}>
              <div className="px-4 py-5 sm:p-6">
                <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Profile</h3>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Name</label>
                    <p className={`mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.user?.first_name} {dashboardData?.user?.last_name}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                    <p className={`mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.user?.email}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>User Type</label>
                    <p className={`mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.user?.user_type}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>University</label>
                    <p className={`mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.user?.university}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg`}>
              <div className="px-4 py-5 sm:p-6">
                <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className={`text-md font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Notifications</h4>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.emailNotifications}
                          onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                          className="mr-2"
                        />
                        <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email Notifications</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.pushNotifications}
                          onChange={(e) => setSettings({ ...settings, pushNotifications: e.target.checked })}
                          className="mr-2"
                        />
                        <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Push Notifications</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.taskReminders}
                          onChange={(e) => setSettings({ ...settings, taskReminders: e.target.checked })}
                          className="mr-2"
                        />
                        <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Task Reminders</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.groupUpdates}
                          onChange={(e) => setSettings({ ...settings, groupUpdates: e.target.checked })}
                          className="mr-2"
                        />
                        <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Group Updates</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setShowChangePassword(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Chat List */}
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg`}>
                <div className="px-4 py-5 sm:p-6">
                  <h3 className={`text-lg leading-6 font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Chats</h3>
                  <div className="space-y-2">
                    {availableChats.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => selectChat(chat)}
                        className={`p-3 rounded-lg cursor-pointer ${selectedChat?.id === chat.id ? 'bg-blue-100' : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                      >
                        <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{chat.name}</h4>
                        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{chat.last_message || 'No messages yet'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className={`lg:col-span-2 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border shadow rounded-lg flex flex-col`}>
                {selectedChat ? (
                  <>
                    <div className={`px-4 py-5 sm:p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                      <h3 className={`text-lg leading-6 font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedChat.name}</h3>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto">
                      {chatMessages.map((message) => (
                        <div key={message.id} className={`mb-4 ${message.sender.id === dashboardData?.user?.id ? 'text-right' : ''}`}>
                          <div className={`inline-block p-3 rounded-lg ${message.sender.id === dashboardData?.user?.id ? 'bg-blue-600 text-white' : darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'}`}>
                            <p className="text-sm">{message.content}</p>
                            <p className="text-xs opacity-75">{new Date(message.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                      <div className="flex">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Type a message..."
                          className={`flex-1 px-3 py-2 border rounded-l-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
                        />
                        <button
                          onClick={sendMessage}
                          className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className={`text-gray-500 ${darkMode ? 'text-gray-400' : ''}`}>Select a chat to start messaging</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Task</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Task Title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <textarea
                  placeholder="Task Description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="3"
                />
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowCreateTask(false)}
                  className="mr-2 px-4 py-2 text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createTask}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
              <div className="space-y-4">
                <input
                  type="password"
                  placeholder="Current Password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="password"
                  placeholder="New Password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowChangePassword(false)}
                  className="mr-2 px-4 py-2 text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowChangePassword(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create or Join Group</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Create New Group</h4>
                  <input
                    type="text"
                    placeholder="Group Name"
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                  />
                  <input
                    type="text"
                    placeholder="Course"
                    value={groupFormData.course}
                    onChange={(e) => setGroupFormData({ ...groupFormData, course: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                  />
                  <input
                    type="number"
                    placeholder="Year of Study"
                    value={groupFormData.year_of_study}
                    onChange={(e) => setGroupFormData({ ...groupFormData, year_of_study: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="3"
                  />
                  <button
                    onClick={createGroup}
                    className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Create Group
                  </button>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Join Existing Group</h4>
                  <input
                    type="text"
                    placeholder="Group Code"
                    value={joinGroupCode}
                    onChange={(e) => setJoinGroupCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                  />
                  <button
                    onClick={joinGroup}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Join Group
                  </button>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAllTasksModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">All Tasks</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {allTasks.map((task) => (
                  <div key={task.id} className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">{task.title}</h4>
                    <p className="text-sm text-gray-600">{task.description}</p>
                    <p className="text-sm text-gray-500">Status: {task.status}</p>
                    <div className="mt-2">
                      <div className="w-full bg-gray-300 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${task.progress_percentage}%` }}></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{task.progress_percentage}% complete</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowAllTasksModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;

import React, { useState, useEffect } from 'react';
import { Camera, Eye, EyeOff, Loader2, Bell, Mail, Shield, User, Calendar, BookOpen, MessageCircle } from 'lucide-react';
import { btnPrimary, btnSecondary } from '../design';
import axios from '../../api';

const getStoredToken = () => localStorage.getItem('access_token');

const Settings = ({ ctx }) => {
  const { 
    settingsCatalog, 
    settingsForm, 
    setSettingsForm, 
    settingsLoading, 
    settingsLoadError, 
    setSettingsLoadKey, 
    settingsBusy, 
    settingsMessage, 
    settingsError, 
    passwordForm, 
    setPasswordForm, 
    passwordBusy, 
    passwordMessage, 
    passwordError, 
    settingsYears, 
    settingsSemesters, 
    handleSettingsSubmit, 
    handlePasswordSubmit,
    user,
    setUser,
  } = ctx;

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [notificationSettings, setNotificationSettings] = useState({
    taskAssigned: true,
    taskDue: true,
    pollOpened: true,
    mention: true,
    messageReceived: true,
    joinRequest: true,
    inviteResponse: true,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  // Load notification settings
  useEffect(() => {
    const loadNotificationSettings = async () => {
      try {
        const response = await axios.get('/api/accounts/profile/notification-settings/', {
          headers: { Authorization: `Bearer ${getStoredToken()}` },
        });
        if (response.data) {
          setNotificationSettings(prev => ({ ...prev, ...response.data }));
        }
      } catch (err) {
        console.error('Failed to load notification settings:', err);
      } finally {
        setLoadingNotifications(false);
      }
    };
    loadNotificationSettings();
  }, []);

  const saveNotificationSettings = async () => {
    try {
      await axios.patch('/api/accounts/profile/notification-settings/', notificationSettings, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
    } catch (err) {
      console.error('Failed to save notification settings:', err);
    }
  };

  const handleNotificationToggle = (key) => {
    setNotificationSettings(prev => ({ ...prev, [key]: !prev[key] }), () => {
      saveNotificationSettings();
    });
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image must be less than 2 MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    setAvatarError('');
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target.result);
    reader.readAsDataURL(file);

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await axios.post('/api/accounts/profile/avatar/', formData, {
        headers: { Authorization: `Bearer ${getStoredToken()}`, 'Content-Type': 'multipart/form-data' },
      });
      if (response.data?.avatar_url) {
        const nextUser = { ...user, avatar: response.data.avatar_url };
        setUser(nextUser);
        localStorage.setItem('user', JSON.stringify(nextUser));
      }
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      await axios.delete('/api/accounts/profile/avatar/', {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      const nextUser = { ...user, avatar: null };
      setUser(nextUser);
      localStorage.setItem('user', JSON.stringify(nextUser));
      setAvatarPreview(null);
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Failed to remove avatar');
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="border-b border-[#D7DEE6] pb-4">
        <h2 className="text-xl font-semibold text-[#35475C]">Settings</h2>
        <p className="mt-1 text-sm text-[#4F5F73]">Manage your account, academic details, and preferences.</p>
      </div>

      {settingsLoading ? (
        <p role="status" className="rounded-lg border border-[#D7DEE6] bg-white p-6 text-sm text-[#596579]">Loading account settings…</p>
      ) : settingsLoadError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700">
          <span>{settingsLoadError}</span>
          <button type="button" onClick={() => setSettingsLoadKey((key) => key + 1)} className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50">Retry</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Avatar + Personal Details */}
          <div className="space-y-5 lg:pr-3">
            {/* Avatar Section - Compact */}
            <section className="rounded-lg border border-[#D7DEE6] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#35475C] flex items-center gap-2"><User size={16} aria-hidden="true" /> Profile picture</h3>
              <p className="mt-0.5 text-xs text-[#4F5F73]">Visible to group members and lecturers.</p>
              
              <div className="mt-3 flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="h-20 w-20 rounded-full bg-[#EEF1F4] overflow-hidden flex items-center justify-center ring-2 ring-white shadow-sm">
                    {avatarPreview || user?.avatar ? (
                      <img src={avatarPreview || user?.avatar} alt="Your avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-[#4A6079]">
                        {user?.first_name?.[0] || ''}{user?.last_name?.[0] || ''}
                      </span>
                    )}
                  </div>
                  {avatarUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <Loader2 size={20} className="text-white animate-spin" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className={btnPrimary.replace('px-4', 'px-3').replace('py-2', 'py-1.5')}>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
                    <Camera size={14} className="inline-flex items-center gap-1" aria-hidden="true" /> Choose photo
                  </label>
                  {(avatarPreview || user?.avatar) && (
                    <button type="button" onClick={removeAvatar} disabled={avatarUploading} className={btnSecondary.replace('px-4', 'px-3').replace('py-2', 'py-1.5')}>
                      Remove photo
                    </button>
                  )}
                  {avatarError && <p className="text-xs text-red-700" role="alert">{avatarError}</p>}
                </div>
              </div>
            </section>

            {/* Personal & Academic Details */}
            <section className="rounded-lg border border-[#D7DEE6] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#35475C] flex items-center gap-2"><User size={16} aria-hidden="true" /> Personal & academic details</h3>
              <form onSubmit={handleSettingsSubmit} className="space-y-4 mt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[#435B76]">
                    First name
                    <input required value={settingsForm.first_name} onChange={(event) => setSettingsForm((current) => ({ ...current, first_name: event.target.value }))} className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76]">
                    Last name
                    <input value={settingsForm.last_name} onChange={(event) => setSettingsForm((current) => ({ ...current, last_name: event.target.value }))} className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76] sm:col-span-2">
                    Email (read-only)
                    <input type="email" value={user?.email || ''} readOnly className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-[#F1F5F9] px-2.5 py-2 text-sm text-[#64748A] outline-none" />
                    <p className="mt-0.5 text-xs text-[#4F5F73]">Email cannot be changed. Contact support if you need to update it.</p>
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76] sm:col-span-2">
                    Programme
                    <select value={settingsForm.course_id} onChange={(event) => setSettingsForm((current) => ({ ...current, course_id: event.target.value, year_of_study: '', semester: '' }))} className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 text-sm text-[#29384A] outline-none focus:border-[#7189A3]">
                      <option value="">Select programme</option>
                      {settingsCatalog.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76]">
                    Year of study
                    <select value={settingsForm.year_of_study} disabled={!settingsForm.course_id} onChange={(event) => setSettingsForm((current) => ({ ...current, year_of_study: event.target.value, semester: '' }))} className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 text-sm text-[#29384A] outline-none focus:border-[#7189A3] disabled:bg-[#EEF1F4]">
                      <option value="">Select year</option>
                      {settingsYears.map((year) => <option key={year} value={year}>Year {year}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#435B76]">
                    Semester
                    <select value={settingsForm.semester} disabled={!settingsForm.year_of_study} onChange={(event) => setSettingsForm((current) => ({ ...current, semester: event.target.value }))} className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 text-sm text-[#29384A] outline-none focus:border-[#7189A3] disabled:bg-[#EEF1F4]">
                      <option value="">Select semester</option>
                      {settingsSemesters.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
                    </select>
                  </label>
                </div>
                {settingsError && <p role="alert" className="text-xs font-medium text-red-700">{settingsError}</p>}
                {settingsMessage && <p role="status" className="text-xs font-medium text-[#435B76]">{settingsMessage}</p>}
                <div className="flex justify-end border-t border-[#E4E9EF] pt-3">
                  <button type="submit" disabled={settingsBusy} className={btnPrimary}>{settingsBusy ? 'Saving…' : 'Save settings'}</button>
                </div>
              </form>
            </section>
          </div>

          {/* Right Column: Password + Notifications */}
          <div className="space-y-5 lg:pl-3">
            {/* Change Password */}
            <section className="rounded-lg border border-[#D7DEE6] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#35475C] flex items-center gap-2"><Shield size={16} aria-hidden="true" /> Change password</h3>
              <p className="mt-0.5 text-xs text-[#4F5F73]">Use your current password to confirm the change.</p>
              <form onSubmit={handlePasswordSubmit} className="space-y-3 mt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    ['current_password', 'Current password', showCurrentPassword, setShowCurrentPassword],
                    ['new_password', 'New password', showNewPassword, setShowNewPassword],
                    ['confirm_password', 'Confirm new password', showConfirmPassword, setShowConfirmPassword],
                  ].map(([field, label, show, setShow]) => (
                    <label key={field} className="block text-xs font-semibold text-[#435B76]">
                      {label}
                      <div className="mt-1 relative">
                        <input type={show ? 'text' : 'password'} required autoComplete="new-password" value={passwordForm[field]} onChange={(event) => setPasswordForm((current) => ({ ...current, [field]: event.target.value }))} className="w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 text-sm text-[#29384A] outline-none focus:border-[#7189A3] pr-9" />
                        <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4F5F73] hover:text-[#1F2D3D]">
                          {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </button>
                      </div>
                    </label>
                  ))}
                </div>
                {passwordError && <p role="alert" className="text-xs font-medium text-red-700">{passwordError}</p>}
                {passwordMessage && <p role="status" className="text-xs font-medium text-[#435B76]">{passwordMessage}</p>}
                <div className="flex justify-end border-t border-[#E4E9EF] pt-3">
                  <button type="submit" disabled={passwordBusy} className="rounded-md border border-[#CBD5E1] bg-[#EEF1F4] px-3 py-2 text-xs font-semibold text-[#354B63] hover:bg-[#E4E9EF] disabled:opacity-50">{passwordBusy ? 'Updating…' : 'Update password'}</button>
                </div>
              </form>
            </section>

            {/* Notification Preferences */}
            <section className="rounded-lg border border-[#D7DEE6] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#35475C] flex items-center gap-2"><Bell size={16} aria-hidden="true" /> Notification preferences</h3>
              <p className="mt-0.5 text-xs text-[#4F5F73]">Choose which notifications you want to receive.</p>
              
              {loadingNotifications ? (
                <p className="mt-3 text-sm text-[#4F5F73]">Loading…</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {[
                    { key: 'taskAssigned', label: 'Task assigned to me', icon: <BookOpen size={14} /> },
                    { key: 'taskDue', label: 'Task due soon', icon: <Calendar size={14} /> },
                    { key: 'pollOpened', label: 'New poll opened', icon: <Bell size={14} /> },
                    { key: 'mention', label: '@mentions in chat', icon: <Mail size={14} /> },
                    { key: 'messageReceived', label: 'New messages', icon: <MessageCircle size={14} /> },
                    { key: 'joinRequest', label: 'Join requests (if leader)', icon: <User size={14} /> },
                    { key: 'inviteResponse', label: 'Invite responses', icon: <User size={14} /> },
                  ].map(({ key, label, icon }) => (
                    <label key={key} className="flex items-center justify-between gap-3 py-1.5 hover:bg-[#F8FAFC] rounded-lg px-2">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF1F4] text-[#4A6079]">{icon}</span>
                        <span className="text-sm font-medium text-[#1F2D3D]">{label}</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={notificationSettings[key]}
                        onClick={() => handleNotificationToggle(key)}
                        className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${notificationSettings[key] ? 'bg-[#35475C]' : 'bg-[#D7DEE6]'}`}
                        aria-label={`Toggle ${label}`}
                      >
                        <span className={`absolute top-0 h-4 w-4 rounded-full bg-white shadow-md transition-transform ${notificationSettings[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </label>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
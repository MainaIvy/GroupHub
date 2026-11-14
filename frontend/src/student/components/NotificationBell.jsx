import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, X, Loader2, BellOff } from 'lucide-react';
import { timeAgo } from '../utils';
import useOutsideClick from '../hooks/useOutsideClick';
import axios from '../../api';

const getStoredToken = () => localStorage.getItem('access_token');

const NotificationBell = ({ notif, open, onToggle, onClose }) => {
  useOutsideClick(open, onClose);
  const { bellItems = [], unreadBell = 0, loading, error, markRead, reload } = notif || {};

  const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'read'
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [localBellItems, setLocalBellItems] = useState(bellItems);
  const [localUnreadCount, setLocalUnreadCount] = useState(unreadBell);

  // Sync local state with parent when bellItems change
  useEffect(() => {
    setLocalBellItems(bellItems);
    setLocalUnreadCount(unreadBell);
  }, [bellItems, unreadBell]);

// Live polling for new notifications
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(async () => {
      try {
        const response = await axios.get('/api/accounts/notifications/', {
          headers: { Authorization: `Bearer ${getStoredToken()}` },
          params: { limit: 50 }
        });
        // The API returns a plain list of notifications (no `results` envelope).
        const items = Array.isArray(response.data) ? response.data : [];
        setLocalBellItems(items);
        const unread = items.filter(n => !n.is_read).length;
        setLocalUnreadCount(unread);
      } catch (err) {
        console.error('Failed to poll notifications:', err);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [open]);

  const filteredItems = localBellItems.filter(item => {
    if (activeTab === 'unread') return !item.is_read;
    if (activeTab === 'read') return item.is_read;
    return true;
  });

  const handleMarkAllRead = async () => {
    const unreadIds = localBellItems.filter(item => !item.is_read).map(item => item.id);
    if (unreadIds.length === 0) return;

    setMarkAllLoading(true);
    try {
      await axios.post('/api/accounts/notifications/mark-all-read/', {}, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      setLocalBellItems(prev => prev.map(item => ({ ...item, is_read: true })));
      setLocalUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarkAllLoading(false);
    }
  };

  const handleMarkRead = useCallback(async (id) => {
    try {
      await markRead(id);
      setLocalBellItems(prev => prev.map(item => 
        item.id === id ? { ...item, is_read: true } : item
      ));
      setLocalUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, [markRead]);

  const handleMarkUnread = useCallback(async (id) => {
    try {
      // Assuming there's an endpoint for marking as unread, or we can just update locally
      // For now, update locally and sync with backend
      await axios.patch(`/api/accounts/notifications/${id}/`, { is_read: false }, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });
      setLocalBellItems(prev => prev.map(item => 
        item.id === id ? { ...item, is_read: false } : item
      ));
      setLocalUnreadCount(prev => prev + 1);
    } catch (err) {
      console.error('Failed to mark as unread:', err);
    }
  }, []);

  return (
    <div className="relative" data-popover-root>
      <button
        type="button"
        aria-label={localUnreadCount ? `Notifications, ${localUnreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={onToggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DEE6] bg-white text-[#35475C] hover:bg-[#EEF1F4]"
      >
        <Bell size={18} aria-hidden="true" />
        {localUnreadCount ? (
          <span aria-hidden="true" className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
        ) : null}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[#D7DEE6] bg-white shadow-lg">
          {/* Header with tabs */}
          <div className="border-b border-[#D7DEE6]">
            <p className="px-4 py-2 text-sm font-semibold text-[#1F2D3D]">Notifications</p>
            <div className="flex border-t border-[#D7DEE6]">
              {[
                { id: 'all', label: 'All', icon: <Bell size={14} /> },
                { id: 'unread', label: 'Unread', icon: <BellOff size={14} />, count: localUnreadCount },
                { id: 'read', label: 'Read', icon: <Check size={14} /> },
              ].map(({ id, label, icon, count }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === id
                      ? 'text-[#35475C] bg-[#F4F7FA] border-b-2 border-[#35475C]'
                      : 'text-[#4F5F73] hover:bg-[#EEF1F4]'
                  }`}
                >
                  {icon}
                  {label}
                  {count !== undefined && count > 0 && (
                    <span className="h-4 min-w-4 rounded-full bg-red-600 text-white text-[10px] font-semibold px-1.5 text-center">{count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Mark all as read button */}
          {localUnreadCount > 0 && (
            <div className="border-b border-[#D7DEE6] px-3 py-2">
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markAllLoading}
                className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-[#35475C] hover:text-[#1F2D3D] hover:bg-[#EEF1F4] rounded-lg py-1.5"
              >
                {markAllLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Mark all as read
              </button>
            </div>
          )}

          {/* Notification list */}
          <div className="max-h-[50vh] overflow-y-auto">
            {loading && localBellItems.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[#4F5F73]">Loading…</p>
            ) : error && localBellItems.length === 0 ? (
              <div className="px-4 py-4 text-sm text-red-700">{error} <button type="button" onClick={reload} className="font-semibold underline">Retry</button></div>
            ) : filteredItems.length ? (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`border-b border-[#EEF1F4] px-4 py-2 hover:bg-[#EEF1F4] ${!item.is_read ? 'bg-[#F4F7FA]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-[#1F2D3D] flex-1">{item.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {!item.is_read && (
                        <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" />
                      )}
                      <button
                        type="button"
                        onClick={() => item.is_read ? handleMarkUnread(item.id) : handleMarkRead(item.id)}
                        className="p-1 text-[#4F5F73] hover:text-[#1F2D3D] hover:bg-[#D7DEE6] rounded"
                        aria-label={item.is_read ? 'Mark as unread' : 'Mark as read'}
                      >
                        {item.is_read ? <X size={14} /> : <Check size={14} />}
                      </button>
                    </div>
                  </div>
                  <span className="mt-0.5 block text-sm text-[#33445A]">{item.message}</span>
                  <span className="mt-0.5 block text-xs text-[#4F5F73]">{timeAgo(item.created_at)}</span>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-sm text-[#4F5F73]">
                {activeTab === 'unread' ? 'No unread notifications' : activeTab === 'read' ? 'No read notifications' : 'You\'re all caught up.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
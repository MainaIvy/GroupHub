import { useCallback, useEffect, useState } from 'react';
import axios from '../../api';

const ROOT = '/api/accounts';
const POLL_MS = 30000;

// Notifications, pending invites / join requests, and the unread message total.
export default function useStudentNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [messageUnread, setMessageUnread] = useState(0);
  const [unreadByGroup, setUnreadByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [notificationResponse, unreadResponse] = await Promise.all([
        axios.get(`${ROOT}/notifications/`),
        axios.get(`${ROOT}/chat/unread-counts/`).catch(() => ({ data: {} })),
      ]);
      setNotifications(Array.isArray(notificationResponse.data) ? notificationResponse.data : []);
      const rawCounts = unreadResponse.data && typeof unreadResponse.data === 'object' ? unreadResponse.data : {};
      const counts = Object.values(rawCounts);
      setUnreadByGroup(rawCounts);
      setMessageUnread(counts.reduce((sum, value) => sum + (Number(value) || 0), 0));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const markRead = useCallback(async (id) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    try {
      await axios.post(`${ROOT}/notifications/${id}/read/`);
    } catch {
      load();
    }
  }, [load]);

  const bellItems = notifications.filter((item) => item.notification_type !== 'message_received');
  const unreadBell = bellItems.filter((item) => !item.is_read).length;
  const invites = notifications.filter((item) => item.notification_type === 'group_invitation' && !item.is_read && item.related_invite_id);
  const joinRequests = notifications.filter((item) => item.notification_type === 'join_request' && !item.is_read && item.related_join_request_id);

  return { notifications, bellItems, unreadBell, invites, joinRequests, messageUnread, unreadByGroup, loading, error, reload: load, markRead };
}

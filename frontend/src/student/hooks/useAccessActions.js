import { useState } from 'react';
import axios from '../../api';

const ROOT = '/api/accounts';

// Accept/decline invites and approve/decline join requests surfaced through notifications.
export default function useAccessActions({ notif, refreshGroups, reloadInsights }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const run = async (notification, url, joined) => {
    setBusyId(notification.id);
    setError('');
    try {
      await axios.post(url);
      await notif.markRead(notification.id);
      if (joined) await refreshGroups();
      await notif.reload();
      reloadInsights();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'That action could not be completed.');
    } finally {
      setBusyId(null);
    }
  };

  return {
    busyId,
    error,
    clearError: () => setError(''),
    acceptInvite: (item) => run(item, `${ROOT}/invites/${item.related_invite_id}/accept/`, true),
    declineInvite: (item) => run(item, `${ROOT}/invites/${item.related_invite_id}/decline/`, false),
    approveRequest: (item) => run(item, `${ROOT}/join-requests/${item.related_join_request_id}/approve/`, true),
    declineRequest: (item) => run(item, `${ROOT}/join-requests/${item.related_join_request_id}/decline/`, false),
  };
}

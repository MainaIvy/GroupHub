import { useState } from 'react';
import axios from '../../api';

const ROOT = '/api/accounts';

// Task actions for one group. Each action resolves to { ok }, { warning } (needs confirmation) or { error }.
export default function useTaskActions(groupId, reload) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = `${ROOT}/groups/${groupId}`;

  const run = async (request, fallback) => {
    setBusy(true);
    setError('');
    try {
      const response = await request();
      if (response.data?.requires_confirmation) {
        return { warning: response.data.balance_warning || 'This would create an uneven workload.' };
      }
      await reload();
      return { ok: true, data: response.data };
    } catch (requestError) {
      const message = requestError.response?.data?.error || fallback;
      setError(message);
      return { error: message };
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    error,
    clearError: () => setError(''),
    propose: (payload) => run(() => axios.post(`${base}/tasks/propose/`, payload), 'Unable to propose this task.'),
    approve: (task, { mode, assignedToId, confirm }) => run(() => axios.post(`${base}/tasks/${task.id}/approve/`, {
      assignment_mode: mode,
      assigned_to_id: assignedToId ? Number(assignedToId) : undefined,
      confirm_override: confirm ? true : undefined,
    }), 'Unable to approve this task.'),
    claim: (task, confirm) => run(() => axios.post(`${base}/tasks/${task.id}/claim/`, { confirm_override: confirm ? true : undefined }), 'Unable to claim this task.'),
    reassign: (task, assignedToId, confirm) => run(() => axios.post(`${base}/tasks/${task.id}/reassign/`, {
      assigned_to_id: Number(assignedToId),
      confirm_override: confirm ? true : undefined,
    }), 'Unable to reassign this task.'),
    changeWeight: (task, weight) => run(() => axios.post(`${base}/tasks/${task.id}/weight/`, { weight: Number(weight) }), 'Unable to change the weight.'),
    confirmWeight: (task) => run(() => axios.post(`${base}/tasks/${task.id}/confirm-weight/`, {}), 'Unable to confirm the weight.'),
    setStatus: (task, status) => run(() => axios.post(`${ROOT}/tasks/${task.id}/update-status/`, { status }), 'Unable to update this task.'),
    comment: (task, content) => run(() => axios.post(`${base}/comments/`, { task_id: task.id, content }), 'Unable to add this comment.'),
  };
}

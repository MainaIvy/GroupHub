import { useCallback, useEffect, useState } from 'react';
import axios from '../../api';
import { safeArray } from '../utils';

const ROOT = '/api/accounts';
const REFRESH_MS = 30000;
const EMPTY = { workspace: null, balance: null, activity: [], comments: [], projects: [] };

// Everything the group workspace page reads, refreshed silently so open panels do not flicker.
export default function useGroupWorkspaceData(groupId) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!groupId) return;
    if (!silent) setLoading(true);
    const base = `${ROOT}/groups/${groupId}`;
    const [workspace, balance, activity, comments, projects] = await Promise.allSettled([
      axios.get(`${base}/workspace/`),
      axios.get(`${base}/balance/`),
      axios.get(`${base}/activity/`),
      axios.get(`${base}/comments/`),
      axios.get(`${base}/projects/`),
    ]);
    if (workspace.status === 'rejected') {
      if (!silent) setError(workspace.reason?.response?.data?.error || 'Unable to load this group.');
      setLoading(false);
      return;
    }
    setData({
      workspace: workspace.value.data,
      balance: balance.status === 'fulfilled' ? balance.value.data : null,
      activity: activity.status === 'fulfilled' ? safeArray(activity.value.data) : [],
      comments: comments.status === 'fulfilled' ? safeArray(comments.value.data) : [],
      projects: projects.status === 'fulfilled' ? safeArray(projects.value.data) : [],
    });
    setError('');
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    setData(EMPTY);
    setError('');
    load();
    const timer = window.setInterval(() => load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  return { ...data, loading, error, reload: () => load(true), retry: () => load(false) };
}

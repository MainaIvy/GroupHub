import { useCallback, useEffect, useState } from 'react';
import axios from '../../api';
import { safeArray } from '../utils';

const ROOT = '/api/accounts';
const POLL_REFRESH_MS = 15000;

// Polls (for the overview and my-vote hints) and files shared in the group chat.
export default function useWorkspaceExtras(groupId, filesEnabled) {
  const [polls, setPolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [pollsError, setPollsError] = useState('');
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    setPolls([]);
    setPollsLoading(true);
    const load = () => axios.get(`${ROOT}/groups/${groupId}/polls/`)
      .then((response) => { if (!cancelled) { setPolls(safeArray(response.data)); setPollsError(''); } })
      .catch((requestError) => { if (!cancelled) setPollsError(requestError.response?.data?.error || 'Unable to load polls.'); })
      .finally(() => { if (!cancelled) setPollsLoading(false); });
    load();
    const timer = window.setInterval(load, POLL_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [groupId]);

  const loadFiles = useCallback(async () => {
    if (!groupId) return;
    setFilesLoading(true);
    setFilesError('');
    try {
      const room = await axios.get(`${ROOT}/groups/${groupId}/chat-room/`);
      const messages = await axios.get(`${ROOT}/chat/messages/${room.data.id}/`);
      setFiles(safeArray(messages.data).filter((message) => message.attachment_url).reverse());
    } catch (requestError) {
      setFilesError(requestError.response?.data?.error || 'Unable to load shared files.');
    } finally {
      setFilesLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (filesEnabled) loadFiles();
  }, [filesEnabled, loadFiles]);

  return { polls, pollsLoading, pollsError, files, filesLoading, filesError, reloadFiles: loadFiles };
}

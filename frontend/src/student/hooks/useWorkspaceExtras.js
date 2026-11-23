import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../api';
import { safeArray } from '../utils';

const ROOT = '/api/accounts';
const POLL_REFRESH_MS = 15000;

// Normalize a chat message attachment into a common file shape.
const chatFile = (message) => ({
  id: `chat-${message.id}`,
  name: message.attachment_name || 'shared-file',
  url: message.attachment_url,
  sharedBy: `${message.sender?.first_name || ''} ${message.sender?.last_name || ''}`.trim() || 'Member',
  date: message.timestamp,
  source: 'chat',
});

// Normalize a submission attachment into the common file shape.
const submissionFile = (submission, attachment) => ({
  id: `sub-att-${submission.id}-${attachment.id}`,
  name: attachment.name,
  url: attachment.url,
  sharedBy: submission.submitted_by_name || 'Member',
  date: submission.submitted_at,
  source: 'submission',
});

// Normalize a submission screenshot into the common file shape.
const screenshotFile = (submission) => ({
  id: `sub-screen-${submission.id}`,
  name: 'Screenshot',
  url: submission.screenshot_url,
  sharedBy: submission.submitted_by_name || 'Member',
  date: submission.submitted_at,
  source: 'submission',
});

// Normalize a task work-item file into the common file shape.
const workItemFile = (workItem) => ({
  id: `work-${workItem.id}`,
  name: workItem.file_name || 'Work file',
  url: workItem.file_url,
  sharedBy: workItem.author_name || 'Member',
  date: workItem.created_at,
  source: 'work',
});

// Build the list of files attached to submissions and work items from the
// already-loaded workspace payload (no extra API call needed).
const workspaceFiles = (workspace) => {
  const files = [];
  if (!workspace) return files;

  safeArray(workspace.submissions).forEach((submission) => {
    safeArray(submission.attachments).forEach((attachment) => {
      files.push(submissionFile(submission, attachment));
    });
    if (submission.screenshot_url) {
      files.push(screenshotFile(submission));
    }
  });

  safeArray(workspace.tasks).forEach((task) => {
    safeArray(task.work_items).forEach((workItem) => {
      if (workItem.file_url) {
        files.push(workItemFile(workItem));
      }
    });
  });

  return files;
};

// Polls (for the overview and my-vote hints) and files shared in the group chat,
// plus files attached to submissions and work items.
export default function useWorkspaceExtras(groupId, filesEnabled, workspace) {
  const [polls, setPolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [pollsError, setPollsError] = useState('');
  const [chatFiles, setChatFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    setChatFiles([]);
    setFilesLoading(true);
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
      setChatFiles(safeArray(messages.data).filter((message) => message.attachment_url).map(chatFile).reverse());
    } catch (requestError) {
      setFilesError(requestError.response?.data?.error || 'Unable to load shared files.');
    } finally {
      setFilesLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (filesEnabled) loadFiles();
  }, [filesEnabled, loadFiles]);

  const files = useMemo(() => {
    const ws = workspaceFiles(workspace);
    return [...chatFiles, ...ws];
  }, [chatFiles, workspace]);

  return { polls, pollsLoading, pollsError, files, filesLoading, filesError, reloadFiles: loadFiles };
}

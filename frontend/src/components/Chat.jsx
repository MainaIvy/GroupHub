import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from '../api';
import { ArrowLeft, Copy, FileText, MessageCircle, MoreHorizontal, Paperclip, Search, Send, Trash2, UserRound, UserRoundPlus, UsersRound } from 'lucide-react';

const API_ROOT = '/api/accounts';

const authorizedRequest = (config) => axios.request(config);

function displayName(user) {
  return `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Group member';
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function renderMessageContent(content, onTaskReference, groupId) {
  return String(content || '').split(/(#task-\d+)/gi).map((part, index) => {
    const match = part.match(/^#task-(\d+)$/i);
    if (!match) return part;
    if (!groupId || !onTaskReference) return <span key={`${match[1]}-${index}`} className="mx-0.5 rounded bg-[#DDEBE5] px-1.5 py-0.5 font-semibold text-[#1F6B5C]">#task-{match[1]}</span>;
    return <button key={`${match[1]}-${index}`} type="button" onClick={() => onTaskReference?.(match[1], groupId)} className="mx-0.5 rounded bg-[#DDEBE5] px-1.5 py-0.5 font-semibold text-[#1F6B5C] underline decoration-dotted underline-offset-2">#task-{match[1]}</button>;
  });
}

const Chat = ({ onCreateGroup, onGroupDeleted = () => {}, groupRefreshKey = 0, groupId = null, onTaskReference, onAssignTask, groupTasks = [] }) => {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [roomTasks, setRoomTasks] = useState([]);
  const [draft, setDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [roomSearch, setRoomSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(null);
  const [roomMenuId, setRoomMenuId] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [connectionState, setConnectionState] = useState('connecting');
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskPickerQuery, setTaskPickerQuery] = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const draftRef = useRef(null);

  const activeRoom = rooms.find((room) => String(room.id) === String(activeRoomId));
  const filteredRooms = useMemo(() => {
    const query = roomSearch.trim().toLowerCase();
    const scopedRooms = groupId ? rooms.filter((room) => String(room.group_id) === String(groupId)) : rooms;
    return query ? scopedRooms.filter((room) => `${room.name} ${room.last_message || ''}`.toLowerCase().includes(query)) : scopedRooms;
  }, [groupId, roomSearch, rooms]);
  const filteredContacts = useMemo(() => {
    const query = roomSearch.trim().toLowerCase();
    return query ? contacts.filter((contact) => displayName(contact).toLowerCase().includes(query) || contact.email?.toLowerCase().includes(query)) : contacts;
  }, [contacts, roomSearch]);
  const sharedFiles = messages.filter((message) => message.attachment_url);
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  })();

  const openNewChat = async () => {
    setShowContacts(true);
    setRoomSearch('');
    if (contacts.length || loadingContacts) return;
    setLoadingContacts(true);
    setError('');
    try {
      const response = await authorizedRequest({ method: 'GET', url: `${API_ROOT}/chat/contacts/` });
      setContacts(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load people from your groups.');
    } finally {
      setLoadingContacts(false);
    }
  };

  const startDirectChat = async (contact) => {
    setError('');
    try {
      const response = await authorizedRequest({ method: 'POST', url: `${API_ROOT}/chat/direct/`, data: { user_id: contact.id } });
      const directRoom = { ...response.data, type: 'direct' };
      setRooms((current) => [directRoom, ...current.filter((room) => String(room.id) !== String(directRoom.id))]);
      setActiveRoomId(directRoom.id);
      setShowContacts(false);
      setRoomSearch('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to start a private chat.');
    }
  };

  const deleteConversation = async (room) => {
    const deletesGroup = room.type === 'group';
    if (deletesGroup && !room.can_delete) return;
    const message = deletesGroup
      ? `Delete group “${room.name}” and its chat for everyone? This cannot be undone.`
      : `Delete your private conversation with ${room.name}? This removes it for both participants.`;
    if (!window.confirm(message)) return;
    try {
      if (deletesGroup) {
        await authorizedRequest({ method: 'DELETE', url: `${API_ROOT}/groups/${room.group_id}/delete/` });
        onGroupDeleted(room.group_id);
      } else {
        await authorizedRequest({ method: 'DELETE', url: `${API_ROOT}/chat/rooms/${room.id}/` });
      }
      const remainingRooms = rooms.filter((item) => item.id !== room.id);
      setRooms(remainingRooms);
      if (String(activeRoomId) === String(room.id)) setActiveRoomId(remainingRooms[0]?.id || null);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to delete conversation.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadRooms = async () => {
      setLoadingRooms(true);
      setError('');
      try {
        const [response, unreadResponse] = await Promise.all([
          authorizedRequest({ method: 'GET', url: `${API_ROOT}/chat/rooms/` }),
          authorizedRequest({ method: 'GET', url: `${API_ROOT}/chat/unread-counts/` }),
        ]);
        if (cancelled) return;
        const nextRooms = Array.isArray(response.data) ? response.data : [];
        setUnreadCounts(unreadResponse.data || {});
        setRooms(nextRooms);
        const preferredRoom = groupId ? nextRooms.find((room) => String(room.group_id) === String(groupId)) : null;
        setActiveRoomId((current) => preferredRoom?.id || (nextRooms.some((room) => String(room.id) === String(current)) ? current : nextRooms[0]?.id || null));
      } catch (requestError) {
        if (!cancelled) setError(requestError.response?.data?.error || 'Unable to load your conversations.');
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    };
    loadRooms();
    return () => { cancelled = true; };
  }, [groupId, groupRefreshKey]);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      setMembers([]);
      setRoomTasks([]);
      return undefined;
    }
    let cancelled = false;
    const loadRoomData = async () => {
      setLoadingMessages(true);
      setError('');
      try {
        const [messageResponse, memberResponse] = await Promise.all([
          authorizedRequest({ method: 'GET', url: `${API_ROOT}/chat/messages/${activeRoomId}/` }),
          activeRoom?.group_id
            ? authorizedRequest({ method: 'GET', url: `${API_ROOT}/groups/${activeRoom.group_id}/members/` })
            : Promise.resolve({ data: [] }),
        ]);
        const workspaceResponse = activeRoom?.group_id
          ? await authorizedRequest({ method: 'GET', url: `${API_ROOT}/groups/${activeRoom.group_id}/workspace/` })
          : null;
        if (cancelled) return;
        setMessages((current) => {
          const merged = new Map(current.map((message) => [message.id, message]));
          for (const message of Array.isArray(messageResponse.data) ? messageResponse.data : []) merged.set(message.id, message);
          return Array.from(merged.values()).sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
        });
        setMembers(Array.isArray(memberResponse.data) ? memberResponse.data : []);
        setRoomTasks(Array.isArray(workspaceResponse?.data?.tasks) ? workspaceResponse.data.tasks : []);
        await authorizedRequest({ method: 'POST', url: `${API_ROOT}/chat/${activeRoomId}/mark-read/` });
        if (!cancelled) setUnreadCounts((current) => ({ ...current, [String(activeRoomId)]: 0 }));
      } catch (requestError) {
        if (!cancelled) setError(requestError.response?.data?.error || 'Unable to load this conversation.');
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };
    loadRoomData();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/chat/${activeRoomId}/?token=${encodeURIComponent(localStorage.getItem('access_token') || '')}`);
    socketRef.current = socket;
    socket.onopen = () => setConnectionState('connected');
    socket.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        if (!incoming.id) return;
        setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
        if (Number(incoming.sender?.id) !== Number(currentUser?.id)) {
          authorizedRequest({ method: 'POST', url: `${API_ROOT}/chat/${activeRoomId}/mark-read/` })
            .then(() => setUnreadCounts((current) => ({ ...current, [String(activeRoomId)]: 0 })))
            .catch(() => {});
        }
      } catch {
        setError('A chat update could not be read.');
      }
    };
    socket.onerror = () => setConnectionState('offline');
    socket.onclose = () => setConnectionState('offline');
    return () => {
      cancelled = true;
      if (socketRef.current === socket) socketRef.current = null;
      socket.close();
    };
  }, [activeRoomId, activeRoom?.group_id, currentUser?.id]);

  useEffect(() => {
    const refreshUnreadCounts = async () => {
      try {
        const response = await authorizedRequest({ method: 'GET', url: `${API_ROOT}/chat/unread-counts/` });
        setUnreadCounts(response.data || {});
      } catch {
        // Keep last known badge values when a refresh briefly fails.
      }
    };
    const intervalId = window.setInterval(refreshUnreadCounts, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (sending || (!draft.trim() && !selectedFile) || !activeRoomId) return;
    if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
      setError('That file is over 10 MB. Choose a smaller file.');
      return;
    }
    if (selectedFile && !/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|png|jpe?g|webp|gif|heic)$/i.test(selectedFile.name)) {
      setError('That file type is not supported. Choose a document or photo.');
      return;
    }
    setSending(true);
    setError('');
    try {
      if (selectedFile) {
        const payload = new FormData();
        payload.append('content', draft.trim());
        payload.append('file', selectedFile);
        const response = await authorizedRequest({ method: 'POST', url: `${API_ROOT}/chat/send/${activeRoomId}/`, data: payload });
        setMessages((current) => current.some((item) => item.id === response.data.id) ? current : [...current, response.data]);
      } else if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ content: draft.trim() }));
      } else {
        const payload = new FormData();
        payload.append('content', draft.trim());
        const response = await authorizedRequest({ method: 'POST', url: `${API_ROOT}/chat/send/${activeRoomId}/`, data: payload });
        setMessages((current) => current.some((item) => item.id === response.data.id) ? current : [...current, response.data]);
      }
      setDraft('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const pickerTasks = safeArray(groupTasks).length ? safeArray(groupTasks) : roomTasks;
  const taskPickerItems = pickerTasks.filter((task) => (
    `${task.title} ${task.project_name || task.project_title || ''} ${task.id}`.toLowerCase().includes(taskPickerQuery.toLowerCase())
  ));

  const insertTaskReference = (task) => {
    const textarea = draftRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, start)}#task-${task.id} ${draft.slice(end)}`;
    setDraft(nextDraft);
    setTaskPickerOpen(false);
    setTaskPickerQuery('');
    requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + `#task-${task.id} `.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const downloadAttachment = async (message) => {
    setDownloadBusy(message.id);
    try {
      const response = await fetch(message.attachment_url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      });
      if (!response.ok) throw new Error('This document could not be downloaded.');
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = message.attachment_name || 'shared-document';
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      setError(downloadError.message || 'This document could not be downloaded.');
    } finally {
      setDownloadBusy(null);
    }
  };

  const isMine = (message) => message.sender?.id && currentUser?.id
    ? Number(message.sender.id) === Number(currentUser.id)
    : displayName(message.sender) === displayName(currentUser);

  return (
    <section className="grid h-[min(74vh,760px)] min-h-[520px] grid-cols-1 overflow-hidden rounded-lg border border-[#DDE7E2] bg-white text-[#17332F] md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_230px]" aria-label="Group chat workspace">
      <aside className="flex min-h-0 flex-col border-b border-[#DDE7E2] bg-[#F7F9F8] md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-[#E6ECE9] px-4 py-4">
          <div>
            <h2 className="text-sm font-bold">{showContacts ? 'New chat' : 'Messages'}</h2>
            <p className="mt-0.5 text-[10px] text-[#789089]">{showContacts ? 'People in your groups' : 'Group and private conversations'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {showContacts && <button type="button" onClick={() => { setShowContacts(false); setRoomSearch(''); }} aria-label="Back to conversations" title="Back to conversations" className="flex h-8 w-8 items-center justify-center rounded-full text-[#68817A] hover:bg-[#EAF4F0]"><ArrowLeft size={15} aria-hidden="true" /></button>}
            {!showContacts && <button type="button" onClick={openNewChat} aria-label="New private chat" title="New private chat" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C7DAD1] bg-white text-[#1F6B5C] hover:bg-[#EAF4F0]"><UserRoundPlus size={15} aria-hidden="true" /></button>}
          </div>
        </div>
        <label className="relative mx-3 my-3 block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#789089]" aria-hidden="true" />
          <input value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder={showContacts ? 'Search people' : 'Search chats'} className="h-8 w-full rounded-md border border-[#E0E8E4] bg-white pl-8 pr-2 text-[11px] outline-none focus:border-[#1F6B5C]" />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {showContacts ? (
            loadingContacts ? <p className="px-3 py-4 text-xs text-[#789089]">Loading people…</p> : filteredContacts.map((contact) => (
              <button key={contact.id} type="button" onClick={() => startDirectChat(contact)} className="mb-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-3 text-left hover:bg-[#EEF3F1]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8E8F4] text-[#55558A]"><UserRound size={16} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{displayName(contact)}</span><span className="mt-1 block truncate text-[10px] text-[#789089]">{contact.user_type === 'lecturer' ? 'Lecturer' : 'Student'} · {contact.email}</span></span>
              </button>
            ))
          ) : loadingRooms ? <p className="px-3 py-4 text-xs text-[#789089]">Loading chats…</p> : filteredRooms.map((room) => (
            <div key={room.id} className={`mb-1 flex items-center rounded-md pr-1 ${String(room.id) === String(activeRoomId) ? 'bg-[#E3F0EB]' : 'hover:bg-[#EEF3F1]'}`}>
              <button type="button" onClick={() => setActiveRoomId(room.id)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#78A99A]">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${room.type === 'direct' ? 'bg-[#E8E8F4] text-[#55558A]' : 'bg-[#DDEBE5] text-[#1F6B5C]'}`}>{room.type === 'direct' ? <UserRound size={16} aria-hidden="true" /> : <UsersRound size={16} aria-hidden="true" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{room.name}</span>
                  <span className="mt-1 block truncate text-[10px] text-[#789089]">{room.last_message || 'Start a conversation'}</span>
                </span>
                {Number(unreadCounts[String(room.id)] ?? room.unread_count ?? 0) > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1F6B5C] px-1 text-[9px] font-bold text-white">{unreadCounts[String(room.id)] ?? room.unread_count}</span>}
              </button>
              {(room.type === 'direct' || room.can_delete) && <div className="relative"><button type="button" onClick={() => setRoomMenuId((current) => current === room.id ? null : room.id)} aria-label={`More actions for ${room.name}`} aria-expanded={roomMenuId === room.id} title="More actions" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#68817A] hover:bg-white"><MoreHorizontal size={16} aria-hidden="true" /></button>{roomMenuId === room.id && <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border border-[#DDE7E2] bg-white p-1 shadow-lg"><button type="button" role="menuitem" onClick={() => deleteConversation(room)} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 size={13} aria-hidden="true" />{room.type === 'direct' ? 'Delete conversation' : 'Delete group'}</button></div>}</div>}
            </div>
          ))}
          {showContacts && !loadingContacts && !filteredContacts.length && (
            <div className="px-3 py-5 text-center"><p className="text-xs font-semibold">No people found</p><p className="mt-1 text-[10px] text-[#789089]">You can privately message people who share one of your groups.</p></div>
          )}
          {!showContacts && !loadingRooms && !filteredRooms.length && (
            <div className="px-3 py-5 text-center">
              <p className="text-xs font-semibold">No conversations yet</p>
              <p className="mt-1 text-[10px] text-[#789089]">Create a group from the Groups page to open its shared chat.</p>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        {activeRoom ? (
          <>
            <header className="flex items-center justify-between border-b border-[#E6ECE9] px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${activeRoom.type === 'direct' ? 'bg-[#E8E8F4] text-[#55558A]' : 'bg-[#DDEBE5] text-[#1F6B5C]'}`}>{activeRoom.type === 'direct' ? <UserRound size={17} aria-hidden="true" /> : <UsersRound size={17} aria-hidden="true" />}</span>
                <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{activeRoom.name}</h3><p className="text-[10px] text-[#789089]">{activeRoom.type === 'direct' ? 'Private conversation' : `${members.length || 1} members · Group chat`}</p></div>
              </div>
              <div className="flex items-center gap-3">
                {activeRoom.type === 'group' && <button type="button" onClick={() => onAssignTask?.(activeRoom.group_id)} className="rounded-md border border-[#C7DAD1] px-2.5 py-1.5 text-[10px] font-semibold text-[#1F6B5C] hover:bg-[#EAF4F0]">Assign a task</button>}
                <span className="flex items-center gap-1.5 text-[10px] text-[#68817A]"><span className={`h-1.5 w-1.5 rounded-full ${connectionState === 'connected' ? 'bg-[#52A785]' : 'bg-[#D69A32]'}`} />{connectionState === 'connected' ? 'Live' : 'Reconnecting'}</span>
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#FBFCFB] px-4 py-5 sm:px-6">
              {loadingMessages && <p className="text-center text-[11px] text-[#789089]">Loading conversation…</p>}
              {!loadingMessages && !messages.length && <div className="py-10 text-center"><MessageCircle size={25} className="mx-auto text-[#8CA59D]" /><p className="mt-3 text-sm font-semibold">{activeRoom.type === 'direct' ? 'Say hello' : 'A new group conversation'}</p><p className="mt-1 text-xs text-[#789089]">{activeRoom.type === 'direct' ? 'Start a private conversation.' : 'Share an update or a document with your group.'}</p></div>}
              {messages.map((message) => {
                const own = isMine(message);
                return (
                  <article key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] rounded-lg px-3.5 py-2.5 sm:max-w-[76%] ${own ? 'bg-[#DCEFE7] text-[#17332F]' : 'border border-[#E4EBE7] bg-white text-[#29443E]'}`}>
                      <div className="mb-1 flex items-center justify-between gap-5"><span className="text-[10px] font-semibold">{own ? 'You' : displayName(message.sender)}</span><time className="text-[9px] text-[#789089]">{new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>
                      {message.content && <p className="whitespace-pre-wrap wrap-break-word text-xs leading-5">{renderMessageContent(message.content, onTaskReference, activeRoom?.group_id)}</p>}
                      {message.attachment_url && <button type="button" onClick={() => downloadAttachment(message)} className="mt-2 flex w-full items-center gap-2 rounded-md border border-[#C7DAD1] bg-white/70 px-2.5 py-2 text-left text-xs font-semibold text-[#1F6B5C] hover:bg-white"><FileText size={16} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{message.attachment_name}</span><span className="text-[10px]">{downloadBusy === message.id ? '…' : 'Download'}</span></button>}
                    </div>
                  </article>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {error && <p role="alert" className="mx-4 mt-2 rounded-md border border-[#E7BDB7] bg-[#FBEFED] px-3 py-2 text-[11px] text-[#A54136]">{error}</p>}
            {selectedFile && <div className="mx-4 mt-2 flex items-center justify-between rounded-md bg-[#EAF4F0] px-3 py-2 text-[11px] text-[#1F6B5C]"><span className="truncate">Attached: {selectedFile.name}</span><button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} aria-label="Remove attachment">×</button></div>}
            <form onSubmit={handleSend} className="border-t border-[#E6ECE9] bg-white p-3 sm:px-4 sm:py-3.5">
              <div className="flex items-end gap-2 rounded-lg border border-[#DDE7E2] bg-[#FBFCFB] p-2 focus-within:border-[#78A99A]">
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.heic" onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); setError(file && file.size > 10 * 1024 * 1024 ? 'That file is over 10 MB. Choose a smaller file.' : ''); }} className="hidden" />
                <button type="button" aria-label="Attach a document" title="Attach a document (max 10 MB)" onClick={() => fileInputRef.current?.click()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#68817A] hover:bg-[#EAF4F0] hover:text-[#1F6B5C]"><Paperclip size={17} aria-hidden="true" /></button>
                <div className="relative min-w-0 flex-1">
                  {taskPickerOpen && activeRoom.type === 'group' && <div className="absolute bottom-full left-0 z-30 mb-2 max-h-48 w-full overflow-y-auto rounded-md border border-[#DDE7E2] bg-white p-1 shadow-lg">{taskPickerItems.length ? taskPickerItems.slice(0, 8).map((task) => <button key={task.id} type="button" onClick={() => insertTaskReference(task)} className="flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left hover:bg-[#EAF4F0]"><span className="truncate text-xs font-medium text-[#17332F]">{task.title}</span><span className="shrink-0 text-[9px] text-[#789089]">#{task.id}</span></button>) : <p className="px-2.5 py-2 text-[10px] text-[#789089]">No matching tasks.</p>}</div>}
                  <textarea ref={draftRef} value={draft} onChange={(event) => { const value = event.target.value; setDraft(value); const cursor = event.target.selectionStart; const prefix = value.slice(0, cursor); const hashIndex = prefix.lastIndexOf('#'); const query = hashIndex >= 0 ? prefix.slice(hashIndex + 1) : ''; const isTaskQuery = hashIndex >= 0 && !/\s/.test(query); setTaskPickerOpen(activeRoom.type === 'group' && isTaskQuery); setTaskPickerQuery(query.replace(/^task-?/i, '')); }} onKeyDown={(event) => { if (event.key === 'Escape') setTaskPickerOpen(false); if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); setTaskPickerOpen(false); event.currentTarget.form.requestSubmit(); } }} rows={1} placeholder="Write a message…" className="max-h-24 min-h-8 w-full resize-y bg-transparent px-1 py-1.5 text-xs text-[#17332F] outline-none placeholder:text-[#94A8A1]" />
                </div>
                <button type="submit" disabled={sending || (!draft.trim() && !selectedFile)} aria-label="Send message" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#163F3A] text-white hover:bg-[#24564F] disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} aria-hidden="true" /></button>
              </div>
              <p className="mt-1.5 pl-1 text-[9px] text-[#91A39D]">Documents are saved to this conversation · 10 MB max</p>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <MessageCircle size={30} className="text-[#7B9D91]" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold">Your group chats live here</h3>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[#789089]">Create a group to start messaging, sharing coursework, and keeping documents together.</p>
            <button type="button" onClick={onCreateGroup} className="mt-4 rounded-md bg-[#163F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#24564F]">Create a group</button>
          </div>
        )}
      </div>

      <aside className="hidden min-h-0 flex-col border-l border-[#E6ECE9] bg-white xl:flex">
        <div className="border-b border-[#E6ECE9] px-4 py-4">
          <h3 className="text-xs font-bold">{activeRoom?.type === 'direct' ? 'Contact info' : 'Group info'}</h3>
          <p className="mt-1 truncate text-[10px] text-[#789089]">{activeRoom?.name || 'Select a conversation'}</p>
          {activeRoom?.join_code && <div className="mt-3 rounded-md bg-[#F3F7F5] p-2"><span className="block text-[9px] font-semibold uppercase tracking-wide text-[#789089]">Invite code</span><div className="mt-1 flex items-center justify-between gap-2"><code className="text-xs font-bold tracking-wider text-[#1F6B5C]">{activeRoom.join_code}</code><button type="button" title="Copy invite code" aria-label="Copy invite code" onClick={() => navigator.clipboard?.writeText(activeRoom.join_code)} className="text-[#68817A] hover:text-[#1F6B5C]"><Copy size={13} aria-hidden="true" /></button></div></div>}
          {activeRoom?.description && <p className="mt-2 text-[10px] leading-4 text-[#68817A]">{activeRoom.description}</p>}
        </div>
        {activeRoom?.type === 'group' && <div className="border-b border-[#E6ECE9] px-4 py-4"><div className="flex items-center justify-between"><h4 className="text-[10px] font-semibold uppercase tracking-wide text-[#68817A]">Members</h4><span className="text-[10px] text-[#789089]">{members.length}</span></div><div className="mt-3 space-y-2.5">{members.slice(0, 8).map((membership) => <div key={membership.id} className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF4F0] text-[9px] font-semibold text-[#1F6B5C]">{`${membership.student?.first_name?.trim()?.[0] || ''}${membership.student?.last_name?.trim()?.[0] || ''}`.toUpperCase() || 'U'}</span><span className="truncate text-[10px] font-medium">{displayName(membership.student)}</span></div>)}</div></div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4"><div className="flex items-center justify-between"><h4 className="text-[10px] font-semibold uppercase tracking-wide text-[#68817A]">Shared files</h4><span className="text-[10px] text-[#789089]">{sharedFiles.length}</span></div><div className="mt-3 space-y-2">{sharedFiles.map((message) => <button key={message.id} type="button" onClick={() => downloadAttachment(message)} className="flex w-full items-center gap-2 rounded-md border border-[#E6ECE9] p-2 text-left hover:bg-[#F6F9F7]"><FileText size={15} className="shrink-0 text-[#1F6B5C]" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-[10px] font-medium">{message.attachment_name}</span></button>)}{!sharedFiles.length && <p className="text-[10px] leading-4 text-[#91A39D]">Documents shared in chat will be kept here.</p>}</div></div>
      </aside>
    </section>
  );
};

export default Chat;

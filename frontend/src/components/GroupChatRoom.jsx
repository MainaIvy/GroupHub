import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const makeTimeStamp = (isoString) => {
  if (!isoString) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function GroupChatRoom() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [feed, setFeed] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const currentUserName = storedUser?.first_name || storedUser?.full_name || 'You';

  useEffect(() => {
    if (!groupId) return undefined;

    const token = localStorage.getItem('access_token');
    const fetchMessages = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/groups/${groupId}/chat/`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Chat messages unavailable');
        }

        const data = await response.json();
        const history = Array.isArray(data.messages) ? data.messages : [];
        setFeed(
          history.map((message) => ({
            id: message.id,
            type: 'message',
            sender: message.sender_name || message.first_name || 'User',
            senderFirstName: message.first_name || message.sender_name || 'User',
            text: message.content,
            time: makeTimeStamp(message.timestamp),
          }))
        );
      } catch (error) {
        console.error('Failed to load chat history', error);
      }
    };

    fetchMessages();

    if (!token) {
      return undefined;
    }

    const wsUrl = `ws://127.0.0.1:8000/ws/chat/${groupId}/?token=${token}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setFeed((prev) => [
        ...prev,
        {
          id: data.message_id || Date.now(),
          type: 'message',
          sender: data.sender_name || 'User',
          senderFirstName: data.sender_name ? data.sender_name.split(' ')[0] : currentUserName,
          text: data.message,
          time: makeTimeStamp(data.timestamp),
        },
      ]);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [groupId, currentUserName]);

  const sendMessage = () => {
    if (!draft.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({ message: draft.trim() }));
    setDraft('');
  };

  const renderItem = (item) => {
    if (item.type === 'task') {
      return (
        <div key={item.id} className="mx-auto max-w-md rounded-full bg-[#F0EDE4] px-4 py-1.5 text-center text-xs text-[#57534E]">
          {item.text} · {item.time}
        </div>
      );
    }

    if (item.type === 'comment') {
      return (
        <div key={item.id} className="max-w-lg rounded-2xl border border-[#FDECC8] bg-[#FFF8E8] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#92400E]">{item.senderFirstName || item.sender} · lecturer</span>
            <span className="text-[10px] text-[#B8930F]">{item.time}</span>
          </div>
          <div className="mt-1 text-sm text-[#57432B]">{item.text}</div>
        </div>
      );
    }

    return (
      <div key={item.id} className="max-w-lg rounded-2xl rounded-tl-sm border border-[#EDE7D8] bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#1A1A1A]">{item.senderFirstName || item.sender || 'You'}</span>
          <span className="text-[10px] text-[#9C9484]">{item.time}</span>
        </div>
        <div className="mt-1 text-sm text-[#3F3B33]">{item.text}</div>
      </div>
    );
  };

  const roomTitle = `chat_room.png by ${storedUser?.first_name || 'Anonymous'} ${storedUser?.last_name || 'User'}`.trim();

  return (
    <div className="min-h-screen bg-[#f5f2ee] text-[#1a1a1a]" style={{ fontFamily: 'Inter, Segoe UI, sans-serif' }}>
      <div className="flex min-h-screen">
        <aside className="flex w-[92px] flex-col items-center border-r border-[#e8e1d8] bg-[#f4f1ee] px-3 py-5">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f8f8f8] text-xl font-black text-[#111827] shadow-[inset_0_0_0_1px_rgba(17,24,39,0.08)]">
            P
          </div>

          <div className="flex w-full flex-col items-center gap-3">
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg text-[#111827] shadow-sm">⌂</button>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-[#3f3b36]">◫</button>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-[#3f3b36]">◌</button>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-[#3f3b36]">▣</button>
            <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-lg text-[#3f3b36]">◔</button>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-[#3f3b36]">✉</button>
          </div>
        </aside>

        <main className="flex-1 px-6 py-5">
          <div className="rounded-[28px] border border-[#ece3d7] bg-[#f3efe8] p-4 shadow-[0_10px_35px_rgba(17,17,17,0.04)]">
            <div className="mb-5 flex items-center gap-3 rounded-[22px] bg-[#ece8e3] px-4 py-3">
              <span className="text-xl text-[#625d58]">⌕</span>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
                placeholder="Search"
                className="w-full border-none bg-transparent text-base text-[#1a1a1a] placeholder:text-[#6d665f] focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ddd2c6] bg-white text-lg text-[#2a2a2a]">◌</button>
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d7b0d9] text-base font-bold text-white">◉</button>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_1.2fr]">
              <section className="rounded-[30px] border border-[#e7dfd5] bg-[#f9f5f3] p-3">
                <div className="mb-3 flex items-center justify-between bg-[#f3f0ee] px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a]">
                    <span>chat</span>
                    <span className="rounded-full bg-[#efe9f5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b4a8a]">new</span>
                  </div>
                  <button type="button" onClick={() => navigate(-1)} className="rounded-full border border-[#e5ddd3] bg-white p-2 text-lg text-[#3d3935]">←</button>
                </div>

                <div className="space-y-2">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const names = ['Nancy Fernandez', 'Jonathan Smith', 'Olivia George', 'Luca Brown', 'Emma White', 'Daniel Green', 'Aria Reed'];
                    const name = names[index % names.length];
                    const nameParts = name.trim().split(/\s+/).filter(Boolean);
                    const initials = `${nameParts[0]?.[0] || ''}${nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : ''}`.toUpperCase() || 'U';
                    const active = index === 0;

                    return (
                      <div key={name} className={`flex items-center gap-3 rounded-[18px] px-3 py-2 ${active ? 'bg-[#ece6ff]' : 'bg-transparent'}`}>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#efe4f9] via-[#f5d8cf] to-[#cadbf3] text-[11px] font-bold text-[#2a2a2a]">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[#1a1a1a]">{name}</div>
                          <div className="truncate text-[11px] text-[#67615d]">Active now</div>
                        </div>
                        {active && <span className="h-2.5 w-2.5 rounded-full bg-[#ef3d55]" />}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-[18px] bg-[#f4efe9] p-3">
                  <div className="text-lg font-bold text-[#1a1a1a]">↗ Visit site</div>
                </div>
              </section>

              <section className="rounded-[30px] border border-[#e7dfd5] bg-[#f6f0ea] p-4">
                <div className="mb-4 flex items-center justify-end gap-2">
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e8dfd4] bg-white text-lg text-[#292724]">♡</button>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e8dfd4] bg-white text-lg text-[#292724]">◌</button>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e8dfd4] bg-white text-lg text-[#292724]">⇪</button>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e8dfd4] bg-white text-lg text-[#292724]">⋯</button>
                </div>

                <div className="mb-4 rounded-[18px] bg-[#f1eee9] p-3">
                  <h1 className="text-4xl font-black leading-[1.05] tracking-[-0.06em] text-[#111111]">
                    {roomTitle}
                  </h1>
                </div>

                <div className="mb-4 flex items-center justify-center rounded-[18px] bg-[#dfe0e2] px-4 py-5 text-lg font-semibold text-[#1a1a1a]">
                  Visit site
                </div>

                <div className="space-y-3 rounded-[20px] bg-[#faf5f2] p-3">
                  {(feed.length ? feed : [
                    { id: 'placeholder-1', sender: 'Nancy', senderFirstName: 'Nancy', text: 'I have updated the brief and shared the latest milestone notes.', time: '9:45 AM' },
                    { id: 'placeholder-2', sender: 'You', senderFirstName: 'You', text: 'Thanks — I have reviewed them and I will share the final sign-off after the check-in.', time: '9:46 AM' },
                    { id: 'placeholder-3', sender: 'Jonathan', senderFirstName: 'Jonathan', text: 'The group is aligned and the next review is scheduled for today.', time: '9:47 AM' },
                  ]).slice(-3).map((item) => (
                    <div key={item.id} className={`max-w-[80%] rounded-[20px] px-4 py-3 ${item.sender === 'You' || item.senderFirstName === currentUserName ? 'ml-auto bg-gradient-to-br from-[#8a82db] to-[#6d5de5] text-white' : 'bg-white text-[#1a1a1a] shadow-[0_4px_15px_rgba(17,17,17,0.03)]'}`}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-medium">
                        <span>{item.senderFirstName || item.sender || 'You'}</span>
                        <span className={item.sender === 'You' || item.senderFirstName === currentUserName ? 'text-white/80' : 'text-[#7a736d]'}>{item.time}</span>
                      </div>
                      <div className="text-sm leading-relaxed">{item.text}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-full border border-[#e5ddd3] bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(17,17,17,0.04)]">
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
                    className="flex-1 border-none bg-transparent px-2 text-sm text-[#1a1a1a] placeholder:text-[#706b64] focus:outline-none"
                    placeholder="Add a comment to share your thoughts"
                  />
                  <div className="flex items-center gap-2">
                    <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3efe8] text-base text-[#1a1a1a]">☺</button>
                    <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3efe8] text-base text-[#1a1a1a]">⊕</button>
                    <button type="button" onClick={sendMessage} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-base font-bold text-white">➤</button>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[22px] border border-[#e7dfd5] bg-[#faf7f3] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#ece6ff] to-[#f5d8cf] text-[11px] font-bold text-[#2a2a2a]">
                      {['AI', 'GH', 'CP', 'RT'][index]}
                    </div>
                    <button type="button" className="text-lg text-[#5a554f]">⋯</button>
                  </div>
                  <div className="flex h-[86px] items-end gap-2 rounded-[16px] bg-[#eef1f8] p-2">
                    <div className="h-full flex-1 rounded-[10px] bg-white/80" />
                    <div className="h-2/3 flex-1 rounded-[10px] bg-white/80" />
                    <div className="h-1/2 flex-1 rounded-[10px] bg-white/80" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-[#5d5854]">
                    <span>Board {index + 1}</span>
                    <span>{3 + index} people</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default GroupChatRoom;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from '../api';
import { ArrowLeft, Copy, FileText, Image, Loader2, MessageCircle, MoreHorizontal, Paperclip, Search, Send, UserRound, UserRoundPlus, UsersRound, Hash, ChevronDown, ChevronUp, Download, Mic, MicOff, Smile, Play, Pause, Music } from 'lucide-react';

const API_ROOT = '/api/accounts';

const authorizedRequest = (config) => axios.request(config);

function displayName(user) {
  return `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Group member';
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDay(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function groupMessagesByDay(messages) {
  const groups = {};
  for (const msg of messages) {
    const day = formatDay(msg.timestamp);
    if (!groups[day]) groups[day] = [];
    groups[day].push(msg);
  }
  return groups;
}

function isImage(filename) {
  if (!filename) return false;
  const ext = filename.split('.').pop().toLowerCase();
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(ext);
}

// Dashboard color palette
const USER_COLORS = [
  '#35475C', '#4A6079', '#2F4A66', '#1F2D3D', '#33445A',
  '#435B76', '#5B7A9A', '#6B8AA8', '#7C9BB6', '#8DABC4',
];

function getUserColor(userId, users) {
  const index = users.findIndex(u => u.id === userId);
  return USER_COLORS[index % USER_COLORS.length] || USER_COLORS[0];
}

function renderMessageContent(content, onTaskReference, groupId) {
  return String(content || '').split(/(#task-\d+)/gi).map((part, index) => {
    const match = part.match(/^#task-(\d+)$/i);
    if (!match) return part;
    if (!groupId || !onTaskReference) return (
      <span key={`${match[1]}-${index}`} className="mx-0.5 rounded bg-[#D7DEE6] px-1.5 py-0.5 font-semibold text-[#35475C]">
        #task-{match[1]}
      </span>
    );
    return (
      <button key={`${match[1]}-${index}`} type="button" onClick={() => onTaskReference?.(match[1], groupId)} className="mx-0.5 rounded bg-[#D7DEE6] px-1.5 py-0.5 font-semibold text-[#35475C] underline decoration-dotted underline-offset-2">
        #task-{match[1]}
      </button>
    );
  });
}

function renderPollCard(poll) {
  if (!poll) return null;
  const totalVotes = Object.values(poll.options).reduce((sum, opt) => sum + (opt.votes || 0), 0);
  return (
    <div className="mt-1 rounded-lg border border-[#D7DEE6] bg-white p-3">
      <p className="text-sm font-semibold text-[#1F2D3D]">📊 {poll.question}</p>
      <div className="mt-2 space-y-1">
        {Object.entries(poll.options).map(([key, opt]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-[#EEF1F4] overflow-hidden">
              {totalVotes > 0 && (
                <div className="h-full rounded-full bg-[#35475C]" style={{ width: `${(opt.votes / totalVotes) * 100}%` }} />
              )}
            </div>
            <span className="text-xs text-[#4F5F73]">{opt.text} ({opt.votes || 0})</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-[#4F5F73]">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
    </div>
  );
}

// Emoji picker component
const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠'],
  'People': ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👄','👅','👶','🧒','👦','👧','🧑','👱','👨','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🙇','🤦','🤷','🧑‍⚕️','🧑‍🎓','🧑‍⚖️','🧑‍🌾','🧑‍🍳','🧑‍🔧','🧑‍🏭','🧑‍💼','🧑‍🔬','🧑‍💻','🧑‍🎤','🧑‍🎨','🧑‍✈️','🧑‍🚀','🧑‍🚒','👮','🕵️','💂','🥷','👷','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟','💆','💇','🚶','🏃','💃','🕺','🕴️','👯','🧖','🧗','🤺','🏇','⛷️','🏂','🏌️','🏄','🏊','⛹️','🏋️','🚴','🚵','🤸','🤼','🤽','🤾','🤹','🧘','🛀','🛌','🤝'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🐺','🦝','🦇','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🦦','🦫','🦨','🦡','🦘','🦡','🐿️','🦔'],
  'Food': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊'],
  'Activities': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛷','⛸️','🎿','⛷️','🏂','🪂','🎿','🏋️','🤸','⛹️','🤺','🤼','🤽','🤾','🧘','🏄','🏊','🚣','🏇','🏌️','🏎️','🏍️','🚴','🚵','🤸','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🎭','🎨','🎤','🎧','🎼','🎵','🎶','🎷','🎸','🎹','🎺','🎻','🪕','🥁','🪗','🎲','🎯','🎳','🎮','🎰','🧩'],
  'Travel': ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦽','🦼','🛴','🚲','🛵','🏍️','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🛶','⛵','🚤','🛳️','⛴️','🚢','🧭','🗺️','🏔️','⛰️','🌋','🗻','🏕️','⛺','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛱️','🏖️','🏞️','🏕️','🏜️','🏝️','🏞️'],
  'Objects': ['💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','🧾','💹','✉️','📧','📨','📩','📤','📥','📦','📫','📪','📬','📭','📮','📦','🏷️','🔖','📝','📋','📄','📃','📑','📊','📈','📉','🗒️','🗓️','📅','📆','📇','📁','📂','🗂️','📅','📆','📇','📁','📂','🗂️','📋','📄','📃','📑','📊','📈','📉','🗒️','🗓️','📅','📆','📇','📁','📂','🗂️','📋','📄','📃','📑','📊','📈','📉'],
  'Symbols': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛥','🔯','🔰','⚛️','🕉️','✡️','☸️','☯️','✝️','☦️','☪️','☮️','🕎','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛥','🔯','🔰','⚛️','🕉️','✡️','☸️','☯️','✝️','☦️','☪️','☮️','🕎','🛐'],
  'Flags': ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇦🇨','🇦🇩','🇦🇪','🇦🇫','🇦🇬','🇦🇮','🇦🇱','🇦🇲','🇦🇴','🇦🇶','🇦🇷','🇦🇸','🇦🇹','🇦🇺','🇦🇼','🇦🇽','🇦🇿','🇧🇦','🇧🇧','🇧🇩','🇧🇪','🇧🇫','🇧🇬','🇧🇭','🇧🇮','🇧🇯','🇧🇱','🇧🇲','🇧🇳','🇧🇴','🇧🇶','🇧🇷','🇧🇸','🇧🇹','🇧🇻','🇧🇼','🇧🇾','🇧🇿','🇨🇦','🇨🇨','🇨🇩','🇨🇫','🇨🇬','🇨🇭','🇨🇮','🇨🇰','🇨🇱','🇨🇲','🇨🇳','🇨🇴','🇨🇵','🇨🇷','🇨🇺','🇨🇻','🇨🇼','🇨🇽','🇨🇾','🇨🇿','🇩🇪','🇩🇬','🇩🇯','🇩🇰','🇩🇲','🇩🇴','🇩🇿','🇪🇦','🇪🇨','🇪🇪','🇪🇬','🇪🇭','🇪🇷','🇪🇸','🇪🇹','🇪🇺','🇫🇮','🇫🇯','🇫🇰','🇫🇲','🇫🇴','🇫🇷','🇬🇦','🇬🇧','🇬🇩','🇬🇪','🇬🇫','🇬🇬','🇬🇭','🇬🇮','🇬🇱','🇬🇲','🇬🇳','🇬🇵','🇬🇶','🇬🇷','🇬🇸','🇬🇹','🇬🇺','🇬🇼','🇬🇾','🇭🇰','🇭🇲','🇭🇳','🇭🇷','🇭🇹','🇭🇺','🇮🇨','🇮🇩','🇮🇪','🇮🇱','🇮🇲','🇮🇳','🇮🇴','🇮🇶','🇮🇷','🇮🇸','🇮🇹','🇯🇪','🇯🇲','🇯🇴','🇯🇵','🇰🇪','🇰🇬','🇰🇭','🇰🇮','🇰🇲','🇰🇳','🇰🇵','🇰🇷','🇰🇼','🇰🇾','🇰🇿','🇱🇦','🇱🇧','🇱🇨','🇱🇮','🇱🇰','🇱🇷','🇱🇸','🇱🇹','🇱🇺','🇱🇻','🇱🇾','🇲🇦','🇲🇨','🇲🇩','🇲🇪','🇲🇫','🇲🇬','🇲🇭','🇲🇰','🇲🇱','🇲🇲','🇲🇳','🇲🇴','🇲🇵','🇲🇶','🇲🇷','🇲🇸','🇲🇹','🇲🇺','🇲🇻','🇲🇼','🇲🇽','🇲🇾','🇲🇿','🇳🇦','🇳🇨','🇳🇪','🇳🇫','🇳🇬','🇳🇮','🇳🇱','🇳🇴','🇳🇵','🇳🇷','🇳🇺','🇳🇿','🇴🇲','🇵🇦','🇵🇪','🇵🇫','🇵🇬','🇵🇭','🇵🇰','🇵🇱','🇵🇲','🇵🇳','🇵🇷','🇵🇸','🇵🇹','🇵🇼','🇵🇾','🇶🇦','🇷🇪','🇷🇴','🇷🇸','🇷🇺','🇷🇼','🇸🇦','🇸🇧','🇸🇨','🇸🇩','🇸🇪','🇸🇬','🇸🇭','🇸🇮','🇸🇯','🇸🇰','🇸🇱','🇸🇲','🇸🇳','🇸🇴','🇸🇷','🇸🇸','🇸🇹','🇸🇻','🇸🇽','🇸🇾','🇸🇿','🇹🇦','🇹🇨','🇹🇩','🇹🇫','🇹🇬','🇹🇭','🇹🇯','🇹🇰','🇹🇱','🇹🇲','🇹🇳','🇹🇴','🇹🇷','🇹🇹','🇹🇻','🇹🇼','🇹🇿','🇺🇦','🇺🇬','🇺🇲','🇺🇳','🇺🇸','🇺🇾','🇺🇿','🇻🇦','🇻🇨','🇻🇪','🇻🇬','🇻🇮','🇻🇳','🇻🇺','🇼🇫','🇼🇸','🇽🇰','🇾🇪','🇾🇹','🇿🇦','🇿🇲','🇿🇼']
};

function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEmojis, setFilteredEmojis] = useState([]);
  
  const categories = Object.keys(EMOJI_CATEGORIES);
  
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = [];
      for (const [, emojis] of Object.entries(EMOJI_CATEGORIES)) {
        for (const emoji of emojis) {
          if (results.length >= 50) break;
          results.push(emoji);
        }
      }
      setFilteredEmojis(results);
    } else {
      setFilteredEmojis(EMOJI_CATEGORIES[activeCategory] || []);
    }
  }, [searchQuery, activeCategory]);
  
  return (
    <div className="absolute bottom-full right-0 z-50 mb-2 w-80 max-h-96 rounded-xl border border-[#D7DEE6] bg-white shadow-xl overflow-hidden" data-popover-root>
      <div className="flex items-center gap-2 border-b border-[#D7DEE6] px-3 py-2">
        <Search size={16} className="text-[#4F5F73]" aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emojis..."
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="flex border-b border-[#D7DEE6] px-2 py-1 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
            className={`px-2 py-1 text-xs font-medium rounded-md whitespace-nowrap ${activeCategory === cat ? 'bg-[#D7DEE6] text-[#35475C]' : 'text-[#4F5F73] hover:bg-[#EEF1F4]'}`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto p-2">
        {filteredEmojis.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            type="button"
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-9 h-9 rounded-lg text-xl hover:bg-[#EEF1F4] transition-colors"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="border-t border-[#D7DEE6] px-3 py-2 text-right">
        <button type="button" onClick={onClose} className="text-sm font-medium text-[#35475C] hover:underline">Close</button>
      </div>
    </div>
  );
}

// Voice recorder component
function VoiceRecorder({ onRecordComplete, onClose }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Use a mimeType that's widely supported
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Use timeslice to get data periodically (every 100ms)
      mediaRecorderRef.current.start(100);
      setRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required for voice notes');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };
  
  const sendRecording = () => {
    if (audioBlob) {
      onRecordComplete(audioBlob);
      onClose();
    }
  };
  
  const cancelRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setAudioBlob(null);
    onClose();
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-[#D7DEE6] bg-white shadow-xl overflow-hidden" data-popover-root>
      <div className="flex items-center justify-between border-b border-[#D7DEE6] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#1F2D3D]">Voice Note</h3>
        <button type="button" onClick={cancelRecording} className="text-[#4F5F73] hover:text-[#1F2D3D]">✕</button>
      </div>
      
      <div className="p-4 space-y-3">
        {!audioBlob ? (
          <>
            <div className="flex items-center justify-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${recording ? 'bg-red-100 animate-pulse' : 'bg-[#EEF1F4]'}`}>
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${recording ? 'bg-red-600' : 'bg-[#35475C]'} text-white`}
                  aria-label={recording ? 'Stop recording' : 'Start recording'}
                >
                  {recording ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-mono text-[#35475C]">{formatTime(duration)}</p>
              <p className="text-xs text-[#4F5F73] mt-1">{recording ? 'Recording...' : 'Tap to start recording'}</p>
            </div>
          </>
        ) : (
          <>
            <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />
            <div className="flex gap-2">
              <button type="button" onClick={sendRecording} className="flex-1 btnPrimary">Send Voice Note</button>
              <button type="button" onClick={() => { setAudioBlob(null); setDuration(0); }} className="flex-1 btnSecondary">Re-record</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Voice Note Player Component
function VoiceNotePlayer({ audioUrl, duration, messageTime }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const animationRef = useRef(null);

  // Generate fixed waveform data (40 bars, consistent heights)
  const waveformData = useMemo(() => {
    const bars = 40;
    const seed = audioUrl.split('/').pop() || 'default';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const random = (max) => {
      hash = (hash * 1664525 + 1013904223) >>> 0;
      return (hash / 0x100000000) * max;
    };
    return Array.from({ length: bars }, () => Math.max(0.15, 0.3 + random(0.7)));
  }, [audioUrl]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.currentTime = currentTime;
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const ct = audioRef.current.currentTime;
    setCurrentTime(ct);
    setProgress(audioRef.current.duration ? ct / audioRef.current.duration : 0);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
    cancelAnimationFrame(animationRef.current);
  };

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(handleTimeUpdate);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying]);

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-[#D7DEE6] min-w-[280px] max-w-[400px]" style={{ backgroundColor: '#E6EFF8' }}>
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={handlePlayPause}
        className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#35475C] bg-white text-[#35475C] hover:bg-[#F0F4F8] focus:outline-none focus:ring-2 focus:ring-[#35475C] focus:ring-offset-2"
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
      </button>

      {/* Waveform & Duration */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1">
        <div className="flex items-end h-10 gap-1" role="img" aria-label="Voice note waveform">
          {waveformData.map((height, index) => {
            const barProgress = (index + 1) / waveformData.length;
            const isActive = progress > barProgress;
            return (
              <div
                key={index}
                className="w-[3px] rounded-full transition-colors duration-75"
                style={{
                  height: `${height * 100}%`,
                  backgroundColor: isActive ? '#35475C' : '#9AA8B8',
                }}
              />
            );
          })}
        </div>
        <span className="text-[11px] font-medium text-[#35475C]">
          {formatTime(isPlaying ? currentTime : duration)}
        </span>
      </div>

      {/* Transcription button (hidden) & Message time */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1 w-16">
        {/* Transcription button - hidden per spec */}
        <div className="w-full" style={{ visibility: 'hidden' }}>
          <button
            type="button"
            className="w-full rounded-full bg-[#D7DEE6] text-[#35475C] text-[10px] font-medium py-1"
            disabled
          >
            Aa
          </button>
        </div>
        <span className="text-[10px] text-[#4F5F73] text-right">{messageTime}</span>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => { setIsPlaying(false); }}
      />
    </div>
  );
}

const Chat = ({ 
  onCreateGroup, 
  onGroupDeleted = () => {}, 
  groupRefreshKey = 0, 
  groupId = null, 
  onTaskReference, 
  onAssignTask, 
  groupTasks = [],
  initialRoomId = null
}) => {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(initialRoomId || null);
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
  const [imagePreview, setImagePreview] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const draftRef = useRef(null);
  const messageEndRef = useRef(null);

  // Sync activeRoomId with groupId prop
  useEffect(() => {
    if (groupId && rooms.length > 0) {
      const targetRoom = rooms.find(r => String(r.group_id) === String(groupId));
      if (targetRoom && String(activeRoomId) !== String(targetRoom.id)) {
        setActiveRoomId(targetRoom.id);
      }
    }
  }, [groupId, rooms, activeRoomId]);

  useEffect(() => {
    if (initialRoomId && rooms.length > 0) {
      const targetRoom = rooms.find(r => String(r.id) === String(initialRoomId));
      if (targetRoom && String(activeRoomId) !== String(targetRoom.id)) {
        setActiveRoomId(targetRoom.id);
      }
    }
  }, [initialRoomId, rooms, activeRoomId]);

  useEffect(() => {
    if (roomMenuId === null && !taskPickerOpen && !showEmojiPicker && !showVoiceRecorder) return undefined;
    const handlePointerDown = (event) => {
      if (event.target.closest?.('[data-popover-root]') || event.target === draftRef.current) return;
      setRoomMenuId(null);
      setTaskPickerOpen(false);
      setShowEmojiPicker(false);
      setShowVoiceRecorder(false);
      setImagePreview(null);
    };
    const handleKeyDown = (event) => { 
      if (event.key === 'Escape') { 
        setRoomMenuId(null); 
        setTaskPickerOpen(false); 
        setShowEmojiPicker(false);
        setShowVoiceRecorder(false);
        setImagePreview(null); 
      } 
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [roomMenuId, taskPickerOpen, showEmojiPicker, showVoiceRecorder]);

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
      ? `Delete group "${room.name}" and its chat for everyone? This cannot be undone.`
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
        const preferredRoom = groupId ? nextRooms.find((room) => String(room.group_id) === String(groupId)) : (initialRoomId ? nextRooms.find(r => String(r.id) === String(initialRoomId)) : null);
        setActiveRoomId((current) => preferredRoom?.id || (nextRooms.some((room) => String(room.id) === String(current)) ? current : nextRooms[0]?.id || null));
      } catch (requestError) {
        if (!cancelled) setError(requestError.response?.data?.error || 'Unable to load your conversations.');
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    };
    loadRooms();
    return () => { cancelled = true; };
  }, [groupId, initialRoomId, groupRefreshKey]);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      setMembers([]);
      setRoomTasks([]);
      setAllUsers([]);
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
        
        const newMessages = Array.isArray(messageResponse.data) ? messageResponse.data : [];
        setMessages((current) => {
          const merged = new Map(current.map((message) => [message.id, message]));
          for (const message of newMessages) merged.set(message.id, message);
          return Array.from(merged.values()).sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
        });
        
        // Extract unique users for color assignment
        const users = [...new Map(newMessages.map(m => [m.sender.id, m.sender])).values()];
        setAllUsers(users);
        
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
        // Add new user to color list
        if (incoming.sender) {
          setAllUsers(prev => {
            if (prev.some(u => u.id === incoming.sender.id)) return prev;
            return [...prev, incoming.sender];
          });
        }
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
        // Keep last known badge values
      }
    };
    const intervalId = window.setInterval(refreshUnreadCounts, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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

  const handleEmojiSelect = (emoji) => {
    const textarea = draftRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(nextDraft);
    requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + emoji.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const handleVoiceRecordComplete = (blob) => {
    const payload = new FormData();
    payload.append('voice_note', blob, `voice-note-${Date.now()}.webm`);
    payload.append('content', '');
    authorizedRequest({ method: 'POST', url: `${API_ROOT}/chat/send/${activeRoomId}/`, data: payload })
      .then((response) => {
        setMessages((current) => current.some((item) => item.id === response.data.id) ? current : [...current, response.data]);
      })
      .catch(() => setError('Failed to send voice note'));
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

  // Group messages by day
  const messagesByDay = useMemo(() => groupMessagesByDay(messages), [messages]);

  // Filter messages by search query
  const filteredMessagesByDay = useMemo(() => {
    if (!searchQuery.trim()) return messagesByDay;
    const query = searchQuery.toLowerCase();
    const filtered = {};
    for (const [day, msgs] of Object.entries(messagesByDay)) {
      const filteredMsgs = msgs.filter(msg => 
        msg.content?.toLowerCase().includes(query) ||
        msg.sender?.first_name?.toLowerCase().includes(query) ||
        msg.sender?.last_name?.toLowerCase().includes(query)
      );
      if (filteredMsgs.length > 0) filtered[day] = filteredMsgs;
    }
    return filtered;
  }, [messagesByDay, searchQuery]);

  return (
    <section className="grid h-[min(74vh,760px)] min-h-[520px] grid-cols-1 overflow-hidden rounded-xl border border-[#D7DEE6] bg-white md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_230px]" aria-label="Group chat workspace">
      <aside className="flex min-h-0 flex-col border-b border-[#D7DEE6] bg-[#F8FAFC] md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-[#D7DEE6] px-4 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#1F2D3D]">{showContacts ? 'New chat' : 'Messages'}</h2>
            <p className="mt-0.5 text-xs text-[#4F5F73]">{showContacts ? 'People in your groups' : 'Group and private conversations'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {showContacts && <button type="button" onClick={() => { setShowContacts(false); setRoomSearch(''); }} aria-label="Back to conversations" title="Back to conversations" className="flex h-8 w-8 items-center justify-center rounded-full text-[#4F5F73] hover:bg-[#EEF1F4]"><ArrowLeft size={15} aria-hidden="true" /></button>}
            {!showContacts && <button type="button" onClick={openNewChat} aria-label="New private chat" title="New private chat" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D7DEE6] bg-white text-[#35475C] hover:bg-[#EEF1F4]"><UserRoundPlus size={15} aria-hidden="true" /></button>}
          </div>
        </div>
        
        {/* Room search */}
        <label className="relative mx-3 my-3 block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4F5F73]" aria-hidden="true" />
          <input value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder={showContacts ? 'Search people' : 'Search chats'} className="h-8 w-full rounded-md border border-[#D7DEE6] bg-white pl-8 pr-2 text-sm outline-none focus:border-[#35475C]" />
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {showContacts ? (
            loadingContacts ? <p className="px-3 py-4 text-xs text-[#4F5F73]">Loading people…</p> : filteredContacts.map((contact) => (
              <button key={contact.id} type="button" onClick={() => startDirectChat(contact)} className="mb-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-3 text-left hover:bg-[#EEF1F4]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D7DEE6] text-[#35475C]"><UserRound size={16} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#1F2D3D]">{displayName(contact)}</span><span className="mt-1 block truncate text-xs text-[#4F5F73]">{contact.user_type === 'lecturer' ? 'Lecturer' : 'Student'} · {contact.email}</span></span>
              </button>
            ))
          ) : loadingRooms ? <p className="px-3 py-4 text-xs text-[#4F5F73]">Loading chats…</p> : filteredRooms.map((room) => (
            <div key={room.id} className={`mb-1 flex items-center rounded-md pr-1 ${String(room.id) === String(activeRoomId) ? 'bg-[#D7DEE6]' : 'hover:bg-[#EEF1F4]'}`}>
              <button type="button" onClick={() => setActiveRoomId(room.id)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#35475C]">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${room.type === 'direct' ? 'bg-[#D7DEE6] text-[#35475C]' : 'bg-[#D7DEE6] text-[#35475C]'}`}>{room.type === 'direct' ? <UserRound size={16} aria-hidden="true" /> : <UsersRound size={16} aria-hidden="true" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#1F2D3D]">{room.name}</span>
                  <span className="mt-1 block truncate text-xs text-[#4F5F73]">{room.last_message || 'Start a conversation'}</span>
                </span>
                {Number(unreadCounts[String(room.id)] ?? room.unread_count ?? 0) > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#35475C] px-1.5 text-xs font-bold text-white">{unreadCounts[String(room.id)] ?? room.unread_count}</span>}
              </button>
              {(room.type === 'direct' || room.can_delete) && <div className="relative" data-popover-root><button type="button" onClick={() => setRoomMenuId((current) => current === room.id ? null : room.id)} aria-label={`More actions for ${room.name}`} aria-expanded={roomMenuId === room.id} title="More actions" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#4F5F73] hover:bg-white"><MoreHorizontal size={16} aria-hidden="true" /></button>{roomMenuId === room.id && <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border border-[#D7DEE6] bg-white p-1 shadow-lg"><button type="button" role="menuitem" onClick={() => deleteConversation(room)} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"><FileText size={13} aria-hidden="true" />{room.type === 'direct' ? 'Delete conversation' : 'Delete group'}</button></div>}</div>}
            </div>
          ))}
          {showContacts && !loadingContacts && !filteredContacts.length && (
            <div className="px-3 py-5 text-center"><p className="text-xs font-semibold text-[#1F2D3D]">No people found</p><p className="mt-1 text-xs text-[#4F5F73]">You can privately message people who share one of your groups.</p></div>
          )}
          {!showContacts && !loadingRooms && !filteredRooms.length && (
            <div className="px-3 py-5 text-center">
              <p className="text-xs font-semibold text-[#1F2D3D]">No conversations yet</p>
              <p className="mt-1 text-xs text-[#4F5F73]">Create a group from the Groups page to open its shared chat.</p>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        {activeRoom ? (
          <>
            <header className="flex items-center justify-between border-b border-[#D7DEE6] px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${activeRoom.type === 'direct' ? 'bg-[#D7DEE6] text-[#35475C]' : 'bg-[#D7DEE6] text-[#35475C]'}`}>{activeRoom.type === 'direct' ? <UserRound size={17} aria-hidden="true" /> : <UsersRound size={17} aria-hidden="true" />}</span>
                <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#1F2D3D]">{activeRoom.name}</h3><p className="text-xs text-[#4F5F73]">{activeRoom.type === 'direct' ? 'Private conversation' : `${members.length || 1} members · Group chat`}</p></div>
              </div>
              <div className="flex items-center gap-3">
                {activeRoom.type === 'group' && <button type="button" onClick={() => onAssignTask?.(activeRoom.group_id)} className="rounded-md border border-[#D7DEE6] px-2.5 py-1.5 text-xs font-semibold text-[#35475C] hover:bg-[#EEF1F4]">Assign a task</button>}
                <span className="flex items-center gap-1.5 text-xs text-[#4F5F73]"><span className={`h-1.5 w-1.5 rounded-full ${connectionState === 'connected' ? 'bg-[#35475C]' : 'bg-[#B45309]'}`} />{connectionState === 'connected' ? 'Live' : 'Reconnecting'}</span>
              </div>
            </header>
            
            {/* Message search */}
            <div className="border-b border-[#D7DEE6] px-4 py-2">
              <label className="relative max-w-md">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4F5F73]" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in this conversation…"
                  className="h-8 w-full rounded-md border border-[#D7DEE6] bg-white pl-8 pr-2 text-sm outline-none focus:border-[#35475C]"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] px-4 py-5 sm:px-6">
              {loadingMessages && <p className="text-center text-sm text-[#4F5F73]">Loading conversation…</p>}
              {!loadingMessages && !messages.length && <div className="py-10 text-center"><MessageCircle size={25} className="mx-auto text-[#D7DEE6]" /><p className="mt-3 text-sm font-semibold text-[#1F2D3D]">{activeRoom.type === 'direct' ? 'Say hello' : 'A new group conversation'}</p><p className="mt-1 text-xs text-[#4F5F73]">{activeRoom.type === 'direct' ? 'Start a private conversation.' : 'Share an update or a document with your group.'}</p></div>}
              
              {Object.entries(filteredMessagesByDay).map(([day, dayMessages]) => (
                <div key={day} className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#4F5F73]">
                    <div className="flex-1 h-px bg-[#D7DEE6]" />
                    <span className="px-2 bg-[#F8FAFC]">{day}</span>
                    <div className="flex-1 h-px bg-[#D7DEE6]" />
                  </div>
                  {dayMessages.map((message) => {
                    const own = isMine(message);
                    const userColor = getUserColor(message.sender?.id, allUsers);
                    return (
                      <article key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 sm:max-w-[70%] ${own ? 'bg-[#35475C] text-white' : 'bg-white border border-[#D7DEE6] text-[#1F2D3D]'}`}>
                          {!own && (
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ backgroundColor: userColor }}>
                                {message.sender?.first_name?.[0] || ''}{message.sender?.last_name?.[0] || ''}
                              </span>
                              <span className="text-xs font-semibold text-[#1F2D3D]">{displayName(message.sender)}</span>
                              <time className="text-[10px] text-[#4F5F73]">{new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                            </div>
                          )}
                          {own && (
                            <div className="mb-1.5 flex items-center justify-end gap-2">
                              <time className="text-[10px] text-white/70">{new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                              <span className="text-xs font-semibold text-white/90">You</span>
                            </div>
                          )}
                          {message.content && <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">{renderMessageContent(message.content, onTaskReference, activeRoom?.group_id)}</p>}
                          {message.poll && renderPollCard(message.poll, activeRoom?.group_id)}
                          {/* Voice note playback - custom player */}
                          {message.voice_note_url && (
                            <VoiceNotePlayer
                              audioUrl={message.voice_note_url}
                              duration={message.duration || 30}
                              messageTime={new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            />
                          )}
                          {/* Regular file attachment */}
                          {message.attachment_url && (
                            <button type="button" onClick={() => isImage(message.attachment_name) ? setImagePreview(message.attachment_url) : downloadAttachment(message)} className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[#D7DEE6] bg-white/50 px-3 py-2 text-left text-sm font-medium text-[#35475C] hover:bg-white">
                              {isImage(message.attachment_name) ? <Image size={16} className="shrink-0" aria-hidden="true" /> : <FileText size={16} className="shrink-0" aria-hidden="true" />}
                              <span className="min-w-0 flex-1 truncate">{message.attachment_name}</span>
                              <span className="text-xs">{isImage(message.attachment_name) ? 'View' : downloadBusy === message.id ? '…' : 'Download'}</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>
            
            {error && <p role="alert" className="mx-4 mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {selectedFile && <div className="mx-4 mt-2 flex items-center justify-between rounded-md bg-[#EEF1F4] px-3 py-2 text-sm text-[#35475C]"><span className="truncate">Attached: {selectedFile.name}</span><button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} aria-label="Remove attachment">✕</button></div>}
            
            <form onSubmit={handleSend} className="border-t border-[#D7DEE6] bg-white p-3 sm:px-4 sm:py-3.5">
              <div className="flex items-end gap-1.5 rounded-xl border border-[#D7DEE6] bg-[#F8FAFC] p-2 focus-within:border-[#35475C]">
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.heic" onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); setError(file && file.size > 10 * 1024 * 1024 ? 'That file is over 10 MB. Choose a smaller file.' : ''); }} className="hidden" />
                
                {/* Attach file */}
                <button type="button" aria-label="Attach a document" title="Attach a document (max 10 MB)" onClick={() => fileInputRef.current?.click()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4] hover:text-[#35475C]"><Paperclip size={18} aria-hidden="true" /></button>
                
                {/* Emoji picker */}
                <div className="relative">
                  <button type="button" aria-label="Open emoji picker" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowVoiceRecorder(false); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4] hover:text-[#35475C]"><Smile size={18} aria-hidden="true" /></button>
                  {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
                </div>
                
                {/* Voice recorder */}
                <div className="relative">
                  <button type="button" aria-label="Record voice note" onClick={() => { setShowVoiceRecorder(!showVoiceRecorder); setShowEmojiPicker(false); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#4F5F73] hover:bg-[#EEF1F4] hover:text-[#35475C]"><Mic size={18} aria-hidden="true" /></button>
                  {showVoiceRecorder && <VoiceRecorder onRecordComplete={handleVoiceRecordComplete} onClose={() => setShowVoiceRecorder(false)} />}
                </div>
                
                {/* Task picker */}
                {taskPickerOpen && activeRoom.type === 'group' && <div data-popover-root className="absolute bottom-full left-0 z-30 mb-2 max-h-48 w-full overflow-y-auto rounded-md border border-[#D7DEE6] bg-white p-1 shadow-lg">{taskPickerItems.length ? taskPickerItems.slice(0, 8).map((task) => <button key={task.id} type="button" onClick={() => insertTaskReference(task)} className="flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left hover:bg-[#EEF1F4]"><span className="truncate text-sm font-medium text-[#1F2D3D]">{task.title}</span><span className="shrink-0 text-xs text-[#4F5F73]">#{task.id}</span></button>) : <p className="px-2.5 py-2 text-xs text-[#4F5F73]">No matching tasks.</p>}</div>}
                
                <div className="relative min-w-0 flex-1">
                  <textarea ref={draftRef} value={draft} onChange={(event) => { const value = event.target.value; setDraft(value); const cursor = event.target.selectionStart; const prefix = value.slice(0, cursor); const hashIndex = prefix.lastIndexOf('#'); const query = hashIndex >= 0 ? prefix.slice(hashIndex + 1) : ''; const isTaskQuery = hashIndex >= 0 && !/\s/.test(query); setTaskPickerOpen(activeRoom.type === 'group' && isTaskQuery); setTaskPickerQuery(query.replace(/^task-?/i, '')); }} onKeyDown={(event) => { if (event.key === 'Escape') { setTaskPickerOpen(false); setShowEmojiPicker(false); setShowVoiceRecorder(false); } if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); setTaskPickerOpen(false); event.currentTarget.form.requestSubmit(); } }} rows={1} placeholder="Write a message…" className="max-h-24 min-h-9 w-full resize-y bg-transparent px-2 py-2 text-sm text-[#1F2D3D] outline-none placeholder:text-[#94A8A1]" />
                </div>
                
                <button type="submit" disabled={sending || (!draft.trim() && !selectedFile)} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#35475C] text-white hover:bg-[#435B76] disabled:cursor-not-allowed disabled:opacity-40"><Send size={17} aria-hidden="true" /></button>
              </div>
              <p className="mt-1.5 pl-2 text-xs text-[#94A8A1]">Documents are saved to this conversation · 10 MB max</p>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <MessageCircle size={30} className="text-[#D7DEE6]" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-[#1F2D3D]">Your group chats live here</h3>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[#4F5F73]">Create a group to start messaging, sharing coursework, and keeping documents together.</p>
            <button type="button" onClick={onCreateGroup} className="mt-4 rounded-lg bg-[#35475C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#435B76]">Create a group</button>
          </div>
        )}
      </div>

      {/* Right sidebar with shared files and members */}
      <aside className="hidden min-h-0 flex-col border-l border-[#D7DEE6] bg-white xl:flex">
        <div className="border-b border-[#D7DEE6] px-4 py-4">
          <h3 className="text-xs font-bold text-[#1F2D3D]">{activeRoom?.type === 'direct' ? 'Contact info' : 'Group info'}</h3>
          <p className="mt-1 truncate text-xs text-[#4F5F73]">{activeRoom?.name || 'Select a conversation'}</p>
          {activeRoom?.join_code && <div className="mt-3 rounded-md bg-[#EEF1F4] p-2"><span className="block text-xs font-semibold uppercase tracking-wide text-[#4F5F73]">Invite code</span><div className="mt-1 flex items-center justify-between gap-2"><code className="text-sm font-bold tracking-wider text-[#35475C]">{activeRoom.join_code}</code><button type="button" title="Copy invite code" aria-label="Copy invite code" onClick={() => navigator.clipboard?.writeText(activeRoom.join_code)} className="text-[#4F5F73] hover:text-[#35475C]"><Copy size={13} aria-hidden="true" /></button></div></div>}
          {activeRoom?.description && <p className="mt-2 text-xs leading-4 text-[#4F5F73]">{activeRoom.description}</p>}
        </div>
        {activeRoom?.type === 'group' && <div className="border-b border-[#D7DEE6] px-4 py-4"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wide text-[#4F5F73]">Members</h4><span className="text-xs text-[#4F5F73]">{members.length}</span></div><div className="mt-3 space-y-2.5">{members.slice(0, 8).map((membership) => <div key={membership.id} className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D7DEE6] text-xs font-semibold text-[#35475C]">{`${membership.student?.first_name?.trim()?.[0] || ''}${membership.student?.last_name?.trim()?.[0] || ''}`.toUpperCase() || 'U'}</span><span className="truncate text-xs font-medium text-[#1F2D3D]">{displayName(membership.student)}</span></div>)}</div></div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wide text-[#4F5F73]">Shared files</h4><span className="text-xs text-[#4F5F73]">{messages.filter(m => m.attachment_url).length}</span></div><div className="mt-3 space-y-2">{messages.filter(m => m.attachment_url).map((message) => <button key={message.id} type="button" onClick={() => isImage(message.attachment_name) ? setImagePreview(message.attachment_url) : downloadAttachment(message)} className="flex w-full items-center gap-2 rounded-md border border-[#D7DEE6] p-2 text-left hover:bg-[#EEF1F4]">{isImage(message.attachment_name) ? <Image size={15} className="shrink-0 text-[#35475C]" aria-hidden="true" /> : <FileText size={15} className="shrink-0 text-[#35475C]" aria-hidden="true" />}<span className="min-w-0 flex-1 truncate text-xs font-medium text-[#1F2D3D]">{message.attachment_name}</span></button>)}{!messages.some(m => m.attachment_url) && <p className="text-xs leading-4 text-[#94A8A1]">Documents shared in chat will be kept here.</p>}</div></div>
      </aside>

      {/* Image preview modal */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setImagePreview(null)} role="dialog" aria-modal="true" aria-label="Image preview">
          <img src={imagePreview} alt="Preview" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
};

export default Chat;
import React, { useEffect, useRef } from 'react';

const GROUPS = [
  ['Smileys', ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂', '😉', '😊', '😍', '🤩', '😘', '😎', '🤔', '😐', '😴', '😢', '😭', '😡']],
  ['Gestures', ['👍', '👎', '👏', '🙌', '🙏', '💪', '👌', '✌️', '🤝', '👋', '🫡', '🤞']],
  ['Work', ['✅', '❌', '⚠️', '📌', '📎', '📅', '⏰', '💡', '🔥', '🚀', '🎯', '📚', '💻', '🛠️', '📝', '🎉']],
  ['Hearts', ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💯']],
];

const EmojiPicker = ({ onPick, onClose }) => {
  const rootRef = useRef(null);

  useEffect(() => {
    const handlePointer = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) onClose(); };
    const handleKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div ref={rootRef} role="dialog" aria-label="Emoji picker" className="absolute bottom-full left-0 z-30 mb-2 max-h-56 w-64 overflow-y-auto rounded-md border border-[#DDE7E2] bg-white p-2 shadow-lg">
      {GROUPS.map(([label, emojis]) => (
        <div key={label} className="mb-2 last:mb-0">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#789089]">{label}</p>
          <div className="grid grid-cols-8 gap-0.5">
            {emojis.map((emoji) => (
              <button key={emoji} type="button" onClick={() => onPick(emoji)} aria-label={`Insert ${emoji}`} className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-[#EAF4F0]">{emoji}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EmojiPicker;

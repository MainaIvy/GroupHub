import React from 'react';
import { Bell } from 'lucide-react';
import { timeAgo } from '../utils';
import useOutsideClick from '../hooks/useOutsideClick';

const NotificationBell = ({ notif, open, onToggle, onClose }) => {
  useOutsideClick(open, onClose);
  const { bellItems = [], unreadBell = 0, loading, error, markRead, reload } = notif || {};

  return (
    <div className="relative" data-popover-root>
      <button
        type="button"
        aria-label={unreadBell ? `Notifications, ${unreadBell} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={onToggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DEE6] bg-white text-[#35475C] hover:bg-[#EEF1F4]"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadBell ? <span aria-hidden="true" className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" /> : null}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[#D7DEE6] bg-white shadow-lg">
          <p className="border-b border-[#D7DEE6] px-4 py-2 text-sm font-semibold text-[#1F2D3D]">Notifications</p>
          <div className="max-h-80 overflow-y-auto">
            {loading ? <p className="px-4 py-4 text-sm text-[#4F5F73]">Loading…</p>
              : error ? <div className="px-4 py-4 text-sm text-red-700">{error} <button type="button" onClick={reload} className="font-semibold underline">Retry</button></div>
              : bellItems.length ? bellItems.map((item) => (
                <button key={item.id} type="button" onClick={() => !item.is_read && markRead(item.id)} className={`block w-full border-b border-[#EEF1F4] px-4 py-2 text-left hover:bg-[#EEF1F4] ${item.is_read ? '' : 'bg-[#F4F7FA]'}`}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-[#1F2D3D]">{item.title}</span>
                    {!item.is_read && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-[#33445A]">{item.message}</span>
                  <span className="mt-0.5 block text-xs text-[#4F5F73]">{timeAgo(item.created_at)}</span>
                </button>
              )) : <p className="px-4 py-4 text-sm text-[#4F5F73]">You’re all caught up.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

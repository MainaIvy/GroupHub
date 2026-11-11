import React from 'react';
import { BookOpen, CheckCircle2, LayoutDashboard, MessageSquare, Settings, UsersRound } from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'groups', label: 'Groups', icon: UsersRound },
  { id: 'tasks', label: 'My tasks', icon: CheckCircle2 },
  { id: 'units', label: 'My units', icon: BookOpen },
  { id: 'chat', label: 'Messages', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const Sidebar = ({ ctx }) => {
  const { activeTab, setActiveTab, setChatGroupId, notif } = ctx;
  const current = activeTab === 'group-detail' ? 'groups' : activeTab;

  return (
    <aside className="z-30 flex w-full shrink-0 flex-col bg-[#35475C] px-4 py-2 text-white shadow-[4px_0_24px_rgba(53,71,92,0.10)] lg:fixed lg:inset-y-0 lg:left-0 lg:h-full lg:w-64 lg:p-6">
      <div className="px-2 py-2 lg:py-4">
        <div className="text-lg font-bold leading-tight">GroupHub</div>
        <p className="text-sm text-[#D7DEE6]">Student workspace</p>
      </div>
      <nav aria-label="Student navigation" className="mt-2 grid grid-cols-3 gap-1 lg:mt-6 lg:block lg:space-y-1">
        {TABS.map((tab) => {
          const badge = tab.id === 'chat' ? notif?.messageUnread : 0;
          const active = current === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'chat') setChatGroupId(null);
              }}
              className={`flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors lg:justify-between lg:px-4 ${
                active ? 'bg-[#D7DEE6] text-[#35475C]' : 'text-[#E2E8F0] hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <tab.icon size={18} strokeWidth={1.9} aria-hidden="true" />
                <span className="truncate">{tab.label}</span>
              </span>
              {badge ? (
                <span aria-label={`${badge} unread`} className={`inline-flex min-w-6 justify-center rounded-full px-2 text-xs font-bold ${active ? 'bg-[#35475C] text-white' : 'bg-white text-[#35475C]'}`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;

import React from 'react';
import logo from '../../assets/images/GROUPHUBLOGO.png';
import { BookOpen, CheckCircle2, LayoutDashboard, LogOut, MessageSquare, Settings, UsersRound, Award } from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'groups', label: 'Groups', icon: UsersRound },
  { id: 'tasks', label: 'My tasks', icon: CheckCircle2 },
  { id: 'grades', label: 'Grades', icon: Award },
  { id: 'units', label: 'My units', icon: BookOpen },
  { id: 'chat', label: 'Messages', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const Sidebar = ({ ctx }) => {
  const { activeTab, setActiveTab, setChatGroupId, notif } = ctx;
  const current = activeTab === 'group-detail' ? 'groups' : activeTab;
  const user = ctx.user;

  return (
    <aside className="z-30 flex w-full shrink-0 flex-col bg-[#35475C] text-white shadow-[4px_0_24px_rgba(53,71,92,0.10)] lg:fixed lg:inset-y-0 lg:left-0 lg:h-full lg:w-64 lg:p-6">
      <div className="px-2 py-2 lg:py-4">
        <img src={logo} alt="GroupHub Logo" className="h-8 w-auto mb-1" />
        <p className="text-sm text-[#D7DEE6]">Student workspace</p>
      </div>

      <nav aria-label="Student navigation" className="mt-2 flex-1 grid grid-cols-3 gap-1 lg:mt-6 lg:block lg:space-y-1 overflow-y-auto">
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
                active ? 'bg-[#DFE6EE] text-[#35475C]' : 'text-[#E2E8F0] hover:bg-white/10 hover:text-white'
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

      <div className="mt-auto border-t border-[#5A7188] pt-4">
        <div className="px-2 lg:px-4 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-[#DFE6EE] flex items-center justify-center text-[#35475C] font-bold text-xs">
              {user?.firstName?.[0] || user?.email?.[0] || 'U'}{user?.lastName?.[0] || ''}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.firstName || ''} {user?.lastName || ''}</p>
              <p className="text-[10px] text-[#B8C6D6] truncate">{user?.email || ''}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <LogOut size={16} strokeWidth={1.8} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

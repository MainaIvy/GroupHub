import React, { useState } from 'react';
import { Search } from 'lucide-react';
import NotificationBell from './NotificationBell';
import AvatarMenu from './AvatarMenu';
import useOutsideClick from '../hooks/useOutsideClick';

const Header = ({ ctx }) => {
  const { user, academic, setActiveTab, searchQuery, setSearchQuery, avatarInitials, searchText, searchResults, notif } = ctx;
  const [menu, setMenu] = useState(null);
  useOutsideClick(Boolean(searchText), () => setSearchQuery(''));

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-[#D7DEE6] bg-white px-4 py-2 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-sm" data-popover-root>
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4F5F73]" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search groups, tasks and units"
          aria-label="Search groups, tasks and units"
          aria-controls="dashboard-search-results"
          aria-expanded={Boolean(searchText)}
          className="h-10 w-full rounded-lg border border-[#D7DEE6] bg-[#F4F7FA] pl-9 pr-3 text-sm text-[#1F2D3D] outline-none placeholder:text-[#4F5F73] focus:border-[#4A6079]"
        />
        {searchText && (
          <div id="dashboard-search-results" role="listbox" className="absolute left-0 top-full z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-[#D7DEE6] bg-white p-2 shadow-xl">
            {searchResults.length ? searchResults.map((result) => (
              <button key={result.id} type="button" role="option" aria-selected="false" onClick={() => { setActiveTab(result.tab); setSearchQuery(''); }} className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-[#EEF1F4]">
                <span className="text-sm font-semibold text-[#1F2D3D]">{result.label}</span>
                <span className="text-xs text-[#4F5F73]">{result.detail}</span>
              </button>
            )) : <p className="px-3 py-3 text-sm text-[#4F5F73]">No groups, tasks, or units match “{searchQuery}”.</p>}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell notif={notif} open={menu === 'bell'} onToggle={() => setMenu(menu === 'bell' ? null : 'bell')} onClose={() => setMenu(null)} />
        <AvatarMenu user={user} academic={academic} initials={avatarInitials} open={menu === 'avatar'} onToggle={() => setMenu(menu === 'avatar' ? null : 'avatar')} onClose={() => setMenu(null)} onSettings={() => setActiveTab('settings')} />
      </div>
    </header>
  );
};

export default Header;

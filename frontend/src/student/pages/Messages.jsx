import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, MessageSquare } from 'lucide-react';
import Chat from '../../components/Chat';

const Messages = ({ ctx }) => {
  const { groups, setGroups, chatGroupId, selectedTaskGroup, taskWorkspace, selectedGroupDetail, groupDetailWorkspace, setActiveTab, openReferencedTask, openChatTaskAssignment } = ctx;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef(null);

  // Handle global search results (groups, tasks, units)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results = [];
    
    // Search groups
    groups.forEach(group => {
      if (group.name.toLowerCase().includes(query)) {
        results.push({ type: 'group', id: `group-${group.id}`, label: group.name, detail: `Group · ${group.course || ''}`, onClick: () => setActiveTab('groups') });
      }
    });
    
    setSearchResults(results.slice(0, 8));
    setShowSearchResults(results.length > 0);
  }, [searchQuery, groups, setActiveTab]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine which tasks to pass to Chat based on current context
  const groupTasks = useMemo(() => {
    if (chatGroupId === selectedTaskGroup?.id) return taskWorkspace?.tasks || [];
    if (selectedGroupDetail?.id === chatGroupId) return groupDetailWorkspace?.tasks || [];
    return [];
  }, [chatGroupId, selectedTaskGroup, taskWorkspace, selectedGroupDetail, groupDetailWorkspace]);

  return (
    <div className="min-h-[calc(100vh-140px)] rounded-xl border border-[#D7DEE6] bg-white">
      {/* Header with search */}
      <div className="border-b border-[#D7DEE6] p-4">
        <div className="relative max-w-2xl">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4F5F73]" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearchResults(searchResults.length > 0)}
            placeholder="Search messages, people, groups…"
            className="h-10 w-full rounded-lg border border-[#D7DEE6] bg-white pl-10 pr-10 text-sm outline-none focus:border-[#35475C]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4F5F73] hover:text-[#1F2D3D]"
              aria-label="Clear search"
            >
              <ChevronDown size={18} className="rotate-180" aria-hidden="true" />
            </button>
          )}
        </div>
        
        {/* Search results dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute z-50 mt-2 w-full max-w-2xl rounded-xl border border-[#D7DEE6] bg-white shadow-lg overflow-hidden">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => { result.onClick(); setSearchQuery(''); setShowSearchResults(false); }}
                className="w-full px-4 py-3 text-left hover:bg-[#EEF1F4] border-b border-[#EEF1F4] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    result.type === 'group' ? 'bg-[#D7DEE6] text-[#35475C]' :
                    result.type === 'task' ? 'bg-[#D7DEE6] text-[#35475C]' :
                    'bg-[#D7DEE6] text-[#35475C]'
                  }`}>
                    {result.type === 'group' && <MessageSquare size={12} />}
                    {result.type === 'task' && <Hash size={12} />}
                  </span>
                  <span className="text-sm font-medium text-[#1F2D3D]">{result.label}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#4F5F73]">{result.detail}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat area - passes groupId to sync with chatGroupId from context */}
      <div className="h-[calc(100vh-200px)] min-h-[520px]">
        <Chat
          onCreateGroup={() => setActiveTab('groups')}
          onGroupDeleted={(groupId) => setGroups((current) => current.filter((group) => group.id !== groupId))}
          groupRefreshKey={groups.length}
          groupId={chatGroupId}
          initialRoomId={chatGroupId}
          onTaskReference={openReferencedTask}
          onAssignTask={openChatTaskAssignment}
          groupTasks={groupTasks}
        />
      </div>
    </div>
  );
};

export default Messages;
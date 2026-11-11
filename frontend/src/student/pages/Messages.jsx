import React from 'react';
import { useNavigate } from 'react-router-dom';
import Chat from '../../components/Chat';

const Messages = ({ ctx }) => {
  const { groups, setGroups, chatGroupId, selectedTaskGroup, taskWorkspace, selectedGroupDetail, groupDetailWorkspace, setActiveTab, openReferencedTask, openChatTaskAssignment } = ctx;

  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-140px)] rounded-xl border border-[#D7DEE6] bg-white p-6">
      {chatGroupId ? (
        <div className="mb-4 flex justify-end">
          <button type="button" onClick={() => navigate(`/student/groups/${chatGroupId}?tab=chat`)} className="h-10 rounded-lg border border-[#D7DEE6] px-4 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4]">Open group workspace</button>
        </div>
      ) : null}
      <Chat
        onCreateGroup={() => setActiveTab('groups')}
        onGroupDeleted={(groupId) => setGroups((current) => current.filter((group) => group.id !== groupId))}
        groupRefreshKey={groups.length}
        groupId={chatGroupId}
        onTaskReference={(taskId, groupId) => navigate(`/student/groups/${groupId || chatGroupId}?tab=tasks&task=${taskId}`)}
        onAssignTask={openChatTaskAssignment}
        groupTasks={chatGroupId === selectedTaskGroup?.id ? taskWorkspace?.tasks : selectedGroupDetail?.id === chatGroupId ? groupDetailWorkspace?.tasks : []}
      />
    </div>
  );
};

export default Messages;

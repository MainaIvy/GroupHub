import React from 'react';
import Chat from '../../../components/Chat';
import PollPanel from '../../../components/PollPanel';

const ChatTab = ({ groupId, tasks, onOpenTask, onAssignTask, onGoGroups }) => (
  <div className="space-y-4">
    <Chat
      key={`group-chat-${groupId}`}
      groupId={groupId}
      groupTasks={tasks}
      onCreateGroup={onGoGroups}
      onTaskReference={(taskId) => onOpenTask(Number(taskId))}
      onAssignTask={onAssignTask}
    />
    <PollPanel groupId={groupId} defaultOpen={false} />
  </div>
);

export default ChatTab;

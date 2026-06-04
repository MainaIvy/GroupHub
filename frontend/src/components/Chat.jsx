import React, { useState, useEffect, useRef } from 'react';


const Chat = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const websocketRef = useRef(null);

  const connectWebSocket = () => {
    const token = localStorage.getItem('access_token');
    const wsUrl = `ws://127.0.0.1:8000/ws/chat/${roomId}/?token=${token}`;

    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    websocketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prevMessages => [...prevMessages, {
        id: data.message_id,
        content: data.message,
        sender: {
          id: data.sender_id,
          first_name: data.sender_name.split(' ')[0],
          last_name: data.sender_name.split(' ')[1] || ''
        },
        timestamp: new Date(data.timestamp)
      }]);
    };

    websocketRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    websocketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  useEffect(() => {
    if (roomId) {
      connectWebSocket();
    }

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [roomId]);

  const sendMessage = () => {
    if (!newMessage.trim() || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) return;

    websocketRef.current.send(JSON.stringify({
      message: newMessage
    }));

    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className="mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {message.sender.first_name[0]}{message.sender.last_name[0]}
                  </span>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900">
                    {message.sender.first_name} {message.sender.last_name}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{message.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Send
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>
  );
};

export default Chat;

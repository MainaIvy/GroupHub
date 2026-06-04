import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message, ChatRoom, User
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get user from JWT token
        user = await self.get_user_from_token()
        if not user:
            await self.close()
            return

        self.user = user
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'

        # Check if user has access to this chat room
        if not await self.can_access_room():
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        # Save message to database
        saved_message = await self.save_message(message)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender_id': self.user.id,
                'sender_name': f"{self.user.first_name} {self.user.last_name}",
                'timestamp': saved_message.timestamp.isoformat(),
                'message_id': saved_message.id,
            }
        )

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']
        sender_id = event['sender_id']
        sender_name = event['sender_name']
        timestamp = event['timestamp']
        message_id = event['message_id']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'sender_id': sender_id,
            'sender_name': sender_name,
            'timestamp': timestamp,
            'message_id': message_id,
        }))

    @database_sync_to_async
    def get_user_from_token(self):
        """Extract user from JWT token in query parameters"""
        query_string = self.scope.get('query_string', b'').decode()
        token = None

        # Parse query string for token
        if 'token=' in query_string:
            token = query_string.split('token=')[1].split('&')[0]

        if not token:
            return None

        try:
            # Validate JWT token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            User = get_user_model()
            return User.objects.get(id=user_id)
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None

    @database_sync_to_async
    def can_access_room(self):
        """Check if user has access to this chat room"""
        try:
            room = ChatRoom.objects.get(id=self.room_name)
            if room.chat_type == 'direct':
                # Allow access if user is one of the participants
                return room.user1 == self.user or room.user2 == self.user
            elif room.chat_type == 'group':
                # Allow access if user is a member of the group
                return room.group.memberships.filter(student=self.user).exists()
            return False
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, message):
        from .models import Notification
        room = ChatRoom.objects.get(id=self.room_name)
        saved_message = Message.objects.create(
            chat_room=room,
            sender=self.user,
            content=message,
            timestamp=timezone.now()
        )

        # Create notifications for other users in the chat room
        if room.chat_type == 'direct':
            # For direct chats, notify the other user
            other_user = room.user2 if room.user1 == self.user else room.user1
            if other_user:
                Notification.objects.create(
                    user=other_user,
                    notification_type='message_received',
                    title=f'New message from {self.user.first_name} {self.user.last_name}',
                    message=message[:100] + ('...' if len(message) > 100 else ''),
                    related_chat_room=room,
                    related_message=saved_message
                )
        else:
            # For group chats, notify all group members except the sender
            from django.db.models import Q
            members = room.group.memberships.select_related('student').exclude(student=self.user)
            for membership in members:
                Notification.objects.create(
                    user=membership.student,
                    notification_type='message_received',
                    title=f'New message in {room.group.name}',
                    message=f'{self.user.first_name} {self.user.last_name}: {message[:100]}{"..." if len(message) > 100 else ""}',
                    related_chat_room=room,
                    related_message=saved_message
                )

        return saved_message

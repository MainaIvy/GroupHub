import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message, ChatRoom, User, Group
from .academic import is_supervising_lecturer, supervising_lecturers
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
        self.chat_room = await self.resolve_chat_room_for_room_name()
        if not self.chat_room:
            await self.close()
            return

        self.room_id = self.chat_room.id
        self.room_group_name = f'chat_{self.room_id}'

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
        try:
            text_data_json = json.loads(text_data)
        except (TypeError, ValueError):
            await self.close(code=1003)
            return
        message = str(text_data_json.get('content') or text_data_json.get('message') or '').strip()
        if not message:
            await self.send(text_data=json.dumps({'error': 'Message content cannot be empty.'}))
            return

        message_data = await self.save_message(message)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message_data': message_data,
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event['message_data']))

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

    def resolve_chat_room_for_room_name_sync(self):
        """Resolve a group ID or chat-room ID to a ChatRoom instance."""
        raw_room_name = str(self.scope['url_route']['kwargs'].get('room_name', '') or '').strip()
        if not raw_room_name:
            return None

        try:
            room_id = int(raw_room_name)
        except (TypeError, ValueError):
            room_id = None

        if room_id is not None:
            room = ChatRoom.objects.filter(id=room_id).first()
            if room:
                return room

            group = Group.objects.filter(id=room_id).select_related('chat_room').first()
            if group:
                room = getattr(group, 'chat_room', None)
                if room:
                    return room
                return ChatRoom.objects.create(group=group, chat_type='group')

            room = ChatRoom.objects.filter(group_id=room_id).first()
            if room:
                return room

        return None

    @database_sync_to_async
    def resolve_chat_room_for_room_name(self):
        return self.resolve_chat_room_for_room_name_sync()

    @database_sync_to_async
    def can_access_room(self):
        """Check if user has access to this chat room"""
        room = self.chat_room
        if not room:
            return False

        if room.chat_type == 'direct':
            # Allow access if user is one of the participants
            return room.user1 == self.user or room.user2 == self.user
        elif room.chat_type == 'group':
            # Allow access if user is a member of the group or an approved supervisor of its unit.
            return (
                room.group.memberships.filter(student=self.user).exists()
                or is_supervising_lecturer(self.user, room.group)
            )
        return False

    @database_sync_to_async
    def save_message(self, message):
        from .models import Notification
        room = self.chat_room
        saved_message = Message.objects.create(
            chat_room=room,
            sender=self.user,
            content=message,
            timestamp=timezone.now()
        )

        # Create notifications for other users in the chat room
        recipients = []
        if room.chat_type == 'direct':
            other_user = room.user2 if room.user1 == self.user else room.user1
            if other_user:
                recipients.append(other_user)
        else:
            recipients.extend(
                membership.student
                for membership in room.group.memberships.select_related('student').exclude(student=self.user)
            )
            recipients.extend(
                supervisor for supervisor in supervising_lecturers(room.group)
                if supervisor.id != self.user.id
            )

        preview = message[:100] + ('...' if len(message) > 100 else '')
        for recipient in recipients:
            Notification.objects.create(
                user=recipient,
                notification_type='message_received',
                title=(f'New message in {room.group.name}' if room.chat_type == 'group'
                       else f'New message from {self.user.first_name} {self.user.last_name}'),
                message=(f'{self.user.first_name} {self.user.last_name}: {preview}' if room.chat_type == 'group' else preview),
                related_chat_room=room,
                related_message=saved_message,
            )

        return {
            'id': saved_message.id,
            'content': saved_message.content,
            'sender': {
                'id': self.user.id,
                'first_name': self.user.first_name,
                'last_name': self.user.last_name,
                'user_type': self.user.user_type,
            },
            'timestamp': saved_message.timestamp.isoformat(),
            'attachment_name': None,
            'attachment_url': None,
        }

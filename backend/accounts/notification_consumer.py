import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get user from JWT token
        user = await self.get_user_from_token()
        if not user:
            await self.close()
            return

        self.user = user
        self.user_group_name = f'user_{self.user.id}'

        # Join user-specific group for notifications
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave user group
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    # Receive message from WebSocket (not used for notifications)
    async def receive(self, text_data):
        pass  # Notifications are one-way

    # Receive new message notification
    async def new_message(self, event):
        message = event['message']
        room_id = event['room_id']
        sender = event['sender']

        # Send notification to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': message,
            'room_id': room_id,
            'sender': sender,
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

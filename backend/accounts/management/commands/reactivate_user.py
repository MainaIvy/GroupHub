"""Management command to reactivate (unsuspend) a user account by registration number/username."""
from django.core.management.base import BaseCommand
from accounts.models import User


class Command(BaseCommand):
    help = 'Reactivate (unsuspend) a user account by registration number (username)'

    def add_arguments(self, parser):
        parser.add_argument(
            'username',
            type=str,
            help='Registration number / username of the user to reactivate',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )

    def handle(self, *args, **options):
        username = options['username']
        dry_run = options['dry_run']

        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            self.stderr.write(
                self.style.ERROR(f'No user found with registration number "{username}"')
            )
            return

        was_suspended = user.status == 'suspended'
        was_inactive = not user.is_active

        if not was_suspended and user.is_active:
            self.stdout.write(
                self.style.WARNING(f'User "{user.username}" ({user.get_full_name() or user.email}) is already active.')
            )
            return

        self.stdout.write(
            f'User "{user.username}": status={user.status}, is_active={user.is_active}'
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'DRY RUN: Would set status="active" and is_active=True for user "{user.username}"'
                )
            )
            return

        user.status = 'active'
        user.is_active = True
        user.save()

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully reactivated user "{user.username}" ({user.get_full_name() or user.email})'
            )
        )

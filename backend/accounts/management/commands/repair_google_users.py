"""Management command to repair Google-created users with empty names."""
from django.core.management.base import BaseCommand
from django.db import models
from accounts.models import User


class Command(BaseCommand):
    help = 'Repair Google-created users with empty first_name/last_name by filling from email prefix'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        users = User.objects.filter(
            models.Q(first_name='') | models.Q(last_name=''),
        ).exclude(email='')

        count = 0
        for user in users:
            email_prefix = user.email.split('@')[0]
            clean_prefix = email_prefix.replace('.', ' ').replace('_', ' ').replace('-', ' ')
            parts = clean_prefix.split()

            first_name = user.first_name
            last_name = user.last_name

            if not first_name and parts:
                first_name = parts[0].capitalize()
            if not last_name and len(parts) > 1:
                last_name = ' '.join(parts[1:]).capitalize()

            if first_name != user.first_name or last_name != user.last_name:
                self.stdout.write(
                    f"User {user.email}: '{user.first_name}' '{user.last_name}' -> '{first_name}' '{last_name}'"
                )
                if not dry_run:
                    user.first_name = first_name
                    user.last_name = last_name
                    user.save(update_fields=['first_name', 'last_name'])
                count += 1

        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN: Would update {count} users'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Successfully updated {count} users'))
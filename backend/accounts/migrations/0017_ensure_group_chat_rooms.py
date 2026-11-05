from django.db import migrations


def create_missing_group_chat_rooms(apps, schema_editor):
    Group = apps.get_model('accounts', 'Group')
    ChatRoom = apps.get_model('accounts', 'ChatRoom')
    database = schema_editor.connection.alias
    for group in Group.objects.using(database).iterator():
        ChatRoom.objects.using(database).get_or_create(
            group_id=group.pk,
            defaults={'chat_type': 'group'},
        )


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0016_task_completed_at_task_parent_task'),
    ]

    operations = [
        migrations.RunPython(create_missing_group_chat_rooms, migrations.RunPython.noop),
    ]

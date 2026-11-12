from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0025_adminsetting_user_status_announcement_auditlog_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='submission',
            name='grade',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
    ]

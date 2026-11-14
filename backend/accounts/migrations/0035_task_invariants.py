from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0034_group_leader'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='task',
            constraint=models.CheckConstraint(
                check=models.Q(weight__gte=1, weight__lte=5),
                name='task_weight_between_1_and_5',
            ),
        ),
        migrations.AddConstraint(
            model_name='task',
            constraint=models.CheckConstraint(
                check=models.Q(due_date__isnull=False),
                name='task_due_date_required',
            ),
        ),
        migrations.AlterField(
            model_name='task',
            name='due_date',
            field=models.DateTimeField(default=django.utils.timezone.now, null=False),
        ),
        migrations.AlterField(
            model_name='task',
            name='due_date',
            field=models.DateTimeField(null=False, blank=False),
        ),
    ]

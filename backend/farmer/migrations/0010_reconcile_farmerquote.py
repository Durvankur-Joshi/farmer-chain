# This migration reconciles the Django migration state with the
# actual SQLite schema. The columns contract_address, contract_created_at
# and the status AlterField already exist in the DB from previous
# manual runs; they were never tracked in a migration file.
# We use SeparateDatabaseAndState so Django records these as applied
# without touching the DB (the schema already matches).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farmer', '0009_crop_passport'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # database_operations = nothing (columns already exist)
            database_operations=[],
            # state_operations = tell Django's ORM about these fields
            state_operations=[
                migrations.AddField(
                    model_name='farmerquote',
                    name='contract_address',
                    field=models.CharField(blank=True, max_length=42, null=True),
                ),
                migrations.AddField(
                    model_name='farmerquote',
                    name='contract_created_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AlterField(
                    model_name='farmerquote',
                    name='status',
                    field=models.CharField(
                        choices=[
                            ('open', 'Open'),
                            ('closed', 'Closed'),
                            ('awarded', 'Awarded'),
                            ('accepted', 'Accepted'),
                            ('contract_created', 'Contract Created'),
                        ],
                        default='open',
                        max_length=20,
                    ),
                ),
            ],
        ),
    ]

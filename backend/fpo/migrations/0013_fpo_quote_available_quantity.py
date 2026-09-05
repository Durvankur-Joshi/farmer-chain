# Generated manually for Phase 4 FPOQuote available_quantity and reserved_quantity tracking

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fpo', '0012_fpo_quote_allocation'),
    ]

    operations = [
        migrations.AddField(
            model_name='fpoquote',
            name='available_quantity',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=18, null=True),
        ),
        migrations.AddField(
            model_name='fpoquote',
            name='reserved_quantity',
            field=models.DecimalField(decimal_places=8, default=0, max_digits=18),
        ),
    ]

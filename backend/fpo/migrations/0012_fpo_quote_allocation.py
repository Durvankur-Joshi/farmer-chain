# Generated manually for Phase 3 FPO Retailer Quote Inventory Allocation

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farmer', '0001_initial'),
        ('fpo', '0011_fpo_stock_cart_item'),
    ]

    operations = [
        migrations.CreateModel(
            name='FPOQuoteAllocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('allocated_quantity', models.DecimalField(decimal_places=8, max_digits=18)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('crop_passport', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fpo_quote_allocations', to='farmer.croppassport')),
                ('farmer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fpo_quote_allocations', to='farmer.farmer')),
                ('inventory_lot', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='quote_allocations', to='fpo.fpoinventorylot')),
                ('quote', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='allocations', to='fpo.fpoquote')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]

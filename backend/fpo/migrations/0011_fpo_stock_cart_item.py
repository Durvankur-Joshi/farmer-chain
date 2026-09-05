# Generated manually for Phase 2 FPO Stock Cart

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fpo', '0010_alter_fpobid_bid_amount_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='FPOStockCartItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('selected_quantity', models.DecimalField(decimal_places=8, max_digits=18)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('fpo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cart_items', to='fpo.fpo')),
                ('inventory_lot', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cart_items', to='fpo.fpoinventorylot')),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('fpo', 'inventory_lot')},
            },
        ),
    ]

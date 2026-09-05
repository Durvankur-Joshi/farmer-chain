# Generated manually for Phase 1 FPO Inventory Foundation

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fpo', '0008_did_fields'),
        ('farmer', '0013_farmerquote_crop_passport'),
    ]

    operations = [
        migrations.CreateModel(
            name='FPOInventoryLot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('product_name', models.CharField(max_length=200)),
                ('crop_category', models.CharField(blank=True, max_length=100)),
                ('original_quantity', models.DecimalField(decimal_places=8, max_digits=18)),
                ('available_quantity', models.DecimalField(decimal_places=8, max_digits=18)),
                ('reserved_quantity', models.DecimalField(decimal_places=8, default=0, max_digits=18)),
                ('unit', models.CharField(choices=[('kg', 'Kilogram (kg)'), ('quintal', 'Quintal (quintal)'), ('caret', 'Caret (caret)'), ('piece', 'Piece (piece)'), ('acre', 'Acre (acre)'), ('ton', 'Metric Ton (ton)'), ('litre', 'Litre (litre)'), ('dozen', 'Dozen (dozen)')], default='kg', max_length=20)),
                ('acquisition_price', models.DecimalField(blank=True, decimal_places=8, help_text='Acquisition price per unit in ETH paid to farmer', max_digits=18, null=True)),
                ('status', models.CharField(choices=[('available', 'Available'), ('reserved', 'Reserved'), ('depleted', 'Depleted')], default='available', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('bid', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_lots', to='fpo.fpobid')),
                ('crop_passport', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fpo_inventory_lots', to='farmer.croppassport')),
                ('farmer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fpo_inventory_lots', to='farmer.farmer')),
                ('fpo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventory_lots', to='fpo.fpo')),
                ('quote', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_lots', to='farmer.farmerquote')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]

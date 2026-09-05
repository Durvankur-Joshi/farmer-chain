# Generated manually for Phase 4 RetailerCartItem, RetailerOrder, and RetailerOrderAllocation

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farmer', '0001_initial'),
        ('fpo', '0013_fpo_quote_available_quantity'),
        ('retailer', '0006_alter_retailerbid_bid_amount'),
    ]

    operations = [
        migrations.CreateModel(
            name='RetailerOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order_number', models.CharField(max_length=64, unique=True)),
                ('product_name', models.CharField(max_length=200)),
                ('category', models.CharField(blank=True, max_length=100)),
                ('quantity', models.DecimalField(decimal_places=8, max_digits=18)),
                ('unit', models.CharField(max_length=20)),
                ('price_per_unit', models.DecimalField(decimal_places=8, max_digits=18)),
                ('total_price', models.DecimalField(decimal_places=8, max_digits=18)),
                ('status', models.CharField(choices=[('created', 'Created'), ('pending', 'Pending Confirmation'), ('confirmed', 'Confirmed'), ('cancelled', 'Cancelled')], default='created', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('fpo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retailer_orders', to='fpo.fpo')),
                ('quote', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retailer_orders', to='fpo.fpoquote')),
                ('retailer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='orders', to='retailer.retailer')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RetailerOrderAllocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('allocated_quantity', models.DecimalField(decimal_places=8, max_digits=18)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('crop_passport', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='retailer_order_allocations', to='farmer.croppassport')),
                ('farmer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retailer_order_allocations', to='farmer.farmer')),
                ('inventory_lot', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retailer_order_allocations', to='fpo.fpoinventorylot')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='allocations', to='retailer.retailerorder')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RetailerCartItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('selected_quantity', models.DecimalField(decimal_places=8, max_digits=18)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('quote', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retailer_cart_items', to='fpo.fpoquote')),
                ('retailer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cart_items', to='retailer.retailer')),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('retailer', 'quote')},
            },
        ),
    ]

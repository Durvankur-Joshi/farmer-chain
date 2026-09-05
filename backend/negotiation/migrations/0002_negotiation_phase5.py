# Generated manually for Phase 5 Negotiation enhancements

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('negotiation', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='negotiation',
            options={'ordering': ['-created_at']},
        ),
        migrations.AlterModelOptions(
            name='negotiationmessage',
            options={'ordering': ['created_at']},
        ),
        migrations.AddField(
            model_name='negotiation',
            name='agreed_price_per_unit',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=18, null=True),
        ),
        migrations.AddField(
            model_name='negotiation',
            name='agreed_quantity',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=18, null=True),
        ),
        migrations.AddField(
            model_name='negotiation',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='negotiationmessage',
            name='counter_quantity',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=18, null=True),
        ),
        migrations.AlterField(
            model_name='negotiation',
            name='status',
            field=models.CharField(choices=[('active', 'Active'), ('accepted', 'Accepted'), ('rejected', 'Rejected'), ('withdrawn', 'Withdrawn')], default='active', max_length=10),
        ),
        migrations.AlterField(
            model_name='negotiationmessage',
            name='counter_amount',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=18, null=True),
        ),
        migrations.AlterField(
            model_name='negotiationmessage',
            name='message',
            field=models.TextField(blank=True),
        ),
    ]

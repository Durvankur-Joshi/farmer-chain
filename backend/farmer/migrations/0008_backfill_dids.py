"""
Data migration: Backfill DID + did_created_at for every existing
Farmer, FPO, Retailer, and Admin that has no DID yet.

This runs immediately after the schema migration (0007_did_fields)
that added the two nullable columns.

Strategy:
  - Use QuerySet.iterator() to avoid loading all records into memory.
  - Generate a UUID per record using Python's uuid module — fully
    deterministic per run, no external dependency.
  - bulk_update() per app to minimize round-trips.
  - Never overwrites an existing DID (if not did guard).
"""
import uuid
from django.db import migrations
from django.utils import timezone


def backfill_farmer_dids(apps, schema_editor):
    Farmer = apps.get_model('farmer', 'Farmer')
    to_update = []
    for farmer in Farmer.objects.filter(did__isnull=True).iterator():
        farmer.did = f"did:farmerchain:farmer:{uuid.uuid4()}"
        farmer.did_created_at = timezone.now()
        to_update.append(farmer)
    if to_update:
        Farmer.objects.bulk_update(to_update, ['did', 'did_created_at'])


def backfill_fpo_dids(apps, schema_editor):
    FPO = apps.get_model('fpo', 'FPO')
    to_update = []
    for fpo in FPO.objects.filter(did__isnull=True).iterator():
        fpo.did = f"did:farmerchain:fpo:{uuid.uuid4()}"
        fpo.did_created_at = timezone.now()
        to_update.append(fpo)
    if to_update:
        FPO.objects.bulk_update(to_update, ['did', 'did_created_at'])


def backfill_retailer_dids(apps, schema_editor):
    Retailer = apps.get_model('retailer', 'Retailer')
    to_update = []
    for retailer in Retailer.objects.filter(did__isnull=True).iterator():
        retailer.did = f"did:farmerchain:retailer:{uuid.uuid4()}"
        retailer.did_created_at = timezone.now()
        to_update.append(retailer)
    if to_update:
        Retailer.objects.bulk_update(to_update, ['did', 'did_created_at'])


def backfill_admin_dids(apps, schema_editor):
    Admin = apps.get_model('admin_app', 'Admin')
    to_update = []
    for admin in Admin.objects.filter(did__isnull=True).iterator():
        admin.did = f"did:farmerchain:admin:{uuid.uuid4()}"
        admin.did_created_at = timezone.now()
        to_update.append(admin)
    if to_update:
        Admin.objects.bulk_update(to_update, ['did', 'did_created_at'])


def reverse_noop(apps, schema_editor):
    # Reversing a data migration is a no-op: we simply leave the DIDs
    # as they are. The schema migration reversal will drop the columns.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('farmer', '0007_did_fields'),
        ('fpo', '0008_did_fields'),
        ('retailer', '0005_did_fields'),
        ('admin_app', '0002_did_fields'),
    ]

    operations = [
        migrations.RunPython(backfill_farmer_dids, reverse_noop),
        migrations.RunPython(backfill_fpo_dids, reverse_noop),
        migrations.RunPython(backfill_retailer_dids, reverse_noop),
        migrations.RunPython(backfill_admin_dids, reverse_noop),
    ]

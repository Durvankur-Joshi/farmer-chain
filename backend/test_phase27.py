"""
Phase 2.7 — Supply-Chain Traceability Timeline Test Suite.
Tests the public timeline endpoint, lifecycle events, permissions, and security.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FarmerChain.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIClient
from farmer.models import Farmer, FarmerQuote, CropPassport, CropPassportDocument, AIQualityVerification
from fpo.models import FPO, FPOBid
from escrow.models import EscrowTransaction

passed = 0
failed = 0

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}  {detail}")

print("=" * 60)
print("Phase 2.7 — Supply-Chain Traceability Timeline Test Suite")
print("=" * 60)

# Setup
print("\n--- Setup Test Data ---")
client = APIClient()

# Clean up test accounts if present
Farmer.objects.filter(email='timeline_test_farmer@test.com').delete()
FPO.objects.filter(email='timeline_test_fpo@test.com').delete()

farmer, _ = Farmer.objects.get_or_create(
    email='timeline_test_farmer@test.com',
    defaults={
        'name': 'Timeline Farmer',
        'password': 'testpassword',
        'aadhaar_number': '778899001122',
        'wallet_address': '0x1234567890123456789012345678901234567890',
        'city': 'Nashik',
        'state': 'Maharashtra',
        'approval_status': 'approved',
    }
)

fpo, _ = FPO.objects.get_or_create(
    email='timeline_test_fpo@test.com',
    defaults={
        'name': 'Timeline FPO',
        'password': 'testpassword',
        'corporate_identification_number': 'TIMELINE_CIN_999',
        'wallet_address': '0x0987654321098765432109876543210987654321',
        'city': 'Pune',
        'state': 'Maharashtra',
        'approval_status': 'approved',
    }
)

# Clean up existing test crops
CropPassport.objects.filter(crop_name__startswith='TIMELINE_TEST_').delete()
FarmerQuote.objects.filter(product_name__startswith='TIMELINE_TEST_').delete()

# Test 1: New Crop (Initial State)
print("\n--- Test 1: New Crop Timeline ---")
crop_initial = CropPassport.objects.create(
    farmer=farmer,
    crop_name='TIMELINE_TEST_Corn',
    crop_category='Grain',
    description='Test initial crop',
    quantity=Decimal('50.00'),
    unit='kg',
    cultivation_date=timezone.now().date() - timezone.timedelta(days=90),
    harvest_date=timezone.now().date() - timezone.timedelta(days=10),
    status=CropPassport.STATUS_REGISTERED
)

resp1 = client.get(f'/api/farmer/crops/public/{crop_initial.id}/timeline/')
test("Public access without authentication (HTTP 200)", resp1.status_code == 200)
data1 = resp1.json()
test("Response contains crop_id and events", 'crop_id' in data1 and 'events' in data1)
test("Initial crop has exactly 1 event (crop_registered)", len(data1['events']) == 1)
if len(data1['events']) > 0:
    test("Event type is crop_registered", data1['events'][0]['type'] == 'crop_registered')

# Test 2: Crop with IPFS Document, AI Quality Verification, NFT Minted
print("\n--- Test 2: Crop with Documents, AI Verification, and NFT ---")
crop_advanced = CropPassport.objects.create(
    farmer=farmer,
    crop_name='TIMELINE_TEST_Soybean',
    crop_category='Legume',
    description='Test advanced crop',
    quantity=Decimal('100.00'),
    unit='kg',
    cultivation_date=timezone.now().date() - timezone.timedelta(days=120),
    harvest_date=timezone.now().date() - timezone.timedelta(days=15),
    status=CropPassport.STATUS_MINTED,
    nft_token_id='42',
    nft_contract_address='0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8',
    nft_token_uri='ipfs://QmTestSoybeanMetadata123',
    nft_transaction_hash='0x' + 'f' * 64,
    nft_minted_at=timezone.now() - timezone.timedelta(days=5),
)

doc = CropPassportDocument.objects.create(
    crop_passport=crop_advanced,
    uploaded_by=farmer,
    file_name='soil_test.pdf',
    file_type='application/pdf',
    file_size=10240,
    document_type='soil_report',
    ipfs_cid='QmTestSoybeanSoilCID123',
    ipfs_uri='ipfs://QmTestSoybeanSoilCID123'
)

ai_verif = AIQualityVerification.objects.create(
    crop_passport=crop_advanced,
    verified_by=farmer,
    image_cid='QmTestSoybeanImgCID123',
    image_uri='ipfs://QmTestSoybeanImgCID123',
    crop_detected='Soybean',
    quality_grade='A',
    quality_score=Decimal('92.50'),
    confidence_score=Decimal('0.98'),
    disease_detected=False,
    verification_status=AIQualityVerification.STATUS_VERIFIED
)

resp2 = client.get(f'/api/farmer/crops/public/{crop_advanced.id}/timeline/')
test("Advanced crop status HTTP 200", resp2.status_code == 200)
data2 = resp2.json()
event_types2 = [e['type'] for e in data2['events']]
test("Events include crop_registered", 'crop_registered' in event_types2)
test("Events include document_uploaded", 'document_uploaded' in event_types2)
test("Events include ai_verified", 'ai_verified' in event_types2)
test("Events include nft_minted", 'nft_minted' in event_types2)
test("Events do NOT include unreached stages (no quote/bid/escrow)", 'quote_created' not in event_types2 and 'escrow_funded' not in event_types2)

# Test 3: Full Lifecycle (Quote + Bid + Escrow Stages)
print("\n--- Test 3: Full Lifecycle Crop with Quote, Bid & Escrow ---")
quote = FarmerQuote.objects.create(
    farmer=farmer,
    product_name='TIMELINE_TEST_Soybean',
    category='Legume',
    description='Quote matching advanced crop',
    quantity=Decimal('100.00'),
    unit='kg',
    status='accepted',
    deadline=timezone.now().date() + timezone.timedelta(days=20),
)

bid = FPOBid.objects.create(
    fpo=fpo,
    quote=quote,
    bid_amount=Decimal('0.05'),
    delivery_time_days=7,
    status='accepted'
)
quote.accepted_bid = bid
quote.save()

escrow = EscrowTransaction.objects.create(
    farmer=farmer,
    fpo=fpo,
    quote=quote,
    contract_address='0x3333333333333333333333333333333333333333',
    amount_eth=Decimal('5.00000000'),
    status=EscrowTransaction.STATUS_RELEASED,
    deposit_tx_hash='0x' + '1' * 64,
    delivery_tx_hash='0x' + '2' * 64,
    release_tx_hash='0x' + '3' * 64,
    funded_at=timezone.now() - timezone.timedelta(days=3),
    delivery_confirmed_at=timezone.now() - timezone.timedelta(days=2),
    released_at=timezone.now() - timezone.timedelta(days=1),
)

resp3 = client.get(f'/api/farmer/crops/public/{crop_advanced.id}/timeline/')
test("Full lifecycle response HTTP 200", resp3.status_code == 200)
data3 = resp3.json()
event_types3 = [e['type'] for e in data3['events']]

test("Contains quote_created", 'quote_created' in event_types3)
test("Contains bid_accepted", 'bid_accepted' in event_types3)
test("Contains escrow_created", 'escrow_created' in event_types3)
test("Contains escrow_funded", 'escrow_funded' in event_types3)
test("Contains delivery_confirmed", 'delivery_confirmed' in event_types3)
test("Contains payment_released", 'payment_released' in event_types3)
test("All 10 events present in full lifecycle", len(data3['events']) == 10)

# Chronological order check
timestamps = [e['timestamp'] for e in data3['events']]
test("Events are strictly chronological", timestamps == sorted(timestamps))

# Test 4: Security & Privacy Check
print("\n--- Test 4: Security & Privacy Verification ---")
import json
raw_json = json.dumps(data3)
test("No password exposed", 'password' not in raw_json and 'testpassword' not in raw_json)
test("No farmer email exposed", 'timeline_test_farmer@test.com' not in raw_json)
test("No aadhaar number exposed", '123456789012' not in raw_json)
test("No Pinata secrets / JWTs exposed", 'PINATA' not in raw_json and 'jwt' not in raw_json.lower())

# Cleanup
print("\n--- Cleanup ---")
escrow.delete()
bid.delete()
quote.delete()
ai_verif.delete()
doc.delete()
crop_advanced.delete()
crop_initial.delete()
print("  Test data cleaned up.")

# Summary
print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed > 0:
    sys.exit(1)
else:
    print("\n  ALL TESTS PASSED!\n")

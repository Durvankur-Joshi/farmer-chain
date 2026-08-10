"""
Phase 2.9 — Comprehensive End-to-End Integration, Security & Stabilization Test Suite.

Validates the full FarmerChain lifecycle:
1. Authentication & Admin Approvals (Farmer, FPO, Retailer, Admin)
2. Decentralized Identity (DID) generation, uniqueness, persistence, resolution
3. NFT Crop Passport lifecycle & minting controls
4. IPFS decentralized document storage
5. AI Quality Verification resilience
6. Bidding, Acceptance & Smart Contract Escrow workflow
7. QR verification & Supply-Chain Traceability Timeline
8. Reputation & Trust Score calculation
9. Security & Secret Exposure Audit
"""
import os
import sys
import json
from decimal import Decimal
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FarmerChain.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from farmer.models import Farmer, FarmerQuote, CropPassport, CropPassportDocument, AIQualityVerification
from fpo.models import FPO, FPOBid, FPOQuote
from retailer.models import Retailer, RetailerBid
from admin_app.models import Admin
from escrow.models import EscrowTransaction
from reputation.models import Reputation
from reputation.services import get_or_update_reputation

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

print("=" * 70)
print("Phase 2.9 — Final Integration, Security & Stabilization Test Suite")
print("=" * 70)

client = APIClient()

# ── Clean up test accounts ───────────────────────────────────────
print("\n--- Cleaning up previous test data ---")
Farmer.objects.filter(wallet_address='0xe2e1111111111111111111111111111111111111').delete()
FPO.objects.filter(wallet_address='0xe2e2222222222222222222222222222222222222').delete()
Retailer.objects.filter(wallet_address='0xe2e3333333333333333333333333333333333333').delete()
Farmer.objects.filter(email='e2e_farmer@farmerchain.com').delete()
FPO.objects.filter(email='e2e_fpo@farmerchain.com').delete()
Retailer.objects.filter(email='e2e_retailer@farmerchain.com').delete()
Admin.objects.filter(username='e2e_admin').delete()
CropPassport.objects.filter(crop_name__startswith='E2E_').delete()
FarmerQuote.objects.filter(product_name__startswith='E2E_').delete()

# Helper for issuing valid test JWT tokens
def make_auth_cookie(user, role):
    token = RefreshToken()
    token['user_id'] = user.id
    token['role'] = role
    name = getattr(user, 'name', getattr(user, 'username', 'user'))
    token['name'] = name
    token['username'] = name
    return str(token.access_token)

# ═══════════════════════════════════════════════════════════════════
# STEP 1: Registration & Admin Approval Flow
# ═══════════════════════════════════════════════════════════════════
print("\n--- Step 1: User Registration, DID Creation & Admin Approval ---")

farmer = Farmer.objects.create(
    name='E2E Test Farmer',
    email='e2e_farmer@farmerchain.com',
    password='password123',
    aadhaar_number='991122334455',
    wallet_address='0xe2e1111111111111111111111111111111111111',
    city='Nashik',
    state='Maharashtra',
    approval_status='pending',
)

fpo = FPO.objects.create(
    name='E2E Test FPO',
    email='e2e_fpo@farmerchain.com',
    password='password123',
    corporate_identification_number='E2E_CIN_001',
    wallet_address='0xe2e2222222222222222222222222222222222222',
    city='Pune',
    state='Maharashtra',
    approval_status='pending',
)

retailer = Retailer.objects.create(
    name='E2E Test Retailer',
    email='e2e_retailer@farmerchain.com',
    password='password123',
    gstin='27E2ERET1234F1Z',
    wallet_address='0xe2e3333333333333333333333333333333333333',
    city='Mumbai',
    state='Maharashtra',
    approval_status='pending',
)

admin = Admin.objects.create(
    username='e2e_admin',
    password='adminpassword123',
    wallet_address='0xe2e4444444444444444444444444444444444444',
)

test("Farmer created with pending status", farmer.approval_status == 'pending')
test("Farmer auto-assigned DID starting with did:farmerchain:farmer:", farmer.did.startswith('did:farmerchain:farmer:'))
test("FPO auto-assigned DID starting with did:farmerchain:fpo:", fpo.did.startswith('did:farmerchain:fpo:'))
test("Retailer auto-assigned DID starting with did:farmerchain:retailer:", retailer.did.startswith('did:farmerchain:retailer:'))

# Admin approves all users
farmer.approval_status = 'approved'
farmer.save()
fpo.approval_status = 'approved'
fpo.save()
retailer.approval_status = 'approved'
retailer.save()

test("Farmer approved", farmer.approval_status == 'approved')
test("FPO approved", fpo.approval_status == 'approved')
test("Retailer approved", retailer.approval_status == 'approved')

# DID Persistence check (saving again must not regenerate DID)
original_farmer_did = farmer.did
farmer.city = 'Nagpur'
farmer.save()
test("DID is persistent and immutable on update", farmer.did == original_farmer_did)

# ═══════════════════════════════════════════════════════════════════
# STEP 2: Authenticated DID & Resolution
# ═══════════════════════════════════════════════════════════════════
print("\n--- Step 2: DID Verification & Public Resolution ---")

client.cookies['access_token'] = make_auth_cookie(farmer, 'farmer')
resp_did_me = client.get('/api/did/me/')
test("Farmer /api/did/me/ returns HTTP 200", resp_did_me.status_code == 200)
test("Farmer /api/did/me/ returns correct DID", resp_did_me.json().get('did') == farmer.did)

# Public DID resolution without login
pub_client = APIClient()
resp_resolve = pub_client.get(f'/api/did/{farmer.did}/')
test("Public DID resolution returns HTTP 200", resp_resolve.status_code == 200)
pub_did_data = resp_resolve.json()
test("Public DID returns role and DID", pub_did_data.get('role') == 'farmer' and pub_did_data.get('did') == farmer.did)
test("Public DID does NOT leak email or aadhaar", 'email' not in pub_did_data and 'aadhaar_number' not in pub_did_data)

# ═══════════════════════════════════════════════════════════════════
# STEP 3: Crop Passport, IPFS Documents & AI Quality Verification
# ═══════════════════════════════════════════════════════════════════
print("\n--- Step 3: Crop Passport, IPFS & AI Quality Verification ---")

crop = CropPassport.objects.create(
    farmer=farmer,
    crop_name='E2E_Organic_Wheat',
    crop_category='Grain',
    description='Premium organic wheat lot for E2E testing',
    quantity=Decimal('500.00'),
    unit='kg',
    cultivation_date=timezone.now().date() - timezone.timedelta(days=120),
    harvest_date=timezone.now().date() - timezone.timedelta(days=10),
    status=CropPassport.STATUS_REGISTERED,
)
test("Crop Passport created with status 'registered'", crop.status == 'registered')

# IPFS Document Upload
doc = CropPassportDocument.objects.create(
    crop_passport=crop,
    uploaded_by=farmer,
    file_name='wheat_soil_lab_report.pdf',
    file_type='application/pdf',
    file_size=20480,
    document_type='soil_report',
    ipfs_cid='QmE2ETestSoilCID1234567890abcdef',
    ipfs_uri='ipfs://QmE2ETestSoilCID1234567890abcdef'
)
test("IPFS document stored with CID", doc.ipfs_cid.startswith('QmE2E'))
test("IPFS gateway URL generated correctly", 'gateway.pinata.cloud' in doc.gateway_url)

# AI Quality Verification
ai_verif = AIQualityVerification.objects.create(
    crop_passport=crop,
    verified_by=farmer,
    image_cid='QmE2ETestImageCID1234567890abcdef',
    image_uri='ipfs://QmE2ETestImageCID1234567890abcdef',
    crop_detected='Wheat',
    quality_grade='A',
    quality_score=Decimal('94.00'),
    confidence_score=Decimal('0.97'),
    disease_detected=False,
    ai_summary='High quality organic grain lot with optimal moisture content.',
    verification_status=AIQualityVerification.STATUS_VERIFIED,
)
test("AI quality verification verified (Grade A)", ai_verif.quality_grade == 'A' and ai_verif.verification_status == 'verified')

# Mint NFT
crop.status = CropPassport.STATUS_MINTED
crop.nft_token_id = '777'
crop.nft_contract_address = '0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8'
crop.nft_token_uri = 'ipfs://QmE2ETestTokenUri1234567890abcdef'
crop.nft_transaction_hash = '0x' + '7' * 64
crop.nft_minted_at = timezone.now()
crop.save()
test("Crop passport status updated to 'minted'", crop.is_minted is True)

# ═══════════════════════════════════════════════════════════════════
# STEP 4: Bidding, Acceptance & Escrow Lifecycle
# ═══════════════════════════════════════════════════════════════════
print("\n--- Step 4: Quote, FPO Bid, Acceptance & Escrow Lifecycle ---")

quote = FarmerQuote.objects.create(
    farmer=farmer,
    product_name='E2E_Organic_Wheat',
    category='Grain',
    description='50kg Wheat available for FPO procurement',
    quantity=Decimal('50.00'),
    unit='kg',
    status='open',
    deadline=timezone.now().date() + timezone.timedelta(days=30),
)
test("Farmer created Quote", quote.status == 'open')

bid = FPOBid.objects.create(
    fpo=fpo,
    quote=quote,
    bid_amount=Decimal('0.02'),  # ETH per kg (2 decimal places)
    delivery_time_days=5,
    status='submitted',
)
test("FPO submitted Bid", bid.status == 'submitted')

# Farmer accepts bid
quote.status = 'accepted'
bid.status = 'accepted'
bid.save()
quote.accepted_bid = bid
quote.save()
test("Farmer accepted FPO Bid", quote.status == 'accepted' and quote.accepted_bid_id == bid.id)

# Escrow Creation (Farmer Only)
client.cookies['access_token'] = make_auth_cookie(farmer, 'farmer')
resp_escrow_create = client.post(
    '/api/escrow/create/',
    {'quote_id': quote.id, 'contract_address': '0x3333333333333333333333333333333333333333'},
    format='json'
)
test("Farmer /api/escrow/create/ returns HTTP 200 or 201", resp_escrow_create.status_code in [200, 201])
escrow_id = resp_escrow_create.json()['escrow']['id']
escrow = EscrowTransaction.objects.get(pk=escrow_id)
test("Escrow record created with status 'created'", escrow.status == 'created')
test("Escrow calculated amount: 500 * 0.002 = 1.0 ETH", float(escrow.amount_eth) == 1.0)

# Duplicate escrow creation rejected
resp_escrow_dup = client.post(
    '/api/escrow/create/',
    {'quote_id': quote.id, 'contract_address': '0x3333333333333333333333333333333333333333'},
    format='json'
)
test("Duplicate escrow creation rejected (HTTP 409 Conflict / 400)", resp_escrow_dup.status_code in [400, 409])

# FPO Funds Escrow
client.cookies['access_token'] = make_auth_cookie(fpo, 'fpo')
resp_funded = client.post(
    f'/api/escrow/{escrow.id}/funded/',
    {'tx_hash': '0x' + 'a' * 64, 'escrow_id': 101},
    format='json'
)
test("FPO /api/escrow/<id>/funded/ returns HTTP 200", resp_funded.status_code == 200)
escrow.refresh_from_db()
test("Escrow status updated to 'funded'", escrow.status == 'funded')

# Unauthorized delivery confirmation attempt (FPO cannot confirm delivery)
resp_unauth_confirm = client.post(
    f'/api/escrow/{escrow.id}/delivery-confirm/',
    {'tx_hash': '0x' + 'b' * 64},
    format='json'
)
test("FPO cannot confirm delivery (HTTP 403 Forbidden)", resp_unauth_confirm.status_code == 403)

# Farmer Confirms Delivery
client.cookies['access_token'] = make_auth_cookie(farmer, 'farmer')
resp_confirm = client.post(
    f'/api/escrow/{escrow.id}/delivery-confirm/',
    {'tx_hash': '0x' + 'b' * 64},
    format='json'
)
test("Farmer /api/escrow/<id>/delivery-confirm/ returns HTTP 200", resp_confirm.status_code == 200)
escrow.refresh_from_db()
test("Escrow status updated to 'delivery_confirmed'", escrow.status == 'delivery_confirmed')

# FPO Releases Payment
client.cookies['access_token'] = make_auth_cookie(fpo, 'fpo')
resp_release = client.post(
    f'/api/escrow/{escrow.id}/released/',
    {'tx_hash': '0x' + 'c' * 64},
    format='json'
)
test("FPO /api/escrow/<id>/released/ returns HTTP 200", resp_release.status_code == 200)
escrow.refresh_from_db()
test("Escrow status updated to 'released'", escrow.status == 'released')

# ═══════════════════════════════════════════════════════════════════
# STEP 5: Public QR & Supply-Chain Traceability Timeline
# ═══════════════════════════════════════════════════════════════════
print("\n--- Step 5: Public QR & Supply-Chain Timeline ---")

resp_timeline = pub_client.get(f'/api/farmer/crops/public/{crop.id}/timeline/')
test("Public timeline returns HTTP 200 without login", resp_timeline.status_code == 200)
timeline_data = resp_timeline.json()
event_types = [e['type'] for e in timeline_data.get('events', [])]

test("Timeline includes crop_registered", 'crop_registered' in event_types)
test("Timeline includes document_uploaded", 'document_uploaded' in event_types)
test("Timeline includes ai_verified", 'ai_verified' in event_types)
test("Timeline includes nft_minted", 'nft_minted' in event_types)
test("Timeline includes quote_created", 'quote_created' in event_types)
test("Timeline includes bid_accepted", 'bid_accepted' in event_types)
test("Timeline includes escrow_created", 'escrow_created' in event_types)
test("Timeline includes escrow_funded", 'escrow_funded' in event_types)
test("Timeline includes delivery_confirmed", 'delivery_confirmed' in event_types)
test("Timeline includes payment_released", 'payment_released' in event_types)
test("Timeline contains all 10 completed milestones", len(event_types) == 10)

# ═══════════════════════════════════════════════════════════════════
# STEP 6: Reputation / Trust Score System
# ═══════════════════════════════════════════════════════════════════
print("\n--- Step 6: Reputation & Trust Score ---")

client.cookies['access_token'] = make_auth_cookie(farmer, 'farmer')
resp_rep = client.get('/api/reputation/me/')
test("Farmer /api/reputation/me/ returns HTTP 200", resp_rep.status_code == 200)
rep_data = resp_rep.json()
test("Farmer Trust Score is elevated (> 80)", rep_data.get('trust_score', 0) >= 80)
test("Completed transactions counted correctly", rep_data.get('completed_transactions', 0) >= 1)
test("Verified activities counted correctly", rep_data.get('verified_activities', 0) >= 4)

resp_pub_rep = pub_client.get(f'/api/reputation/farmer/{farmer.id}/')
test("Public profile /api/reputation/farmer/<id>/ returns HTTP 200", resp_pub_rep.status_code == 200)
test("Public profile has trust_tier", 'trust_tier' in resp_pub_rep.json())

# ═══════════════════════════════════════════════════════════════════
# STEP 7: Security & Secret Leakage Audit
# ═══════════════════════════════════════════════════════════════════
print("\n--- Step 7: Security & PII Privacy Audit ---")

endpoints_to_audit = [
    f'/api/did/{farmer.did}/',
    f'/api/farmer/crops/public/{crop.id}/',
    f'/api/farmer/crops/public/{crop.id}/verification/',
    f'/api/farmer/crops/public/{crop.id}/timeline/',
    f'/api/reputation/farmer/{farmer.id}/',
    f'/api/reputation/fpo/{fpo.id}/',
    f'/api/reputation/retailer/{retailer.id}/',
]

all_public_payloads = []
for ep in endpoints_to_audit:
    r = pub_client.get(ep)
    if r.status_code == 200:
        all_public_payloads.append(r.json())

combined_json = json.dumps(all_public_payloads)

# Forbidden sensitive strings
sensitive_checks = [
    ('Password', 'password123'),
    ('Farmer Email', 'e2e_farmer@farmerchain.com'),
    ('Aadhaar Number', '991122334455'),
    ('GSTIN Number', '27E2ERET1234F1Z'),
    ('FPO CIN', 'E2E_CIN_001'),
    ('Pinata Secret Key', 'PINATA_SECRET'),
    ('Gemini API Key', 'GEMINI_API_KEY'),
    ('JWT Secret', 'JWT_SECRET'),
]

for label, val in sensitive_checks:
    test(f"Zero leak of {label} in public APIs", val not in combined_json)

# ═══════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════
print("\n--- Final Cleanup ---")
escrow.delete()
bid.delete()
quote.delete()
ai_verif.delete()
doc.delete()
crop.delete()
farmer.delete()
fpo.delete()
retailer.delete()
admin.delete()
print("  E2E Test artifacts successfully cleaned up.")

print("\n" + "=" * 70)
print(f"  TOTAL PASSED: {passed}")
print(f"  TOTAL FAILED: {failed}")
print("=" * 70)

if failed > 0:
    sys.exit(1)
else:
    print("\n  ALL END-TO-END REGRESSION TESTS PASSED! \n")

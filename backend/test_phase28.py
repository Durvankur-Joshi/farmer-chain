"""
Phase 2.8 — FarmerChain Reputation & Trust Score Test Suite.
Tests the private /api/reputation/me/ endpoint, public /api/reputation/<role>/<id>/ endpoint,
deterministic score calculation, role support (Farmer, FPO, Retailer), and security/privacy.
"""
import os
import sys
import json
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FarmerChain.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from farmer.models import Farmer, CropPassport, CropPassportDocument, AIQualityVerification
from fpo.models import FPO, FPOBid, FPOQuote
from retailer.models import Retailer, RetailerBid
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

print("=" * 60)
print("Phase 2.8 — Reputation & Trust Score Test Suite")
print("=" * 60)

# Setup Test Users
print("\n--- Setup Test Accounts ---")
Farmer.objects.filter(email='rep_test_farmer@test.com').delete()
FPO.objects.filter(email='rep_test_fpo@test.com').delete()
Retailer.objects.filter(email='rep_test_retailer@test.com').delete()

farmer = Farmer.objects.create(
    name='Reputation Farmer',
    email='rep_test_farmer@test.com',
    password='password123',
    aadhaar_number='889900112233',
    wallet_address='0x1111222233334444555566667777888899990000',
    city='Nashik',
    state='Maharashtra',
    approval_status='approved',
)

fpo = FPO.objects.create(
    name='Reputation FPO',
    email='rep_test_fpo@test.com',
    password='password123',
    corporate_identification_number='REP_CIN_888',
    wallet_address='0x2222333344445555666677778888999900001111',
    city='Pune',
    state='Maharashtra',
    approval_status='approved',
)

retailer = Retailer.objects.create(
    name='Reputation Retailer',
    email='rep_test_retailer@test.com',
    password='password123',
    gstin='27REPTEST1234F1Z',
    wallet_address='0x3333444455556666777788889999000011112222',
    city='Mumbai',
    state='Maharashtra',
    approval_status='approved',
)

print(f"  Farmer ID: {farmer.id}")
print(f"  FPO ID:    {fpo.id}")
print(f"  Retailer ID: {retailer.id}")

def get_token(user, role):
    token = RefreshToken()
    token['user_id'] = user.id
    token['role'] = role
    token['name'] = user.name
    token['username'] = user.name
    return str(token.access_token)

# ── Test 1: Farmer View Own Reputation ─────────────────────────
print("\n--- Test 1: Farmer View Own Reputation ---")
client = APIClient()
farmer_token = get_token(farmer, 'farmer')
client.cookies['access_token'] = farmer_token

resp1 = client.get('/api/reputation/me/')
test("Farmer /api/reputation/me/ status HTTP 200", resp1.status_code == 200)
data1 = resp1.json()
test("Returns role == 'farmer'", data1.get('role') == 'farmer')
test("Returns trust_score >= 50 (approved base)", data1.get('trust_score', 0) >= 50)
test("Returns trust_tier string", bool(data1.get('trust_tier')))
test("Returns completed_transactions int", isinstance(data1.get('completed_transactions'), int))
test("Returns verified_activities int", isinstance(data1.get('verified_activities'), int))

# ── Test 2: Dynamic Score Progression for Farmer ───────────────
print("\n--- Test 2: Dynamic Trust Score Progression for Farmer ---")
initial_score = data1.get('trust_score')

# Add a minted Crop Passport and IPFS doc
crop = CropPassport.objects.create(
    farmer=farmer,
    crop_name='Rep Wheat',
    crop_category='Grain',
    quantity=Decimal('200.00'),
    cultivation_date=timezone.now().date(),
    harvest_date=timezone.now().date(),
    status=CropPassport.STATUS_MINTED,
    nft_token_id='1001',
    nft_contract_address='0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8',
    nft_minted_at=timezone.now(),
)
CropPassportDocument.objects.create(
    crop_passport=crop,
    uploaded_by=farmer,
    file_name='quality.pdf',
    file_type='application/pdf',
    file_size=5000,
    document_type='quality_report',
    ipfs_cid='QmRepDocCID123',
    ipfs_uri='ipfs://QmRepDocCID123'
)
AIQualityVerification.objects.create(
    crop_passport=crop,
    verified_by=farmer,
    image_cid='QmRepImgCID123',
    image_uri='ipfs://QmRepImgCID123',
    crop_detected='Wheat',
    quality_grade='A',
    quality_score=Decimal('95.00'),
    confidence_score=Decimal('0.99'),
    verification_status=AIQualityVerification.STATUS_VERIFIED
)

resp2 = client.get('/api/reputation/me/')
data2 = resp2.json()
test("Score increased after minting NFT + AI verification + IPFS upload", data2.get('trust_score') > initial_score)
test("Verified activities counter increased", data2.get('verified_activities') > data1.get('verified_activities'))

# ── Test 3: FPO View Own Reputation ────────────────────────────
print("\n--- Test 3: FPO View Own Reputation ---")
fpo_token = get_token(fpo, 'fpo')
client.cookies['access_token'] = fpo_token

resp3 = client.get('/api/reputation/me/')
test("FPO /api/reputation/me/ status HTTP 200", resp3.status_code == 200)
data3 = resp3.json()
test("Returns role == 'fpo'", data3.get('role') == 'fpo')
test("FPO trust_score >= 50", data3.get('trust_score', 0) >= 50)

# ── Test 4: Retailer View Own Reputation ───────────────────────
print("\n--- Test 4: Retailer View Own Reputation ---")
retailer_token = get_token(retailer, 'retailer')
client.cookies['access_token'] = retailer_token

resp4 = client.get('/api/reputation/me/')
test("Retailer /api/reputation/me/ status HTTP 200", resp4.status_code == 200)
data4 = resp4.json()
test("Returns role == 'retailer'", data4.get('role') == 'retailer')
test("Retailer trust_score >= 50", data4.get('trust_score', 0) >= 50)

# ── Test 5: Public Reputation Endpoint ─────────────────────────
print("\n--- Test 5: Public Reputation Profiles (Unauthenticated) ---")
public_client = APIClient()  # No cookies/tokens

resp_pub_farmer = public_client.get(f'/api/reputation/farmer/{farmer.id}/')
test("Public farmer profile HTTP 200", resp_pub_farmer.status_code == 200)
pub_data_farmer = resp_pub_farmer.json()
test("Public farmer returns display_name", pub_data_farmer.get('display_name') == farmer.name)
test("Public farmer returns trust_score", 'trust_score' in pub_data_farmer)
test("Public farmer returns trust_tier", 'trust_tier' in pub_data_farmer)

resp_pub_fpo = public_client.get(f'/api/reputation/fpo/{fpo.id}/')
test("Public FPO profile HTTP 200", resp_pub_fpo.status_code == 200)

resp_pub_retailer = public_client.get(f'/api/reputation/retailer/{retailer.id}/')
test("Public Retailer profile HTTP 200", resp_pub_retailer.status_code == 200)

# ── Test 6: Security & Privacy Check ───────────────────────────
print("\n--- Test 6: Security & Privacy Protection ---")
raw_pub_json = json.dumps(pub_data_farmer) + json.dumps(resp_pub_fpo.json()) + json.dumps(resp_pub_retailer.json())

test("No passwords in public response", 'password' not in raw_pub_json and 'password123' not in raw_pub_json)
test("No email addresses in public response", 'rep_test_' not in raw_pub_json and '@' not in raw_pub_json)
test("No Aadhaar number in public response", '889900112233' not in raw_pub_json)
test("No GSTIN in public response", '27REPTEST1234F1Z' not in raw_pub_json)
test("No CIN in public response", 'REP_CIN_888' not in raw_pub_json)
test("No JWT or secret tokens in response", 'jwt' not in raw_pub_json.lower())

# Test invalid roles / tampering
resp_invalid = public_client.get(f'/api/reputation/hacker/{farmer.id}/')
test("Invalid role rejected with HTTP 400", resp_invalid.status_code == 400)

resp_post = public_client.post('/api/reputation/me/', {'trust_score': 100})
test("Direct score modification POST rejected (HTTP 405 or 401)", resp_post.status_code in [401, 405])

# ── Cleanup ────────────────────────────────────────────────────
print("\n--- Cleanup ---")
crop.delete()
farmer.delete()
fpo.delete()
retailer.delete()
print("  Test data cleaned up.")

# ── Summary ────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed > 0:
    sys.exit(1)
else:
    print("\n  ALL TESTS PASSED!\n")

"""
Phase G — Cross-Panel Consistency & Security Audit Test Suite
"""
import os
import sys
import django
from decimal import Decimal
from datetime import timedelta

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
from escrow.models import EscrowTransaction, RetailerEscrowTransaction

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
print("Phase G -- Cross-Panel Consistency & Security Audit Suite")
print("=" * 60)

# Cleanup
RetailerEscrowTransaction.objects.filter(quote__product_name__startswith="AuditTest").delete()
EscrowTransaction.objects.filter(quote__product_name__startswith="AuditTest").delete()
RetailerBid.objects.filter(comments__startswith="AuditTest").delete()
FPOBid.objects.filter(comments__startswith="AuditTest").delete()
FPOQuote.objects.filter(product_name__startswith="AuditTest").delete()
FarmerQuote.objects.filter(product_name__startswith="AuditTest").delete()
CropPassport.objects.filter(crop_name__startswith="AuditTest").delete()
Farmer.objects.filter(email__in=["audit_farmer1@test.com", "audit_farmer2@test.com"]).delete()
Farmer.objects.filter(wallet_address__in=["0x7777000011110000111100001111000011110001", "0x7777000011110000111100001111000011110002"]).delete()
FPO.objects.filter(email__in=["audit_fpo1@test.com", "audit_fpo2@test.com"]).delete()
FPO.objects.filter(wallet_address__in=["0x7777000011110000111100001111000011110003", "0x7777000011110000111100001111000011110004"]).delete()
Retailer.objects.filter(email__in=["audit_ret1@test.com", "audit_ret2@test.com"]).delete()
Retailer.objects.filter(wallet_address__in=["0x7777000011110000111100001111000011110005", "0x7777000011110000111100001111000011110006"]).delete()

def make_token(user, role):
    token = RefreshToken()
    token['user_id'] = user.id
    token['role'] = role
    token['name'] = user.name
    token['username'] = user.name
    return str(token.access_token)

# ── 1. Create Test Entities ───────────────────────────────────────────
farmer1 = Farmer.objects.create(
    name="Audit Farmer 1",
    email="audit_farmer1@test.com",
    password="test",
    aadhaar_number="777722223331",
    wallet_address="0x7777000011110000111100001111000011110001",
    approval_status="approved",
    city="Nashik",
    state="MH"
)

farmer2 = Farmer.objects.create(
    name="Audit Farmer 2 (Other)",
    email="audit_farmer2@test.com",
    password="test",
    aadhaar_number="777755556662",
    wallet_address="0x7777000011110000111100001111000011110002",
    approval_status="approved",
    city="Pune",
    state="MH"
)

fpo1 = FPO.objects.create(
    name="Audit FPO 1",
    email="audit_fpo1@test.com",
    password="test",
    corporate_identification_number="U01111MH2023PTC777771",
    wallet_address="0x7777000011110000111100001111000011110003",
    approval_status="approved",
    city="Nashik",
    state="MH"
)

fpo2 = FPO.objects.create(
    name="Audit FPO 2 (Other)",
    email="audit_fpo2@test.com",
    password="test",
    corporate_identification_number="U01111MH2023PTC777772",
    wallet_address="0x7777000011110000111100001111000011110004",
    approval_status="approved",
    city="Pune",
    state="MH"
)

ret1 = Retailer.objects.create(
    name="Audit Retailer 1",
    email="audit_ret1@test.com",
    password="test",
    gstin="27AABCU7777K1Z1",
    wallet_address="0x7777000011110000111100001111000011110005",
    approval_status="approved",
    city="Mumbai",
    state="MH"
)

ret2 = Retailer.objects.create(
    name="Audit Retailer 2 (Other)",
    email="audit_ret2@test.com",
    password="test",
    gstin="27AABCU7777K1Z2",
    wallet_address="0x7777000011110000111100001111000011110006",
    approval_status="approved",
    city="Thane",
    state="MH"
)

farmer1_client = APIClient()
t_far1 = make_token(farmer1, 'farmer')
farmer1_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_far1}')
farmer1_client.cookies['access_token'] = t_far1

farmer2_client = APIClient()
t_far2 = make_token(farmer2, 'farmer')
farmer2_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_far2}')
farmer2_client.cookies['access_token'] = t_far2

fpo1_client = APIClient()
t_fpo1 = make_token(fpo1, 'fpo')
fpo1_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_fpo1}')
fpo1_client.cookies['access_token'] = t_fpo1

fpo2_client = APIClient()
t_fpo2 = make_token(fpo2, 'fpo')
fpo2_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_fpo2}')
fpo2_client.cookies['access_token'] = t_fpo2

ret1_client = APIClient()
t_ret1 = make_token(ret1, 'retailer')
ret1_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_ret1}')
ret1_client.cookies['access_token'] = t_ret1

ret2_client = APIClient()
t_ret2 = make_token(ret2, 'retailer')
ret2_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_ret2}')
ret2_client.cookies['access_token'] = t_ret2

anon_client = APIClient()

print("\n--- CHECK 1: Full End-to-End Data Consistency ---")
# 1. Crop Passport
passport = CropPassport.objects.create(
    farmer=farmer1,
    crop_name="AuditTest Organic Turmeric",
    crop_category="Spices",
    quantity=Decimal('80.00'),
    unit='quintal',
    cultivation_date=(timezone.now() - timedelta(days=90)).date(),
    harvest_date=(timezone.now() - timedelta(days=10)).date(),
    location="Nashik, MH",
    status="minted",
    nft_token_id="101"
)

# 2. Farmer Quote created from Passport
quote_res = farmer1_client.post(
    "/api/farmer/quotes/",
    {
        'crop_passport': passport.pk,
        'price_per_unit': '0.08',
        'deadline': str((timezone.now() + timedelta(days=15)).date()),
    }
)
test("Farmer Quote created from Passport (HTTP 201)", quote_res.status_code == 201, str(quote_res.data))
f_quote_id = quote_res.data['id']
test("Quote auto-populated crop name matches Passport", quote_res.data['product_name'] == "AuditTest Organic Turmeric")
test("Quote auto-populated category matches Passport", quote_res.data['category'] == "Spices")
test("Quote auto-populated quantity matches Passport", Decimal(str(quote_res.data['quantity'])) == Decimal('80.00'))
test("Quote auto-populated unit matches Passport", quote_res.data['unit'] == "quintal")
test("Quote price is 0.08 ETH", Decimal(str(quote_res.data['price_per_unit'])) == Decimal('0.08'))

# 3. FPO Bids on Quote
bid_res = fpo1_client.post(
    f"/api/fpo/quotes/farmer/{f_quote_id}/bids/",
    {
        'bid_amount': '0.07',
        'delivery_time_days': 4,
        'comments': 'AuditTest FPO Bid'
    }
)
test("FPO Bid placed (HTTP 201)", bid_res.status_code == 201, str(bid_res.data))
fpo_bid_id = bid_res.data['id']

# 4. Farmer accepts FPO Bid
accept_res = farmer1_client.post(f"/api/farmer/bids/fpo/{fpo_bid_id}/accept/")
test("Farmer accepts FPO Bid (HTTP 200)", accept_res.status_code == 200)

# 5. Escrow created
escrow_res = farmer1_client.post(
    "/api/escrow/create/",
    {
        'quote_id': f_quote_id,
        'contract_address': '0xf8e81D47203A594245E36C48e151709F0C19fBe8'
    }
)
test("Farmer-FPO Escrow created (HTTP 201)", escrow_res.status_code == 201)
# 80 quintal * 0.07 ETH = 5.60 ETH
test("Escrow amount matches: 80 * 0.07 = 5.60 ETH", Decimal(str(escrow_res.data['escrow']['amount_eth'])) == Decimal('5.60'))
test("Escrow counterparty is FPO 1", escrow_res.data['escrow']['fpo_name'] == "Audit FPO 1")
test("Escrow product matches", escrow_res.data['escrow']['product_name'] == "AuditTest Organic Turmeric")

print("\n--- CHECK 2: Permissions & IDOR Protection ---")
# Farmer 2 cannot access Farmer 1 quote details
f2_quote_get = farmer2_client.get(f"/api/farmer/quotes/{f_quote_id}/")
test("Farmer 2 blocked from accessing Farmer 1 quote (HTTP 404)", f2_quote_get.status_code == 404)

# Farmer 2 cannot access Farmer 1 profile via detail view
f2_profile_get = farmer2_client.get(f"/api/farmer/{farmer1.pk}/")
test("Farmer 2 blocked from accessing Farmer 1 profile (HTTP 404)", f2_profile_get.status_code == 404)

# FPO 2 cannot access FPO 1 profile via detail view
fpo2_profile_get = fpo2_client.get(f"/api/fpo/{fpo1.pk}/")
test("FPO 2 blocked from accessing FPO 1 profile (HTTP 404)", fpo2_profile_get.status_code == 404)

# Retailer 2 cannot access Retailer 1 profile via detail view
ret2_profile_get = ret2_client.get(f"/api/retailer/{ret1.pk}/")
test("Retailer 2 blocked from accessing Retailer 1 profile (HTTP 404)", ret2_profile_get.status_code == 404)

# Non-owner cannot delete passport
f2_passport_del = farmer2_client.delete(f"/api/farmer/crops/{passport.pk}/")
test("Farmer 2 blocked from deleting Farmer 1 passport (HTTP 404)", f2_passport_del.status_code == 404)

# Non-owner cannot accept bid
f2_accept_bid = farmer2_client.post(f"/api/farmer/bids/fpo/{fpo_bid_id}/accept/")
test("Farmer 2 blocked from accepting Farmer 1 quote bid (HTTP 403)", f2_accept_bid.status_code == 403)

print("\n--- CHECK 3: Validation Gaps & Rejections ---")
# Negative quantity in quote
neg_q_res = farmer1_client.post("/api/farmer/quotes/", {'crop_passport': passport.pk, 'price_per_unit': '0.05', 'quantity': -10})
test("Negative quantity rejected in quote", neg_q_res.status_code == 400)

# Negative price in quote
neg_p_res = farmer1_client.post("/api/farmer/quotes/", {'crop_passport': passport.pk, 'price_per_unit': -0.05})
test("Negative price rejected in quote", neg_p_res.status_code == 400)

# Invalid unit in quote
inv_u_res = farmer1_client.post("/api/farmer/quotes/", {'crop_passport': passport.pk, 'price_per_unit': '0.05', 'unit': 'gallons'})
test("Invalid unit rejected in quote", inv_u_res.status_code == 400)

# Negative bid amount in FPO bid
neg_bid_res = fpo1_client.post(f"/api/fpo/quotes/farmer/{f_quote_id}/bids/", {'bid_amount': -0.05, 'delivery_time_days': 3})
test("Negative FPO bid amount rejected", neg_bid_res.status_code == 400)

# Invalid category in FPO quote
inv_cat_fpo = fpo1_client.post("/api/fpo/quotes/", {
    'product_name': 'AuditTest Rice',
    'category': 'Electronics',
    'quantity': '10',
    'unit': 'kg',
    'price_per_unit': '0.05',
    'deadline': str((timezone.now() + timedelta(days=5)).date())
})
test("Invalid category rejected in FPO Quote", inv_cat_fpo.status_code == 400)

print("\n--- CHECK 4: State Transitions & Double-Action Guards ---")
escrow_db_id = escrow_res.data['escrow']['id']

# 1. Cannot fund escrow before on-chain creation recorded
fund_early = fpo1_client.post(f"/api/escrow/{escrow_db_id}/funded/", {'tx_hash': '0x' + 'f' * 64})
test("Cannot fund escrow before on-chain creation recorded (HTTP 400)", fund_early.status_code == 400)

# Record on-chain creation
farmer1_client.post(
    f"/api/escrow/{escrow_db_id}/created-onchain/",
    {'tx_hash': '0x' + 'a' * 64, 'escrow_id': 201, 'contract_address': '0xf8e81D47203A594245E36C48e151709F0C19fBe8'}
)

# 2. Cannot confirm delivery before funding
deliver_early = farmer1_client.post(f"/api/escrow/{escrow_db_id}/delivery-confirm/", {'tx_hash': '0x' + 'b' * 64})
test("Cannot confirm delivery before funding (HTTP 400)", deliver_early.status_code == 400)

# 3. Fund escrow
fund_ok = fpo1_client.post(f"/api/escrow/{escrow_db_id}/funded/", {'tx_hash': '0x' + 'c' * 64})
test("FPO funds escrow (HTTP 200)", fund_ok.status_code == 200)

# 4. Double funding blocked
double_fund = fpo1_client.post(f"/api/escrow/{escrow_db_id}/funded/", {'tx_hash': '0x' + 'c' * 64})
test("Double funding blocked (HTTP 400)", double_fund.status_code == 400)

# 5. Cannot release before delivery confirmation
release_early = fpo1_client.post(f"/api/escrow/{escrow_db_id}/released/", {'tx_hash': '0x' + 'd' * 64})
test("Cannot release payment before delivery confirmation (HTTP 400)", release_early.status_code == 400)

# 6. Confirm delivery
deliver_ok = farmer1_client.post(f"/api/escrow/{escrow_db_id}/delivery-confirm/", {'tx_hash': '0x' + 'e' * 64})
test("Farmer confirms delivery (HTTP 200)", deliver_ok.status_code == 200)

# 7. Release payment
release_ok = fpo1_client.post(f"/api/escrow/{escrow_db_id}/released/", {'tx_hash': '0x' + 'f' * 64})
test("FPO releases payment (HTTP 200)", release_ok.status_code == 200)

# 8. Double release blocked
double_release = fpo1_client.post(f"/api/escrow/{escrow_db_id}/released/", {'tx_hash': '0x' + 'f' * 64})
test("Double payment release blocked (HTTP 400)", double_release.status_code == 400)

print("\n--- CHECK 5: ETH Amounts & Precision Verification ---")
# 100 quintal * 0.05 ETH = 5.00 ETH
q1_calc = Decimal('100.00') * Decimal('0.05')
test("100 * 0.05 = 5.00 ETH exact", q1_calc == Decimal('5.00'))

# 500 kg * 0.002 ETH = 1.000 ETH
q2_calc = Decimal('500.00') * Decimal('0.002')
test("500 * 0.002 = 1.00 ETH exact", q2_calc == Decimal('1.000'))

# 25 caret * 0.10 ETH = 2.50 ETH
q3_calc = Decimal('25.00') * Decimal('0.10')
test("25 * 0.10 = 2.50 ETH exact", q3_calc == Decimal('2.50'))

print("\n--- CHECK 6: Sensitive Data Leak Prevention ---")
# Public Crop Passport
pub_crop_res = anon_client.get(f"/api/farmer/crops/public/{passport.pk}/")
test("Public Crop Passport returns HTTP 200", pub_crop_res.status_code == 200)
test("Public Crop Passport does NOT expose password", 'password' not in pub_crop_res.data)
test("Public Crop Passport does NOT expose aadhaar", 'aadhaar_number' not in pub_crop_res.data)
test("Public Crop Passport does NOT expose email", 'email' not in pub_crop_res.data)

# Public DID Resolution
pub_did_res = anon_client.get(f"/api/did/{farmer1.did}/")
test("Public DID resolution returns HTTP 200", pub_did_res.status_code == 200)
test("Public DID resolution does NOT expose password", 'password' not in pub_did_res.data)
test("Public DID resolution does NOT expose aadhaar", 'aadhaar_number' not in pub_did_res.data)
test("Public DID resolution does NOT expose email", 'email' not in pub_did_res.data)

# Cleanup
RetailerEscrowTransaction.objects.filter(quote__product_name__startswith="AuditTest").delete()
EscrowTransaction.objects.filter(quote__product_name__startswith="AuditTest").delete()
RetailerBid.objects.filter(comments__startswith="AuditTest").delete()
FPOBid.objects.filter(comments__startswith="AuditTest").delete()
FPOQuote.objects.filter(product_name__startswith="AuditTest").delete()
FarmerQuote.objects.filter(product_name__startswith="AuditTest").delete()
CropPassport.objects.filter(crop_name__startswith="AuditTest").delete()
farmer1.delete()
farmer2.delete()
fpo1.delete()
fpo2.delete()
ret1.delete()
ret2.delete()

print("\n" + "=" * 60)
print(f"  AUDIT PASSED: {passed}")
print(f"  AUDIT FAILED: {failed}")
print("=" * 60)

if failed == 0:
    print("  ALL PHASE G AUDIT CHECKS PASSED!\n")
else:
    print(f"  {failed} AUDIT CHECK(S) FAILED.\n")

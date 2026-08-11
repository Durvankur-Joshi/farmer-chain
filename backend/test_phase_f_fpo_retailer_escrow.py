"""
Phase F — FPO ↔ Retailer Escrow Test Suite.
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

from fpo.models import FPO, FPOQuote
from retailer.models import Retailer, RetailerBid
from escrow.models import RetailerEscrowTransaction

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
print("Phase F -- FPO -> Retailer Escrow Test Suite")
print("=" * 60)

# Cleanup
RetailerEscrowTransaction.objects.filter(quote__product_name__startswith="TestPhaseF").delete()
RetailerBid.objects.filter(comments__startswith="TestPhaseF").delete()
FPOQuote.objects.filter(product_name__startswith="TestPhaseF").delete()
FPO.objects.filter(email__in=["phase_f_fpo1@test.com", "phase_f_fpo2@test.com"]).delete()
Retailer.objects.filter(email__in=["phase_f_ret1@test.com", "phase_f_ret2@test.com"]).delete()

def make_token(user, role):
    token = RefreshToken()
    token['user_id'] = user.id
    token['role'] = role
    token['name'] = user.name
    token['username'] = user.name
    return str(token.access_token)

# Create test entities
fpo1 = FPO.objects.create(
    name="Phase F FPO 1",
    email="phase_f_fpo1@test.com",
    password="test",
    corporate_identification_number="U01111MH2023PTC666661",
    wallet_address="0x1111000011110000111100001111000011110000",
    approval_status="approved",
    city="Nashik",
    state="MH"
)

fpo2 = FPO.objects.create(
    name="Phase F FPO 2 (Other)",
    email="phase_f_fpo2@test.com",
    password="test",
    corporate_identification_number="U01111MH2023PTC666662",
    wallet_address="0x2222000022220000222200002222000022220000",
    approval_status="approved",
    city="Pune",
    state="MH"
)

retailer1 = Retailer.objects.create(
    name="Phase F Retailer 1",
    email="phase_f_ret1@test.com",
    password="test",
    gstin="27AABCU6666K1Z1",
    wallet_address="0x3333000033330000333300003333000033330000",
    approval_status="approved",
    city="Mumbai",
    state="MH"
)

retailer2 = Retailer.objects.create(
    name="Phase F Retailer 2 (Other)",
    email="phase_f_ret2@test.com",
    password="test",
    gstin="27AABCU6666K1Z2",
    wallet_address="0x4444000044440000444400004444000044440000",
    approval_status="approved",
    city="Thane",
    state="MH"
)

fpo1_client = APIClient()
t_fpo1 = make_token(fpo1, 'fpo')
fpo1_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_fpo1}')
fpo1_client.cookies['access_token'] = t_fpo1

fpo2_client = APIClient()
t_fpo2 = make_token(fpo2, 'fpo')
fpo2_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_fpo2}')
fpo2_client.cookies['access_token'] = t_fpo2

ret1_client = APIClient()
t_ret1 = make_token(retailer1, 'retailer')
ret1_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_ret1}')
ret1_client.cookies['access_token'] = t_ret1

ret2_client = APIClient()
t_ret2 = make_token(retailer2, 'retailer')
ret2_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_ret2}')
ret2_client.cookies['access_token'] = t_ret2

# Create FPO Quote and accepted bid
quote1 = FPOQuote.objects.create(
    fpo=fpo1,
    product_name="TestPhaseF Premium Basmati Rice",
    category="Grains",
    description="50 quintals processed high-grade rice.",
    quantity=Decimal('50.00'),
    unit='quintal',
    price_per_unit=Decimal('0.05'),
    deadline=(timezone.now() + timedelta(days=10)).date(),
    status='awarded'
)

bid1 = RetailerBid.objects.create(
    retailer=retailer1,
    quote=quote1,
    bid_amount=Decimal('0.04'),
    delivery_time_days=3,
    comments='TestPhaseF accepted bid',
    status='accepted'
)
quote1.accepted_bid = bid1
quote1.save()

print("\n--- Test 1: FPO Creates Retailer Escrow Record ---")
create_res = fpo1_client.post(
    "/api/escrow/retailer/create/",
    {
        'quote_id': quote1.pk,
        'contract_address': '0xf8e81D47203A594245E36C48e151709F0C19fBe8'
    }
)
test("FPO create retailer escrow returns HTTP 201", create_res.status_code == 201, str(create_res.data))
escrow_id_db = create_res.data['escrow']['id']
test("Escrow calculated amount: 50 quintal * 0.04 ETH = 2.00 ETH", Decimal(str(create_res.data['escrow']['amount_eth'])) == Decimal('2.00'))
test("Escrow initial status is 'created'", create_res.data['escrow']['status'] == 'created')

print("\n--- Test 2: Duplicate Escrow Creation Blocked ---")
dup_res = fpo1_client.post(
    "/api/escrow/retailer/create/",
    {
        'quote_id': quote1.pk,
        'contract_address': '0xf8e81D47203A594245E36C48e151709F0C19fBe8'
    }
)
test("Duplicate escrow creation returns HTTP 409 Conflict", dup_res.status_code == 409)

print("\n--- Test 3: Other FPO Cannot Manage FPO 1 Escrow ---")
wrong_fpo_res = fpo2_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/created-onchain/",
    {
        'tx_hash': '0x' + 'a' * 64,
        'escrow_id': 101,
        'contract_address': '0xf8e81D47203A594245E36C48e151709F0C19fBe8'
    }
)
test("Non-owning FPO cannot record on-chain escrow (HTTP 403)", wrong_fpo_res.status_code == 403)

print("\n--- Test 4: FPO Records On-Chain Escrow Creation ---")
onchain_res = fpo1_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/created-onchain/",
    {
        'tx_hash': '0x' + '1' * 64,
        'escrow_id': 101,
        'contract_address': '0xf8e81D47203A594245E36C48e151709F0C19fBe8'
    }
)
test("FPO records on-chain creation returns HTTP 200", onchain_res.status_code == 200)
test("On-chain escrow_id is set to 101", onchain_res.data['escrow']['escrow_id'] == 101)

print("\n--- Test 5: Retailer Funds Escrow ---")
# Wrong retailer attempts to fund
wrong_ret_fund = ret2_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/funded/",
    {'tx_hash': '0x' + '2' * 64}
)
test("Wrong retailer cannot fund escrow (HTTP 403)", wrong_ret_fund.status_code == 403)

# Correct retailer funds
ret1_fund = ret1_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/funded/",
    {'tx_hash': '0x' + '2' * 64}
)
test("Correct retailer funds escrow (HTTP 200)", ret1_fund.status_code == 200)
test("Escrow status updated to 'funded'", ret1_fund.data['escrow']['status'] == 'funded')

# Duplicate funding blocked
dup_fund = ret1_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/funded/",
    {'tx_hash': '0x' + '2' * 64}
)
test("Duplicate funding blocked (HTTP 400)", dup_fund.status_code == 400)

print("\n--- Test 6: FPO Confirms Delivery ---")
# Retailer attempts to confirm delivery (wrong role)
ret_deliver_res = ret1_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/delivery-confirm/",
    {'tx_hash': '0x' + '3' * 64}
)
test("Retailer cannot confirm delivery (HTTP 403)", ret_deliver_res.status_code == 403)

# Correct FPO confirms delivery
fpo_deliver_res = fpo1_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/delivery-confirm/",
    {'tx_hash': '0x' + '3' * 64}
)
test("FPO confirms delivery (HTTP 200)", fpo_deliver_res.status_code == 200)
test("Escrow status updated to 'delivery_confirmed'", fpo_deliver_res.data['escrow']['status'] == 'delivery_confirmed')

print("\n--- Test 7: Retailer Releases Payment ---")
# FPO attempts to release payment (wrong role)
fpo_release_res = fpo1_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/released/",
    {'tx_hash': '0x' + '4' * 64}
)
test("FPO cannot release payment (HTTP 403)", fpo_release_res.status_code == 403)

# Correct retailer releases payment
ret_release_res = ret1_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/released/",
    {'tx_hash': '0x' + '4' * 64}
)
test("Retailer releases payment (HTTP 200)", ret_release_res.status_code == 200)
test("Escrow status updated to 'released'", ret_release_res.data['escrow']['status'] == 'released')

# Duplicate release blocked
dup_release = ret1_client.post(
    f"/api/escrow/retailer/{escrow_id_db}/released/",
    {'tx_hash': '0x' + '4' * 64}
)
test("Duplicate payment release blocked (HTTP 400)", dup_release.status_code == 400)

print("\n--- Test 8: My Escrows List Verification ---")
fpo_my = fpo1_client.get("/api/escrow/retailer/my/")
test("FPO /api/escrow/retailer/my/ returns HTTP 200", fpo_my.status_code == 200)
test("FPO sees their deal", any(e['id'] == escrow_id_db for e in fpo_my.data['escrows']))

ret_my = ret1_client.get("/api/escrow/retailer/my/")
test("Retailer /api/escrow/retailer/my/ returns HTTP 200", ret_my.status_code == 200)
test("Retailer sees their deal", any(e['id'] == escrow_id_db for e in ret_my.data['escrows']))

# Cleanup
RetailerEscrowTransaction.objects.filter(quote__product_name__startswith="TestPhaseF").delete()
RetailerBid.objects.filter(comments__startswith="TestPhaseF").delete()
FPOQuote.objects.filter(product_name__startswith="TestPhaseF").delete()
fpo1.delete()
fpo2.delete()
retailer1.delete()
retailer2.delete()

print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed == 0:
    print("  ALL PHASE F TESTS PASSED! \n")
else:
    print(f"  {failed} TEST(S) FAILED.\n")

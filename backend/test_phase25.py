"""
Phase 2.5 — Escrow API test suite.

Tests the escrow model, views, and API permissions without requiring
a deployed smart contract (backend-only validation).
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
from farmer.models import Farmer, FarmerQuote
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
print("Phase 2.5 — Escrow Test Suite")
print("=" * 60)

# ── Setup test data ──────────────────────────────────────────────
print("\n--- Setup ---")

# Clean up any previous test data
EscrowTransaction.objects.filter(
    quote__product_name__startswith='ESCROW_TEST_'
).delete()
FarmerQuote.objects.filter(product_name__startswith='ESCROW_TEST_').delete()

# Get or create test farmer
farmer, _ = Farmer.objects.get_or_create(
    email='escrow_test_farmer@test.com',
    defaults={
        'name': 'Test Farmer',
        'password': 'test',
        'aadhaar_number': '999900001111',
        'wallet_address': '0x1111111111111111111111111111111111111111',
        'city': 'TestCity',
        'state': 'TestState',
        'approval_status': 'approved',
    }
)

# Get or create test FPO
fpo, _ = FPO.objects.get_or_create(
    email='escrow_test_fpo@test.com',
    defaults={
        'name': 'Test FPO',
        'password': 'test',
        'corporate_identification_number': 'ESCROW_CIN_001',
        'wallet_address': '0x2222222222222222222222222222222222222222',
        'city': 'TestCity',
        'state': 'TestState',
        'approval_status': 'approved',
    }
)

print(f"  Farmer: {farmer.name} (id={farmer.pk})")
print(f"  FPO:    {fpo.name} (id={fpo.pk})")

# ── Test 1: Model creation ─────────────────────────────────────
print("\n--- Test 1: EscrowTransaction model ---")

quote = FarmerQuote.objects.create(
    farmer=farmer,
    product_name='ESCROW_TEST_Wheat',
    category='Grain',
    description='Test quote for escrow',
    quantity=Decimal('100.00'),
    unit='kg',
    status='accepted',
    deadline=timezone.now().date() + timezone.timedelta(days=30),
)

bid = FPOBid.objects.create(
    fpo=fpo,
    quote=quote,
    bid_amount=Decimal('0.01'),
    delivery_time_days=7,
    status='accepted',
)
quote.accepted_bid = bid
quote.save()

escrow = EscrowTransaction.objects.create(
    farmer=farmer,
    fpo=fpo,
    quote=quote,
    contract_address='0x3333333333333333333333333333333333333333',
    amount_eth=Decimal('1.00000000'),
    status=EscrowTransaction.STATUS_CREATED,
)

test("Escrow created", escrow.pk is not None)
test("Status is 'created'", escrow.status == 'created')
test("Amount correct", escrow.amount_eth == Decimal('1.00000000'))
test("Farmer FK", escrow.farmer_id == farmer.pk)
test("FPO FK", escrow.fpo_id == fpo.pk)
test("Quote FK", escrow.quote_id == quote.pk)
test("__str__ works", 'Test Farmer' in str(escrow))

# ── Test 2: Prevent duplicate escrow ────────────────────────────
print("\n--- Test 2: Duplicate escrow prevention ---")

try:
    EscrowTransaction.objects.create(
        farmer=farmer,
        fpo=fpo,
        quote=quote,
        contract_address='0x3333333333333333333333333333333333333333',
        amount_eth=Decimal('1.00000000'),
        status=EscrowTransaction.STATUS_CREATED,
    )
    test("Duplicate escrow rejected", False, "Should have raised IntegrityError")
except Exception as e:
    test("Duplicate escrow rejected", "UNIQUE constraint" in str(e) or "unique" in str(e).lower(), str(e))

# ── Test 3: Status transitions ──────────────────────────────────
print("\n--- Test 3: Status transitions ---")

escrow.status = EscrowTransaction.STATUS_FUNDED
escrow.deposit_tx_hash = '0x' + 'a' * 64
escrow.funded_at = timezone.now()
escrow.save()
test("Funded status", escrow.status == 'funded')
test("Deposit tx hash saved", escrow.deposit_tx_hash == '0x' + 'a' * 64)

escrow.status = EscrowTransaction.STATUS_DELIVERY_CONFIRMED
escrow.delivery_tx_hash = '0x' + 'b' * 64
escrow.delivery_confirmed_at = timezone.now()
escrow.save()
test("Delivery confirmed", escrow.status == 'delivery_confirmed')

escrow.status = EscrowTransaction.STATUS_RELEASED
escrow.release_tx_hash = '0x' + 'c' * 64
escrow.released_at = timezone.now()
escrow.save()
test("Released status", escrow.status == 'released')

# ── Test 4: Etherscan URLs ──────────────────────────────────────
print("\n--- Test 4: Etherscan URLs ---")

test(
    "Deposit etherscan URL",
    escrow.etherscan_deposit_url == f"https://sepolia.etherscan.io/tx/0x{'a'*64}",
)
test(
    "Release etherscan URL",
    escrow.etherscan_release_url == f"https://sepolia.etherscan.io/tx/0x{'c'*64}",
)
test(
    "Contract etherscan URL",
    escrow.etherscan_contract_url is not None and 'sepolia.etherscan.io' in escrow.etherscan_contract_url,
)

# ── Test 5: Serializer ──────────────────────────────────────────
print("\n--- Test 5: Serializer ---")

from escrow.serializers import EscrowTransactionSerializer
data = EscrowTransactionSerializer(escrow).data
test("Serializer has farmer_name", data.get('farmer_name') == 'Test Farmer')
test("Serializer has fpo_name", data.get('fpo_name') == 'Test FPO')
test("Serializer has product_name", data.get('product_name') == 'ESCROW_TEST_Wheat')
test("Serializer has amount_eth", data.get('amount_eth') is not None)
test("Serializer has etherscan URLs", data.get('etherscan_deposit_url') is not None)
test("Serializer has contract_address", data.get('contract_address') is not None)
test("Serializer has quote_id", data.get('quote_id') == quote.pk)

# ── Test 6: View tx hash validation ─────────────────────────────
print("\n--- Test 6: Tx hash validation ---")

from escrow.views import _validate_tx_hash
test("Valid tx hash", _validate_tx_hash('0x' + 'a' * 64))
test("Invalid: too short", not _validate_tx_hash('0x' + 'a' * 63))
test("Invalid: no 0x prefix", not _validate_tx_hash('a' * 66))
test("Invalid: empty", not _validate_tx_hash(''))
test("Invalid: None", not _validate_tx_hash(None))

# ── Test 7: Second quote with escrow (no conflict) ──────────────
print("\n--- Test 7: Multiple escrows for different quotes ---")

quote2 = FarmerQuote.objects.create(
    farmer=farmer,
    product_name='ESCROW_TEST_Rice',
    category='Grain',
    description='Another test',
    quantity=Decimal('50.00'),
    unit='kg',
    status='accepted',
    deadline=timezone.now().date() + timezone.timedelta(days=30),
)
bid2 = FPOBid.objects.create(
    fpo=fpo,
    quote=quote2,
    bid_amount=Decimal('0.02'),
    delivery_time_days=5,
    status='accepted',
)

escrow2 = EscrowTransaction.objects.create(
    farmer=farmer,
    fpo=fpo,
    quote=quote2,
    contract_address='0x3333333333333333333333333333333333333333',
    amount_eth=Decimal('1.00000000'),
    status=EscrowTransaction.STATUS_CREATED,
)
test("Second escrow created OK", escrow2.pk is not None)
test("Different from first", escrow2.pk != escrow.pk)

# ── Test 8: Existing features not broken ────────────────────────
print("\n--- Test 8: Existing models still work ---")

from farmer.models import CropPassport, CropPassportDocument, AIQualityVerification
test("CropPassport model accessible", CropPassport.objects.count() >= 0)
test("CropPassportDocument model accessible", CropPassportDocument.objects.count() >= 0)
test("AIQualityVerification model accessible", AIQualityVerification.objects.count() >= 0)

from fpo.models import FPOQuote
test("FPOQuote model accessible", FPOQuote.objects.count() >= 0)
test("FPOBid model accessible", FPOBid.objects.count() >= 0)
test("FarmerQuote model accessible", FarmerQuote.objects.count() >= 0)

# ── Cleanup ─────────────────────────────────────────────────────
print("\n--- Cleanup ---")
escrow2.delete()
escrow.delete()
quote2.delete()
bid2.delete()
bid.delete()
quote.delete()
print("  Test data cleaned up.")

# ── Summary ─────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed > 0:
    sys.exit(1)
else:
    print("\n  ALL TESTS PASSED!\n")

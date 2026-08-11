"""
Phase B — Crop Passport -> Quote Integration Test Suite.
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
from farmer.models import Farmer, FarmerQuote, CropPassport
from farmer.serializers import FarmerQuoteSerializer
from fpo.models import FPO, FPOBid
from fpo.serializers import FPOBidSerializer
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
print("Phase B — Crop Passport -> Quote Integration Test Suite")
print("=" * 60)

# Clean up previous test artifacts
EscrowTransaction.objects.filter(quote__product_name__startswith="TestPhaseB").delete()
FarmerQuote.objects.filter(product_name__startswith="TestPhaseB").delete()
CropPassport.objects.filter(crop_name__startswith="TestPhaseB").delete()
Farmer.objects.filter(email__in=["phase_b_farmer1@test.com", "phase_b_farmer2@test.com"]).delete()
FPO.objects.filter(email="phase_b_fpo@test.com").delete()

# Create test farmers
farmer1, _ = Farmer.objects.get_or_create(
    email="phase_b_farmer1@test.com",
    defaults={
        'name': "Phase B Farmer 1",
        'password': 'test',
        'aadhaar_number': "888811112222",
        'wallet_address': "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        'approval_status': "approved",
        'city': "Nashik",
        'state': "MH"
    }
)

farmer2, _ = Farmer.objects.get_or_create(
    email="phase_b_farmer2@test.com",
    defaults={
        'name': "Phase B Farmer 2",
        'password': 'test',
        'aadhaar_number': "888833334444",
        'wallet_address': "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        'approval_status': "approved",
        'city': "Nagpur",
        'state': "MH"
    }
)

fpo, _ = FPO.objects.get_or_create(
    email="phase_b_fpo@test.com",
    defaults={
        'name': "Phase B FPO",
        'password': 'test',
        'corporate_identification_number': "U01111MH2023PTC888888",
        'wallet_address': "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        'approval_status': "approved",
        'city': "Pune",
        'state': "MH"
    }
)

# Create valid Crop Passport for Farmer 1
passport1 = CropPassport.objects.create(
    farmer=farmer1,
    crop_name="TestPhaseB Organic Alphonso Mango",
    crop_category="Fruits",
    description="Grade A Alphonso Mangoes freshly harvested from Ratnagiri orchard.",
    quantity=Decimal('250.00'),
    unit='quintal',
    cultivation_date=(timezone.now() - timedelta(days=90)).date(),
    harvest_date=(timezone.now() - timedelta(days=5)).date(),
    location="Ratnagiri, MH",
    status='registered'
)

# Create valid Crop Passport for Farmer 2
passport2 = CropPassport.objects.create(
    farmer=farmer2,
    crop_name="TestPhaseB Nagpur Oranges",
    crop_category="Fruits",
    description="Nagpur juicy oranges.",
    quantity=Decimal('100.00'),
    unit='quintal',
    cultivation_date=(timezone.now() - timedelta(days=60)).date(),
    harvest_date=(timezone.now() - timedelta(days=3)).date(),
    location="Nagpur, MH",
    status='minted'
)

future_deadline = (timezone.now() + timedelta(days=10)).date().isoformat()

# Fake request object for serializer context
class MockUser:
    def __init__(self, farmer_obj):
        self.user_obj = farmer_obj

class MockRequest:
    def __init__(self, farmer_obj):
        self.user = MockUser(farmer_obj)

req_farmer1 = MockRequest(farmer1)
req_farmer2 = MockRequest(farmer2)

print("\n--- Test 1: Farmer with Valid Passport -> Quote Succeeds & Auto-Populates ---")
data_valid = {
    'crop_passport': passport1.pk,
    'price_per_unit': '0.05',
    'deadline': future_deadline,
    'description': 'Ready for immediate dispatch.'
}
s_valid = FarmerQuoteSerializer(data=data_valid, context={'request': req_farmer1})
is_valid = s_valid.is_valid()
test("Valid passport quote creation serializer validation passes", is_valid, str(s_valid.errors))

if is_valid:
    quote1 = s_valid.save(farmer=farmer1)
    test("Quote crop_passport FK is linked", quote1.crop_passport == passport1)
    test("Product name auto-populated from passport", quote1.product_name == passport1.crop_name)
    test("Category auto-populated from passport", quote1.category == passport1.crop_category)
    test("Quantity auto-populated from passport", quote1.quantity == passport1.quantity)
    test("Unit auto-populated from passport", quote1.unit == passport1.unit)
    test("Price per unit saved correctly in ETH", str(quote1.price_per_unit) == '0.05')

print("\n--- Test 2: Farmer with No Passport -> Quote Creation Rejected ---")
data_no_passport = {
    'price_per_unit': '0.05',
    'deadline': future_deadline
}
s_no_pp = FarmerQuoteSerializer(data=data_no_passport, context={'request': req_farmer1})
test("Quote without passport is rejected", not s_no_pp.is_valid())
test("Clear error message returned", 'crop_passport' in s_no_pp.errors and "Create and complete a Crop Passport" in str(s_no_pp.errors['crop_passport']))

print("\n--- Test 3: Incomplete/Invalid Passport -> Quote Rejected ---")
# Create incomplete passport (quantity = 0 or missing crop_name)
bad_passport = CropPassport.objects.create(
    farmer=farmer1,
    crop_name="",
    crop_category="Vegetables",
    quantity=Decimal('0.00'),
    unit='kg',
    cultivation_date=(timezone.now() - timedelta(days=30)).date(),
    harvest_date=timezone.now().date(),
    status='registered'
)
data_bad_pp = {
    'crop_passport': bad_passport.pk,
    'price_per_unit': '0.02',
    'deadline': future_deadline
}
s_bad_pp = FarmerQuoteSerializer(data=data_bad_pp, context={'request': req_farmer1})
test("Incomplete passport is rejected", not s_bad_pp.is_valid())
test("Error identifies passport invalidity", 'crop_passport' in s_bad_pp.errors)

print("\n--- Test 4: Passport Belonging to Another Farmer -> Backend Rejection ---")
# Farmer 1 tries to use Farmer 2's passport
data_other_farmer = {
    'crop_passport': passport2.pk,
    'price_per_unit': '0.05',
    'deadline': future_deadline
}
s_other = FarmerQuoteSerializer(data=data_other_farmer, context={'request': req_farmer1})
test("Other farmer's passport is rejected", not s_other.is_valid())
test("Error confirms ownership rejection", 'crop_passport' in s_other.errors and "You do not own this Crop Passport" in str(s_other.errors['crop_passport']))

print("\n--- Test 5: Existing Quote -> FPO Bid -> Acceptance -> Escrow Workflow ---")
# FPO submits bid on Quote 1
bid_data = {
    'quote': quote1.pk,
    'bid_amount': '0.04',
    'delivery_time_days': 4
}
s_fpo_bid = FPOBidSerializer(data=bid_data)
test("FPO Bid on passport-linked quote succeeds", s_fpo_bid.is_valid(), str(s_fpo_bid.errors))

if s_fpo_bid.is_valid():
    bid1 = s_fpo_bid.save(fpo=fpo, quote=quote1)
    test("FPO Bid saved with status 'submitted'", bid1.status == 'submitted')

    # Farmer accepts bid
    quote1.status = 'accepted'
    quote1.accepted_bid = bid1
    quote1.save()
    bid1.status = 'accepted'
    bid1.save()
    test("Bid accepted and quote status updated to 'accepted'", quote1.status == 'accepted' and bid1.status == 'accepted')

    # Escrow creation
    escrow = EscrowTransaction.objects.create(
        quote=quote1,
        farmer=farmer1,
        fpo=fpo,
        amount_eth=Decimal(str(quote1.quantity * bid1.bid_amount)),
        status='created'
    )
    test("Escrow created from passport quote", escrow.pk is not None)
    test("Escrow calculated amount: 250 quintal * 0.04 ETH = 10.00 ETH", escrow.amount_eth == Decimal('10.0000'))

# Cleanup
EscrowTransaction.objects.filter(quote__product_name__startswith="TestPhaseB").delete()
FarmerQuote.objects.filter(product_name__startswith="TestPhaseB").delete()
CropPassport.objects.filter(crop_name__startswith="TestPhaseB").delete()
bad_passport.delete()
farmer1.delete()
farmer2.delete()
fpo.delete()

print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed == 0:
    print("  ALL PHASE B TESTS PASSED! \n")
else:
    print(f"  {failed} TEST(S) FAILED.\n")

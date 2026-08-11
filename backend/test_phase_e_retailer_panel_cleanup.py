"""
Phase E — Retailer Panel Cleanup Test Suite.
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
from fpo.serializers import FPOQuoteSerializer
from retailer.models import Retailer, RetailerBid
from retailer.serializers import RetailerBidSerializer, MyBidSerializer

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
print("Phase E — Retailer Panel Cleanup Test Suite")
print("=" * 60)

# Cleanup
RetailerBid.objects.filter(comments__startswith="TestPhaseE").delete()
FPOQuote.objects.filter(product_name__startswith="TestPhaseE").delete()
Retailer.objects.filter(email="phase_e_retailer@test.com").delete()
FPO.objects.filter(email="phase_e_fpo@test.com").delete()

fpo = FPO.objects.create(
    name="Phase E Test FPO",
    email="phase_e_fpo@test.com",
    password="test",
    corporate_identification_number="U01111MH2023PTC777777",
    wallet_address="0x4444555566667777888899990000111122223333",
    approval_status="approved",
    city="Nashik",
    state="MH"
)

retailer = Retailer.objects.create(
    name="Phase E Test Retailer",
    email="phase_e_retailer@test.com",
    password="test",
    gstin="27AABCU7777K1Z5",
    wallet_address="0x5555666677778888999900001111222233334444",
    approval_status="approved",
    city="Mumbai",
    state="MH"
)

def make_token(user, role):
    token = RefreshToken()
    token['user_id'] = user.id
    token['role'] = role
    token['name'] = user.name
    token['username'] = user.name
    return str(token.access_token)

retailer_client = APIClient()
token = make_token(retailer, 'retailer')
retailer_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
retailer_client.cookies['access_token'] = token

print("\n--- Test 1: Category Validation in FPOQuoteSerializer ---")
valid_categories = ['Grains', 'Vegetables', 'Fruits', 'Pulses', 'Oilseeds', 'Dairy']
for cat in valid_categories:
    s = FPOQuoteSerializer(data={
        'product_name': f'TestPhaseE {cat}',
        'category': cat,
        'description': f'Premium {cat} description',
        'quantity': '100.00',
        'unit': 'kg',
        'price_per_unit': '0.02',
        'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
    })
    test(f"Category '{cat}' is accepted", s.is_valid(), str(s.errors))

s_invalid_cat = FPOQuoteSerializer(data={
    'product_name': 'TestPhaseE Invalid',
    'category': 'Electronics',
    'description': 'Invalid item',
    'quantity': '100.00',
    'unit': 'kg',
    'price_per_unit': '0.02',
    'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
})
test("Invalid category 'Electronics' is rejected", not s_invalid_cat.is_valid())
test("Error identifies invalid category", 'category' in s_invalid_cat.errors)

print("\n--- Test 2: Quantity Validation (numeric, > 0, reject negative/zero/text) ---")
s_neg_qty = FPOQuoteSerializer(data={
    'product_name': 'TestPhaseE Neg Qty',
    'category': 'Grains',
    'description': 'Test description',
    'quantity': '-10.00',
    'unit': 'kg',
    'price_per_unit': '0.02',
    'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
})
test("Negative quantity (-10) is rejected", not s_neg_qty.is_valid())
test("Error identifies quantity", 'quantity' in s_neg_qty.errors)

s_zero_qty = FPOQuoteSerializer(data={
    'product_name': 'TestPhaseE Zero Qty',
    'category': 'Grains',
    'description': 'Test description',
    'quantity': '0.00',
    'unit': 'kg',
    'price_per_unit': '0.02',
    'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
})
test("Zero quantity (0) is rejected", not s_zero_qty.is_valid())

s_text_qty = FPOQuoteSerializer(data={
    'product_name': 'TestPhaseE Text Qty',
    'category': 'Grains',
    'description': 'Test description',
    'quantity': 'many',
    'unit': 'kg',
    'price_per_unit': '0.02',
    'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
})
test("Non-numeric text quantity is rejected", not s_text_qty.is_valid())

print("\n--- Test 3: Units Validation (kg, quintal, caret, piece) ---")
for unit in ['kg', 'quintal', 'caret', 'piece']:
    s_unit = FPOQuoteSerializer(data={
        'product_name': f'TestPhaseE {unit}',
        'category': 'Grains',
        'description': 'Test lot description',
        'quantity': '50.00',
        'unit': unit,
        'price_per_unit': '0.01',
        'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
    })
    test(f"Unit '{unit}' is accepted", s_unit.is_valid(), str(s_unit.errors))

s_bad_unit = FPOQuoteSerializer(data={
    'product_name': 'TestPhaseE Bad Unit',
    'category': 'Grains',
    'description': 'Test lot description',
    'quantity': '50.00',
    'unit': 'gallons',
    'price_per_unit': '0.01',
    'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
})
test("Unsupported unit 'gallons' is rejected", not s_bad_unit.is_valid())

print("\n--- Test 4: Price Per Unit Validation (> 0, reject negative/zero) ---")
s_neg_price = FPOQuoteSerializer(data={
    'product_name': 'TestPhaseE Neg Price',
    'category': 'Grains',
    'description': 'Test lot description',
    'quantity': '50.00',
    'unit': 'kg',
    'price_per_unit': '-0.05',
    'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
})
test("Negative price is rejected", not s_neg_price.is_valid())

s_zero_price = FPOQuoteSerializer(data={
    'product_name': 'TestPhaseE Zero Price',
    'category': 'Grains',
    'description': 'Test lot description',
    'quantity': '50.00',
    'unit': 'kg',
    'price_per_unit': '0.00',
    'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
})
test("Zero price is rejected", not s_zero_price.is_valid())

print("\n--- Test 5: Retailer Bid Validations & Consistency ---")
fpo_quote = FPOQuote.objects.create(
    fpo=fpo,
    product_name="TestPhaseE Organic Wheat Lot",
    category="Grains",
    description="Bulk grade A wheat lot.",
    quantity=Decimal('200.00'),
    unit='quintal',
    price_per_unit=Decimal('0.045'),
    deadline=(timezone.now() + timedelta(days=10)).date(),
    status='open'
)

# Valid bid
bid_valid = RetailerBidSerializer(data={
    'bid_amount': '0.04',
    'delivery_time_days': 3,
    'comments': 'TestPhaseE valid bid'
})
test("Valid Retailer Bid (0.04 ETH, 3 days) passes validation", bid_valid.is_valid(), str(bid_valid.errors))

# Negative bid
bid_neg = RetailerBidSerializer(data={
    'bid_amount': '-0.04',
    'delivery_time_days': 3
})
test("Negative bid amount is rejected", not bid_neg.is_valid())

# Zero bid
bid_zero = RetailerBidSerializer(data={
    'bid_amount': '0.00',
    'delivery_time_days': 3
})
test("Zero bid amount is rejected", not bid_zero.is_valid())

# Zero delivery days
bid_zero_days = RetailerBidSerializer(data={
    'bid_amount': '0.04',
    'delivery_time_days': 0
})
test("Zero delivery days is rejected", not bid_zero_days.is_valid())

# Negative delivery days
bid_neg_days = RetailerBidSerializer(data={
    'bid_amount': '0.04',
    'delivery_time_days': -2
})
test("Negative delivery days is rejected", not bid_neg_days.is_valid())

print("\n--- Test 6: Retailer Bid Submission & MyBidSerializer Consistency ---")
post_res = retailer_client.post(
    f"/api/retailer/quotes/fpo/{fpo_quote.pk}/bids/",
    {
        'bid_amount': '0.04',
        'delivery_time_days': 4,
        'comments': 'TestPhaseE submission'
    }
)
test("Retailer bid submission returns HTTP 201", post_res.status_code == 201, str(post_res.data))

# Get my bids
my_bids_res = retailer_client.get("/api/retailer/bids/my/")
test("Retailer get my bids returns HTTP 200", my_bids_res.status_code == 200)
matched_bids = [b for b in my_bids_res.data if b.get('quote', {}).get('product_name') == "TestPhaseE Organic Wheat Lot"]
test("Submitted bid found in my bids", len(matched_bids) == 1)
if matched_bids:
    mb = matched_bids[0]
    test("My bid rate is 0.04 ETH", Decimal(str(mb['bid_amount'])) == Decimal('0.04'))
    test("My bid delivery window is 4 days", mb['delivery_time_days'] == 4)
    test("Quote unit is 'quintal'", mb['quote']['unit'] == 'quintal')
    test("Quote quantity is 200.00", Decimal(str(mb['quote']['quantity'])) == Decimal('200.00'))

# Cleanup
RetailerBid.objects.filter(comments__startswith="TestPhaseE").delete()
FPOQuote.objects.filter(product_name__startswith="TestPhaseE").delete()
retailer.delete()
fpo.delete()

print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed == 0:
    print("  ALL PHASE E TESTS PASSED! \n")
else:
    print(f"  {failed} TEST(S) FAILED.\n")

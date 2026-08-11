"""
Phase A — Units & Pricing Consistency Test Suite.
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
from farmer.models import Farmer, FarmerQuote
from farmer.serializers import FarmerQuoteSerializer
from fpo.models import FPO, FPOBid, FPOQuote
from fpo.serializers import FPOBidSerializer, FPOQuoteSerializer
from retailer.models import Retailer, RetailerBid
from retailer.serializers import RetailerBidSerializer

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
print("Phase A — Units & Pricing Consistency Test Suite")
print("=" * 60)

# Clean up
FarmerQuote.objects.filter(product_name__startswith="TestPhaseA").delete()
FPOQuote.objects.filter(product_name__startswith="TestPhaseA").delete()
Farmer.objects.filter(email="phase_a_farmer@test.com").delete()
FPO.objects.filter(email="phase_a_fpo@test.com").delete()
Retailer.objects.filter(email="phase_a_retailer@test.com").delete()

farmer, _ = Farmer.objects.get_or_create(
    email="phase_a_farmer@test.com",
    defaults={
        'name': "Phase A Farmer",
        'password': 'test',
        'aadhaar_number': "777722223333",
        'wallet_address': "0x7777777777777777777777777777777777777777",
        'approval_status': "approved",
        'city': "Pune",
        'state': "MH"
    }
)

fpo, _ = FPO.objects.get_or_create(
    email="phase_a_fpo@test.com",
    defaults={
        'name': "Phase A FPO",
        'password': 'test',
        'corporate_identification_number': "U01111MH2023PTC777777",
        'wallet_address': "0x8888888888888888888888888888888888888888",
        'approval_status': "approved",
        'city': "Pune",
        'state': "MH"
    }
)

retailer, _ = Retailer.objects.get_or_create(
    email="phase_a_retailer@test.com",
    defaults={
        'name': "Phase A Retailer",
        'password': 'test',
        'gstin': "27AAAAA7777A1Z5",
        'wallet_address': "0x9999999999999999999999999999999999999999",
        'approval_status': "approved",
        'city': "Pune",
        'state': "MH"
    }
)

tomorrow = (timezone.now() + timedelta(days=5)).date().isoformat()

print("\n--- Test 1: Supported Units (kg, quintal, caret, piece, acre) in FarmerQuote ---")
supported_units = ['kg', 'quintal', 'caret', 'piece', 'acre', 'ton', 'litre']
for unit in supported_units:
    data = {
        'product_name': f'TestPhaseA {unit}',
        'category': 'Grains',
        'description': 'Test description',
        'quantity': '100.00',
        'unit': unit,
        'price_per_unit': '0.10',
        'deadline': tomorrow
    }
    serializer = FarmerQuoteSerializer(data=data)
    valid = serializer.is_valid()
    test(f"Unit '{unit}' accepted in FarmerQuoteSerializer", valid, str(serializer.errors))
    if valid:
        quote = serializer.save(farmer=farmer)
        test(f"Saved quote has unit='{unit}'", quote.unit == unit)

print("\n--- Test 2: Reject Invalid Units ---")
invalid_data = {
    'product_name': 'TestPhaseA InvalidUnit',
    'category': 'Grains',
    'description': 'Test',
    'quantity': '10.00',
    'unit': 'invalid_unit_xyz',
    'price_per_unit': '0.10',
    'deadline': tomorrow
}
serializer = FarmerQuoteSerializer(data=invalid_data)
test("Invalid unit rejected", not serializer.is_valid())
test("Error mentions unit", 'unit' in serializer.errors)

print("\n--- Test 3: Validate Quantity (> 0, reject 0 and negative) ---")
zero_qty_data = {
    'product_name': 'TestPhaseA ZeroQty',
    'category': 'Grains',
    'description': 'Test',
    'quantity': '0.00',
    'unit': 'kg',
    'price_per_unit': '0.10',
    'deadline': tomorrow
}
s_zero = FarmerQuoteSerializer(data=zero_qty_data)
test("Zero quantity rejected", not s_zero.is_valid() and 'quantity' in s_zero.errors)

neg_qty_data = {
    'product_name': 'TestPhaseA NegQty',
    'category': 'Grains',
    'description': 'Test',
    'quantity': '-10.00',
    'unit': 'kg',
    'price_per_unit': '0.10',
    'deadline': tomorrow
}
s_neg = FarmerQuoteSerializer(data=neg_qty_data)
test("Negative quantity rejected", not s_neg.is_valid() and 'quantity' in s_neg.errors)

print("\n--- Test 4: Validate Price per unit (> 0, reject 0 and negative) ---")
zero_price_data = {
    'product_name': 'TestPhaseA ZeroPrice',
    'category': 'Grains',
    'description': 'Test',
    'quantity': '10.00',
    'unit': 'kg',
    'price_per_unit': '0.00',
    'deadline': tomorrow
}
s_zprice = FarmerQuoteSerializer(data=zero_price_data)
test("Zero price_per_unit rejected", not s_zprice.is_valid() and 'price_per_unit' in s_zprice.errors)

neg_price_data = {
    'product_name': 'TestPhaseA NegPrice',
    'category': 'Grains',
    'description': 'Test',
    'quantity': '10.00',
    'unit': 'kg',
    'price_per_unit': '-0.50',
    'deadline': tomorrow
}
s_nprice = FarmerQuoteSerializer(data=neg_price_data)
test("Negative price_per_unit rejected", not s_nprice.is_valid() and 'price_per_unit' in s_nprice.errors)

print("\n--- Test 5: FPO Bid Validations & Unit Consistency ---")
test_quote = FarmerQuote.objects.filter(product_name__startswith="TestPhaseA").first()

valid_fpo_bid = {
    'bid_amount': '0.01',
    'delivery_time_days': 3,
    'quote': test_quote.pk
}
s_fpo = FPOBidSerializer(data=valid_fpo_bid)
test("Valid FPO Bid (0.01 ETH) accepted", s_fpo.is_valid(), str(s_fpo.errors))

zero_fpo_bid = {
    'bid_amount': '0.00',
    'delivery_time_days': 3,
    'quote': test_quote.pk
}
s_fpo_z = FPOBidSerializer(data=zero_fpo_bid)
test("Zero FPO Bid rejected", not s_fpo_z.is_valid() and 'bid_amount' in s_fpo_z.errors)

neg_fpo_bid = {
    'bid_amount': '-0.05',
    'delivery_time_days': 3,
    'quote': test_quote.pk
}
s_fpo_n = FPOBidSerializer(data=neg_fpo_bid)
test("Negative FPO Bid rejected", not s_fpo_n.is_valid() and 'bid_amount' in s_fpo_n.errors)

print("\n--- Test 6: Retailer Bid Validations ---")
fpo_quote = FPOQuote.objects.create(
    fpo=fpo,
    product_name="TestPhaseA FPO Lot",
    category="Grains",
    description="FPO lot",
    quantity=Decimal('500.00'),
    unit="quintal",
    price_per_unit=Decimal('0.10'),
    deadline=(timezone.now() + timedelta(days=7)).date()
)

valid_ret_bid = {
    'bid_amount': '0.10',
    'delivery_time_days': 5,
    'quote': fpo_quote.pk
}
s_ret = RetailerBidSerializer(data=valid_ret_bid)
test("Valid Retailer Bid (0.10 ETH) accepted", s_ret.is_valid(), str(s_ret.errors))

zero_ret_bid = {
    'bid_amount': '0.00',
    'delivery_time_days': 5,
    'quote': fpo_quote.pk
}
s_ret_z = RetailerBidSerializer(data=zero_ret_bid)
test("Zero Retailer Bid rejected", not s_ret_z.is_valid() and 'bid_amount' in s_ret_z.errors)

print("\n--- Test 7: Precision & Total Calculations (0.01, 0.10, 1.00 ETH) ---")
test_cases = [
    (Decimal('10.00'), Decimal('0.01'), Decimal('0.10'), "10 kg * 0.01 ETH/kg = 0.10 ETH"),
    (Decimal('10.00'), Decimal('0.10'), Decimal('1.00'), "10 kg * 0.10 ETH/kg = 1.00 ETH"),
    (Decimal('500.00'), Decimal('0.002'), Decimal('1.000'), "500 kg * 0.002 ETH/kg = 1.000 ETH"),
    (Decimal('25.00'), Decimal('0.10'), Decimal('2.50'), "25 caret * 0.10 ETH/caret = 2.50 ETH"),
    (Decimal('1.00'), Decimal('1.00'), Decimal('1.00'), "1 piece * 1.00 ETH/piece = 1.00 ETH"),
    (Decimal('100.00'), Decimal('0.05'), Decimal('5.00'), "100 quintal * 0.05 ETH/quintal = 5.00 ETH"),
]

for qty, price, expected_total, desc in test_cases:
    calculated = qty * price
    test(f"{desc} -> {calculated} ETH", calculated == expected_total)

# Cleanup
FarmerQuote.objects.filter(product_name__startswith="TestPhaseA").delete()
FPOQuote.objects.filter(product_name__startswith="TestPhaseA").delete()
farmer.delete()
fpo.delete()
retailer.delete()

print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed == 0:
    print("  ALL PHASE A TESTS PASSED! \n")
else:
    print(f"  {failed} TEST(S) FAILED.\n")

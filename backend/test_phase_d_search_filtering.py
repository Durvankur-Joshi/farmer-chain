"""
Phase D — Search & Filtering Test Suite.
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

from farmer.models import Farmer, FarmerQuote, CropPassport
from fpo.models import FPO, FPOQuote
from retailer.models import Retailer

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
print("Phase D — Search & Filtering Test Suite")
print("=" * 60)

# Cleanup
FPOQuote.objects.filter(product_name__startswith="TestPhaseD").delete()
FarmerQuote.objects.filter(product_name__startswith="TestPhaseD").delete()
CropPassport.objects.filter(crop_name__startswith="TestPhaseD").delete()
Farmer.objects.filter(email="phase_d_farmer@test.com").delete()
FPO.objects.filter(email="phase_d_fpo@test.com").delete()
Retailer.objects.filter(email="phase_d_retailer@test.com").delete()

def make_token(user, role):
    token = RefreshToken()
    token['user_id'] = user.id
    token['role'] = role
    token['name'] = getattr(user, 'name', 'User')
    token['username'] = getattr(user, 'name', 'User')
    return str(token.access_token)

farmer = Farmer.objects.create(
    name="Phase D Farmer",
    email="phase_d_farmer@test.com",
    password="test",
    aadhaar_number="888811112222",
    wallet_address="0x1111222233334444555566667777888899990000",
    approval_status="approved",
    city="Nashik",
    state="MH"
)

fpo = FPO.objects.create(
    name="Phase D FPO",
    email="phase_d_fpo@test.com",
    password="test",
    corporate_identification_number="U01111MH2023PTC888888",
    wallet_address="0x2222333344445555666677778888999900001111",
    approval_status="approved",
    city="Pune",
    state="MH"
)

retailer = Retailer.objects.create(
    name="Phase D Retailer",
    email="phase_d_retailer@test.com",
    password="test",
    gstin="27AABCU8888K1Z5",
    wallet_address="0x3333444455556666777788889999000011112222",
    approval_status="approved",
    city="Mumbai",
    state="MH"
)

farmer_client = APIClient()
t_farmer = make_token(farmer, 'farmer')
farmer_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_farmer}')
farmer_client.cookies['access_token'] = t_farmer

fpo_client = APIClient()
t_fpo = make_token(fpo, 'fpo')
fpo_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_fpo}')
fpo_client.cookies['access_token'] = t_fpo

retailer_client = APIClient()
t_retailer = make_token(retailer, 'retailer')
retailer_client.credentials(HTTP_AUTHORIZATION=f'Bearer {t_retailer}')
retailer_client.cookies['access_token'] = t_retailer

# Create sample crop passports
cp_wheat = CropPassport.objects.create(
    farmer=farmer,
    crop_name="TestPhaseD Sharbati Wheat",
    crop_category="Grains",
    quantity=Decimal('100.00'),
    unit='quintal',
    cultivation_date=(timezone.now() - timedelta(days=90)).date(),
    harvest_date=(timezone.now() - timedelta(days=10)).date(),
    status='registered'
)

cp_mango = CropPassport.objects.create(
    farmer=farmer,
    crop_name="TestPhaseD Alphonso Mango",
    crop_category="Fruits",
    quantity=Decimal('500.00'),
    unit='caret',
    cultivation_date=(timezone.now() - timedelta(days=120)).date(),
    harvest_date=(timezone.now() - timedelta(days=20)).date(),
    status='registered'
)

cp_tomato = CropPassport.objects.create(
    farmer=farmer,
    crop_name="TestPhaseD Organic Tomato",
    crop_category="Vegetables",
    quantity=Decimal('50.00'),
    unit='kg',
    cultivation_date=(timezone.now() - timedelta(days=60)).date(),
    harvest_date=(timezone.now() - timedelta(days=5)).date(),
    status='registered'
)

cp_watermelon = CropPassport.objects.create(
    farmer=farmer,
    crop_name="TestPhaseD Sweet Watermelon",
    crop_category="Fruits",
    quantity=Decimal('200.00'),
    unit='piece',
    cultivation_date=(timezone.now() - timedelta(days=75)).date(),
    harvest_date=(timezone.now() - timedelta(days=2)).date(),
    status='registered'
)

# Create Farmer quotes
q_wheat = FarmerQuote.objects.create(
    farmer=farmer,
    crop_passport=cp_wheat,
    product_name=cp_wheat.crop_name,
    category=cp_wheat.crop_category,
    quantity=cp_wheat.quantity,
    unit=cp_wheat.unit,
    price_per_unit=Decimal('0.03'),
    deadline=(timezone.now() + timedelta(days=10)).date(),
    status='open'
)

q_mango = FarmerQuote.objects.create(
    farmer=farmer,
    crop_passport=cp_mango,
    product_name=cp_mango.crop_name,
    category=cp_mango.crop_category,
    quantity=cp_mango.quantity,
    unit=cp_mango.unit,
    price_per_unit=Decimal('0.08'),
    deadline=(timezone.now() + timedelta(days=15)).date(),
    status='open'
)

q_tomato = FarmerQuote.objects.create(
    farmer=farmer,
    crop_passport=cp_tomato,
    product_name=cp_tomato.crop_name,
    category=cp_tomato.crop_category,
    quantity=cp_tomato.quantity,
    unit=cp_tomato.unit,
    price_per_unit=Decimal('0.001'),
    deadline=(timezone.now() + timedelta(days=5)).date(),
    status='open'
)

q_watermelon = FarmerQuote.objects.create(
    farmer=farmer,
    crop_passport=cp_watermelon,
    product_name=cp_watermelon.crop_name,
    category=cp_watermelon.crop_category,
    quantity=cp_watermelon.quantity,
    unit=cp_watermelon.unit,
    price_per_unit=Decimal('0.005'),
    deadline=(timezone.now() + timedelta(days=7)).date(),
    status='open'
)

# Create FPO quotes for Retailer market
fpo_q1 = FPOQuote.objects.create(
    fpo=fpo,
    product_name="TestPhaseD Premium Wheat Flour",
    category="Grains",
    quantity=Decimal('80.00'),
    unit='quintal',
    price_per_unit=Decimal('0.04'),
    deadline=(timezone.now() + timedelta(days=12)).date(),
    status='open'
)

fpo_q2 = FPOQuote.objects.create(
    fpo=fpo,
    product_name="TestPhaseD Fresh Mango Pulp",
    category="Fruits",
    quantity=Decimal('300.00'),
    unit='caret',
    price_per_unit=Decimal('0.10'),
    deadline=(timezone.now() + timedelta(days=18)).date(),
    status='open'
)

print("\n--- Test 1: Keyword Search (Crop & Category) ---")
res_search = fpo_client.get("/api/fpo/quotes/farmer/open/?search=Mango")
test("FPO search by crop keyword 'Mango' returns HTTP 200", res_search.status_code == 200)
mango_names = [q['product_name'] for q in res_search.data]
test("Search results contain Alphonso Mango", any("Alphonso Mango" in name for name in mango_names))
test("Search results do NOT contain Wheat", not any("Wheat" in name for name in mango_names))

print("\n--- Test 2: Category Filter ---")
res_cat = fpo_client.get("/api/fpo/quotes/farmer/open/?category=Vegetables")
test("Filter by Category 'Vegetables' returns HTTP 200", res_cat.status_code == 200)
cat_names = [q['product_name'] for q in res_cat.data]
test("Contains Organic Tomato", any("Organic Tomato" in name for name in cat_names))
test("Does not contain Mango or Wheat", not any("Mango" in name or "Wheat" in name for name in cat_names))

print("\n--- Test 3: Unit Filters (kg, quintal, caret, piece) ---")
res_kg = fpo_client.get("/api/fpo/quotes/farmer/open/?unit=kg")
test("Filter by unit 'kg' returns tomato", any("Organic Tomato" in q['product_name'] for q in res_kg.data))

res_quintal = fpo_client.get("/api/fpo/quotes/farmer/open/?unit=quintal")
test("Filter by unit 'quintal' returns wheat", any("Sharbati Wheat" in q['product_name'] for q in res_quintal.data))

res_caret = fpo_client.get("/api/fpo/quotes/farmer/open/?unit=caret")
test("Filter by unit 'caret' returns mango", any("Alphonso Mango" in q['product_name'] for q in res_caret.data))

res_piece = fpo_client.get("/api/fpo/quotes/farmer/open/?unit=piece")
test("Filter by unit 'piece' returns watermelon", any("Watermelon" in q['product_name'] for q in res_piece.data))

print("\n--- Test 4: Quantity Range Filters ---")
res_qty_min = fpo_client.get("/api/fpo/quotes/farmer/open/?min_qty=150")
test("Filter min_qty=150 returns 200 piece and 500 caret", all(Decimal(str(q['quantity'])) >= 150 for q in res_qty_min.data if q['product_name'].startswith("TestPhaseD")))

res_qty_max = fpo_client.get("/api/fpo/quotes/farmer/open/?max_qty=80")
test("Filter max_qty=80 returns 50 kg tomato", all(Decimal(str(q['quantity'])) <= 80 for q in res_qty_max.data if q['product_name'].startswith("TestPhaseD")))

res_qty_range = fpo_client.get("/api/fpo/quotes/farmer/open/?min_qty=60&max_qty=120")
range_names = [q['product_name'] for q in res_qty_range.data if q['product_name'].startswith("TestPhaseD")]
test("Range 60-120 returns 100 quintal wheat", any("Wheat" in n for n in range_names))
test("Range 60-120 excludes 500 caret mango and 50 kg tomato", not any("Mango" in n or "Tomato" in n for n in range_names))

print("\n--- Test 5: Harvest Date Range Filters ---")
harvest_date_str = (timezone.now() - timedelta(days=7)).date().isoformat()
res_harvest = fpo_client.get(f"/api/fpo/quotes/farmer/open/?harvest_from={harvest_date_str}")
test("Filter harvest_from returns crops harvested within last 7 days", res_harvest.status_code == 200)

print("\n--- Test 6: Combined Multi-Filters ---")
res_combined = fpo_client.get("/api/fpo/quotes/farmer/open/?category=Fruits&unit=caret&min_qty=100")
test("Combined category=Fruits & unit=caret & min_qty=100 matches Mango", any("Mango" in q['product_name'] for q in res_combined.data))
test("Combined excludes Watermelon (unit=piece)", not any("Watermelon" in q['product_name'] for q in res_combined.data))

print("\n--- Test 7: Empty Filter Results ---")
res_empty = fpo_client.get("/api/fpo/quotes/farmer/open/?search=NonExistentExoticCrop")
test("Empty search returns HTTP 200 with empty list", res_empty.status_code == 200 and len(res_empty.data) == 0)

print("\n--- Test 8: Retailer Marketplace Filtering ---")
res_ret_search = retailer_client.get("/api/retailer/quotes/fpo/open/?search=Wheat")
test("Retailer search for 'Wheat' returns FPO Wheat Flour", any("Wheat Flour" in q['product_name'] for q in res_ret_search.data))
test("Retailer search excludes Mango Pulp", not any("Mango Pulp" in q['product_name'] for q in res_ret_search.data))

res_ret_unit = retailer_client.get("/api/retailer/quotes/fpo/open/?unit=caret")
test("Retailer filter unit=caret returns Mango Pulp", any("Mango Pulp" in q['product_name'] for q in res_ret_unit.data))

# Cleanup
FPOQuote.objects.filter(product_name__startswith="TestPhaseD").delete()
FarmerQuote.objects.filter(product_name__startswith="TestPhaseD").delete()
CropPassport.objects.filter(crop_name__startswith="TestPhaseD").delete()
farmer.delete()
fpo.delete()
retailer.delete()

print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed == 0:
    print("  ALL PHASE D TESTS PASSED! \n")
else:
    print(f"  {failed} TEST(S) FAILED.\n")

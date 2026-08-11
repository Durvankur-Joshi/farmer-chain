"""
Phase C — Crop Passport Validation & Deletion Test Suite.
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
from farmer.serializers import FarmerQuoteSerializer
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
print("Phase C — Crop Passport Validation & Deletion Test Suite")
print("=" * 60)

# Clean up previous test artifacts
EscrowTransaction.objects.filter(quote__product_name__startswith="TestPhaseC").delete()
FarmerQuote.objects.filter(product_name__startswith="TestPhaseC").delete()
CropPassport.objects.filter(crop_name__startswith="TestPhaseC").delete()
Farmer.objects.filter(email__in=["phase_c_farmer1@test.com", "phase_c_farmer2@test.com"]).delete()
FPO.objects.filter(email="phase_c_fpo@test.com").delete()

def make_token(user, role):
    token = RefreshToken()
    token['user_id'] = user.id
    token['role'] = role
    token['name'] = user.name
    token['username'] = user.name
    return str(token.access_token)

# Create test farmers
farmer1 = Farmer.objects.create(
    name="Phase C Farmer 1",
    email="phase_c_farmer1@test.com",
    password="test",
    aadhaar_number="999911112222",
    wallet_address="0x1234567890123456789012345678901234567890",
    approval_status="approved",
    city="Satara",
    state="MH"
)

farmer2 = Farmer.objects.create(
    name="Phase C Farmer 2",
    email="phase_c_farmer2@test.com",
    password="test",
    aadhaar_number="999933334444",
    wallet_address="0x0987654321098765432109876543210987654321",
    approval_status="approved",
    city="Kolhapur",
    state="MH"
)

fpo = FPO.objects.create(
    name="Phase C FPO",
    email="phase_c_fpo@test.com",
    password="test",
    corporate_identification_number="U01111MH2023PTC999999",
    wallet_address="0x5555555555555555555555555555555555555555",
    approval_status="approved",
    city="Pune",
    state="MH"
)

client1 = APIClient()
token1 = make_token(farmer1, 'farmer')
client1.credentials(HTTP_AUTHORIZATION=f'Bearer {token1}')
client1.cookies['access_token'] = token1

client2 = APIClient()
token2 = make_token(farmer2, 'farmer')
client2.credentials(HTTP_AUTHORIZATION=f'Bearer {token2}')
client2.cookies['access_token'] = token2

print("\n--- Test 1: Complete Passport -> Generation Validation Passes ---")
# 1. Create valid passport
passport1 = CropPassport.objects.create(
    farmer=farmer1,
    crop_name="TestPhaseC Organic Strawberries",
    crop_category="Fruits",
    description="Fresh Mahabaleshwar strawberries.",
    quantity=Decimal('50.00'),
    unit='kg',
    cultivation_date=(timezone.now() - timedelta(days=60)).date(),
    harvest_date=(timezone.now() - timedelta(days=2)).date(),
    location="Mahabaleshwar, MH",
    status='registered'
)

# 2. Add IPFS document
doc1 = CropPassportDocument.objects.create(
    crop_passport=passport1,
    uploaded_by=farmer1,
    file_name="strawberry.jpg",
    file_type="image/jpeg",
    file_size=102400,
    document_type="crop_image",
    ipfs_cid="QmTestC11111111111111111111111111111111111111111",
    ipfs_uri="ipfs://QmTestC11111111111111111111111111111111111111111"
)

# 3. Add AI Quality Verification
ai1 = AIQualityVerification.objects.create(
    crop_passport=passport1,
    verified_by=farmer1,
    image_cid=doc1.ipfs_cid,
    image_uri=doc1.ipfs_uri,
    verification_status='verified',
    quality_grade='A',
    confidence_score=Decimal('0.95'),
    ai_summary="Excellent color and size uniformity."
)

response1 = client1.post(f"/api/farmer/crops/{passport1.pk}/mint/")
test("Complete passport with IPFS and AI verification allows prepare_mint", response1.status_code == 200, str(response1.data))

print("\n--- Test 2: Missing IPFS Document -> Mint Generation Blocked ---")
passport_no_ipfs = CropPassport.objects.create(
    farmer=farmer1,
    crop_name="TestPhaseC No IPFS Crop",
    crop_category="Grains",
    quantity=Decimal('100.00'),
    unit='kg',
    cultivation_date=(timezone.now() - timedelta(days=30)).date(),
    harvest_date=timezone.now().date(),
    status='registered'
)
# Add AI verification but NO documents
AIQualityVerification.objects.create(
    crop_passport=passport_no_ipfs,
    verified_by=farmer1,
    image_cid="QmTestNoDoc",
    image_uri="ipfs://QmTestNoDoc",
    verification_status='verified',
    quality_grade='A',
    confidence_score=Decimal('0.90')
)
resp_no_ipfs = client1.post(f"/api/farmer/crops/{passport_no_ipfs.pk}/mint/")
test("Missing IPFS document blocks mint generation (HTTP 400)", resp_no_ipfs.status_code == 400)
test("Clear error message for missing IPFS", "IPFS" in str(resp_no_ipfs.data.get('error', '')))

print("\n--- Test 3: Missing AI Verification -> Mint Generation Blocked ---")
passport_no_ai = CropPassport.objects.create(
    farmer=farmer1,
    crop_name="TestPhaseC No AI Crop",
    crop_category="Vegetables",
    quantity=Decimal('100.00'),
    unit='kg',
    cultivation_date=(timezone.now() - timedelta(days=30)).date(),
    harvest_date=timezone.now().date(),
    status='registered'
)
# Add IPFS document but NO AI verification
CropPassportDocument.objects.create(
    crop_passport=passport_no_ai,
    uploaded_by=farmer1,
    file_name="crop.jpg",
    file_type="image/jpeg",
    file_size=50000,
    document_type="crop_image",
    ipfs_cid="QmTestNoAI111111111111111111111111111111111111",
    ipfs_uri="ipfs://QmTestNoAI111111111111111111111111111111111111"
)
resp_no_ai = client1.post(f"/api/farmer/crops/{passport_no_ai.pk}/mint/")
test("Missing AI verification blocks mint generation (HTTP 400)", resp_no_ai.status_code == 400)
test("Clear error message for missing AI verification", "AI Quality Verification" in str(resp_no_ai.data.get('error', '')))

print("\n--- Test 4: Owner Can Delete Unused Passport ---")
passport_to_delete = CropPassport.objects.create(
    farmer=farmer1,
    crop_name="TestPhaseC Unused Passport",
    crop_category="Grains",
    quantity=Decimal('20.00'),
    unit='kg',
    cultivation_date=(timezone.now() - timedelta(days=20)).date(),
    harvest_date=timezone.now().date(),
    status='registered'
)
pk_to_delete = passport_to_delete.pk
del_resp = client1.delete(f"/api/farmer/crops/{pk_to_delete}/")
test("Owner deleting unused passport succeeds (HTTP 200)", del_resp.status_code == 200)
test("Passport removed from database", not CropPassport.objects.filter(pk=pk_to_delete).exists())

print("\n--- Test 5: Non-Owner Cannot Delete Passport ---")
passport_farmer2 = CropPassport.objects.create(
    farmer=farmer2,
    crop_name="TestPhaseC Farmer2 Passport",
    crop_category="Grains",
    quantity=Decimal('20.00'),
    unit='kg',
    cultivation_date=(timezone.now() - timedelta(days=20)).date(),
    harvest_date=timezone.now().date(),
    status='registered'
)
# Farmer 1 attempts to delete Farmer 2's passport
del_other_resp = client1.delete(f"/api/farmer/crops/{passport_farmer2.pk}/")
test("Non-owner cannot delete passport (HTTP 404 / Scoped to owner)", del_other_resp.status_code == 404)
test("Farmer 2 passport remains intact", CropPassport.objects.filter(pk=passport_farmer2.pk).exists())

print("\n--- Test 6: Deletion Blocked If Referenced by Active Quote ---")
active_quote = FarmerQuote.objects.create(
    farmer=farmer1,
    crop_passport=passport1,
    product_name=passport1.crop_name,
    category=passport1.crop_category,
    quantity=passport1.quantity,
    unit=passport1.unit,
    price_per_unit=Decimal('0.05'),
    deadline=(timezone.now() + timedelta(days=5)).date(),
    status='open'
)
del_quote_resp = client1.delete(f"/api/farmer/crops/{passport1.pk}/")
test("Deletion blocked when linked to active quote (HTTP 400)", del_quote_resp.status_code == 400)
test("Error mentions active quote reference", "active supply quote" in str(del_quote_resp.data.get('error', '')))

print("\n--- Test 7: Deletion Blocked If Referenced by Active Escrow ---")
active_quote.status = 'closed'
active_quote.save()

escrow = EscrowTransaction.objects.create(
    quote=active_quote,
    farmer=farmer1,
    fpo=fpo,
    amount_eth=Decimal('2.50'),
    status='funded'
)
del_escrow_resp = client1.delete(f"/api/farmer/crops/{passport1.pk}/")
test("Deletion blocked when linked to active escrow (HTTP 400)", del_escrow_resp.status_code == 400)
test("Error mentions active escrow agreement", "active escrow agreement" in str(del_escrow_resp.data.get('error', '')))

print("\n--- Test 8: Deleted Passport Cannot Be Used for New Quote ---")
data_use_deleted = {
    'crop_passport': pk_to_delete,  # from Test 4 (already deleted)
    'price_per_unit': '0.05',
    'deadline': (timezone.now() + timedelta(days=5)).date().isoformat()
}
post_quote_resp = client1.post("/api/farmer/quotes/", data_use_deleted)
test("Using deleted passport for new quote is rejected", post_quote_resp.status_code == 400)
test("Error rejects invalid passport PK", 'crop_passport' in str(post_quote_resp.data))

# Cleanup
EscrowTransaction.objects.filter(quote__product_name__startswith="TestPhaseC").delete()
FarmerQuote.objects.filter(product_name__startswith="TestPhaseC").delete()
CropPassport.objects.filter(crop_name__startswith="TestPhaseC").delete()
farmer1.delete()
farmer2.delete()
fpo.delete()

print("\n" + "=" * 60)
print(f"  PASSED: {passed}")
print(f"  FAILED: {failed}")
print("=" * 60)

if failed == 0:
    print("  ALL PHASE C TESTS PASSED! \n")
else:
    print(f"  {failed} TEST(S) FAILED.\n")

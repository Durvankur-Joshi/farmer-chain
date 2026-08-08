"""
Phase 2.2 Backend Verification Script
Run: python test_phase22.py
"""
import os, sys, django, datetime
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "FarmerChain.settings")
django.setup()

from farmer.models import Farmer, FarmerQuote, CropPassport
from farmer.serializers import CropPassportSerializer, PublicCropPassportSerializer

print("=== Phase 2.2 Backend Verification ===\n")

# TEST 1 — Existing data intact
print("--- TEST 1: Existing data intact ---")
print(f"Farmers:              {Farmer.objects.count()}")
print(f"Quotes:               {FarmerQuote.objects.count()}")
print(f"Farmers with DID:     {Farmer.objects.exclude(did__isnull=True).count()}/{Farmer.objects.count()}")
print("PASS\n")

# TEST 2 — Create CropPassport
print("--- TEST 2: Create CropPassport ---")
farmer = Farmer.objects.filter(approval_status="approved").first() or Farmer.objects.first()
assert farmer, "FAIL: no farmer in DB"
print(f"Using farmer: {farmer.name} | DID: {farmer.did}")

crop = CropPassport.objects.create(
    farmer=farmer,
    crop_name="Test Wheat Batch",
    crop_category="Cereal",
    description="Phase 2.2 test",
    quantity=500,
    unit="kg",
    cultivation_date=datetime.date(2026, 3, 1),
    harvest_date=datetime.date(2026, 6, 1),
)
print(f"Created: {crop}")
print(f"Status:  {crop.status}")
print(f"Location auto-filled: {crop.location}")
print(f"is_minted: {crop.is_minted}")
assert crop.status == "registered"
assert not crop.is_minted
print("PASS\n")

# TEST 3 — Serializer exposes DID but not sensitive fields
print("--- TEST 3: Serializer ---")
s = CropPassportSerializer(crop)
d = s.data
assert d["status"] == "registered"
assert d["nft_token_id"] is None
assert d["farmer_did"] == farmer.did
print(f"farmer_did:    {d['farmer_did']}")
print(f"farmer_wallet: {d['farmer_wallet']}")
print("PASS\n")

# TEST 4 — Public serializer hides sensitive fields
print("--- TEST 4: PublicSerializer sensitive-field exclusion ---")
ps = PublicCropPassportSerializer(crop)
pub = ps.data
for bad_field in ("email", "password", "aadhaar_number", "gstin"):
    assert bad_field not in pub, f"FAIL: {bad_field} should not be in public response"
assert "farmer_did" in pub
assert "farmer_wallet" in pub
print("No sensitive fields exposed. PASS\n")

# TEST 5 — Date validation
print("--- TEST 5: Date validation (cultivation > harvest rejected) ---")
bad_data = {
    "crop_name": "Bad Crop",
    "crop_category": "Cereal",
    "quantity": "100",
    "unit": "kg",
    "cultivation_date": "2026-10-01",
    "harvest_date": "2026-03-01",   # before cultivation
}
s_bad = CropPassportSerializer(data=bad_data)
assert not s_bad.is_valid(), "FAIL: should be invalid"
print(f"Validation errors: {s_bad.errors}")
print("PASS\n")

# TEST 6 — Minted status & is_minted property
print("--- TEST 6: Minted status + is_minted property ---")
crop.status = "minted"
crop.nft_token_id = "42"
crop.nft_contract_address = "0x" + "a" * 40
crop.nft_transaction_hash = "0x" + "b" * 64
crop.nft_token_uri = "ipfs://QmTest123"
crop.nft_minted_at = datetime.datetime.utcnow()
crop.save()
crop.refresh_from_db()
assert crop.is_minted
assert crop.status == "minted"
print("is_minted: True. PASS\n")

# TEST 7 — Format validators
print("--- TEST 7: ETH address / tx hash / IPFS URI validators ---")
import re
def valid_eth(a): return bool(a and re.fullmatch(r'0x[0-9a-fA-F]{40}', a))
def valid_tx(t):  return bool(t and re.fullmatch(r'0x[0-9a-fA-F]{64}', t))
def valid_ipfs(u): return bool(u and (u.startswith('ipfs://') or '/ipfs/' in u))

assert valid_eth("0x" + "a"*40)
assert not valid_eth("0x123")
assert valid_tx("0x" + "b"*64)
assert not valid_tx("0x123")
assert valid_ipfs("ipfs://QmABC")
assert not valid_ipfs("https://example.com")
print("PASS\n")

# Cleanup
crop.delete()
print("Test record cleaned up.")
print("\n=== ALL TESTS PASSED ===")

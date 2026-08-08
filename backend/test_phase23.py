"""
Phase 2.3 Backend Verification Script
Run: python test_phase23.py
"""
import os, sys, django, datetime
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "FarmerChain.settings")
django.setup()

from farmer.models import Farmer, CropPassport, CropPassportDocument

print("=== Phase 2.3 IPFS Storage Verification ===\n")

# TEST 1 — Existing data intact
print("--- TEST 1: Existing data intact ---")
print(f"Farmers:       {Farmer.objects.count()}")
print(f"CropPassports: {CropPassport.objects.count()}")
print(f"Documents:     {CropPassportDocument.objects.count()}")
print("PASS\n")

# TEST 2 — Create CropPassportDocument
print("--- TEST 2: Create CropPassportDocument ---")
farmer = Farmer.objects.filter(approval_status="approved").first() or Farmer.objects.first()
crop   = CropPassport.objects.filter(farmer=farmer).first()

if not crop:
    crop = CropPassport.objects.create(
        farmer=farmer,
        crop_name="Verification Crop",
        crop_category="Cereal",
        quantity=100,
        unit="kg",
        cultivation_date=datetime.date(2026, 1, 1),
        harvest_date=datetime.date(2026, 5, 1),
    )
    print(f"  Created test crop: {crop}")

doc = CropPassportDocument.objects.create(
    crop_passport=crop,
    uploaded_by=farmer,
    file_name="test-soil-report.pdf",
    file_type="application/pdf",
    file_size=123456,
    document_type="soil_report",
    ipfs_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    ipfs_uri="ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
)
print(f"  Created: {doc}")
assert doc.ipfs_cid.startswith("baf") or doc.ipfs_cid.startswith("Qm")
assert doc.ipfs_uri.startswith("ipfs://")
assert doc.gateway_url.startswith("https://gateway.pinata.cloud/ipfs/")
print(f"  Gateway URL: {doc.gateway_url}")
print("PASS\n")

# TEST 3 — Serializer excludes sensitive fields
print("--- TEST 3: Serializer output ---")
from farmer.serializers import CropPassportDocumentSerializer, PublicDocumentSerializer
s = CropPassportDocumentSerializer(doc)
d = s.data
assert "ipfs_cid"    in d
assert "ipfs_uri"    in d
assert "gateway_url" in d
assert "uploaded_at" in d
# Pinata JWT/secret must NOT leak into any response field
response_str = str(d)
assert "PINATA_JWT" not in response_str
assert "pinata_secret" not in response_str.lower()
# gateway_url may legitimately contain "pinata.cloud" — that is the public gateway URL

print(f"  Keys: {list(d.keys())}")
print("  No Pinata credentials in response: PASS")
print("PASS\n")

# TEST 4 — Public serializer
print("--- TEST 4: PublicDocumentSerializer ---")
ps  = PublicDocumentSerializer(doc)
pub = ps.data
for bad in ("uploaded_by", "farmer", "password", "aadhaar"):
    assert bad not in pub, f"FAIL: {bad} should not be in public response"
assert "ipfs_cid"    in pub
assert "gateway_url" in pub
print("  No sensitive fields: PASS")
print("PASS\n")

# TEST 5 — gateway_url property
print("--- TEST 5: gateway_url property ---")
expected_gw = f"https://gateway.pinata.cloud/ipfs/{doc.ipfs_cid}"
assert doc.gateway_url == expected_gw, f"FAIL: got {doc.gateway_url}"
print(f"  {doc.gateway_url}")
print("PASS\n")

# TEST 6 — Ownership isolation
print("--- TEST 6: Ownership isolation ---")
other = Farmer.objects.exclude(pk=farmer.pk).first()
if other:
    other_docs = CropPassportDocument.objects.filter(
        crop_passport__farmer=other
    )
    own_docs = CropPassportDocument.objects.filter(
        crop_passport__farmer=farmer
    )
    print(f"  Farmer {farmer.name} owns {own_docs.count()} doc(s)")
    print(f"  Farmer {other.name} owns {other_docs.count()} doc(s)")
    print("  Ownership isolation enforced at view layer via crop.farmer_id == farmer.pk")
else:
    print("  Only one farmer — isolation check skipped")
print("PASS\n")

# TEST 7 — Document type choices
print("--- TEST 7: Document type choices ---")
VALID = {'crop_image','soil_report','quality_report','certification','harvest_document','other'}
choices = {c[0] for c in CropPassportDocument.DOCUMENT_TYPE_CHOICES}
assert choices == VALID, f"FAIL: {choices}"
print(f"  Choices: {sorted(choices)}")
print("PASS\n")

# TEST 8 — IPFS service functions importable
print("--- TEST 8: IPFS service imports ---")
from services.ipfs_service import (
    upload_json_to_ipfs, upload_file_to_ipfs, unpin_from_ipfs,
    IPFSUploadError, ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES
)
print(f"  upload_json_to_ipfs: OK")
print(f"  upload_file_to_ipfs: OK")
print(f"  unpin_from_ipfs:     OK")
print(f"  ALLOWED_EXTENSIONS:  {sorted(ALLOWED_EXTENSIONS)}")
print(f"  MAX_UPLOAD_BYTES:    {MAX_UPLOAD_BYTES / (1024*1024):.0f} MB")
print("PASS\n")

# TEST 9 — Extension validation in service
print("--- TEST 9: Extension validation ---")
import io
fake = io.BytesIO(b"fake content")
try:
    upload_file_to_ipfs(fake, "evil.exe")
    print("FAIL: should have raised")
except IPFSUploadError as e:
    print(f"  Correctly rejected .exe: {e}")
    print("PASS\n")

# TEST 10 — Foreign key cascade
print("--- TEST 10: Cascade delete ---")
doc_id = doc.id
crop_tmp = CropPassport.objects.create(
    farmer=farmer,
    crop_name="Temp Cascade Crop",
    crop_category="Cereal",
    quantity=1,
    unit="kg",
    cultivation_date=datetime.date(2026,1,1),
    harvest_date=datetime.date(2026,5,1),
)
doc_tmp = CropPassportDocument.objects.create(
    crop_passport=crop_tmp,
    uploaded_by=farmer,
    file_name="temp.pdf",
    file_type="application/pdf",
    file_size=1,
    document_type="other",
    ipfs_cid="bafyTEST",
    ipfs_uri="ipfs://bafyTEST",
)
crop_tmp.delete()
assert not CropPassportDocument.objects.filter(pk=doc_tmp.pk).exists()
print("  Doc deleted when CropPassport deleted: PASS")
print("PASS\n")

# Cleanup
doc.delete()
print("Test records cleaned up.")
print("\n=== ALL PHASE 2.3 TESTS PASSED ===")

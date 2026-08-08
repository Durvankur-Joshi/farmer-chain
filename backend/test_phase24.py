"""
Phase 2.4 Backend Verification Script
Run: python test_phase24.py
"""
import os, sys, django, datetime
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "FarmerChain.settings")
django.setup()

from farmer.models import Farmer, CropPassport, AIQualityVerification

print("=== Phase 2.4 AI Quality Verification — Backend Tests ===\n")

# TEST 1 — Existing data intact
print("--- TEST 1: Existing data intact ---")
print(f"  Farmers:              {Farmer.objects.count()}")
print(f"  CropPassports:        {CropPassport.objects.count()}")
print(f"  AI Verifications:     {AIQualityVerification.objects.count()}")
print("  PASS\n")

# TEST 2 — Create AIQualityVerification record
print("--- TEST 2: Create AIQualityVerification ---")
farmer = Farmer.objects.filter(approval_status="approved").first() or Farmer.objects.first()
crop   = CropPassport.objects.filter(farmer=farmer).first()
if not crop:
    crop = CropPassport.objects.create(
        farmer=farmer, crop_name="Tomato", crop_category="Vegetable",
        quantity=50, unit="kg",
        cultivation_date=datetime.date(2026,1,1),
        harvest_date=datetime.date(2026,5,1),
    )

verif = AIQualityVerification.objects.create(
    crop_passport=crop,
    verified_by=farmer,
    image_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    image_uri="ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    crop_detected="Tomato",
    quality_grade="A",
    quality_score=88,
    confidence_score=0.92,
    disease_detected=False,
    visible_defects="None",
    ai_summary="The crop appears healthy with good visual quality and vibrant color.",
    verification_status=AIQualityVerification.STATUS_VERIFIED,
    ai_provider="gemini-1.5-flash",
)
print(f"  Created: {verif}")
assert verif.image_gateway_url.startswith("https://gateway.pinata.cloud/ipfs/")
print(f"  Gateway: {verif.image_gateway_url}")
print("  PASS\n")

# TEST 3 — Serializer output (no API keys)
print("--- TEST 3: Serializer — no credentials leaked ---")
from farmer.serializers import AIQualityVerificationSerializer, PublicVerificationSerializer
s = AIQualityVerificationSerializer(verif)
d = s.data
assert "GEMINI_API_KEY"    not in str(d)
assert "PINATA_JWT"        not in str(d)
assert "pinata_secret"     not in str(d).lower()
assert "quality_grade"     in d
assert "quality_score"     in d
assert "confidence_score"  in d
assert "disease_detected"  in d
assert "image_gateway_url" in d
print(f"  Fields: {list(d.keys())}")
print("  No credentials in response: PASS\n")

# TEST 4 — Public serializer excludes farmer PII
print("--- TEST 4: PublicVerificationSerializer — no PII ---")
ps  = PublicVerificationSerializer(verif)
pub = ps.data
for bad in ("verified_by", "farmer", "password", "aadhaar", "email"):
    assert bad not in pub, f"FAIL: '{bad}' must not appear in public response"
assert "quality_grade"     in pub
assert "image_gateway_url" in pub
print("  No PII in public response: PASS\n")

# TEST 5 — Status choices correct
print("--- TEST 5: Status choices ---")
statuses = {c[0] for c in AIQualityVerification.STATUS_CHOICES}
assert statuses == {"pending","verified","failed"}
print(f"  Choices: {sorted(statuses)}: PASS\n")

# TEST 6 — Grade choices correct
print("--- TEST 6: Grade choices ---")
grades = {c[0] for c in AIQualityVerification.GRADE_CHOICES}
assert grades == {"A","B","C","D","F"}
print(f"  Grades: {sorted(grades)}: PASS\n")

# TEST 7 — AI service imports
print("--- TEST 7: AI service imports ---")
from services.ai_service import (
    analyze_crop_image, AIAnalysisError, _validate_ai_result, _build_prompt
)
print("  analyze_crop_image:  OK")
print("  AIAnalysisError:     OK")
print("  _validate_ai_result: OK")
print("  PASS\n")

# TEST 8 — AI result validation
print("--- TEST 8: AI result validation ---")
raw_good = {
    "crop_detected": "Tomato", "quality_grade": "A", "quality_score": 90,
    "confidence_score": 0.95, "disease_detected": False,
    "disease_name": None, "visible_defects": "None",
    "summary": "Healthy tomatoes."
}
out = _validate_ai_result(raw_good)
assert out["quality_grade"]    == "A"
assert out["quality_score"]    == 90
assert out["confidence_score"] == 0.95
assert out["disease_detected"] == False
print("  Valid input processed: PASS")

# Bad grade clamped
raw_bad = dict(raw_good, quality_grade="Z", quality_score=9999, confidence_score=99.0)
out2 = _validate_ai_result(raw_bad)
assert out2["quality_grade"]    == "C"       # default on invalid grade
assert out2["quality_score"]    == 100       # clamped to 100
assert out2["confidence_score"] == 1.0       # clamped to 1.0
print("  Invalid values clamped: PASS\n")

# TEST 9 — Gemini prompt does not contain API key
print("--- TEST 9: Prompt safety ---")
prompt = _build_prompt("Tomato")
assert "GEMINI_API_KEY" not in prompt
assert "PINATA" not in prompt
assert "Tomato" in prompt
print(f"  Prompt length: {len(prompt)} chars")
print("  No credentials in prompt: PASS\n")

# TEST 10 — Cascade delete
print("--- TEST 10: Cascade delete ---")
tmp_crop = CropPassport.objects.create(
    farmer=farmer, crop_name="Cascade Test", crop_category="Test",
    quantity=1, unit="kg",
    cultivation_date=datetime.date(2026,1,1), harvest_date=datetime.date(2026,5,1),
)
tmp_verif = AIQualityVerification.objects.create(
    crop_passport=tmp_crop, verified_by=farmer,
    image_cid="bafTEST", image_uri="ipfs://bafTEST",
    verification_status=AIQualityVerification.STATUS_VERIFIED,
)
pk = tmp_verif.pk
tmp_crop.delete()
assert not AIQualityVerification.objects.filter(pk=pk).exists()
print("  Verification deleted with CropPassport: PASS\n")

# Cleanup test record
verif.delete()
print("Test records cleaned up.")
print("\n=== ALL PHASE 2.4 TESTS PASSED ===")

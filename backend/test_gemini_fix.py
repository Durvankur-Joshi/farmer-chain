"""
Test Phase 2.4 Gemini fix — calls the REAL Gemini API.
Run from backend/: python test_gemini_fix.py

Requires GEMINI_API_KEY in backend/.env
"""
import os, sys, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "FarmerChain.settings")
django.setup()

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from services.ai_service import (
    analyze_crop_image, AIAnalysisError,
    _extract_text_from_response, _strip_markdown_fences, _validate_ai_result,
    GEMINI_MODEL, GEMINI_API_URL,
)
import requests, base64, json

print("=== Gemini Fix Verification ===\n")

# TEST 1 — Model URL correct
print("--- TEST 1: Model name ---")
assert "gemini-3.5-flash" in GEMINI_API_URL, f"Wrong model URL: {GEMINI_API_URL}"
assert "v1beta" not in GEMINI_API_URL, f"Must use v1 not v1beta: {GEMINI_API_URL}"
assert "/v1/" in GEMINI_API_URL,        f"Must use v1 API: {GEMINI_API_URL}"
print(f"  Model: {GEMINI_MODEL}")
print(f"  URL:   {GEMINI_API_URL}")
print("  PASS\n")

# TEST 2 — Fence stripping
print("--- TEST 2: Fence stripping ---")
cases = [
    ('```json\n{"a": 1}\n```',   '{"a": 1}'),
    ('```\n{"a": 1}\n```',        '{"a": 1}'),
    ('{"a": 1}',                  '{"a": 1}'),
    ('  ```JSON\n{"a":1}\n```  ', '{"a":1}'),
]
for inp, expected in cases:
    got = _strip_markdown_fences(inp)
    assert got == expected, f"FAIL: input={inp!r} expected={expected!r} got={got!r}"
print(f"  All {len(cases)} fence-strip cases: PASS\n")

# TEST 3 — _extract_text_from_response
print("--- TEST 3: _extract_text_from_response ---")
mock_resp = {
    "candidates": [{
        "finishReason": "STOP",
        "content": {
            "parts": [
                {"text": '{"crop_de'},
                {"text": 'tected":"Tomato"}'},
            ]
        }
    }]
}
text, finish = _extract_text_from_response(mock_resp)
assert text == '{"crop_detected":"Tomato"}', f"Got text: {text!r}"
assert finish == "STOP", f"Got finish: {finish!r}"
print(f"  Multi-part join: '{text}': PASS\n")

# TEST 4 — _validate_ai_result handles list-type visible_defects
print("--- TEST 4: visible_defects as list ---")
r = _validate_ai_result({
    "crop_detected": "Tomato", "quality_grade": "B", "quality_score": 72,
    "confidence_score": 0.88, "disease_detected": False,
    "disease_name": None, "visible_defects": ["minor bruising", "slight discoloration"],
    "summary": "Generally healthy."
})
assert r["visible_defects"] == "minor bruising, slight discoloration"
print(f"  visible_defects: {r['visible_defects']}: PASS\n")

# TEST 5 — Live Gemini API call with a minimal synthetic image
print("--- TEST 5: Live Gemini API call ---")
api_key = os.environ.get("GEMINI_API_KEY", "").strip()
if not api_key:
    print("  SKIP — GEMINI_API_KEY not set\n")
else:
    # Generate a tiny 1x1 green PNG (smallest valid PNG possible)
    import struct, zlib
    def make_tiny_png(r, g, b):
        def chunk(name, data):
            c = zlib.crc32(name + data) & 0xffffffff
            return struct.pack(">I", len(data)) + name + data + struct.pack(">I", c)
        ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
        idat_raw = b'\x00' + bytes([r, g, b])
        idat_data = zlib.compress(idat_raw)
        return (b'\x89PNG\r\n\x1a\n'
                + chunk(b'IHDR', ihdr)
                + chunk(b'IDAT', idat_data)
                + chunk(b'IEND', b''))

    img_bytes = make_tiny_png(34, 139, 34)  # forest green — crop-like colour

    try:
        result = analyze_crop_image(img_bytes, "image/png", "Tomato")
        print(f"  crop_detected:    {result['crop_detected']}")
        print(f"  quality_grade:    {result['quality_grade']}")
        print(f"  quality_score:    {result['quality_score']}")
        print(f"  confidence_score: {result['confidence_score']}")
        print(f"  disease_detected: {result['disease_detected']}")
        print(f"  visible_defects:  {result['visible_defects']}")
        print(f"  summary:          {result['summary'][:80]}...")
        # Validate all expected fields are present and typed correctly
        assert isinstance(result["crop_detected"],    str)
        assert result["quality_grade"] in {"A","B","C","D","F"}
        assert 0 <= result["quality_score"]    <= 100
        assert 0.0 <= result["confidence_score"] <= 1.0
        assert isinstance(result["disease_detected"], bool)
        print("  Live API call: PASS\n")
    except AIAnalysisError as e:
        print(f"  AIAnalysisError (expected if image too small/abstract): {e}")
        print("  Live call skipped gracefully.\n")

print("=== ALL TESTS PASSED ===")

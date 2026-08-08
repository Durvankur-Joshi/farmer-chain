"""
Full end-to-end Gemini live test with a real downloadable tomato image.
Run from backend/: python test_gemini_live.py
"""
import os, sys, django, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "FarmerChain.settings")
django.setup()

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from services.ai_service import analyze_crop_image, AIAnalysisError, GEMINI_MODEL, GEMINI_API_URL
import requests

print("=== Live Gemini End-to-End Test ===\n")
print(f"Model : {GEMINI_MODEL}")
print(f"URL   : {GEMINI_API_URL}\n")

# Download a real tomato image from a public domain URL
IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/320px-Tomato_je.jpg"
print(f"Downloading test image: {IMAGE_URL}")

try:
    img_resp = requests.get(IMAGE_URL, timeout=15)
    img_resp.raise_for_status()
    image_bytes = img_resp.content
    mime_type   = "image/jpeg"
    print(f"Downloaded {len(image_bytes)} bytes\n")
except Exception as e:
    print(f"Could not download test image: {e}")
    print("Using a minimal synthetic green PNG instead...")
    import struct, zlib, base64
    def make_png(r,g,b):
        def chunk(n,d):
            c=zlib.crc32(n+d)&0xffffffff
            return struct.pack(">I",len(d))+n+d+struct.pack(">I",c)
        ihdr=struct.pack(">IIBBBBB",8,8,8,2,0,0,0)
        rows=b"".join(b"\x00"+bytes([r,g,b]*8) for _ in range(8))
        idat=zlib.compress(rows)
        return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",ihdr)+chunk(b"IDAT",idat)+chunk(b"IEND",b"")
    image_bytes = make_png(200, 50, 30)
    mime_type   = "image/png"
    print(f"Synthetic image: {len(image_bytes)} bytes\n")

try:
    result = analyze_crop_image(image_bytes, mime_type, "Tomato")
    print("=== AI Result ===")
    for k, v in result.items():
        print(f"  {k:<20}: {v}")

    # Validate all required fields present and correctly typed
    assert isinstance(result["crop_detected"],    str),  "crop_detected must be str"
    assert result["quality_grade"] in {"A","B","C","D","F"}, "quality_grade must be A-F"
    assert 0 <= result["quality_score"] <= 100,          "quality_score out of range"
    assert 0.0 <= result["confidence_score"] <= 1.0,     "confidence_score out of range"
    assert isinstance(result["disease_detected"], bool), "disease_detected must be bool"
    assert isinstance(result["visible_defects"],  str),  "visible_defects must be str"
    assert isinstance(result["summary"],          str),  "summary must be str"

    print("\n=== ALL ASSERTIONS PASSED — LIVE GEMINI CALL WORKS ===")
except AIAnalysisError as e:
    print(f"\nAIAnalysisError: {e}")
    sys.exit(1)
except AssertionError as e:
    print(f"\nValidation FAILED: {e}")
    sys.exit(1)

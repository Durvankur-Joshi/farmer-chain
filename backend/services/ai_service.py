"""
backend/services/ai_service.py
================================
Server-side Gemini Vision AI service for crop quality verification.

Uses the Gemini REST API directly via `requests` (no extra SDK required).
Credentials are read from GEMINI_API_KEY environment variable at call time.

The API key is NEVER returned to the frontend.

Required env var (in backend/.env):
    GEMINI_API_KEY=...

Configuration (confirmed 2026-08-08):
    API version : v1
    Model       : gemini-3.5-flash  (vision-capable, generateContent)
    JSON mode   : OFF (responseMimeType unsupported on v1 for multimodal)

IMPORTANT — gemini-3.5-flash is a "thinking" model:
    Its internal reasoning tokens (thoughtsTokenCount) count against
    maxOutputTokens.  A real crop image can consume 500-900 thinking
    tokens, leaving too few for the JSON output if the budget is small.
    maxOutputTokens is set to 2048 to give ample headroom.

Usage:
    from services.ai_service import analyze_crop_image, AIAnalysisError
    try:
        result = analyze_crop_image(image_bytes, "image/jpeg", "Tomato")
    except AIAnalysisError as e:
        return Response({"error": str(e)}, status=502)
"""

import os
import json
import base64
import logging
import re
import requests

logger = logging.getLogger(__name__)

# ── Gemini REST endpoint ─────────────────────────────────────────────────────
#
# gemini-3.5-flash on v1 — confirmed working via live probe.
#
GEMINI_MODEL   = "gemini-3.5-flash"
GEMINI_API_URL = (
    f"https://generativelanguage.googleapis.com/v1/models/"
    f"{GEMINI_MODEL}:generateContent"
)

REQUEST_TIMEOUT = 60   # seconds — vision + thinking model is slower

VALID_GRADES   = {"A", "B", "C", "D", "F"}
VALID_STATUSES = {"verified", "failed"}


class AIAnalysisError(Exception):
    """Raised when the Gemini AI call fails or returns invalid data."""
    pass


def _get_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise AIAnalysisError(
            "GEMINI_API_KEY is not configured. "
            "Add it to backend/.env and restart the server."
        )
    return key


def _build_prompt(crop_name: str) -> str:
    """
    Compact prompt that forces short JSON-only output.
    Explicitly tells the model to keep all string values concise —
    critical because thinking tokens eat into the output budget.
    """
    return (
        f'You are a crop quality assessment assistant.\n'
        f'Analyze the supplied crop image. The registered crop is: "{crop_name}".\n\n'
        f'Return ONLY one valid JSON object. '
        f'Do not return markdown. Do not return ```json fences. '
        f'Do not provide explanations. '
        f'Keep all string values concise (under 20 words each).\n\n'
        f'{{\n'
        f'  "crop_detected": "crop name or unknown",\n'
        f'  "quality_grade": "A or B or C or D or F",\n'
        f'  "quality_score": 0,\n'
        f'  "confidence_score": 0.0,\n'
        f'  "disease_detected": false,\n'
        f'  "disease_name": null,\n'
        f'  "visible_defects": "short description or None",\n'
        f'  "summary": "one concise sentence"\n'
        f'}}\n\n'
        f'Grading: A=Excellent B=Good C=Acceptable D=Poor F=Unacceptable.\n'
        f'quality_score: 0-100. confidence_score: 0.0-1.0.\n'
        f'If the image does not show "{crop_name}", set crop_detected to what you see.\n'
        f'Output ONLY the JSON. Nothing else.'
    )


def _extract_text_from_response(gemini_data: dict) -> tuple:
    """
    Walk the full Gemini response and concatenate ALL text parts from the
    first candidate.  Returns (full_text, finish_reason).

    Raises AIAnalysisError if no usable text can be found.
    """
    candidates = gemini_data.get("candidates", [])
    if not candidates:
        finish = gemini_data.get("promptFeedback", {}).get("blockReason", "unknown")
        raise AIAnalysisError(
            f"Gemini returned no candidates. "
            f"The request may have been blocked (reason: {finish})."
        )

    candidate = candidates[0]
    finish_reason = candidate.get("finishReason", "STOP")

    content = candidate.get("content", {})
    parts   = content.get("parts", [])

    if not parts:
        raise AIAnalysisError("Gemini response contained no content parts.")

    # Join ALL text parts — handles multi-part completions
    texts = [part["text"] for part in parts if "text" in part]

    if not texts:
        raise AIAnalysisError(
            "Gemini response parts contained no text fields. "
            f"Parts received: {parts}"
        )

    full_text = "".join(texts)

    # Log token usage for diagnosis
    usage = gemini_data.get("usageMetadata", {})
    if usage:
        logger.info(
            "Gemini token usage — prompt: %s, candidates: %s, thoughts: %s, total: %s",
            usage.get("promptTokenCount"),
            usage.get("candidatesTokenCount"),
            usage.get("thoughtsTokenCount"),
            usage.get("totalTokenCount"),
        )

    return full_text, finish_reason


def _strip_markdown_fences(text: str) -> str:
    """Remove markdown code fences that Gemini sometimes adds."""
    text = text.strip()
    text = re.sub(r"^```(?:json|JSON)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def analyze_crop_image(image_bytes: bytes, mime_type: str, crop_name: str) -> dict:
    """
    Send a crop image to Gemini Vision and return a structured quality assessment.

    Args:
        image_bytes: Raw image bytes (JPEG / PNG / WEBP).
        mime_type:   MIME type string, e.g. "image/jpeg".
        crop_name:   The crop registered in the CropPassport (used in the prompt).

    Returns:
        dict with keys: crop_detected, quality_grade, quality_score,
            confidence_score, disease_detected, disease_name,
            visible_defects, summary

    Raises:
        AIAnalysisError: on API failure, MAX_TOKENS truncation, invalid response.
    """
    api_key = _get_api_key()
    prompt  = _build_prompt(crop_name)
    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_image,
                        }
                    },
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            # gemini-3.5-flash is a THINKING model.
            # Internal reasoning tokens (thoughtsTokenCount) count against
            # maxOutputTokens.  A real crop image typically uses 300-900
            # thinking tokens.  2048 gives ample room for thinking + JSON.
            "maxOutputTokens": 2048,
        },
    }

    url = f"{GEMINI_API_URL}?key={api_key}"
    logger.info(
        "Sending crop image to Gemini Vision (%s). Crop: %s, MIME: %s, Size: %d bytes",
        GEMINI_MODEL, crop_name, mime_type, len(image_bytes),
    )

    try:
        response = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
    except requests.exceptions.Timeout:
        raise AIAnalysisError(
            f"Gemini API request timed out after {REQUEST_TIMEOUT}s. Please try again."
        )
    except requests.exceptions.ConnectionError as exc:
        raise AIAnalysisError(f"Network error connecting to Gemini API: {exc}")

    # ── HTTP error handling ────────────────────────────────────────────────
    if not response.ok:
        body_snippet = response.text[:500]
        logger.error("Gemini API error: HTTP %s — %s", response.status_code, body_snippet)
        if response.status_code == 404:
            raise AIAnalysisError(
                f"Gemini model '{GEMINI_MODEL}' not found. "
                "Check model name and API key access."
            )
        if response.status_code == 400:
            raise AIAnalysisError(
                "Gemini rejected the request (HTTP 400). "
                "The image may be corrupt, too large, or unsupported."
            )
        if response.status_code in (401, 403):
            raise AIAnalysisError(
                "Gemini API authentication failed. Check GEMINI_API_KEY in backend/.env."
            )
        if response.status_code == 429:
            raise AIAnalysisError(
                "Gemini API rate limit exceeded. Please wait a moment and try again."
            )
        raise AIAnalysisError(
            f"Gemini API returned HTTP {response.status_code}. "
            f"Detail: {body_snippet[:200]}"
        )

    # ── Parse the Gemini envelope ─────────────────────────────────────────
    try:
        gemini_data = response.json()
    except ValueError as exc:
        logger.error(
            "Gemini response is not JSON. Status: %s, Body: %s",
            response.status_code, response.text[:400],
        )
        raise AIAnalysisError(f"Gemini returned a non-JSON HTTP response: {exc}")

    # ── Extract text and finish reason ────────────────────────────────────
    raw_text, finish_reason = _extract_text_from_response(gemini_data)

    # ── MAX_TOKENS: hard failure — do NOT parse truncated JSON ────────────
    if finish_reason == "MAX_TOKENS":
        logger.error(
            "Gemini hit MAX_TOKENS — output truncated. "
            "finishReason=%s, text length=%d chars, text=%s",
            finish_reason, len(raw_text), raw_text[:300],
        )
        raise AIAnalysisError(
            "AI analysis was incomplete (output truncated). "
            "Please try again with a simpler image, or retry in a moment."
        )

    # Warn on unexpected finish reasons (SAFETY, RECITATION, etc.)
    if finish_reason != "STOP":
        logger.warning(
            "Gemini finishReason=%s (expected STOP). Text: %s",
            finish_reason, raw_text[:200],
        )

    logger.debug("Gemini raw text (%d chars): %s", len(raw_text), raw_text[:400])

    # ── Strip markdown fences ─────────────────────────────────────────────
    cleaned_text = _strip_markdown_fences(raw_text)

    # ── Parse JSON ────────────────────────────────────────────────────────
    try:
        ai_result = json.loads(cleaned_text)
    except json.JSONDecodeError as exc:
        logger.error(
            "Gemini returned non-JSON after fence stripping.\n"
            "Raw text (%d chars): %s\n"
            "Cleaned (%d chars): %s",
            len(raw_text), raw_text,
            len(cleaned_text), cleaned_text,
        )
        raise AIAnalysisError(
            f"AI returned a malformed response. "
            f"Try uploading the image again. "
            f"(Detail: {exc})"
        )

    if not isinstance(ai_result, dict):
        raise AIAnalysisError(
            f"AI response was valid JSON but not an object "
            f"(got {type(ai_result).__name__}). Please try again."
        )

    # ── Validate and sanitise ─────────────────────────────────────────────
    validated = _validate_ai_result(ai_result)
    logger.info(
        "Gemini assessment complete. Crop: %s, detected: %s, Grade: %s, "
        "Score: %s, Confidence: %s, Disease: %s",
        crop_name,
        validated["crop_detected"],
        validated["quality_grade"],
        validated["quality_score"],
        validated["confidence_score"],
        validated["disease_detected"],
    )
    return validated


def _validate_ai_result(raw: dict) -> dict:
    """
    Validate and coerce the AI JSON result into a safe, typed structure.
    All fields are sanitised — never blindly trust AI output.
    """
    # crop_detected
    crop_detected = str(raw.get("crop_detected", "unknown")).strip()[:200]

    # quality_grade — must be A/B/C/D/F
    quality_grade = str(raw.get("quality_grade", "")).strip().upper()
    if quality_grade not in VALID_GRADES:
        logger.warning("AI returned invalid quality_grade '%s', defaulting to C", raw.get("quality_grade"))
        quality_grade = "C"

    # quality_score — integer 0–100
    try:
        quality_score = int(float(raw.get("quality_score", 50)))
        quality_score = max(0, min(100, quality_score))
    except (TypeError, ValueError):
        logger.warning("AI returned invalid quality_score: %s", raw.get("quality_score"))
        quality_score = 50

    # confidence_score — float 0.00–1.00
    try:
        confidence_score = float(raw.get("confidence_score", 0.5))
        confidence_score = round(max(0.0, min(1.0, confidence_score)), 2)
    except (TypeError, ValueError):
        logger.warning("AI returned invalid confidence_score: %s", raw.get("confidence_score"))
        confidence_score = 0.5

    # disease_detected — bool
    raw_disease = raw.get("disease_detected", False)
    disease_detected = bool(raw_disease) if not isinstance(raw_disease, bool) else raw_disease

    # disease_name — nullable string
    disease_name = raw.get("disease_name") or None
    if disease_name:
        disease_name = str(disease_name).strip()[:200]

    # visible_defects — string (may be a list from AI — convert gracefully)
    raw_defects = raw.get("visible_defects", "None")
    if isinstance(raw_defects, list):
        visible_defects = ", ".join(str(x) for x in raw_defects) or "None"
    else:
        visible_defects = str(raw_defects).strip()[:500]

    # summary — plain-English string
    summary = str(raw.get("summary", "")).strip()[:1000]
    if not summary:
        summary = "No summary provided by AI."

    return {
        "crop_detected":    crop_detected,
        "quality_grade":    quality_grade,
        "quality_score":    quality_score,
        "confidence_score": confidence_score,
        "disease_detected": disease_detected,
        "disease_name":     disease_name,
        "visible_defects":  visible_defects,
        "summary":          summary,
    }

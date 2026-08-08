"""
backend/services/ipfs_service.py
=================================
Server-side Pinata IPFS upload service.

Pinata credentials are read from environment variables and NEVER
exposed to the React frontend. The Django view calls upload_json_to_ipfs()
and returns only the resulting ipfs:// URI to the client.

Required env vars (in backend/.env):
    PINATA_JWT          — Preferred: Pinata V2 JWT token
    OR
    PINATA_API_KEY      — Legacy key
    PINATA_SECRET_API_KEY — Legacy secret

Usage:
    from services.ipfs_service import upload_json_to_ipfs, IPFSUploadError

    try:
        token_uri = upload_json_to_ipfs(metadata_dict, name="crop-passport.json")
    except IPFSUploadError as e:
        return Response({"error": str(e)}, status=502)
"""

import os
import json
import logging
import requests

logger = logging.getLogger(__name__)

PINATA_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
REQUEST_TIMEOUT_SECONDS = 30


class IPFSUploadError(Exception):
    """Raised when the IPFS / Pinata upload fails."""
    pass


def _build_headers() -> dict:
    """
    Return appropriate auth headers for Pinata.
    Reads credentials at call time (not module-import time) so that
    load_dotenv() in settings.py has already populated os.environ.
    Prefers the newer JWT auth; falls back to API key + secret.
    Raises IPFSUploadError if no credentials are configured.
    """
    pinata_jwt    = os.environ.get("PINATA_JWT", "").strip()
    pinata_key    = os.environ.get("PINATA_API_KEY", "").strip()
    pinata_secret = os.environ.get("PINATA_SECRET_API_KEY", "").strip()

    if pinata_jwt:
        return {
            "Authorization": f"Bearer {pinata_jwt}",
            "Content-Type": "application/json",
        }
    if pinata_key and pinata_secret:
        return {
            "pinata_api_key": pinata_key,
            "pinata_secret_api_key": pinata_secret,
            "Content-Type": "application/json",
        }
    raise IPFSUploadError(
        "Pinata credentials are not configured. "
        "Set PINATA_JWT (or PINATA_API_KEY + PINATA_SECRET_API_KEY) "
        "in the backend .env file."
    )



def upload_json_to_ipfs(metadata: dict, name: str = "crop-passport.json") -> str:
    """
    Upload a JSON metadata dict to IPFS via Pinata.

    Args:
        metadata: Python dict that will be serialised as JSON.
        name:     Pinata file name for the pin (shown in Pinata dashboard).

    Returns:
        A fully-formed ipfs:// URI, e.g. "ipfs://Qm.../crop-passport.json"

    Raises:
        IPFSUploadError: on credential, network, or API errors.
    """
    headers = _build_headers()

    payload = {
        "pinataContent": metadata,
        "pinataMetadata": {"name": name},
        "pinataOptions": {"cidVersion": 1},
    }

    logger.info("Uploading NFT metadata to Pinata IPFS: %s", name)

    try:
        response = requests.post(
            PINATA_PIN_JSON_URL,
            headers=headers,
            data=json.dumps(payload),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.exceptions.Timeout:
        raise IPFSUploadError("Pinata request timed out. Please try again.")
    except requests.exceptions.ConnectionError as exc:
        raise IPFSUploadError(f"Network error connecting to Pinata: {exc}")

    if not response.ok:
        logger.error(
            "Pinata upload failed: HTTP %s — %s",
            response.status_code,
            response.text[:300],
        )
        raise IPFSUploadError(
            f"Pinata returned HTTP {response.status_code}. "
            "Check your API credentials and Pinata account."
        )

    try:
        data = response.json()
        cid = data["IpfsHash"]
    except (ValueError, KeyError) as exc:
        raise IPFSUploadError(f"Unexpected Pinata response format: {exc}")

    token_uri = f"ipfs://{cid}"
    logger.info("IPFS upload successful. CID=%s  URI=%s", cid, token_uri)
    return token_uri


# ── File upload (Phase 2.3) ───────────────────────────────────────────────────

PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"
PINATA_UNPIN_URL    = "https://api.pinata.cloud/pinning/unpin/{cid}"

# 10 MB
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}


def _build_file_headers() -> dict:
    """
    Auth headers for multipart file upload.
    Content-Type is intentionally omitted so requests sets the correct
    multipart boundary automatically.
    """
    pinata_jwt    = os.environ.get("PINATA_JWT", "").strip()
    pinata_key    = os.environ.get("PINATA_API_KEY", "").strip()
    pinata_secret = os.environ.get("PINATA_SECRET_API_KEY", "").strip()

    if pinata_jwt:
        return {"Authorization": f"Bearer {pinata_jwt}"}
    if pinata_key and pinata_secret:
        return {
            "pinata_api_key": pinata_key,
            "pinata_secret_api_key": pinata_secret,
        }
    raise IPFSUploadError(
        "Pinata credentials are not configured. "
        "Set PINATA_JWT in the backend .env file."
    )


def upload_file_to_ipfs(file_obj, file_name: str, pin_name: str = "") -> tuple:
    """
    Upload a binary file to IPFS via Pinata pinFileToIPFS.

    Args:
        file_obj:  A Django InMemoryUploadedFile / TemporaryUploadedFile
                   (anything with .read() and a name).
        file_name: Original file name (used for the Pinata pin label).
        pin_name:  Optional friendly name shown in the Pinata dashboard.

    Returns:
        (cid: str, ipfs_uri: str)
        e.g. ("bafybeig...", "ipfs://bafybeig...")

    Raises:
        IPFSUploadError: on validation, credential, network, or API errors.
    """
    import os as _os

    # ── Validate extension ──────────────────────────────────────────
    _, ext = _os.path.splitext(file_name.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise IPFSUploadError(
            f"File type '{ext}' is not allowed. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # ── Validate size (already checked in view, but defence-in-depth) ──
    file_obj.seek(0, 2)          # seek to end
    size = file_obj.tell()
    file_obj.seek(0)             # rewind
    if size > MAX_UPLOAD_BYTES:
        raise IPFSUploadError(
            f"File is too large ({size} bytes). "
            f"Maximum allowed: {MAX_UPLOAD_BYTES} bytes (10 MB)."
        )

    headers = _build_file_headers()
    label   = pin_name or file_name

    files   = {"file": (file_name, file_obj)}
    data    = {
        "pinataMetadata": json.dumps({"name": label}),
        "pinataOptions":  json.dumps({"cidVersion": 1}),
    }

    logger.info("Uploading file to Pinata IPFS: %s (%d bytes)", file_name, size)

    try:
        response = requests.post(
            PINATA_PIN_FILE_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.exceptions.Timeout:
        raise IPFSUploadError("Pinata file upload timed out. Please try again.")
    except requests.exceptions.ConnectionError as exc:
        raise IPFSUploadError(f"Network error connecting to Pinata: {exc}")

    if not response.ok:
        logger.error(
            "Pinata file upload failed: HTTP %s — %s",
            response.status_code,
            response.text[:300],
        )
        raise IPFSUploadError(
            f"Pinata returned HTTP {response.status_code}. "
            "Check your API credentials and Pinata account."
        )

    try:
        result = response.json()
        cid    = result["IpfsHash"]
    except (ValueError, KeyError) as exc:
        raise IPFSUploadError(f"Unexpected Pinata response format: {exc}")

    ipfs_uri = f"ipfs://{cid}"
    logger.info("File upload successful. CID=%s", cid)
    return cid, ipfs_uri


def unpin_from_ipfs(cid: str) -> bool:
    """
    Attempt to unpin a CID from Pinata.
    Returns True on success, False if it was not found (already unpinned).
    Raises IPFSUploadError on other failures.

    NOTE: Unpinning from Pinata removes the pin from your account but
    does NOT guarantee the content is deleted from the wider IPFS network
    if other nodes have pinned it.
    """
    headers = _build_file_headers()
    url     = f"https://api.pinata.cloud/pinning/unpin/{cid}"

    logger.info("Attempting to unpin CID from Pinata: %s", cid)

    try:
        response = requests.delete(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        raise IPFSUploadError(f"Network error during unpin: {exc}")

    if response.status_code == 200:
        logger.info("Unpin successful for CID: %s", cid)
        return True
    if response.status_code == 404:
        logger.warning("CID not found in Pinata account (already unpinned?): %s", cid)
        return False

    logger.error("Unpin failed: HTTP %s — %s", response.status_code, response.text[:200])
    raise IPFSUploadError(
        f"Pinata unpin returned HTTP {response.status_code}."
    )


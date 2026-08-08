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

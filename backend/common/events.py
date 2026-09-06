"""
FarmerChain Event Emitter — pushes real-time events to the Socket.IO sidecar.

Usage in Django views:
    from common.events import emit_event
    emit_event("crop_updated", {"crop_id": crop.id, "farmer_id": farmer.id})

Events are sent in a background thread so the Django response is never delayed.
If the sidecar is unavailable, the error is logged silently.
"""

import threading
import json
import os

# The Socket.IO sidecar URL (default: localhost:3001)
SOCKETIO_SIDECAR_URL = os.environ.get("SOCKETIO_SIDECAR_URL", "http://localhost:3001")


def emit_event(event_name, data=None, room=None):
    """
    Fire-and-forget event emission to the Socket.IO sidecar.

    Args:
        event_name: str — one of: crop_updated, quote_updated, bid_updated,
                    deal_updated, inventory_updated, escrow_updated,
                    transaction_updated, delivery_updated, purchase_completed
        data: dict — optional payload (e.g. {"crop_id": 1})
        room: str — optional room target ("farmer", "fpo", "retailer")
    """
    def _send():
        try:
            import urllib.request
            payload = json.dumps({
                "event": event_name,
                "data": data or {},
                "room": room,
            }).encode("utf-8")

            req = urllib.request.Request(
                f"{SOCKETIO_SIDECAR_URL}/emit",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                resp.read()
        except Exception as e:
            # Never block the Django request — just log the failure
            import logging
            logger = logging.getLogger("common.events")
            logger.warning(f"[EventEmitter] Failed to emit '{event_name}': {e}")

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()

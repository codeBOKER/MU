"""Inbound WAHA events → canonical contract → core /ingest.

The normalizer is pure (unit-testable, no I/O). The process function adds the
network round-trip and media download. Unsupported/non-message events are
handled explicitly instead of crashing the webhook.
"""

import base64
import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.services.core_client import CoreClient
from app.services.dedup import DedupStore, event_key
from app.services.formatting import to_whatsapp
from app.services.waha_client import WahaClient

logger = logging.getLogger(__name__)

CHANNEL = "whatsapp-waha"
# Direct chats only. Groups/channels are out of scope for this adapter — their
# participants/membership semantics are not represented in the canonical
# contract. Ignoring them is deliberately safer than mis-addressing a reply.
_IGNORED_SUFFIXES = ("@g.us", "@broadcast", "@newsletter")


def _as_dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def _chat_id(payload: dict) -> str | None:
    for candidate in (payload.get("from"), payload.get("chatId")):
        if isinstance(candidate, str) and candidate:
            return candidate
    key = _as_dict(_as_dict(payload.get("_data")).get("key"))
    candidate = key.get("remoteJid")
    return candidate if isinstance(candidate, str) and candidate else None


def _is_direct_chat(chat_id: str) -> bool:
    return not chat_id.lower().endswith(_IGNORED_SUFFIXES)


def _wa_id(chat_id: str) -> str | None:
    """Phone number only when WhatsApp actually exposed a phone-addressed id.

    @lid is an opaque linked-device identifier — extracting digits from it and
    calling that a phone number would corrupt identity. Keep wa_id null there.
    """
    local, _, domain = chat_id.partition("@")
    if domain.lower() in ("c.us", "s.whatsapp.net") and local.isdigit():
        return local
    return None


def _display_name(payload: dict) -> str | None:
    data = _as_dict(payload.get("_data"))
    for candidate in (data.get("pushName"), payload.get("pushName")):
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return None


def _received_at(payload: dict) -> str:
    timestamp = payload.get("timestamp")
    if isinstance(timestamp, (int, float)):
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def _media_type(media: dict) -> str:
    mimetype = str(media.get("mimetype") or "").lower()
    if mimetype.startswith("image/"):
        return "image"
    if mimetype.startswith("audio/"):
        return "audio"
    if mimetype.startswith("video/"):
        return "video"
    return "document"


def normalize_message(event: dict) -> dict | None:
    """Map one WAHA `message` event to the canonical IngestRequest shape.

    Returns None for events this adapter intentionally ignores (own messages,
    group/broadcast chats, malformed payloads).
    """
    if not isinstance(event, dict):
        return None
    if event.get("event") not in ("message", "message.any"):
        return None

    payload = _as_dict(event.get("payload"))
    if payload.get("fromMe") is True:
        return None
    chat_id = _chat_id(payload)
    if not chat_id or not _is_direct_chat(chat_id):
        return None

    body = payload.get("body")
    text = body if isinstance(body, str) and body else None
    media = _as_dict(payload.get("media"))
    has_media = bool(payload.get("hasMedia") or media)

    if has_media:
        mtype = _media_type(media)
    elif text is not None:
        mtype = "text"
    else:
        # Location, contact card, poll, etc. — represented so the agent can
        # answer gracefully; this never crashes the webhook.
        mtype = "unsupported"

    media_raw = None
    if media:
        media_raw = {
            "mimetype": media.get("mimetype"),
            "filename": media.get("filename"),
            "url_present": bool(media.get("url")),
            "error": media.get("error"),
        }

    return {
        "channel": CHANNEL,
        "contact": {
            "external_id": chat_id,
            "wa_id": _wa_id(chat_id),
            "display_name": _display_name(payload),
            "metadata": {
                "waha_chat_id": chat_id,
                "waha_session": event.get("session"),
            },
        },
        "message": {
            "type": mtype,
            "text": text,
            "media_url": None,
            "raw": {
                "wamid": payload.get("id"),
                "waha_chat_id": chat_id,
                "waha_session": event.get("session"),
                "source": payload.get("source"),
                "media": media_raw,
            },
        },
        "received_at": _received_at(payload),
    }


async def _attach_media(payload: dict, event: dict, waha: WahaClient) -> None:
    """Inline WAHA media so the channel-agnostic core can use it this turn."""
    media = _as_dict(_as_dict(event.get("payload")).get("media"))
    url = media.get("url")
    if not isinstance(url, str) or not url:
        return
    downloaded = await waha.download_media(url)
    if downloaded is None:
        return
    data, header_mime = downloaded
    mime = media.get("mimetype") or header_mime or "application/octet-stream"
    payload["message"]["media_url"] = (
        f"data:{mime};base64,{base64.b64encode(data).decode()}"
    )


def _log_session_status(event: dict) -> None:
    payload = _as_dict(event.get("payload"))
    status = payload.get("status")
    reason = _as_dict(payload.get("data")).get("reason")
    if status == "FAILED":
        logger.error(
            "WAHA session '%s' FAILED: %s",
            event.get("session"),
            reason or "unknown reason",
        )
    else:
        logger.info("WAHA session '%s' status: %s", event.get("session"), status)


async def process_event(
    event: dict,
    raw_body: bytes,
    *,
    core: CoreClient,
    waha: WahaClient,
    dedup: DedupStore,
) -> str:
    """Process one verified webhook delivery. Raises on failures worth a retry."""
    event_type = event.get("event")
    if event_type == "session.status":
        _log_session_status(event)
        return "ignored"
    if event_type not in ("message", "message.any"):
        return "ignored"

    key = event_key(event, raw_body)
    if not dedup.claim(key):
        logger.info("Duplicate WAHA delivery ignored: %s", key)
        return "duplicate"

    try:
        payload = normalize_message(event)
        if payload is None:
            return "ignored"

        chat_id = payload["contact"]["metadata"]["waha_chat_id"]
        if payload["message"]["type"] == "unsupported":
            await waha.send_text(chat_id, settings.unsupported_reply)
            return "unsupported"

        await _attach_media(payload, event, waha)
        result = await core.ingest(payload)
        if result is None:
            await waha.send_text(chat_id, settings.error_reply)
            return "error"

        for message in result.get("messages", []):
            if message.get("type") == "text" and message.get("text"):
                await waha.send_text(chat_id, to_whatsapp(message["text"]))
            else:
                logger.warning(
                    "Skipping unsupported outbound message type: %s",
                    message.get("type"),
                )
        return "ok"
    except Exception:
        # Release the claim so WAHA's retry can genuinely try again.
        dedup.release(key)
        raise

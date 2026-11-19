"""Canonical outbound sending (ADR-004) — the gateway side of `POST /send`.

The core POSTs a canonical message here and this service renders it through
WAHA. Addressing uses `contact.external_id` (the original WAHA chat id we stored
on the inbound side) and only falls back to `wa_id` when that is unavailable.
There is no 24h customer-service window on personal WhatsApp, so that special
case stays specific to the Meta/PyWa gateway.
"""

import base64
import binascii
import logging
import re

from pydantic import BaseModel, Field

from app.services.waha_client import WahaClient, WahaError

logger = logging.getLogger(__name__)

MEDIA_TYPES = ("image", "document", "audio")
_CHAT_ID_RE = re.compile(r"^[^@\s]+@(c\.us|lid|g\.us)$", re.IGNORECASE)
_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "application/pdf": "pdf",
}


class SendContact(BaseModel):
    channel: str = "whatsapp-waha"
    external_id: str | None = None
    wa_id: str | None = None


class SendMessage(BaseModel):
    type: str = "text"
    text: str | None = Field(default=None, max_length=4096)
    media_url: str | None = None
    filename: str | None = None


class SendRequest(BaseModel):
    contact: SendContact
    message: SendMessage


class SendError(Exception):
    """A send that didn't happen — `code` travels back to the core verbatim."""

    def __init__(self, code: str, status_code: int, message: str):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.message = message


def _decode_data_uri(uri: str) -> tuple[str, bytes]:
    header, _, payload = uri.partition(",")
    if not payload or not header.startswith("data:"):
        raise SendError(
            "INVALID_MEDIA", 422, "media_url must be a base64 data: URI"
        )
    mime = header.removeprefix("data:").split(";", 1)[0] or "application/octet-stream"
    try:
        return mime, base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise SendError("INVALID_MEDIA", 422, "media_url is not valid base64") from exc


def _normalize_chat_id(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    if "@" not in value:
        return f"{value}@c.us" if value.isdigit() else None
    local, _, domain = value.rpartition("@")
    domain = domain.lower()
    if domain == "s.whatsapp.net":
        domain = "c.us"
    if domain not in ("c.us", "lid", "g.us"):
        return None
    candidate = f"{local}@{domain}"
    return candidate if _CHAT_ID_RE.match(candidate) else None


def _chat_id(request: SendRequest) -> str:
    for value in (request.contact.external_id, request.contact.wa_id):
        normalized = _normalize_chat_id(value)
        if normalized:
            return normalized
    raise SendError(
        "NO_CHAT_ID",
        400,
        "The contact has no usable WAHA chat id (external_id/wa_id)",
    )


def _filename(message: SendMessage, mime: str, fallback: str) -> str:
    if message.filename:
        return message.filename
    return f"{fallback}.{_EXTENSIONS.get(mime, 'bin')}"


async def _dispatch(waha: WahaClient, chat_id: str, message: SendMessage):
    if message.type == "text":
        return await waha.send_text(chat_id, message.text or "")

    mime, raw = _decode_data_uri(message.media_url or "")
    data = base64.b64encode(raw).decode()

    if message.type == "image":
        if not mime.startswith("image/"):
            raise SendError("INVALID_MEDIA", 422, "Image media must be an image/* type")
        return await waha.send_image(
            chat_id,
            data=data,
            mimetype=mime,
            filename=_filename(message, mime, "image"),
            caption=message.text,
        )
    if message.type == "document":
        return await waha.send_document(
            chat_id,
            data=data,
            mimetype=mime,
            filename=_filename(message, mime, "document"),
            caption=message.text,
        )
    if not mime.startswith("audio/"):
        raise SendError("INVALID_MEDIA", 422, "Audio media must be an audio/* type")
    return await waha.send_voice(
        chat_id,
        data=data,
        mimetype=mime,
        filename=_filename(message, mime, "voice"),
    )


async def send_canonical(waha: WahaClient, request: SendRequest) -> dict:
    message = request.message
    if message.type == "text":
        if not message.text:
            raise SendError("UNSUPPORTED_TYPE", 422, "Text messages need text")
    elif message.type in MEDIA_TYPES:
        if not message.media_url:
            raise SendError(
                "UNSUPPORTED_TYPE", 422, f"{message.type} messages need media_url"
            )
    else:
        raise SendError(
            "UNSUPPORTED_TYPE",
            422,
            f"Unsupported outbound type '{message.type}' "
            f"(text, {', '.join(MEDIA_TYPES)})",
        )

    chat_id = _chat_id(request)
    try:
        sent = await _dispatch(waha, chat_id, message)
    except SendError:
        raise
    except WahaError as exc:
        logger.warning("WAHA send failed for %s: %s", chat_id, exc.message)
        raise SendError("SEND_FAILED", 502, f"WAHA send failed: {exc.message}") from exc
    except Exception as exc:
        logger.exception("WAHA send failed for %s", chat_id)
        raise SendError("SEND_FAILED", 502, f"WAHA send failed: {exc}") from exc

    return {"status": "sent", "message_id": WahaClient._message_id(sent)}

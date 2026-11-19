"""Canonical outbound seam tests (POST /send, ADR-004)."""

import base64

import pytest

from app.services.sender import SendError, SendRequest, send_canonical
from app.services.waha_client import WahaError

JPEG_URI = "data:image/jpeg;base64," + base64.b64encode(b"fake-jpeg").decode()


def request(
    *,
    external_id="51999888777@c.us",
    wa_id=None,
    mtype="text",
    text="hola",
    media_url=None,
    filename=None,
) -> SendRequest:
    return SendRequest.model_validate(
        {
            "contact": {
                "channel": "whatsapp-waha",
                "external_id": external_id,
                "wa_id": wa_id,
            },
            "message": {
                "type": mtype,
                "text": text,
                "media_url": media_url,
                "filename": filename,
            },
        }
    )


class FakeWaha:
    def __init__(self, error: Exception | None = None):
        self.error = error
        self.calls: list[dict] = []

    def _record(self, method: str, kwargs: dict):
        self.calls.append({"method": method, **kwargs})
        if self.error:
            raise self.error
        return {"id": "wamid.SENT1"}

    async def send_text(self, chat_id, text):
        return self._record("send_text", {"chat_id": chat_id, "text": text})

    async def send_image(self, chat_id, **kwargs):
        return self._record("send_image", {"chat_id": chat_id, **kwargs})

    async def send_document(self, chat_id, **kwargs):
        return self._record("send_document", {"chat_id": chat_id, **kwargs})

    async def send_voice(self, chat_id, **kwargs):
        return self._record("send_voice", {"chat_id": chat_id, **kwargs})


async def test_text_uses_original_waha_chat_id():
    waha = FakeWaha()

    result = await send_canonical(waha, request())

    assert result == {"status": "sent", "message_id": "wamid.SENT1"}
    assert waha.calls == [
        {
            "method": "send_text",
            "chat_id": "51999888777@c.us",
            "text": "hola",
        }
    ]


async def test_lid_chat_id_is_preserved_not_rewritten_to_phone():
    waha = FakeWaha()

    await send_canonical(
        waha,
        request(external_id="123456789012345@lid", wa_id="51999888777"),
    )

    assert waha.calls[0]["chat_id"] == "123456789012345@lid"


async def test_wa_id_fallback_is_converted_to_c_us():
    waha = FakeWaha()

    await send_canonical(waha, request(external_id=None, wa_id="51999888777"))

    assert waha.calls[0]["chat_id"] == "51999888777@c.us"


async def test_image_sends_base64_and_caption():
    waha = FakeWaha()

    await send_canonical(
        waha,
        request(mtype="image", text="mira esto", media_url=JPEG_URI),
    )

    call = waha.calls[0]
    assert call["method"] == "send_image"
    assert call["data"] == base64.b64encode(b"fake-jpeg").decode()
    assert call["mimetype"] == "image/jpeg"
    assert call["filename"] == "image.jpg"
    assert call["caption"] == "mira esto"


async def test_document_sends_filename_and_base64():
    waha = FakeWaha()
    pdf_uri = "data:application/pdf;base64," + base64.b64encode(b"%PDF-fake").decode()

    await send_canonical(
        waha,
        request(
            mtype="document",
            text="el manual",
            media_url=pdf_uri,
            filename="manual.pdf",
        ),
    )

    call = waha.calls[0]
    assert call["method"] == "send_document"
    assert call["data"] == base64.b64encode(b"%PDF-fake").decode()
    assert call["mimetype"] == "application/pdf"
    assert call["filename"] == "manual.pdf"
    assert call["caption"] == "el manual"


async def test_audio_goes_to_send_voice():
    waha = FakeWaha()
    audio_uri = "data:audio/ogg;codecs=opus;base64," + base64.b64encode(
        b"OggS-fake"
    ).decode()

    await send_canonical(waha, request(mtype="audio", text=None, media_url=audio_uri))

    call = waha.calls[0]
    assert call["method"] == "send_voice"
    assert call["data"] == base64.b64encode(b"OggS-fake").decode()
    assert call["mimetype"] == "audio/ogg"
    assert call["filename"] == "voice.ogg"


async def test_video_is_not_in_the_canonical_outbound_contract():
    with pytest.raises(SendError) as exc:
        await send_canonical(
            FakeWaha(),
            request(mtype="video", media_url="data:video/mp4;base64,AAAA"),
        )
    assert exc.value.code == "UNSUPPORTED_TYPE"
    assert exc.value.status_code == 422


async def test_media_type_without_media_url_is_unsupported():
    with pytest.raises(SendError) as exc:
        await send_canonical(FakeWaha(), request(mtype="image", text=None))
    assert exc.value.code == "UNSUPPORTED_TYPE"


async def test_malformed_data_uri_is_invalid_media():
    with pytest.raises(SendError) as exc:
        await send_canonical(
            FakeWaha(),
            request(mtype="image", text=None, media_url="https://x/y.jpg"),
        )
    assert exc.value.code == "INVALID_MEDIA"


async def test_wrong_media_mime_is_invalid_media():
    with pytest.raises(SendError) as exc:
        await send_canonical(
            FakeWaha(),
            request(
                mtype="image",
                text=None,
                media_url="data:application/pdf;base64,JVBERg==",
            ),
        )
    assert exc.value.code == "INVALID_MEDIA"


async def test_missing_chat_id_is_a_clear_error():
    with pytest.raises(SendError) as exc:
        await send_canonical(FakeWaha(), request(external_id=None, wa_id=None))
    assert exc.value.code == "NO_CHAT_ID"
    assert exc.value.status_code == 400


async def test_waha_failure_maps_to_send_failed():
    with pytest.raises(SendError) as exc:
        await send_canonical(FakeWaha(error=WahaError("session not found", 404)), request())
    assert exc.value.code == "SEND_FAILED"
    assert exc.value.status_code == 502
    assert "session not found" in exc.value.message

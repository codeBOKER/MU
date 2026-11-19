"""Webhook auth, idempotency and processing tests."""

import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.handlers import inbound
from app.handlers.inbound import process_event
from app.main import app, verify_webhook
from app.services.dedup import DedupStore, event_key


def event(**payload):
    return {
        "id": "evt_01TEST",
        "event": "message",
        "session": "default",
        "payload": {
            "id": "false_51999888777@c.us_ABC",
            "timestamp": 1667561485,
            "from": "51999888777@c.us",
            "fromMe": False,
            "body": "Hola",
            "hasMedia": False,
            **payload,
        },
    }


class FakeCore:
    def __init__(self, result=None, error: Exception | None = None):
        self.payloads: list[dict] = []
        self.result = result or {"messages": [{"type": "text", "text": "**Hola**"}]}
        self.error = error

    async def ingest(self, payload):
        self.payloads.append(payload)
        if self.error:
            raise self.error
        return self.result


class FakeWaha:
    def __init__(self, media: tuple[bytes, str] | None = None):
        self.texts: list[tuple[str, str]] = []
        self.media = media

    async def send_text(self, chat_id, text):
        self.texts.append((chat_id, text))
        return {"id": "wamid.REPLY"}

    async def download_media(self, url):
        return self.media


def test_hmac_verification(monkeypatch):
    monkeypatch.setattr(settings, "waha_webhook_hmac_key", "secret")
    body = b'{"event":"message"}'
    signature = hmac.new(b"secret", body, hashlib.sha512).hexdigest()

    assert verify_webhook(body, signature, "sha512") is True
    assert verify_webhook(body, signature.upper(), "SHA-512") is True
    assert verify_webhook(body, "nope", "sha512") is False
    assert verify_webhook(body, None, "sha512") is False
    assert verify_webhook(body, signature, "md5") is False


def test_hmac_is_open_when_key_is_unset(monkeypatch):
    monkeypatch.setattr(settings, "waha_webhook_hmac_key", "")
    assert verify_webhook(b"{}", None, None) is True


async def test_process_forwards_and_renders_reply():
    core = FakeCore()
    waha = FakeWaha()
    dedup = DedupStore("", ttl_seconds=3600)
    raw = json.dumps(event()).encode()

    status = await process_event(
        event(), raw, core=core, waha=waha, dedup=dedup
    )

    assert status == "ok"
    assert core.payloads[0]["contact"]["external_id"] == "51999888777@c.us"
    assert waha.texts == [("51999888777@c.us", "*Hola*")]


async def test_duplicate_delivery_does_not_ingest_twice():
    core = FakeCore()
    waha = FakeWaha()
    dedup = DedupStore("", ttl_seconds=3600)
    raw = json.dumps(event()).encode()

    assert await process_event(event(), raw, core=core, waha=waha, dedup=dedup) == "ok"
    assert (
        await process_event(event(), raw, core=core, waha=waha, dedup=dedup)
        == "duplicate"
    )
    assert len(core.payloads) == 1


async def test_failed_processing_releases_claim_for_retry():
    dedup = DedupStore("", ttl_seconds=3600)
    raw = json.dumps(event()).encode()
    key = event_key(event(), raw)

    with pytest.raises(RuntimeError):
        await process_event(
            event(),
            raw,
            core=FakeCore(error=RuntimeError("core down")),
            waha=FakeWaha(),
            dedup=dedup,
        )

    assert dedup.claim(key) is True


async def test_unsupported_message_gets_gateway_reply_not_core_turn():
    core = FakeCore()
    waha = FakeWaha()
    dedup = DedupStore("", ttl_seconds=3600)
    unsupported = event(body=None, hasMedia=False)
    raw = json.dumps(unsupported).encode()

    status = await process_event(
        unsupported, raw, core=core, waha=waha, dedup=dedup
    )

    assert status == "unsupported"
    assert core.payloads == []
    assert waha.texts == [("51999888777@c.us", settings.unsupported_reply)]


async def test_inbound_media_is_downloaded_and_inlined():
    core = FakeCore(result={"messages": []})
    waha = FakeWaha(media=(b"jpeg-bytes", "image/jpeg"))
    dedup = DedupStore("", ttl_seconds=3600)
    image = event(
        body="recibo",
        hasMedia=True,
        media={"url": "http://waha:3000/api/files/x.jpg", "mimetype": "image/jpeg"},
    )
    raw = json.dumps(image).encode()

    await process_event(image, raw, core=core, waha=waha, dedup=dedup)

    assert core.payloads[0]["message"]["media_url"].startswith(
        "data:image/jpeg;base64,"
    )


async def test_session_status_is_logged_and_ignored():
    core = FakeCore()
    waha = FakeWaha()
    dedup = DedupStore("", ttl_seconds=3600)
    status_event = {
        "id": "evt_status",
        "event": "session.status",
        "session": "default",
        "payload": {"status": "FAILED", "data": {"reason": {"event": "LoggedOut"}}},
    }

    status = await process_event(
        status_event, b"{}", core=core, waha=waha, dedup=dedup
    )

    assert status == "ignored"
    assert core.payloads == []


def test_webhook_endpoint_verifies_hmac_and_processes(monkeypatch):
    from app import main

    core = FakeCore()
    waha = FakeWaha()
    main.core_client = core
    main.waha_client = waha
    main.dedup_store = DedupStore("", ttl_seconds=3600)
    monkeypatch.setattr(settings, "waha_webhook_hmac_key", "secret")

    body = json.dumps(event()).encode()
    signature = hmac.new(b"secret", body, hashlib.sha512).hexdigest()
    headers = {
        "X-Webhook-Hmac": signature,
        "X-Webhook-Hmac-Algorithm": "sha512",
        "Content-Type": "application/json",
    }

    client = TestClient(app)
    invalid = client.post(
        "/webhook", content=body, headers={**headers, "X-Webhook-Hmac": "bad"}
    )
    valid = client.post("/webhook", content=body, headers=headers)

    assert invalid.status_code == 401
    assert valid.status_code == 200
    assert valid.json()["status"] == "ok"
    assert len(core.payloads) == 1


def test_process_event_accepts_configured_session_status_logging(monkeypatch):
    # Keep the logger call exercised without requiring a real WAHA instance.
    called = {}
    monkeypatch.setattr(
        inbound,
        "_log_session_status",
        lambda event: called.update(event=event),
    )
    status_event = {
        "id": "evt_status",
        "event": "session.status",
        "session": "default",
        "payload": {"status": "WORKING"},
    }

    import asyncio

    result = asyncio.run(
        process_event(
            status_event,
            b"{}",
            core=FakeCore(),
            waha=FakeWaha(),
            dedup=DedupStore("", ttl_seconds=3600),
        )
    )

    assert result == "ignored"
    assert called["event"] is status_event


def test_send_endpoint_rejects_bad_key_and_maps_waha(monkeypatch):
    from app import main

    waha = FakeWaha()
    main.waha_client = waha
    monkeypatch.setattr(settings, "internal_api_key", "shared")

    payload = {
        "contact": {
            "channel": "whatsapp-waha",
            "external_id": "51999888777@c.us",
            "wa_id": None,
        },
        "message": {"type": "text", "text": "hola"},
    }
    client = TestClient(app)

    denied = client.post("/send", json=payload, headers={"X-Internal-API-Key": "bad"})
    accepted = client.post(
        "/send", json=payload, headers={"X-Internal-API-Key": "shared"}
    )
    unsupported = client.post(
        "/send",
        json={**payload, "message": {"type": "video", "media_url": "data:video/mp4;base64,AAAA"}},
        headers={"X-Internal-API-Key": "shared"},
    )

    assert denied.status_code == 401
    assert accepted.status_code == 200
    assert accepted.json() == {"status": "sent", "message_id": "wamid.REPLY"}
    assert unsupported.status_code == 422
    assert unsupported.json()["detail"]["code"] == "UNSUPPORTED_TYPE"

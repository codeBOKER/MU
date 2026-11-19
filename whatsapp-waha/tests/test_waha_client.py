"""WAHA REST client shape tests (respx — no real WAHA)."""

import json

import httpx
import pytest
import respx

from app.services.waha_client import WahaClient, WahaError


def client(**overrides):
    values = dict(
        base_url="http://waha:3000",
        api_key="sekret",
        session="default",
        timeout=5,
        media_timeout=5,
        voice_convert=True,
        max_media_bytes=1024,
    )
    values.update(overrides)
    return WahaClient(**values)


@respx.mock
async def test_send_text_posts_expected_body_and_api_key():
    route = respx.post("http://waha:3000/api/sendText").mock(
        return_value=httpx.Response(200, json={"id": "wamid.1"})
    )
    waha = client()

    result = await waha.send_text("51999888777@c.us", "hola")
    await waha.close()

    assert result["id"] == "wamid.1"
    request = route.calls[0].request
    assert request.headers["X-Api-Key"] == "sekret"
    assert json.loads(request.content) == {
        "session": "default",
        "chatId": "51999888777@c.us",
        "text": "hola",
    }


@respx.mock
async def test_send_image_and_voice_bodies():
    image_route = respx.post("http://waha:3000/api/sendImage").mock(
        return_value=httpx.Response(200, json={"id": "m1"})
    )
    voice_route = respx.post("http://waha:3000/api/sendVoice").mock(
        return_value=httpx.Response(200, json={"id": "m2"})
    )
    waha = client()

    await waha.send_image(
        "1@c.us", data="AAAA", mimetype="image/jpeg", filename="a.jpg", caption="hi"
    )
    await waha.send_voice(
        "1@c.us", data="BBBB", mimetype="audio/ogg", filename="v.ogg"
    )
    await waha.close()

    assert json.loads(image_route.calls[0].request.content)["caption"] == "hi"
    assert json.loads(image_route.calls[0].request.content)["file"] == {
        "mimetype": "image/jpeg",
        "filename": "a.jpg",
        "data": "AAAA",
    }
    assert json.loads(voice_route.calls[0].request.content)["convert"] is True


@respx.mock
async def test_waha_error_body_is_surfaced():
    respx.post("http://waha:3000/api/sendText").mock(
        return_value=httpx.Response(404, json={"message": "Session not found"})
    )
    waha = client()

    with pytest.raises(WahaError) as exc:
        await waha.send_text("1@c.us", "hola")
    await waha.close()

    assert exc.value.status_code == 404
    assert exc.value.message == "Session not found"


@respx.mock
async def test_ensure_session_creates_webhook_only_when_missing():
    respx.get("http://waha:3000/api/sessions/default").mock(
        return_value=httpx.Response(404, json={"message": "not found"})
    )
    create = respx.post("http://waha:3000/api/sessions").mock(
        return_value=httpx.Response(200, json={"name": "default", "status": "STARTING"})
    )
    waha = client()

    await waha.ensure_session("http://gw:8003/webhook", "hmac")
    await waha.close()

    body = json.loads(create.calls[0].request.content)
    assert body["start"] is True
    webhook = body["config"]["webhooks"][0]
    assert webhook["url"] == "http://gw:8003/webhook"
    assert webhook["events"] == ["message", "session.status"]
    assert webhook["hmac"] == {"key": "hmac"}


@respx.mock
async def test_ensure_session_does_not_create_on_auth_failure():
    respx.get("http://waha:3000/api/sessions/default").mock(
        return_value=httpx.Response(401, json={"message": "Invalid API key"})
    )
    create = respx.post("http://waha:3000/api/sessions").mock(
        return_value=httpx.Response(200, json={"name": "default"})
    )
    waha = client(api_key="wrong")

    with pytest.raises(WahaError) as exc:
        await waha.ensure_session("http://gw:8003/webhook", "hmac")
    await waha.close()

    assert exc.value.status_code == 401
    assert not create.called


@respx.mock
async def test_download_media_is_size_bounded():
    respx.get("http://waha:3000/api/files/x.jpg").mock(
        return_value=httpx.Response(
            200, content=b"x" * 2048, headers={"content-type": "image/jpeg"}
        )
    )
    waha = client(max_media_bytes=1024)

    result = await waha.download_media("/api/files/x.jpg")
    await waha.close()

    assert result is None

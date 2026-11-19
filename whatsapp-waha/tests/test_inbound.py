"""Unit tests for WAHA → canonical normalization (no network)."""

from app.handlers.inbound import normalize_message


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


def test_text_from_phone_chat_id():
    payload = normalize_message(event())

    assert payload["channel"] == "whatsapp-waha"
    assert payload["contact"] == {
        "external_id": "51999888777@c.us",
        "wa_id": "51999888777",
        "display_name": None,
        "metadata": {"waha_chat_id": "51999888777@c.us", "waha_session": "default"},
    }
    assert payload["message"]["type"] == "text"
    assert payload["message"]["text"] == "Hola"
    assert payload["message"]["media_url"] is None
    assert payload["received_at"] == "2022-11-04T11:31:25+00:00"


def test_lid_is_not_treated_as_a_phone_number():
    payload = normalize_message(
        event(**{"from": "123456789012345@lid", "body": "hola"})
    )

    assert payload["contact"]["external_id"] == "123456789012345@lid"
    assert payload["contact"]["wa_id"] is None
    assert payload["contact"]["metadata"]["waha_chat_id"] == "123456789012345@lid"


def test_from_me_is_ignored():
    assert normalize_message(event(**{"fromMe": True})) is None


def test_groups_and_broadcasts_are_ignored():
    assert normalize_message(event(**{"from": "123-456@g.us"})) is None
    assert normalize_message(event(**{"from": "status@broadcast"})) is None


def test_falls_back_to_remote_jid_in_engine_data():
    message = event()
    message["payload"].pop("from")
    message["payload"]["_data"] = {"key": {"remoteJid": "51999888777@c.us"}}

    assert normalize_message(message)["contact"]["external_id"] == "51999888777@c.us"


def test_image_caption_and_media_metadata():
    payload = normalize_message(
        event(
            body="mi recibo",
            hasMedia=True,
            media={
                "url": "http://waha:3000/api/files/x.jpg",
                "mimetype": "image/jpeg",
                "filename": None,
                "error": None,
            },
            _data={"pushName": "Juan"},
        )
    )

    assert payload["message"]["type"] == "image"
    assert payload["message"]["text"] == "mi recibo"
    assert payload["message"]["raw"]["media"]["mimetype"] == "image/jpeg"
    assert payload["message"]["raw"]["media"]["url_present"] is True
    assert payload["contact"]["display_name"] == "Juan"


def test_video_and_document_types():
    video = normalize_message(
        event(hasMedia=True, body=None, media={"mimetype": "video/mp4"})
    )
    document = normalize_message(
        event(
            hasMedia=True,
            body="manual",
            media={"mimetype": "application/pdf", "filename": "manual.pdf"},
        )
    )

    assert video["message"]["type"] == "video"
    assert document["message"]["type"] == "document"
    assert document["message"]["text"] == "manual"
    assert document["message"]["raw"]["media"]["filename"] == "manual.pdf"


def test_unknown_message_without_text_or_media_is_safe():
    payload = normalize_message(
        event(body=None, hasMedia=False, _data={"message": {"locationMessage": {}}})
    )

    assert payload["message"]["type"] == "unsupported"
    assert payload["message"]["text"] is None


def test_non_message_events_are_ignored():
    message = event()
    message["event"] = "message.ack"
    assert normalize_message(message) is None
    assert normalize_message("not a dict") is None

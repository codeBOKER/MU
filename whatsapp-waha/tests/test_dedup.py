"""Webhook idempotency tests."""

import time

from app.services.dedup import DedupStore, event_key


def test_claim_is_atomic_and_release_allows_retry(tmp_path):
    store = DedupStore(str(tmp_path / "dedup.sqlite3"), ttl_seconds=3600)

    assert store.claim("evt:1") is True
    assert store.claim("evt:1") is False

    store.release("evt:1")
    assert store.claim("evt:1") is True


def test_claims_survive_a_new_store_instance(tmp_path):
    path = str(tmp_path / "dedup.sqlite3")
    DedupStore(path, ttl_seconds=3600).claim("evt:1")

    # A different gunicorn worker / restart sees the same claim.
    assert DedupStore(path, ttl_seconds=3600).claim("evt:1") is False


def test_expired_claims_are_reclaimed(tmp_path):
    store = DedupStore(str(tmp_path / "dedup.sqlite3"), ttl_seconds=1)
    assert store.claim("evt:1") is True

    time.sleep(1.1)

    assert store.claim("evt:1") is True


def test_in_memory_store_when_path_is_empty():
    store = DedupStore("", ttl_seconds=3600)
    assert store.claim("evt:1") is True
    assert store.claim("evt:1") is False
    store.release("evt:1")
    assert store.claim("evt:1") is True


def test_event_key_prefers_wa_event_id_then_message_id():
    body = b"{}"
    assert event_key({"id": "evt_1", "session": "default", "payload": {"id": "m1"}}, body) == (
        "default:evt_1"
    )
    assert event_key({"session": "default", "payload": {"id": "m1"}}, body) == (
        "default:m1"
    )
    assert event_key({"session": "default", "payload": {}}, body).startswith(
        "default:sha256:"
    )

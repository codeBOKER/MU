"""Inbound webhook idempotency.

WAHA retries a webhook until it gets a 2xx response. The claim is written
BEFORE processing and released if processing fails, so a retry can reprocess a
failed delivery. A non-2xx response from the webhook route is therefore safe
and meaningful.

SQLite (not an in-process set) is deliberate: the Docker image runs gunicorn
with multiple workers, and a duplicate retry may land on a different worker.
"""

import hashlib
import sqlite3
from contextlib import closing
import threading
import time
from collections import OrderedDict
from pathlib import Path


class DedupStore:
    """A bounded-TTL idempotency store (SQLite file, or in-memory if empty)."""

    def __init__(self, path: str, ttl_seconds: int):
        self.path = path
        self.ttl_seconds = max(1, ttl_seconds)
        self._lock = threading.Lock()
        self._memory: OrderedDict[str, float] = OrderedDict()
        if self.path and self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
            with closing(self._connect()) as conn, conn:
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS seen_events ("
                    "  event_key TEXT PRIMARY KEY,"
                    "  seen_at REAL NOT NULL"
                    ")"
                )

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path, timeout=5.0)

    def _memory_cleanup(self, now: float) -> None:
        cutoff = now - self.ttl_seconds
        while self._memory:
            _, seen_at = next(iter(self._memory.items()))
            if seen_at >= cutoff:
                break
            self._memory.popitem(last=False)

    def claim(self, key: str) -> bool:
        """Atomically claim an event. False means it was already claimed."""
        now = time.time()
        if not self.path or self.path == ":memory:":
            with self._lock:
                self._memory_cleanup(now)
                if key in self._memory:
                    return False
                self._memory[key] = now
                return True

        with self._lock, closing(self._connect()) as conn, conn:
            conn.execute(
                "DELETE FROM seen_events WHERE seen_at < ?",
                (now - self.ttl_seconds,),
            )
            cursor = conn.execute(
                "INSERT OR IGNORE INTO seen_events (event_key, seen_at) VALUES (?, ?)",
                (key, now),
            )
            return cursor.rowcount == 1

    def release(self, key: str) -> None:
        """Drop a claim after a failed processing attempt so WAHA can retry."""
        if not self.path or self.path == ":memory:":
            with self._lock:
                self._memory.pop(key, None)
            return

        with self._lock, closing(self._connect()) as conn, conn:
            conn.execute("DELETE FROM seen_events WHERE event_key = ?", (key,))


def event_key(event: dict, raw_body: bytes) -> str:
    """Stable id for one WAHA delivery.

    WAHA's top-level event ULID is the retry-stable identity; the message id
    is a fallback for older builds. A body hash keeps unknown events safe.
    """
    session = str(event.get("session") or "")
    payload = event.get("payload")
    payload = payload if isinstance(payload, dict) else {}
    for candidate in (event.get("id"), payload.get("id")):
        if isinstance(candidate, str) and candidate:
            return f"{session}:{candidate}"
    return f"{session}:sha256:{hashlib.sha256(raw_body).hexdigest()}"

# AGENTS.md — Chasqui WAHA Gateway

The **self-hosted WhatsApp channel adapter** for Chasqui (WAHA + GOWS), an alternative to the Meta Cloud API gateway in `../whatsapp`. Read the parent's [`docs/ARCHITECTURE.md`](https://github.com/chasqui-stack/chasqui/blob/main/docs/ARCHITECTURE.md) first.

## Job

1. Receive WAHA webhooks (`message`, `session.status`), verify `X-Webhook-Hmac`, deduplicate retries.
2. Normalize direct-chat messages to the canonical contract. Preserve the original WAHA chat id as `contact.external_id`; never treat `@c.us`, `@lid`, `@s.whatsapp.net` and phone numbers as interchangeable. Download media and inline it as a base64 `data:` URI.
3. `POST` the core's `/ingest`.
4. Render the core's canonical response back through WAHA. Empty `messages` = silence (human mode / async coalescing). Render canonical Markdown with `app/services/formatting.py`.
5. Expose `POST /send` (ADR-004, `app/services/sender.py`): `text`, `image`, `document`, `audio`; `/send` is authenticated with the same `INTERNAL_API_KEY` as the core. Address by `external_id` first, `wa_id` only as a fallback.

## Stack

Python · FastAPI · httpx · WAHA HTTP API · SQLite (dedup only) · Sentry · `uv`.

## Dev

```bash
cp .env.example .env     # WAHA URL/key, CORE_URL, webhook HMAC
uv sync
make dev                 # :8003
make test
```

## Don't

- Add business logic or a database — this is an adapter. The SQLite file exists **only** for cross-worker webhook idempotency.
- Recreate an existing WAHA session on startup — that forces the user to re-pair. Create only when missing.
- Fetch WAHA media URLs in the core; download and inline them here.
- Add groups/channels/broadcasts without extending the canonical contact/conversation contract first.
- Hardcode user-facing literals. `ERROR_REPLY`/`UNSUPPORTED_REPLY` are gateway-local English defaults, configurable via `.env`.
- Send canonical Markdown raw — WhatsApp uses its own markup; use `to_whatsapp`.
- Assume `WAHA_API_KEY`/webhook HMAC is configured. Empty values are allowed for local dev but must be set in production.

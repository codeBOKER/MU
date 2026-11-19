# Chasqui WAHA WhatsApp Gateway

Self-hosted WhatsApp channel adapter for [Chasqui](https://github.com/chasqui-stack/chasqui), powered by [WAHA](https://waha.devlike.pro/) with its **GOWS** engine (WhatsApp Web over WebSocket — no Chromium).

This is an alternative to the official WhatsApp Cloud API gateway in `../whatsapp` (PyWa). It is useful when you want to link a personal/business WhatsApp number through WAHA instead of Meta's Business API. It is a thin bridge: WAHA webhooks → canonical Chasqui contract → core `/ingest`; core replies/operator messages → WAHA send APIs. No database or business logic.

## What it supports

Inbound, normalized to Chasqui's canonical contract and forwarded to the core:

- text
- image / video (caption becomes `message.text`)
- audio (voice notes and audio files)
- documents
- direct chats only (`@c.us` / `@lid`); groups, channels and broadcasts are ignored

Media is downloaded from WAHA (API-key protected) and inlined as `data:<mime>;base64,…` in `media_url`, because the channel-agnostic core can never fetch a WAHA-private URL.

Outbound (`POST /send`, ADR-004), the subset the canonical contract and WAHA both support:

- `text` → `POST /api/sendText`
- `image` → `POST /api/sendImage`
- `document` → `POST /api/sendFile`
- `audio` → `POST /api/sendVoice` (`WAHA_VOICE_CONVERT=true` lets WAHA normalize browser audio)

`video` is intentionally **not** an outbound type yet — the admin/API canonical contract does not expose it. Unknown types return `UNSUPPORTED_TYPE` instead of silently doing something else.

## Identity

WAHA direct chats use different identifier families: `123@c.us`, opaque `456@lid`, and sometimes `@s.whatsapp.net`. They are **not interchangeable**. This gateway stores the original WAHA chat id as the canonical `contact.external_id`, keeps it in `contact.metadata.waha_chat_id`, and only fills `wa_id` when the original id is genuinely phone-addressed (`@c.us` / `@s.whatsapp.net`). `@lid` contacts therefore have `wa_id = null`. Outbound addressing prefers `external_id`, so replies go back to the same chat WAHA delivered.

## Run WAHA + gateway with Docker Compose

From the repository root:

```bash
cp whatsapp-waha/.env.example whatsapp-waha/.env  # set WAHA_API_KEY, HMAC, CORE_URL
docker compose --env-file whatsapp-waha/.env --profile whatsapp-waha up --build -d
```

`--env-file whatsapp-waha/.env` supplies Compose interpolation values used by
the WAHA container; it does not load that file into every service. The core
container separately loads `core/.env`, the gateway loads
`whatsapp-waha/.env`, and the admin image reads `admin/.env` while building.
Compose overrides local-only settings such as the core's database host with
Docker service names. Keep `INTERNAL_API_KEY` the same in `core/.env` and
`whatsapp-waha/.env`. Set the dashboard username/password in
`whatsapp-waha/.env` before starting.

The compose Postgres is exposed on host port **5433** to avoid clashing with a
local Postgres. If a local `make dev` core already occupies 8090, run compose
with `CORE_HOST_PORT=8091`, update `VITE_API_BASE_URL` in `admin/.env` to
`http://localhost:8091`, rebuild, and open the admin at <http://localhost:3000>.

This starts:

- WAHA (pinned GOWS image) at <http://localhost:3001>, sessions persisted in `wahasessions`
- the gateway at <http://localhost:8003>
- core, Postgres and media storage

The gateway automatically creates/starts the configured session and registers its webhook when `WAHA_WEBHOOK_URL` is reachable from the WAHA container. Then open the WAHA dashboard (`http://localhost:3001/dashboard`) or call the QR endpoint and scan:

```bash
curl -H "X-Api-Key: $WAHA_API_KEY" \
  "http://localhost:3001/api/default/auth/qr?format=image" --output qr.png
```

Once the session is `WORKING`, messages to the linked number flow through the core agent. If you change `WAHA_API_KEY` or the HMAC key after the session exists, update/delete the session (the adapter deliberately does **not** recreate existing sessions — that would force a re-pair).

## Run the gateway alone

```bash
cp .env.example .env   # WAHA URL/key, CORE_URL, HMAC key
uv sync
make dev               # :8003
make test
```

Point WAHA's session webhook at `http://<gateway>:8003/webhook` with events `message,session.status`, or set `WAHA_WEBHOOK_URL` and let the gateway create the session.

Core wiring (one env var, no core code changes):

```bash
# core/.env
CHANNEL_WHATSAPP_WAHA_SEND_URL=http://whatsapp-waha:8003/send
INTERNAL_API_KEY=the-same-shared-secret-as-the-gateway
```

## Security

- Every WAHA API call uses `X-Api-Key` from `WAHA_API_KEY`.
- WAHA webhooks are verified with `X-Webhook-Hmac` (SHA-512 over the raw body) when `WAHA_WEBHOOK_HMAC_KEY` is set. Empty key = open webhook, for local development only.
- `/send` uses the core's `INTERNAL_API_KEY` (same shared secret as `/ingest`).
- WAHA webhook retries are deduplicated by event/message id in a small SQLite store (`WAHA_DEDUP_DB_PATH`). The claim is written before processing and released on failure, so retries can reprocess a genuinely failed delivery but not a successful one. SQLite (rather than an in-process cache) is required because gunicorn runs multiple workers.

## Session status diagnostics

The gateway subscribes to `session.status` and logs WAHA's GOWS failure reasons (`LoggedOut`, `TemporaryBan`, `ClientOutdated`, `StreamReplaced`, `ConnectFailure`, `CATRefreshError`) including `payload.data.reason`. These are operational logs, not agent messages.

## Limits / non-goals

- No groups, channels, broadcasts, reactions, polls or presence.
- No 24h customer-service-window logic — that is specific to the Meta Cloud API gateway.
- One WAHA session per gateway instance.
- The adapter is stateless apart from the webhook-dedup SQLite file.

## License

[Apache-2.0](./LICENSE).

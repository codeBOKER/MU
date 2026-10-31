# my-agent

An AI chat agent built on the [Chasqui stack](https://github.com/chasqui-stack/chasqui)
(generated with `chasqui new`, stack v0.5.1).

| Path | Service | Run |
|------|---------|-----|
| `core/` | FastAPI + LangGraph + Postgres/pgvector — the agent | `make dev` (:8090) |
| `whatsapp/` | WhatsApp channel gateway (PyWa) | `make dev` (:8000) |
| `admin/` | Operator panel (React + Vite) | `npm run dev` (:5191) |

Configuration lives in each service's `.env` (written by the wizard): the
LLM provider/model, storage, and notifications are swappable there at any
time. `docker compose up` brings up Postgres + core + admin for
collaborators (`--profile gateway` adds the WhatsApp gateway).

Docs: [architecture](https://github.com/chasqui-stack/chasqui/blob/main/docs/ARCHITECTURE.md)
· [deploy (Kamal)](https://github.com/chasqui-stack/chasqui/blob/main/docs/DEPLOY.md)

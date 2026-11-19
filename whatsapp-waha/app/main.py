import asyncio
import hashlib
import hmac
import json
import logging
from contextlib import asynccontextmanager
from typing import Annotated

import sentry_sdk
from fastapi import FastAPI, Header, HTTPException, Request

from app.core.config import settings

if settings.sentry_dsn:
    sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)

from app.handlers.inbound import CHANNEL, process_event  # noqa: E402
from app.services.core_client import CoreClient  # noqa: E402
from app.services.dedup import DedupStore  # noqa: E402
from app.services.sender import (  # noqa: E402
    SendError,
    SendRequest,
    send_canonical,
)
from app.services.waha_client import WahaClient  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

core_client: CoreClient | None = None
waha_client: WahaClient | None = None
dedup_store: DedupStore | None = None
_background_tasks: set[asyncio.Task] = set()


async def _ensure_session_with_retry(waha: WahaClient) -> None:
    delays = (0, 2, 5, 10, 20, 30, 60)
    for delay in delays:
        if delay:
            await asyncio.sleep(delay)
        try:
            await waha.ensure_session(
                settings.waha_webhook_url or "", settings.waha_webhook_hmac_key
            )
            return
        except Exception as exc:
            logger.warning("Could not create WAHA session yet: %s", exc)
    logger.error(
        "WAHA session setup gave up — create it manually or check WAHA_API_KEY/"
        "WAHA_WEBHOOK_URL"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global core_client, waha_client, dedup_store
    core_client = CoreClient(
        base_url=settings.core_url, api_key=settings.internal_api_key
    )
    waha_client = WahaClient(
        base_url=settings.waha_base_url,
        api_key=settings.waha_api_key,
        session=settings.waha_session,
        timeout=settings.waha_request_timeout,
        media_timeout=settings.waha_media_timeout,
        voice_convert=settings.waha_voice_convert,
        max_media_bytes=settings.max_media_bytes,
    )
    dedup_store = DedupStore(
        settings.waha_dedup_db_path, settings.dedup_ttl_seconds
    )

    if settings.waha_auto_start_session and settings.waha_webhook_url:
        task = asyncio.create_task(_ensure_session_with_retry(waha_client))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)

    logger.info(
        "Chasqui WAHA gateway started — core=%s waha=%s session=%s",
        settings.core_url,
        settings.waha_base_url,
        settings.waha_session,
    )
    yield
    for task in list(_background_tasks):
        task.cancel()
    if waha_client:
        await waha_client.close()
    if core_client:
        await core_client.close()


app = FastAPI(
    title="Chasqui WAHA Gateway",
    description="Stateless WAHA (GOWS) WhatsApp channel adapter",
    version="0.1.0",
    lifespan=lifespan,
)


def get_core() -> CoreClient:
    if core_client is None:
        raise RuntimeError("CoreClient not initialized")
    return core_client


def get_waha() -> WahaClient:
    if waha_client is None:
        raise RuntimeError("WahaClient not initialized")
    return waha_client


def get_dedup() -> DedupStore:
    if dedup_store is None:
        raise RuntimeError("DedupStore not initialized")
    return dedup_store


def verify_webhook(
    raw_body: bytes, signature: str | None, algorithm: str | None
) -> bool:
    """Verify WAHA's HMAC-SHA512 signature over the RAW webhook body."""
    if not settings.waha_webhook_hmac_key:
        return True
    if not signature:
        return False
    algo = (algorithm or "sha512").strip().lower().replace("-", "")
    if algo not in ("sha512", "sha256"):
        return False
    signature = (
        signature.strip().lower().removeprefix("sha512=").removeprefix("sha256=")
    )
    expected = hmac.new(
        settings.waha_webhook_hmac_key.encode(),
        raw_body,
        getattr(hashlib, algo),
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.post("/webhook")
async def webhook(
    request: Request,
    x_webhook_hmac: Annotated[str | None, Header()] = None,
    x_webhook_hmac_algorithm: Annotated[str | None, Header()] = None,
):
    raw_body = await request.body()
    if not verify_webhook(raw_body, x_webhook_hmac, x_webhook_hmac_algorithm):
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid webhook signature"},
        )
    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_JSON", "message": "Webhook body is not JSON"},
        ) from exc
    if not isinstance(event, dict):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_EVENT", "message": "Webhook body must be an object"},
        )

    try:
        status = await process_event(
            event,
            raw_body,
            core=get_core(),
            waha=get_waha(),
            dedup=get_dedup(),
        )
    except Exception as exc:
        logger.exception("WAHA webhook processing failed")
        raise HTTPException(
            status_code=502,
            detail={
                "code": "PROCESSING_FAILED",
                "message": f"Could not process WAHA event: {exc}",
            },
        ) from exc
    return {"status": status}


@app.post("/send")
async def send_message(
    payload: SendRequest,
    x_internal_api_key: Annotated[str | None, Header()] = None,
):
    """Canonical outbound contract (ADR-004) — the mirror of the core's /ingest."""
    if settings.internal_api_key and x_internal_api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid internal API key"},
        )
    try:
        return await send_canonical(get_waha(), payload)
    except SendError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "chasqui-whatsapp-waha", "channel": CHANNEL}

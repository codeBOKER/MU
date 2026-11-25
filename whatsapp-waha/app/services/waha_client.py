"""Thin WAHA HTTP client — the only place that knows WAHA's REST shapes."""

import logging
from urllib.parse import quote, urljoin

import httpx

logger = logging.getLogger(__name__)


class WahaError(Exception):
    """A WAHA API call that did not succeed."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class WahaClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        session: str,
        timeout: float,
        media_timeout: float,
        voice_convert: bool,
        max_media_bytes: int,
    ):
        self.base_url = base_url.rstrip("/") + "/"
        self.session = session
        self.voice_convert = voice_convert
        self.max_media_bytes = max_media_bytes
        headers = {"X-Api-Key": api_key} if api_key else {}
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=timeout,
        )
        self.media_timeout = media_timeout

    async def close(self) -> None:
        await self.client.aclose()

    @staticmethod
    def _message_id(body: dict) -> str | None:
        value = body.get("id")
        if value is None and isinstance(body.get("_data"), dict):
            value = body["_data"].get("id")
        return str(value) if value is not None else None

    @staticmethod
    def _error_message(response: httpx.Response) -> str:
        fallback = f"WAHA API failed (HTTP {response.status_code})"
        try:
            body = response.json()
        except Exception:
            return response.text[:300] or fallback
        if isinstance(body, dict):
            for key in ("message", "error", "detail"):
                value = body.get(key)
                if isinstance(value, str) and value:
                    return value
                if isinstance(value, dict) and isinstance(value.get("message"), str):
                    return value["message"]
        return fallback

    async def _post(self, path: str, body: dict) -> dict:
        try:
            response = await self.client.post(path, json=body)
        except httpx.HTTPError as exc:
            raise WahaError(f"WAHA is unreachable: {exc}") from exc
        if response.status_code >= 400:
            raise WahaError(
                self._error_message(response), status_code=response.status_code
            )
        try:
            data = response.json()
        except Exception:
            return {}
        return data if isinstance(data, dict) else {}

    async def _get(
        self, path: str, params: dict | None = None
    ) -> dict | list | str | None:
        try:
            response = await self.client.get(path, params=params)
        except httpx.HTTPError as exc:
            logger.warning("WAHA request GET %s failed: %s", path, exc)
            return None
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            logger.warning(
                "WAHA GET %s returned %s: %s",
                path,
                response.status_code,
                self._error_message(response),
            )
            return None
        try:
            return response.json()
        except Exception:
            text = response.text.strip()
            return text if text else None

    async def get_lid_pn(self, lid: str) -> str | None:
        """Resolve an @lid to its phone number JID (@c.us), or None."""
        if not lid or not lid.lower().endswith("@lid"):
            return None
        encoded_lid = quote(lid, safe="")
        data = await self._get(f"/api/{self.session}/lids/{encoded_lid}")
        if isinstance(data, dict):
            pn = data.get("pn") or data.get("phoneNumber") or data.get("id")
            if isinstance(pn, str) and pn.strip():
                return pn.strip()
        elif isinstance(data, str) and data.strip():
            return data.strip()
        return None

    async def get_contact(self, contact_id: str) -> dict | None:
        """Fetch contact details from WAHA contacts API."""
        if not contact_id:
            return None
        data = await self._get(
            "/api/contacts",
            params={"contactId": contact_id, "session": self.session},
        )
        if isinstance(data, dict):
            return data
        if isinstance(data, list) and data and isinstance(data[0], dict):
            return data[0]
        return None

    async def ensure_session(self, webhook_url: str, hmac_key: str) -> None:
        """Create + start the configured session if it does not exist yet.

        Best-effort setup: callers log and continue when WAHA is not up yet.
        Existing sessions are left untouched (recreating would log the user
        out); change their webhook in the WAHA dashboard instead.
        """
        try:
            existing = await self.client.get(f"/api/sessions/{self.session}")
        except httpx.HTTPError as exc:
            raise WahaError(f"WAHA is unreachable: {exc}") from exc
        if existing.status_code == 200:
            logger.info("WAHA session '%s' already exists", self.session)
            return
        if existing.status_code in (401, 403):
            raise WahaError(
                self._error_message(existing), status_code=existing.status_code
            )
        if existing.status_code != 404:
            raise WahaError(
                self._error_message(existing), status_code=existing.status_code
            )

        webhook: dict = {
            "url": webhook_url,
            "events": ["message", "session.status"],
            "retries": {"policy": "constant", "delaySeconds": 2, "attempts": 15},
        }
        if hmac_key:
            webhook["hmac"] = {"key": hmac_key}
        body = {
            "name": self.session,
            "start": True,
            "config": {"webhooks": [webhook]},
        }
        created = await self._post("/api/sessions", body)
        logger.info(
            "WAHA session '%s' created (status=%s)",
            self.session,
            created.get("status"),
        )

    async def send_text(self, chat_id: str, text: str) -> dict:
        return await self._post(
            "/api/sendText",
            {"session": self.session, "chatId": chat_id, "text": text},
        )

    async def send_image(
        self,
        chat_id: str,
        *,
        data: str,
        mimetype: str,
        filename: str,
        caption: str | None,
    ) -> dict:
        body: dict = {
            "session": self.session,
            "chatId": chat_id,
            "file": {"mimetype": mimetype, "filename": filename, "data": data},
        }
        if caption:
            body["caption"] = caption
        return await self._post("/api/sendImage", body)

    async def send_document(
        self,
        chat_id: str,
        *,
        data: str,
        mimetype: str,
        filename: str,
        caption: str | None,
    ) -> dict:
        body: dict = {
            "session": self.session,
            "chatId": chat_id,
            "file": {"mimetype": mimetype, "filename": filename, "data": data},
        }
        if caption:
            body["caption"] = caption
        return await self._post("/api/sendFile", body)

    async def send_voice(
        self,
        chat_id: str,
        *,
        data: str,
        mimetype: str,
        filename: str,
    ) -> dict:
        return await self._post(
            "/api/sendVoice",
            {
                "session": self.session,
                "chatId": chat_id,
                "file": {"mimetype": mimetype, "filename": filename, "data": data},
                "convert": self.voice_convert,
            },
        )

    async def download_media(self, url: str) -> tuple[bytes, str] | None:
        """Download a WAHA media object (API-key protected), bounded in size."""
        target = urljoin(self.base_url, url)
        try:
            async with self.client.stream(
                "GET", target, timeout=self.media_timeout
            ) as response:
                if response.status_code >= 400:
                    logger.warning(
                        "WAHA media download failed (HTTP %s): %s",
                        response.status_code,
                        target,
                    )
                    return None
                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > self.max_media_bytes:
                        logger.warning(
                            "WAHA media too large (>%d bytes): %s",
                            self.max_media_bytes,
                            target,
                        )
                        return None
                    chunks.append(chunk)
                mime = response.headers.get("content-type", "application/octet-stream")
                return b"".join(chunks), mime.split(";", 1)[0].strip()
        except httpx.HTTPError as exc:
            logger.warning("WAHA media download failed: %s", exc)
            return None

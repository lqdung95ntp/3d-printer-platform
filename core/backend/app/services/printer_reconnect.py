"""Backend retry worker for active printers that are offline or missing a client."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from typing import Any

from sqlalchemy import select

from backend.app.models.printer import Printer
from backend.app.services.printer_manager import printer_manager
from backend.app.services.printer_providers.factory import MOONRAKER_PROVIDERS, normalize_provider

logger = logging.getLogger(__name__)

DEFAULT_RECONNECT_INTERVAL_SECONDS = 30
STARTUP_RECONNECT_GRACE_SECONDS = 60


class PrinterReconnectService:
    """Reconnect active offline printers without relying on an open browser tab."""

    def __init__(self, printer_manager: Any, session_factory: Callable[[], Any] | None) -> None:
        self._printer_manager = printer_manager
        self._session_factory = session_factory
        self._task: asyncio.Task[None] | None = None
        self.next_attempt_at: dict[int, float] = {}
        # Initial printer connections are asynchronous. Do not immediately
        # replace a client that is still negotiating its MQTT session.
        self._reconnect_not_before = 0.0

    def set_session_factory(self, session_factory: Callable[[], Any]) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _interval_seconds(printer: Any) -> int:
        value = getattr(printer, "reconnect_interval_seconds", DEFAULT_RECONNECT_INTERVAL_SECONDS)
        try:
            return max(10, min(int(value), 3600))
        except (TypeError, ValueError):
            return DEFAULT_RECONNECT_INTERVAL_SECONDS

    def _needs_reconnect(self, printer: Any) -> bool:
        client = self._printer_manager.get_client(printer.id)
        if client is None:
            return True

        # BambuMQTTClient uses Paho's own reconnect loop. Replacing an existing
        # disconnected client can synchronously stop Paho's network thread and
        # stall the FastAPI event loop, taking the WebUI down with it.
        if normalize_provider(getattr(printer, "provider", None)) == "bambu":
            return False

        return not bool(getattr(getattr(client, "state", None), "connected", False))

    async def reconnect_due_printers(
        self,
        printers: list[Any],
        *,
        now: float | None = None,
        db: Any = None,
    ) -> None:
        """Attempt due active offline printers once; suitable for deterministic tests."""
        current = time.monotonic() if now is None else now
        if current < self._reconnect_not_before:
            return

        active_ids = {printer.id for printer in printers if getattr(printer, "is_active", False)}
        for printer_id in tuple(self.next_attempt_at):
            if printer_id not in active_ids:
                self.next_attempt_at.pop(printer_id, None)

        for printer in printers:
            if not getattr(printer, "is_active", False):
                continue
            if not self._needs_reconnect(printer):
                self.next_attempt_at.pop(printer.id, None)
                if db is not None and normalize_provider(getattr(printer, "provider", None)) in MOONRAKER_PROVIDERS:
                    await self._sync_moonraker_hardware_info(printer, db)
                continue
            if current < self.next_attempt_at.get(printer.id, 0):
                continue

            interval = self._interval_seconds(printer)
            self.next_attempt_at[printer.id] = current + interval
            connected = False
            try:
                connected = await self._printer_manager.connect_printer(printer)
                if connected:
                    logger.info("Recovered printer connection: %s (id=%s)", printer.name, printer.id)
                else:
                    logger.debug("Printer reconnect did not complete yet: %s (id=%s)", printer.name, printer.id)
            except Exception as exc:  # noqa: BLE001 - one offline printer must never stop the worker
                connected = False
                logger.debug(
                    "Printer reconnect failed for %s (id=%s): %s", printer.name, printer.id, type(exc).__name__
                )

            # If connecting to the current IP failed, check if this is a Moonraker printer
            # whose IP address changed (e.g. DHCP lease renewal)
            if not connected and db is not None:
                provider = normalize_provider(getattr(printer, "provider", None))
                if provider in MOONRAKER_PROVIDERS:
                    await self._attempt_moonraker_recovery(printer, printers, db)
            elif connected and db is not None:
                provider = normalize_provider(getattr(printer, "provider", None))
                if provider in MOONRAKER_PROVIDERS:
                    await self._sync_moonraker_hardware_info(printer, db)

    async def _attempt_moonraker_recovery(self, printer: Any, printers: list[Any], db: Any) -> bool:
        """Attempt to auto-discover and recover a Moonraker printer whose IP address changed."""
        try:
            from backend.app.services.discovery import resolve_moonraker_printer
            from backend.app.services.elegoo_camera import build_snapmaker_u1_camera_url, is_snapmaker_u1_printer

            known_ips = {
                str(getattr(p, "ip_address", "") or "")
                for p in printers
                if getattr(p, "id", None) != getattr(printer, "id", None)
                and getattr(p, "is_active", False)
            }
            known_ips.discard("")

            hit = await resolve_moonraker_printer(
                serial_number=getattr(printer, "serial_number", None),
                model=getattr(printer, "model", None),
                current_ip=getattr(printer, "ip_address", None),
                known_ips=known_ips,
            )
            if not hit:
                return False

            new_ip = hit["ip_address"]
            new_api_url = hit["api_url"]
            new_serial = hit.get("serial_number")

            if new_ip == getattr(printer, "ip_address", None) and new_api_url == getattr(printer, "api_url", None):
                return False

            old_ip = getattr(printer, "ip_address", None)
            logger.warning(
                "Printer %s (id=%s) IP changed from %s to %s. Auto-updating database and reconnecting.",
                getattr(printer, "name", getattr(printer, "id", "unknown")),
                getattr(printer, "id", "unknown"),
                old_ip,
                new_ip,
            )

            printer.ip_address = new_ip
            printer.api_url = new_api_url
            if new_serial:
                curr_serial = str(getattr(printer, "serial_number", "") or "")
                if not curr_serial or curr_serial.startswith("KLIPPER-"):
                    printer.serial_number = new_serial

            # For Snapmaker U1, update camera URL if it contained the old IP
            if is_snapmaker_u1_printer(printer):
                curr_cam = getattr(printer, "external_camera_url", None)
                if curr_cam and old_ip and old_ip in curr_cam:
                    printer.external_camera_url = curr_cam.replace(old_ip, new_ip)
                elif not curr_cam:
                    printer.external_camera_url = build_snapmaker_u1_camera_url(new_ip)

            db.add(printer)
            await db.commit()
            if hasattr(db, "refresh"):
                await db.refresh(printer)

            # Reconnect on the newly discovered IP
            connected = await self._printer_manager.connect_printer(printer)
            if connected:
                logger.info(
                    "Auto-recovered and successfully connected printer %s on new IP %s",
                    getattr(printer, "name", printer.id),
                    new_ip,
                )
                return True
            return False
        except Exception as exc:
            logger.warning("Moonraker IP recovery failed for printer %s: %s", getattr(printer, "id", "unknown"), exc)
            return False

    async def _sync_moonraker_hardware_info(self, printer: Any, db: Any) -> None:
        """Upgrade placeholder serial numbers to real hardware serial numbers once connected."""
        try:
            curr_serial = str(getattr(printer, "serial_number", "") or "")
            if curr_serial and not curr_serial.startswith("KLIPPER-"):
                return

            client = self._printer_manager.get_client(getattr(printer, "id", None))
            if client and hasattr(client, "get_hardware_identifiers"):
                hw_info = client.get_hardware_identifiers()
                real_serial = hw_info.get("serial_number")
                if real_serial and real_serial != curr_serial:
                    logger.info(
                        "Upgraded printer %s (id=%s) serial from '%s' to real hardware serial '%s'",
                        getattr(printer, "name", printer.id),
                        getattr(printer, "id", "unknown"),
                        curr_serial,
                        real_serial,
                    )
                    printer.serial_number = real_serial
                    db.add(printer)
                    await db.commit()
        except Exception as exc:
            logger.debug("Failed to sync Moonraker hardware info: %s", exc)

    async def _run(self) -> None:
        assert self._session_factory is not None
        while True:
            try:
                async with self._session_factory() as db:
                    printers = (await db.scalars(select(Printer).where(Printer.is_active.is_(True)))).all()
                    await self.reconnect_due_printers(printers, db=db)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - keep recovery available after transient DB errors
                logger.warning("Printer reconnect worker cycle failed: %s", type(exc).__name__)
            await asyncio.sleep(1)

    def start(self) -> None:
        if self._task is None or self._task.done():
            if self._session_factory is None:
                raise RuntimeError("PrinterReconnectService requires a session factory")
            self._reconnect_not_before = time.monotonic() + STARTUP_RECONNECT_GRACE_SECONDS
            self._task = asyncio.create_task(self._run(), name="printer-reconnect-worker")
            logger.info(
                "Printer reconnect worker started; delaying retries for %ss while initial connections settle",
                STARTUP_RECONNECT_GRACE_SECONDS,
            )

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None
        self.next_attempt_at.clear()
        logger.info("Printer reconnect worker stopped")


printer_reconnect_service = PrinterReconnectService(
    printer_manager=printer_manager,
    session_factory=None,
)


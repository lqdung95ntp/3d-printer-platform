"""Elegoo SDCP camera helpers.

Centauri Carbon exposes its LAN camera as an MJPEG stream on port 3031.
Keep this separate from the SDCP WebSocket/status client: camera streaming is
HTTP/MJPEG and should reuse Printbuddy's existing external-camera pipeline.
"""

from __future__ import annotations

import asyncio
import json
import logging
import socket
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlparse

logger = logging.getLogger(__name__)

ELEGOO_SDCP_PROVIDER = "elegoo_sdcp"
ELEGOO_SDCP_CAMERA_PORT = 3031
ELEGOO_SDCP_CAMERA_PATH = "/video"
ELEGOO_SDCP_CAMERA_TYPE = "mjpeg"
ELEGOO_SDCP_WS_PORT = 3030
ELEGOO_SDCP_DISCOVERY_PORT = 3000
ELEGOO_SDCP_DISCOVERY_MESSAGE = b"M99999"
ELEGOO_SDCP_STATUS_COMMAND = 0

MOONRAKER_CAMERA_PROVIDERS = {"klipper", "mainsail", "fluidd", "moonraker"}
SNAPMAKER_U1_DEFAULT_PORT = 7125
SNAPMAKER_U1_CAMERA_PATH = "/server/files/camera/monitor.jpg"
SNAPMAKER_U1_CAMERA_TYPE = "snapshot"
CREALITY_WEBRTC_PORT = 8000
CREALITY_WEBRTC_K2_PATH = "/call/webrtc_local"
CREALITY_WEBRTC_ROOT_PATH = "/call"
CREALITY_GO2RTC_OPTION_KEYS = (
    "go2rtc_url",
    "go2rtc_base_url",
    "creality_go2rtc_url",
    "creality_go2rtc_base_url",
)
CREALITY_K2_MODEL_VERSION_CODES = {"F008", "F012", "F021"}


@dataclass(frozen=True)
class ElegooCameraActivationInfo:
    printer_id: str | None = None
    mainboard_id: str | None = None


@dataclass(frozen=True)
class EffectiveCameraSource:
    enabled: bool
    url: str | None
    camera_type: str | None
    snapshot_url: str | None = None
    derived: bool = False


def is_elegoo_sdcp_provider(provider: object) -> bool:
    return str(provider or "").strip().lower() == ELEGOO_SDCP_PROVIDER


def is_elegoo_sdcp_camera_source(provider: object, camera_url: object) -> bool:
    """Return True when a camera URL should use CC1 SDCP activation.

    Existing printers may have the validated ``http://<ip>:3031/video`` URL
    persisted as a manual external camera. Manual config is not marked as
    ``derived``, but the Centauri Carbon endpoint still requires the SDCP
    WebSocket activation session before JPEG frames are produced.
    """
    if not is_elegoo_sdcp_provider(provider):
        return False
    raw = str(camera_url or "").strip()
    if not raw:
        return False
    try:
        parsed = urlparse(raw)
    except Exception:
        return False
    return (
        parsed.scheme in {"http", "https"}
        and parsed.port == ELEGOO_SDCP_CAMERA_PORT
        and parsed.path.rstrip("/") == ELEGOO_SDCP_CAMERA_PATH
    )


def build_elegoo_sdcp_camera_url(ip_address: object) -> str | None:
    host = str(ip_address or "").strip()
    if not host:
        return None
    return f"http://{host}:{ELEGOO_SDCP_CAMERA_PORT}{ELEGOO_SDCP_CAMERA_PATH}"


def is_snapmaker_u1_printer(printer: Any) -> bool:
    """Return True if the printer is a Snapmaker U1 model."""
    if printer is None:
        return False
    if isinstance(printer, dict):
        model = str(printer.get("model") or "").strip().lower()
        name = str(printer.get("name") or "").strip().lower()
    else:
        model = str(getattr(printer, "model", None) or "").strip().lower()
        name = str(getattr(printer, "name", None) or "").strip().lower()

    if ("snapmaker" in model and "u1" in model) or model == "u1":
        return True
    if "snapmaker" in name and "u1" in name:
        return True

    options = _provider_options_dict(printer)
    opt_model = str(options.get("model") or options.get("printer_model") or "").strip().lower()
    if ("snapmaker" in opt_model and "u1" in opt_model) or opt_model == "u1":
        return True
    return False


def is_snapmaker_u1_camera_source(printer: Any, camera_url: object) -> bool:
    """Return True when a camera URL / printer should use Snapmaker U1 WebSocket activation."""
    if is_snapmaker_u1_printer(printer):
        return True
    raw = str(camera_url or "").strip().lower()
    return SNAPMAKER_U1_CAMERA_PATH.lower() in raw


def _resolve_snapmaker_host_and_port(printer_or_host: object, port: int | None = None) -> tuple[str, int]:
    default_port = port or SNAPMAKER_U1_DEFAULT_PORT
    if isinstance(printer_or_host, str):
        host = _normalize_host(printer_or_host)
        return host, default_port

    api_url = str(getattr(printer_or_host, "api_url", None) or "").strip()
    if api_url:
        parsed = urlparse(api_url if "://" in api_url else f"http://{api_url}")
        host = parsed.hostname or _normalize_host(getattr(printer_or_host, "ip_address", None))
        resolved_port = parsed.port or default_port
        return host or "", resolved_port

    host = _normalize_host(getattr(printer_or_host, "ip_address", None))
    return host or "", default_port


def build_snapmaker_u1_camera_url(ip_address: object, port: int = SNAPMAKER_U1_DEFAULT_PORT) -> str | None:
    host = _normalize_host(ip_address)
    if not host:
        return None
    return f"http://{host}:{port}{SNAPMAKER_U1_CAMERA_PATH}"


def _provider_options_dict(printer: Any) -> dict[str, Any]:
    raw = getattr(printer, "provider_options", None)
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else {}
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _option_first(options: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = str(options.get(key) or "").strip()
        if value:
            return value
    return ""


def _truthy_webrtc_support(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    raw = str(value or "").strip().lower()
    return raw in {"1", "true", "yes", "on", "supported", "webrtc"}


def _creality_model_values(printer: Any, options: dict[str, Any]) -> tuple[str, str]:
    model = str(
        getattr(printer, "model", None)
        or options.get("model")
        or options.get("printer_model")
        or options.get("printerModel")
        or ""
    ).strip()
    model_version = str(
        options.get("modelVersion")
        or options.get("model_version")
        or options.get("printer_model_version")
        or options.get("printerModelVersion")
        or ""
    ).strip()
    return model, model_version


def _is_creality_k2_family(model: str, model_version: str) -> bool:
    model_l = model.lower()
    version_u = model_version.upper()
    return "k2" in model_l or any(
        code in version_u or code in model.upper() for code in CREALITY_K2_MODEL_VERSION_CODES
    )


def _creality_webrtc_provider_camera_source(printer: Any) -> EffectiveCameraSource | None:
    """Derive Creality K2/K1C WebRTC camera through a configured go2rtc service.

    Creality's K2-family camera endpoint speaks JSON-wrapped SDP rather than a
    normal MJPEG/RTSP stream. Printbuddy's camera pipeline already consumes MJPEG
    and snapshots, so use go2rtc's HTTP endpoints as the bridge when the printer
    is identified as WebRTC-capable and a go2rtc base URL is configured in
    provider_options.
    """

    provider = str(getattr(printer, "provider", None) or "").strip().lower()
    if provider not in MOONRAKER_CAMERA_PROVIDERS:
        return None

    options = _provider_options_dict(printer)
    go2rtc_base = _option_first(options, CREALITY_GO2RTC_OPTION_KEYS).rstrip("/")
    if not go2rtc_base:
        return None

    model, model_version = _creality_model_values(printer, options)
    is_k2 = _is_creality_k2_family(model, model_version)
    supports_webrtc = _truthy_webrtc_support(
        options.get("webrtcSupport")
        or options.get("webrtc_support")
        or options.get("supports_webrtc")
        or options.get("camera_webrtc")
    )
    if not (is_k2 or supports_webrtc):
        return None

    host = _normalize_host(getattr(printer, "ip_address", None) or getattr(printer, "api_url", None))
    if not host:
        return None

    configured_path = str(options.get("creality_webrtc_path") or options.get("webrtc_path") or "").strip()
    path = configured_path or (CREALITY_WEBRTC_K2_PATH if is_k2 else CREALITY_WEBRTC_ROOT_PATH)
    if not path.startswith("/"):
        path = f"/{path}"

    upstream = f"webrtc:http://{host}:{CREALITY_WEBRTC_PORT}{path}#format=creality"
    encoded_src = quote(upstream, safe="")
    return EffectiveCameraSource(
        enabled=True,
        url=f"{go2rtc_base}/api/stream.mjpeg?src={encoded_src}",
        camera_type="mjpeg",
        snapshot_url=f"{go2rtc_base}/api/frame.jpeg?src={encoded_src}",
        derived=True,
    )


def _prusalink_provider_camera_source(printer: Any) -> EffectiveCameraSource | None:
    """Return a PrusaLink camera source declared in provider_options.

    PrusaLink/Core One firmware variants do not expose one stable documented
    snapshot URL that we can safely derive from ``api_url`` alone. However,
    integrations and imports can already know the correct local camera endpoint.
    Let them declare it beside the PrusaLink auth options so existing rows do not
    need the manual external-camera toggle before finish/progress notifications
    can attach images.
    """

    if str(getattr(printer, "provider", None) or "").strip().lower() != "prusalink":
        return None

    options = _provider_options_dict(printer)
    camera_url = str(
        options.get("camera_url")
        or options.get("prusalink_camera_url")
        or options.get("snapshot_url")
        or options.get("prusalink_snapshot_url")
        or ""
    ).strip()
    if not camera_url:
        return None

    snapshot_url = str(options.get("camera_snapshot_url") or options.get("prusalink_camera_snapshot_url") or "").strip()
    camera_type = str(options.get("camera_type") or options.get("prusalink_camera_type") or "").strip().lower()
    if camera_type not in {"mjpeg", "rtsp", "snapshot", "usb"}:
        normalized = camera_url.lower().split("?", 1)[0]
        if normalized.startswith(("rtsp://", "rtsps://")):
            camera_type = "rtsp"
        elif any(token in normalized for token in ("/snapshot", "/frame")) or normalized.endswith(
            (".jpg", ".jpeg", ".png", ".webp")
        ):
            camera_type = "snapshot"
        else:
            camera_type = "mjpeg"

    return EffectiveCameraSource(
        enabled=True,
        url=camera_url,
        camera_type=camera_type,
        snapshot_url=snapshot_url or None,
        derived=True,
    )


def get_effective_camera_source(printer: Any) -> EffectiveCameraSource:
    """Return the camera source Printbuddy should use for a printer.

    Manual external-camera configuration wins. Existing Elegoo SDCP printer rows
    normally predate camera support and have no external camera URL persisted;
    for those, derive the validated CC1 MJPEG endpoint from the printer IP.
    """

    configured_enabled = bool(getattr(printer, "external_camera_enabled", False))
    configured_url = str(getattr(printer, "external_camera_url", None) or "").strip()
    configured_type = str(getattr(printer, "external_camera_type", None) or "").strip() or None
    configured_snapshot_url = getattr(printer, "external_camera_snapshot_url", None)

    if configured_enabled and configured_url:
        fallback_type = SNAPMAKER_U1_CAMERA_TYPE if is_snapmaker_u1_printer(printer) else ELEGOO_SDCP_CAMERA_TYPE
        return EffectiveCameraSource(
            enabled=True,
            url=configured_url,
            camera_type=configured_type or fallback_type,
            snapshot_url=configured_snapshot_url or (configured_url if (configured_type or fallback_type) == "snapshot" else None),
            derived=False,
        )

    prusalink_camera = _prusalink_provider_camera_source(printer)
    if prusalink_camera:
        return prusalink_camera

    creality_webrtc_camera = _creality_webrtc_provider_camera_source(printer)
    if creality_webrtc_camera:
        return creality_webrtc_camera

    if is_snapmaker_u1_printer(printer):
        _, port = _resolve_snapmaker_host_and_port(printer)
        derived_url = build_snapmaker_u1_camera_url(getattr(printer, "ip_address", None), port=port)
        if derived_url:
            return EffectiveCameraSource(
                enabled=True,
                url=derived_url,
                camera_type=SNAPMAKER_U1_CAMERA_TYPE,
                snapshot_url=derived_url,
                derived=True,
            )

    if is_elegoo_sdcp_provider(getattr(printer, "provider", None)):
        derived_url = build_elegoo_sdcp_camera_url(getattr(printer, "ip_address", None))
        if derived_url:
            return EffectiveCameraSource(
                enabled=True,
                url=derived_url,
                camera_type=ELEGOO_SDCP_CAMERA_TYPE,
                snapshot_url=None,
                derived=True,
            )

    return EffectiveCameraSource(
        enabled=False,
        url=None,
        camera_type=configured_type,
        snapshot_url=configured_snapshot_url,
        derived=False,
    )


def _normalize_host(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if "://" in raw:
        from urllib.parse import urlparse

        parsed = urlparse(raw)
        return (parsed.hostname or raw).strip("[]")
    return raw.strip("[]")


def _discover_elegoo_camera_activation_info(host: str, timeout: float = 2.0) -> ElegooCameraActivationInfo:
    """Best-effort UDP discovery for IDs used by SDCP WebSocket commands."""
    host = _normalize_host(host)
    if not host:
        return ElegooCameraActivationInfo()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(timeout)
            sock.sendto(ELEGOO_SDCP_DISCOVERY_MESSAGE, (host, ELEGOO_SDCP_DISCOVERY_PORT))
            payload, _addr = sock.recvfrom(65535)
        data = json.loads(payload.decode("utf-8", errors="replace").strip("\x00\r\n "))
        if not isinstance(data, dict):
            return ElegooCameraActivationInfo()
        nested_data = data.get("Data") if isinstance(data.get("Data"), dict) else {}
        printer_id = (
            str(data.get("Id") or data.get("id") or nested_data.get("Id") or nested_data.get("id") or "").strip()
            or None
        )
        mainboard_id = (
            str(
                nested_data.get("MainboardID")
                or nested_data.get("MainboardId")
                or data.get("MainboardID")
                or data.get("MainboardId")
                or nested_data.get("Id")
                or nested_data.get("id")
                or data.get("Id")
                or data.get("id")
                or ""
            ).strip()
            or None
        )
        return ElegooCameraActivationInfo(printer_id=printer_id, mainboard_id=mainboard_id)
    except Exception as exc:  # noqa: BLE001 - discovery is optional in Docker/HA networks
        logger.debug("Elegoo camera activation discovery failed for %s: %s", host, type(exc).__name__)
        return ElegooCameraActivationInfo()


def build_elegoo_sdcp_status_command(info: ElegooCameraActivationInfo | None = None) -> dict[str, Any]:
    """Build the lightweight SDCP status request used to activate camera output."""
    info = info or ElegooCameraActivationInfo()
    request_id = str(int(time.time() * 1000))
    command: dict[str, Any] = {
        "Id": info.printer_id or "",
        "Data": {
            "Cmd": ELEGOO_SDCP_STATUS_COMMAND,
            "Data": {},
            "From": 0,
            "MainboardID": info.mainboard_id or "",
            "RequestID": request_id,
            "Timestamp": int(time.time()),
        },
    }
    if info.mainboard_id:
        command["Topic"] = f"sdcp/request/{info.mainboard_id}"
    return command


async def capture_elegoo_sdcp_activated_frame(
    host: object,
    camera_url: str,
    camera_type: str = ELEGOO_SDCP_CAMERA_TYPE,
    *,
    timeout: float = 15.0,
    snapshot_url: str | None = None,
    activation_warmup: float = 0.75,
) -> bytes | None:
    """Capture one CC1 MJPEG frame while holding the SDCP activation session open.

    The Centauri Carbon may expose ``:3031/video`` headers but withhold JPEG
    frames until a WebSocket status session is active. Fresh snapshot callers do
    not have the route-level fan-out activation task, so wrap the one-shot
    capture with the same lightweight activation used by live view.
    """
    disconnect_event = asyncio.Event()
    activation_task = asyncio.create_task(keep_elegoo_sdcp_camera_session(host, disconnect_event))
    try:
        if activation_warmup > 0:
            await asyncio.sleep(activation_warmup)
        from backend.app.services.external_camera import capture_frame

        return await capture_frame(
            camera_url,
            camera_type or ELEGOO_SDCP_CAMERA_TYPE,
            timeout=timeout,
            snapshot_url=snapshot_url,
        )
    finally:
        disconnect_event.set()
        try:
            await asyncio.wait_for(activation_task, timeout=2.0)
        except TimeoutError:
            activation_task.cancel()
            try:
                await activation_task
            except asyncio.CancelledError:
                pass
        except asyncio.CancelledError:
            pass


async def keep_elegoo_sdcp_camera_session(
    host: object,
    disconnect_event: asyncio.Event,
    *,
    discovery_timeout: float = 2.0,
    heartbeat_interval: float = 20.0,
) -> None:
    """Keep a WebSocket session open while reading the CC1 MJPEG endpoint.

    The Centauri Carbon's ``:3031/video`` endpoint returns MJPEG headers even
    when no camera frames are being produced. Opening the printer web UI starts
    a persistent ``ws://<host>:3030/websocket`` session and then frames appear.
    Mirror that behaviour for Printbuddy: hold a lightweight SDCP status session
    open for the lifetime of the MJPEG upstream and periodically refresh it.
    """
    normalized_host = _normalize_host(host)
    if not normalized_host:
        return

    info = await asyncio.to_thread(_discover_elegoo_camera_activation_info, normalized_host, discovery_timeout)
    ws_host = (
        f"[{normalized_host}]" if ":" in normalized_host and not normalized_host.startswith("[") else normalized_host
    )
    websocket_url = f"ws://{ws_host}:{ELEGOO_SDCP_WS_PORT}/websocket"

    try:
        import websockets

        async with websockets.connect(websocket_url, open_timeout=5, close_timeout=1) as websocket:
            logger.info("Elegoo SDCP camera activation session opened for %s", normalized_host)
            while not disconnect_event.is_set():
                command = build_elegoo_sdcp_status_command(info)
                await websocket.send(json.dumps(command, separators=(",", ":")))
                try:
                    await asyncio.wait_for(disconnect_event.wait(), timeout=heartbeat_interval)
                except TimeoutError:
                    # Keep session warm and refresh status command.
                    continue
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001 - camera stream can still try without activation
        logger.warning("Elegoo SDCP camera activation session failed for %s: %s", normalized_host, exc)
    finally:
        logger.info("Elegoo SDCP camera activation session closed for %s", normalized_host)


async def capture_snapmaker_u1_activated_frame(
    printer_or_host: object,
    camera_url: str,
    camera_type: str = SNAPMAKER_U1_CAMERA_TYPE,
    *,
    timeout: float = 15.0,
    snapshot_url: str | None = None,
    activation_warmup: float = 0.5,
) -> bytes | None:
    """Capture one Snapmaker U1 camera frame while holding the activation session open."""
    disconnect_event = asyncio.Event()
    activation_task = asyncio.create_task(keep_snapmaker_u1_camera_session(printer_or_host, disconnect_event))
    try:
        if activation_warmup > 0:
            await asyncio.sleep(activation_warmup)
        from backend.app.services.external_camera import capture_frame

        return await capture_frame(
            camera_url,
            camera_type or SNAPMAKER_U1_CAMERA_TYPE,
            timeout=timeout,
            snapshot_url=snapshot_url or camera_url,
        )
    finally:
        disconnect_event.set()
        try:
            await asyncio.wait_for(activation_task, timeout=2.0)
        except TimeoutError:
            activation_task.cancel()
            try:
                await activation_task
            except asyncio.CancelledError:
                pass
        except asyncio.CancelledError:
            pass


async def keep_snapmaker_u1_camera_session(
    printer_or_host: object,
    disconnect_event: asyncio.Event,
    *,
    port: int | None = None,
    heartbeat_interval: float = 15.0,
) -> None:
    """Keep a Moonraker WebSocket session open and active with camera.start_monitor.

    Snapmaker U1's unisrv daemon captures frames only when camera.start_monitor
    is active over JSON-RPC. It writes frames to /tmp/.monitor.jpg (exposed via
    Moonraker at /server/files/camera/monitor.jpg). When done, sending
    camera.stop_monitor puts unisrv back to idle to conserve CPU/power.
    """
    host, resolved_port = _resolve_snapmaker_host_and_port(printer_or_host, port)
    if not host:
        return

    ws_host = f"[{host}]" if ":" in host and not host.startswith("[") else host
    websocket_url = f"ws://{ws_host}:{resolved_port}/websocket"

    start_msg = json.dumps({
        "jsonrpc": "2.0",
        "method": "camera.start_monitor",
        "params": {"domain": "lan", "interval": 0},
        "id": 1,
    })
    stop_msg = json.dumps({
        "jsonrpc": "2.0",
        "method": "camera.stop_monitor",
        "params": {"domain": "lan"},
        "id": 2,
    })

    try:
        import websockets

        async with websockets.connect(websocket_url, open_timeout=5, close_timeout=2) as websocket:
            logger.info("Snapmaker U1 camera activation session opened for %s:%s", host, resolved_port)
            await websocket.send(start_msg)

            while not disconnect_event.is_set():
                try:
                    await asyncio.wait_for(disconnect_event.wait(), timeout=heartbeat_interval)
                except TimeoutError:
                    try:
                        await websocket.ping()
                    except Exception:
                        pass
                    continue

            try:
                await websocket.send(stop_msg)
                await asyncio.sleep(0.1)
            except Exception:
                pass
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("Snapmaker U1 camera activation session failed for %s:%s: %s", host, resolved_port, exc)
    finally:
        logger.info("Snapmaker U1 camera activation session closed for %s:%s", host, resolved_port)


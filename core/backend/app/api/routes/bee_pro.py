import os
import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/pro", tags=["Bee Pro Proxy"])

BEE_PRO_URL = os.environ.get("BEE_PRO_URL", "http://localhost:8001").rstrip("/")

_HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
}


def _clean_proxy_headers(raw_headers: httpx.Headers) -> dict[str, str]:
    return {k: v for k, v in raw_headers.items() if k.lower() not in _HOP_BY_HOP_HEADERS}


@router.get("/status")
async def get_pro_status():
    """Proxy status check to Pro Sidecar or return Community fallback."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(f"{BEE_PRO_URL}/pro/api/v1/status")
            if res.status_code == 200:
                return res.json()
    except Exception:
        pass
    return {
        "sidecar_version": "Offline",
        "license": {
            "is_active": False,
            "plan": "community",
            "customer": "Community User",
            "max_printers": 3,
            "message": "Bee Pro Sidecar is offline. Running in Community Edition.",
            "features": ["basic_monitoring", "basic_queue"],
        },
        "engines": {
            "auto_swap_pei": False,
            "smart_power": False,
            "xiaozhi_voice": False,
        },
    }


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_to_pro(request: Request, path: str):
    """Proxy all other /api/v1/pro/* calls to the Pro Sidecar."""
    url = f"{BEE_PRO_URL}/pro/api/v1/{path}"
    headers = dict(request.headers)
    headers.pop("host", None)
    body = await request.body()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=request.query_params,
                content=body,
            )
            return Response(
                content=res.content,
                status_code=res.status_code,
                headers=_clean_proxy_headers(res.headers),
                media_type=res.headers.get("content-type"),
            )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"detail": f"Bee Pro Sidecar service unavailable: {str(e)}"},
        )


# =============================================================================
# Xiaozhi AI Voice Gateway Proxy Router (/api/v1/xiaozhi/*)
# =============================================================================

xiaozhi_router = APIRouter(prefix="/xiaozhi", tags=["Xiaozhi Voice Proxy"])


@xiaozhi_router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_to_xiaozhi(request: Request, path: str):
    """Proxy all /api/v1/xiaozhi/* calls directly to the Pro Sidecar Voice Gateway."""
    url = f"{BEE_PRO_URL}/api/v1/xiaozhi/{path}"
    headers = dict(request.headers)
    headers.pop("host", None)
    body = await request.body()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=request.query_params,
                content=body,
            )
            return Response(
                content=res.content,
                status_code=res.status_code,
                headers=_clean_proxy_headers(res.headers),
                media_type=res.headers.get("content-type"),
            )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"detail": f"Xiaozhi Voice Gateway service unavailable: {str(e)}"},
        )

"""Unit tests for Moonraker/Klipper auto IP resolution."""

from unittest.mock import AsyncMock, patch

import pytest

from backend.app.services.discovery import resolve_moonraker_printer


@pytest.mark.asyncio
async def test_resolve_moonraker_printer_by_exact_serial():
    fake_system_info = {
        "status_code": 200,
        "json": lambda: {
            "result": {
                "system_info": {
                    "product_info": {
                        "machine_type": "Snapmaker U1",
                        "serial_number": "8110026082500051I2J8",
                    },
                    "network": {
                        "wlan0": {"mac_address": "8c:cd:fe:26:78:f2"}
                    },
                }
            }
        },
    }
    fake_server_info = {
        "status_code": 200,
        "json": lambda: {"result": {"hostname": "lava"}},
    }

    mock_client = AsyncMock()
    async def mock_get(url):
        resp = AsyncMock()
        if "system_info" in url:
            resp.status_code = fake_system_info["status_code"]
            resp.json = fake_system_info["json"]
        else:
            resp.status_code = fake_server_info["status_code"]
            resp.json = fake_server_info["json"]
        return resp

    mock_client.get = mock_get
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    with (
        patch("asyncio.open_connection", AsyncMock(side_effect=lambda ip, port: (AsyncMock(), AsyncMock()) if ip == "192.168.1.15" else OSError())),
        patch("httpx.AsyncClient", return_value=mock_client),
    ):
        hit = await resolve_moonraker_printer(
            serial_number="8110026082500051I2J8",
            current_ip="192.168.1.21",
            subnet="192.168.1.0/24",
        )

        assert hit is not None
        assert hit["ip_address"] == "192.168.1.15"
        assert hit["port"] == 7125
        assert hit["serial_number"] == "8110026082500051I2J8"


@pytest.mark.asyncio
async def test_resolve_moonraker_printer_by_model_fallback():
    fake_system_info = {
        "status_code": 200,
        "json": lambda: {
            "result": {
                "system_info": {
                    "product_info": {
                        "machine_type": "Snapmaker U1",
                        "serial_number": "8110026082500051I2J8",
                    },
                }
            }
        },
    }

    mock_client = AsyncMock()
    async def mock_get(url):
        resp = AsyncMock()
        resp.status_code = 200
        resp.json = fake_system_info["json"]
        return resp

    mock_client.get = mock_get
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    with (
        patch("asyncio.open_connection", AsyncMock(side_effect=lambda ip, port: (AsyncMock(), AsyncMock()) if ip == "192.168.1.15" else OSError())),
        patch("httpx.AsyncClient", return_value=mock_client),
    ):
        hit = await resolve_moonraker_printer(
            serial_number="KLIPPER-192-168-1-21",  # Placeholder serial
            model="Snapmaker U1",
            current_ip="192.168.1.21",
            subnet="192.168.1.0/24",
        )

        assert hit is not None
        assert hit["ip_address"] == "192.168.1.15"
        assert hit["model"] == "Snapmaker U1"

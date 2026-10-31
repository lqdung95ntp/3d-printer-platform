import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from backend.app import main
from backend.app.schemas.printer import PrinterCreate, PrinterResponse, PrinterUpdate
from backend.app.services.bambu_ftp import DeleteResult


def test_printer_schema_delete_after_print():
    """Verify delete_after_print is present on printer schemas."""
    create = PrinterCreate(
        name="Voron 2.4",
        ip_address="192.168.1.100",
        serial_number="VORON-123",
        access_code="moonraker",
        provider="klipper",
        delete_after_print=True,
    )
    assert create.delete_after_print is True

    update = PrinterUpdate(delete_after_print=False)
    assert update.delete_after_print is False


@pytest.mark.asyncio
async def test_non_bambu_cleanup_skipped_when_disabled(monkeypatch):
    """When delete_after_print is False on non-Bambu, no delete is attempted."""
    mock_printer = MagicMock()
    mock_printer.id = 10
    mock_printer.name = "Voron"
    mock_printer.provider = "klipper"
    mock_printer.delete_after_print = False

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_printer
    mock_db.execute.return_value = mock_result

    class MockAsyncSession:
        async def __aenter__(self):
            return mock_db

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(main, "async_session", lambda: MockAsyncSession())

    mock_client = MagicMock()
    monkeypatch.setattr(main.printer_manager, "get_client", lambda pid: mock_client)
    monkeypatch.setattr(main.printer_manager, "get_status", lambda pid: None)
    monkeypatch.setattr(main.ws_manager, "send_print_complete", AsyncMock())
    monkeypatch.setattr(main.mqtt_relay, "on_print_complete", AsyncMock())

    await main.on_print_complete(10, {"status": "completed", "filename": "Test_Print.gcode"})

    assert not mock_client.delete_file.called


@pytest.mark.asyncio
async def test_non_bambu_cleanup_runs_when_enabled(monkeypatch):
    """When delete_after_print is True on non-Bambu, delete_file is called with gcode filename."""
    mock_printer = MagicMock()
    mock_printer.id = 10
    mock_printer.name = "Voron"
    mock_printer.provider = "klipper"
    mock_printer.delete_after_print = True

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_printer
    mock_db.execute.return_value = mock_result

    class MockAsyncSession:
        async def __aenter__(self):
            return mock_db

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(main, "async_session", lambda: MockAsyncSession())

    mock_client = MagicMock()
    mock_client.delete_file.return_value = True
    monkeypatch.setattr(main.printer_manager, "get_client", lambda pid: mock_client)
    monkeypatch.setattr(main.printer_manager, "get_status", lambda pid: None)
    monkeypatch.setattr(main.ws_manager, "send_print_complete", AsyncMock())
    monkeypatch.setattr(main.mqtt_relay, "on_print_complete", AsyncMock())

    await main.on_print_complete(10, {"status": "completed", "filename": "Test_Print.gcode"})

    mock_client.delete_file.assert_called_once_with("Test_Print.gcode")


@pytest.mark.asyncio
async def test_non_bambu_cleanup_handles_404_not_found(monkeypatch):
    """When Moonraker returns 404, cleanup handles it gracefully without retrying in a loop."""
    mock_printer = MagicMock()
    mock_printer.id = 10
    mock_printer.name = "Voron"
    mock_printer.provider = "klipper"
    mock_printer.delete_after_print = True

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_printer
    mock_db.execute.return_value = mock_result

    class MockAsyncSession:
        async def __aenter__(self):
            return mock_db

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(main, "async_session", lambda: MockAsyncSession())

    mock_client = MagicMock()
    response_404 = httpx.Response(status_code=404, request=httpx.Request("POST", "http://fake/"))
    mock_client.delete_file.side_effect = httpx.HTTPStatusError("Not found", request=response_404.request, response=response_404)

    monkeypatch.setattr(main.printer_manager, "get_client", lambda pid: mock_client)
    monkeypatch.setattr(main.printer_manager, "get_status", lambda pid: None)
    monkeypatch.setattr(main.ws_manager, "send_print_complete", AsyncMock())
    monkeypatch.setattr(main.mqtt_relay, "on_print_complete", AsyncMock())

    # Should not raise exception
    await main.on_print_complete(10, {"status": "completed", "filename": "Missing.gcode"})

    # 404 is NOT_FOUND, so it breaks after the first attempt
    assert mock_client.delete_file.call_count == 1


"""Unit tests for Bambu Lab BMCU error auto-dismiss and auto-retry flow (0500-409D)."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from backend.app.services.bambu_mqtt import (
    BMCU_ERROR_CODES,
    BMCU_HMS_CODES,
    BambuMQTTClient,
    HMSError,
    PrinterState,
)


@pytest.fixture
def mock_client():
    client = BambuMQTTClient(
        ip_address="192.168.1.100",
        access_code="12345678",
        serial_number="01P00A123456789",
        model="P1S",
    )
    client._client = MagicMock()
    client.state.connected = True
    return client


class TestBMCUErrorDetection:
    """Test detection of BMCU errors from mc_print_error_code, print_error, and hms list."""

    def test_detect_from_mc_print_error_code_int(self):
        data = {"mc_print_error_code": 83902621}
        result = BambuMQTTClient._detect_bmcu_error(data)
        assert result == (83902621, "0500409D")

    def test_detect_from_mc_print_error_code_str(self):
        data = {"mc_print_error_code": "83902621"}
        result = BambuMQTTClient._detect_bmcu_error(data)
        assert result == (83902621, "0500409D")

    def test_detect_from_mc_print_error_code_hex_str(self):
        data = {"mc_print_error_code": "0x0500409D"}
        result = BambuMQTTClient._detect_bmcu_error(data)
        assert result == (83902621, "0500409D")

    def test_detect_from_mc_print_error_code_range(self):
        # 0500-409C to 0500-409F
        for code_int, hex_str in BMCU_ERROR_CODES.items():
            result = BambuMQTTClient._detect_bmcu_error({"mc_print_error_code": code_int})
            assert result == (code_int, hex_str)

    def test_detect_from_print_error_int(self):
        data = {"print_error": 83902621}
        result = BambuMQTTClient._detect_bmcu_error(data)
        assert result == (83902621, "0500409D")

    def test_detect_from_print_error_hex_str(self):
        data = {"print_error": "0x0500409D"}
        result = BambuMQTTClient._detect_bmcu_error(data)
        assert result == (83902621, "0500409D")

    def test_detect_from_hms_int_codes(self):
        # attr: 0x0500 (1280), code: 0x409D (16541)
        data = {"hms": [{"attr": 1280, "code": 16541}]}
        result = BambuMQTTClient._detect_bmcu_error(data)
        assert result == (83902621, "0500409D")

    def test_detect_from_hms_shifted_attr(self):
        # attr has module in high 16 bits: 0x05000000 (83886080)
        data = {"hms": [{"attr": 83886080, "code": 16541}]}
        result = BambuMQTTClient._detect_bmcu_error(data)
        assert result == (83902621, "0500409D")

    def test_detect_from_hms_hex_strings(self):
        data = {"hms": [{"attr": "0x0500", "code": "0x409D"}]}
        result = BambuMQTTClient._detect_bmcu_error(data)
        assert result == (83902621, "0500409D")

    def test_detect_returns_none_for_other_errors(self):
        assert BambuMQTTClient._detect_bmcu_error({"mc_print_error_code": 0}) is None
        assert BambuMQTTClient._detect_bmcu_error({"mc_print_error_code": 12345}) is None
        assert BambuMQTTClient._detect_bmcu_error({"print_error": 0}) is None
        assert BambuMQTTClient._detect_bmcu_error({"hms": [{"attr": 1280, "code": 0x4001}]}) is None
        assert BambuMQTTClient._detect_bmcu_error({}) is None


class TestBMCURecoveryFlow:
    """Test start_print recording, debounce, ready check and retry execution."""

    def test_start_print_records_arguments_and_resets_retry_count(self, mock_client):
        mock_client._bmcu_retry_count = 2
        mock_client._bmcu_handling = True

        mock_client.start_print(
            filename="benchy.3mf",
            plate_id=2,
            ams_mapping=[0, 1],
            bed_levelling=True,
            flow_cali=False,
            timelapse=True,
        )

        assert mock_client._bmcu_retry_count == 0
        assert mock_client._bmcu_handling is False
        assert mock_client._last_start_print_args is not None
        assert mock_client._last_start_print_args["filename"] == "benchy.3mf"
        assert mock_client._last_start_print_args["plate_id"] == 2
        assert mock_client._last_start_print_args["ams_mapping"] == [0, 1]
        assert mock_client._last_start_print_args["timelapse"] is True

    def test_bmcu_debounce_lock(self, mock_client):
        mock_client._last_start_print_args = {"filename": "test.3mf"}
        mock_client._bmcu_handling = True

        with patch.object(mock_client, "_start_bmcu_recovery") as mock_start:
            mock_client._check_bmcu_error({"mc_print_error_code": 83902621}, {})
            mock_start.assert_not_called()

    def test_bmcu_error_suppresses_failed_completion(self, mock_client):
        mock_client.on_print_complete = MagicMock()
        mock_client._last_start_print_args = {"filename": "test.3mf"}
        mock_client._previous_gcode_state = "PREPARE"
        mock_client._was_running = False

        # Calling _update_state when BMCU error is reported with state=FAILED
        data = {
            "gcode_state": "FAILED",
            "mc_print_error_code": 83902621,
            "subtask_name": "test",
        }
        mock_client._update_state(data)

        # on_print_complete should NOT have been called with failed
        mock_client.on_print_complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_bmcu_recovery_routine_command_sequence(self, mock_client):
        """Verify the 4 MQTT commands sent in Step 2 match the protocol specification."""
        commands_sent = []
        mock_client.send_command = lambda cmd: commands_sent.append(cmd)
        mock_client._last_start_print_args = {"filename": "cube.3mf", "plate_id": 1}
        mock_client.last_dispatch_subtask_id = "1001"
        mock_client.state.subtask_id = "1001"

        # Set printer state to become ready after initial wait
        async def mock_sleep_hook(duration):
            if duration == 3.0:
                # Printer clears error and becomes ready
                mock_client.state.state = "IDLE"
                mock_client.state.mc_print_error_code = 0
                mock_client.state.print_error = 0
                mock_client.state.hms_errors = []

        with patch("asyncio.sleep", side_effect=mock_sleep_hook), patch.object(
            mock_client, "start_print", return_value=True
        ) as mock_retry_start:
            # Run 1 recovery routine cycle
            # After start_print is called on retry, set state to RUNNING to finish
            def on_retry(*args, **kwargs):
                mock_client.state.state = "RUNNING"
                return True

            mock_retry_start.side_effect = on_retry
            await mock_client._bmcu_recovery_routine(83902621, "0500409D")

            # Check that 4 cleanup commands were sent
            assert len(commands_sent) >= 4

            # 1. uiop close dialog
            assert "system" in commands_sent[0]
            assert commands_sent[0]["system"]["command"] == "uiop"
            assert commands_sent[0]["system"]["name"] == "print_error"
            assert commands_sent[0]["system"]["action"] == "close"
            assert commands_sent[0]["system"]["err"] == "0500409D"

            # 2. ignore print error
            assert "print" in commands_sent[1]
            assert commands_sent[1]["print"]["command"] == "ignore"
            assert commands_sent[1]["print"]["err"] == "83902621"
            assert commands_sent[1]["print"]["job_id"] == "1001"

            # 3. clean_print_error
            assert "print" in commands_sent[2]
            assert commands_sent[2]["print"]["command"] == "clean_print_error"
            assert commands_sent[2]["print"]["print_error"] == 83902621
            assert commands_sent[2]["print"]["subtask_id"] == "1001"

            # 4. pushall
            assert "pushing" in commands_sent[3]
            assert commands_sent[3]["pushing"]["command"] == "pushall"

            # Check sequence_id increments
            seq1 = int(commands_sent[0]["system"]["sequence_id"])
            seq2 = int(commands_sent[1]["print"]["sequence_id"])
            seq3 = int(commands_sent[2]["print"]["sequence_id"])
            seq4 = int(commands_sent[3]["pushing"]["sequence_id"])
            assert seq1 < seq2 < seq3 < seq4

            # Check that start_print retry was invoked
            mock_retry_start.assert_called_once_with(
                filename="cube.3mf",
                plate_id=1,
                _is_bmcu_retry=True,
            )
            assert mock_client._bmcu_retry_count == 0
            assert mock_client._bmcu_handling is False

    @pytest.mark.asyncio
    async def test_bmcu_recovery_exhausted_after_3_attempts(self, mock_client):
        """When 3 retries all fail, job must be marked as FAILED and on_print_complete called."""
        mock_client.send_command = MagicMock()
        mock_client._last_start_print_args = {"filename": "benchy.3mf"}
        mock_client.on_print_complete = MagicMock()

        # Simulate ready check succeeding but BMCU error recurring each time
        async def mock_sleep_cycle(duration):
            # Error recurs on each retry check
            mock_client.state.mc_print_error_code = 83902621

        with patch("asyncio.sleep", side_effect=mock_sleep_cycle), patch.object(
            mock_client, "start_print", return_value=True
        ):
            await mock_client._bmcu_recovery_routine(83902621, "0500409D")

            assert mock_client.state.state == "FAILED"
            mock_client.on_print_complete.assert_called_once()
            call_args = mock_client.on_print_complete.call_args[0][0]
            assert call_args["status"] == "failed"
            assert "BMCU" in call_args["hms_errors"][0]["message"]
            assert mock_client._bmcu_handling is False

    def test_stop_print_cancels_recovery_task(self, mock_client):
        mock_task = MagicMock()
        mock_task.done.return_value = False
        mock_client._bmcu_task = mock_task
        mock_client._bmcu_handling = True
        mock_client._bmcu_retry_count = 2

        mock_client.stop_print()

        mock_task.cancel.assert_called_once()
        assert mock_client._bmcu_handling is False
        assert mock_client._bmcu_retry_count == 0

    @pytest.mark.asyncio
    async def test_external_print_bmcu_auto_dismiss(self, mock_client):
        """When an external print (Bambu Studio/Handy) hits BMCU error, dismiss commands are sent and errors cleared."""
        commands_sent = []
        mock_client.send_command = lambda cmd: commands_sent.append(cmd)
        mock_client._last_start_print_args = None  # External print has no farm start_print args
        mock_client.state.subtask_id = "external_job_123"
        mock_client.state.mc_print_error_code = 83902621
        mock_client.state.hms_errors = [HMSError(code="0x409d", attr=83902621, module=5, severity=1)]

        with patch("asyncio.sleep", return_value=None):
            await mock_client._bmcu_external_dismiss_routine(83902621, "0500409D")

            # Check all 4 cleanup commands sent
            assert len(commands_sent) == 4
            assert commands_sent[0]["system"]["command"] == "uiop"
            assert commands_sent[0]["system"]["err"] == "0500409D"
            assert commands_sent[1]["print"]["command"] == "ignore"
            assert commands_sent[1]["print"]["err"] == "83902621"
            assert commands_sent[2]["print"]["command"] == "clean_print_error"
            assert commands_sent[2]["print"]["print_error"] == 83902621
            assert commands_sent[3]["pushing"]["command"] == "pushall"

            # Check that errors were cleaned from state
            assert mock_client.state.mc_print_error_code == 0
            assert len(mock_client.state.hms_errors) == 0
            assert mock_client._bmcu_handling is False

    def test_check_bmcu_error_triggers_external_dismiss_when_no_farm_args(self, mock_client):
        """_check_bmcu_error should route to external dismiss when _last_start_print_args is None."""
        mock_client._last_start_print_args = None
        mock_client._bmcu_handling = False

        with patch.object(mock_client, "_start_bmcu_external_dismiss") as mock_start_ext:
            mock_client._check_bmcu_error({"mc_print_error_code": 83902621}, {})
            mock_start_ext.assert_called_once_with(83902621, "0500409D")
            assert mock_client._bmcu_handling is True


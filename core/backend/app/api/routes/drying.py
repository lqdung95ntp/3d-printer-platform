"""API routes for scheduled AMS drying operations."""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.core.auth import RequirePermissionIfAuthEnabled
from backend.app.core.permissions import Permission
from backend.app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drying", tags=["Drying"])


class CreateScheduledDryingRequest(BaseModel):
    printer_id: int
    ams_id: int
    temp: int
    duration_hours: int
    filament: str = "PLA"
    rotate_tray: bool = True
    start_after: str | None = None


class ScheduledDryingResponse(BaseModel):
    id: int
    printer_id: int
    ams_id: int
    temp: int
    duration_hours: int
    filament: str
    rotate_tray: bool
    start_after: str | None = None
    status: str = "pending"
    waiting_reason: str | None = None
    error_code: str | None = None
    error_message: str | None = None


_schedules: dict[int, dict[str, Any]] = {}
_id_counter = 1


@router.get("/schedules", response_model=list[ScheduledDryingResponse])
async def list_scheduled_dryings(
    _: User | None = RequirePermissionIfAuthEnabled(Permission.PRINTERS_READ),
):
    """List all scheduled drying tasks."""
    return list(_schedules.values())


@router.post("/schedule")
async def create_scheduled_drying(
    req: CreateScheduledDryingRequest,
    _: User | None = RequirePermissionIfAuthEnabled(Permission.PRINTERS_CONTROL),
):
    """Schedule a drying run."""
    global _id_counter
    schedule_id = _id_counter
    _id_counter += 1

    item = {
        "id": schedule_id,
        "printer_id": req.printer_id,
        "ams_id": req.ams_id,
        "temp": req.temp,
        "duration_hours": req.duration_hours,
        "filament": req.filament,
        "rotate_tray": req.rotate_tray,
        "start_after": req.start_after or datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "waiting_reason": None,
        "error_code": None,
        "error_message": None,
    }
    _schedules[schedule_id] = item
    return {"success": True, "schedule": item}


@router.delete("/schedules/{schedule_id}")
async def cancel_scheduled_drying(
    schedule_id: int,
    _: User | None = RequirePermissionIfAuthEnabled(Permission.PRINTERS_CONTROL),
):
    """Cancel a scheduled drying task."""
    if schedule_id in _schedules:
        _schedules.pop(schedule_id, None)
        return {"success": True, "message": f"Scheduled drying {schedule_id} cancelled"}
    return {"success": True, "message": "Schedule not found or already cancelled"}

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas import NotificationCreate
from app.services.notification_service import (
    check_deadlines,
    get_notifications_for_user,
    subscribe,
)
from app.services.user_service import get_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/subscribe")
def subscribe_endpoint(request: NotificationCreate) -> dict[str, Any]:
    """Subscribe to a notification / reminder."""
    return subscribe(
        user_id=request.user_id,
        notification_type=request.notification_type,
        channel=request.channel,
        scheduled_for=request.scheduled_for,
        message=request.message,
    )


@router.get("/{user_id}")
def user_notifications(user_id: str) -> list[dict[str, Any]]:
    """Get all notifications for a user."""
    return get_notifications_for_user(user_id)


@router.post("/check-deadlines")
def check_deadlines_endpoint(
    user_id: str = Query(...),
) -> dict[str, Any]:
    """Check upcoming election deadlines and create reminders."""
    try:
        user = get_user(user_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="User not found")

    state = user.get("state", "")
    new_notifications = check_deadlines(user_id, state)
    return {
        "new_notifications": len(new_notifications),
        "notifications": new_notifications,
    }

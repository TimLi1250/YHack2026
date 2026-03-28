from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.config import ELECTIONS_FILE, NOTIFICATIONS_FILE
from app.storage import append_json, load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)


def subscribe(
    user_id: str,
    notification_type: str,
    channel: str = "email",
    scheduled_for: str | None = None,
    message: str | None = None,
) -> dict[str, Any]:
    """Create a notification/reminder subscription."""
    notification = {
        "id": f"notif_{uuid4().hex[:12]}",
        "user_id": user_id,
        "notification_type": notification_type,
        "scheduled_for": scheduled_for,
        "channel": channel,
        "message": message or _default_message(notification_type),
        "delivery_status": "pending",
        "created_at": now_iso(),
    }
    append_json(NOTIFICATIONS_FILE, notification)
    return notification


def get_notifications_for_user(user_id: str) -> list[dict[str, Any]]:
    """Return all notifications for a user."""
    return [
        n for n in load_json(NOTIFICATIONS_FILE)
        if n.get("user_id") == user_id
    ]


def check_deadlines(user_id: str, state: str) -> list[dict[str, Any]]:
    """Check upcoming election deadlines and generate reminders."""
    elections = load_json(ELECTIONS_FILE)
    now = datetime.now(timezone.utc)
    new_notifications: list[dict[str, Any]] = []

    existing = get_notifications_for_user(user_id)
    existing_types = {(n.get("notification_type"), n.get("scheduled_for")) for n in existing}

    for election in elections:
        if election.get("state", "").lower() != state.lower():
            continue

        # Registration deadline
        reg_deadline = election.get("registration_deadline")
        if reg_deadline and (("registration_deadline", reg_deadline) not in existing_types):
            try:
                deadline_dt = datetime.fromisoformat(reg_deadline)
                if deadline_dt > now:
                    days_left = (deadline_dt - now).days
                    notif = subscribe(
                        user_id=user_id,
                        notification_type="registration_deadline",
                        scheduled_for=reg_deadline,
                        message=f"Voter registration deadline is in {days_left} days ({reg_deadline}).",
                    )
                    new_notifications.append(notif)
            except (ValueError, TypeError):
                pass

        # Absentee deadline
        abs_deadline = election.get("absentee_deadline")
        if abs_deadline and (("absentee_deadline", abs_deadline) not in existing_types):
            try:
                deadline_dt = datetime.fromisoformat(abs_deadline)
                if deadline_dt > now:
                    days_left = (deadline_dt - now).days
                    notif = subscribe(
                        user_id=user_id,
                        notification_type="absentee_deadline",
                        scheduled_for=abs_deadline,
                        message=f"Absentee ballot request deadline is in {days_left} days ({abs_deadline}).",
                    )
                    new_notifications.append(notif)
            except (ValueError, TypeError):
                pass

        # Early voting
        ev_start = election.get("early_voting_start")
        if ev_start and (("early_voting", ev_start) not in existing_types):
            try:
                ev_dt = datetime.fromisoformat(ev_start)
                if ev_dt > now:
                    notif = subscribe(
                        user_id=user_id,
                        notification_type="early_voting",
                        scheduled_for=ev_start,
                        message=f"Early voting begins on {ev_start}.",
                    )
                    new_notifications.append(notif)
            except (ValueError, TypeError):
                pass

        # Election day
        election_date = election.get("election_date")
        if election_date and (("election_day", election_date) not in existing_types):
            try:
                ed_dt = datetime.fromisoformat(election_date)
                if ed_dt > now:
                    notif = subscribe(
                        user_id=user_id,
                        notification_type="election_day",
                        scheduled_for=election_date,
                        message=f"Election day is on {election_date}. Don't forget to vote!",
                    )
                    new_notifications.append(notif)
            except (ValueError, TypeError):
                pass

    return new_notifications


def _default_message(notification_type: str) -> str:
    messages = {
        "registration_deadline": "Your voter registration deadline is approaching.",
        "absentee_deadline": "Your absentee ballot request deadline is approaching.",
        "early_voting": "Early voting is starting soon.",
        "election_day": "Election day is coming up. Don't forget to vote!",
        "poll_wait_alert": "Check current poll wait times before heading out.",
        "ballot_ready": "Your personalized ballot summary is ready to view.",
    }
    return messages.get(notification_type, "You have a new civic notification.")


def update_notification_status(
    notification_id: str,
    status: str,
) -> dict[str, Any] | None:
    """Update the delivery status of a notification."""
    notifications = load_json(NOTIFICATIONS_FILE)
    for i, n in enumerate(notifications):
        if n.get("id") == notification_id:
            notifications[i]["delivery_status"] = status
            save_json(NOTIFICATIONS_FILE, notifications)
            return notifications[i]
    return None

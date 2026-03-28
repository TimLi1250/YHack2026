from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.schemas import UserCreate, UserUpdate
from app.services.user_service import create_user, get_user, list_users, update_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("")
def create_user_endpoint(payload: UserCreate) -> dict[str, Any]:
    return create_user(payload)


@router.get("")
def list_users_endpoint() -> list[dict[str, Any]]:
    return list_users()


@router.get("/{user_id}")
def get_user_endpoint(user_id: str) -> dict[str, Any]:
    return get_user(user_id)


@router.patch("/{user_id}")
def update_user_endpoint(user_id: str, payload: UserUpdate) -> dict[str, Any]:
    return update_user(user_id, payload)
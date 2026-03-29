from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import AIChatRequest, AIFactCheckRequest
from app.services.ai_service import answer_chat, build_user_context, fact_check_claim

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat")
async def ai_chat(request: AIChatRequest) -> dict:
    try:
        user_context = build_user_context(
            user_id=request.user_id,
            profile_context=request.profile_context,
            language_preference=request.language_preference,
        )
        response = await answer_chat(
            question=request.message,
            user_context=user_context,
            conversation=request.conversation,
        )
        return response.model_dump()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI chat failed: {exc}") from exc


@router.post("/fact-check")
async def ai_fact_check(request: AIFactCheckRequest) -> dict:
    try:
        user_context = build_user_context(
            user_id=request.user_id,
            profile_context=request.profile_context,
            language_preference=request.language_preference,
        )
        response = await fact_check_claim(
            claim=request.claim,
            user_context=user_context,
        )
        return response.model_dump()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI fact-check failed: {exc}") from exc

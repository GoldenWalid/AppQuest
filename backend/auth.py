"""Emergent-managed Google OAuth — session validation, login, logout."""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
EMERGENT_OAUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

logger = logging.getLogger(__name__)


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: Optional[str] = None


class SessionExchangeReq(BaseModel):
    session_id: str


def _get_token(request: Request) -> Optional[str]:
    """Cookie first, then Authorization: Bearer ... fallback."""
    token = request.cookies.get("session_token")
    if token:
        return token
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


def make_require_user(db: AsyncIOMotorDatabase):
    """Build a FastAPI dependency that returns the current authenticated User."""

    async def _dep(request: Request) -> User:
        token = _get_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        expires_at = session["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        # mongosh-seeded users may have BSON Date for created_at; coerce to str
        ca = user_doc.get("created_at")
        if isinstance(ca, datetime):
            user_doc["created_at"] = ca.isoformat()
        return User(**user_doc)

    return _dep


def make_auth_router(db: AsyncIOMotorDatabase) -> APIRouter:
    router = APIRouter(prefix="/auth")
    require_user = make_require_user(db)

    async def _exchange_session_id(session_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15.0) as cli:
            r = await cli.get(
                EMERGENT_OAUTH_SESSION_URL,
                headers={"X-Session-ID": session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        return r.json()

    async def _upsert_user(payload: dict) -> str:
        existing = await db.users.find_one({"email": payload["email"]}, {"_id": 0})
        if existing:
            await db.users.update_one(
                {"user_id": existing["user_id"]},
                {"$set": {"name": payload.get("name", existing.get("name")),
                          "picture": payload.get("picture", existing.get("picture"))}},
            )
            return existing["user_id"]
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": payload["email"],
            "name": payload.get("name", ""),
            "picture": payload.get("picture", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return user_id

    async def _store_session(user_id: str, session_token: str) -> None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    @router.post("/session")
    async def session_exchange(body: SessionExchangeReq, response: Response):
        payload = await _exchange_session_id(body.session_id)
        user_id = await _upsert_user(payload)
        session_token = payload["session_token"]
        await _store_session(user_id, session_token)
        response.set_cookie(
            key="session_token",
            value=session_token,
            max_age=7 * 24 * 60 * 60,
            path="/",
            httponly=True,
            secure=True,
            samesite="none",
        )
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return {"user": user_doc}

    @router.get("/me", response_model=User)
    async def me(user: User = Depends(require_user)):
        return user

    @router.post("/logout")
    async def logout(request: Request, response: Response):
        token = _get_token(request)
        if token:
            await db.user_sessions.delete_many({"session_token": token})
        response.delete_cookie(key="session_token", path="/", samesite="none", secure=True)
        return {"ok": True}

    return router

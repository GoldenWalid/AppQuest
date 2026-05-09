"""Auth system — email + password with JWT sessions."""
import uuid
import logging
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: Optional[str] = None


class RegisterReq(BaseModel):
    email: str
    password: str
    name: str


class LoginReq(BaseModel):
    email: str
    password: str


def _hash_password(password: str) -> str:
    salt = "appquest_salt_2026"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def _get_token(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


def make_require_user(db: AsyncIOMotorDatabase):
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
        ca = user_doc.get("created_at")
        if isinstance(ca, datetime):
            user_doc["created_at"] = ca.isoformat()
        user_doc.pop("password_hash", None)
        return User(**user_doc)

    return _dep


def make_auth_router(db: AsyncIOMotorDatabase) -> APIRouter:
    router = APIRouter(prefix="/auth")
    require_user = make_require_user(db)

    async def _store_session(user_id: str) -> str:
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return session_token

    def _set_session_cookie(response: Response, token: str):
        response.set_cookie(
            key="session_token",
            value=token,
            max_age=30 * 24 * 60 * 60,
            path="/",
            httponly=True,
            secure=True,
            samesite="none",
        )

    @router.post("/register")
    async def register(body: RegisterReq, response: Response):
        existing = await db.users.find_one({"email": body.email.lower().strip()})
        if existing:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": body.email.lower().strip(),
            "name": body.name.strip(),
            "picture": "",
            "password_hash": _hash_password(body.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        session_token = await _store_session(user_id)
        _set_session_cookie(response, session_token)
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        return {"user": user_doc}

    @router.post("/login")
    async def login(body: LoginReq, response: Response):
        user_doc = await db.users.find_one({"email": body.email.lower().strip()})
        if not user_doc:
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
        if user_doc.get("password_hash") != _hash_password(body.password):
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
        session_token = await _store_session(user_doc["user_id"])
        _set_session_cookie(response, session_token)
        user_doc.pop("_id", None)
        user_doc.pop("password_hash", None)
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

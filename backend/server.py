from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import uuid
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from ai_system import awaken_chat_turn, generate_daily_quests, decompose_quest
from auth import make_auth_router, make_require_user, User

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
require_user = make_require_user(db)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ============ XP / RANK ============
def level_from_xp(total_xp: int) -> int:
    lvl = 1
    while (lvl * lvl * 100) <= total_xp:
        lvl += 1
    return lvl


def xp_for_level(level: int) -> int:
    return (level - 1) * (level - 1) * 100


def rank_from_level(level: int) -> str:
    if level < 5:
        return "E"
    if level < 10:
        return "D"
    if level < 15:
        return "C"
    if level < 20:
        return "B"
    if level < 25:
        return "A"
    return "S"


# ============ MODELS ============
class ProfileOut(BaseModel):
    id: str
    user_id: str
    name: str
    about_me: str
    main_goal: str
    context: str
    class_title: str
    system_message: str
    initiated: bool
    created_at: str


class Step(BaseModel):
    id: str
    title: str
    description: str = ""
    done: bool = False


class QuestOut(BaseModel):
    id: str
    title: str
    description: str
    xp_reward: int
    rank: str
    status: str
    type: str
    skill: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str
    date_for: Optional[str] = None
    steps: List[Step] = []


class SkillOut(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    level: int
    xp: int
    xp_to_next: int


class AchievementOut(BaseModel):
    id: str
    title: str
    description: str
    rank: str
    condition: str
    unlocked: bool
    unlocked_at: Optional[str] = None


class StatsOut(BaseModel):
    total_xp: int
    level: int
    xp_current_level: int
    xp_next_level: int
    xp_into_level: int
    xp_needed_for_next: int
    rank: str
    quests_completed: int
    daily_streak: int
    attributes: dict


class CompleteResult(BaseModel):
    quest: QuestOut
    xp_gained: int
    leveled_up: bool
    new_level: Optional[int] = None
    new_rank: Optional[str] = None
    unlocked_achievements: List[AchievementOut] = []


# ============ HELPERS (all scoped by user_id) ============
async def get_profile_doc(user_id: str):
    return await db.profile.find_one({"user_id": user_id}, {"_id": 0})


async def compute_stats(user_id: str) -> StatsOut:
    quests = await db.quests.find(
        {"user_id": user_id, "status": "completed"}, {"_id": 0}
    ).to_list(5000)
    total_xp = sum(q.get("xp_reward", 0) for q in quests)
    level = level_from_xp(total_xp)
    xp_curr = xp_for_level(level)
    xp_next = xp_for_level(level + 1)
    today = date.today()
    streak = 0
    days_back = 0
    while days_back < 365:
        d = today.fromordinal(today.toordinal() - days_back).isoformat()
        any_for_day = any(
            q.get("type") == "daily" and q.get("date_for") == d and q.get("status") == "completed"
            for q in quests
        )
        if any_for_day:
            streak += 1
            days_back += 1
        else:
            if days_back == 0:
                days_back += 1
                continue
            break

    skills = await db.skills.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    attributes = {s["name"]: s["level"] for s in skills}

    return StatsOut(
        total_xp=total_xp,
        level=level,
        xp_current_level=xp_curr,
        xp_next_level=xp_next,
        xp_into_level=total_xp - xp_curr,
        xp_needed_for_next=xp_next - xp_curr,
        rank=rank_from_level(level),
        quests_completed=len(quests),
        daily_streak=streak,
        attributes=attributes,
    )


async def check_achievements(user_id: str) -> List[dict]:
    stats = await compute_stats(user_id)
    locked = await db.achievements.find(
        {"user_id": user_id, "unlocked": False}, {"_id": 0}
    ).to_list(500)
    newly = []
    for ach in locked:
        cond = ach.get("condition", "").lower()
        rank = ach.get("rank", "E")
        rank_threshold = {"E": 1, "D": 5, "C": 10, "B": 15, "A": 20, "S": 25}.get(rank, 1)
        unlock = False
        if stats.level >= rank_threshold:
            if stats.quests_completed >= max(1, rank_threshold // 2):
                unlock = True
        if "streak" in cond and stats.daily_streak >= 3:
            unlock = True
        if "première" in cond or "first" in cond or "premier" in cond:
            if stats.quests_completed >= 1:
                unlock = True
        if unlock:
            await db.achievements.update_one(
                {"user_id": user_id, "id": ach["id"]},
                {"$set": {"unlocked": True, "unlocked_at": now_iso()}},
            )
            ach["unlocked"] = True
            ach["unlocked_at"] = now_iso()
            newly.append(ach)
    return newly


# ============ APP ROUTES ============
@api_router.get("/")
async def root():
    return {"message": "SYSTEM ONLINE"}


@api_router.get("/profile", response_model=Optional[ProfileOut])
async def get_profile(user: User = Depends(require_user)):
    doc = await get_profile_doc(user.user_id)
    if not doc:
        return None
    return ProfileOut(**doc)


# ============ AWAKENING CHAT ============
class ChatMsg(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    session_id: str
    messages: List[ChatMsg] = []


@api_router.post("/awaken/chat")
async def awaken_chat(req: ChatReq, user: User = Depends(require_user)):
    history = [m.model_dump() for m in req.messages]
    try:
        result = await awaken_chat_turn(req.session_id, history)
    except Exception as e:
        logger.exception("awaken_chat failed")
        raise HTTPException(status_code=500, detail=f"System error: {str(e)}")

    if not result.get("done"):
        return {"done": False, "message": result["message"]}

    arch = result["architecture"]
    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in history if m["role"] == "user")
    name = arch.get("hunter_name") or _extract_name_from_history(history) or user.name or "Hunter"
    main_quest = arch.get("main_quest", {})
    profile = await _save_architecture(
        user_id=user.user_id,
        name=name,
        about_me=transcript[:2000],
        main_goal=main_quest.get("title", ""),
        context="",
        arch=arch,
    )
    return {"done": True, "profile": profile.model_dump(), "system_message": profile.system_message}


def _extract_name_from_history(history: List[dict]) -> Optional[str]:
    for m in history:
        if m["role"] == "user":
            text = m["content"].strip()
            words = re.findall(r"\b([A-ZÉÈÊÀÂÎÔÛÇ][a-zéèêàâîôûç]{2,})\b", text)
            if words:
                return words[0]
            break
    return None


async def _save_architecture(
    user_id: str,
    name: str,
    about_me: str,
    main_goal: str,
    context: str,
    arch: dict,
) -> ProfileOut:
    """Persist profile + skills + quests + achievements scoped to user_id."""
    pid = str(uuid.uuid4())
    profile = {
        "id": pid,
        "user_id": user_id,
        "name": name,
        "about_me": about_me,
        "main_goal": main_goal,
        "context": context,
        "class_title": arch.get("class_title", "Hunter"),
        "system_message": arch.get("system_message", "Welcome, Hunter."),
        "initiated": True,
        "created_at": now_iso(),
    }

    # Reset only this user's data
    await db.profile.delete_many({"user_id": user_id})
    await db.quests.delete_many({"user_id": user_id})
    await db.skills.delete_many({"user_id": user_id})
    await db.achievements.delete_many({"user_id": user_id})

    await db.profile.insert_one(dict(profile))

    for s in arch.get("parallel_skills", []):
        await db.skills.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": s.get("name", "Skill"),
            "description": s.get("description", ""),
            "icon": s.get("icon", "star"),
            "level": 1,
            "xp": 0,
            "xp_to_next": 100,
        })

    mq = arch.get("main_quest", {})
    await db.quests.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": mq.get("title", "Main Goal"),
        "description": mq.get("description", ""),
        "xp_reward": mq.get("xp_reward", 5000),
        "rank": mq.get("rank", "S"),
        "status": "active",
        "type": "main",
        "skill": None,
        "completed_at": None,
        "created_at": now_iso(),
        "date_for": None,
        "steps": [],
    })

    for sg in arch.get("sub_goals", []):
        await db.quests.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": sg.get("title", "Sub-goal"),
            "description": sg.get("description", ""),
            "xp_reward": sg.get("xp_reward", 500),
            "rank": sg.get("rank", "A"),
            "status": "active",
            "type": "sub",
            "skill": sg.get("skill"),
            "completed_at": None,
            "created_at": now_iso(),
            "date_for": None,
            "steps": [],
        })

    for po in arch.get("parallel_objectives", []):
        await db.quests.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": po.get("title", "Parallel"),
            "description": po.get("description", ""),
            "xp_reward": po.get("xp_reward", 600),
            "rank": po.get("rank", "B"),
            "status": "active",
            "type": "parallel",
            "skill": po.get("skill"),
            "completed_at": None,
            "created_at": now_iso(),
            "date_for": None,
            "steps": [],
        })

    today_str = date.today().isoformat()
    for dq in arch.get("initial_daily_quests", []):
        await db.quests.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": dq.get("title", "Daily"),
            "description": dq.get("description", ""),
            "xp_reward": dq.get("xp_reward", 100),
            "rank": dq.get("rank", "D"),
            "status": "active",
            "type": "daily",
            "skill": dq.get("skill"),
            "completed_at": None,
            "created_at": now_iso(),
            "date_for": today_str,
            "steps": [],
        })

    achievements = arch.get("achievements") or []
    if not achievements:
        achievements = [
            {"title": "Premier Pas", "description": "Compléter ta première quête.", "rank": "E", "condition": "Compléter 1 quête"},
            {"title": "Série", "description": "Maintenir un streak de 3 jours.", "rank": "D", "condition": "Streak de 3 jours"},
            {"title": "Ascension", "description": "Atteindre le niveau 5.", "rank": "C", "condition": "Atteindre le niveau 5"},
            {"title": "Maître", "description": "Atteindre le niveau 10.", "rank": "B", "condition": "Atteindre le niveau 10"},
            {"title": "Transcendance", "description": "Atteindre le niveau 20.", "rank": "A", "condition": "Atteindre le niveau 20"},
            {"title": "Monarque", "description": "Atteindre le rang S.", "rank": "S", "condition": "Atteindre le rang S"},
        ]
    for ach in achievements:
        await db.achievements.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": ach.get("title", "Achievement"),
            "description": ach.get("description", ""),
            "rank": ach.get("rank", "E"),
            "condition": ach.get("condition", ""),
            "unlocked": False,
            "unlocked_at": None,
        })

    return ProfileOut(**profile)


# ============ STATS / QUESTS / SKILLS / ACHIEVEMENTS ============
@api_router.get("/stats", response_model=StatsOut)
async def stats(user: User = Depends(require_user)):
    return await compute_stats(user.user_id)


@api_router.get("/quests", response_model=List[QuestOut])
async def list_quests(
    type: Optional[str] = None,
    status: Optional[str] = None,
    user: User = Depends(require_user),
):
    q = {"user_id": user.user_id}
    if type:
        q["type"] = type
    if status:
        q["status"] = status
    docs = await db.quests.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    if type == "daily":
        today_str = date.today().isoformat()
        docs = [d for d in docs if d.get("date_for") == today_str]
    return [QuestOut(**d) for d in docs]


@api_router.post("/quests/{quest_id}/complete", response_model=CompleteResult)
async def complete_quest(quest_id: str, user: User = Depends(require_user)):
    return await _complete_quest_internal(user.user_id, quest_id)


async def _complete_quest_internal(user_id: str, quest_id: str) -> CompleteResult:
    q = await db.quests.find_one({"user_id": user_id, "id": quest_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    if q["status"] == "completed":
        raise HTTPException(status_code=400, detail="Already completed")

    prev_stats = await compute_stats(user_id)
    prev_level = prev_stats.level

    await db.quests.update_one(
        {"user_id": user_id, "id": quest_id},
        {"$set": {"status": "completed", "completed_at": now_iso()}},
    )

    if q.get("skill"):
        skill = await db.skills.find_one({"user_id": user_id, "name": q["skill"]}, {"_id": 0})
        if skill:
            skill_xp_gain = max(10, q["xp_reward"] // 5)
            new_xp = skill["xp"] + skill_xp_gain
            new_level = skill["level"]
            xp_to_next = skill["xp_to_next"]
            while new_xp >= xp_to_next:
                new_xp -= xp_to_next
                new_level += 1
                xp_to_next = new_level * 100
            await db.skills.update_one(
                {"user_id": user_id, "id": skill["id"]},
                {"$set": {"xp": new_xp, "level": new_level, "xp_to_next": xp_to_next}},
            )

    new_stats = await compute_stats(user_id)
    leveled_up = new_stats.level > prev_level
    newly_unlocked = await check_achievements(user_id)

    q = await db.quests.find_one({"user_id": user_id, "id": quest_id}, {"_id": 0})
    return CompleteResult(
        quest=QuestOut(**q),
        xp_gained=q["xp_reward"],
        leveled_up=leveled_up,
        new_level=new_stats.level if leveled_up else None,
        new_rank=new_stats.rank if leveled_up else None,
        unlocked_achievements=[AchievementOut(**a) for a in newly_unlocked],
    )


class StepToggleReq(BaseModel):
    done: bool


class DecomposeOut(BaseModel):
    quest: QuestOut
    system_message: str


@api_router.post("/quests/{quest_id}/decompose", response_model=DecomposeOut)
async def decompose_quest_endpoint(quest_id: str, user: User = Depends(require_user)):
    q = await db.quests.find_one({"user_id": user.user_id, "id": quest_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    if q["status"] == "completed":
        raise HTTPException(status_code=400, detail="Quest already completed")

    profile = await get_profile_doc(user.user_id) or {}
    try:
        result = await decompose_quest(profile, q)
    except Exception as e:
        logger.exception("decompose failed")
        raise HTTPException(status_code=500, detail=f"Decomposition failed: {str(e)}")

    raw_steps = result.get("steps", []) or []
    steps = [
        {
            "id": str(uuid.uuid4()),
            "title": s.get("title", "Étape"),
            "description": s.get("description", ""),
            "done": False,
        }
        for s in raw_steps
    ]
    if not steps:
        raise HTTPException(status_code=500, detail="AI returned no steps")

    await db.quests.update_one(
        {"user_id": user.user_id, "id": quest_id},
        {"$set": {"steps": steps}},
    )
    q = await db.quests.find_one({"user_id": user.user_id, "id": quest_id}, {"_id": 0})
    return DecomposeOut(
        quest=QuestOut(**q),
        system_message=result.get("system_message", "Décompose. Avance pas à pas."),
    )


class StepToggleResult(BaseModel):
    quest: QuestOut
    auto_completed: bool = False
    completion: Optional[CompleteResult] = None


@api_router.patch("/quests/{quest_id}/steps/{step_id}", response_model=StepToggleResult)
async def toggle_step(
    quest_id: str,
    step_id: str,
    req: StepToggleReq,
    user: User = Depends(require_user),
):
    q = await db.quests.find_one({"user_id": user.user_id, "id": quest_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    steps = q.get("steps") or []
    if not steps:
        raise HTTPException(status_code=400, detail="Quest has no steps")

    found = False
    for s in steps:
        if s["id"] == step_id:
            s["done"] = bool(req.done)
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Step not found")

    await db.quests.update_one(
        {"user_id": user.user_id, "id": quest_id},
        {"$set": {"steps": steps}},
    )

    auto_completed = False
    completion: Optional[CompleteResult] = None
    if all(s["done"] for s in steps) and q["status"] == "active":
        completion = await _complete_quest_internal(user.user_id, quest_id)
        auto_completed = True

    updated = await db.quests.find_one(
        {"user_id": user.user_id, "id": quest_id}, {"_id": 0}
    )
    return StepToggleResult(
        quest=QuestOut(**updated),
        auto_completed=auto_completed,
        completion=completion,
    )


@api_router.post("/quests/generate-daily")
async def gen_daily(user: User = Depends(require_user)):
    profile = await get_profile_doc(user.user_id)
    if not profile:
        raise HTTPException(status_code=400, detail="No profile")
    skills = await db.skills.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    today_str = date.today().isoformat()
    completed_today = await db.quests.count_documents({
        "user_id": user.user_id, "type": "daily",
        "date_for": today_str, "status": "completed",
    })
    try:
        result = await generate_daily_quests(profile, skills, completed_today)
    except Exception as e:
        logger.exception("daily gen failed")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    created = []
    for dq in result.get("daily_quests", []):
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user.user_id,
            "title": dq.get("title", "Daily"),
            "description": dq.get("description", ""),
            "xp_reward": dq.get("xp_reward", 100),
            "rank": dq.get("rank", "D"),
            "status": "active",
            "type": "daily",
            "skill": dq.get("skill"),
            "completed_at": None,
            "created_at": now_iso(),
            "date_for": today_str,
            "steps": [],
        }
        await db.quests.insert_one(doc)
        created.append(QuestOut(**doc))
    return {"system_message": result.get("system_message", ""), "daily_quests": created}


@api_router.get("/skills", response_model=List[SkillOut])
async def list_skills(user: User = Depends(require_user)):
    docs = await db.skills.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    return [SkillOut(**d) for d in docs]


@api_router.get("/achievements", response_model=List[AchievementOut])
async def list_achievements(user: User = Depends(require_user)):
    docs = await db.achievements.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: (not d.get("unlocked", False), d.get("title", "")))
    return [AchievementOut(**d) for d in docs]


@api_router.post("/reset")
async def reset_all(user: User = Depends(require_user)):
    await db.profile.delete_many({"user_id": user.user_id})
    await db.quests.delete_many({"user_id": user.user_id})
    await db.skills.delete_many({"user_id": user.user_id})
    await db.achievements.delete_many({"user_id": user.user_id})
    return {"ok": True}


# Mount auth + api routers
api_router.include_router(make_auth_router(db))
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

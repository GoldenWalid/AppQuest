from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from ai_system import awaken_chat_turn, generate_daily_quests

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ============ MODELS ============

def now_iso():
    return datetime.now(timezone.utc).isoformat()


RANK_ORDER = ["E", "D", "C", "B", "A", "S"]


def level_from_xp(total_xp: int) -> int:
    # Level N requires cumulative (N-1)**2 * 100 XP.
    # level 1: 0 XP, level 2: 100 XP, level 3: 400 XP, level 4: 900 XP, ...
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


class ProfileInit(BaseModel):
    name: str
    about_me: str = ""
    main_goal: str
    context: str = ""


class ProfileOut(BaseModel):
    id: str
    name: str
    about_me: str
    main_goal: str
    context: str
    class_title: str
    system_message: str
    initiated: bool
    created_at: str


class QuestOut(BaseModel):
    id: str
    title: str
    description: str
    xp_reward: int
    rank: str
    status: str  # active | completed
    type: str    # main | sub | parallel | daily
    skill: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str
    date_for: Optional[str] = None  # for daily quests: YYYY-MM-DD


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


# ============ HELPERS ============

PROFILE_KEY = "singleton"


async def get_profile_doc():
    return await db.profile.find_one({"_id": PROFILE_KEY}, {"_id": 0})


async def compute_stats() -> StatsOut:
    quests = await db.quests.find({"status": "completed"}, {"_id": 0}).to_list(5000)
    total_xp = sum(q.get("xp_reward", 0) for q in quests)
    level = level_from_xp(total_xp)
    xp_curr = xp_for_level(level)
    xp_next = xp_for_level(level + 1)
    # streak
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
                days_back += 1  # allow today as not yet done
                continue
            break

    # attributes derived from skills
    skills = await db.skills.find({}, {"_id": 0}).to_list(1000)
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


async def check_achievements() -> List[dict]:
    """Check and unlock achievements based on current stats. Returns newly unlocked."""
    stats = await compute_stats()
    locked = await db.achievements.find({"unlocked": False}, {"_id": 0}).to_list(500)
    newly = []
    for ach in locked:
        cond = ach.get("condition", "").lower()
        rank = ach.get("rank", "E")
        rank_threshold = {"E": 1, "D": 5, "C": 10, "B": 15, "A": 20, "S": 25}.get(rank, 1)
        unlock = False
        # simple heuristic: rank-based level threshold OR quest count thresholds
        if stats.level >= rank_threshold:
            # also require some completed quests commensurate
            if stats.quests_completed >= max(1, rank_threshold // 2):
                unlock = True
        if "streak" in cond and stats.daily_streak >= 3:
            unlock = True
        if "première" in cond or "first" in cond:
            if stats.quests_completed >= 1:
                unlock = True
        if unlock:
            await db.achievements.update_one(
                {"id": ach["id"]},
                {"$set": {"unlocked": True, "unlocked_at": now_iso()}},
            )
            ach["unlocked"] = True
            ach["unlocked_at"] = now_iso()
            newly.append(ach)
    return newly


# ============ ROUTES ============

@api_router.get("/")
async def root():
    return {"message": "SYSTEM ONLINE"}


@api_router.get("/profile", response_model=Optional[ProfileOut])
async def get_profile():
    doc = await get_profile_doc()
    if not doc:
        return None
    return ProfileOut(**doc)


@api_router.post("/profile/initiate", response_model=ProfileOut)
async def initiate_profile_legacy(data: ProfileInit):
    """Legacy form-based onboarding (kept for compat / tests).
    Use POST /api/awaken/chat for the conversational flow.
    """
    # Synthesize a minimal conversation history and run a single chat turn
    history = [
        {"role": "assistant", "content": "Salut Hunter, qui es-tu ?"},
        {"role": "user", "content": f"Je m'appelle {data.name}. {data.about_me}"},
        {"role": "assistant", "content": "Quel est ton objectif ?"},
        {"role": "user", "content": data.main_goal},
        {"role": "assistant", "content": "Quel est ton contexte ?"},
        {"role": "user", "content": data.context or "Pas de contexte particulier."},
        {"role": "user", "content": "Génère maintenant l'architecture complète, j'ai donné toutes les infos nécessaires."},
    ]
    sid = f"legacy-{uuid.uuid4()}"
    try:
        result = await awaken_chat_turn(sid, history)
        # Force one more turn if not ready
        attempts = 0
        while not result.get("done") and attempts < 4:
            history.append({"role": "assistant", "content": result.get("message", "")})
            history.append({"role": "user", "content": "Génère maintenant le JSON architecture complet."})
            result = await awaken_chat_turn(sid, history)
            attempts += 1
        if not result.get("done"):
            raise HTTPException(status_code=500, detail="System could not generate architecture")
        arch = result["architecture"]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("legacy initiate failed")
        raise HTTPException(status_code=500, detail=f"System awakening failed: {str(e)}")

    return await _save_architecture(
        name=data.name,
        about_me=data.about_me,
        main_goal=data.main_goal,
        context=data.context,
        arch=arch,
    )


class ChatMsg(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    session_id: str
    messages: List[ChatMsg] = []


@api_router.post("/awaken/chat")
async def awaken_chat(req: ChatReq):
    """Run one turn of the holistic awakening conversation.

    Returns either:
      {"done": false, "message": "next AI question"}
      {"done": true, "profile": {...}, "system_message": "..."}
    """
    history = [m.model_dump() for m in req.messages]
    try:
        result = await awaken_chat_turn(req.session_id, history)
    except Exception as e:
        logger.exception("awaken_chat failed")
        raise HTTPException(status_code=500, detail=f"System error: {str(e)}")

    if not result.get("done"):
        return {"done": False, "message": result["message"]}

    arch = result["architecture"]
    # Build readable transcript as 'about_me' / 'main_goal' fallback
    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in history if m["role"] == "user")
    name = arch.get("hunter_name") or _extract_name_from_history(history) or "Hunter"
    main_quest = arch.get("main_quest", {})
    profile = await _save_architecture(
        name=name,
        about_me=transcript[:2000],
        main_goal=main_quest.get("title", ""),
        context="",
        arch=arch,
    )
    return {"done": True, "profile": profile.model_dump(), "system_message": profile.system_message}


def _extract_name_from_history(history: List[dict]) -> Optional[str]:
    """Heuristic: try to find a first name in the first user message."""
    for m in history:
        if m["role"] == "user":
            text = m["content"].strip()
            # very simple: first word capitalized
            words = re.findall(r"\b([A-ZÉÈÊÀÂÎÔÛÇ][a-zéèêàâîôûç]{2,})\b", text)
            if words:
                return words[0]
            break
    return None


async def _save_architecture(
    name: str,
    about_me: str,
    main_goal: str,
    context: str,
    arch: dict,
) -> ProfileOut:
    """Persist profile + skills + quests + achievements based on AI architecture."""
    pid = str(uuid.uuid4())
    profile = {
        "id": pid,
        "name": name,
        "about_me": about_me,
        "main_goal": main_goal,
        "context": context,
        "class_title": arch.get("class_title", "Hunter"),
        "system_message": arch.get("system_message", "Welcome, Hunter."),
        "initiated": True,
        "created_at": now_iso(),
    }

    # Reset
    await db.profile.delete_many({})
    await db.quests.delete_many({})
    await db.skills.delete_many({})
    await db.achievements.delete_many({})

    await db.profile.insert_one({"_id": PROFILE_KEY, **profile})

    # Skills
    for s in arch.get("parallel_skills", []):
        await db.skills.insert_one({
            "id": str(uuid.uuid4()),
            "name": s.get("name", "Skill"),
            "description": s.get("description", ""),
            "icon": s.get("icon", "star"),
            "level": 1,
            "xp": 0,
            "xp_to_next": 100,
        })

    # Main quest
    mq = arch.get("main_quest", {})
    await db.quests.insert_one({
        "id": str(uuid.uuid4()),
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
    })

    # Sub goals
    for sg in arch.get("sub_goals", []):
        await db.quests.insert_one({
            "id": str(uuid.uuid4()),
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
        })

    # Parallel objectives
    for po in arch.get("parallel_objectives", []):
        await db.quests.insert_one({
            "id": str(uuid.uuid4()),
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
        })

    # Initial daily quests
    today_str = date.today().isoformat()
    for dq in arch.get("initial_daily_quests", []):
        await db.quests.insert_one({
            "id": str(uuid.uuid4()),
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
        })

    # Achievements (fallback if AI returns empty)
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
            "title": ach.get("title", "Achievement"),
            "description": ach.get("description", ""),
            "rank": ach.get("rank", "E"),
            "condition": ach.get("condition", ""),
            "unlocked": False,
            "unlocked_at": None,
        })

    return ProfileOut(**profile)


@api_router.get("/stats", response_model=StatsOut)
async def stats():
    return await compute_stats()


@api_router.get("/quests", response_model=List[QuestOut])
async def list_quests(type: Optional[str] = None, status: Optional[str] = None):
    q = {}
    if type:
        q["type"] = type
    if status:
        q["status"] = status
    docs = await db.quests.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # filter daily to today only
    if type == "daily":
        today_str = date.today().isoformat()
        docs = [d for d in docs if d.get("date_for") == today_str]
    return [QuestOut(**d) for d in docs]


@api_router.post("/quests/{quest_id}/complete", response_model=CompleteResult)
async def complete_quest(quest_id: str):
    q = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    if q["status"] == "completed":
        raise HTTPException(status_code=400, detail="Already completed")

    prev_stats = await compute_stats()
    prev_level = prev_stats.level

    await db.quests.update_one(
        {"id": quest_id},
        {"$set": {"status": "completed", "completed_at": now_iso()}},
    )

    # award skill XP
    if q.get("skill"):
        skill = await db.skills.find_one({"name": q["skill"]}, {"_id": 0})
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
                {"id": skill["id"]},
                {"$set": {"xp": new_xp, "level": new_level, "xp_to_next": xp_to_next}},
            )

    new_stats = await compute_stats()
    leveled_up = new_stats.level > prev_level
    newly_unlocked = await check_achievements()

    q = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    return CompleteResult(
        quest=QuestOut(**q),
        xp_gained=q["xp_reward"],
        leveled_up=leveled_up,
        new_level=new_stats.level if leveled_up else None,
        new_rank=new_stats.rank if leveled_up else None,
        unlocked_achievements=[AchievementOut(**a) for a in newly_unlocked],
    )


@api_router.post("/quests/generate-daily")
async def gen_daily():
    profile = await get_profile_doc()
    if not profile:
        raise HTTPException(status_code=400, detail="No profile")
    skills = await db.skills.find({}, {"_id": 0}).to_list(100)
    today_str = date.today().isoformat()
    completed_today = await db.quests.count_documents(
        {"type": "daily", "date_for": today_str, "status": "completed"}
    )
    try:
        result = await generate_daily_quests(profile, skills, completed_today)
    except Exception as e:
        logger.exception("daily gen failed")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    created = []
    for dq in result.get("daily_quests", []):
        doc = {
            "id": str(uuid.uuid4()),
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
        }
        await db.quests.insert_one(doc)
        created.append(QuestOut(**doc))
    return {"system_message": result.get("system_message", ""), "daily_quests": created}


@api_router.get("/skills", response_model=List[SkillOut])
async def list_skills():
    docs = await db.skills.find({}, {"_id": 0}).to_list(100)
    return [SkillOut(**d) for d in docs]


@api_router.get("/achievements", response_model=List[AchievementOut])
async def list_achievements():
    docs = await db.achievements.find({}, {"_id": 0}).to_list(500)
    # unlocked first
    docs.sort(key=lambda d: (not d.get("unlocked", False), d.get("title", "")))
    return [AchievementOut(**d) for d in docs]


@api_router.post("/reset")
async def reset_all():
    await db.profile.delete_many({})
    await db.quests.delete_many({})
    await db.skills.delete_many({})
    await db.achievements.delete_many({})
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

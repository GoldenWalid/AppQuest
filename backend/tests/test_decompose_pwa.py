"""Tests for new features: PWA manifest + Quest decomposition + Step toggle auto-complete."""
import os
import uuid
from datetime import datetime, timezone
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://xp-goal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def seeded(session, db):
    """Reset DB and seed minimal profile + 1 active quest + 1 completed quest directly."""
    r = session.post(f"{API}/reset", timeout=15)
    assert r.status_code == 200

    # seed profile (needed for decompose context)
    db.profile.insert_one({
        "_id": "singleton",
        "id": str(uuid.uuid4()),
        "name": "TEST_Hunter",
        "about_me": "tester",
        "main_goal": "Become senior dev in 12 months",
        "context": "",
        "class_title": "Cartographe du Code",
        "system_message": "Welcome.",
        "initiated": True,
        "created_at": now_iso(),
    })

    active_qid = str(uuid.uuid4())
    completed_qid = str(uuid.uuid4())
    db.quests.insert_many([
        {
            "id": active_qid,
            "title": "Écrire un article technique de 1500 mots",
            "description": "Rédiger un post de blog sur FastAPI async patterns.",
            "xp_reward": 300,
            "rank": "B",
            "status": "active",
            "type": "sub",
            "skill": None,
            "completed_at": None,
            "created_at": now_iso(),
            "date_for": None,
            "steps": [],
        },
        {
            "id": completed_qid,
            "title": "Quête déjà complétée",
            "description": "...",
            "xp_reward": 100,
            "rank": "D",
            "status": "completed",
            "type": "daily",
            "skill": None,
            "completed_at": now_iso(),
            "created_at": now_iso(),
            "date_for": None,
            "steps": [],
        },
    ])
    return {"active_qid": active_qid, "completed_qid": completed_qid}


# ============ PWA TESTS ============
def test_pwa_manifest_json(session):
    r = session.get(f"{BASE_URL}/manifest.json", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Hunter Protocol — SYSTEM"
    assert data["short_name"] == "SYSTEM"
    assert data["display"] == "standalone"
    assert data["start_url"] == "/"
    assert data["theme_color"] == "#00E5FF"
    assert isinstance(data["icons"], list) and len(data["icons"]) >= 1
    assert data["icons"][0]["src"] == "/icon.svg"


def test_pwa_icon_svg(session):
    r = session.get(f"{BASE_URL}/icon.svg", timeout=15)
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "svg" in ct.lower(), f"unexpected content-type {ct}"
    assert b"<svg" in r.content[:500]


def test_index_html_has_manifest_and_apple_touch(session):
    r = session.get(f"{BASE_URL}/", timeout=15)
    assert r.status_code == 200
    body = r.text
    assert 'rel="manifest"' in body
    assert 'href="/manifest.json"' in body
    assert 'apple-touch-icon' in body


# ============ DECOMPOSE TESTS ============
def test_quests_includes_steps_field(session, seeded):
    r = session.get(f"{API}/quests", timeout=10)
    assert r.status_code == 200
    quests = r.json()
    assert any(q["id"] == seeded["active_qid"] for q in quests)
    for q in quests:
        assert "steps" in q
        assert isinstance(q["steps"], list)


def test_decompose_nonexistent_returns_404(session, seeded):
    r = session.post(f"{API}/quests/nonexistent-zzz/decompose", timeout=20)
    assert r.status_code == 404


def test_decompose_completed_returns_400(session, seeded):
    r = session.post(f"{API}/quests/{seeded['completed_qid']}/decompose", timeout=20)
    assert r.status_code == 400


def test_decompose_active_quest_creates_steps(session, seeded):
    qid = seeded["active_qid"]
    r = session.post(f"{API}/quests/{qid}/decompose", timeout=120)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "quest" in data and "system_message" in data
    quest = data["quest"]
    assert quest["id"] == qid
    assert isinstance(quest["steps"], list)
    assert 3 <= len(quest["steps"]) <= 5
    for s in quest["steps"]:
        assert "id" in s and "title" in s
        assert s["done"] is False

    # verify persisted via GET
    g = session.get(f"{API}/quests", timeout=10).json()
    persisted = next(x for x in g if x["id"] == qid)
    assert len(persisted["steps"]) == len(quest["steps"])


# ============ STEP TOGGLE / AUTO-COMPLETE TESTS ============
def test_toggle_step_invalid_quest_returns_404(session):
    r = session.patch(f"{API}/quests/zzz/steps/yyy", json={"done": True}, timeout=10)
    assert r.status_code == 404


def test_toggle_step_invalid_step_returns_404(session, seeded):
    qid = seeded["active_qid"]
    r = session.patch(f"{API}/quests/{qid}/steps/badstep", json={"done": True}, timeout=10)
    assert r.status_code == 404


def test_toggle_all_steps_auto_completes_and_awards_xp(session, seeded):
    qid = seeded["active_qid"]
    # fetch current steps
    quests = session.get(f"{API}/quests", timeout=10).json()
    quest = next(q for q in quests if q["id"] == qid)
    steps = quest["steps"]
    assert len(steps) >= 3, "decompose should have populated steps in earlier test"
    expected_xp = quest["xp_reward"]

    stats_before = session.get(f"{API}/stats", timeout=10).json()
    xp_before = stats_before["total_xp"]

    last_idx = len(steps) - 1
    for i, s in enumerate(steps):
        r = session.patch(
            f"{API}/quests/{qid}/steps/{s['id']}",
            json={"done": True}, timeout=15,
        )
        assert r.status_code == 200, f"step {i}: {r.status_code} {r.text}"
        body = r.json()
        if i < last_idx:
            assert body["auto_completed"] is False
            assert body["completion"] is None
        else:
            assert body["auto_completed"] is True
            assert body["completion"] is not None
            assert body["completion"]["xp_gained"] == expected_xp
            assert body["completion"]["quest"]["status"] == "completed"
            assert body["quest"]["status"] == "completed"

    # verify persistence
    stats_after = session.get(f"{API}/stats", timeout=10).json()
    assert stats_after["total_xp"] == xp_before + expected_xp
    assert stats_after["quests_completed"] >= 1

    # toggling a step on already-completed quest's step shouldn't re-trigger completion
    # (the completion path is gated by status==active)
    r2 = session.patch(
        f"{API}/quests/{qid}/steps/{steps[0]['id']}",
        json={"done": False}, timeout=10,
    )
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2["auto_completed"] is False

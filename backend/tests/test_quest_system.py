"""End-to-end tests for the Solo Leveling quest system backend."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://xp-goal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def reset_state(session):
    r = session.post(f"{API}/reset", timeout=15)
    assert r.status_code == 200
    return True


# ===== Health =====
def test_root(session):
    r = session.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json()["message"] == "SYSTEM ONLINE"


def test_profile_initial_null(session, reset_state):
    r = session.get(f"{API}/profile", timeout=10)
    assert r.status_code == 200
    assert r.json() is None


# ===== Awakening (Claude AI) =====
@pytest.fixture(scope="module")
def initiated_profile(session, reset_state):
    payload = {
        "name": "TEST_Hunter",
        "about_me": "Développeur passionné par l'IA et l'auto-amélioration",
        "main_goal": "Devenir développeur full-stack senior en 12 mois",
        "context": "Je travaille actuellement comme dev junior",
    }
    r = session.post(f"{API}/profile/initiate", json=payload, timeout=120)
    assert r.status_code == 200, f"Awakening failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["initiated"] is True
    assert data["class_title"]
    assert data["system_message"]
    assert data["name"] == "TEST_Hunter"
    return data


def test_get_profile_after_init(session, initiated_profile):
    r = session.get(f"{API}/profile", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data is not None
    assert data["initiated"] is True
    assert data["name"] == "TEST_Hunter"


def test_skills_populated(session, initiated_profile):
    r = session.get(f"{API}/skills", timeout=10)
    assert r.status_code == 200
    skills = r.json()
    assert isinstance(skills, list)
    assert len(skills) >= 3, f"Expected 3+ skills, got {len(skills)}"
    for s in skills:
        assert s["level"] == 1
        assert s["xp"] == 0
        assert s["xp_to_next"] == 100
        assert "name" in s and "icon" in s


def test_main_quest_exists(session, initiated_profile):
    r = session.get(f"{API}/quests?type=main", timeout=10)
    assert r.status_code == 200
    quests = r.json()
    assert len(quests) == 1
    assert quests[0]["type"] == "main"
    assert quests[0]["status"] == "active"


def test_sub_goals_exist(session, initiated_profile):
    r = session.get(f"{API}/quests?type=sub", timeout=10)
    assert r.status_code == 200
    quests = r.json()
    assert len(quests) >= 4, f"Expected 4+ sub goals, got {len(quests)}"


def test_parallel_objectives(session, initiated_profile):
    r = session.get(f"{API}/quests?type=parallel", timeout=10)
    assert r.status_code == 200
    quests = r.json()
    assert len(quests) >= 2


def test_daily_quests_initial(session, initiated_profile):
    r = session.get(f"{API}/quests?type=daily", timeout=10)
    assert r.status_code == 200
    quests = r.json()
    assert len(quests) >= 3


def test_achievements_populated(session, initiated_profile):
    r = session.get(f"{API}/achievements", timeout=10)
    assert r.status_code == 200
    achs = r.json()
    assert len(achs) >= 6
    for a in achs:
        assert a["unlocked"] is False


# ===== Stats =====
def test_stats_initial(session, initiated_profile):
    r = session.get(f"{API}/stats", timeout=10)
    assert r.status_code == 200
    s = r.json()
    assert s["total_xp"] == 0
    assert s["level"] == 1
    assert s["rank"] == "E"
    assert s["quests_completed"] == 0
    assert isinstance(s["attributes"], dict)
    assert len(s["attributes"]) >= 3


# ===== Quest Completion =====
def test_complete_daily_quest(session, initiated_profile):
    r = session.get(f"{API}/quests?type=daily", timeout=10)
    quests = r.json()
    assert quests
    qid = quests[0]["id"]
    xp = quests[0]["xp_reward"]

    cr = session.post(f"{API}/quests/{qid}/complete", timeout=15)
    assert cr.status_code == 200
    result = cr.json()
    assert result["quest"]["status"] == "completed"
    assert result["xp_gained"] == xp
    assert "leveled_up" in result

    # verify persistence via stats
    s = session.get(f"{API}/stats", timeout=10).json()
    assert s["quests_completed"] >= 1
    assert s["total_xp"] >= xp


def test_complete_already_completed_returns_400(session, initiated_profile):
    r = session.get(f"{API}/quests?status=completed", timeout=10)
    completed = r.json()
    assert completed
    qid = completed[0]["id"]
    cr = session.post(f"{API}/quests/{qid}/complete", timeout=10)
    assert cr.status_code == 400


def test_complete_invalid_id(session):
    cr = session.post(f"{API}/quests/nonexistent-id/complete", timeout=10)
    assert cr.status_code == 404


# ===== Daily Generation =====
def test_generate_daily(session, initiated_profile):
    before = session.get(f"{API}/quests?type=daily", timeout=10).json()
    r = session.post(f"{API}/quests/generate-daily", timeout=120)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "daily_quests" in data
    assert len(data["daily_quests"]) >= 1
    after = session.get(f"{API}/quests?type=daily", timeout=10).json()
    assert len(after) > len(before)


# ===== Reset =====
def test_reset_clears_everything(session, initiated_profile):
    r = session.post(f"{API}/reset", timeout=15)
    assert r.status_code == 200
    assert session.get(f"{API}/profile", timeout=10).json() is None
    assert session.get(f"{API}/skills", timeout=10).json() == []
    assert session.get(f"{API}/achievements", timeout=10).json() == []
    assert session.get(f"{API}/quests", timeout=10).json() == []

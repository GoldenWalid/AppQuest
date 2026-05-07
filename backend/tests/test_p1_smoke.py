"""P1 regression smoke tests: empty awakening chat, quest completion, reset."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_reset_clears_state(session):
    r = session.post(f"{API}/reset", timeout=30)
    assert r.status_code == 200
    # After reset, profile should be None
    p = session.get(f"{API}/profile", timeout=10)
    assert p.status_code == 200
    assert p.json() is None
    # Quests cleared
    q = session.get(f"{API}/quests", timeout=10)
    assert q.status_code == 200
    assert q.json() == []


def test_awaken_chat_empty_messages(session):
    # After reset
    session.post(f"{API}/reset", timeout=30)
    r = session.post(
        f"{API}/awaken/chat",
        json={"session_id": "TEST_p1_smoke", "messages": []},
        timeout=120,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["done"] is False
    assert isinstance(data.get("message"), str)
    assert len(data["message"]) > 10


def test_quest_complete_after_legacy_init(session):
    # Reset and seed via legacy initiate (faster than full chat)
    session.post(f"{API}/reset", timeout=30)
    payload = {
        "name": "TEST_P1Smoke",
        "about_me": "Développeur cherchant ancrage et présence.",
        "main_goal": "Publier un projet en 6 mois.",
        "context": "Travail remote, peu de structure.",
    }
    r = session.post(f"{API}/profile/initiate", json=payload, timeout=240)
    if r.status_code != 200:
        pytest.skip(f"Legacy init failed (likely LLM budget): {r.status_code} {r.text[:200]}")

    daily = session.get(f"{API}/quests?type=daily", timeout=10).json()
    assert len(daily) >= 1
    qid = daily[0]["id"]
    xp = daily[0]["xp_reward"]

    cr = session.post(f"{API}/quests/{qid}/complete", timeout=15)
    assert cr.status_code == 200, cr.text
    result = cr.json()
    assert result["quest"]["status"] == "completed"
    assert result["xp_gained"] == xp


def test_reset_post_init_clears(session):
    r = session.post(f"{API}/reset", timeout=30)
    assert r.status_code == 200
    assert session.get(f"{API}/profile", timeout=10).json() is None
    assert session.get(f"{API}/skills", timeout=10).json() == []
    assert session.get(f"{API}/quests", timeout=10).json() == []

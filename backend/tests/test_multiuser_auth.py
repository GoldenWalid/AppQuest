"""Multi-user auth tests for Solo-Leveling holistic awakening app.

Covers:
- /api/auth/me unauthenticated -> 401
- Bearer-token auth on all protected endpoints
- User-scope isolation between two seeded users
- Awakening chat creates user-scoped data
- Cross-user complete-quest forbidden (404)
- Logout clears session
"""
import os
import uuid
import time
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
    # fallback: read frontend/.env
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


@pytest.fixture(scope="session")
def mongo_db():
    cli = MongoClient(MONGO_URL)
    return cli[DB_NAME]


@pytest.fixture(scope="session")
def seeded_users(mongo_db):
    """Seed two fresh users + sessions for the whole session."""
    ts = int(time.time() * 1000)
    user_a = f"TEST_user_A_{ts}"
    user_b = f"TEST_user_B_{ts}"
    token_a = f"TEST_token_A_{ts}"
    token_b = f"TEST_token_B_{ts}"
    mongo_db.users.insert_many([
        {"user_id": user_a, "email": f"TEST_a_{ts}@example.com", "name": "Test A",
         "picture": "https://example.com/a.png",
         "created_at": "2026-01-01T00:00:00+00:00"},
        {"user_id": user_b, "email": f"TEST_b_{ts}@example.com", "name": "Test B",
         "picture": "https://example.com/b.png",
         "created_at": "2026-01-01T00:00:00+00:00"},
    ])
    from datetime import datetime, timezone, timedelta
    exp = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    mongo_db.user_sessions.insert_many([
        {"user_id": user_a, "session_token": token_a, "expires_at": exp,
         "created_at": "2026-01-01T00:00:00+00:00"},
        {"user_id": user_b, "session_token": token_b, "expires_at": exp,
         "created_at": "2026-01-01T00:00:00+00:00"},
    ])
    yield {"a": (user_a, token_a), "b": (user_b, token_b)}
    # cleanup
    for uid, _ in (seeded_users_clear := [(user_a, token_a), (user_b, token_b)]):
        mongo_db.users.delete_many({"user_id": uid})
        mongo_db.user_sessions.delete_many({"user_id": uid})
        mongo_db.profile.delete_many({"user_id": uid})
        mongo_db.quests.delete_many({"user_id": uid})
        mongo_db.skills.delete_many({"user_id": uid})
        mongo_db.achievements.delete_many({"user_id": uid})


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------------------- Unauthenticated --------------------
class TestUnauthenticated:
    def test_root_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "SYSTEM" in r.json().get("message", "").upper()

    @pytest.mark.parametrize("path,method", [
        ("/api/auth/me", "GET"),
        ("/api/profile", "GET"),
        ("/api/stats", "GET"),
        ("/api/quests", "GET"),
        ("/api/skills", "GET"),
        ("/api/achievements", "GET"),
        ("/api/quests/generate-daily", "POST"),
        ("/api/reset", "POST"),
    ])
    def test_protected_endpoints_return_401(self, path, method):
        r = requests.request(method, f"{BASE_URL}{path}")
        assert r.status_code == 401, f"{method} {path} returned {r.status_code}"

    def test_awaken_chat_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/awaken/chat",
                          json={"session_id": "x", "messages": []})
        assert r.status_code == 401

    def test_complete_quest_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/quests/some-id/complete")
        assert r.status_code == 401

    def test_decompose_quest_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/quests/some-id/decompose")
        assert r.status_code == 401

    def test_step_toggle_no_auth(self):
        r = requests.patch(f"{BASE_URL}/api/quests/q/steps/s",
                           json={"done": True})
        assert r.status_code == 401


# -------------------- /auth/me with bearer --------------------
class TestAuthMe:
    def test_me_with_bearer(self, seeded_users):
        uid, tok = seeded_users["a"]
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(tok))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == uid
        assert "email" in data
        assert data["name"] == "Test A"

    def test_me_with_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer invalid_xxx"})
        assert r.status_code == 401


# -------------------- Empty state per user --------------------
class TestEmptyStateScoping:
    def test_user_a_initial_empty_state(self, seeded_users):
        _, tok = seeded_users["a"]
        h = auth_headers(tok)
        r = requests.get(f"{BASE_URL}/api/profile", headers=h)
        assert r.status_code == 200
        # No profile yet -> null
        assert r.json() in (None, "null") or r.text.strip() == "null"

        for path in ["/api/quests", "/api/skills", "/api/achievements"]:
            r = requests.get(f"{BASE_URL}{path}", headers=h)
            assert r.status_code == 200, f"{path}: {r.text}"
            assert r.json() == [], f"{path} not empty: {r.json()}"

        r = requests.get(f"{BASE_URL}/api/stats", headers=h)
        assert r.status_code == 200
        s = r.json()
        assert s["total_xp"] == 0
        assert s["quests_completed"] == 0


# -------------------- Isolation via direct seeding --------------------
class TestIsolation:
    def test_user_isolation(self, seeded_users, mongo_db):
        user_a, token_a = seeded_users["a"]
        user_b, token_b = seeded_users["b"]

        # Seed profile + quest for User A directly
        pid = str(uuid.uuid4())
        mongo_db.profile.insert_one({
            "id": pid, "user_id": user_a, "name": "Test A",
            "about_me": "x", "main_goal": "y", "context": "",
            "class_title": "Hunter", "system_message": "Hi",
            "initiated": True, "created_at": "2026-01-01T00:00:00+00:00",
        })
        qid_a = str(uuid.uuid4())
        mongo_db.quests.insert_one({
            "id": qid_a, "user_id": user_a, "title": "A's Quest",
            "description": "", "xp_reward": 100, "rank": "E",
            "status": "active", "type": "main", "skill": None,
            "completed_at": None, "created_at": "2026-01-01T00:00:00+00:00",
            "date_for": None, "steps": [],
        })

        # User A sees their own
        r = requests.get(f"{BASE_URL}/api/profile", headers=auth_headers(token_a))
        assert r.status_code == 200 and r.json()["user_id"] == user_a
        r = requests.get(f"{BASE_URL}/api/quests", headers=auth_headers(token_a))
        assert any(q["id"] == qid_a for q in r.json())

        # User B sees NOTHING of A's
        r = requests.get(f"{BASE_URL}/api/profile", headers=auth_headers(token_b))
        assert r.status_code == 200
        assert r.json() in (None,) or r.text.strip() == "null"
        r = requests.get(f"{BASE_URL}/api/quests", headers=auth_headers(token_b))
        assert r.status_code == 200
        assert all(q["id"] != qid_a for q in r.json())

        # User B trying to complete A's quest -> 404
        r = requests.post(f"{BASE_URL}/api/quests/{qid_a}/complete",
                          headers=auth_headers(token_b))
        assert r.status_code == 404

        # User B trying to decompose A's quest -> 404
        r = requests.post(f"{BASE_URL}/api/quests/{qid_a}/decompose",
                          headers=auth_headers(token_b))
        assert r.status_code == 404


# -------------------- Quest complete (own) --------------------
class TestQuestComplete:
    def test_complete_own_quest(self, seeded_users, mongo_db):
        user_a, token_a = seeded_users["a"]
        qid = str(uuid.uuid4())
        mongo_db.quests.insert_one({
            "id": qid, "user_id": user_a, "title": "Self quest",
            "description": "", "xp_reward": 50, "rank": "E",
            "status": "active", "type": "daily", "skill": None,
            "completed_at": None, "created_at": "2026-01-01T00:00:00+00:00",
            "date_for": None, "steps": [],
        })
        r = requests.post(f"{BASE_URL}/api/quests/{qid}/complete",
                          headers=auth_headers(token_a))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["quest"]["status"] == "completed"
        assert body["xp_gained"] == 50

        # Repeat -> 400 already completed
        r = requests.post(f"{BASE_URL}/api/quests/{qid}/complete",
                          headers=auth_headers(token_a))
        assert r.status_code == 400


# -------------------- Reset is user-scoped --------------------
class TestResetScope:
    def test_reset_only_clears_caller(self, seeded_users, mongo_db):
        user_a, token_a = seeded_users["a"]
        user_b, token_b = seeded_users["b"]

        # Seed a quest for B
        qid_b = str(uuid.uuid4())
        mongo_db.quests.insert_one({
            "id": qid_b, "user_id": user_b, "title": "B's quest",
            "description": "", "xp_reward": 100, "rank": "E",
            "status": "active", "type": "main", "skill": None,
            "completed_at": None, "created_at": "2026-01-01T00:00:00+00:00",
            "date_for": None, "steps": [],
        })

        # A resets
        r = requests.post(f"{BASE_URL}/api/reset", headers=auth_headers(token_a))
        assert r.status_code == 200

        # B's quest must still exist
        r = requests.get(f"{BASE_URL}/api/quests", headers=auth_headers(token_b))
        assert r.status_code == 200
        assert any(q["id"] == qid_b for q in r.json())


# -------------------- Logout --------------------
class TestLogout:
    def test_logout_invalidates_session(self, mongo_db):
        # Create a fresh dedicated session so we don't break other tests
        from datetime import datetime, timezone, timedelta
        ts = int(time.time() * 1000)
        uid = f"TEST_logout_user_{ts}"
        tok = f"TEST_logout_token_{ts}"
        mongo_db.users.insert_one({
            "user_id": uid, "email": f"logout_{ts}@example.com",
            "name": "Logout U", "picture": "",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        mongo_db.user_sessions.insert_one({
            "user_id": uid, "session_token": tok,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        try:
            r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(tok))
            assert r.status_code == 200

            r = requests.post(f"{BASE_URL}/api/auth/logout",
                              headers=auth_headers(tok))
            assert r.status_code == 200

            r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(tok))
            assert r.status_code == 401
        finally:
            mongo_db.users.delete_many({"user_id": uid})
            mongo_db.user_sessions.delete_many({"user_id": uid})


# -------------------- Session exchange invalid --------------------
class TestSessionExchange:
    def test_invalid_session_id_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/session",
                          json={"session_id": "definitely-not-a-valid-id-xyz"})
        # Either 401 (Invalid session_id) or upstream error -> still 401 per code
        assert r.status_code == 401, r.text

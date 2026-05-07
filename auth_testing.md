# Emergent Auth Integration Playbook (saved for testing reference)

This file contains the testing playbook for the Emergent-managed Google OAuth integration.
The full integration playbook content is in the integration_playbook_expert_v2 response; this
file is a quick reference for testing agents.

## Test setup (mongosh)
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Backend test
```
curl -X GET "{API_URL}/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Browser test
```
await page.context.add_cookies([{
    "name": "session_token", "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com", "path": "/",
    "httpOnly": True, "secure": True, "sameSite": "None"
}])
```

## Endpoints
- POST /api/auth/session  — body {session_id} → exchanges with auth.emergentagent.com → sets cookie + returns user
- GET  /api/auth/me       — returns current user (cookie or Authorization header)
- POST /api/auth/logout   — clears session

## Data model
- users: {user_id (custom UUID), email, name, picture, created_at}
- user_sessions: {user_id, session_token, expires_at, created_at}

All app collections (profile, quests, skills, achievements) MUST be scoped by user_id.

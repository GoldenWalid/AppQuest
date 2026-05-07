# Hunter Protocol — Solo Leveling Quest System (PRD)

## Original Problem Statement (FR)
Application de quêtes style Solo Leveling. L'utilisateur rentre son profil, son objectif principal et son contexte. L'IA détermine les compétences, sous-objectifs, objectifs parallèles, compétences parallèles pour rester focus. Système de niveaux (E→S), quêtes journalières avec XP, succès/récompenses, notifications navigateur pour les quêtes du jour.

## Architecture
- **Backend**: FastAPI + MongoDB + Claude Sonnet 4.5 (via emergentintegrations + EMERGENT_LLM_KEY)
- **Frontend**: React + Tailwind + Shadcn + Framer Motion + Orbitron/JetBrains Mono
- **No auth** — single-user mono-local app

## Data Model (MongoDB)
- `profile` (singleton): id, name, about_me, main_goal, context, class_title, system_message, initiated
- `quests`: id, title, description, xp_reward, rank (E–S), status (active/completed), type (main/sub/parallel/daily), skill, completed_at, date_for
- `skills`: id, name, description, icon, level, xp, xp_to_next
- `achievements`: id, title, description, rank, condition, unlocked, unlocked_at

## XP/Level formula
- xp_for_level(N) = (N-1)² × 100 ⇒ L1=0, L2=100, L3=400, L4=900, L5=1600, ...
- Rank: E (<5), D (<10), C (<15), B (<20), A (<25), S (25+)

## API Routes (all /api)
- GET /, GET /profile, POST /profile/initiate
- GET /stats, GET /quests?type=&status=, POST /quests/{id}/complete, POST /quests/generate-daily
- GET /skills, GET /achievements, POST /reset

## User Personas
- Solo doer: someone working toward a big personal goal, needs structured gamification + daily focus.

## What's Implemented (2026-02-07)
- Awakening onboarding (4-step form): name → about_me → main_goal → context
- AI generates: class_title, system_message, main_quest, sub_goals, parallel_skills, parallel_objectives, initial_daily_quests, achievements
- Dashboard: avatar-style stats (level, XP bar, rank, streak, quests completed), skills grid with individual level/XP, main quest panel
- Quest Log: tabs Daily / Sub / Parallel, complete button → XP + skill XP + level-up modal + achievement unlocks
- Generate new daily quests via Claude
- Achievements page: unlocked/locked grid
- Browser notification permission toggle
- Reset system
- Dark cyber/neon blue Solo Leveling aesthetic (Orbitron + JetBrains Mono + Chakra Petch, corner frames, scan lines, pulse borders, XP bar shine)

## Prioritized Backlog
- P1: scheduled reminder (service worker / cron-like client-side) for daily quest notifications
- P1: quest streak rewards (bonus XP)
- P2: skill tree visualization
- P2: export/share progress
- P2: dark/light/custom themes per rank
- P2: multi-user + auth (if needed later)

## Update 2026-02-07 — Conversational Holistic Awakening
- Replaced static 4-step form onboarding with adaptive AI conversation (chat UI).
- New endpoint `POST /api/awaken/chat` (Claude Sonnet 4.5) covers 8 dimensions: identité, environnement, corps & habitudes, ombres & traumas, connexion au réel, valeurs profondes, vision/devenir, objectifs du mois.
- AI now generates UNIQUE class_title and UNIQUE skills (poetic, sur-mesure — banned generic terms like "Discipline"/"Focus"/"Warrior"/"Mage").
- Tone: solennel, dramatique, bienveillant — outil personnel de transformation/renaissance holistique (pour les clients d'un coach).
- Safety guard: AI is forced to finalize after 12 user turns to avoid infinite questioning.
- Legacy `/api/profile/initiate` kept for back-compat (single retry now to limit token burn).
- Chat UI: bubble messages SYSTEM/HUNTER, thinking indicator, auto-scroll, Enter-to-send.

## Verified Tests
- iter 3: backend pytest 7/8 (1 transient LLM budget cap, no code defect), frontend 100%.
- Real conversation produces e.g. class_title='Artisan du Réel Enraciné' with unique poetic skills.

## Update 2026-02-07 (iter 5) — PWA + Quest decomposition
- **PWA installable**: `/manifest.json` + `/icon.svg` (cyber diamond) + meta tags (apple-touch-icon, theme-color). App installable comme PWA → rappels persistants via service worker.
- **Décomposition de quête**: nouveau bouton "Trop dur ? Décomposer en micro-actions" sur chaque quête active.
  - Backend: `POST /api/quests/{id}/decompose` (Claude), `PATCH /api/quests/{id}/steps/{sid}` (toggle).
  - 3-5 micro-actions ultra-concrètes (verbes d'action, 2-15 min chacune).
  - Quand toutes les steps sont cochées → quête auto-complétée + XP + level-up modal.
- Helper `_complete_quest_internal()` extrait pour DRY (utilisé par /complete et auto-complete).
- iter 5 tests: backend 10/10 + frontend 100% (decompose E2E, auto-complete + level-up E2E, PWA manifest servi).

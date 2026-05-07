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

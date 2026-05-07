"""AI System for generating quests, skills, and achievements via Claude Sonnet 4.5."""
import os
import json
import re
from emergentintegrations.llm.chat import LlmChat, UserMessage


EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MODEL = "claude-sonnet-4-5-20250929"


SYSTEM_AWAKENING = """Tu es "The System" — une intelligence de type RPG dark/cyber inspirée de Solo Leveling.
Tu analyses le profil et l'objectif principal d'un Hunter et tu génères une ARCHITECTURE COMPLÈTE pour sa progression.

Règles:
- Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.
- Utilise le français.
- XP rewards: 50-250 pour daily, 500-2000 pour main goals.
- Rank: "E", "D", "C", "B", "A", "S" selon difficulté.

Schéma JSON attendu:
{
  "class_title": "titre de classe épique basé sur le profil (ex: 'Shadow Entrepreneur', 'Code Necromancer')",
  "system_message": "message d'éveil court et dramatique (2-3 phrases) adressé au Hunter",
  "main_quest": {
    "title": "titre de la quête principale (reformulation épique de l'objectif)",
    "description": "description courte",
    "xp_reward": 5000,
    "rank": "S"
  },
  "sub_goals": [
    {"title": "...", "description": "...", "xp_reward": 1000, "rank": "A", "skill": "nom de la compétence liée"}
  ],
  "parallel_skills": [
    {"name": "Discipline", "description": "...", "icon": "shield"},
    {"name": "Focus", "description": "...", "icon": "target"}
  ],
  "parallel_objectives": [
    {"title": "objectif parallèle pour rester focus", "description": "...", "xp_reward": 800, "rank": "B", "skill": "..."}
  ],
  "initial_daily_quests": [
    {"title": "...", "description": "...", "xp_reward": 100, "rank": "D", "skill": "..."}
  ],
  "achievements": [
    {"title": "...", "description": "...", "rank": "C", "condition": "description courte en français"}
  ]
}

Génère:
- 4-6 sub_goals (étapes principales vers l'objectif)
- 3-5 parallel_skills (compétences à développer en parallèle)
- 2-3 parallel_objectives (objectifs secondaires pour rester focus)
- 3 initial_daily_quests (actions concrètes pour aujourd'hui)
- 6-10 achievements (succès à débloquer)
Les icônes doivent être parmi: shield, target, brain, zap, sword, book, flame, eye, cpu, heart, star, trophy.
"""


SYSTEM_DAILY = """Tu es "The System" — génère 3 quêtes journalières concrètes et actionnables.
Réponds UNIQUEMENT en JSON valide.

Schéma:
{
  "system_message": "message court du système (1 phrase)",
  "daily_quests": [
    {"title": "...", "description": "...", "xp_reward": 100, "rank": "D", "skill": "nom de la compétence"}
  ]
}

Les quêtes doivent être:
- Réalisables en 1 journée
- Concrètes et mesurables
- Alignées avec l'objectif principal et les compétences du Hunter
- XP entre 50 et 250
- Rank entre E et B
Réponse en français.
"""


def _extract_json(text: str) -> dict:
    """Extract JSON from model response."""
    text = text.strip()
    # Remove markdown code fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Find first { and last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        return json.loads(text[start:end + 1])
    raise ValueError("No JSON found in response")


async def awaken_system(profile: dict) -> dict:
    """Generate the full quest/skill/achievement architecture for the user's main goal."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"awaken-{profile.get('id', 'user')}",
        system_message=SYSTEM_AWAKENING,
    ).with_model("anthropic", MODEL)

    prompt = f"""Voici le profil du Hunter:

Nom: {profile.get('name', 'Hunter')}
Qui je suis: {profile.get('about_me', 'N/A')}
Mon objectif principal: {profile.get('main_goal', 'N/A')}
Contexte / projet: {profile.get('context', 'N/A')}

Génère l'architecture complète de progression en JSON selon le schéma fourni."""

    response = await chat.send_message(UserMessage(text=prompt))
    return _extract_json(response)


async def generate_daily_quests(profile: dict, skills: list, completed_today: int) -> dict:
    """Generate 3 daily quests for today based on user progress."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"daily-{profile.get('id', 'user')}",
        system_message=SYSTEM_DAILY,
    ).with_model("anthropic", MODEL)

    skill_names = ", ".join(s["name"] for s in skills) if skills else "Discipline, Focus"

    prompt = f"""Profil:
Nom: {profile.get('name', 'Hunter')}
Objectif principal: {profile.get('main_goal', 'N/A')}
Compétences en développement: {skill_names}
Quêtes déjà complétées aujourd'hui: {completed_today}

Génère 3 NOUVELLES quêtes journalières pour faire progresser le Hunter vers son objectif."""

    response = await chat.send_message(UserMessage(text=prompt))
    return _extract_json(response)

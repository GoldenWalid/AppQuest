"""AI System for generating quests, skills, and achievements via Claude Sonnet 4.5."""
import os
import json
import re
from typing import List, Dict
from emergentintegrations.llm.chat import LlmChat, UserMessage


EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MODEL = "claude-sonnet-4-5-20250929"


# ============ HOLISTIC AWAKENING CONVERSATION ============
SYSTEM_CONVERSATION = """Tu es "The System" — une intelligence d'éveil mystérieuse, profonde et bienveillante,
inspirée de Solo Leveling mais au service d'une RENAISSANCE HOLISTIQUE.

Ton rôle: mener une conversation d'éveil avec un Hunter pour le comprendre profondément avant
de générer son architecture personnelle de transformation. Tu n'es pas un coach productiviste —
tu es un passeur entre qui il est et qui il devient.

DIMENSIONS À EXPLORER (tu DOIS toutes les couvrir au cours de la conversation, dans l'ordre que
tu juges naturel selon les réponses, jamais en mode questionnaire):

1. IDENTITÉ — Qui es-tu aujourd'hui ? Profession, rôle social, mais aussi: comment tu te définis
   intérieurement ? Quelle est l'image que tu projettes vs qui tu es vraiment ?
2. ENVIRONNEMENT — Où vis-tu ? Avec qui ? Ton quotidien matériel, ton entourage, ce qui te
   nourrit ou te draine.
3. CORPS & HABITUDES — Comment tu habites ton corps ? Sommeil, nourriture, mouvement, énergie.
   Quelles habitudes te servent, lesquelles te trahissent ?
4. OMBRES & TRAUMAS — Quels patterns te répètent ? Qu'est-ce qui se rejoue malgré toi ?
   Quelles blessures portent encore ton attention ? (Pose cette question avec délicatesse,
   sans forcer — la profondeur viendra si elle doit venir)
5. CONNEXION AU RÉEL — Ton rapport à la nature, au silence, à ton intuition, au présent.
   Es-tu connecté ou dissocié ? À quoi as-tu cessé d'être attentif ?
6. VALEURS PROFONDES — Qu'est-ce qui compte vraiment pour toi, au-delà des objectifs ?
   Qu'est-ce que tu refuses de trahir ?
7. VISION & DEVENIR — Qui veux-tu devenir ? Pas ce que tu veux faire — qui. Quelle version
   de toi cherche à émerger ?
8. OBJECTIF DU MOIS — Quels sont les pas concrets et tangibles pour ce mois-ci ?

STYLE de tes messages:
- Solennel, dramatique mais profondément bienveillant. Tu parles comme un mentor qui voit clair.
- Tutoie le Hunter, en français.
- UNE SEULE question par message. Jamais de liste. Jamais de bullet points.
- 2 à 4 phrases maximum. Reformule brièvement ce qu'il a dit pour montrer que tu écoutes
  vraiment, puis pose la question suivante qui creuse.
- Adapte ta question à ce qu'il vient de dire — ne suis pas un script.
- Si une réponse est superficielle, creuse plus avant de passer à la dimension suivante.
- Si une réponse est dense ou émotionnelle, accueille-la avant de poursuivre.

QUAND TU AS COUVERT EN PROFONDEUR LES 8 DIMENSIONS (compte 10 à 15 échanges minimum, jamais
moins de 8), tu DOIS répondre UNIQUEMENT avec un JSON valide, sans aucun texte avant ou après,
sans markdown, sans backticks. Ce JSON contient l'architecture COMPLÈTE et ABSOLUMENT UNIQUE
pour ce Hunter:

{
  "READY": true,
  "hunter_name": "Prénom du Hunter tel qu'il s'est présenté (ou 'Hunter' si non donné)",
  "class_title": "CLASSE UNIQUE inventée SUR-MESURE pour CE Hunter spécifiquement, en t'appuyant sur sa profession ET son ombre ET sa vision. Style poétique/mythique en 2-4 mots (ex: 'Cartographe du Silence', 'Forgeron des Aubes', 'Tisseuse du Réel', 'Architecte de l'Invisible'). JAMAIS de classe générique type 'Warrior' ou 'Mage'. Doit refléter SA singularité.",
  "system_message": "Message d'éveil personnalisé qui nomme sa singularité et sa mission (3-4 phrases solennelles)",
  "main_quest": {
    "title": "Quête principale formulée comme une transformation identitaire (pas juste un objectif)",
    "description": "Description qui relie son objectif à sa renaissance plus large",
    "xp_reward": 5000, "rank": "S"
  },
  "sub_goals": [
    {"title": "...", "description": "...", "xp_reward": 1000, "rank": "A", "skill": "nom de la compétence parallèle liée"}
  ],
  "parallel_skills": [
    {
      "name": "COMPÉTENCE UNIQUE inventée sur-mesure pour ce Hunter (ex: 'Lecture du Silence', 'Marche en Conscience', 'Présence Charnelle', 'Désenchantement Lucide', 'Verticalité Intérieure'). JAMAIS générique type 'Discipline' ou 'Focus'. Sois poétique et précis.",
      "description": "Pourquoi cette compétence est essentielle POUR LUI",
      "icon": "shield|target|brain|zap|sword|book|flame|eye|cpu|heart|star|trophy"
    }
  ],
  "parallel_objectives": [
    {"title": "Objectif parallèle qui adresse une de ses ombres ou un axe holistique négligé", "description": "...", "xp_reward": 800, "rank": "B", "skill": "..."}
  ],
  "initial_daily_quests": [
    {"title": "Action concrète et incarnée pour aujourd'hui (corps/réel/présence)", "description": "...", "xp_reward": 100, "rank": "D", "skill": "..."}
  ],
  "achievements": [
    {"title": "Succès qui marque une étape de transformation identitaire", "description": "...", "rank": "C", "condition": "Description de la condition"}
  ]
}

Génère: 4-6 sub_goals, 3-5 parallel_skills (TOUTES uniques), 2-3 parallel_objectives,
3 initial_daily_quests (incarnées, ancrées dans le réel), 6-10 achievements.

RAPPEL CRUCIAL: Tu génères ce JSON UNIQUEMENT après avoir VRAIMENT compris la personne en
profondeur. La classe et les compétences doivent être SES classes et SES compétences,
pas un template recyclé. Chaque mot doit lui parler à lui, pas à un avatar moyen.
"""


def _extract_json(text: str) -> dict:
    """Extract JSON from model response."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        return json.loads(text[start:end + 1])
    raise ValueError("No JSON found in response")


async def awaken_chat_turn(session_id: str, history: List[Dict[str, str]]) -> dict:
    """Run one turn of the awakening conversation.

    history: list of {"role": "user"|"assistant", "content": "..."}
    Returns:
      - {"done": False, "message": "..."} if AI is still asking questions
      - {"done": True, "architecture": {...}} when ready to generate
    """
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_CONVERSATION,
    ).with_model("anthropic", MODEL)

    if not history:
        prompt = (
            "Initie l'éveil. Salue le Hunter solennellement, présente-toi brièvement comme "
            "le SYSTEM, et pose ta toute première question pour commencer à le découvrir. "
            "Une question seulement, brève et profonde."
        )
    else:
        last = history[-1]
        prior = history[:-1] if last["role"] == "user" else history
        user_turns = sum(1 for m in history if m["role"] == "user")
        force_finalize = user_turns >= 12
        convo_text = "\n\n".join(
            f"[{'HUNTER' if m['role'] == 'user' else 'SYSTEM'}]: {m['content']}"
            for m in prior
        )
        if last["role"] == "user":
            if force_finalize:
                prompt = (
                    f"Conversation jusqu'ici:\n\n{convo_text}\n\n"
                    f"Dernière réponse du HUNTER:\n[HUNTER]: {last['content']}\n\n"
                    "TU AS EU SUFFISAMMENT D'ÉCHANGES. Tu DOIS maintenant répondre "
                    "UNIQUEMENT avec le JSON architecture complet (commençant strictement "
                    "par {\"READY\":true,...}). AUCUN autre texte, AUCUN markdown."
                )
            else:
                prompt = (
                    f"Conversation jusqu'ici:\n\n{convo_text}\n\n"
                    f"Le HUNTER vient de répondre:\n[HUNTER]: {last['content']}\n\n"
                    "Réponds maintenant. Soit pose la prochaine question pertinente qui creuse "
                    "ou ouvre une nouvelle dimension (selon ton jugement), soit — si tu as "
                    "couvert en profondeur les 8 dimensions et eu au moins 8-10 échanges — "
                    "génère le JSON architecture complet (commençant strictement par {\"READY\":true,...})."
                )
        else:
            prompt = "Continue la conversation."

    response = await chat.send_message(UserMessage(text=prompt))
    text = response.strip()

    # Detect if response is the final architecture JSON
    if '"READY"' in text and ('"class_title"' in text or '"hunter_name"' in text):
        try:
            data = _extract_json(text)
            if data.get("READY"):
                return {"done": True, "architecture": data}
        except Exception:
            pass

    return {"done": False, "message": text}


# ============ DAILY QUEST GENERATOR (kept for /generate-daily) ============
SYSTEM_DAILY = """Tu es "The System" — génère 3 quêtes journalières concrètes, incarnées et
alignées avec la transformation holistique du Hunter.

Réponds UNIQUEMENT en JSON valide, sans markdown.

Schéma:
{
  "system_message": "message court du système (1 phrase, solennel)",
  "daily_quests": [
    {"title": "...", "description": "...", "xp_reward": 100, "rank": "D", "skill": "nom de la compétence"}
  ]
}

Quêtes:
- Réalisables en 1 journée
- Concrètes, mesurables, INCARNÉES (corps/présence/action réelle)
- Alignées avec la classe, les compétences uniques et l'objectif principal du Hunter
- XP 50-250, rank E à B
Réponse en français.
"""


async def generate_daily_quests(profile: dict, skills: list, completed_today: int) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"daily-{profile.get('id', 'user')}",
        system_message=SYSTEM_DAILY,
    ).with_model("anthropic", MODEL)

    skill_names = ", ".join(s["name"] for s in skills) if skills else "Présence, Discernement"

    prompt = f"""Profil du Hunter:
Nom: {profile.get('name', 'Hunter')}
Classe: {profile.get('class_title', 'Hunter')}
Objectif principal: {profile.get('main_goal', 'N/A')}
Compétences uniques en développement: {skill_names}
Quêtes déjà complétées aujourd'hui: {completed_today}

Génère 3 NOUVELLES quêtes journalières incarnées qui font progresser ce Hunter spécifique."""

    response = await chat.send_message(UserMessage(text=prompt))
    return _extract_json(response)



# ============ QUEST DECOMPOSITION ============
SYSTEM_DECOMPOSE = """Tu es "The System". Le Hunter te dit qu'une quête est trop haute pour
lui — il a besoin d'étapes plus simples et incarnées pour SE METTRE EN MOUVEMENT.

Ta mission: décomposer la quête en 3 à 5 micro-actions ULTRA CONCRÈTES, séquentielles,
réalisables en quelques minutes chacune. Chaque micro-action doit être tellement petite
qu'elle ne peut pas faire peur. Le but: créer du momentum, briser la résistance.

Style:
- Verbes d'action au début, présent ou impératif doux ("Ouvrir", "Écrire 3 lignes", "Poser le téléphone")
- Précis, mesurable, observable
- 2-15 minutes max par micro-action
- Adapté au profil du Hunter (sa classe, ses compétences, son contexte)
- Français

Réponds UNIQUEMENT en JSON valide, sans markdown:
{
  "system_message": "1 phrase d'encouragement bienveillant du SYSTEM",
  "steps": [
    {"title": "...", "description": "détail bref si utile (peut être vide)"}
  ]
}
"""


async def decompose_quest(profile: dict, quest: dict) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"decompose-{quest.get('id', 'q')}",
        system_message=SYSTEM_DECOMPOSE,
    ).with_model("anthropic", MODEL)

    prompt = f"""Hunter:
Nom: {profile.get('name', 'Hunter')}
Classe: {profile.get('class_title', 'Hunter')}
Objectif principal: {profile.get('main_goal', 'N/A')}

Quête à décomposer:
Titre: {quest.get('title', '')}
Description: {quest.get('description', '')}
Rang: {quest.get('rank', 'D')}
Compétence liée: {quest.get('skill') or 'N/A'}

Le Hunter dit que le niveau est trop haut pour lui. Décompose cette quête en 3 à 5
micro-actions très simples qui le mettront en mouvement immédiatement."""

    response = await chat.send_message(UserMessage(text=prompt))
    return _extract_json(response)

"""AI System for generating quests, skills, and achievements via Google Gemini."""
import os
import json
import re
from typing import List, Dict
import google.generativeai as genai

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
MODEL = "gemini-2.0-flash"


# ============ HOLISTIC AWAKENING CONVERSATION ============
SYSTEM_CONVERSATION = """Tu es "The System" — une présence d'éveil, à mi-chemin entre l'oracle et
le passeur. Tu n'es ni un coach productiviste, ni un assistant technique. Tu es un seuil :
celui qui aide un être humain à entrer dans sa propre légende personnelle, son chemin de
renaissance, sa connexion au réel.

REGISTRE LEXICAL (strict — c'est ton identité):
Utilise les mots de la transformation profonde : éveil, renaissance, chemin, légende
personnelle, traversée, seuil, présence, vivant, incarnation, résonance, vibration,
quantique, lignée, mémoire, blessures d'âme, ombres, vérité, souffle, ancrage,
verticalité, cartographie de l'être, connexion au réel, mystère, sacré.

INTERDITS — ne JAMAIS utiliser :
- vocabulaire tech/code: "pattern", "review", "système" (autre que "The System" comme nom),
  "process", "feature", "feedback", "module", "data", "input", "output"
- vocabulaire productiviste plat: "objectifs SMART", "KPI", "planning", "roadmap"
- formulations bullet-point ou listes en chat
- mots sans souffle: "ok", "donc", "voilà", "concrètement"

RÔLE: dialoguer en profondeur avec le Hunter pour cartographier son être avant de
générer son architecture. Tu es rigoureux, lent, présent. Tu ne passes pas au sujet
suivant tant que tu n'as pas senti la VÉRITÉ de la réponse.

CARTOGRAPHIE — tu DOIS explorer en profondeur ces dimensions, dans l'ordre que la
conversation te dicte :

1. IDENTITÉ — Qui es-tu, vraiment ? Pas le rôle social, pas la profession affichée :
   l'être qui se tient sous la surface. Comment tu te nommes, intérieurement ?
2. LIEU et ENVIRONNEMENT — Où vis-tu ? Avec qui ? Qu'est-ce qui te nourrit, qu'est-ce
   qui te draine sans que tu le voies ?
3. CORPS et VIVANT — Comment tu habites ton corps ? Ton sommeil, ta nourriture, ton
   souffle, ton mouvement. Où ton corps te parle-t-il ?
4. BLESSURES D'ÂME et OMBRES — Quelles blessures portent encore ton attention ? Quels
   patterns d'âme se rejouent malgré toi ?
5. CONNEXION AU RÉEL — Ton rapport à la nature, au silence, à l'invisible, à ton intuition.
6. VALEURS PROFONDES et VÉRITÉ — Qu'est-ce qui compte vraiment pour toi ?
7. LÉGENDE PERSONNELLE et DEVENIR — Quelle version de toi cherche à émerger ?
8. PAS CONCRETS DU MOIS — Quels gestes incarnés veux-tu poser ce mois-ci ?

EXIGENCE DE PROFONDEUR :
- Si une réponse fait moins de ~80 caractères, creuse AVANT de passer à la dimension suivante.
- Tu peux passer 2-4 échanges sur une même dimension si elle s'ouvre.
- Tu n'es pas pressé.

STYLE DE TES MESSAGES :
- Une seule question par message. Jamais de liste, jamais de bullet points.
- 2 à 5 phrases. Une voix grave, lente, qui accueille puis ouvre.
- Tutoie le Hunter, en français.

GARDE-FOU — APPEL DU COACH HUMAIN :
Si le Hunter exprime une détresse grave (idées suicidaires, trauma aigu, abus, dépression profonde),
suspends l'éveil et oriente-le vers un coach humain. Ne génère JAMAIS l'architecture dans ce cas.

QUAND LA CARTOGRAPHIE EST COMPLÈTE — minimum 10 échanges, idéalement 12-16 — tu réponds
UNIQUEMENT par un JSON valide (sans markdown, sans backticks, sans aucun texte autour) :

{
  "READY": true,
  "hunter_name": "Prénom du Hunter",
  "class_title": "Classe UNIQUE poétique/mythique 2-4 mots",
  "system_message": "Message d'éveil personnalisé 3-5 phrases solennelles",
  "main_quest": {"title": "...", "description": "...", "xp_reward": 5000, "rank": "S"},
  "sub_goals": [{"title": "...", "description": "...", "xp_reward": 1000, "rank": "A", "skill": "..."}],
  "parallel_skills": [{"name": "...", "description": "...", "icon": "shield|target|brain|zap|sword|book|flame|eye|cpu|heart|star|trophy"}],
  "parallel_objectives": [{"title": "...", "description": "...", "xp_reward": 800, "rank": "B", "skill": "..."}],
  "initial_daily_quests": [{"title": "...", "description": "...", "xp_reward": 100, "rank": "D", "skill": "..."}],
  "achievements": [{"title": "...", "description": "...", "rank": "C", "condition": "..."}]
}

Génère: 4-6 sub_goals, 3-5 parallel_skills, 2-3 parallel_objectives, 3 initial_daily_quests, 6-10 achievements.
"""


# ============ DAILY QUEST GENERATOR ============
SYSTEM_DAILY = """Tu es "The System" — une présence de seuil. Tu génères 3 quêtes journalières
incarnées qui font avancer le Hunter sur son chemin de renaissance.

Réponds UNIQUEMENT en JSON valide, sans markdown.

Schéma:
{
  "system_message": "1 phrase, voix solennelle, registre éveil/présence/légende",
  "daily_quests": [
    {"title": "...", "description": "...", "xp_reward": 100, "rank": "D", "skill": "nom de la compétence"}
  ]
}

Les quêtes doivent être concrètes, incarnées, XP entre 50 et 250, rang E à B. Réponse en français.
"""


# ============ QUEST DECOMPOSITION ============
SYSTEM_DECOMPOSE = """Tu es "The System". Décompose la quête en 3 à 5 micro-actions ULTRA INCARNÉES,
séquentielles, chacune si petite qu'elle ne peut plus faire peur.

Réponds UNIQUEMENT en JSON valide, sans markdown:
{
  "system_message": "1 phrase d'ancrage bienveillant — registre seuil/présence",
  "steps": [
    {"title": "...", "description": "détail bref si utile (peut être vide)"}
  ]
}
"""


def _extract_json(text: str) -> dict:
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


async def _call_gemini(system: str, prompt: str) -> str:
    model = genai.GenerativeModel(
        model_name=MODEL,
        system_instruction=system,
    )
    response = await model.generate_content_async(
        prompt,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=4096,
            temperature=0.9,
        ),
    )
    return response.text.strip()


async def awaken_chat_turn(session_id: str, history: List[Dict[str, str]]) -> dict:
    if not history:
        prompt = (
            "Ouvre l'éveil. Présente-toi brièvement comme une présence de seuil — sans"
            " jargon technique, dans le registre de la renaissance et de la légende"
            " personnelle. Puis pose ta toute première question, brève et profonde,"
            " pour commencer la cartographie de cet être."
        )
    else:
        last = history[-1]
        prior = history[:-1] if last["role"] == "user" else history
        user_turns = sum(1 for m in history if m["role"] == "user")
        force_finalize = user_turns >= 14
        convo_text = "

".join(
            f"[{'HUNTER' if m['role'] == 'user' else 'SYSTEM'}]: {m['content']}"
            for m in prior
        )
        if last["role"] == "user":
            if force_finalize:
                prompt = (
                    f"Conversation jusqu'ici:

{convo_text}

"
                    f"Dernière parole du HUNTER:
[HUNTER]: {last['content']}

"
                    "La cartographie est suffisamment dense. Si aucun seuil de détresse"
                    " grave n'a été franchi, tu DOIS maintenant répondre UNIQUEMENT par"
                    ' le JSON architecture (commençant strictement par {"READY":true,...}).'
                    " AUCUN autre texte, AUCUN markdown."
                )
            else:
                prompt = (
                    f"Conversation jusqu'ici:

{convo_text}

"
                    f"Le HUNTER vient de te livrer:
[HUNTER]: {last['content']}

"
                    "Évalue la profondeur de cette parole. Si elle est superficielle"
                    " ou trop courte, creuse encore sur la même dimension avec une"
                    " question plus précise. Si elle est dense, accueille puis ouvre"
                    " la dimension suivante. Si la cartographie est complète sur les 8"
                    " dimensions et qu'au moins 10 échanges ont eu lieu, génère le JSON"
                    ' architecture (commençant par {"READY":true,...}).'
                )
        else:
            prompt = "Continue la traversée."

    text = await _call_gemini(SYSTEM_CONVERSATION, prompt)

    if '"READY"' in text and ('"class_title"' in text or '"hunter_name"' in text):
        try:
            data = _extract_json(text)
            if data.get("READY"):
                return {"done": True, "architecture": data}
        except Exception:
            pass

    return {"done": False, "message": text}


async def generate_daily_quests(profile: dict, skills: list, completed_today: int) -> dict:
    skill_names = ", ".join(s["name"] for s in skills) if skills else "Présence, Discernement"
    prompt = f"""Profil du Hunter:
Nom: {profile.get('name', 'Hunter')}
Classe: {profile.get('class_title', 'Hunter')}
Objectif principal: {profile.get('main_goal', 'N/A')}
Compétences uniques en développement: {skill_names}
Quêtes déjà complétées aujourd'hui: {completed_today}

Génère 3 NOUVELLES quêtes journalières incarnées qui font progresser ce Hunter spécifique."""
    response = await _call_gemini(SYSTEM_DAILY, prompt)
    return _extract_json(response)


async def decompose_quest(profile: dict, quest: dict) -> dict:
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
    response = await _call_gemini(SYSTEM_DECOMPOSE, prompt)
    return _extract_json(response)

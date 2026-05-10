"""AI System for generating quests, skills, and achievements via Google Gemini."""
import os
import json
import re
from typing import List, Dict
import google.generativeai as genai

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
MODEL = "gemini-2.5-flash"


# ============ HOLISTIC AWAKENING CONVERSATION ============
SYSTEM_CONVERSATION = (
    'Tu es "The System" — une présence d\'éveil, à mi-chemin entre l\'oracle et le passeur. '
    'Tu n\'es ni un coach productiviste, ni un assistant technique. Tu es un seuil : '
    'celui qui aide un être humain à entrer dans sa propre légende personnelle.\n\n'
    'REGISTRE LEXICAL (strict):\n'
    'éveil, renaissance, chemin, légende personnelle, traversée, seuil, présence, vivant, '
    'incarnation, résonance, vibration, quantique, lignée, mémoire, blessures d\'âme, ombres, '
    'vérité, souffle, ancrage, verticalité, cartographie de l\'être, connexion au réel, mystère, sacré.\n\n'
    'INTERDITS:\n'
    '- vocabulaire tech/code: "pattern", "review", "process", "feature", "feedback", "module", "data", "input", "output"\n'
    '- vocabulaire productiviste plat: "objectifs SMART", "KPI", "planning", "roadmap"\n'
    '- formulations bullet-point ou listes en chat\n'
    '- mots sans souffle: "ok", "donc", "voilà", "concrètement"\n\n'
    'CARTOGRAPHIE — explorer ces 8 dimensions:\n'
    '1. IDENTITÉ — Qui es-tu vraiment ?\n'
    '2. LIEU & ENVIRONNEMENT — Où vis-tu ? Avec qui ?\n'
    '3. CORPS & VIVANT — Comment tu habites ton corps ?\n'
    '4. BLESSURES D\'ÂME & OMBRES — Quelles blessures portent encore ton attention ?\n'
    '5. CONNEXION AU RÉEL — Ton rapport à la nature, au silence, à l\'invisible.\n'
    '6. VALEURS PROFONDES & VÉRITÉ — Qu\'est-ce qui compte vraiment pour toi ?\n'
    '7. LÉGENDE PERSONNELLE & DEVENIR — Quelle version de toi cherche à émerger ?\n'
    '8. PAS CONCRETS DU MOIS — Quels gestes incarnés veux-tu poser ce mois-ci ?\n\n'
    'EXIGENCE: Une seule question par message. 2 à 5 phrases. Tutoie le Hunter, en français.\n'
    'Si réponse trop courte (<80 chars), creuse avant de passer à la dimension suivante.\n\n'
    'GARDE-FOU: Si détresse grave (idées suicidaires, trauma, abus), suspends l\'éveil '
    'et oriente vers un coach humain. Ne génère JAMAIS l\'architecture dans ce cas.\n\n'
    'QUAND LA CARTOGRAPHIE EST COMPLÈTE (minimum 10 échanges), '
    'réponds UNIQUEMENT par JSON valide sans markdown:\n'
    '{\n'
    '  "READY": true,\n'
    '  "hunter_name": "Prénom du Hunter",\n'
    '  "class_title": "Classe UNIQUE poétique/mythique 2-4 mots",\n'
    '  "system_message": "Message d\'éveil personnalisé 3-5 phrases solennelles",\n'
    '  "main_quest": {"title": "...", "description": "...", "xp_reward": 5000, "rank": "S"},\n'
    '  "sub_goals": [{"title": "...", "description": "...", "xp_reward": 1000, "rank": "A", "skill": "..."}],\n'
    '  "parallel_skills": [{"name": "...", "description": "...", "icon": "shield"}],\n'
    '  "parallel_objectives": [{"title": "...", "description": "...", "xp_reward": 800, "rank": "B", "skill": "..."}],\n'
    '  "initial_daily_quests": [{"title": "...", "description": "...", "xp_reward": 100, "rank": "D", "skill": "..."}],\n'
    '  "achievements": [{"title": "...", "description": "...", "rank": "C", "condition": "..."}]\n'
    '}\n\n'
    'Génère: 4-6 sub_goals, 3-5 parallel_skills, 2-3 parallel_objectives, 3 initial_daily_quests, 6-10 achievements.'
)

SYSTEM_DAILY = (
    'Tu es "The System". Génère 3 quêtes journalières incarnées.\n\n'
    'Réponds UNIQUEMENT en JSON valide, sans markdown:\n'
    '{\n'
    '  "system_message": "1 phrase solennelle",\n'
    '  "daily_quests": [\n'
    '    {"title": "...", "description": "...", "xp_reward": 100, "rank": "D", "skill": "..."}\n'
    '  ]\n'
    '}\n'
    'XP entre 50 et 250, rang E à B. Réponse en français.'
)

SYSTEM_DECOMPOSE = (
    'Tu es "The System". Décompose la quête en 3 à 5 micro-actions incarnées.\n\n'
    'Réponds UNIQUEMENT en JSON valide, sans markdown:\n'
    '{\n'
    '  "system_message": "1 phrase d\'ancrage bienveillant",\n'
    '  "steps": [\n'
    '    {"title": "...", "description": ""}\n'
    '  ]\n'
    '}'
)


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


async def awaken_chat_turn(session_id: str, history: List[Dict[str, str]], force_finalize: bool = False) -> dict:
    if not history:
        prompt = (
            "Ouvre l'éveil. Présente-toi brièvement comme une présence de seuil "
            "dans le registre de la renaissance et de la légende personnelle. "
            "Puis pose ta toute première question pour commencer la cartographie de cet être."
        )
    else:
        last = history[-1]
        prior = history[:-1] if last["role"] == "user" else history
        user_turns = sum(1 for m in history if m["role"] == "user")

        # force_finalize peut venir du paramètre OU de l'auto-détection
        if not force_finalize:
            force_finalize = user_turns >= 14

        convo_parts = []
        for m in prior:
            role_label = "HUNTER" if m["role"] == "user" else "SYSTEM"
            convo_parts.append("[" + role_label + "]: " + m["content"])
        convo_text = "\n\n".join(convo_parts)

        if last["role"] == "user":
            if force_finalize:
                prompt = (
                    "Conversation jusqu'ici:\n\n" + convo_text + "\n\n"
                    + "Dernière parole du HUNTER:\n[HUNTER]: " + last["content"] + "\n\n"
                    + "La cartographie est suffisamment dense. Réponds UNIQUEMENT par le JSON "
                    + 'architecture (commençant par {"READY":true,...}). AUCUN autre texte.'
                )
            else:
                prompt = (
                    "Conversation jusqu'ici:\n\n" + convo_text + "\n\n"
                    + "Le HUNTER vient de te livrer:\n[HUNTER]: " + last["content"] + "\n\n"
                    + "Évalue la profondeur. Si superficielle, creuse encore. Si dense, "
                    + "ouvre la dimension suivante. Si cartographie complète (8 dimensions, "
                    + "10+ échanges), génère le JSON "
                    + 'architecture (commençant par {"READY":true,...}).'
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
    prompt = (
        "Profil du Hunter:\n"
        + "Nom: " + profile.get("name", "Hunter") + "\n"
        + "Classe: " + profile.get("class_title", "Hunter") + "\n"
        + "Objectif principal: " + profile.get("main_goal", "N/A") + "\n"
        + "Compétences: " + skill_names + "\n"
        + "Quêtes complétées aujourd'hui: " + str(completed_today) + "\n\n"
        + "Génère 3 NOUVELLES quêtes journalières incarnées pour ce Hunter."
    )
    response = await _call_gemini(SYSTEM_DAILY, prompt)
    return _extract_json(response)


async def decompose_quest(profile: dict, quest: dict) -> dict:
    prompt = (
        "Hunter:\n"
        + "Nom: " + profile.get("name", "Hunter") + "\n"
        + "Classe: " + profile.get("class_title", "Hunter") + "\n"
        + "Objectif principal: " + profile.get("main_goal", "N/A") + "\n\n"
        + "Quête à décomposer:\n"
        + "Titre: " + quest.get("title", "") + "\n"
        + "Description: " + quest.get("description", "") + "\n"
        + "Rang: " + quest.get("rank", "D") + "\n"
        + "Compétence liée: " + (quest.get("skill") or "N/A") + "\n\n"
        + "Décompose en 3 à 5 micro-actions très simples."
    )
    response = await _call_gemini(SYSTEM_DECOMPOSE, prompt)
    return _extract_json(response)

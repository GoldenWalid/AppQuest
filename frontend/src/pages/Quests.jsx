import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Loader2, Sparkles, Swords, Layers,
  X, Timer, Play, Pause, Trophy, Star
} from "lucide-react";
import { toast } from "sonner";
import { RankBadge } from "@/components/RankBadge";
import { LevelUpModal } from "@/components/LevelUpModal";
import { api } from "@/lib/api";

const TABS = [
  { key: "daily", label: "Quêtes du Jour" },
  { key: "sub",   label: "Sous-Objectifs" },
  { key: "parallel", label: "Parallèles" },
];

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const start = useCallback(() => {
    if (!running) {
      setRunning(true);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
  }, [running]);

  const pause = useCallback(() => {
    setRunning(false);
    clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setSeconds(0);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  return { seconds, running, start, pause, reset, fmt };
}

function QuestModal({ quest, onClose, onComplete, onDecompose, onToggleStep, completing, decomposing, togglingStep }) {
  const timer = useTimer();
  const [validated, setValidated] = useState(false);
  const hasSteps = (quest.steps || []).length > 0;
  const stepsDone = (quest.steps || []).filter((s) => s.done).length;
  const totalSteps = (quest.steps || []).length;

  const handleValidate = async () => {
    setValidated(true);
    timer.start();
    toast.success("[ RENAISSANCE ] Quête activée — minuteur lancé !");
  };

  const handleComplete = async () => {
    timer.pause();
    const elapsed = timer.fmt(timer.seconds);
    await onComplete(quest, elapsed);
    onClose();
  };

  const handleDecline = () => {
    timer.reset();
    toast.info("Quête déclinée — elle restera disponible.");
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="quest-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 24, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className={`quest-modal corner-frame ${quest.rank === "S" ? "corner-frame-gold" : ""}`}
      >
        <div className="flex items-start justify-between p-6 pb-4" style={{ borderBottom: "1px solid rgba(0,255,135,0.12)" }}>
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <RankBadge rank={quest.rank} />
              {quest.skill && (
                <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "var(--purple)" }}>
                  /{quest.skill}
                </span>
              )}
              <span className="font-mono text-xs" style={{ color: "var(--gold)" }}>+{quest.xp_reward} XP</span>
            </div>
            <h2 className="font-display font-black uppercase tracking-wide text-lg sm:text-xl" style={{ color: "var(--green)" }}>
              {quest.title}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 transition hover:opacity-70" style={{ color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="leading-relaxed text-sm sm:text-base" style={{ color: "var(--text)" }}>
            {quest.description}
          </p>

          <AnimatePresence>
            {validated && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="sys-card p-5 text-center"
                style={{ border: "1px solid rgba(0,255,135,0.25)" }}
              >
                <div className="font-accent text-[10px] tracking-[0.4em] uppercase mb-3" style={{ color: "rgba(0,255,135,0.6)" }}>
                  [ TEMPS EN COURS ]
                </div>
                <div className={`timer-display ${timer.seconds > 3600 ? "timer-urgent" : ""}`}>
                  {timer.fmt(timer.seconds)}
                </div>
                <div className="flex gap-3 justify-center mt-3">
                  {timer.running ? (
                    <button onClick={timer.pause} className="sys-btn inline-flex items-center gap-2" style={{ padding: "0.4rem 0.9rem", fontSize: "0.7rem" }}>
                      <Pause size={12} /> Pause
                    </button>
                  ) : (
                    <button onClick={timer.start} className="sys-btn inline-flex items-center gap-2" style={{ padding: "0.4rem 0.9rem", fontSize: "0.7rem" }}>
                      <Play size={12} /> Reprendre
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {hasSteps && (
            <div>
              <div className="font-accent text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: "rgba(0,255,135,0.5)" }}>
                [ Micro-actions — {stepsDone}/{totalSteps} ]
              </div>
              <div className="space-y-2">
                {(quest.steps || []).map((s, idx) => {
                  const tid = `${quest.id}-${s.id}`;
                  const busy = togglingStep === tid;
                  return (
                    <div
                      key={s.id}
                      className="flex items-start gap-3 p-3"
                      style={{
                        border: s.done ? "1px solid rgba(0,255,135,0.35)" : "1px solid rgba(0,255,135,0.12)",
                        background: s.done ? "rgba(0,255,135,0.05)" : "rgba(8,12,14,0.6)",
                        transition: "all 0.2s",
                      }}
                    >
                      <button
                        onClick={() => onToggleStep(quest, s)}
                        disabled={busy || !validated}
                        className="mt-0.5 w-5 h-5 flex items-center justify-center transition"
                        style={{
                          border: s.done ? "1px solid var(--green)" : "1px solid rgba(0,255,135,0.4)",
                          background: s.done ? "var(--green)" : "transparent",
                          color: s.done ? "#000" : "transparent",
                          opacity: !validated ? 0.4 : 1,
                        }}
                      >
                        {busy ? <Loader2 size={11} className="animate-spin" style={{ color: "var(--green)" }} /> : s.done ? <Check size={12} strokeWidth={3} /> : null}
                      </button>
                      <div className="flex-1">
                        <div className="text-sm" style={{ color: s.done ? "var(--text-muted)" : "var(--text)", textDecoration: s.done ? "line-through" : "none" }}>
                          <span className="font-mono mr-2" style={{ color: "rgba(0,255,135,0.5)" }}>
                            {String(idx + 1).padStart(2, "0")}.
                          </span>
                          {s.title}
                        </div>
                        {s.description && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.description}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasSteps && validated && (
            <button
              onClick={() => onDecompose(quest)}
              disabled={decomposing}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest transition"
              style={{ color: "rgba(0,255,135,0.7)", fontFamily: "'Chakra Petch', sans-serif" }}
            >
              {decomposing ? <><Loader2 size={12} className="animate-spin" /> Décomposition...</> : <><Layers size={12} /> Trop difficile ? Décomposer en micro-actions</>}
            </button>
          )}
        </div>

        <div className="p-6 pt-0 flex flex-col sm:flex-row gap-3">
          {!validated ? (
            <>
              <button onClick={handleValidate} className="sys-btn flex-1 inline-flex items-center justify-center gap-2">
                <Play size={14} /> Valider et commencer
              </button>
              <button onClick={handleDecline} className="sys-btn-danger sys-btn flex-1 inline-flex items-center justify-center gap-2">
                <X size={14} /> Décliner
              </button>
            </>
          ) : (
            <>
              <button onClick={handleComplete} disabled={completing} className="sys-btn flex-1 inline-flex items-center justify-center gap-2">
                {completing ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                Quête complétée — +{quest.xp_reward} XP
              </button>
              <button onClick={onClose} className="sys-btn flex-1 inline-flex items-center justify-center gap-2" style={{ color: "var(--text-muted)", borderColor: "rgba(107,138,148,0.3)" }}>
                Continuer plus tard
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Quests() {
  const [tab, setTab] = useState("daily");
  const [questsByTab, setQuestsByTab] = useState({ daily: [], sub: [], parallel: [] });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [levelUp, setLevelUp] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [decomposing, setDecomposing] = useState(null);
  const [togglingStep, setTogglingStep] = useState(null);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [skillDrop, setSkillDrop] = useState(null);

  const load = async () => {
    setLoading(true);
    const [d, s, p] = await Promise.all([
      api.getQuests("daily"), api.getQuests("sub"), api.getQuests("parallel"),
    ]);
    setQuestsByTab({ daily: d, sub: s, parallel: p });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleLevelUpAndAchievements = (res) => {
    if (res.leveled_up) setLevelUp({ level: res.new_level, rank: res.new_rank });
    (res.unlocked_achievements || []).forEach((a) =>
      toast.success(`Succès débloqué: ${a.title}`, { description: a.description })
    );
    if (res.skill_drop) {
      setSkillDrop(res.skill_drop);
      setTimeout(() => setSkillDrop(null), 6000);
    }
    if (res.skill_leveled_up) {
      toast.success(`[ COMPÉTENCE ] ${res.skill_leveled_up.name} niveau ${res.skill_leveled_up.new_level} !`, {
        description: `+${res.skill_leveled_up.xp_gained} XP de compétence`,
      });
    }
  };

  const complete = async (q, elapsed) => {
    setCompleting(q.id);
    try {
      const res = await api.completeQuest(q.id);
      toast.success("Quête complétée !", { description: `+${res.xp_gained} XP${elapsed ? ` · ${elapsed}` : ""}` });
      handleLevelUpAndAchievements(res);
      await load();
    } catch (e) {
      toast.error("Erreur", { description: e?.response?.data?.detail || e.message });
    } finally {
      setCompleting(null);
    }
  };

  const decompose = async (q) => {
    setDecomposing(q.id);
    try {
      const res = await api.decomposeQuest(q.id);
      toast.success("Quête décomposée", { description: res.system_message });
      await load();
      const updated = await api.getQuests(tab);
      const freshQ = updated.find((x) => x.id === q.id);
      if (freshQ) setSelectedQuest(freshQ);
    } catch (e) {
      toast.error("Erreur", { description: e?.response?.data?.detail || e.message });
    } finally {
      setDecomposing(null);
    }
  };

  const toggleStep = async (q, step) => {
    const tid = `${q.id}-${step.id}`;
    setTogglingStep(tid);
    try {
      const res = await api.toggleStep(q.id, step.id, !step.done);
      if (res.auto_completed && res.completion) {
        toast.success("Toutes les étapes validées — quête complétée !", { description: `+${res.completion.xp_gained} XP` });
        handleLevelUpAndAchievements(res.completion);
        setSelectedQuest(null);
      }
      await load();
    } catch (e) {
      toast.error("Erreur", { description: e?.response?.data?.detail || e.message });
    } finally {
      setTogglingStep(null);
    }
  };

  const genDaily = async () => {
    setGenerating(true);
    try {
      const res = await api.genDaily();
      toast.success("[ RENAISSANCE ] Nouvelles quêtes générées", { description: res.system_message });
      await load();
    } catch (e) {
      toast.error("Erreur", { description: e?.response?.data?.detail || e.message });
    } finally {
      setGenerating(false);
    }
  };

  const current = questsByTab[tab] || [];
  const active = current.filter((q) => q.status === "active");
  const done = current.filter((q) => q.status === "completed");

  return (
    <div className="space-y-6" data-testid="quests-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="font-accent text-xs tracking-[0.4em] uppercase mb-1" style={{ color: "rgba(0,255,135,0.6)" }}>
            [ Quest Log ]
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tighter"
            style={{ color: "var(--green)", textShadow: "0 0 20px rgba(0,255,135,0.3)" }}>
            Objectifs Actifs
          </h1>
        </div>
        {tab === "daily" && (
          <button data-testid="generate-daily-btn" onClick={genDaily} disabled={generating}
            className="sys-btn inline-flex items-center gap-2 whitespace-nowrap">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Générer quêtes du jour
          </button>
        )}
      </div>

      <div className="flex gap-0 overflow-x-auto" style={{ borderBottom: "1px solid rgba(0,255,135,0.15)" }}>
        {TABS.map((t) => (
          <button key={t.key} data-testid={`tab-${t.key}`} onClick={() => setTab(t.key)}
            className="px-5 py-3 font-accent uppercase tracking-widest text-xs transition whitespace-nowrap"
            style={{
              borderBottom: tab === t.key ? "2px solid var(--green)" : "2px solid transparent",
              color: tab === t.key ? "var(--green)" : "var(--text-muted)",
            }}>
            {t.label} <span className="ml-1" style={{ color: "var(--text-muted)" }}>({questsByTab[t.key]?.length || 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="font-mono" style={{ color: "var(--green)" }}>Chargement...</div>
      ) : current.length === 0 ? (
        <div className="sys-card p-16 text-center">
          <Swords size={32} className="mx-auto mb-4" style={{ color: "rgba(0,255,135,0.4)" }} />
          <div className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>Aucune quête dans cette catégorie.</div>
          {tab === "daily" && (
            <button onClick={genDaily} disabled={generating} className="sys-btn mt-6">
              Générer mes premières quêtes
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence>
              {active.map((q) => (
                <QuestRow key={q.id} q={q} onClick={() => setSelectedQuest(q)} />
              ))}
            </AnimatePresence>
          </div>
          {done.length > 0 && (
            <div className="mt-8">
              <div className="font-accent text-xs tracking-[0.4em] uppercase mb-3" style={{ color: "rgba(107,138,148,0.5)" }}>
                [ Complétées — {done.length} ]
              </div>
              <div className="space-y-2 opacity-50">
                {done.map((q) => <QuestRow key={q.id} q={q} completed />)}
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedQuest && (
          <QuestModal
            quest={selectedQuest}
            onClose={() => setSelectedQuest(null)}
            onComplete={complete}
            onDecompose={decompose}
            onToggleStep={toggleStep}
            completing={completing === selectedQuest.id}
            decomposing={decomposing === selectedQuest.id}
            togglingStep={togglingStep}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {skillDrop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 skill-drop-card p-5 text-center"
            style={{ minWidth: 280, maxWidth: 340 }}
          >
            <div className="font-accent text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(139,92,246,0.8)" }}>
              [ COMPÉTENCE DÉBLOQUÉE ]
            </div>
            <Star size={28} className="mx-auto mb-2" style={{ color: "var(--purple)" }} />
            <div className="font-display font-black uppercase text-base" style={{ color: "var(--purple)" }}>
              {skillDrop.name}
            </div>
            <div className="font-mono text-xs mt-1" style={{ color: "rgba(139,92,246,0.7)" }}>Niveau 1 · +{skillDrop.xp} XP</div>
          </motion.div>
        )}
      </AnimatePresence>

      <LevelUpModal open={!!levelUp} level={levelUp?.level} rank={levelUp?.rank} onClose={() => setLevelUp(null)} />
    </div>
  );
}

const QuestRow = ({ q, onClick, completed }) => {
  const hasSteps = (q.steps || []).length > 0;
  const stepsDone = (q.steps || []).filter((s) => s.done).length;
  const totalSteps = (q.steps || []).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="sys-card p-4 sm:p-5 cursor-pointer"
      onClick={onClick}
      data-testid={`quest-card-${q.id}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <RankBadge rank={q.rank} />
            {q.skill && (
              <span className="text-[10px] tracking-[0.2em] uppercase font-mono" style={{ color: "var(--purple)" }}>
                /{q.skill}
              </span>
            )}
            <span className="font-mono text-xs" style={{ color: "var(--gold)" }}>+{q.xp_reward} XP</span>
            {hasSteps && !completed && (
              <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "rgba(0,255,135,0.6)" }}>
                · {stepsDone}/{totalSteps} étapes
              </span>
            )}
            {completed && (
              <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "rgba(0,255,135,0.5)" }}>
                · Complétée
              </span>
            )}
          </div>
          <div className="font-display font-bold uppercase tracking-wide text-sm sm:text-base" style={{ color: completed ? "var(--text-muted)" : "var(--text)", textDecoration: completed ? "line-through" : "none" }}>
            {q.title}
          </div>
          <p className="text-xs sm:text-sm mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {q.description}
          </p>
          {hasSteps && !completed && stepsDone > 0 && (
            <div className="mt-2 xp-bar" style={{ height: "4px" }}>
              <div className="xp-bar-fill" style={{ width: `${(stepsDone / totalSteps) * 100}%` }} />
            </div>
          )}
        </div>
        {!completed && (
          <div className="text-xs font-accent tracking-widest uppercase" style={{ color: "rgba(0,255,135,0.5)" }}>
            Ouvrir →
          </div>
        )}
      </div>
    </motion.div>
  );
};

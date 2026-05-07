import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Sparkles, Swords, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { RankBadge } from "@/components/RankBadge";
import { LevelUpModal } from "@/components/LevelUpModal";
import { api } from "@/lib/api";

const TABS = [
  { key: "daily", label: "Quêtes du Jour" },
  { key: "sub", label: "Sous-Objectifs" },
  { key: "parallel", label: "Parallèles" },
];

export default function Quests() {
  const [tab, setTab] = useState("daily");
  const [questsByTab, setQuestsByTab] = useState({ daily: [], sub: [], parallel: [] });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [levelUp, setLevelUp] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [decomposing, setDecomposing] = useState(null);
  const [togglingStep, setTogglingStep] = useState(null);
  const [openSteps, setOpenSteps] = useState({}); // questId -> bool

  const load = async () => {
    setLoading(true);
    const [d, s, p] = await Promise.all([
      api.getQuests("daily"),
      api.getQuests("sub"),
      api.getQuests("parallel"),
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
  };

  const complete = async (q) => {
    setCompleting(q.id);
    try {
      const res = await api.completeQuest(q.id);
      toast.success("Quête complétée", { description: `+${res.xp_gained} XP` });
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
      setOpenSteps((s) => ({ ...s, [q.id]: true }));
      await load();
    } catch (e) {
      toast.error("Erreur", { description: e?.response?.data?.detail || e.message });
    } finally {
      setDecomposing(null);
    }
  };

  const toggleStep = async (q, step) => {
    setTogglingStep(`${q.id}-${step.id}`);
    try {
      const res = await api.toggleStep(q.id, step.id, !step.done);
      if (res.auto_completed && res.completion) {
        toast.success("Toutes les étapes validées — quête complétée !", {
          description: `+${res.completion.xp_gained} XP`,
        });
        handleLevelUpAndAchievements(res.completion);
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
      toast.success("Nouvelles quêtes générées", { description: res.system_message });
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
          <div className="font-accent text-xs tracking-[0.4em] text-cyan-300/70 uppercase">[ Quest Log ]</div>
          <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-600">
            Objectifs Actifs
          </h1>
        </div>
        {tab === "daily" && (
          <button
            data-testid="generate-daily-btn"
            onClick={genDaily}
            disabled={generating}
            className="sys-btn inline-flex items-center gap-2 whitespace-nowrap"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Générer quêtes du jour
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-cyan-500/20 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            data-testid={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 font-accent uppercase tracking-widest text-xs border-b-2 transition whitespace-nowrap ${
              tab === t.key
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-500 hover:text-cyan-300"
            }`}
          >
            {t.label} <span className="ml-1 text-slate-500">({questsByTab[t.key]?.length || 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-cyan-300 font-mono">Chargement...</div>
      ) : current.length === 0 ? (
        <div className="sys-card p-16 text-center">
          <Swords size={32} className="mx-auto text-cyan-300/50 mb-4" />
          <div className="text-slate-400 font-mono">Aucune quête dans cette catégorie.</div>
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
                <QuestCard
                  key={q.id}
                  q={q}
                  onComplete={complete}
                  onDecompose={decompose}
                  onToggleStep={toggleStep}
                  completing={completing === q.id}
                  decomposing={decomposing === q.id}
                  togglingStep={togglingStep}
                  open={!!openSteps[q.id]}
                  setOpen={(v) => setOpenSteps((s) => ({ ...s, [q.id]: v }))}
                />
              ))}
            </AnimatePresence>
          </div>
          {done.length > 0 && (
            <div className="mt-8">
              <div className="font-accent text-xs tracking-[0.4em] text-slate-500 uppercase mb-3">
                [ Complétées — {done.length} ]
              </div>
              <div className="space-y-2 opacity-60">
                {done.map((q) => (
                  <QuestCard key={q.id} q={q} completed />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <LevelUpModal
        open={!!levelUp}
        level={levelUp?.level}
        rank={levelUp?.rank}
        onClose={() => setLevelUp(null)}
      />
    </div>
  );
}

const QuestCard = ({
  q,
  onComplete,
  onDecompose,
  onToggleStep,
  completing,
  decomposing,
  togglingStep,
  open,
  setOpen,
  completed,
}) => {
  const hasSteps = (q.steps || []).length > 0;
  const stepsDone = (q.steps || []).filter((s) => s.done).length;
  const totalSteps = (q.steps || []).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`sys-card p-5 ${completed ? "line-through" : ""}`}
      data-testid={`quest-card-${q.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <RankBadge rank={q.rank} />
            {q.skill && (
              <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#8B5CF6" }}>
                /{q.skill}
              </span>
            )}
            <span className="font-mono text-cyan-300 text-xs">+{q.xp_reward} XP</span>
            {hasSteps && !completed && (
              <span className="font-mono text-[10px] tracking-widest uppercase text-cyan-300/70">
                · {stepsDone}/{totalSteps} étapes
              </span>
            )}
          </div>
          <div className="font-display font-bold text-cyan-100 uppercase tracking-wide text-base sm:text-lg">{q.title}</div>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">{q.description}</p>
        </div>
        {!completed && (
          <button
            data-testid={`complete-quest-${q.id}`}
            onClick={() => onComplete(q)}
            disabled={completing}
            className="sys-btn inline-flex items-center gap-2 whitespace-nowrap self-start"
          >
            {completing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Valider
          </button>
        )}
      </div>

      {/* Decomposition section */}
      {!completed && (
        <div className="mt-4 pt-4 border-t border-cyan-500/10">
          {!hasSteps ? (
            <button
              data-testid={`decompose-quest-${q.id}`}
              onClick={() => onDecompose(q)}
              disabled={decomposing}
              className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80 hover:text-cyan-300 inline-flex items-center gap-2 transition"
              title="Décomposer en micro-actions plus simples"
            >
              {decomposing ? (
                <><Loader2 size={12} className="animate-spin" /> Décomposition en cours...</>
              ) : (
                <><Layers size={12} /> Trop dur ? Décomposer en micro-actions</>
              )}
            </button>
          ) : (
            <>
              <button
                data-testid={`toggle-steps-${q.id}`}
                onClick={() => setOpen(!open)}
                className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80 hover:text-cyan-300 inline-flex items-center gap-2 transition"
              >
                <Layers size={12} />
                {open ? "Masquer" : "Afficher"} les micro-actions ({stepsDone}/{totalSteps})
                {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              <AnimatePresence>
                {open && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 space-y-2 overflow-hidden"
                    data-testid={`steps-list-${q.id}`}
                  >
                    {(q.steps || []).map((s, idx) => {
                      const tid = `${q.id}-${s.id}`;
                      const busy = togglingStep === tid;
                      return (
                        <li
                          key={s.id}
                          className={`flex items-start gap-3 p-3 border ${
                            s.done
                              ? "border-cyan-500/40 bg-cyan-500/5"
                              : "border-cyan-500/15 bg-black/40"
                          }`}
                          data-testid={`step-${q.id}-${idx}`}
                        >
                          <button
                            data-testid={`step-toggle-${q.id}-${idx}`}
                            onClick={() => onToggleStep(q, s)}
                            disabled={busy}
                            className={`mt-0.5 w-5 h-5 flex items-center justify-center border transition ${
                              s.done
                                ? "border-cyan-400 bg-cyan-400 text-black"
                                : "border-cyan-500/50 hover:border-cyan-300"
                            }`}
                          >
                            {busy ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : s.done ? (
                              <Check size={12} strokeWidth={3} />
                            ) : null}
                          </button>
                          <div className="flex-1">
                            <div className={`text-sm ${s.done ? "text-slate-500 line-through" : "text-cyan-50"}`}>
                              <span className="font-mono text-cyan-300/70 mr-2">{String(idx + 1).padStart(2, "0")}.</span>
                              {s.title}
                            </div>
                            {s.description && (
                              <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};

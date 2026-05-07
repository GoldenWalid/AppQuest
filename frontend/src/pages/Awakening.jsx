import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const steps = [
  {
    key: "name",
    label: "Identification",
    question: "QUEL EST TON NOM DE HUNTER ?",
    placeholder: "ex: Jin-Woo",
    type: "input",
  },
  {
    key: "about_me",
    label: "Profil",
    question: "QUI ES-TU ?",
    placeholder: "Parle de toi, ce que tu fais, qui tu es actuellement...",
    type: "textarea",
  },
  {
    key: "main_goal",
    label: "Objectif Principal",
    question: "QUEL EST TON OBJECTIF ULTIME ?",
    placeholder: "Ton projet / objectif ultime que tu veux atteindre...",
    type: "textarea",
  },
  {
    key: "context",
    label: "Contexte",
    question: "CONTEXTE & CONTRAINTES ?",
    placeholder: "Temps dispo, ressources, contraintes, niveau actuel...",
    type: "textarea",
  },
];

export default function Awakening({ onInitiated }) {
  const [step, setStep] = useState(-1);
  const [data, setData] = useState({ name: "", about_me: "", main_goal: "", context: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const current = steps[step];
  const canNext = step >= 0 && data[current.key].trim().length > 0;

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setLoading(true);
      try {
        const profile = await api.initiate(data);
        toast.success("SYSTEM activé", { description: profile.system_message });
        if (onInitiated) await onInitiated();
        navigate("/");
      } catch (e) {
        toast.error("Échec de l'éveil", { description: e?.response?.data?.detail || e.message });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* INTRO */}
      <AnimatePresence mode="wait">
        {step === -1 && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl w-full text-center corner-frame sys-card scanlines p-12 relative"
            data-testid="awakening-intro"
          >
            <div className="font-accent text-xs tracking-[0.5em] text-cyan-300/70 mb-4">
              [ SYSTEM // v1.0 ]
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black uppercase mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-cyan-400 to-blue-600 tracking-tighter">
              Tu as été<br/>choisi, Hunter
            </h1>
            <p className="text-slate-300 mb-3 max-w-lg mx-auto leading-relaxed">
              Le <span className="text-cyan-300 glow-text">SYSTEM</span> t'a détecté. À partir de ton objectif ultime,
              il générera ta <span className="text-cyan-300">classe</span>, tes <span className="text-cyan-300">compétences parallèles</span>,
              ton <span className="text-cyan-300">arbre de quêtes</span> et tes <span className="text-cyan-300">succès</span>.
            </p>
            <p className="text-slate-500 text-sm mb-10 font-mono">
              &gt; chaque jour, des quêtes. chaque quête, de l'XP. chaque niveau, une évolution.
            </p>
            <button
              data-testid="start-awakening-btn"
              onClick={() => setStep(0)}
              className="sys-btn inline-flex items-center gap-2"
            >
              Initier l'éveil <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {/* STEPS */}
        {step >= 0 && current && (
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="max-w-2xl w-full corner-frame sys-card p-8 sm:p-12 relative"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="font-accent text-xs tracking-[0.4em] text-cyan-300/80">
                [ {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")} ] {current.label.toUpperCase()}
              </div>
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-0.5 w-6 ${i <= step ? "bg-cyan-400" : "bg-slate-700"}`}
                  />
                ))}
              </div>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold text-cyan-300 mb-6 uppercase tracking-tight glow-text">
              {current.question}
            </h2>

            {current.type === "textarea" ? (
              <textarea
                data-testid={`awakening-input-${current.key}`}
                autoFocus
                rows={5}
                className="sys-input resize-none"
                placeholder={current.placeholder}
                value={data[current.key]}
                onChange={(e) => setData({ ...data, [current.key]: e.target.value })}
              />
            ) : (
              <input
                data-testid={`awakening-input-${current.key}`}
                autoFocus
                type="text"
                className="sys-input"
                placeholder={current.placeholder}
                value={data[current.key]}
                onChange={(e) => setData({ ...data, [current.key]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && canNext && handleNext()}
              />
            )}

            <div className="flex items-center justify-between mt-8">
              <button
                data-testid="awakening-back-btn"
                onClick={() => setStep(step - 1)}
                className="text-xs tracking-[0.2em] uppercase text-slate-500 hover:text-cyan-300 transition"
              >
                ← Retour
              </button>
              <button
                data-testid="awakening-next-btn"
                disabled={!canNext || loading}
                onClick={handleNext}
                className="sys-btn inline-flex items-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Activation...</>
                ) : step === steps.length - 1 ? (
                  <>Activer le SYSTEM <ChevronRight size={14} /></>
                ) : (
                  <>Suivant <ChevronRight size={14} /></>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

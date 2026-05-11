import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Trophy } from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { api } from "@/lib/api";

export default function Achievements() {
  const [list, setList] = useState([]);

  useEffect(() => {
    api.getAchievements().then(setList).catch(() => setList([]));
  }, []);

  const unlocked = list.filter((a) => a.unlocked);
  const locked = list.filter((a) => !a.unlocked);

  return (
    <div className="space-y-8" data-testid="achievements-page">

      {/* HEADER */}
      <div>
        <div className="font-accent text-xs tracking-[0.4em] uppercase mb-1" style={{ color: "rgba(212,175,55,0.6)" }}>
          [ Hall of Fame ]
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tighter glow-text-gold"
          style={{ color: "var(--gold)" }}>
          Succès
        </h1>
        <div className="text-sm mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
          {unlocked.length} / {list.length} débloqués
        </div>
      </div>

      {/* DÉBLOQUÉS */}
      {unlocked.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold uppercase tracking-widest mb-4 glow-text-gold" style={{ color: "var(--gold)" }}>
            / Débloqués
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlocked.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="sys-card-gold corner-frame corner-frame-gold scanlines relative p-5 pulse-border"
                data-testid={`achievement-unlocked-${a.id}`}
              >
                <Trophy size={24} className="mb-3" style={{ color: "var(--gold)" }} />
                <div className="flex items-center gap-2 mb-2">
                  <RankBadge rank={a.rank} />
                </div>
                <div className="font-display font-black uppercase text-sm tracking-wide mb-1" style={{ color: "var(--gold)" }}>
                  {a.title}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{a.description}</p>
                {a.unlocked_at && (
                  <div className="font-mono text-[10px] mt-3" style={{ color: "rgba(212,175,55,0.5)" }}>
                    {new Date(a.unlocked_at).toLocaleDateString("fr-FR")}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* VERROUILLÉS */}
      {locked.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
            / À débloquer
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locked.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="sys-card p-5 opacity-50"
                style={{ filter: "grayscale(0.4)" }}
                data-testid={`achievement-locked-${a.id}`}
              >
                <Lock size={24} className="mb-3" style={{ color: "var(--text-faint)" }} />
                <div className="flex items-center gap-2 mb-2">
                  <RankBadge rank={a.rank} />
                </div>
                <div className="font-display font-black uppercase text-sm tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                  {a.title}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>{a.description}</p>
                {a.condition && (
                  <div className="font-mono text-[10px] mt-3" style={{ color: "rgba(107,138,148,0.5)" }}>
                    Condition : {a.condition}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* EMPTY STATE */}
      {list.length === 0 && (
        <div className="sys-card p-16 text-center">
          <Trophy size={32} className="mx-auto mb-4" style={{ color: "rgba(212,175,55,0.3)" }} />
          <div className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>
            Complète des quêtes pour débloquer des succès.
          </div>
        </div>
      )}
    </div>
  );
}

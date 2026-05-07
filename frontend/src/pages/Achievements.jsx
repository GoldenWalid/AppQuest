import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Trophy } from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { api } from "@/lib/api";

export default function Achievements() {
  const [list, setList] = useState([]);

  useEffect(() => {
    api.getAchievements().then(setList);
  }, []);

  const unlocked = list.filter((a) => a.unlocked);
  const locked = list.filter((a) => !a.unlocked);

  return (
    <div className="space-y-8" data-testid="achievements-page">
      <div>
        <div className="font-accent text-xs tracking-[0.4em] text-cyan-300/70 uppercase">[ Hall of Fame ]</div>
        <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-600">
          Succès
        </h1>
        <div className="text-slate-400 text-sm mt-1 font-mono">
          {unlocked.length} / {list.length} débloqués
        </div>
      </div>

      {unlocked.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-cyan-300 uppercase tracking-widest mb-4">
            / Débloqués
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlocked.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="sys-card corner-frame scanlines relative p-5 pulse-border"
                data-testid={`achievement-unlocked-${a.id}`}
              >
                <Trophy className="text-yellow-300 mb-3" size={22} />
                <div className="flex items-center gap-2 mb-1">
                  <RankBadge rank={a.rank} />
                </div>
                <div className="font-display font-bold text-cyan-100 uppercase text-sm mt-2">{a.title}</div>
                <p className="text-slate-400 text-xs mt-1">{a.description}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-bold text-slate-400 uppercase tracking-widest mb-4">
          / Verrouillés
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locked.map((a) => (
            <div
              key={a.id}
              className="sys-card p-5 opacity-60"
              data-testid={`achievement-locked-${a.id}`}
            >
              <Lock className="text-slate-500 mb-3" size={22} />
              <div className="flex items-center gap-2 mb-1">
                <RankBadge rank={a.rank} />
              </div>
              <div className="font-display font-bold text-slate-300 uppercase text-sm mt-2">{a.title}</div>
              <p className="text-slate-500 text-xs mt-1">{a.description}</p>
              <div className="text-[10px] tracking-[0.2em] uppercase text-slate-600 mt-3 border-t border-slate-700 pt-2">
                Condition: {a.condition}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

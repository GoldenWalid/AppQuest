import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Flame, Trophy, Target } from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { getSkillIcon } from "@/lib/icons";
import { api } from "@/lib/api";

export default function Dashboard({ profile }) {
  const [stats, setStats] = useState(null);
  const [skills, setSkills] = useState([]);
  const [mainQuests, setMainQuests] = useState([]);

  const load = async () => {
    const [s, sk, mq] = await Promise.all([
      api.getStats(),
      api.getSkills(),
      api.getQuests("main"),
    ]);
    setStats(s);
    setSkills(sk);
    setMainQuests(mq);
  };

  useEffect(() => { load(); }, []);

  if (!stats) return null;

  const pct = stats.xp_needed_for_next > 0
    ? Math.min(100, (stats.xp_into_level / stats.xp_needed_for_next) * 100)
    : 0;

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      >
        <div>
          <div className="font-accent text-xs tracking-[0.4em] text-cyan-300/70 uppercase">[ Status Panel ]</div>
          <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-600">
            {profile?.name}
          </h1>
          <div className="text-slate-400 text-sm mt-1 font-mono">{profile?.class_title}</div>
        </div>
        <RankBadge rank={stats.rank} className="text-lg px-4 py-1.5" />
      </motion.div>

      {/* SYSTEM MESSAGE */}
      {profile?.system_message && (
        <div className="sys-card corner-frame scanlines relative p-5" data-testid="system-message">
          <div className="font-accent text-[10px] tracking-[0.4em] text-cyan-300/70 mb-2">[ SYSTEM MESSAGE ]</div>
          <p className="text-cyan-100 italic">{profile.system_message}</p>
        </div>
      )}

      {/* STATS GRID */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Activity} label="Level" value={stats.level} testid="stat-level" />
        <StatTile icon={Target} label="XP Total" value={stats.total_xp} testid="stat-xp" />
        <StatTile icon={Trophy} label="Quêtes" value={stats.quests_completed} testid="stat-quests" />
        <StatTile icon={Flame} label="Streak" value={`${stats.daily_streak}j`} testid="stat-streak" />
      </div>

      {/* XP BAR */}
      <div className="sys-card p-6" data-testid="xp-bar-container">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display font-bold text-cyan-300 uppercase tracking-widest text-sm">
            Progression — Level {stats.level} → {stats.level + 1}
          </div>
          <div className="font-mono text-cyan-300 text-sm">
            {stats.xp_into_level} / {stats.xp_needed_for_next} XP
          </div>
        </div>
        <div className="xp-bar">
          <motion.div
            className="xp-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* SKILLS GRID */}
      <section>
        <h2 className="font-display text-xl font-bold text-cyan-300 uppercase tracking-widest mb-4 glow-text">
          / Compétences parallèles
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((s) => {
            const Icon = getSkillIcon(s.icon);
            const pctS = Math.min(100, (s.xp / s.xp_to_next) * 100);
            return (
              <div key={s.id} className="sys-card p-5" data-testid={`skill-card-${s.name}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 border border-cyan-500/40 bg-cyan-500/10">
                    <Icon size={20} className="text-cyan-300" />
                  </div>
                  <div className="font-display font-black text-cyan-300 text-sm">
                    LV. {s.level}
                  </div>
                </div>
                <div className="font-display font-bold text-cyan-100 uppercase text-sm tracking-wide">{s.name}</div>
                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{s.description}</p>
                <div className="xp-bar mt-3" style={{ height: "6px" }}>
                  <motion.div className="xp-bar-fill" initial={{ width: 0 }} animate={{ width: `${pctS}%` }} transition={{ duration: 1 }} />
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-1">{s.xp} / {s.xp_to_next} XP</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MAIN QUEST */}
      {mainQuests.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold text-cyan-300 uppercase tracking-widest mb-4 glow-text">
            / Quête principale
          </h2>
          {mainQuests.map((q) => (
            <div key={q.id} className="sys-card corner-frame scanlines relative p-6" data-testid="main-quest-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-accent text-[10px] tracking-[0.4em] text-cyan-300/70 uppercase mb-1">[ Final Objective ]</div>
                  <div className="font-display text-lg sm:text-xl font-bold text-cyan-200 uppercase">{q.title}</div>
                  <p className="text-slate-300 text-sm mt-2 leading-relaxed">{q.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <RankBadge rank={q.rank} />
                  <span className="font-mono text-cyan-300 text-sm">+{q.xp_reward} XP</span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

const StatTile = ({ icon: Icon, label, value, testid }) => (
  <div className="sys-card p-4 flex items-center gap-4" data-testid={testid}>
    <div className="p-2 border border-cyan-500/40 bg-cyan-500/10">
      <Icon className="text-cyan-300" size={20} />
    </div>
    <div>
      <div className="text-[10px] tracking-[0.3em] uppercase text-slate-400">{label}</div>
      <div className="font-display font-black text-2xl text-cyan-200">{value}</div>
    </div>
  </div>
);

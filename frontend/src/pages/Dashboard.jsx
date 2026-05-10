import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Flame, Trophy, Target, Star, TrendingUp } from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { LevelUpModal } from "@/components/LevelUpModal";
import { getSkillIcon } from "@/lib/icons";
import { api } from "@/lib/api";

export default function Dashboard({ profile }) {
  const [stats, setStats] = useState(null);
  const [skills, setSkills] = useState([]);
  const [mainQuests, setMainQuests] = useState([]);
  const [levelUp, setLevelUp] = useState(null);
  const [newSkill, setNewSkill] = useState(null);

  const load = async () => {
    const [s, sk, mq] = await Promise.all([
      api.getStats(), api.getSkills(), api.getQuests("main"),
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

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="font-accent text-xs tracking-[0.4em] uppercase mb-1" style={{ color: "rgba(0,255,135,0.6)" }}>
            [ Status Panel ]
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tighter"
            style={{ color: "var(--green)", textShadow: "0 0 24px rgba(0,255,135,0.3)" }}>
            {profile?.name}
          </h1>
          <div className="text-sm mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
            {profile?.class_title}
          </div>
        </div>
        <RankBadge rank={stats.rank} className="text-lg px-4 py-1.5" />
      </motion.div>

      {profile?.system_message && (
        <div className="sys-card corner-frame scanlines relative p-5" data-testid="system-message">
          <div className="font-accent text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(0,255,135,0.6)" }}>
            [ RENAISSANCE — MESSAGE ]
          </div>
          <p className="italic text-sm sm:text-base leading-relaxed" style={{ color: "rgba(232,240,242,0.9)" }}>
            {profile.system_message}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile icon={Activity} label="Level"   value={stats.level}                     color="green"  testid="stat-level" />
        <StatTile icon={Target}   label="XP Total" value={stats.total_xp.toLocaleString()} color="blue"   testid="stat-xp" />
        <StatTile icon={Trophy}   label="Quêtes"  value={stats.quests_completed}           color="gold"   testid="stat-quests" />
        <StatTile icon={Flame}    label="Streak"  value={`${stats.daily_streak ?? 0}j`}    color="purple" testid="stat-streak" />
      </div>

      <div className="sys-card p-5 sm:p-6" data-testid="xp-bar-container">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display font-bold uppercase tracking-widest text-sm" style={{ color: "var(--green)" }}>
            Progression — Level {stats.level} → {stats.level + 1}
          </div>
          <div className="font-mono text-sm" style={{ color: "var(--green)" }}>
            {stats.xp_into_level} / {stats.xp_needed_for_next} XP
          </div>
        </div>
        <div className="xp-bar">
          <motion.div
            className="xp-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-mono text-[10px]" style={{ color: "rgba(0,255,135,0.4)" }}>LV.{stats.level}</span>
          <span className="font-mono text-[10px]" style={{ color: "rgba(0,255,135,0.4)" }}>LV.{stats.level + 1}</span>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-widest glow-text-green" style={{ color: "var(--green)" }}>
            / Compétences
          </h2>
          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{skills.length} actives</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {skills.map((s, idx) => (
            <SkillCard key={s.id} skill={s} delay={idx * 0.08} />
          ))}
        </div>
      </section>

      {mainQuests.length > 0 && (
        <section>
          <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-widest mb-4 glow-text-gold" style={{ color: "var(--gold)" }}>
            / Quête Principale
          </h2>
          {mainQuests.map((q) => (
            <div key={q.id} className="sys-card-gold corner-frame corner-frame-gold scanlines relative p-5 sm:p-6" data-testid="main-quest-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-accent text-[10px] tracking-[0.4em] uppercase mb-1" style={{ color: "rgba(212,175,55,0.6)" }}>
                    [ Objectif Final ]
                  </div>
                  <div className="font-display text-base sm:text-xl font-bold uppercase" style={{ color: "var(--gold)" }}>
                    {q.title}
                  </div>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text)" }}>{q.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <RankBadge rank={q.rank} />
                  <span className="font-mono text-xs" style={{ color: "var(--gold)" }}>+{q.xp_reward} XP</span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <AnimatePresence>
        {newSkill && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 skill-drop-card p-5 text-center"
            style={{ minWidth: 280 }}
          >
            <div className="font-accent text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(139,92,246,0.8)" }}>
              [ NOUVELLE COMPÉTENCE ]
            </div>
            <Star size={28} className="mx-auto mb-2" style={{ color: "var(--purple)" }} />
            <div className="font-display font-black uppercase text-base" style={{ color: "var(--purple)" }}>
              {newSkill.name}
            </div>
            <div className="text-xs mt-1" style={{ color: "rgba(139,92,246,0.7)" }}>Niveau 1 débloqué</div>
          </motion.div>
        )}
      </AnimatePresence>

      <LevelUpModal open={!!levelUp} level={levelUp?.level} rank={levelUp?.rank} onClose={() => setLevelUp(null)} />
    </div>
  );
}

const SkillCard = ({ skill: s, delay }) => {
  const Icon = getSkillIcon(s.icon);
  const pct = s.xp_to_next > 0 ? Math.min(100, (s.xp / s.xp_to_next) * 100) : 100;
  const isMaxing = pct >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="sys-card p-4 sm:p-5"
      data-testid={`skill-card-${s.name}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2" style={{ border: "1px solid rgba(0,255,135,0.3)", background: "rgba(0,255,135,0.07)" }}>
          <Icon size={18} style={{ color: "var(--green)" }} />
        </div>
        <div className="text-right">
          <div className="font-display font-black text-sm" style={{ color: isMaxing ? "var(--gold)" : "var(--green)" }}>
            LV.{s.level}
          </div>
          {s.level >= 10 && (
            <div className="font-accent text-[9px] tracking-widest uppercase" style={{ color: "var(--gold)" }}>MAX</div>
          )}
        </div>
      </div>
      <div className="font-display font-bold uppercase text-xs sm:text-sm tracking-wide mb-1" style={{ color: "var(--text)" }}>
        {s.name}
      </div>
      <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: "var(--text-muted)" }}>
        {s.description}
      </p>
      <div className={`xp-bar ${isMaxing ? "xp-bar-gold" : ""}`} style={{ height: "6px" }}>
        <motion.div
          className="xp-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, delay, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[10px]" style={{ color: "rgba(107,138,148,0.7)" }}>{s.xp} / {s.xp_to_next} XP</span>
        {isMaxing && (
          <span className="font-accent text-[9px] uppercase tracking-widest" style={{ color: "var(--gold)" }}>
            <TrendingUp size={9} className="inline mr-0.5" /> Proche niveau sup.
          </span>
        )}
      </div>
    </motion.div>
  );
};

const COLORS = {
  green:  { text: "var(--green)",  border: "rgba(0,255,135,0.3)",   bg: "rgba(0,255,135,0.06)" },
  blue:   { text: "var(--blue)",   border: "rgba(79,172,254,0.3)",  bg: "rgba(79,172,254,0.06)" },
  gold:   { text: "var(--gold)",   border: "rgba(212,175,55,0.3)",  bg: "rgba(212,175,55,0.06)" },
  purple: { text: "var(--purple)", border: "rgba(139,92,246,0.3)",  bg: "rgba(139,92,246,0.06)" },
};

const StatTile = ({ icon: Icon, label, value, color = "green", testid }) => {
  const c = COLORS[color];
  return (
    <div className="sys-card p-3 sm:p-4 flex items-center gap-3" data-testid={testid}>
      <div className="p-2 shrink-0" style={{ border: `1px solid ${c.border}`, background: c.bg }}>
        <Icon size={18} style={{ color: c.text }} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] tracking-[0.3em] uppercase" style={{ color: "var(--text-muted)" }}>{label}</div>
        <div className="font-display font-black text-xl sm:text-2xl leading-tight" style={{ color: c.text }}>
          {value}
        </div>
      </div>
    </div>
  );
};

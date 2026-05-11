import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { RankBadge } from "@/components/RankBadge";

export const LevelUpModal = ({ open, level, rank, onClose }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="level-up-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 200 }}
            className="corner-frame corner-frame-gold scanlines relative px-12 py-12 text-center pulse-border"
            style={{
              background: "linear-gradient(135deg, #0a0800, #1a1200)",
              border: "2px solid var(--gold)",
              boxShadow: "0 0 80px rgba(212,175,55,0.4), 0 0 160px rgba(212,175,55,0.1)",
              maxWidth: 480, width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Particules or */}
            <motion.div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              {[...Array(8)].map((_, i) => (
                <motion.div key={i}
                  className="absolute w-1 h-1 rounded-full"
                  style={{ background: "var(--gold)", left: `${10 + i * 11}%`, top: "50%" }}
                  animate={{ y: [-20, -120], opacity: [1, 0], scale: [1, 0.3] }}
                  transition={{ duration: 1.5, delay: i * 0.15, repeat: Infinity, repeatDelay: 2 }}
                />
              ))}
            </motion.div>

            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, delay: 0.3 }}>
              <Sparkles size={56} className="mx-auto mb-4" style={{ color: "var(--gold)" }} />
            </motion.div>

            <div className="font-accent text-xs tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(212,175,55,0.8)" }}>
              [ SYSTEM ALERT ]
            </div>

            <motion.h2
              className="font-display text-5xl font-black uppercase mb-4"
              style={{ color: "var(--gold)", textShadow: "0 0 30px rgba(212,175,55,0.6)" }}
              animate={{ textShadow: ["0 0 30px rgba(212,175,55,0.6)", "0 0 60px rgba(212,175,55,0.9)", "0 0 30px rgba(212,175,55,0.6)"] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Level Up !
            </motion.h2>

            <div className="text-lg mb-6" style={{ color: "var(--text)" }}>
              Tu as atteint le niveau{" "}
              <span className="font-display text-3xl font-black" style={{ color: "var(--gold)", textShadow: "0 0 16px rgba(212,175,55,0.8)" }}>
                {level}
              </span>
            </div>

            {rank && (
              <div className="mb-6">
                <div className="text-xs tracking-widest uppercase mb-2" style={{ color: "var(--text-muted)" }}>Nouveau rang</div>
                <RankBadge rank={rank} className="text-xl px-6 py-2" />
              </div>
            )}

            <button data-testid="level-up-close" onClick={onClose} className="sys-btn sys-btn-gold mt-4">
              Continuer
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

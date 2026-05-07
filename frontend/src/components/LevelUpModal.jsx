import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

export const LevelUpModal = ({ open, level, rank, onClose }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="level-up-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            className="corner-frame sys-card scanlines relative px-16 py-12 text-center pulse-border"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles className="mx-auto mb-4 text-cyan-300" size={56} />
            <div className="font-accent text-xs tracking-[0.4em] text-cyan-300/80 mb-2">
              [ SYSTEM ALERT ]
            </div>
            <h2 className="font-display text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500 uppercase mb-4">
              Level Up
            </h2>
            <div className="text-cyan-200 text-lg mb-6">
              Tu as atteint le niveau <span className="font-display text-3xl text-cyan-300 glow-text">{level}</span>
            </div>
            <div className="text-slate-300 mb-2 text-xs tracking-widest uppercase">Nouveau rang</div>
            <div className={`rank-badge rank-${rank} text-3xl px-6 py-2`}>{rank}-RANK</div>
            <button
              data-testid="level-up-close"
              onClick={onClose}
              className="sys-btn mt-8"
            >
              Continuer
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

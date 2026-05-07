import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, X, Send } from "lucide-react";
import { toast } from "sonner";
import {
  readReminder,
  writeReminder,
  useDailyReminder,
} from "@/hooks/useDailyReminder";

export default function ReminderSettings({ open, onClose }) {
  const [cfg, setCfg] = useState(() => readReminder());
  const [perm, setPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const { schedule, showSystemNotification } = useDailyReminder();

  useEffect(() => {
    if (open) setCfg(readReminder());
  }, [open]);

  const requestPerm = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications non supportées sur ce navigateur");
      return false;
    }
    const res = await Notification.requestPermission();
    setPerm(res);
    if (res !== "granted") {
      toast.error("Permission refusée");
      return false;
    }
    return true;
  };

  const save = async (next) => {
    if (next.enabled && perm !== "granted") {
      const ok = await requestPerm();
      if (!ok) return;
    }
    setCfg(next);
    writeReminder(next);
    schedule();
    toast.success(
      next.enabled
        ? `Rappel programmé à ${next.time} chaque jour`
        : "Rappels désactivés"
    );
  };

  const sendTest = async () => {
    if (perm !== "granted") {
      const ok = await requestPerm();
      if (!ok) return;
    }
    await showSystemNotification(
      "[ SYSTEM // TEST ]",
      "Hunter, le SYSTEM est en ligne. Les rappels fonctionneront."
    );
    toast.success("Test envoyé");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            data-testid="reminder-overlay"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 18 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(92vw,440px)] sys-card corner-frame scanlines p-6 relative"
            data-testid="reminder-settings"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-slate-500 hover:text-cyan-300"
              data-testid="reminder-close"
            >
              <X size={16} />
            </button>

            <div className="font-accent text-[10px] tracking-[0.4em] text-cyan-300/70 mb-1 uppercase">
              [ SYSTEM // RAPPELS ]
            </div>
            <h3 className="font-display text-xl font-bold text-cyan-300 glow-text uppercase mb-1">
              Quête du jour
            </h3>
            <p className="text-slate-400 text-sm mb-6 font-mono">
              Le SYSTEM t'enverra une notification chaque jour à l'heure choisie.
            </p>

            {perm === "denied" && (
              <div className="border border-red-500/40 bg-red-500/10 p-3 mb-4 text-xs text-red-300 font-mono">
                Permission refusée. Active les notifications dans les réglages du navigateur.
              </div>
            )}

            <label className="block text-[10px] tracking-[0.3em] uppercase text-cyan-300/70 mb-2">
              Heure du rappel
            </label>
            <input
              data-testid="reminder-time-input"
              type="time"
              value={cfg.time}
              onChange={(e) => setCfg({ ...cfg, time: e.target.value })}
              className="sys-input w-full mb-6"
            />

            <div className="flex flex-col gap-2">
              <button
                data-testid="reminder-toggle-btn"
                onClick={() => save({ ...cfg, enabled: !cfg.enabled })}
                className={`sys-btn w-full inline-flex items-center justify-center gap-2 ${
                  cfg.enabled ? "" : ""
                }`}
              >
                {cfg.enabled ? (
                  <><BellOff size={14} /> Désactiver le rappel</>
                ) : (
                  <><Bell size={14} /> Activer le rappel</>
                )}
              </button>

              <div className="flex gap-2">
                <button
                  data-testid="reminder-save-btn"
                  onClick={() => save(cfg)}
                  className="sys-btn flex-1"
                >
                  Enregistrer l'heure
                </button>
                <button
                  data-testid="reminder-test-btn"
                  onClick={sendTest}
                  className="sys-btn inline-flex items-center gap-2"
                >
                  <Send size={14} /> Tester
                </button>
              </div>
            </div>

            <div className="mt-5 text-[10px] text-slate-500 font-mono tracking-widest uppercase">
              Statut: {cfg.enabled ? `Programmé · ${cfg.time}` : "Désactivé"}
              {" · "}
              Permission: {perm}
            </div>
            <div className="mt-2 text-[10px] text-slate-600 font-mono leading-relaxed">
              Le rappel se déclenche tant que l'application est ouverte (onglet ou
              PWA installée). Pour des rappels persistants 100% offline, garde le
              SYSTEM en arrière-plan.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

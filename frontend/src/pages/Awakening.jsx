import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { API } from "@/lib/api";

const newSessionId = () => `awaken-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const calcProgress = (userTurns) => Math.min(95, userTurns * 12);

export default function Awakening({ onInitiated }) {
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const progress = calcProgress(userTurns);
  const canEarlyGenerate = progress >= 70 && !thinking && !finalizing;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const handleRestart = async () => {
    if (thinking || finalizing) return;
    if (messages.length > 0 && !window.confirm("Recommencer depuis le début ?")) return;
    setMessages([]); setInput(""); setSessionId(newSessionId()); setStarted(false);
    toast.success("Conversation réinitialisée");
  };

  const sendTurn = async (history, forceFinalize = false) => {
    setThinking(true);
    try {
      const res = await axios.post(`${API}/awaken/chat`, {
        session_id: sessionId,
        messages: history,
        force_finalize: forceFinalize,
      });
      if (res.data.done) {
        setFinalizing(true);
        toast.success("[ RENAISSANCE ] Profil activé", { description: res.data.system_message });
        if (onInitiated) await onInitiated();
        navigate("/");
      } else {
        setMessages([...history, { role: "assistant", content: res.data.message }]);
      }
    } catch (e) {
      toast.error("Erreur RENAISSANCE", { description: e?.response?.data?.detail || e.message });
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleStart = async () => { setStarted(true); await sendTurn([]); };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next); setInput("");
    await sendTurn(next);
  };

  const handleEarlyGenerate = async () => {
    if (!canEarlyGenerate) return;
    toast.info("[ RENAISSANCE ] Génération en cours...", { description: "Création de ton profil avec les données actuelles." });
    await sendTurn(messages, true);
  };

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full corner-frame sys-card scanlines p-10 sm:p-14 relative text-center"
          data-testid="awakening-intro"
        >
          <div className="font-accent text-xs tracking-[0.5em] mb-4" style={{ color: "rgba(0,255,135,0.6)" }}>
            [ RENAISSANCE · CARTOGRAPHIE · QUÊTES ]
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black uppercase mb-6 tracking-tighter"
            style={{ color: "var(--green)", textShadow: "0 0 30px rgba(0,255,135,0.4)" }}>
            Commence<br />ta renaissance
          </h1>
          <p className="mb-3 max-w-lg mx-auto leading-relaxed" style={{ color: "var(--text)" }}>
            Une conversation de <span style={{ color: "var(--green)" }}>10 à 12 échanges</span> pour
            cartographier qui tu es, ce qui te bloque, et où tu vas. Ton profil et tes quêtes
            personnalisées seront générés à la fin.
          </p>
          <p className="text-sm mb-10 font-mono" style={{ color: "var(--text-muted)" }}>
            corps · croyances · valeurs · direction · vision
          </p>
          <button
            data-testid="start-awakening-btn"
            onClick={handleStart}
            className="sys-btn inline-flex items-center gap-2"
          >
            <Sparkles size={14} /> Commencer
          </button>
          <p className="text-xs mt-6 font-mono" style={{ color: "rgba(107,138,148,0.6)" }}>
            Réponds honnêtement. Plus tu es précis, meilleures sont tes quêtes.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-3xl w-full sys-card corner-frame relative flex flex-col" style={{ height: "min(88vh, 820px)" }}>

        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,255,135,0.15)" }}>
          <div>
            <div className="font-accent text-[10px] tracking-[0.4em] uppercase mb-0.5" style={{ color: "rgba(0,255,135,0.6)" }}>
              [ SYSTÈME // ÉVEIL EN COURS ]
            </div>
            <div className="font-display text-base sm:text-lg font-bold glow-text-green" style={{ color: "var(--green)" }}>
              Dialogue avec RENAISSANCE
            </div>
          </div>
          <div className="font-mono text-xs flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
            <span>{userTurns} rép.</span>
            <button
              data-testid="awakening-restart-btn"
              onClick={handleRestart}
              disabled={thinking || finalizing}
              className="inline-flex items-center gap-1 transition hover:text-green-400 disabled:opacity-40 uppercase tracking-widest text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </div>

        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-accent text-[10px] tracking-[0.3em] uppercase" style={{ color: "rgba(0,255,135,0.5)" }}>
              Cartographie
            </span>
            <span className="font-mono text-[10px]" style={{ color: progress >= 70 ? "var(--gold)" : "rgba(0,255,135,0.5)" }}>
              {progress}%
            </span>
          </div>
          <div className="mapping-bar-track">
            <div
              className={`mapping-bar-fill ${progress >= 70 ? "at-70" : ""}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <AnimatePresence>
            {canEarlyGenerate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <button
                  onClick={handleEarlyGenerate}
                  className="sys-btn-gold sys-btn inline-flex items-center gap-2 w-full justify-center text-[11px]"
                  style={{ padding: "0.45rem 1rem" }}
                >
                  <Zap size={12} />
                  Assez de données — Générer mes quêtes maintenant
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
          data-testid="awakening-chat-messages"
        >
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`msg-${m.role}-${i}`}
              >
                <div
                  className="max-w-[85%] px-4 py-3"
                  style={m.role === "user"
                    ? { background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.35)", color: "var(--text)" }
                    : { background: "rgba(8,12,14,0.8)", border: "1px solid rgba(0,255,135,0.15)", color: "var(--text)" }
                  }
                >
                  {m.role === "assistant" && (
                    <div className="font-accent text-[10px] tracking-[0.3em] uppercase mb-1.5" style={{ color: "rgba(0,255,135,0.6)" }}>
                      [ RENAISSANCE ]
                    </div>
                  )}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {thinking && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start" data-testid="thinking-indicator">
              <div className="px-4 py-3" style={{ background: "rgba(8,12,14,0.8)", border: "1px solid rgba(0,255,135,0.15)" }}>
                <div className="font-accent text-[10px] tracking-[0.3em] uppercase mb-1.5" style={{ color: "rgba(0,255,135,0.6)" }}>
                  [ RENAISSANCE ]
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--green)" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="font-mono">{finalizing ? "génération du profil..." : "analyse en cours..."}</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4" style={{ borderTop: "1px solid rgba(0,255,135,0.15)" }}>
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              data-testid="awakening-chat-input"
              autoFocus rows={2}
              className="sys-input resize-none flex-1"
              placeholder={thinking ? "Renaissance analyse..." : "Réponds honnêtement..."}
              value={input}
              disabled={thinking || finalizing}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button
              data-testid="awakening-chat-send"
              onClick={handleSend}
              disabled={!input.trim() || thinking || finalizing}
              className="sys-btn inline-flex items-center gap-2 self-stretch"
            >
              <Send size={14} />
            </button>
          </div>
          <div className="text-[10px] font-mono mt-2 tracking-widest uppercase" style={{ color: "rgba(107,138,148,0.5)" }}>
            Entrée pour envoyer · Shift+Entrée pour saut de ligne
          </div>
        </div>
      </div>
    </div>
  );
}

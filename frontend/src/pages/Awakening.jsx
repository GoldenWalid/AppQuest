import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { API } from "@/lib/api";

// generate a stable session id per awakening
const newSessionId = () =>
  `awaken-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function Awakening({ onInitiated }) {
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [messages, setMessages] = useState([]); // [{role:'assistant'|'user', content}]
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const handleRestart = async () => {
    if (thinking || finalizing) return;
    if (messages.length > 0 && !window.confirm("Recommencer la conversation depuis le début ?")) return;
    setMessages([]);
    setInput("");
    setSessionId(newSessionId());
    setStarted(false);
    toast.success("Conversation réinitialisée");
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  const sendTurn = async (history) => {
    setThinking(true);
    try {
      const res = await axios.post(`${API}/awaken/chat`, {
        session_id: sessionId,
        messages: history,
      });
      if (res.data.done) {
        setFinalizing(true);
        toast.success("SYSTEM activé", { description: res.data.system_message });
        if (onInitiated) await onInitiated();
        navigate("/");
      } else {
        setMessages([
          ...history,
          { role: "assistant", content: res.data.message },
        ]);
      }
    } catch (e) {
      toast.error("Erreur SYSTEM", {
        description: e?.response?.data?.detail || e.message,
      });
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleStart = async () => {
    setStarted(true);
    await sendTurn([]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    await sendTurn(next);
  };

  // INTRO SCREEN
  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full corner-frame sys-card scanlines p-12 relative text-center"
          data-testid="awakening-intro"
        >
          <div className="font-accent text-xs tracking-[0.5em] text-cyan-300/70 mb-4">
            [ SYSTEM // PROTOCOLE D'ÉVEIL ]
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black uppercase mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-cyan-400 to-blue-600 tracking-tighter">
            Tu as été<br />choisi, Hunter
          </h1>
          <p className="text-slate-300 mb-3 max-w-lg mx-auto leading-relaxed">
            Le <span className="text-cyan-300 glow-text">SYSTEM</span> va dialoguer avec toi.
            Pas de formulaire — une vraie conversation pour comprendre qui tu es,
            ce que tu portes, ce que tu cherches à devenir.
          </p>
          <p className="text-slate-500 text-sm mb-10 font-mono">
            &gt; identité · ombres · corps · valeurs · vision · réel
          </p>
          <button
            data-testid="start-awakening-btn"
            onClick={handleStart}
            className="sys-btn inline-flex items-center gap-2"
          >
            <Sparkles size={14} /> Initier l'éveil
          </button>
          <p className="text-slate-600 text-xs mt-6 font-mono">
            La conversation prendra ~10-15 échanges. Réponds en vérité.
          </p>
        </motion.div>
      </div>
    );
  }

  // CHAT SCREEN
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-3xl w-full sys-card corner-frame relative flex flex-col" style={{ height: "min(85vh, 800px)" }}>
        {/* Header */}
        <div className="border-b border-cyan-500/20 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-accent text-[10px] tracking-[0.4em] text-cyan-300/70 uppercase">
              [ SYSTEM // ÉVEIL EN COURS ]
            </div>
            <div className="font-display text-lg font-bold text-cyan-300 glow-text">
              Dialogue avec le SYSTEM
            </div>
          </div>
          <div className="font-mono text-xs text-slate-500 flex items-center gap-3">
            <span>{messages.filter(m => m.role === "user").length} réponse{messages.filter(m => m.role === "user").length !== 1 ? "s" : ""}</span>
            <button
              data-testid="awakening-restart-btn"
              onClick={handleRestart}
              disabled={thinking || finalizing}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-cyan-300 transition uppercase tracking-widest text-[10px] disabled:opacity-40"
              title="Recommencer la conversation"
            >
              <RotateCcw size={12} /> Recommencer
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4"
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
                  className={`max-w-[85%] px-4 py-3 ${
                    m.role === "user"
                      ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-50"
                      : "bg-black/60 border border-cyan-500/20 text-slate-200"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="font-accent text-[10px] tracking-[0.3em] text-cyan-300/70 uppercase mb-1.5">
                      [ SYSTEM ]
                    </div>
                  )}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {thinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
              data-testid="thinking-indicator"
            >
              <div className="bg-black/60 border border-cyan-500/20 px-4 py-3">
                <div className="font-accent text-[10px] tracking-[0.3em] text-cyan-300/70 uppercase mb-1.5">
                  [ SYSTEM ]
                </div>
                <div className="flex items-center gap-2 text-cyan-300 text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="font-mono">
                    {finalizing ? "génération de ton architecture..." : "analyse en cours..."}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-cyan-500/20 p-4">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              data-testid="awakening-chat-input"
              autoFocus
              rows={2}
              className="sys-input resize-none flex-1"
              placeholder={thinking ? "Le SYSTEM réfléchit..." : "Réponds en vérité..."}
              value={input}
              disabled={thinking || finalizing}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
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
          <div className="text-[10px] text-slate-500 font-mono mt-2 tracking-widest uppercase">
            Entrée pour envoyer · Shift+Entrée pour saut de ligne
          </div>
        </div>
      </div>
    </div>
  );
}

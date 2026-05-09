import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { API } from "@/lib/api";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint =
        mode === "login" ? `${API}/auth/login` : `${API}/auth/register`;
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { email: form.email, password: form.password, name: form.name };
      const res = await axios.post(endpoint, payload, { withCredentials: true });
      setUser(res.data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full corner-frame sys-card scanlines p-12 relative text-center"
        data-testid="login-page"
      >
        <div className="font-accent text-xs tracking-[0.5em] text-cyan-300/70 mb-4">
          [ ENTREE · SEUIL · LEGENDE ]
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-black uppercase mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-cyan-400 to-blue-600 tracking-tighter">
          Hunter Protocol
        </h1>
        <p className="text-slate-300 mb-3 max-w-md mx-auto leading-relaxed">
          Avant de franchir le seuil, identifie-toi.{" "}
          <span className="text-cyan-300 glow-text">The System</span> a besoin
          de reconnaitre ton chemin pour que ta legende personnelle te soit propre.
        </p>
        <p className="text-slate-500 text-sm mb-8 font-mono">
          ta cartographie, ton rythme, ton miroir — uniquement a toi.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {mode === "register" && (
            <div>
              <label className="block text-xs text-cyan-300/60 uppercase tracking-widest mb-1 font-mono">
                Ton nom
              </label>
              <input
                type="text"
                required
                placeholder="Hunter"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-900/80 border border-cyan-900/50 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-cyan-300/60 uppercase tracking-widest mb-1 font-mono">
              Email
            </label>
            <input
              type="email"
              required
              placeholder="hunter@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-slate-900/80 border border-cyan-900/50 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-cyan-300/60 uppercase tracking-widest mb-1 font-mono">
              Mot de passe
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-slate-900/80 border border-cyan-900/50 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono text-sm"
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs text-center font-mono bg-red-950/30 rounded-lg py-2 px-3 border border-red-900/40">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="login-btn"
            className="sys-btn w-full inline-flex items-center justify-center gap-3 mt-2"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {mode === "login" ? "Franchir le seuil" : "Eveiller ta legende"}
          </button>
        </form>

        <div className="mt-6 text-center">
          {mode === "login" ? (
            <p className="text-slate-600 text-xs font-mono">
              Pas encore de compte ?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 transition"
              >
                Creer ton profil
              </button>
            </p>
          ) : (
            <p className="text-slate-600 text-xs font-mono">
              Deja un compte ?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 transition"
              >
                Se connecter
              </button>
            </p>
          )}
        </div>

        <p className="text-slate-700 text-xs mt-8 font-mono leading-relaxed">
          Tes donnees restent privees — ta legende t'appartient.
        </p>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

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
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };
      const res = mode === "login"
        ? await api.login(payload)
        : await api.register(payload);
      setUser(res.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    background: "rgba(8,12,14,0.9)",
    border: "1px solid rgba(0,255,135,0.2)",
    padding: "0.75rem 1rem",
    color: "var(--text)",
    fontFamily: "monospace",
    fontSize: "0.875rem",
    outline: "none",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.625rem",
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    marginBottom: "0.375rem",
    fontFamily: "'Chakra Petch', monospace",
    color: "rgba(0,255,135,0.5)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full corner-frame sys-card scanlines p-10 sm:p-14 relative text-center"
        data-testid="login-page"
      >
        <div className="font-accent text-xs tracking-[0.5em] mb-4" style={{ color: "rgba(0,255,135,0.5)" }}>
          [ ENTREE · SEUIL · LÉGENDE ]
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-black uppercase mb-6 tracking-tighter"
          style={{ color: "var(--green)", textShadow: "0 0 30px rgba(0,255,135,0.4)" }}>
          Renaissance
        </h1>

        <p className="mb-3 max-w-md mx-auto leading-relaxed" style={{ color: "var(--text)" }}>
          Avant de franchir le seuil, identifie-toi.{" "}
          <span style={{ color: "var(--green)" }}>The System</span> a besoin de
          reconnaître ton chemin pour que ta légende personnelle te soit propre.
        </p>
        <p className="text-sm mb-8 font-mono" style={{ color: "var(--text-muted)" }}>
          ta cartographie · ton rythme · ton miroir — uniquement à toi.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {mode === "register" && (
            <div>
              <label style={labelStyle}>Ton nom</label>
              <input
                type="text" required placeholder="Hunter"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
                className="sys-input"
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email" required placeholder="hunter@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={inputStyle}
              className="sys-input"
            />
          </div>

          <div>
            <label style={labelStyle}>Mot de passe</label>
            <input
              type="password" required placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              style={inputStyle}
              className="sys-input"
            />
          </div>

          {error && (
            <div className="text-xs text-center font-mono py-2 px-3" style={{
              color: "var(--red)", background: "rgba(255,60,60,0.07)",
              border: "1px solid rgba(255,60,60,0.25)"
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} data-testid="login-btn"
            className="sys-btn w-full inline-flex items-center justify-center gap-3 mt-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {mode === "login" ? "Franchir le seuil" : "Éveiller ta légende"}
          </button>
        </form>

        <div className="mt-6 text-center">
          {mode === "login" ? (
            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              Pas encore de compte ?{" "}
              <button type="button" onClick={() => { setMode("register"); setError(null); }}
                className="transition" style={{ color: "var(--green)" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                Créer ton profil
              </button>
            </p>
          ) : (
            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              Déjà un compte ?{" "}
              <button type="button" onClick={() => { setMode("login"); setError(null); }}
                className="transition" style={{ color: "var(--green)" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                Se connecter
              </button>
            </p>
          )}
        </div>

        <p className="text-xs mt-8 font-mono leading-relaxed" style={{ color: "rgba(107,138,148,0.4)" }}>
          Tes données restent privées — ta légende t'appartient.
        </p>
      </motion.div>
    </div>
  );
}

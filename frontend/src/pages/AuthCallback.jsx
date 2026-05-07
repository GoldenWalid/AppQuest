import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    // clear the hash from URL immediately
    window.history.replaceState(null, "", window.location.pathname);

    (async () => {
      try {
        const res = await api.exchangeSession(sessionId);
        setUser(res.user);
        navigate("/", { replace: true, state: { user: res.user } });
      } catch (e) {
        setError(e?.response?.data?.detail || e.message);
        setTimeout(() => navigate("/login", { replace: true }), 2500);
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center" data-testid="auth-callback">
        <Loader2 className="mx-auto text-cyan-300 animate-spin mb-4" size={28} />
        <div className="font-accent tracking-[0.4em] uppercase text-xs text-cyan-300/80">
          {error ? "Échec de l'authentification" : "Reconnaissance du seuil..."}
        </div>
        {error && <div className="text-red-400 text-xs font-mono mt-3">{error}</div>}
      </div>
    </div>
  );
}

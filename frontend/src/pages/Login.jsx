import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function Login() {
  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
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
          [ ENTRÉE · SEUIL · LÉGENDE ]
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-black uppercase mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-cyan-400 to-blue-600 tracking-tighter">
          Hunter Protocol
        </h1>
        <p className="text-slate-300 mb-3 max-w-md mx-auto leading-relaxed">
          Avant de franchir le seuil, identifie-toi. <span className="text-cyan-300 glow-text">The System</span> a besoin de
          reconnaître ton chemin pour que ta légende personnelle te soit propre.
        </p>
        <p className="text-slate-500 text-sm mb-10 font-mono">
          ta cartographie, ton rythme, ton miroir — uniquement à toi.
        </p>
        <button
          data-testid="google-login-btn"
          onClick={handleGoogleLogin}
          className="sys-btn inline-flex items-center gap-3"
        >
          <Sparkles size={14} /> Franchir le seuil
        </button>
        <p className="text-slate-600 text-xs mt-8 font-mono leading-relaxed">
          Authentification sécurisée via Emergent. Tes données restent privées —
          ton coach n'a accès qu'à ce que tu choisis de partager avec lui.
        </p>
      </motion.div>
    </div>
  );
}

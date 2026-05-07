import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Awakening from "@/pages/Awakening";
import Dashboard from "@/pages/Dashboard";
import Quests from "@/pages/Quests";
import Achievements from "@/pages/Achievements";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((e) => console.warn("SW register failed:", e));
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "OPEN_QUESTS") {
        window.location.assign("/quests");
      }
    });
  }
}

function App() {
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    try {
      const p = await api.getProfile();
      setProfile(p);
    } catch (_) {
      setProfile(null);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    refresh();
    registerServiceWorker();
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-accent text-cyan-300 tracking-[0.5em] uppercase text-xs animate-pulse">
          [ SYSTEM BOOTING... ]
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "rgba(0,0,0,0.9)",
              border: "1px solid rgba(0, 229, 255, 0.4)",
              color: "#E2E8F0",
              fontFamily: "JetBrains Mono, monospace",
              boxShadow: "0 0 20px rgba(0, 229, 255, 0.15)",
            },
          }}
        />
        <Routes>
          <Route
            path="/awakening"
            element={<Awakening onInitiated={refresh} />}
          />
          <Route
            path="/"
            element={
              profile?.initiated ? (
                <Shell profile={profile} onProfileChange={refresh}>
                  <Dashboard profile={profile} />
                </Shell>
              ) : (
                <Navigate to="/awakening" replace />
              )
            }
          />
          <Route
            path="/quests"
            element={
              profile?.initiated ? (
                <Shell profile={profile} onProfileChange={refresh}>
                  <Quests />
                </Shell>
              ) : (
                <Navigate to="/awakening" replace />
              )
            }
          />
          <Route
            path="/achievements"
            element={
              profile?.initiated ? (
                <Shell profile={profile} onProfileChange={refresh}>
                  <Achievements />
                </Shell>
              ) : (
                <Navigate to="/awakening" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;

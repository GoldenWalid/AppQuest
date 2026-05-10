import React, { useEffect, useState, useCallback } from "react";
import "@/styles/App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
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

function ProfileGate({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, initiated: false });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await api.getProfile();
        if (alive) setState({ loading: false, initiated: !!(p && p.initiated) });
      } catch (_) {
        if (alive) setState({ loading: false, initiated: false });
      }
    })();
    return () => { alive = false; };
  }, [user?.user_id]);
  if (state.loading) return null;
  if (!state.initiated) return <Navigate to="/awakening" replace />;
  return children;
}

function AwakeningWrapper() {
  const [tick, setTick] = useState(0);
  return <Awakening onInitiated={async () => setTick((t) => t + 1)} key={tick} />;
}

function ShellWrapper({ children }) {
  const [profile, setProfile] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const p = await api.getProfile();
      setProfile(p);
    } catch (_) { setProfile(null); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <Shell profile={profile} onProfileChange={refresh}>
      {children}
    </Shell>
  );
}

function DashboardWrapper() {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);
  return <Dashboard profile={profile} />;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/awakening"
        element={
          <ProtectedRoute>
            <AwakeningWrapper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ProfileGate>
              <ShellWrapper>
                <DashboardWrapper />
              </ShellWrapper>
            </ProfileGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/quests"
        element={
          <ProtectedRoute>
            <ProfileGate>
              <ShellWrapper>
                <Quests />
              </ShellWrapper>
            </ProfileGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/achievements"
        element={
          <ProtectedRoute>
            <ProfileGate>
              <ShellWrapper>
                <Achievements />
              </ShellWrapper>
            </ProfileGate>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  void React;
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
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
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Swords, Trophy, Bell, RotateCcw, LayoutDashboard, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import ReminderSettings from "@/components/ReminderSettings";
import { useDailyReminder } from "@/hooks/useDailyReminder";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/quests", label: "Quests", icon: Swords, testid: "nav-quests" },
  { to: "/achievements", label: "Succès", icon: Trophy, testid: "nav-achievements" },
];

export default function Shell({ profile, children, onProfileChange }) {
  const navigate = useNavigate();
  const [reminderOpen, setReminderOpen] = useState(false);
  const { user, logout } = useAuth();
  useDailyReminder();

  const handleReset = async () => {
    if (!window.confirm("Réinitialiser ta traversée ? Cette action est irréversible.")) return;
    await api.reset();
    onProfileChange && onProfileChange();
    navigate("/awakening");
    toast.success("Traversée réinitialisée");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative z-10">
      <aside className="lg:w-64 flex-shrink-0" style={{
        borderRight: "1px solid rgba(0,255,135,0.15)",
        background: "rgba(8,12,14,0.85)",
        backdropFilter: "blur(20px)",
      }}>
        <div className="p-6">
          <div className="font-accent text-[10px] tracking-[0.5em] mb-1" style={{ color: "rgba(0,255,135,0.5)" }}>[ SYSTEM ]</div>
          <div className="font-display text-xl font-black uppercase glow-text-green" style={{ color: "var(--green)" }} data-testid="app-title">
            Renaissance
          </div>

          {user && (
            <div className="mt-4 flex items-center gap-3" data-testid="user-card">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-9 h-9" style={{ border: "1px solid rgba(0,255,135,0.3)" }} />
              ) : (
                <div className="w-9 h-9 flex items-center justify-center font-display font-bold text-sm" style={{
                  border: "1px solid rgba(0,255,135,0.3)",
                  background: "rgba(0,255,135,0.07)",
                  color: "var(--green)",
                }}>
                  {(user.name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-mono truncate" style={{ color: "var(--text)" }}>{user.name}</div>
                <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{user.email}</div>
              </div>
            </div>
          )}

          {profile?.class_title && (
            <div className="mt-4 p-3" style={{ border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.04)" }} data-testid="profile-class-card">
              <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(0,255,135,0.5)" }}>Classe</div>
              <div className="font-display text-sm font-bold mt-1" style={{ color: "var(--green)" }}>{profile.class_title}</div>
              <div className="text-[10px] tracking-[0.2em] uppercase mt-2" style={{ color: "var(--text-muted)" }}>Hunter</div>
              <div className="text-sm" style={{ color: "var(--text)" }}>{profile.name}</div>
            </div>
          )}
        </div>

        <nav className="px-3 flex lg:flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 transition-all font-accent tracking-widest uppercase text-xs ${isActive ? "active-nav" : "inactive-nav"}`
              }
              style={({ isActive }) => isActive
                ? { borderLeft: "2px solid var(--green)", background: "rgba(0,255,135,0.08)", color: "var(--green)" }
                : { borderLeft: "2px solid transparent", color: "var(--text-muted)" }
              }
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 p-4 space-y-2" style={{ borderTop: "1px solid rgba(0,255,135,0.1)" }}>
          <button
            data-testid="enable-notif-btn"
            onClick={() => setReminderOpen(true)}
            className="w-full flex items-center gap-2 text-xs uppercase tracking-widest transition py-2"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--green)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <Bell size={14} /> Rappel quotidien
          </button>
          <button
            data-testid="reset-btn"
            onClick={handleReset}
            className="w-full flex items-center gap-2 text-xs uppercase tracking-widest transition py-2"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <RotateCcw size={14} /> Réinitialiser
          </button>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs uppercase tracking-widest transition py-2"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--green)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">{children}</main>

      <ReminderSettings open={reminderOpen} onClose={() => setReminderOpen(false)} />
    </div>
  );
}

import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Swords, Trophy, Bell, RotateCcw, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import ReminderSettings from "@/components/ReminderSettings";
import { useDailyReminder } from "@/hooks/useDailyReminder";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/quests", label: "Quests", icon: Swords, testid: "nav-quests" },
  { to: "/achievements", label: "Succès", icon: Trophy, testid: "nav-achievements" },
];

export default function Shell({ profile, children, onProfileChange }) {
  const navigate = useNavigate();
  const [reminderOpen, setReminderOpen] = useState(false);
  // initialize daily reminder scheduling at app shell mount
  useDailyReminder();

  const handleReset = async () => {
    if (!window.confirm("Réinitialiser tout le SYSTEM ? Cette action est irréversible.")) return;
    await api.reset();
    onProfileChange && onProfileChange();
    navigate("/awakening");
    toast.success("SYSTEM réinitialisé");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative z-10">
      {/* Sidebar */}
      <aside className="lg:w-64 border-b lg:border-b-0 lg:border-r border-cyan-500/20 bg-black/40 backdrop-blur-xl">
        <div className="p-6">
          <div className="font-accent text-[10px] tracking-[0.5em] text-cyan-300/70 mb-1">[ SYSTEM ]</div>
          <div className="font-display text-xl font-black text-cyan-300 glow-text uppercase" data-testid="app-title">
            Hunter Protocol
          </div>
          {profile?.class_title && (
            <div className="mt-4 p-3 border border-cyan-500/20 bg-black/50" data-testid="profile-class-card">
              <div className="text-[10px] tracking-[0.2em] text-cyan-300/60 uppercase">Classe</div>
              <div className="font-display text-sm font-bold text-cyan-300 mt-1">{profile.class_title}</div>
              <div className="text-[10px] tracking-[0.2em] text-slate-500 mt-2 uppercase">Hunter</div>
              <div className="text-slate-200 text-sm">{profile.name}</div>
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
                `flex items-center gap-3 px-4 py-3 border-l-2 transition-all font-accent tracking-widest uppercase text-xs ${
                  isActive
                    ? "border-cyan-400 bg-cyan-500/10 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/5"
                }`
              }
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 p-4 space-y-2 border-t border-cyan-500/10">
          <button
            data-testid="enable-notif-btn"
            onClick={() => setReminderOpen(true)}
            className="w-full flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400 hover:text-cyan-300 transition py-2"
          >
            <Bell size={14} /> Rappel quotidien
          </button>
          <button
            data-testid="reset-btn"
            onClick={handleReset}
            className="w-full flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 hover:text-red-400 transition py-2"
          >
            <RotateCcw size={14} /> Reset System
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4 sm:p-8 max-w-6xl">{children}</main>

      <ReminderSettings open={reminderOpen} onClose={() => setReminderOpen(false)} />
    </div>
  );
}

import React from "react";
import { BarChart3, BookOpen, Home, LogOut, MessageSquare, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "../types";

interface DashboardProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Home", path: "/dashboard", icon: Home },
  { label: "AI Advisor", path: "/advisor", icon: MessageSquare },
  { label: "Courses", path: "/courses", icon: BookOpen },
  { label: "Results", path: "/results", icon: BarChart3 },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/advisor": "AI Advisor",
  "/courses": "Courses",
  "/results": "Results",
};

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = pageTitles[location.pathname] ?? "Dashboard";
  const isAdvisor = location.pathname === "/advisor";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="hidden w-72 flex-col border-r border-white/10 bg-navy-950 text-white shadow-2xl shadow-navy-950/20 md:flex">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-500 text-navy-950 shadow-lg shadow-gold-900/20">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">UniPortal AI</div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">AAST Platform</div>
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 bg-navy-900/70 p-6">
          <div className="flex items-center gap-3">
            <img
              src={user.avatarUrl}
              alt={`${user.name} avatar`}
              className="h-14 w-14 rounded-2xl border border-white/10 object-cover shadow-lg"
            />
            <div className="min-w-0">
              <div className="truncate font-bold">{user.name}</div>
              <div className="mt-1 truncate text-xs text-slate-400">{user.major}</div>
              <div className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {user.studentId}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-gold-500 text-navy-950 shadow-lg shadow-navy-950/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-red-500/10 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-400/30"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-950">{pageTitle}</h2>
            <p className="hidden text-xs font-medium text-slate-500 sm:block">
              Academic intelligence workspace
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="hidden h-10 w-64 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition focus-within:border-navy-300 focus-within:ring-2 focus-within:ring-navy-500/10 lg:flex">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input
                placeholder="Search services..."
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              />
            </label>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-500/20 md:hidden"
            >
              Logout
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 overflow-hidden ${isAdvisor ? "p-3 sm:p-4" : "p-4 sm:p-6"}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "../types";

interface DashboardProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const navItems = [
  { label: "Home", path: "/dashboard" },
  { label: "AI Advisor", path: "/advisor" },
  { label: "Courses", path: "/courses" },
  { label: "Results", path: "/results" },
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

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="hidden w-64 flex-col border-r bg-white md:flex">
        <div className="border-b p-6">
          <div className="text-lg font-bold">UniPortal AI</div>
        </div>

        <div className="bg-navy-900 p-6 text-center text-white">
          <img
            src={user.avatarUrl}
            alt="avatar"
            className="mx-auto mb-2 h-16 w-16 rounded-full object-cover"
          />
          <div className="font-semibold">{user.name}</div>
          <div className="text-xs text-gray-300">{user.major}</div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`w-full rounded px-4 py-2 text-left ${
                location.pathname === item.path ? "bg-navy-50" : "hover:bg-gray-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t p-4">
          <button type="button" onClick={onLogout} className="w-full text-red-500">
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b bg-white px-6">
          <h2 className="font-bold">{pageTitle}</h2>
          <div className="flex items-center gap-4">
            <input
              placeholder="Search services..."
              className="hidden w-64 rounded-full border px-3 py-2 text-sm md:block"
            />
            <button type="button" onClick={onLogout} className="rounded bg-gray-100 px-3 py-2">
              Logout
            </button>
          </div>
        </div>

        <div className="h-[calc(100vh-4rem)] overflow-hidden p-6">{children}</div>
      </main>
    </div>
  );
};

export default Dashboard;

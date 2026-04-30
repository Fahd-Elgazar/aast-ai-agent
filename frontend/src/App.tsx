import React, { useState } from "react";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import GuestAdvisorPage from "./components/GuestAdvisorPage";
import type { User } from "./types";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  // ✅ Student login
  const handleLogin = (u: User) => {
    setIsGuest(false);
    setUser(u);
  };

  // 🟡 Guest / Newcomer login
  const handleGuest = () => {
    setIsGuest(true);
    setUser({
      name: "Newcomer",
      major: "Undeclared",
      studentId: "GUEST",
      avatarUrl: "https://ui-avatars.com/api/?name=Guest"
    });
  };

  // 🔓 Logout
  const handleLogout = () => {
    setUser(null);
    setIsGuest(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {!user ? (
        // Not logged in
        <LoginPage
          onLogin={handleLogin}
          onGuestAccess={handleGuest}
        />
      ) : isGuest ? (
        // 🟢 Guest → AI Advisor ONLY
        <GuestAdvisorPage onLogout={handleLogout} />
      ) : (
        // 🔵 Student → Full Dashboard
        <Dashboard
          user={user}
          isGuest={isGuest}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};

export default App;

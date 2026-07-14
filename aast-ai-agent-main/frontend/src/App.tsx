import React, { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import GuestAdvisorPage from "./components/GuestAdvisorPage";
import LoginPage from "./components/LoginPage";
import AdvisorPage from "./components/pages/AdvisorPage";
import CoursesPage from "./components/pages/CoursesPage";
import HomePage from "./components/pages/HomePage";
import ResultsPage from "./components/pages/ResultsPage";
import type { User } from "./types";
import { StudentProvider } from "./decision/context/StudentContext";
import DecisionPage from "./decision/pages/DecisionPage";
import ChatPage from "./decision/pages/ChatPage";
import AdminDashboardPage from "./decision/pages/AdminDashboardPage";

const AUTH_USER_STORAGE_KEY = "aast_ai_agent_user";
const AUTH_GUEST_STORAGE_KEY = "aast_ai_agent_is_guest";

function readStoredUser(): User | null {
  try {
    const rawUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!rawUser) return null;

    const parsed = JSON.parse(rawUser) as Partial<User>;
    if (!parsed.name || !parsed.major || !parsed.studentId || !parsed.avatarUrl) {
      return null;
    }

    return {
      name: parsed.name,
      major: parsed.major,
      studentId: parsed.studentId,
      avatarUrl: parsed.avatarUrl,
    };
  } catch {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem(AUTH_GUEST_STORAGE_KEY);
    return null;
  }
}

function readStoredGuestFlag(): boolean {
  return localStorage.getItem(AUTH_GUEST_STORAGE_KEY) === "true";
}

function persistSession(nextUser: User, nextIsGuest: boolean) {
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser));
  localStorage.setItem(AUTH_GUEST_STORAGE_KEY, String(nextIsGuest));
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [isGuest, setIsGuest] = useState(() => readStoredGuestFlag());
  const navigate = useNavigate();

  const handleLogin = (nextUser: User) => {
    setIsGuest(false);
    setUser(nextUser);
    persistSession(nextUser, false);
    navigate("/dashboard");
  };

  const handleGuest = () => {
    const guestUser = {
      name: "Newcomer",
      major: "Undeclared",
      studentId: "GUEST",
      avatarUrl: "https://ui-avatars.com/api/?name=Guest",
    };
    setIsGuest(true);
    setUser(guestUser);
    persistSession(guestUser, true);
    navigate("/advisor");
  };

  const handleLogout = () => {
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem(AUTH_GUEST_STORAGE_KEY);
    navigate("/");
  };

  return (
    <StudentProvider>
      <div className="min-h-screen bg-gray-100">
        <Routes>
        <Route
          path="/"
          element={
            user ? (
              <Navigate to={isGuest ? "/advisor" : "/dashboard"} replace />
            ) : (
              <LoginPage onLogin={handleLogin} onGuestAccess={handleGuest} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            user && !isGuest ? (
              <Dashboard user={user} onLogout={handleLogout}>
                <HomePage
                  userName={user.name.split(" ")[0]}
                  onAskAdvisor={() => navigate("/advisor")}
                />
              </Dashboard>
            ) : (
              <Navigate to={user && isGuest ? "/advisor" : "/"} replace />
            )
          }
        />
        <Route
          path="/advisor"
          element={
            user ? (
              isGuest ? (
                <GuestAdvisorPage onLogout={handleLogout} />
              ) : (
                <Dashboard user={user} onLogout={handleLogout}>
                  <AdvisorPage />
                </Dashboard>
              )
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/courses"
          element={
            user && !isGuest ? (
              <Dashboard user={user} onLogout={handleLogout}>
                <CoursesPage />
              </Dashboard>
            ) : (
              <Navigate to={user && isGuest ? "/advisor" : "/"} replace />
            )
          }
        />
        <Route
          path="/results"
          element={
            user && !isGuest ? (
              <Dashboard user={user} onLogout={handleLogout}>
                <ResultsPage />
              </Dashboard>
            ) : (
              <Navigate to={user && isGuest ? "/advisor" : "/"} replace />
            )
          }
        />
        <Route path="/decision" element={<DecisionPage />} />
        <Route path="/decision/chat" element={<ChatPage />} />
        <Route path="/decision/admin" element={<AdminDashboardPage />} />
        <Route
          path="*"
          element={<Navigate to={user ? (isGuest ? "/advisor" : "/dashboard") : "/"} replace />}
        />
      </Routes>
    </div>
    </StudentProvider>
  );
};

export default App;

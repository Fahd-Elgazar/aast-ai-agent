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
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (nextUser: User) => {
    setIsGuest(false);
    setUser(nextUser);
    navigate("/dashboard");
  };

  const handleGuest = () => {
    setIsGuest(true);
    setUser({
      name: "Newcomer",
      major: "Undeclared",
      studentId: "GUEST",
      avatarUrl: "https://ui-avatars.com/api/?name=Guest",
    });
    navigate("/advisor");
  };

  const handleLogout = () => {
    setUser(null);
    setIsGuest(false);
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

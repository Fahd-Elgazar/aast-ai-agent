import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import GuestAdvisorPage from "./components/GuestAdvisorPage";
import LoginPage from "./components/LoginPage";
import AdvisorPage from "./components/pages/AdvisorPage";
import CoursesPage from "./components/pages/CoursesPage";
import HomePage from "./components/pages/HomePage";
import ResultsPage from "./components/pages/ResultsPage";
import { StudentProvider } from "./decision/context/StudentContext";
import DecisionPage from "./decision/pages/DecisionPage";
import ChatPage from "./decision/pages/ChatPage";
import AdminDashboardPage from "./decision/pages/AdminDashboardPage";
import { login, loginAsGuest, validateSession } from "./services/authApi";
import {
  clearAuthSession,
  persistAuthSession,
  readAuthSession,
  type AuthSession,
} from "./services/authStorage";

const App: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(() => readAuthSession());
  const [checkingAuth, setCheckingAuth] = useState(() => Boolean(readAuthSession()));
  const navigate = useNavigate();

  useEffect(() => {
    const stored = readAuthSession();
    if (!stored) return;

    validateSession()
      .then((user) => {
        const refreshed = { ...stored, user };
        persistAuthSession(refreshed);
        setSession(refreshed);
      })
      .catch(() => {
        clearAuthSession();
        setSession(null);
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogin = async (studentId: string, password: string) => {
    const nextSession = await login(studentId, password);
    setSession(nextSession);
    navigate(nextSession.user.role === "guest" ? "/advisor" : "/dashboard");
  };

  const handleGuest = async () => {
    const nextSession = await loginAsGuest();
    setSession(nextSession);
    navigate("/advisor");
  };

  const handleLogout = () => {
    clearAuthSession();
    setSession(null);
    navigate("/");
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center text-slate-600">Checking secure session...</div>;
  }

  const user = session?.user || null;
  const isGuest = user?.role === "guest";
  const defaultAuthenticatedRoute = isGuest ? "/advisor" : "/dashboard";

  return (
    <StudentProvider>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <Navigate to={defaultAuthenticatedRoute} replace />
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
                <Navigate to={user ? "/advisor" : "/"} replace />
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
                <Navigate to={user ? "/advisor" : "/"} replace />
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
                <Navigate to={user ? "/advisor" : "/"} replace />
              )
            }
          />
          <Route path="/decision" element={user ? <DecisionPage /> : <Navigate to="/" replace />} />
          <Route path="/decision/chat" element={user ? <ChatPage /> : <Navigate to="/" replace />} />
          <Route
            path="/decision/admin"
            element={user?.role === "admin" ? <AdminDashboardPage /> : <Navigate to={user ? defaultAuthenticatedRoute : "/"} replace />}
          />
          <Route
            path="*"
            element={<Navigate to={user ? defaultAuthenticatedRoute : "/"} replace />}
          />
        </Routes>
      </div>
    </StudentProvider>
  );
};

export default App;

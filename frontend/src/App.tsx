import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Register from "./components/Register";
import Login from "./components/Login";
import RequireAuth from "./components/RequireAuth";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import { getAccessToken } from "./services/session";

function AppHeader() {
  const location = useLocation();
  const [signedIn, setSignedIn] = useState(() => !!getAccessToken());

  useEffect(() => {
    setSignedIn(!!getAccessToken());
  }, [location.pathname]);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-semibold text-white">
          Biometric Auth
        </Link>
        <nav className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
          <Link to="/" className="hover:text-teal-400">
            Home
          </Link>
          {signedIn ? (
            <Link to="/dashboard" className="hover:text-teal-400">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/register" className="hover:text-teal-400">
                Register
              </Link>
              <Link to="/login" className="hover:text-teal-400">
                Login
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  SESSION_EMAIL,
  SESSION_MATCH_SCORE,
  SESSION_THRESHOLD,
  SESSION_TOKEN,
  clearSession,
  getAccessToken,
} from "../services/session";

function maskToken(token: string): string {
  if (token.length <= 16) return "••••••••";
  return `${token.slice(0, 10)}…${token.slice(-8)}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const email = sessionStorage.getItem(SESSION_EMAIL) ?? "—";
  const matchScore = sessionStorage.getItem(SESSION_MATCH_SCORE);
  const threshold = sessionStorage.getItem(SESSION_THRESHOLD);
  const token = getAccessToken();

  const tokenPreview = useMemo(() => (token ? maskToken(token) : "—"), [token]);

  function signOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
        <p className="text-sm font-medium uppercase tracking-widest text-teal-400">
          Signed in
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          You authenticated with password and fingerprint verification.
        </p>

        <dl className="mt-8 space-y-4 text-sm">
          <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
            <dt className="text-slate-500">Email</dt>
            <dd className="truncate font-medium text-slate-100" title={email}>
              {email}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
            <dt className="text-slate-500">Fingerprint match score</dt>
            <dd className="font-mono text-teal-300">{matchScore ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
            <dt className="text-slate-500">Threshold</dt>
            <dd className="font-mono text-slate-300">{threshold ?? "—"}</dd>
          </div>
          {/* <div className="flex justify-between gap-4 pb-1">
            <dt className="text-slate-500">Session (JWT)</dt>
            <dd className="max-w-[14rem] truncate font-mono text-xs text-slate-400" title={token ?? ""}>
              {token ? tokenPreview : "—"}
            </dd>
          </div> */}
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-slate-600 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Sign out
          </button>
          <Link
            to="/"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

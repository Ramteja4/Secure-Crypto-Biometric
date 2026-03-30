import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getErrorData, getErrorMessage, loginUser } from "../services/api";
import { SESSION_EMAIL, SESSION_MATCH_SCORE, SESSION_THRESHOLD, SESSION_TOKEN, getAccessToken } from "../services/session";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (getAccessToken()) navigate("/dashboard", { replace: true });
  }, [navigate]);
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string; extra?: string } | null>(
    null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!file) {
      setMessage({ type: "err", text: "Please select a fingerprint image." });
      return;
    }

    setLoading(true);
    try {
      const res = await loginUser(email, password, file);
      if (res.success && res.data) {
        const { match_score, threshold, access_token } = res.data;
        sessionStorage.setItem(SESSION_TOKEN, access_token);
        sessionStorage.setItem(SESSION_EMAIL, email.trim().toLowerCase());
        sessionStorage.setItem(SESSION_MATCH_SCORE, String(match_score));
        sessionStorage.setItem(SESSION_THRESHOLD, String(threshold));
        navigate("/dashboard", { replace: true });
        return;
      } else {
        setMessage({ type: "err", text: res.message });
      }
    } catch (err) {
      const extraData = getErrorData<{ match_score?: number; threshold?: number }>(err);
      const parts = [getErrorMessage(err)];
      if (extraData?.match_score !== undefined) {
        parts.push(`Match score: ${extraData.match_score} (threshold: ${extraData.threshold ?? "—"})`);
      }
      setMessage({ type: "err", text: parts[0], extra: parts[1] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="mt-1 text-sm text-slate-400">
          Use the same email, password, and fingerprint image as enrollment.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="login-fp" className="block text-sm font-medium text-slate-300">
              Fingerprint image
            </label>
            <input
              id="login-fp"
              type="file"
              accept="image/*"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-teal-600"
            />
          </div>

          {message && (
            <div
              role="alert"
              className={
                message.type === "ok"
                  ? "rounded-lg bg-teal-950/50 px-3 py-2 text-sm text-teal-200 ring-1 ring-teal-800"
                  : "rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-200 ring-1 ring-red-900"
              }
            >
              <div>{message.text}</div>
              {message.extra && <div className="mt-1 text-xs opacity-90">{message.extra}</div>}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Verifying…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{" "}
          <Link to="/register" className="font-medium text-teal-400 hover:text-teal-300">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

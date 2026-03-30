import { useState } from "react";
import { Link } from "react-router-dom";
import { getErrorMessage, registerUser } from "../services/api";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!file) {
      setMessage({ type: "err", text: "Please select a fingerprint image." });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: "err", text: "Password must be at least 8 characters." });
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser(email, password, file);
      if (res.success) {
        setMessage({ type: "ok", text: res.message });
        setPassword("");
        setFile(null);
      } else {
        setMessage({ type: "err", text: res.message });
      }
    } catch (err) {
      setMessage({ type: "err", text: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Create account</h1>
        <p className="mt-1 text-sm text-slate-400">
          Register with email, password, and a fingerprint scan image.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="reg-fp" className="block text-sm font-medium text-slate-300">
              Fingerprint image
            </label>
            <input
              id="reg-fp"
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
              {message.text}
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
                Registering…
              </span>
            ) : (
              "Register"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-teal-400 hover:text-teal-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

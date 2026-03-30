import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-teal-400">
        Biometric Auth
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-3xl">
        Secure Crypto-Biometric System For Cloud Computing
      </h1>
      <p className="mt-4 text-lg text-slate-400">
        Passwords are hashed with bcrypt. Fingerprint data are encrypted at
        rest. Sessions use JWT after a successful ORB feature match.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/register"
          className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/40 transition hover:bg-teal-500"
        >
          Register
        </Link>
        <Link
          to="/login"
          className="rounded-xl border border-slate-600 bg-slate-900/80 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

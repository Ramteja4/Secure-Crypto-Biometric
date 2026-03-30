import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  SESSION_EMAIL,
  clearSession,
} from "../services/session";
import {
  getUserAnalytics,
  type ConfidenceLevel,
  type LoginAttempt,
  type UserAnalytics,
} from "../services/api";
import {
  Bar,
  Cell,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatMaybeNumber(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  if (Number.isNaN(v)) return "—";
  return v.toFixed(digits);
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function confidenceBadge(confidence: ConfidenceLevel | null | undefined): string {
  if (!confidence) return "—";
  return confidence;
}

function computeFARandFRR(attempts: LoginAttempt[]): { far: number; frr: number } {
  const total = attempts.length;
  if (total === 0) return { far: 0, frr: 0 };

  let falsePositives = 0;
  let falseNegatives = 0;

  for (const a of attempts) {
    if (a.match_score == null || a.threshold == null) continue;
    if (a.success && a.match_score < a.threshold) falsePositives += 1;
    if (!a.success && a.match_score >= a.threshold) falseNegatives += 1;
  }

  return {
    far: falsePositives / total,
    frr: falseNegatives / total,
  };
}

function computeAverageScore(attempts: LoginAttempt[]): number | null {
  const scores = attempts.map((a) => a.match_score).filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return scores.reduce((acc, s) => acc + s, 0) / scores.length;
}

function buildHistogramBins(scores: number[], binCount = 10): Array<{ label: string; count: number }> {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (min === max) {
    return [{ label: `${min.toFixed(2)}`, count: scores.length }];
  }

  const span = max - min;
  const width = span / binCount;
  const counts = Array.from({ length: binCount }, () => 0);

  for (const s of scores) {
    let idx = Math.floor((s - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    counts[idx] += 1;
  }

  return counts.map((count, i) => {
    const start = min + i * width;
    const end = start + width;
    return { label: `${start.toFixed(1)}–${end.toFixed(1)}`, count };
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const signedEmail = sessionStorage.getItem(SESSION_EMAIL) ?? "";

  const [emailInput, setEmailInput] = useState<string>(signedEmail);
  const [emailFilter, setEmailFilter] = useState<string>(signedEmail);
  const [successTableFilter, setSuccessTableFilter] = useState<"all" | "success" | "failure">("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);

  async function loadUser(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getUserAnalytics(normalized);
      setAnalytics(res);
    } catch (e) {
      setError("Failed to load analytics");
      // Keep console detail for debugging.
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!emailFilter) return;
    void loadUser(emailFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFilter]);

  function signOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  const attemptsAll = analytics?.attempts ?? [];
  const attemptsTable = useMemo(() => {
    if (successTableFilter === "all") return attemptsAll;
    const wantSuccess = successTableFilter === "success";
    return attemptsAll.filter((a) => a.success === wantSuccess);
  }, [attemptsAll, successTableFilter]);

  const metrics = useMemo(() => {
    const total = attemptsAll.length;
    const successCount = attemptsAll.filter((a) => a.success).length;
    const failedCount = total - successCount;
    const avgScore = computeAverageScore(attemptsAll);
    const { far, frr } = computeFARandFRR(attemptsAll);

    return {
      totalAttempts: total,
      successfulLogins: successCount,
      failedLogins: failedCount,
      successRate: total === 0 ? 0 : successCount / total,
      far,
      frr,
      averageScore: avgScore,
    };
  }, [attemptsAll]);

  const histogramBins = useMemo(() => {
    const scores = attemptsAll
      .map((a) => a.match_score)
      .filter((s): s is number => s !== null);
    return buildHistogramBins(scores, 10);
  }, [attemptsAll]);

  const histogramThresholdAvg = useMemo(() => {
    const thresholds = attemptsAll
      .map((a) => a.threshold)
      .filter((t): t is number => t !== null);
    if (thresholds.length === 0) return null;
    return thresholds.reduce((acc, t) => acc + t, 0) / thresholds.length;
  }, [attemptsAll]);

  const linePoints = useMemo(() => {
    // Build points from attempts so the success/failure selection in the table doesn't
    // accidentally desync the chart (charts always show "all attempts" for the email filter).
    const withScores = attemptsAll
      .filter((a) => a.match_score !== null && a.threshold !== null && a.confidence !== null)
      .map((a) => ({
        timestamp: a.timestamp,
        match_score: a.match_score as number,
        threshold: a.threshold as number,
        success: a.success,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return withScores;
  }, [attemptsAll]);

  const lineData = useMemo(() => {
    return linePoints.map((p) => ({
      x: new Date(p.timestamp).toISOString(),
      match_score_success: p.success ? p.match_score : null,
      match_score_failure: !p.success ? p.match_score : null,
    }));
  }, [linePoints]);

  const successFailureData = useMemo(
    () => [
      { name: "Success", value: metrics.successfulLogins, color: "#14b8a6" },
      { name: "Failure", value: metrics.failedLogins, color: "#f97316" },
    ],
    [metrics.successfulLogins, metrics.failedLogins],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-teal-400">
              Biometric Intelligence Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Match Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Explore login attempts, confidence, FAR/FRR, and score trends.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-slate-600 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <label className="block text-sm font-medium text-slate-300" htmlFor="emailFilter">
              Filter by user email
            </label>
            <input
              id="emailFilter"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-2"
              placeholder="user@example.com"
            />
            <button
              type="button"
              onClick={() => setEmailFilter(emailInput)}
              disabled={loading}
              className="mt-3 w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading…" : "Load"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:col-span-2">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">Attempt table filter</p>
                <p className="mt-1 text-xs text-slate-500">
                  Charts and metrics reflect the loaded email; this filter affects only the table.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-300" htmlFor="successFilter">
                  Success
                </label>
                <select
                  id="successFilter"
                  value={successTableFilter}
                  onChange={(e) => setSuccessTableFilter(e.target.value as typeof successTableFilter)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-2"
                >
                  <option value="all">All</option>
                  <option value="success">Only Success</option>
                  <option value="failure">Only Failure</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl bg-red-950/50 px-4 py-3 text-sm text-red-200 ring-1 ring-red-900">
            {error}
          </div>
        )}

        {!error && analytics === null && (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
            Load a user email to display analytics.
          </div>
        )}

        {analytics && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Total attempts</p>
                <p className="mt-2 text-3xl font-semibold text-white">{metrics.totalAttempts}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Success rate</p>
                <p className="mt-2 text-3xl font-semibold text-white">{(metrics.successRate * 100).toFixed(2)}%</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">FAR</p>
                <p className="mt-2 text-3xl font-semibold text-white">{(metrics.far * 100).toFixed(2)}%</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">FRR</p>
                <p className="mt-2 text-3xl font-semibold text-white">{(metrics.frr * 100).toFixed(2)}%</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-1 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-medium text-white">Histogram (Match Scores)</p>
                <p className="mt-1 text-xs text-slate-500">
                  {histogramThresholdAvg === null ? "Threshold reference unavailable." : `Avg threshold: ${histogramThresholdAvg.toFixed(2)}`}
                </p>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramBins} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" tick={{ fill: "#94a3b8" }} interval={0} />
                      <YAxis tick={{ fill: "#94a3b8" }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: 8,
                        }}
                        formatter={(value: unknown) => [String(value), "count"]}
                      />
                      <Bar dataKey="count" fill="#14b8a6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-medium text-white">Match Score Over Time</p>
                <p className="mt-1 text-xs text-slate-500">
                  Successes and failures are shown as separate series.
                </p>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="x"
                        tick={{ fill: "#94a3b8" }}
                        tickFormatter={(v) => {
                          const d = new Date(String(v));
                          if (Number.isNaN(d.getTime())) return String(v);
                          return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fill: "#94a3b8" }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: 8,
                        }}
                        labelFormatter={(label) => formatTimestamp(String(label))}
                      />
                      {histogramThresholdAvg !== null && (
                        <ReferenceLine
                          y={histogramThresholdAvg}
                          stroke="#64748b"
                          strokeDasharray="6 6"
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="match_score_success"
                        stroke="#14b8a6"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="match_score_failure"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-1 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-medium text-white">Success vs Failure</p>
                <p className="mt-1 text-xs text-slate-500">
                  Total successes: {metrics.successfulLogins} | Total failures: {metrics.failedLogins}
                </p>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={successFailureData}
                      margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8" }} />
                      <YAxis tick={{ fill: "#94a3b8" }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {successFailureData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Attempts Table</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Email: <span className="font-medium text-slate-200">{analytics.email}</span> | Average score:{" "}
                      <span className="font-medium text-slate-200">{metrics.averageScore === null ? "—" : metrics.averageScore.toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Showing {attemptsTable.length} / {attemptsAll.length} rows
                  </div>
                </div>

                <div className="mt-4 overflow-auto">
                  <table className="min-w-[900px] w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left">
                        {[
                          "Email",
                          "Match Score",
                          "Threshold",
                          "Confidence",
                          "Timestamp",
                        ].map((h) => (
                          <th
                            key={h}
                            className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/60 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attemptsTable.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-sm text-slate-400">
                            No attempts found for this filter.
                          </td>
                        </tr>
                      ) : (
                        [...attemptsTable]
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .map((a) => (
                            <tr key={`${a.timestamp}-${a.match_score}-${String(a.success)}`} className="border-b border-slate-800/60">
                              <td className="px-3 py-3 text-sm text-slate-100">{a.email}</td>
                              <td className="px-3 py-3 font-mono text-sm text-teal-300">{formatMaybeNumber(a.match_score)}</td>
                              <td className="px-3 py-3 font-mono text-sm text-slate-300">{formatMaybeNumber(a.threshold)}</td>
                              <td className="px-3 py-3 text-sm text-slate-200">
                                <span
                                  className={[
                                    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                                    a.confidence === "High" ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : "",
                                    a.confidence === "Medium" ? "border-amber-700 bg-amber-950/40 text-amber-200" : "",
                                    a.confidence === "Low" ? "border-rose-700 bg-rose-950/40 text-rose-200" : "",
                                    !a.confidence ? "border-slate-700 bg-slate-900/30 text-slate-300" : "",
                                  ].join(" ")}
                                >
                                  {confidenceBadge(a.confidence)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-400">
                                {formatTimestamp(a.timestamp)}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

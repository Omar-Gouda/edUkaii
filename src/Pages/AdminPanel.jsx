import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, BarChart3, Flag, ShieldCheck, Users2, Video } from "lucide-react";
import { PageHero, SiteLayout, StatCard } from "../Components/SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InsightChart({ title, items }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return (
    <div className="surface-card p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">{title}</p>
      <div className="mt-5 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-900">{item.label}</span>
                <span className="text-slate-500">{item.value}</span>
              </div>
              <div className="h-2 rounded-full bg-purple-100">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.max(10, (Number(item.value || 0) / maxValue) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-slate-600">No data available yet.</p>
        )}
      </div>
    </div>
  );
}

function StatusButton({ active, label, onClick, tone = "default", disabled = false }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
      : tone === "danger"
        ? "border-red-200 text-red-600 hover:bg-red-50"
        : "border-purple-200 text-primary hover:bg-purple-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${toneClass} ${
        active ? "bg-purple-50" : "bg-white"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {label}
    </button>
  );
}

export default function AdminPanel() {
  const { user, loading, isAuthenticated } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportCounts, setReportCounts] = useState({
    open: 0,
    reviewing: 0,
    resolved: 0,
    dismissed: 0,
  });
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updatingReportId, setUpdatingReportId] = useState("");

  const canOpenAdminPanel = user?.role === "admin" || user?.role === "moderator";
  const canManageUsers =
    user?.role === "admin" || (user?.role === "moderator" && user?.moderatorPermissions?.manageUsers);

  const loadPanel = useCallback(async () => {
    if (!isAuthenticated || !canOpenAdminPanel) {
      return;
    }

    setLoadingData(true);
    setError("");

    try {
      const requests = [api.get("/dashboard/summary"), api.get("/admin/reports")];

      if (canManageUsers) {
        requests.push(api.get("/admin/users"));
      }

      const responses = await Promise.all(requests);
      const [summaryPayload, reportsPayload, usersPayload] = responses;

      setSummary(summaryPayload.summary);
      setReports(reportsPayload.reports || []);
      setReportCounts(
        reportsPayload.counts || {
          open: 0,
          reviewing: 0,
          resolved: 0,
          dismissed: 0,
        },
      );
      setUsers(usersPayload?.users || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingData(false);
    }
  }, [canManageUsers, canOpenAdminPanel, isAuthenticated]);

  useEffect(() => {
    loadPanel();
  }, [loadPanel]);

  const overviewCards = useMemo(() => {
    const overview = summary?.overview || {};

    return [
      { label: "Total users", value: String(overview.totalUsers || 0) },
      { label: "Active enrollments", value: String(overview.activeEnrollments || 0) },
      { label: "Community posts", value: String(overview.communityPosts || 0) },
      { label: "Active rooms", value: String(overview.activeMeetings || 0) },
      { label: "Direct chats", value: String(overview.directChats || 0) },
      { label: "Published courses", value: String(overview.publishedCourses || 0) },
      { label: "Open jobs", value: String(overview.openJobs || 0) },
      { label: "Open reports", value: String(overview.openReports || 0) },
    ];
  }, [summary?.overview]);

  const urgentAccounts = useMemo(
    () => users.filter((entry) => entry.pastDuePaymentCount > 0).slice(0, 6),
    [users],
  );

  if (!loading && !isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (!loading && isAuthenticated && !canOpenAdminPanel) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleReportStatus(reportId, status) {
    setUpdatingReportId(reportId);
    setError("");
    setMessage("");

    try {
      const payload = await api.patch(`/admin/reports/${reportId}`, { status });
      setReports((current) =>
        current.map((entry) => (entry.id === reportId ? payload.report : entry)),
      );
      setMessage(`Report moved to ${status}.`);
      await loadPanel();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setUpdatingReportId("");
    }
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Admin panel"
        title="Platform insight, moderation, and control from one place."
        description="Track reports, users, rooms, community activity, payments, and content health without leaving the operations workspace."
        actions={
          <>
            <Link to="/dashboard" className="primary-btn">
              Open Dashboard
            </Link>
            <Link to="/community" className="secondary-btn !border-primary !text-primary">
              Open Community
            </Link>
            <Link to="/" className="secondary-btn !border-primary !text-primary">
              Back to Home
            </Link>
          </>
        }
        aside={
          <div className="grid gap-4">
            <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
              <p className="text-sm font-semibold text-purple-700">Access level</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {user?.role === "admin" ? "Admin control" : "Moderator control"}
              </p>
            </div>
            <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-purple-700">Moderation queue</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{reportCounts.open + reportCounts.reviewing}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">Open and reviewing reports waiting for action.</p>
            </div>
          </div>
        }
      />

      <section className="bg-background px-6 py-12 md:px-12">
        <div className="mx-auto max-w-7xl">
          {error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              {message}
            </div>
          ) : null}

          {loadingData ? (
            <div className="surface-card p-10 text-center">
              <p className="text-lg font-semibold text-primary">Loading the admin panel...</p>
            </div>
          ) : (
            <>
              <div className="panel-grid">
                {(summary?.stats || []).map((stat) => (
                  <StatCard key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {overviewCards.map((item) => (
                  <StatCard key={item.label} label={item.label} value={item.value} />
                ))}
              </div>

              <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                <InsightChart title="Role distribution" items={summary?.charts?.roles || []} />
                <InsightChart title="Community activity" items={summary?.charts?.community || []} />
                <InsightChart title="Room activity" items={summary?.charts?.meetings || []} />
                <InsightChart title="Reports overview" items={summary?.charts?.reports || []} />
                <InsightChart title="Payments overview" items={summary?.charts?.payments || []} />
                <InsightChart title="Content health" items={summary?.charts?.content || []} />
                <InsightChart title="Course enrollments" items={summary?.charts?.enrollments || []} />
              </div>

              <div className="mt-10 grid gap-8 lg:grid-cols-[1.18fr_0.82fr]">
                <div className="surface-card p-8">
                  <div className="flex items-center gap-3 text-purple-700">
                    <Flag size={20} />
                    <h2 className="text-2xl font-bold text-primary">Report queue</h2>
                  </div>

                  <div className="mt-6 grid gap-4">
                    {reports.length ? (
                      reports.map((report) => (
                        <article key={report.id} className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-purple-700">
                                  {report.targetType.replaceAll("_", " ")}
                                </span>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                                  {report.status}
                                </span>
                              </div>
                              <p className="mt-3 font-semibold text-slate-900">
                                {report.reporter?.displayName || "Unknown reporter"} reported{" "}
                                {report.reportedUser?.displayName || "a user"}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-slate-600">{report.reason}</p>
                              {report.excerpt ? (
                                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                                  {report.excerpt}
                                </div>
                              ) : null}
                              <p className="mt-3 text-xs uppercase tracking-[0.08em] text-slate-500">
                                Created {formatDate(report.createdAt)}
                              </p>
                            </div>

                            <Link to={report.link} className="secondary-btn !border-primary !text-primary">
                              Open target
                              <ArrowUpRight size={15} />
                            </Link>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2">
                            <StatusButton
                              label="Open"
                              active={report.status === "open"}
                              onClick={() => handleReportStatus(report.id, "open")}
                              disabled={updatingReportId === report.id}
                            />
                            <StatusButton
                              label="Reviewing"
                              active={report.status === "reviewing"}
                              onClick={() => handleReportStatus(report.id, "reviewing")}
                              disabled={updatingReportId === report.id}
                            />
                            <StatusButton
                              label="Resolved"
                              active={report.status === "resolved"}
                              onClick={() => handleReportStatus(report.id, "resolved")}
                              tone="success"
                              disabled={updatingReportId === report.id}
                            />
                            <StatusButton
                              label="Dismissed"
                              active={report.status === "dismissed"}
                              onClick={() => handleReportStatus(report.id, "dismissed")}
                              tone="danger"
                              disabled={updatingReportId === report.id}
                            />
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-600">
                        No reports have been submitted yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-8">
                  <div className="surface-card p-8">
                    <div className="flex items-center gap-3 text-purple-700">
                      <BarChart3 size={20} />
                      <h2 className="text-2xl font-bold text-primary">Status snapshot</h2>
                    </div>
                    <div className="mt-6 grid gap-3">
                      <StatCard label="Open reports" value={String(reportCounts.open)} />
                      <StatCard label="Reviewing" value={String(reportCounts.reviewing)} />
                      <StatCard label="Resolved" value={String(reportCounts.resolved)} />
                      <StatCard label="Dismissed" value={String(reportCounts.dismissed)} />
                    </div>
                  </div>

                  <div className="surface-card p-8">
                    <div className="flex items-center gap-3 text-purple-700">
                      <Video size={20} />
                      <h2 className="text-2xl font-bold text-primary">Quick controls</h2>
                    </div>
                    <div className="mt-6 grid gap-3">
                      <Link to="/meeting-rooms" className="secondary-btn !justify-between !border-primary !text-primary">
                        Rooms and messages
                        <ArrowUpRight size={15} />
                      </Link>
                      <Link to="/courses" className="secondary-btn !justify-between !border-primary !text-primary">
                        Course management
                        <ArrowUpRight size={15} />
                      </Link>
                      <Link to="/community" className="secondary-btn !justify-between !border-primary !text-primary">
                        Community moderation
                        <ArrowUpRight size={15} />
                      </Link>
                      <Link to="/dashboard" className="secondary-btn !justify-between !border-primary !text-primary">
                        Staff dashboard
                        <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </div>

                  <div className="surface-card p-8">
                    <div className="flex items-center gap-3 text-purple-700">
                      <Users2 size={20} />
                      <h2 className="text-2xl font-bold text-primary">Risk watch</h2>
                    </div>
                    <div className="mt-6 grid gap-3">
                      {canManageUsers ? (
                        urgentAccounts.length ? (
                          urgentAccounts.map((account) => (
                            <div key={account.id} className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-4">
                              <p className="font-semibold text-slate-900">{account.displayName}</p>
                              <p className="mt-1 text-sm text-slate-600">{account.email}</p>
                              <p className="mt-2 text-sm text-red-600">
                                {account.pastDuePaymentCount} past due payment{account.pastDuePaymentCount === 1 ? "" : "s"}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-600">
                            No urgent student payment cases right now.
                          </div>
                        )
                      ) : (
                        <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4 text-sm leading-7 text-slate-600">
                          User management details are hidden for this moderator account.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-7 text-amber-900">
                    <div className="inline-flex items-center gap-2 font-semibold">
                      <AlertTriangle size={16} />
                      Deployment note
                    </div>
                    <p className="mt-3">
                      Production now supports a Supabase state bridge plus Supabase Storage for uploaded assets. Before launch, make sure the SQL migration has been run and `SUPABASE_SERVICE_ROLE_KEY` is set so database writes and file uploads do not fall back to local disk.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

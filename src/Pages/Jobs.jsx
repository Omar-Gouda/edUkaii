import { useContext, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, MapPin, Sparkles, TimerReset, UserPlus, Users2 } from "lucide-react";
import { PageHero, SectionHeader, SiteLayout, StatCard } from "../Components/SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function createJobDraft() {
  return {
    title: "",
    department: "Teaching",
    location: "Remote",
    type: "Part-Time",
    focusArea: "",
    openings: 1,
    description: "",
  };
}

export default function Jobs() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingJobId, setTogglingJobId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [jobDraft, setJobDraft] = useState(createJobDraft());

  const isAdmin = Boolean(isAuthenticated && user?.role === "admin");

  useEffect(() => {
    api.get("/jobs")
      .then((payload) => setJobs(payload.jobs || []))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const openJobs = useMemo(
    () => jobs.filter((job) => (job.status || "open") === "open"),
    [jobs],
  );

  const hiringStats = useMemo(() => {
    const visibleJobs = isAdmin ? jobs : openJobs;
    const teachingRoles = visibleJobs.filter((job) => job.department.toLowerCase().includes("teach") || job.department.toLowerCase().includes("education")).length;

    return {
      visibleRoles: visibleJobs.length,
      teachingRoles,
      openRoles: openJobs.length,
      closedRoles: jobs.filter((job) => (job.status || "open") === "closed").length,
    };
  }, [isAdmin, jobs, openJobs]);

  async function handleCreateJob(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = await api.post("/jobs", {
        ...jobDraft,
        openings: Number(jobDraft.openings || 1),
      });
      setJobs((current) => [payload.job, ...current]);
      setJobDraft(createJobDraft());
      setMessage("New hiring post created.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleJob(job) {
    const nextStatus = (job.status || "open") === "open" ? "closed" : "open";
    setTogglingJobId(job.id);
    setError("");
    setMessage("");

    try {
      const payload = await api.patch(`/jobs/${job.id}`, { status: nextStatus });
      setJobs((current) => current.map((entry) => (entry.id === job.id ? payload.job : entry)));
      setMessage(nextStatus === "closed" ? "Role closed." : "Role reopened.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setTogglingJobId("");
    }
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Open roles"
        title="Hiring that stays visible to learners, teachers, and the internal team."
        description="Students and applicants can browse active roles, while admins can publish new openings and close them as soon as the right teachers are hired."
        actions={isAdmin ? <a href="#job-admin" className="primary-btn">Manage Roles</a> : null}
        aside={
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-purple-50 p-5">
              <p className="text-sm font-semibold text-purple-700">Open roles</p>
              <p className="mt-2 text-3xl font-extrabold text-text">{hiringStats.openRoles}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-5">
              <p className="text-sm font-semibold text-purple-700">Teaching focus</p>
              <p className="mt-2 text-3xl font-extrabold text-text">{hiringStats.teachingRoles}</p>
            </div>
            {isAdmin ? (
              <div className="rounded-2xl bg-white p-5 shadow-sm sm:col-span-2">
                <p className="text-sm font-semibold text-purple-700">Closed roles</p>
                <p className="mt-2 text-3xl font-extrabold text-text">{hiringStats.closedRoles}</p>
              </div>
            ) : null}
          </div>
        }
      />

      <section className="px-6 py-6 md:px-12">
        <div className="mx-auto max-w-7xl panel-grid">
          <StatCard label="Visible roles" value={String(hiringStats.visibleRoles)} helper={isAdmin ? "Open and closed roles in your board" : "Currently open to applicants"} />
          <StatCard label="Teaching roles" value={String(hiringStats.teachingRoles)} helper="Mentors, coaches, and instructors" />
          <StatCard label="Open positions" value={String(openJobs.reduce((sum, job) => sum + Number(job.openings || 1), 0))} helper="Seats currently hiring" />
          <StatCard label="Hiring style" value="Admin-led" helper="Admins can open and close roles from this page" />
        </div>
      </section>

      <section className="px-6 pb-20 md:px-12">
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

          {isAdmin ? (
            <div id="job-admin" className="mb-10 grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Admin publishing"
                  title="Create a hiring post"
                  description="Open new teacher or crew roles with a clear focus area, candidate expectations, and the number of openings you need."
                />

                <form onSubmit={handleCreateJob} className="grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-text">
                    Role title
                    <input
                      value={jobDraft.title}
                      onChange={(event) => setJobDraft((current) => ({ ...current, title: event.target.value }))}
                      required
                      className="px-4 py-3"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-text">
                      Department
                      <input
                        value={jobDraft.department}
                        onChange={(event) => setJobDraft((current) => ({ ...current, department: event.target.value }))}
                        required
                        className="px-4 py-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-text">
                      Employment type
                      <input
                        value={jobDraft.type}
                        onChange={(event) => setJobDraft((current) => ({ ...current, type: event.target.value }))}
                        required
                        className="px-4 py-3"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_0.55fr]">
                    <label className="grid gap-2 text-sm font-semibold text-text">
                      Location
                      <input
                        value={jobDraft.location}
                        onChange={(event) => setJobDraft((current) => ({ ...current, location: event.target.value }))}
                        required
                        className="px-4 py-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-text">
                      Openings
                      <input
                        type="number"
                        min="1"
                        value={jobDraft.openings}
                        onChange={(event) => setJobDraft((current) => ({ ...current, openings: event.target.value }))}
                        required
                        className="px-4 py-3"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2 text-sm font-semibold text-text">
                    Focus area
                    <input
                      value={jobDraft.focusArea}
                      onChange={(event) => setJobDraft((current) => ({ ...current, focusArea: event.target.value }))}
                      placeholder="Frontend portfolio reviews, English fluency circles, HR coaching..."
                      className="px-4 py-3"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-text">
                    Description
                    <textarea
                      rows={5}
                      value={jobDraft.description}
                      onChange={(event) => setJobDraft((current) => ({ ...current, description: event.target.value }))}
                      required
                      className="px-4 py-3"
                    />
                  </label>

                  <button type="submit" disabled={saving} className="primary-btn w-fit disabled:cursor-not-allowed disabled:opacity-70">
                    <UserPlus size={16} />
                    {saving ? "Publishing..." : "Publish Role"}
                  </button>
                </form>
              </div>

              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Hiring workflow"
                  title="Keep the recruitment board current"
                  description="Close a role the moment the needed teachers are hired, or reopen it if demand returns."
                />

                <div className="grid gap-4">
                  {jobs.length ? (
                    jobs.map((job) => (
                      <div key={job.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-bold text-primary">{job.title}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {job.department} • {job.location}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                            (job.status || "open") === "open"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {job.status || "open"}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-sm">
                          <span className="pill">{job.type}</span>
                          <span className="pill">{job.openings || 1} opening{Number(job.openings || 1) === 1 ? "" : "s"}</span>
                          {job.focusArea ? <span className="pill">{job.focusArea}</span> : null}
                        </div>

                        <p className="mt-4 text-sm leading-7 text-slate-600">{job.description}</p>
                        <p className="mt-4 text-xs uppercase tracking-[0.08em] text-slate-500">
                          Posted {formatDate(job.postedAt)}{job.closedAt ? ` • Closed ${formatDate(job.closedAt)}` : ""}
                        </p>

                        <button
                          type="button"
                          onClick={() => handleToggleJob(job)}
                          disabled={togglingJobId === job.id}
                          className="secondary-btn mt-4 !border-primary !text-primary disabled:opacity-70"
                        >
                          {togglingJobId === job.id
                            ? "Saving..."
                            : (job.status || "open") === "open"
                              ? "Close Role"
                              : "Reopen Role"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                      No job posts yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <SectionHeader
            eyebrow="Browse openings"
            title={isAdmin ? "Live board preview" : "Current opportunities across the academy"}
            description={isAdmin ? "This is the same hiring experience applicants see, filtered to the roles that are still open." : "Explore the roles we are currently hiring for and find where you can contribute to the platform."}
          />

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-64 animate-pulse rounded-3xl bg-white shadow-lg" />
              ))
            ) : openJobs.length ? (
              openJobs.map((job) => (
                <article key={job.id} className="surface-card flex h-full flex-col p-8">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-purple-700">
                      <BriefcaseBusiness size={18} />
                      <span className="text-sm font-semibold uppercase tracking-[0.12em]">{job.department}</span>
                    </div>
                    <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-purple-700">
                      {job.openings || 1} opening{Number(job.openings || 1) === 1 ? "" : "s"}
                    </span>
                  </div>

                  <h2 className="mt-5 text-2xl font-bold text-primary">{job.title}</h2>

                  <div className="mt-4 grid gap-2 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-2">
                      <MapPin size={15} className="text-purple-700" />
                      {job.location}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <TimerReset size={15} className="text-purple-700" />
                      {job.type}
                    </span>
                    {job.focusArea ? (
                      <span className="inline-flex items-center gap-2">
                        <Sparkles size={15} className="text-purple-700" />
                        {job.focusArea}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-5 flex-1 leading-relaxed text-gray-700">{job.description}</p>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Posted {formatDate(job.postedAt)}</p>
                    <button type="button" className="primary-btn">
                      <Users2 size={16} />
                      Apply Now
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="surface-card p-8 text-center md:col-span-2 xl:col-span-3">
                <h2 className="text-2xl font-bold text-primary">No open roles right now</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  The hiring board is currently quiet. Check back soon for new teaching and operations openings.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

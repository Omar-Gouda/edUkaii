import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, CreditCard, Crown, Flag, GraduationCap, Settings2, ShieldCheck, Trash2, Trophy, Users2 } from "lucide-react";
import { PageHero, SiteLayout, StatCard } from "../Components/SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";
import { EDUKAI_EMAIL_DOMAIN, buildEdUkaiEmail, stripEdUkaiDomain } from "../lib/emailDomain";

const roleLabels = {
  admin: "Admin",
  moderator: "Moderator",
  teacher: "Teacher",
  student: "Student",
};

const roleOrder = {
  admin: 0,
  moderator: 1,
  teacher: 2,
  student: 3,
};

function createUserDraft(nextRole = "teacher") {
  return {
    firstName: "",
    lastName: "",
    emailLocalPart: "",
    password: "",
    role: nextRole,
    bio: "",
  };
}

function formatPrice(amountCents, currency = "EGP") {
  return `${(Number(amountCents || 0) / 100).toLocaleString()} ${currency}`;
}

function formatDueDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InsightChart({ title, items }) {
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return (
    <div className="rounded-3xl bg-white p-6 shadow-lg">
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
          <p className="text-sm leading-7 text-slate-600">No chart data yet.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, loading, isAuthenticated } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState("");
  const [updatingPermissionId, setUpdatingPermissionId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [userDraft, setUserDraft] = useState(createUserDraft());

  const canManageUsers =
    user?.role === "admin" || (user?.role === "moderator" && user?.moderatorPermissions?.manageUsers);
  const canCreateUsers = user?.role === "admin";
  const canManageCourses = ["admin", "moderator", "teacher"].includes(user?.role || "");
  const canOpenAdminPanel = ["admin", "moderator"].includes(user?.role || "");

  useEffect(() => {
    if (user?.role === "moderator") {
      setUserDraft(createUserDraft("teacher"));
      return;
    }

    setUserDraft(createUserDraft());
  }, [user?.role]);

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setLoadingData(true);
    setError("");

    try {
      const requests = [
        api.get("/dashboard/summary"),
        api.get("/teachers"),
        api.get("/students/leaderboard"),
      ];

      if (canManageCourses) {
        requests.push(api.get("/courses?includeDrafts=true"));
      }

      if (canManageUsers) {
        requests.push(api.get("/admin/users"));
      }

      const responses = await Promise.all(requests);
      const [summaryPayload, teachersPayload, studentsPayload, coursesPayload, usersPayload] = responses;

      setSummary(summaryPayload.summary);
      setTeachers((teachersPayload.teachers || []).slice(0, 3));
      setStudents(studentsPayload.students || []);
      setCourses(coursesPayload?.courses || []);
      setUsers(usersPayload?.users || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingData(false);
    }
  }, [canManageCourses, canManageUsers, isAuthenticated]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const pendingApprovals = useMemo(
    () => courses.filter((course) => (course.pendingEdits || []).length > 0),
    [courses],
  );

  const assignedCourses = useMemo(
    () => courses.filter((course) => course.teacher?.id === user?.id),
    [courses, user?.id],
  );

  const manageableUsers = useMemo(
    () =>
      [...users].sort((left, right) => {
        if (right.pastDuePaymentCount !== left.pastDuePaymentCount) {
          return right.pastDuePaymentCount - left.pastDuePaymentCount;
        }

        return (roleOrder[left.role] ?? 99) - (roleOrder[right.role] ?? 99);
      }),
    [users],
  );

  const overdueAccounts = useMemo(
    () => manageableUsers.filter((account) => account.pastDuePaymentCount > 0),
    [manageableUsers],
  );

  if (!loading && !isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setCreatingUser(true);
    setError("");
    setMessage("");

    try {
      const payload = await api.post("/admin/users", {
        ...userDraft,
        email: buildEdUkaiEmail(userDraft.emailLocalPart),
      });
      setUsers((current) => [payload.user, ...current]);
      setUserDraft(createUserDraft("teacher"));
      setMessage("New account created successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleRoleUpdate(targetUserId) {
    const currentAccount = users.find((entry) => entry.id === targetUserId);
    const nextRole = roleDrafts[targetUserId] || currentAccount?.role;

    if (!nextRole || !currentAccount?.canChangeRole) {
      return;
    }

    setUpdatingRoleId(targetUserId);
    setError("");
    setMessage("");

    try {
      const payload = await api.patch(`/admin/users/${targetUserId}/role`, {
        role: nextRole,
      });

      setUsers((current) =>
        current.map((entry) => (entry.id === targetUserId ? payload.user : entry)),
      );
      setMessage("User role updated successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setUpdatingRoleId("");
    }
  }

  async function handleDeleteUser(targetUserId) {
    const currentAccount = users.find((entry) => entry.id === targetUserId);

    if (!currentAccount?.canDelete) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete ${currentAccount.displayName}'s account? This removes their enrollments, payments, notifications, and related records.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingUserId(targetUserId);
    setError("");
    setMessage("");

    try {
      await api.delete(`/admin/users/${targetUserId}`);
      setUsers((current) => current.filter((entry) => entry.id !== targetUserId));
      setMessage("Account deleted successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setDeletingUserId("");
    }
  }

  async function handlePermissionUpdate(targetUserId, nextPermissions) {
    const currentAccount = users.find((entry) => entry.id === targetUserId);

    if (user?.role !== "admin" || currentAccount?.role !== "moderator") {
      return;
    }

    setUpdatingPermissionId(targetUserId);
    setError("");
    setMessage("");

    try {
      const payload = await api.patch(`/admin/users/${targetUserId}/permissions`, nextPermissions);
      setUsers((current) =>
        current.map((entry) => (entry.id === targetUserId ? payload.user : entry)),
      );
      setMessage("Moderator permissions updated successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setUpdatingPermissionId("");
    }
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow={`${roleLabels[user?.role] || "User"} dashboard`}
        title={summary?.title || "Dashboard"}
        description={summary?.summary || "Loading your role view..."}
        actions={
          <>
            <Link to="/" className="primary-btn">
              Back to Home
            </Link>
            <Link to="/courses" className="secondary-btn !border-primary !text-primary">
              Open Courses
            </Link>
            {canOpenAdminPanel ? (
              <Link to="/admin-panel" className="secondary-btn !border-primary !text-primary">
                Open Admin Panel
              </Link>
            ) : null}
          </>
        }
        aside={
          <div className="grid gap-3">
            <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
              <p className="text-sm font-semibold text-purple-700">Your role</p>
              <p className="mt-2 text-2xl font-extrabold text-text">{roleLabels[user?.role] || "User"}</p>
            </div>
            {canManageUsers ? (
              <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                <p className="text-sm font-semibold text-purple-700">Payment alerts</p>
                <p className="mt-2 text-2xl font-extrabold text-text">{overdueAccounts.length}</p>
                <p className="mt-2 text-sm text-slate-600">Students currently flagged for past due payments.</p>
              </div>
            ) : null}
            <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-purple-700">Quick access</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/teachers" className="rounded-xl bg-purple-50 px-3 py-2 text-sm font-semibold text-primary">
                  Instructors
                </Link>
                <Link to="/jobs" className="rounded-xl bg-purple-50 px-3 py-2 text-sm font-semibold text-primary">
                  Careers
                </Link>
                <Link to="/meeting-rooms" className="rounded-xl bg-purple-50 px-3 py-2 text-sm font-semibold text-primary">
                  Rooms
                </Link>
                {canOpenAdminPanel ? (
                  <Link to="/admin-panel" className="rounded-xl bg-purple-50 px-3 py-2 text-sm font-semibold text-primary">
                    Admin Panel
                  </Link>
                ) : null}
              </div>
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
            <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
              <p className="text-lg font-semibold text-primary">Loading your dashboard...</p>
            </div>
          ) : (
            <>
              <div className="panel-grid">
                {(summary?.stats || []).map((stat) => (
                  <StatCard key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </div>

              {canOpenAdminPanel ? (
                <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  <InsightChart title="Role distribution" items={summary?.charts?.roles || []} />
                  <InsightChart title="Community activity" items={summary?.charts?.community || []} />
                  <InsightChart title="Room activity" items={summary?.charts?.meetings || []} />
                  <InsightChart title="Reports overview" items={summary?.charts?.reports || []} />
                  <InsightChart title="Payments overview" items={summary?.charts?.payments || []} />
                  <InsightChart title="Content health" items={summary?.charts?.content || []} />
                </div>
              ) : null}

              <div className="mt-10 grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="rounded-3xl bg-white p-8 shadow-lg">
                  <div className="flex items-center gap-3 text-purple-700">
                    <Crown size={20} />
                    <h2 className="text-2xl font-bold text-primary">Top instructors</h2>
                  </div>
                  <div className="mt-6 grid gap-4">
                    {teachers.length ? teachers.map((teacher, index) => (
                      <div key={teacher.id} className="flex items-center justify-between gap-4 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">#{index + 1} instructor</p>
                          <p className="mt-2 text-xl font-bold text-primary">{teacher.displayName}</p>
                          <p className="mt-1 text-sm text-gray-700">{teacher.teacherProfile?.title}</p>
                        </div>
                        <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-purple-700">
                          {teacher.teacherProfile?.score} score
                        </span>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5 text-sm leading-7 text-slate-600">
                        No teacher accounts have been created yet. Use the staff form below to start building the teaching team.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-8 shadow-lg">
                  <div className="flex items-center gap-3 text-purple-700">
                    <Trophy size={20} />
                    <h2 className="text-2xl font-bold text-primary">Student leaderboard</h2>
                  </div>
                  <div className="mt-6 grid gap-3">
                    {students.length ? students.map((student, index) => (
                      <div key={student.userId} className="flex items-center justify-between gap-4 rounded-2xl border border-purple-100 bg-white px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 font-bold text-primary">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-text">{student.name}</p>
                            <p className="text-sm text-gray-600">Teacher feedback average</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
                          {student.score}%
                        </span>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5 text-sm leading-7 text-slate-600">
                        Student rankings will appear here once enrollments and teacher feedback start moving through the platform.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-3xl bg-white p-8 shadow-lg">
                <div className="flex items-center gap-3 text-purple-700">
                  <ShieldCheck size={20} />
                  <h2 className="text-2xl font-bold text-primary">Priority queue</h2>
                </div>
                <div className="mt-5 grid gap-3">
                  {(summary?.priorities || []).map((priority) => (
                    <div key={priority} className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-4 text-sm leading-relaxed text-gray-700">
                      {priority}
                    </div>
                  ))}
                </div>
              </div>

              {canManageUsers ? (
                <div className="mt-10 rounded-3xl bg-white p-8 shadow-lg">
                  <div className="flex items-center gap-3 text-purple-700">
                    <AlertTriangle size={20} />
                    <h2 className="text-2xl font-bold text-primary">Past due student payments</h2>
                  </div>
                  <div className="mt-6 grid gap-4">
                    {overdueAccounts.length ? overdueAccounts.map((account) => (
                      <div key={account.id} className="rounded-2xl border border-red-200 bg-red-50/70 px-5 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-bold text-text">{account.displayName}</p>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600">
                                {roleLabels[account.role] || "User"}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{account.email}</p>
                            <div className="mt-4 grid gap-3">
                              {account.pastDueItems.map((item) => (
                                <div key={`${account.id}-${item.paymentId}-${item.stage}`} className="rounded-2xl border border-red-100 bg-white px-4 py-4">
                                  <p className="font-semibold text-text">{item.courseTitle}</p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {item.stage === "deposit" ? "Deposit overdue" : "Remaining balance overdue"} for {formatPrice(item.amountCents, item.currency)}
                                  </p>
                                  <p className="mt-1 text-sm text-red-600">Due on {formatDueDate(item.dueAt)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          {account.canDelete ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(account.id)}
                              disabled={deletingUserId === account.id}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-70"
                            >
                              <Trash2 size={16} />
                              {deletingUserId === account.id ? "Removing..." : "Delete Account"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5 text-sm leading-7 text-slate-600">
                        No student accounts are currently marked past due.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {user?.role === "teacher" ? (
                <div className="mt-10 rounded-3xl bg-white p-8 shadow-lg">
                  <div className="flex items-center gap-3 text-purple-700">
                    <GraduationCap size={20} />
                    <h2 className="text-2xl font-bold text-primary">Assigned courses</h2>
                  </div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    {assignedCourses.map((course) => (
                      <div key={course.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                        <p className="text-xl font-bold text-primary">{course.title}</p>
                        <p className="mt-2 text-sm text-gray-700">{course.duration} - {course.slots.length} class options</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link to={`/courses/${course.slug}`} className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">
                            Manage Course
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {user?.role === "admin" && pendingApprovals.length ? (
                <div className="mt-10 rounded-3xl bg-white p-8 shadow-lg">
                  <div className="flex items-center gap-3 text-purple-700">
                    <ShieldCheck size={20} />
                    <h2 className="text-2xl font-bold text-primary">Pending course approvals</h2>
                  </div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    {pendingApprovals.map((course) => (
                      <div key={course.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                        <p className="text-xl font-bold text-primary">{course.title}</p>
                        <p className="mt-2 text-sm text-gray-700">
                          {course.pendingEdits.length} moderator update{course.pendingEdits.length > 1 ? "s" : ""} waiting for review
                        </p>
                        <Link to={`/courses/${course.slug}`} className="mt-4 inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">
                          Review Course
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {canManageUsers ? (
                <div className={`mt-10 grid gap-8 ${canCreateUsers ? "lg:grid-cols-[0.95fr_1.05fr]" : ""}`}>
                  {canCreateUsers ? (
                    <div className="rounded-3xl bg-white p-8 shadow-lg">
                      <div className="flex items-center gap-3 text-purple-700">
                        <Users2 size={20} />
                        <h2 className="text-2xl font-bold text-primary">Create staff account</h2>
                      </div>

                      <form onSubmit={handleCreateUser} className="mt-6 grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="grid gap-2 text-sm font-semibold text-text">
                            First name
                            <input
                              value={userDraft.firstName}
                              onChange={(event) => setUserDraft((current) => ({ ...current, firstName: event.target.value }))}
                              required
                              className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-semibold text-text">
                            Last name
                            <input
                              value={userDraft.lastName}
                              onChange={(event) => setUserDraft((current) => ({ ...current, lastName: event.target.value }))}
                              required
                              className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                            />
                          </label>
                        </div>
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Email
                          <div className="field-shell">
                            <input
                              type="text"
                              value={stripEdUkaiDomain(userDraft.emailLocalPart)}
                              onChange={(event) => setUserDraft((current) => ({ ...current, emailLocalPart: event.target.value }))}
                              required
                              className="min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm text-text shadow-none focus:border-0 focus:shadow-none"
                            />
                            <span className="whitespace-nowrap rounded-full bg-purple-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
                              @{EDUKAI_EMAIL_DOMAIN}
                            </span>
                          </div>
                        </label>
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Temporary password
                          <input
                            type="password"
                            value={userDraft.password}
                            onChange={(event) => setUserDraft((current) => ({ ...current, password: event.target.value }))}
                            required
                            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Role
                          <select
                            value={userDraft.role}
                            onChange={(event) => setUserDraft((current) => ({ ...current, role: event.target.value }))}
                            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                          >
                            <option value="admin">Admin</option>
                            <option value="teacher">Teacher</option>
                            <option value="moderator">Moderator</option>
                            <option value="student">Student</option>
                          </select>
                        </label>
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Short bio
                          <textarea
                            rows={4}
                            value={userDraft.bio}
                            onChange={(event) => setUserDraft((current) => ({ ...current, bio: event.target.value }))}
                            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                          />
                        </label>
                        <button type="submit" disabled={creatingUser} className="primary-btn w-fit disabled:cursor-not-allowed disabled:opacity-70">
                          {creatingUser ? "Creating..." : "Create Account"}
                        </button>
                      </form>
                    </div>
                  ) : null}

                  <div className="rounded-3xl bg-white p-8 shadow-lg">
                    <div className="flex items-center gap-3 text-purple-700">
                      <ShieldCheck size={20} />
                      <h2 className="text-2xl font-bold text-primary">User roles</h2>
                    </div>

                    <div className="mt-6 grid gap-4">
                      {manageableUsers.map((account) => (
                        <div key={account.id} className="grid gap-4 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5 lg:grid-cols-[1.2fr_0.7fr_auto] lg:items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="max-w-full [overflow-wrap:anywhere] font-bold text-primary">{account.displayName}</p>
                              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-purple-700">
                                {roleLabels[account.role] || "User"}
                              </span>
                              {account.isOriginalAdmin ? (
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                                  Original admin
                                </span>
                              ) : null}
                              {account.isProtected && !account.isOriginalAdmin ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                                  Protected
                                </span>
                              ) : null}
                              {account.accountStatus === "past_due" ? (
                                <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-600">
                                  Past due
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-gray-700">{account.email}</p>
                            <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                              {account.activeEnrollments} active enrollment{account.activeEnrollments === 1 ? "" : "s"}
                            </p>
                            {account.role === "moderator" ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                                  <Settings2 size={12} />
                                  {account.moderatorPermissions?.manageUsers ? "Can manage users" : "User access off"}
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                                  <ShieldCheck size={12} />
                                  {account.moderatorPermissions?.manageCourses ? "Can publish courses" : "Publishing off"}
                                </span>
                              </div>
                            ) : null}
                            {account.pastDueItems?.length ? (
                              <div className="mt-3 grid gap-2">
                                {account.pastDueItems.map((item) => (
                                  <p key={`${account.id}-${item.paymentId}-${item.stage}`} className="text-xs leading-5 text-red-600">
                                    {item.courseTitle}: {item.stageLabel || "payment"} overdue since {formatDueDate(item.dueAt)}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          {account.canChangeRole ? (
                            <select
                              value={roleDrafts[account.id] || account.role}
                              onChange={(event) =>
                                setRoleDrafts((current) => ({ ...current, [account.id]: event.target.value }))
                              }
                              className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm font-semibold text-text outline-none transition focus:border-primary"
                            >
                              {user?.role === "admin" ? <option value="admin">Admin</option> : null}
                              <option value="student">Student</option>
                              <option value="teacher">Teacher</option>
                              <option value="moderator" disabled={user?.role !== "admin"}>
                                Moderator
                              </option>
                            </select>
                          ) : (
                            <div className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                              Protected account
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-3">
                            {account.canChangeRole ? (
                              <button
                                type="button"
                                onClick={() => handleRoleUpdate(account.id)}
                                disabled={updatingRoleId === account.id}
                                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {updatingRoleId === account.id ? "Saving..." : "Update"}
                              </button>
                            ) : null}
                            {user?.role === "admin" && account.role === "moderator" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePermissionUpdate(account.id, {
                                      manageUsers: !account.moderatorPermissions?.manageUsers,
                                      manageCourses: Boolean(account.moderatorPermissions?.manageCourses),
                                    })
                                  }
                                  disabled={updatingPermissionId === account.id}
                                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-purple-50 disabled:opacity-70"
                                >
                                  <Settings2 size={16} />
                                  {updatingPermissionId === account.id
                                    ? "Saving..."
                                    : account.moderatorPermissions?.manageUsers
                                      ? "Disable User Access"
                                      : "Allow User Access"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePermissionUpdate(account.id, {
                                      manageUsers: Boolean(account.moderatorPermissions?.manageUsers),
                                      manageCourses: !account.moderatorPermissions?.manageCourses,
                                    })
                                  }
                                  disabled={updatingPermissionId === account.id}
                                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-purple-50 disabled:opacity-70"
                                >
                                  <ShieldCheck size={16} />
                                  {updatingPermissionId === account.id
                                    ? "Saving..."
                                    : account.moderatorPermissions?.manageCourses
                                      ? "Disable Course Publishing"
                                      : "Allow Course Publishing"}
                                </button>
                              </>
                            ) : null}
                            {account.canDelete ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(account.id)}
                                disabled={deletingUserId === account.id}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-70"
                              >
                                <Trash2 size={16} />
                                {deletingUserId === account.id ? "Removing..." : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

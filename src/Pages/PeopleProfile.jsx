import { useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  CreditCard,
  Flag,
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users2,
} from "lucide-react";
import ReportDialog from "../Components/ReportDialog";
import { PageHero, SectionHeader, SiteLayout } from "../Components/SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";

const roleLabels = {
  admin: "Admin",
  moderator: "Moderator",
  teacher: "Teacher",
  student: "Student",
};

const peerToneOptions = [
  { value: "supportive", label: "Supportive" },
  { value: "thoughtful", label: "Thoughtful" },
  { value: "celebratory", label: "Celebratory" },
];

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

function formatPrice(amountCents, currency = "EGP") {
  return `${(Number(amountCents || 0) / 100).toLocaleString()} ${currency}`;
}

function buildCourseOptions(courses, currentUser) {
  if (!currentUser) {
    return [];
  }

  if (currentUser.role === "student") {
    return courses.filter((course) => course.isEnrolled);
  }

  if (currentUser.role === "teacher") {
    return courses.filter((course) => course.canManage);
  }

  return courses.filter((course) => course.canManage || course.published !== false);
}

function ActionPillButton({ icon: Icon, label, onClick, tone = "default" }) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50"
      : tone === "primary"
        ? "text-purple-700 hover:bg-purple-50"
        : "text-slate-600 hover:bg-slate-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${toneClass}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function FeedbackCard({ eyebrow, title, body, meta, score, onDelete, onReport }) {
  return (
    <article className="surface-subtle p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-purple-700">{eyebrow}</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {score != null ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary">{score}</span>
          ) : null}
          {onReport ? <ActionPillButton icon={Flag} label="Report" onClick={onReport} tone="primary" /> : null}
          {onDelete ? <ActionPillButton icon={Trash2} label="Delete" onClick={onDelete} tone="danger" /> : null}
        </div>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">{body}</p>
      {meta ? <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{meta}</p> : null}
    </article>
  );
}

function PaymentCard({ entry }) {
  return (
    <article className="surface-subtle p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-purple-700">{entry.courseTitle}</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">
            {entry.paymentStage === "remaining"
              ? "Remaining balance"
              : entry.paymentStage === "full"
                ? "Full payment"
                : "Deposit"}
          </h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary">
          {entry.status}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {formatPrice(entry.amountCents, entry.currency)} - {entry.paymentPlan === "full" ? "Full payment" : "Installment"}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Remaining: {formatPrice(entry.remainingCents || 0, entry.currency)}
      </p>
      {(entry.checkoutDueAt || entry.remainingDueAt) ? (
        <p className={`mt-3 text-xs font-medium uppercase tracking-[0.08em] ${entry.isPastDue ? "text-red-600" : "text-slate-500"}`}>
          Due {formatDate(entry.checkoutDueAt || entry.remainingDueAt)}
        </p>
      ) : null}
      <div className="mt-4">
        <Link to={`/payments?paymentId=${entry.paymentId}`} className="secondary-btn !border-primary !text-primary">
          Open Payment
        </Link>
      </div>
    </article>
  );
}

export default function PeopleProfile() {
  const { user, loading, isAuthenticated } = useContext(AuthContext);
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const [profileData, setProfileData] = useState(null);
  const [courseOptions, setCourseOptions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [peerFeedbackValues, setPeerFeedbackValues] = useState({
    courseId: "",
    score: 5,
    tone: "supportive",
    body: "",
  });
  const [teacherFeedbackValues, setTeacherFeedbackValues] = useState({
    courseId: "",
    score: 85,
    body: "",
  });
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingPeerFeedback, setSubmittingPeerFeedback] = useState(false);
  const [submittingTeacherFeedback, setSubmittingTeacherFeedback] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!isAuthenticated || !userId) {
        return;
      }

      setLoadingData(true);
      setError("");

      try {
        const coursePath =
          ["admin", "moderator", "teacher"].includes(user?.role || "")
            ? "/courses?includeDrafts=true"
            : "/courses";
        const [profilePayload, coursesPayload] = await Promise.all([
          api.get(`/people/${userId}`),
          api.get(coursePath),
        ]);

        setProfileData(profilePayload);
        setCourseOptions(buildCourseOptions(coursesPayload.courses || [], user));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingData(false);
      }
    }

    loadProfile();
  }, [isAuthenticated, user, userId]);

  useEffect(() => {
    if (!courseOptions.length) {
      return;
    }

    setPeerFeedbackValues((current) => ({
      ...current,
      courseId: current.courseId || courseOptions[0].id,
    }));
    setTeacherFeedbackValues((current) => ({
      ...current,
      courseId: current.courseId || courseOptions[0].id,
    }));
  }, [courseOptions]);

  const achievements = useMemo(
    () => profileData?.user?.achievements || [],
    [profileData?.user?.achievements],
  );
  const isPreviewMode = searchParams.get("preview") === "public" && user?.id === userId;
  const visibleBadges = useMemo(
    () =>
      (profileData?.user?.badges || []).filter(
        (badge) => !profileData?.user?.privateBadges || badge.public,
      ),
    [profileData?.user?.badges, profileData?.user?.privateBadges],
  );

  if (!loading && !isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  function openReportDialog(nextTarget) {
    setReportTarget(nextTarget);
    setReportReason("");
    setReportError("");
  }

  function closeReportDialog() {
    setReportTarget(null);
    setReportReason("");
    setReportError("");
    setReporting(false);
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();

    if (!commentDraft.trim()) {
      return;
    }

    setSubmittingComment(true);
    setError("");
    setMessage("");

    try {
      const payload = await api.post(`/people/${userId}/comments`, { body: commentDraft.trim() });
      setProfileData(payload);
      setCommentDraft("");
      setMessage("Profile comment shared.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handlePeerFeedbackSubmit(event) {
    event.preventDefault();

    setSubmittingPeerFeedback(true);
    setError("");
    setMessage("");

    try {
      const payload = await api.post(`/people/${userId}/feedback`, peerFeedbackValues);
      setProfileData(payload);
      setPeerFeedbackValues((current) => ({ ...current, body: "", score: 5, tone: "supportive" }));
      setMessage("Classmate feedback shared.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmittingPeerFeedback(false);
    }
  }

  async function handleTeacherFeedbackSubmit(event) {
    event.preventDefault();

    setSubmittingTeacherFeedback(true);
    setError("");
    setMessage("");

    try {
      const payload = await api.post(`/people/${userId}/feedback`, teacherFeedbackValues);
      setProfileData(payload);
      setTeacherFeedbackValues((current) => ({ ...current, body: "", score: 85 }));
      setMessage("Teacher feedback shared.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmittingTeacherFeedback(false);
    }
  }

  async function handleDeleteComment(commentId) {
    const shouldDelete = window.confirm("Delete this profile comment?");
    if (!shouldDelete) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const payload = await api.delete(`/people/${userId}/comments/${commentId}`);
      setProfileData(payload);
      setMessage("Profile comment removed.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function handleReportComment(commentId) {
    openReportDialog({
      type: "comment",
      targetId: commentId,
      title: "Report profile comment",
      description: "This sends the comment to admins and moderators for review.",
    });
  }

  async function handleDeleteFeedback(feedbackId) {
    const shouldDelete = window.confirm("Delete this feedback entry?");
    if (!shouldDelete) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const payload = await api.delete(`/people/${userId}/feedback/${feedbackId}`);
      setProfileData(payload);
      setMessage("Feedback removed.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function handleReportFeedback(feedbackId) {
    openReportDialog({
      type: "feedback",
      targetId: feedbackId,
      title: "Report profile feedback",
      description: "This sends the feedback entry to admins and moderators for review.",
    });
  }

  async function handleReportSubmit(event) {
    event.preventDefault();

    if (!reportTarget || !reportReason.trim()) {
      return;
    }

    setReporting(true);
    setReportError("");
    setError("");
    setMessage("");

    try {
      if (reportTarget.type === "comment") {
        await api.post(`/people/${userId}/comments/${reportTarget.targetId}/report`, {
          reason: reportReason.trim(),
        });
        setMessage("Comment reported.");
      } else {
        await api.post(`/people/${userId}/feedback/${reportTarget.targetId}/report`, {
          reason: reportReason.trim(),
        });
        setMessage("Feedback reported.");
      }

      closeReportDialog();
    } catch (submitError) {
      setReportError(submitError.message);
      setReporting(false);
    }
  }

  return (
    <SiteLayout>
      {loadingData ? (
        <section className="bg-background px-6 py-20 md:px-12">
          <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-primary">Loading profile...</p>
          </div>
        </section>
      ) : profileData ? (
        <>
          <PageHero
            eyebrow={isPreviewMode ? "Public profile preview" : `${roleLabels[profileData.user.role] || "Member"} profile`}
            title={profileData.user.displayName}
            description={
              profileData.user.bio ||
              "This profile keeps classmate notes, teacher feedback, and payment progress in one place."
            }
            actions={
              <>
                {isPreviewMode ? (
                  <>
                    <Link to="/profile-settings" className="primary-btn">
                      Back to Settings
                    </Link>
                    <Link to={`/people/${userId}`} className="secondary-btn !border-primary !text-primary">
                      Open Full Profile
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/" className="primary-btn">
                      Back to Home
                    </Link>
                    <Link to="/community" className="secondary-btn !border-primary !text-primary">
                      Open Community
                    </Link>
                    {user?.id === userId ? (
                      <Link to={`/people/${userId}?preview=public`} className="secondary-btn !border-primary !text-primary">
                        Preview as Others See It
                      </Link>
                    ) : null}
                  </>
                )}
              </>
            }
            aside={
              <div className="grid gap-4">
                <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
                  <p className="text-sm font-semibold text-purple-700">Role</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {roleLabels[profileData.user.role] || "Member"}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-purple-700">Profile activity</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {profileData.comments.length} comments, {profileData.peerFeedback.length} classmate notes, and{" "}
                    {profileData.teacherFeedback.length} teacher updates.
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-purple-700">Focus track</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {profileData.user.focusTrack || "General growth"}
                  </p>
                </div>
                {profileData.paymentHistory?.length && !isPreviewMode ? (
                  <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                    <div className="flex items-center gap-2 text-purple-700">
                      <CreditCard size={16} />
                      <p className="text-sm font-semibold">Payments</p>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {profileData.paymentHistory.length} payment record{profileData.paymentHistory.length === 1 ? "" : "s"} on this account.
                    </p>
                  </div>
                ) : null}
                {achievements.length ? (
                  <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                    <p className="text-sm font-semibold text-purple-700">Highlights</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {achievements.slice(0, 4).map((achievement) => (
                        <span key={achievement} className="pill max-w-full [overflow-wrap:anywhere]">
                          {achievement}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            }
          />

          <section className="bg-background px-6 pt-2 md:px-12">
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

              {isPreviewMode ? (
                <div className="mb-6 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-4 text-sm font-medium text-purple-700">
                  You are viewing your profile the way other members see it. Private account actions and payment data are hidden in this preview.
                </div>
              ) : null}
            </div>
          </section>

          <section className="bg-background px-6 pb-2 md:px-12">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Public snapshot"
                  title="Profile highlights"
                  description="This is the identity, learning direction, and recognition other members can see."
                />

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                    <p className="text-sm font-semibold text-purple-700">About</p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {profileData.user.bio || "No public bio has been added yet."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                    <p className="text-sm font-semibold text-purple-700">Achievements</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {achievements.length ? (
                        achievements.map((achievement) => (
                          <span key={achievement} className="pill max-w-full [overflow-wrap:anywhere]">
                            {achievement}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm leading-7 text-slate-600">No achievements have been added yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Recognition"
                  title="Badges and certificates"
                  description="Only public badges are shown when a profile owner has chosen to keep badges private."
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                    <p className="text-sm font-semibold text-purple-700">Visible badges</p>
                    <div className="mt-3 grid gap-3">
                      {visibleBadges.length ? (
                        visibleBadges.map((badge) => (
                          <div key={badge.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
                            <p className="font-semibold text-slate-900">{badge.name}</p>
                            <p className="mt-2 text-sm leading-7 text-slate-600">{badge.description}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm leading-7 text-slate-600">No public badges are visible yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                    <p className="text-sm font-semibold text-purple-700">Certificates</p>
                    <div className="mt-3 grid gap-3">
                      {(profileData.user.certificates || []).length ? (
                        profileData.user.certificates.map((certificate) => (
                          <div key={certificate.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
                            <p className="font-semibold text-slate-900">{certificate.title}</p>
                            <p className="mt-2 text-sm leading-7 text-slate-600">
                              Issued {new Date(certificate.issuedAt).toLocaleDateString("en-GB")}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm leading-7 text-slate-600">No certificates have been issued yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-background px-6 py-12 md:px-12">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Community notes"
                  title="Profile comments"
                  description="Visible notes, thanks, and observations stay attached to the profile."
                />

                <div className="grid gap-4">
                  {profileData.comments.length ? (
                    profileData.comments.map((entry) => (
                      <FeedbackCard
                        key={entry.id}
                        eyebrow={entry.author?.displayName || "Community member"}
                        title={roleLabels[entry.author?.role] || "Member"}
                        body={entry.body}
                        meta={formatDate(entry.createdAt)}
                        onDelete={!isPreviewMode && entry.canDelete ? () => handleDeleteComment(entry.id) : null}
                        onReport={!isPreviewMode && entry.canReport ? () => handleReportComment(entry.id) : null}
                      />
                    ))
                  ) : (
                    <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                      No profile comments yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Leave a note"
                  title="Add feedback"
                  description="Classmates, teachers, and staff can leave structured notes here."
                />

                <div className="grid gap-6">
                  {!isPreviewMode && profileData.canComment ? (
                    <form onSubmit={handleCommentSubmit} className="grid gap-3 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                      <div className="flex items-center gap-2 text-purple-700">
                        <MessageSquareText size={18} />
                        <p className="font-semibold text-slate-900">Profile comment</p>
                      </div>
                      <textarea
                        rows={4}
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        placeholder="Share a useful or encouraging note."
                        className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                      />
                      <button type="submit" disabled={submittingComment} className="primary-btn w-fit disabled:opacity-70">
                        {submittingComment ? "Posting..." : "Post Comment"}
                      </button>
                    </form>
                  ) : null}

                  {!isPreviewMode && profileData.canLeavePeerFeedback ? (
                    <form onSubmit={handlePeerFeedbackSubmit} className="grid gap-4 rounded-2xl border border-purple-100 bg-white px-5 py-5">
                      <div className="flex items-center gap-2 text-purple-700">
                        <Users2 size={18} />
                        <p className="font-semibold text-slate-900">Classmate feedback</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Course
                          <select
                            value={peerFeedbackValues.courseId}
                            onChange={(event) =>
                              setPeerFeedbackValues((current) => ({ ...current, courseId: event.target.value }))
                            }
                            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                          >
                            {courseOptions.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Rating
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={peerFeedbackValues.score}
                            onChange={(event) =>
                              setPeerFeedbackValues((current) => ({
                                ...current,
                                score: Number(event.target.value),
                              }))
                            }
                            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Tone
                          <select
                            value={peerFeedbackValues.tone}
                            onChange={(event) =>
                              setPeerFeedbackValues((current) => ({ ...current, tone: event.target.value }))
                            }
                            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                          >
                            {peerToneOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <textarea
                        rows={4}
                        value={peerFeedbackValues.body}
                        onChange={(event) =>
                          setPeerFeedbackValues((current) => ({ ...current, body: event.target.value }))
                        }
                        placeholder="Share how this classmate contributes or grows."
                        className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                      />
                      <button type="submit" disabled={submittingPeerFeedback || !courseOptions.length} className="primary-btn w-fit disabled:opacity-70">
                        {submittingPeerFeedback ? "Posting..." : "Share Feedback"}
                      </button>
                    </form>
                  ) : null}

                  {!isPreviewMode && profileData.canLeaveTeacherFeedback ? (
                    <form onSubmit={handleTeacherFeedbackSubmit} className="grid gap-4 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                      <div className="flex items-center gap-2 text-purple-700">
                        <GraduationCap size={18} />
                        <p className="font-semibold text-slate-900">Teacher feedback</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Course
                          <select
                            value={teacherFeedbackValues.courseId}
                            onChange={(event) =>
                              setTeacherFeedbackValues((current) => ({ ...current, courseId: event.target.value }))
                            }
                            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                          >
                            {courseOptions.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-2 text-sm font-semibold text-text">
                          Progress score
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={teacherFeedbackValues.score}
                            onChange={(event) =>
                              setTeacherFeedbackValues((current) => ({
                                ...current,
                                score: Number(event.target.value),
                              }))
                            }
                            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                          />
                        </label>
                      </div>
                      <textarea
                        rows={4}
                        value={teacherFeedbackValues.body}
                        onChange={(event) =>
                          setTeacherFeedbackValues((current) => ({ ...current, body: event.target.value }))
                        }
                        placeholder="Leave a practical note about progress or revision needs."
                        className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                      />
                      <button type="submit" disabled={submittingTeacherFeedback || !courseOptions.length} className="primary-btn w-fit disabled:opacity-70">
                        {submittingTeacherFeedback ? "Posting..." : "Publish Feedback"}
                      </button>
                    </form>
                  ) : null}
                  {isPreviewMode ? (
                    <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5 text-sm leading-7 text-slate-600">
                      Interactive forms are hidden in preview mode so you can focus on the public profile layout.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-background px-6 pb-12 md:px-12">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Peer feedback"
                  title="Classmate notes"
                  description="Students can leave respectful notes about teamwork, consistency, and learning energy."
                />

                <div className="grid gap-4">
                  {profileData.peerFeedback.length ? (
                    profileData.peerFeedback.map((entry) => (
                      <FeedbackCard
                        key={entry.id}
                        eyebrow={[entry.author?.displayName || "Classmate", entry.courseTitle].join(" - ")}
                        title={`${entry.tone || "supportive"} note`}
                        body={entry.body}
                        meta={formatDate(entry.createdAt)}
                        score={`${entry.score}/5`}
                        onDelete={!isPreviewMode && entry.canDelete ? () => handleDeleteFeedback(entry.id) : null}
                        onReport={!isPreviewMode && entry.canReport ? () => handleReportFeedback(entry.id) : null}
                      />
                    ))
                  ) : (
                    <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                      No classmate feedback yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Teacher feedback"
                  title="Teacher guidance"
                  description="Course-specific guidance stays visible here so the student can revisit progress notes."
                />

                <div className="grid gap-4">
                  {profileData.teacherFeedback.length ? (
                    profileData.teacherFeedback.map((entry) => (
                      <FeedbackCard
                        key={entry.id}
                        eyebrow={entry.teacherName}
                        title={entry.courseTitle}
                        body={entry.comment}
                        meta={formatDate(entry.createdAt)}
                        score={`${entry.score}%`}
                        onDelete={!isPreviewMode && entry.canDelete ? () => handleDeleteFeedback(entry.id) : null}
                        onReport={!isPreviewMode && entry.canReport ? () => handleReportFeedback(entry.id) : null}
                      />
                    ))
                  ) : (
                    <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                      Teacher feedback will appear here after course reviews begin.
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-purple-100 bg-white px-5 py-5">
                  <div className="flex items-center gap-2 text-purple-700">
                    <Sparkles size={18} />
                    <p className="font-semibold text-slate-900">Safety</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Comments and feedback can be reported to admins or moderators, and relevant teachers are notified when review is needed.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-purple-700">
                    <ShieldCheck size={14} />
                    Respect-first moderation
                  </div>
                </div>
              </div>
            </div>
          </section>

          {profileData.paymentHistory?.length && !isPreviewMode ? (
            <section className="bg-background px-6 pb-12 md:px-12">
              <div className="mx-auto max-w-7xl surface-card p-8">
                <SectionHeader
                  eyebrow="Payments"
                  title="Your payment history"
                  description="Deposit, full payment, and remaining balance records stay attached to the profile."
                />

                <div className="grid gap-4 lg:grid-cols-2">
                  {profileData.paymentHistory.map((entry) => (
                    <PaymentCard key={entry.paymentId} entry={entry} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="bg-background px-6 py-20 md:px-12">
          <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center shadow-lg">
            <Star size={22} className="mx-auto text-primary" />
            <p className="mt-4 text-lg font-semibold text-primary">Profile not available.</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This profile may no longer exist, or your account does not have access to it.
            </p>
          </div>
        </section>
      )}
      <ReportDialog
        open={Boolean(reportTarget)}
        title={reportTarget?.title || "Report content"}
        description={reportTarget?.description || ""}
        reason={reportReason}
        error={reportError}
        loading={reporting}
        onChangeReason={setReportReason}
        onClose={closeReportDialog}
        onSubmit={handleReportSubmit}
      />
    </SiteLayout>
  );
}

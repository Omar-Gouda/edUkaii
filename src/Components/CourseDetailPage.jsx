import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BookOpenText,
  CalendarDays,
  Clock3,
  FileText,
  GraduationCap,
  MessageSquareText,
  PlayCircle,
  Shield,
  Star,
  Upload,
  Users,
} from "lucide-react";
import CourseManagerForm from "./CourseManagerForm";
import { BulletList, PageHero, SectionHeader, SiteLayout } from "./SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";
import { resolveCourseImage } from "../lib/courseMedia";

const courseAliasMap = {
  frontend: "course_frontend",
  english: "course_english",
  interpretation: "course_interpretation",
  hr: "course_hr",
};

function formatPrice(priceCents, currency) {
  return `${(Number(priceCents || 0) / 100).toLocaleString()} ${currency || "EGP"}`;
}

function formatRecordingDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
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

function createResourceDraft() {
  return {
    title: "",
    description: "",
    linkUrl: "",
    file: null,
    published: true,
  };
}

function createAssignmentDraft() {
  return {
    title: "",
    description: "",
    dueAt: "",
    penaltyNote: "",
    file: null,
    published: true,
  };
}

function createExamDraft() {
  return {
    title: "",
    instructions: "",
    dueAt: "",
    questionsText: "",
    published: true,
  };
}

function buildResourceHref(item) {
  return item.fileUrl || item.linkUrl || "";
}

function nextDaysSelection(slot, desiredDays) {
  return slot.days.slice(0, Math.max(1, Math.min(desiredDays, slot.days.length)));
}

function getPaymentPlanOption(course, plan) {
  if (!course?.paymentPlans) {
    return null;
  }

  if (plan === "three_payments") {
    return course.paymentPlans.threePayments || null;
  }

  return course.paymentPlans[plan] || null;
}

export default function CourseDetailPage({ slug: slugProp }) {
  const params = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext);
  const [course, setCourse] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [daysPerWeek, setDaysPerWeek] = useState(1);
  const [paymentPlan, setPaymentPlan] = useState("installment");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [approvingEditId, setApprovingEditId] = useState("");
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [ratingValues, setRatingValues] = useState({ rating: 5, review: "" });
  const [savingRating, setSavingRating] = useState(false);
  const [materialDraft, setMaterialDraft] = useState(createResourceDraft());
  const [documentDraft, setDocumentDraft] = useState(createResourceDraft());
  const [assignmentDraft, setAssignmentDraft] = useState(createAssignmentDraft());
  const [examDraft, setExamDraft] = useState(createExamDraft());
  const [publishingType, setPublishingType] = useState("");
  const [assignmentSubmissionDrafts, setAssignmentSubmissionDrafts] = useState({});
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState("");

  const resolvedSlug = courseAliasMap[slugProp || params.slug] || slugProp || params.slug;
  const canManage = Boolean(course?.canManage);
  const canEnroll = Boolean(isAuthenticated && user?.role === "student" && course && !course.isEnrolled);
  const canSeeClassroom = Boolean(course?.isEnrolled || course?.canManage);
  const canRateCourse = Boolean(user?.role === "student" && course?.isEnrolled);

  useEffect(() => {
    async function loadCourse() {
      setLoading(true);
      setError("");

      try {
        const requests = [api.get(`/courses/${resolvedSlug}`)];

        if (["admin", "moderator", "teacher"].includes(user?.role || "")) {
          requests.push(api.get("/teachers"));
        }

        const [coursePayload, teachersPayload] = await Promise.all(requests);
        setCourse(coursePayload.course);
        setTeachers(teachersPayload?.teachers || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    if (resolvedSlug) {
      loadCourse();
    }
  }, [resolvedSlug, user?.role]);

  useEffect(() => {
    if (!course?.slots?.length) {
      return;
    }

    setSelectedSlotId((current) => {
      if (course.enrollment?.slotId && course.slots.some((slot) => slot.id === course.enrollment.slotId)) {
        return course.enrollment.slotId;
      }

      if (current && course.slots.some((slot) => slot.id === current)) {
        return current;
      }

      return course.slots[0].id;
    });
  }, [course]);

  useEffect(() => {
    if (!course) {
      return;
    }

    setRatingValues((current) => ({
      ...current,
      rating: course.myRating || current.rating || 5,
    }));
  }, [course]);

  const selectedSlot = useMemo(
    () => course?.slots.find((slot) => slot.id === selectedSlotId) || null,
    [course, selectedSlotId],
  );
  const activePaymentPlan = useMemo(
    () => getPaymentPlanOption(course, paymentPlan),
    [course, paymentPlan],
  );

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    if (course?.enrollment?.slotId === selectedSlot.id) {
      const plannedDays = Math.max(
        1,
        Math.min(course.enrollment.daysPerWeek || 1, selectedSlot.days.length),
      );

      setDaysPerWeek(plannedDays);
      setSelectedDays(
        (course.enrollment.selectedDays || []).filter((day) => selectedSlot.days.includes(day)),
      );
      return;
    }

    const nextDays = Math.max(1, Math.min(daysPerWeek || 1, selectedSlot.days.length));
    setDaysPerWeek(nextDays);
    setSelectedDays((current) => {
      const valid = current.filter((day) => selectedSlot.days.includes(day));
      return valid.length ? valid.slice(0, nextDays) : nextDaysSelection(selectedSlot, nextDays);
    });
  }, [
    course?.enrollment?.daysPerWeek,
    course?.enrollment?.selectedDays,
    course?.enrollment?.slotId,
    daysPerWeek,
    selectedSlot,
  ]);

  useEffect(() => {
    if (!selectedSlot || !canSeeClassroom) {
      setMessages([]);
      return;
    }

    async function loadChat() {
      setChatLoading(true);
      setChatError("");

      try {
        const payload = await api.get(`/courses/${course.id}/slots/${selectedSlot.id}/chat`);
        setMessages(payload.messages);
      } catch (loadError) {
        setChatError(loadError.message);
      } finally {
        setChatLoading(false);
      }
    }

    loadChat();
  }, [canSeeClassroom, course?.id, selectedSlot]);

  function handleDayToggle(day) {
    setSelectedDays((current) => {
      if (current.includes(day)) {
        return current.filter((item) => item !== day);
      }

      if (current.length >= daysPerWeek) {
        return current;
      }

      return [...current, day];
    });
  }

  function handleDaysPerWeekChange(value) {
    if (!selectedSlot) {
      return;
    }

    const nextValue = Math.max(1, Math.min(Number(value), selectedSlot.days.length));
    setDaysPerWeek(nextValue);
    setSelectedDays((current) => {
      const valid = current.filter((day) => selectedSlot.days.includes(day));
      if (valid.length >= nextValue) {
        return valid.slice(0, nextValue);
      }

      const missing = selectedSlot.days.filter((day) => !valid.includes(day)).slice(0, nextValue - valid.length);
      return [...valid, ...missing];
    });
  }

  async function handleCreateCheckout() {
    if (!course || !selectedSlot) {
      return;
    }

    if (selectedDays.length !== daysPerWeek) {
      setError("Please choose the same number of class days as your weekly plan.");
      return;
    }

    setProcessingPayment(true);
    setError("");
    setActionMessage("");

    try {
      const payload = await api.post("/payments/create-checkout", {
        courseId: course.id,
        slotId: selectedSlot.id,
        selectedDays,
        daysPerWeek,
        paymentPlan,
      });

      navigate(`/payments?paymentId=${payload.payment.id}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setProcessingPayment(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!chatDraft.trim() || !selectedSlot || !course) {
      return;
    }

    setChatError("");

    try {
      const payload = await api.post(`/courses/${course.id}/slots/${selectedSlot.id}/chat`, {
        message: chatDraft.trim(),
      });
      setMessages((current) => [...current, payload.message]);
      setChatDraft("");
    } catch (submitError) {
      setChatError(submitError.message);
    }
  }

  async function handleCourseSave(payload) {
    if (!course) {
      return;
    }

    setSavingCourse(true);
    setError("");
    setActionMessage("");

    try {
      const response = await api.patch(`/courses/${course.id}`, payload);
      if (response.pending) {
        setActionMessage("Your course edits were submitted for admin approval.");
        return;
      }

      setCourse(response.course);
      setActionMessage("Course details updated successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleApproveEdit(editId) {
    if (!course) {
      return;
    }

    setApprovingEditId(editId);
    setError("");
    setActionMessage("");

    try {
      const response = await api.post(`/courses/${course.id}/pending-edits/${editId}/approve`, {});
      setCourse(response.course);
      setActionMessage("Pending edit approved and applied.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setApprovingEditId("");
    }
  }

  async function handleDeleteCourse() {
    if (!course) {
      return;
    }

    const confirmed = window.confirm(`Remove ${course.title} from the platform?`);
    if (!confirmed) {
      return;
    }

    setDeletingCourse(true);
    setError("");

    try {
      await api.delete(`/courses/${course.id}`);
      navigate("/courses");
    } catch (deleteError) {
      setError(deleteError.message);
      setDeletingCourse(false);
    }
  }

  async function handleRateCourse(event) {
    event.preventDefault();

    if (!course || !canRateCourse) {
      return;
    }

    setSavingRating(true);
    setError("");
    setActionMessage("");

    try {
      const response = await api.post(`/courses/${course.id}/ratings`, ratingValues);
      setCourse(response.course);
      setActionMessage("Course rating saved successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSavingRating(false);
    }
  }

  async function handlePublishResource(kind, draft, resetDraft) {
    if (!course) {
      return;
    }

    setPublishingType(kind);
    setError("");
    setActionMessage("");

    try {
      const payload = new FormData();
      payload.append("title", draft.title);
      payload.append("description", draft.description);
      payload.append("linkUrl", draft.linkUrl || "");
      payload.append("published", String(draft.published));
      if (kind === "assignments") {
        payload.append("dueAt", draft.dueAt);
        payload.append("penaltyNote", draft.penaltyNote);
      }
      if (draft.file) {
        payload.append("file", draft.file);
      }

      const response = await api.post(`/courses/${course.id}/${kind}`, payload);
      setCourse(response.course);
      resetDraft(kind === "assignments" ? createAssignmentDraft() : createResourceDraft());
      setActionMessage(`${kind === "materials" ? "Material" : kind === "documents" ? "Document" : "Assignment"} published successfully.`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setPublishingType("");
    }
  }

  async function handlePublishExam(event) {
    event.preventDefault();

    if (!course) {
      return;
    }

    setPublishingType("exams");
    setError("");
    setActionMessage("");

    try {
      const response = await api.post(`/courses/${course.id}/exams`, examDraft);
      setCourse(response.course);
      setExamDraft(createExamDraft());
      setActionMessage("Exam published successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setPublishingType("");
    }
  }

  async function handleSubmitAssignment(event, assignmentId) {
    event.preventDefault();

    if (!course || !assignmentId) {
      return;
    }

    const draft = assignmentSubmissionDrafts[assignmentId] || { note: "", file: null };

    setSubmittingAssignmentId(assignmentId);
    setError("");
    setActionMessage("");

    try {
      const payload = new FormData();
      payload.append("note", draft.note || "");
      if (draft.file) {
        payload.append("file", draft.file);
      }

      const response = await api.post(`/courses/${course.id}/assignments/${assignmentId}/submissions`, payload);
      setCourse(response.course);
      setAssignmentSubmissionDrafts((current) => ({
        ...current,
        [assignmentId]: { note: "", file: null },
      }));
      setActionMessage("Assignment submitted successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmittingAssignmentId("");
    }
  }

  if (loading) {
    return (
      <SiteLayout>
        <section className="bg-background px-6 py-20 md:px-12">
          <div className="mx-auto max-w-6xl rounded-3xl bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-primary">Loading course details...</p>
          </div>
        </section>
      </SiteLayout>
    );
  }

  if (!course) {
    return (
      <SiteLayout>
        <section className="bg-background px-6 py-20 md:px-12">
          <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center shadow-lg">
            <h1 className="text-3xl font-bold text-primary">Course not found</h1>
            <p className="mt-4 leading-relaxed text-gray-700">
              The course link may have changed, or the course is no longer available.
            </p>
            <Link to="/courses" className="primary-btn mt-8">
              Back to Courses
            </Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow={course.level}
        title={course.title}
        description={course.summary}
        actions={
          canEnroll ? (
            <button
              type="button"
              onClick={handleCreateCheckout}
              disabled={processingPayment || !selectedSlot}
              className="primary-btn disabled:cursor-not-allowed disabled:opacity-70"
            >
              {processingPayment
                ? "Preparing checkout..."
                : paymentPlan === "full"
                  ? `Pay ${formatPrice(course.priceCents, course.currency)}`
                  : paymentPlan === "three_payments"
                    ? `Pay ${formatPrice(activePaymentPlan?.initialAmountCents || 0, course.currency)} Now`
                    : `Reserve With ${course.depositPercentage || 15}% Deposit`}
            </button>
          ) : course.isEnrolled ? (
            <>
              <a
                href={`/api/calendar/classes/${selectedSlot?.id}.ics?courseId=${course.id}`}
                className="primary-btn"
              >
                Add Class Reminder
              </a>
              <a
                href="#classroom-space"
                className="secondary-btn !border-primary !text-primary"
              >
                Open Classroom
              </a>
            </>
          ) : !isAuthenticated ? (
            <>
              <Link to="/signup" className="primary-btn">
                Create Account
              </Link>
              <Link to="/signin" className="secondary-btn !border-primary !text-primary">
                Sign In
              </Link>
            </>
          ) : (
            <Link to="/dashboard" className="primary-btn">
              Go to Dashboard
            </Link>
          )
        }
        aside={
          <div className="grid gap-5">
            <img src={resolveCourseImage(course)} alt={course.title} className="h-60 w-full rounded-2xl object-cover" />
            <div className="grid gap-3">
              <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                  <Clock3 size={16} />
                  <span>{course.duration}</span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{course.format}</p>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                  <GraduationCap size={16} />
                  <span>{course.teacher?.name || "Instructor"}</span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{course.teacher?.specialty || "Guided learning"}</p>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                <p className="text-sm font-semibold text-purple-700">Course pricing</p>
                <p className="mt-2 text-2xl font-extrabold text-text">{formatPrice(course.priceCents, course.currency)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Choose full payment, a {course.depositPercentage || 15}% deposit, or 3 payments. The lightest start is {formatPrice(course.paymentPlans?.installment?.initialAmountCents || course.depositCents, course.currency)}.
                </p>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                <p className="text-sm font-semibold text-purple-700">Course signals</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-2 font-semibold text-primary">
                    <Star size={14} />
                    {course.averageRating ? `${course.averageRating}/5` : "New rating"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-2 font-semibold text-primary">
                    <Users size={14} />
                    {course.joinerCount} joiner{course.joinerCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Based on {course.ratingCount} student rating{course.ratingCount === 1 ? "" : "s"} and active enrollment on the platform.
                </p>
              </div>
            </div>
          </div>
        }
      />

      {error ? (
        <section className="bg-background px-6 pt-2 md:px-12">
          <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        </section>
      ) : null}

      {actionMessage ? (
        <section className="bg-background px-6 pt-2 md:px-12">
          <div className="mx-auto max-w-7xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            {actionMessage}
          </div>
        </section>
      ) : null}

      <section className="bg-background px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <SectionHeader
              eyebrow="Course overview"
              title="What students will work through"
              description={course.description}
            />

            <div className="grid gap-8">
              <div>
                <h3 className="text-xl font-bold text-primary">Teacher brief</h3>
                <p className="mt-3 leading-relaxed text-gray-700">{course.brief || "The instructor will share the course direction and class expectations here."}</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary">Best fit for</h3>
                <div className="mt-4">
                  <BulletList items={course.audience} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary">Outcomes</h3>
                <div className="mt-4">
                  <BulletList items={course.outcomes} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <SectionHeader
              eyebrow="Course flow"
              title="Modules and weekly structure"
              description="The course is broken into focused modules so students can keep momentum without losing the bigger picture."
            />

            <div className="grid gap-4">
              {course.modules.map((module, index) => (
                <div key={module} className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-purple-700">Module {index + 1}</p>
                  <p className="mt-2 text-lg font-bold text-text">{module}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background px-6 py-4 md:px-12">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-8 shadow-lg">
          <SectionHeader
            eyebrow="Class options"
            title="Choose the slot that fits your week"
            description="Students can compare available class times first, then pick how many days they want to attend from that class pattern."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            {course.slots.map((slot) => {
              const active = slot.id === selectedSlotId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`grid gap-4 rounded-3xl border px-6 py-6 text-left transition ${
                    active
                      ? "border-primary bg-purple-50 shadow-sm"
                      : "border-purple-100 bg-white hover:border-purple-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-bold text-primary">{slot.name}</p>
                      <p className="mt-2 text-sm text-gray-700">{slot.days.join(", ")} at {slot.startTime}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
                      {slot.availableSeats} seats left
                    </span>
                  </div>
                  <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
                    <span className="inline-flex items-center gap-2">
                      <Clock3 size={15} className="text-purple-700" />
                      {slot.durationMinutes} mins
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Users size={15} className="text-purple-700" />
                      Capacity {slot.capacity}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays size={15} className="text-purple-700" />
                      {slot.location}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedSlot && canEnroll ? (
            <div className="mt-8 grid gap-6 rounded-3xl border border-purple-100 bg-purple-50 p-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h3 className="text-xl font-bold text-primary">Plan your week</h3>
                <p className="mt-3 leading-relaxed text-gray-700">
                  Choose how many days you want to join from this class pattern, then pick the exact days that suit you.
                </p>
                <div className="mt-5 rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <p className="text-sm font-semibold text-purple-700">Payment plan</p>
                  <div className="mt-3 grid gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentPlan("installment")}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        paymentPlan === "installment"
                          ? "border-primary bg-purple-50"
                          : "border-purple-100 bg-white hover:border-purple-200"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">Installment</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Pay {formatPrice(course.paymentPlans?.installment?.initialAmountCents || course.depositCents, course.currency)} now, then the remaining balance later.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentPlan("three_payments")}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        paymentPlan === "three_payments"
                          ? "border-primary bg-purple-50"
                          : "border-purple-100 bg-white hover:border-purple-200"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">3 payments</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Split the course fee into 3 payments starting from {formatPrice(course.paymentPlans?.threePayments?.initialAmountCents || 0, course.currency)}.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentPlan("full")}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        paymentPlan === "full"
                          ? "border-primary bg-purple-50"
                          : "border-purple-100 bg-white hover:border-purple-200"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">Full payment</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Pay {formatPrice(course.priceCents, course.currency)} and finish the balance in one step.
                      </p>
                    </button>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <p className="text-sm font-semibold text-purple-700">Seat reservation policy</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {paymentPlan === "full"
                      ? "This course opens after the full payment is confirmed."
                      : paymentPlan === "three_payments"
                        ? "This course opens after the first of 3 payments is confirmed, and the remaining installments stay visible in your account."
                        : `This course opens after a ${course.depositPercentage || 15}% deposit. The remaining balance stays attached to the account.`}
                  </p>
                </div>
                {activePaymentPlan?.installments?.length ? (
                  <div className="mt-5 rounded-2xl bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-semibold text-purple-700">Plan breakdown</p>
                    <div className="mt-3 grid gap-3">
                      {activePaymentPlan.installments.map((amount, index) => (
                        <div key={`${paymentPlan}-${index}`} className="flex items-center justify-between rounded-2xl border border-purple-100 px-4 py-3 text-sm">
                          <span className="font-semibold text-slate-900">
                            {paymentPlan === "installment" && index === 0
                              ? `${course.depositPercentage || 15}% deposit`
                              : index === activePaymentPlan.installments.length - 1
                                ? "Final payment"
                                : `Payment ${index + 1} of ${activePaymentPlan.installments.length}`}
                          </span>
                          <span className="font-bold text-primary">{formatPrice(amount, course.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="mt-6 grid gap-2 text-sm font-semibold text-text">
                  Days per week
                  <input
                    type="number"
                    min="1"
                    max={selectedSlot.days.length}
                    value={daysPerWeek}
                    onChange={(event) => handleDaysPerWeekChange(event.target.value)}
                    className="w-full rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                </label>
              </div>

              <div>
                <p className="text-sm font-semibold text-purple-700">Choose your days</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedSlot.days.map((day) => (
                    <label key={day} className="flex items-center justify-between rounded-2xl border border-white bg-white px-4 py-4 text-sm font-semibold text-text">
                      <span>{day}</span>
                      <input
                        type="checkbox"
                        checked={selectedDays.includes(day)}
                        onChange={() => handleDayToggle(day)}
                        className="h-5 w-5 rounded border-purple-200 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="bg-background px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <SectionHeader
              eyebrow="Course library"
              title="Materials and course documents"
              description="Teachers can publish reading packs, links, and downloadable files so the course space stays useful between live sessions."
            />

            <div className="grid gap-8">
              <div>
                <div className="mb-4 flex items-center gap-2 text-purple-700">
                  <BookOpenText size={18} />
                  <h3 className="text-xl font-bold text-primary">Materials</h3>
                </div>
                <div className="grid gap-4">
                  {course.materials.length ? (
                    course.materials.map((item) => {
                      const href = buildResourceHref(item);
                      return (
                        <article key={item.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">{item.title}</h4>
                              <p className="mt-2 text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">
                                {item.description || "Shared material for this course."}
                              </p>
                            </div>
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-btn !border-primary !text-primary"
                              >
                                Open
                              </a>
                            ) : null}
                          </div>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                            Published by {item.createdByName} · {formatDateTime(item.createdAt)}
                          </p>
                        </article>
                      );
                    })
                  ) : (
                    <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                      Materials will appear here after staff publish course notes or links.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2 text-purple-700">
                  <FileText size={18} />
                  <h3 className="text-xl font-bold text-primary">Documents</h3>
                </div>
                <div className="grid gap-4">
                  {course.documents.length ? (
                    course.documents.map((item) => {
                      const href = buildResourceHref(item);
                      return (
                        <article key={item.id} className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">{item.title}</h4>
                              <p className="mt-2 text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">
                                {item.description || "Published course document."}
                              </p>
                            </div>
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-btn !border-primary !text-primary"
                              >
                                Open
                              </a>
                            ) : null}
                          </div>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                            Published by {item.createdByName} · {formatDateTime(item.createdAt)}
                          </p>
                        </article>
                      );
                    })
                  ) : (
                    <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                      Course documents will appear here when staff publish downloadable resources.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <SectionHeader
              eyebrow="Student signals"
              title={canRateCourse ? "Rate this course" : "Course momentum"}
              description={
                canRateCourse
                  ? "Students can rate the course after enrollment so stronger courses can be recommended more often."
                  : "Ratings and joiner counts help the platform suggest the right next course to more students."
              }
            />

            <div className="grid gap-4">
              <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-primary">
                    <Star size={14} />
                    {course.averageRating ? `${course.averageRating}/5 average` : "No ratings yet"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-primary">
                    <Users size={14} />
                    {course.joinerCount} active joiner{course.joinerCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {course.ratingCount} rating{course.ratingCount === 1 ? "" : "s"} are currently attached to this course.
                </p>
              </div>

              {canRateCourse ? (
                <form onSubmit={handleRateCourse} className="grid gap-4 rounded-2xl border border-purple-100 bg-white px-5 py-5">
                  <label className="grid gap-2 text-sm font-semibold text-text">
                    Your rating
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={ratingValues.rating}
                      onChange={(event) =>
                        setRatingValues((current) => ({ ...current, rating: Number(event.target.value) }))
                      }
                      className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-text">
                    Short review
                    <textarea
                      rows={4}
                      value={ratingValues.review}
                      onChange={(event) =>
                        setRatingValues((current) => ({ ...current, review: event.target.value }))
                      }
                      placeholder="Share what is working well or what helped most."
                      className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                    />
                  </label>
                  <button type="submit" disabled={savingRating} className="primary-btn w-fit disabled:opacity-70">
                    {savingRating ? "Saving..." : course.myRating ? "Update Rating" : "Save Rating"}
                  </button>
                </form>
              ) : (
                <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                  Enrolled students can leave a rating from this page after they reserve their seat and enter the course.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {canSeeClassroom || canManage ? (
        <section className="bg-background px-6 py-2 md:px-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <SectionHeader
                eyebrow="Assignments"
                title="Course work and submissions"
                description="Students can track due dates and upload work here, while staff can keep assignment expectations attached to the course."
              />

              <div className="grid gap-5">
                {course.assignments.length ? (
                  course.assignments.map((assignment) => (
                    <article key={assignment.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">{assignment.title}</h3>
                          <p className="mt-2 text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">
                            {assignment.description || "Assignment details will appear here."}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${assignment.isLate ? "bg-white text-red-600" : "bg-white text-primary"}`}>
                          {assignment.isLate ? "Late" : `Due ${formatDateTime(assignment.dueAt)}`}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{assignment.penaltyNote}</p>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                        <span>Published by {assignment.createdByName}</span>
                        {assignment.attachmentUrl ? (
                          <a href={assignment.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary">
                            Open attachment
                          </a>
                        ) : null}
                      </div>

                      {user?.role === "student" ? (
                        <div className="mt-5 rounded-2xl border border-white bg-white px-4 py-4">
                          {assignment.submission ? (
                            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                              <p>Submitted on {formatDateTime(assignment.submission.submittedAt)}.</p>
                              {assignment.submission.note ? (
                                <p className="mt-2 [overflow-wrap:anywhere]">{assignment.submission.note}</p>
                              ) : null}
                              {assignment.submission.fileUrl ? (
                                <a
                                  href={assignment.submission.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex font-semibold text-primary"
                                >
                                  Open current submission
                                </a>
                              ) : null}
                            </div>
                          ) : null}

                          <form onSubmit={(event) => handleSubmitAssignment(event, assignment.id)} className="grid gap-3">
                            <label className="grid gap-2 text-sm font-semibold text-text">
                              Submission note
                              <textarea
                                rows={3}
                                value={assignmentSubmissionDrafts[assignment.id]?.note || ""}
                                onChange={(event) =>
                                  setAssignmentSubmissionDrafts((current) => ({
                                    ...current,
                                    [assignment.id]: {
                                      ...(current[assignment.id] || { file: null }),
                                      note: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Add context for your upload or paste your answer here."
                                className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-semibold text-text">
                              Upload file
                              <input
                                type="file"
                                onChange={(event) =>
                                  setAssignmentSubmissionDrafts((current) => ({
                                    ...current,
                                    [assignment.id]: {
                                      ...(current[assignment.id] || { note: "" }),
                                      file: event.target.files?.[0] || null,
                                    },
                                  }))
                                }
                                className="rounded-xl border border-dashed border-purple-200 bg-white px-4 py-3 text-sm text-text outline-none"
                              />
                            </label>
                            <button
                              type="submit"
                              disabled={submittingAssignmentId === assignment.id}
                              className="primary-btn w-fit disabled:opacity-70"
                            >
                              <Upload size={16} />
                              {submittingAssignmentId === assignment.id ? "Uploading..." : "Upload Assignment"}
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                    No assignments have been published for this course yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <SectionHeader
                eyebrow="Exams"
                title="Published exam briefs"
                description="Teachers can publish exam prompts and due dates here so students can keep requirements in the same course space."
              />

              <div className="grid gap-5">
                {course.exams.length ? (
                  course.exams.map((exam) => (
                    <article key={exam.id} className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">{exam.title}</h3>
                          <p className="mt-2 text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">
                            {exam.instructions || "Exam instructions will appear here."}
                          </p>
                        </div>
                        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-primary">
                          Due {formatDateTime(exam.dueAt)}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {exam.questions.map((question, index) => (
                          <div key={question.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4 text-sm leading-7 text-slate-600">
                            <span className="font-semibold text-primary">Question {index + 1}.</span> {question.prompt}
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                        Published by {exam.createdByName} · {formatDateTime(exam.createdAt)}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                    No exams have been published for this course yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {canSeeClassroom ? (
        <section className="bg-background px-6 py-14 md:px-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <SectionHeader
                eyebrow="Replay archive"
                title="Recorded classroom sessions"
                description="Class replays stay attached to their class groups so students can revisit lessons, feedback, and shared context later."
              />

              <div className="grid gap-6">
                {course.slots.map((slot) => (
                  <div key={slot.id} className="grid gap-4 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-primary">{slot.name}</p>
                        <p className="mt-1 text-sm text-gray-700">{slot.days.join(", ")} at {slot.startTime}</p>
                      </div>
                      <a
                        href={`/api/calendar/classes/${slot.id}.ics?courseId=${course.id}`}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm"
                      >
                        Reminder
                      </a>
                    </div>

                    {slot.recordings.length ? (
                      <div className="grid gap-3">
                        {slot.recordings.map((recording) => (
                          <div key={recording.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white bg-white px-4 py-4">
                            <div className="flex items-center gap-3">
                              <PlayCircle className="text-purple-700" size={20} />
                              <div>
                                <p className="font-semibold text-text">{recording.title}</p>
                                <p className="mt-1 text-sm text-gray-600">
                                  {recording.duration} - {formatRecordingDate(recording.recordedAt)}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                              Watch on platform
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">This class group will show archived sessions after the first live lesson finishes.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div id="classroom-space" className="rounded-3xl bg-white p-8 shadow-lg">
              <SectionHeader
                eyebrow="Classroom space"
                title="Meet your classmates before class starts"
                description="Each class group gets a simple waiting-room chat so students can stay connected before the teacher opens the live classroom."
              />

              {chatError ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {chatError}
                </div>
              ) : null}

              <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
                <div>
                  <p className="font-semibold text-primary">{selectedSlot?.name}</p>
                  <p className="mt-1 text-sm text-gray-700">{selectedSlot?.days.join(", ")} at {selectedSlot?.startTime}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
                  <Shield size={14} />
                  Private to class members
                </span>
              </div>

              <div className="grid gap-3">
                {chatLoading ? (
                  <div className="rounded-2xl border border-purple-100 bg-white px-4 py-5 text-sm text-gray-600">
                    Loading classroom chat...
                  </div>
                ) : messages.length ? (
                  messages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-purple-100 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-primary">{message.authorName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <p className="mt-2 leading-relaxed text-gray-700">{message.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-purple-100 bg-white px-4 py-5 text-sm text-gray-600">
                    The classroom chat is quiet for now.
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="mt-5 grid gap-3">
                <label className="grid gap-2 text-sm font-semibold text-text">
                  Send a class message
                  <textarea
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    rows={4}
                    placeholder="Write a quick note for your class group..."
                    className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                </label>
                <button type="submit" className="primary-btn w-fit">
                  <MessageSquareText size={16} />
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section className="bg-background px-6 pb-16 md:px-12">
          <div className="mx-auto max-w-7xl rounded-3xl bg-white p-8 shadow-lg md:p-10">
            <SectionHeader
              eyebrow="Course management"
              title="Update the course content, schedule, and publishing details"
              description="Staff can keep the public course page accurate while maintaining class timing, slot availability, and instructor information."
            />

            <CourseManagerForm
              initialCourse={course}
              teachers={teachers}
              onSubmit={handleCourseSave}
              submitLabel={user?.role === "moderator" ? "Submit Edit for Approval" : "Save Course Changes"}
              submitting={savingCourse}
            />

            <div className="mt-10 grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                <div className="mb-4 flex items-center gap-2 text-purple-700">
                  <BookOpenText size={18} />
                  <h3 className="text-xl font-bold text-primary">Publish material</h3>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handlePublishResource("materials", materialDraft, setMaterialDraft);
                  }}
                  className="grid gap-3"
                >
                  <input
                    value={materialDraft.title}
                    onChange={(event) => setMaterialDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Material title"
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <textarea
                    rows={3}
                    value={materialDraft.description}
                    onChange={(event) => setMaterialDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Description"
                    className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <input
                    value={materialDraft.linkUrl}
                    onChange={(event) => setMaterialDraft((current) => ({ ...current, linkUrl: event.target.value }))}
                    placeholder="Optional link URL"
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <input
                    type="file"
                    onChange={(event) => setMaterialDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                    className="rounded-xl border border-dashed border-purple-200 bg-white px-4 py-3 text-sm text-text outline-none"
                  />
                  <label className="flex items-center gap-3 text-sm font-semibold text-text">
                    <input
                      type="checkbox"
                      checked={materialDraft.published}
                      onChange={(event) => setMaterialDraft((current) => ({ ...current, published: event.target.checked }))}
                      className="h-5 w-5 rounded border-purple-200 accent-primary"
                    />
                    Publish immediately
                  </label>
                  <button type="submit" disabled={publishingType === "materials"} className="primary-btn w-fit disabled:opacity-70">
                    {publishingType === "materials" ? "Publishing..." : "Publish Material"}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                <div className="mb-4 flex items-center gap-2 text-purple-700">
                  <FileText size={18} />
                  <h3 className="text-xl font-bold text-primary">Publish document</h3>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handlePublishResource("documents", documentDraft, setDocumentDraft);
                  }}
                  className="grid gap-3"
                >
                  <input
                    value={documentDraft.title}
                    onChange={(event) => setDocumentDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Document title"
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <textarea
                    rows={3}
                    value={documentDraft.description}
                    onChange={(event) => setDocumentDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Description"
                    className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <input
                    value={documentDraft.linkUrl}
                    onChange={(event) => setDocumentDraft((current) => ({ ...current, linkUrl: event.target.value }))}
                    placeholder="Optional link URL"
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <input
                    type="file"
                    onChange={(event) => setDocumentDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                    className="rounded-xl border border-dashed border-purple-200 bg-white px-4 py-3 text-sm text-text outline-none"
                  />
                  <label className="flex items-center gap-3 text-sm font-semibold text-text">
                    <input
                      type="checkbox"
                      checked={documentDraft.published}
                      onChange={(event) => setDocumentDraft((current) => ({ ...current, published: event.target.checked }))}
                      className="h-5 w-5 rounded border-purple-200 accent-primary"
                    />
                    Publish immediately
                  </label>
                  <button type="submit" disabled={publishingType === "documents"} className="primary-btn w-fit disabled:opacity-70">
                    {publishingType === "documents" ? "Publishing..." : "Publish Document"}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-white px-5 py-5">
                <div className="mb-4 flex items-center gap-2 text-purple-700">
                  <Upload size={18} />
                  <h3 className="text-xl font-bold text-primary">Publish assignment</h3>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handlePublishResource("assignments", assignmentDraft, setAssignmentDraft);
                  }}
                  className="grid gap-3"
                >
                  <input
                    value={assignmentDraft.title}
                    onChange={(event) => setAssignmentDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Assignment title"
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <textarea
                    rows={3}
                    value={assignmentDraft.description}
                    onChange={(event) => setAssignmentDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Description"
                    className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <input
                    type="datetime-local"
                    value={assignmentDraft.dueAt}
                    onChange={(event) => setAssignmentDraft((current) => ({ ...current, dueAt: event.target.value }))}
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <textarea
                    rows={2}
                    value={assignmentDraft.penaltyNote}
                    onChange={(event) => setAssignmentDraft((current) => ({ ...current, penaltyNote: event.target.value }))}
                    placeholder="Penalty note"
                    className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <input
                    type="file"
                    onChange={(event) => setAssignmentDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                    className="rounded-xl border border-dashed border-purple-200 bg-white px-4 py-3 text-sm text-text outline-none"
                  />
                  <label className="flex items-center gap-3 text-sm font-semibold text-text">
                    <input
                      type="checkbox"
                      checked={assignmentDraft.published}
                      onChange={(event) => setAssignmentDraft((current) => ({ ...current, published: event.target.checked }))}
                      className="h-5 w-5 rounded border-purple-200 accent-primary"
                    />
                    Publish immediately
                  </label>
                  <button type="submit" disabled={publishingType === "assignments"} className="primary-btn w-fit disabled:opacity-70">
                    {publishingType === "assignments" ? "Publishing..." : "Publish Assignment"}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                <div className="mb-4 flex items-center gap-2 text-purple-700">
                  <CalendarDays size={18} />
                  <h3 className="text-xl font-bold text-primary">Publish exam</h3>
                </div>
                <form onSubmit={handlePublishExam} className="grid gap-3">
                  <input
                    value={examDraft.title}
                    onChange={(event) => setExamDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Exam title"
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <textarea
                    rows={3}
                    value={examDraft.instructions}
                    onChange={(event) => setExamDraft((current) => ({ ...current, instructions: event.target.value }))}
                    placeholder="Instructions"
                    className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <input
                    type="datetime-local"
                    value={examDraft.dueAt}
                    onChange={(event) => setExamDraft((current) => ({ ...current, dueAt: event.target.value }))}
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <textarea
                    rows={5}
                    value={examDraft.questionsText}
                    onChange={(event) => setExamDraft((current) => ({ ...current, questionsText: event.target.value }))}
                    placeholder="One question per line"
                    className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <label className="flex items-center gap-3 text-sm font-semibold text-text">
                    <input
                      type="checkbox"
                      checked={examDraft.published}
                      onChange={(event) => setExamDraft((current) => ({ ...current, published: event.target.checked }))}
                      className="h-5 w-5 rounded border-purple-200 accent-primary"
                    />
                    Publish immediately
                  </label>
                  <button type="submit" disabled={publishingType === "exams"} className="primary-btn w-fit disabled:opacity-70">
                    {publishingType === "exams" ? "Publishing..." : "Publish Exam"}
                  </button>
                </form>
              </div>
            </div>

            {user?.role === "admin" && course.pendingEdits?.length ? (
              <div className="mt-10 grid gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-primary">Pending moderator edits</h3>
                  <p className="mt-2 text-sm text-gray-700">
                    Review requested course changes and approve the ones you want published.
                  </p>
                </div>

                {course.pendingEdits.map((edit) => (
                  <div key={edit.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">Pending update</p>
                        <p className="mt-2 text-sm text-gray-700">
                          Submitted on {new Date(edit.submittedAt).toLocaleString("en-GB")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApproveEdit(edit.id)}
                        disabled={approvingEditId === edit.id}
                        className="primary-btn disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {approvingEditId === edit.id ? "Approving..." : "Approve Edit"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {user?.role === "admin" ? (
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDeleteCourse}
                  disabled={deletingCourse}
                  className="rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deletingCourse ? "Removing Course..." : "Remove Course"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </SiteLayout>
  );
}

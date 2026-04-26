import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, GraduationCap, ShieldCheck, Star, Users2 } from "lucide-react";
import CourseManagerForm from "../Components/CourseManagerForm";
import { PageHero, SectionHeader, SiteLayout } from "../Components/SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";
import { resolveCourseImage } from "../lib/courseMedia";

function formatPrice(priceCents, currency) {
  return `${(Number(priceCents || 0) / 100).toLocaleString()} ${currency || "EGP"}`;
}

export default function Courses() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canCreateCourse = user?.role === "admin" || (user?.role === "moderator" && user?.moderatorPermissions?.manageCourses);
  const canManageCourses = ["admin", "moderator", "teacher"].includes(user?.role || "");

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      try {
        const coursesPath = canManageCourses ? "/courses?includeDrafts=true" : "/courses";
        const requests = [api.get(coursesPath)];

        if (canManageCourses) {
          requests.push(api.get("/teachers"));
        }

        const [coursesPayload, teachersPayload] = await Promise.all(requests);
        setCourses(coursesPayload.courses);
        setTeachers(teachersPayload?.teachers || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [canManageCourses]);

  const courseStats = useMemo(() => {
    const published = courses.filter((course) => course.published !== false).length;
    const totalSlots = courses.reduce((sum, course) => sum + course.slots.length, 0);
    const availableSeats = courses.reduce(
      (sum, course) => sum + course.slots.reduce((slotSum, slot) => slotSum + slot.availableSeats, 0),
      0,
    );

    return { published, totalSlots, availableSeats };
  }, [courses]);

  async function handleCreateCourse(payload) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post("/courses", payload);
      setCourses((current) => [response.course, ...current]);
      setMessage("Course created and published successfully.");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Courses"
        title="Live courses built to stay clear, practical, and easy to follow."
        description="Students can compare tracks, see every paid option up front, and move into enrollment without digging through clutter."
        actions={
          <>
            <Link to="/signup" className="primary-btn">
              Join edUKai
            </Link>
            {canManageCourses ? (
              <Link to="/dashboard" className="secondary-btn !border-primary !text-primary">
                Open Dashboard
              </Link>
            ) : null}
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-purple-50 p-5">
              <p className="text-sm font-semibold text-purple-700">Published courses</p>
              <p className="mt-2 text-3xl font-extrabold text-text">{courseStats.published}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-5">
              <p className="text-sm font-semibold text-purple-700">Available seats</p>
              <p className="mt-2 text-3xl font-extrabold text-text">{courseStats.availableSeats}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm sm:col-span-2">
              <p className="text-sm font-semibold text-purple-700">Weekly cohorts</p>
              <p className="mt-2 text-3xl font-extrabold text-text">{courseStats.totalSlots}</p>
            </div>
          </div>
        }
      />

      <section className="bg-background px-6 py-14 md:px-12">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Browse the catalog"
            title="Pick a course that fits your goals and your week."
            description="Every course keeps the important details up front: teacher, format, full price, flexible payment plans, class timing, and seat availability."
          />

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[420px] animate-pulse rounded-3xl bg-white shadow-lg" />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => {
                const totalSeats = course.slots.reduce((sum, slot) => sum + slot.availableSeats, 0);
                return (
                  <article key={course.id} className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-lg">
                    <img src={resolveCourseImage(course)} alt={course.title} className="h-52 w-full object-cover" />
                    <div className="flex h-full flex-col p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                            {course.level}
                          </span>
                          <h2 className="mt-4 text-2xl font-bold text-primary">{course.title}</h2>
                        </div>
                        {course.published === false ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Draft
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-4 flex-1 leading-relaxed text-gray-700">{course.summary}</p>

                      <div className="mt-6 grid gap-3 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <GraduationCap size={16} className="text-purple-700" />
                          <span>{course.teacher?.name || "Assigned instructor"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays size={16} className="text-purple-700" />
                          <span>{course.duration} - {course.format}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users2 size={16} className="text-purple-700" />
                          <span>{totalSeats} seats across {course.slots.length} class options</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star size={16} className="text-purple-700" />
                          <span>
                            {course.averageRating ? `${course.averageRating}/5` : "New course"} from {course.ratingCount} rating{course.ratingCount === 1 ? "" : "s"} · {course.joinerCount} joiner{course.joinerCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        <span className="rounded-full bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700">
                          Full payment
                        </span>
                        <span className="rounded-full bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700">
                          {course.depositPercentage || 15}% deposit
                        </span>
                        <span className="rounded-full bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700">
                          3 payments
                        </span>
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-purple-700">Price</p>
                          <p className="mt-1 text-xl font-extrabold text-text">
                            {formatPrice(course.priceCents, course.currency)}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            Start from {formatPrice(course.paymentPlans?.installment?.initialAmountCents || course.depositCents, course.currency)} on the deposit plan.
                          </p>
                        </div>
                        <Link
                          to={`/courses/${course.slug}`}
                          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-secondary"
                        >
                          View Course
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {canCreateCourse ? (
        <section className="bg-background px-6 py-14 md:px-12">
          <div className="mx-auto max-w-7xl rounded-3xl bg-white p-8 shadow-lg md:p-10">
            <SectionHeader
              eyebrow="Admin publishing"
              title={user?.role === "admin" ? "Create a new course" : "Publish a new course"}
              description="Set the course details, connect the instructor, and publish the available class slots in one place."
            />

            {message ? (
              <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
                {message}
              </div>
            ) : null}

            <CourseManagerForm
              teachers={teachers}
              onSubmit={handleCreateCourse}
              submitLabel="Publish Course"
              submitting={saving}
            />
          </div>
        </section>
      ) : null}

      {isAuthenticated && canManageCourses ? (
        <section className="bg-background px-6 pb-16 md:px-12">
          <div className="mx-auto max-w-7xl rounded-3xl bg-white p-8 shadow-lg md:p-10">
            <SectionHeader
              eyebrow="Management"
              title="Staff course controls"
              description="Open any course to update pricing, schedule, description, teacher notes, thumbnails, or pending approvals."
            />

            <div className="grid gap-5 lg:grid-cols-2">
              {courses.map((course) => (
                <div key={course.id} className="flex items-start justify-between gap-4 rounded-2xl border border-purple-100 bg-purple-50 px-5 py-5">
                  <div>
                    <p className="text-lg font-bold text-primary">{course.title}</p>
                    <p className="mt-1 text-sm text-gray-700">
                      {course.teacher?.name || "Instructor"} - {course.duration}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
                        {course.slots.length} slots
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
                        {course.pendingEdits?.length || 0} pending edits
                      </span>
                      {user?.role === "admin" ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
                          <ShieldCheck size={12} className="mr-1 inline" />
                          Admin control
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Link
                    to={`/courses/${course.slug}`}
                    className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-secondary"
                  >
                    Manage
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </SiteLayout>
  );
}

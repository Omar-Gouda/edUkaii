import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Award,
  BellRing,
  CalendarClock,
  GraduationCap,
  Medal,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users2,
} from "lucide-react";
import heroImage from "../assets/images/Hero-img.webp";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";
import { resolveCourseImage } from "../lib/courseMedia";
import { PageHero, SectionHeader, SiteLayout, StatCard, fadeUp } from "../Components/SiteLayout";

const experienceNotes = [
  {
    icon: GraduationCap,
    title: "Readable by default",
    copy: "Pages are calmer, cleaner, and easier to stay inside during long study sessions.",
  },
  {
    icon: BellRing,
    title: "Updates that travel with you",
    copy: "Payments, invitations, messages, and course changes stay visible through account notifications.",
  },
  {
    icon: MessageSquareText,
    title: "Teacher contact without friction",
    copy: "Students and teachers can talk inside the platform instead of relying on phone calls and scattered messages.",
  },
];

function LearningHeroScene() {
  return (
    <div className="grid gap-4">
      <motion.div
        {...fadeUp(0.04)}
        className="overflow-hidden rounded-[28px] border border-purple-100 bg-white shadow-lg"
      >
        <img src={heroImage} alt="Students learning together" className="h-52 w-full object-cover" />
        <div className="grid gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">Today on edUKai</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">Study with more flow and less noise.</p>
            </div>
            <span className="rounded-full bg-purple-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">
              Live now
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="surface-subtle p-4"
            >
              <p className="text-sm font-semibold text-purple-700">Cohort rhythm</p>
              <p className="mt-2 font-bold text-slate-900">Sun, Tue, Thu</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Evening classes with replay access after each session.</p>
            </motion.div>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              className="surface-subtle p-4"
            >
              <p className="text-sm font-semibold text-purple-700">Teacher loop</p>
              <p className="mt-2 font-bold text-slate-900">Chat + feedback</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Teachers can answer questions, start rooms, and keep students aligned.</p>
            </motion.div>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
              className="surface-subtle p-4"
            >
              <p className="text-sm font-semibold text-purple-700">Seat protection</p>
              <p className="mt-2 font-bold text-slate-900">15% deposit</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Students reserve a place before the course opens inside their account.</p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function formatDueDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
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

function PublicHome() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get("/courses").then((payload) => setCourses(payload.courses.slice(0, 4))).catch(() => {});
  }, []);

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Founder-led online learning"
        title="Learning that feels guided from day one."
        description="edUKai brings courses, deposits, meetings, teacher communication, and account updates into one quieter experience so students can focus on learning instead of chasing information."
        actions={
          <>
            <Link to="/signup" className="primary-btn">
              Join edUKai
            </Link>
            <Link to="/courses" className="secondary-btn">
              Explore courses
            </Link>
          </>
        }
        aside={<LearningHeroScene />}
      />

      <section className="px-6 py-6 md:px-12">
        <div className="mx-auto max-w-7xl panel-grid">
          <StatCard label="Course access" value="Deposit first" helper="Students reserve seats with a 15% start" />
          <StatCard label="Teacher contact" value="Built in" helper="Messaging and meeting invites stay inside the platform" />
          <StatCard label="Session clarity" value="Live + replay" helper="Schedules, reminders, and recordings stay together" />
          <StatCard label="Platform tone" value="Calm design" helper="Sharper contrast, easier reading, and matched colors" />
        </div>
      </section>

      <section className="px-6 py-12 md:px-12">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Featured courses"
            title="Choose a course with the important details up front."
            description="Every course now pushes the essentials higher: price, minimum deposit, teacher contact, class rhythm, and the path into enrollment."
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {courses.map((course) => (
              <article key={course.id} className="surface-card flex h-full flex-col overflow-hidden">
                <img src={resolveCourseImage(course)} alt={course.title} className="h-48 w-full object-cover" />
                <div className="flex h-full flex-col p-6">
                  <span className="pill mb-3 w-fit">{course.level}</span>
                  <h3 className="text-2xl font-bold text-primary">{course.title}</h3>
                  <p className="mt-3 flex-1 leading-7 text-slate-600">{course.summary}</p>
                  <div className="mt-5 grid gap-2 text-sm text-slate-500">
                    <span>{course.duration}</span>
                    <span>
                      {(((course.depositCents || Math.ceil((course.priceCents || 0) * 0.15)) / 100)).toLocaleString()} {course.currency} minimum deposit
                    </span>
                  </div>
                  <Link to={`/courses/${course.slug}`} className="primary-btn mt-5">
                    View course
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-purple-100 bg-white/92 p-8 shadow-lg">
          <SectionHeader
            eyebrow="What changed"
            title="A platform experience that feels more like guided learning."
            description="We tuned the interface around clarity first, then layered in the bits that make the day-to-day feel more human."
          />

          <div className="grid gap-5 md:grid-cols-3">
            {experienceNotes.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="surface-subtle p-5">
                <Icon size={20} className="text-primary" />
                <h3 className="mt-4 text-xl font-bold text-primary">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-14 pt-6 md:px-12">
        <div
          className="mx-auto overflow-hidden rounded-[32px] border border-white/50 bg-cover bg-center p-8 text-white shadow-2xl md:p-10"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(var(--brand-strong-rgb), 0.92), rgba(var(--accent-rgb), 0.76)), url(" + heroImage + ")",
          }}
        >
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]">
              <Sparkles size={14} />
              Ready to begin
            </span>
            <h2 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">
              Join the platform, reserve your seat, and start learning with a steadier rhythm.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/85">
              The first step is lighter now: create your account, pick your course, pay the minimum deposit, and let the platform keep your schedule, meetings, and updates together.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5">
                Start your account
                <Rocket size={16} />
              </Link>
              <Link to="/meeting-rooms" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16">
                See how meetings work
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function StudentHighlightsPanel({ homeData }) {
  const latestFeedback = homeData.feedback[0] || null;
  const recognitions = [
    ...homeData.badges.map((badge) => ({
      id: badge.id,
      type: "Badge",
      title: badge.name,
      description: badge.description,
      earnedAt: badge.earnedAt || badge.createdAt || "",
    })),
    ...homeData.certificates.map((certificate) => ({
      id: certificate.id,
      type: "Certificate",
      title: certificate.title,
      description: certificate.description || "Completed training milestone",
      earnedAt: certificate.earnedAt || certificate.createdAt || "",
    })),
  ].sort((left, right) => new Date(right.earnedAt || 0) - new Date(left.earnedAt || 0));
  const latestRecognition = recognitions[0] || null;

  return (
    <div className="grid gap-4">
      <div className="surface-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-purple-700">
            <MessageSquareText size={18} />
            <span className="text-sm font-semibold uppercase tracking-[0.12em]">Teacher feedback</span>
          </div>
          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-primary">
            {homeData.feedback.length} note{homeData.feedback.length === 1 ? "" : "s"}
          </span>
        </div>

        {latestFeedback ? (
          <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-purple-700">{latestFeedback.teacherName}</p>
                <p className="mt-1 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">
                  {latestFeedback.courseTitle}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary">
                {latestFeedback.score}%
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">
              {latestFeedback.comment}
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              {formatDateTime(latestFeedback.createdAt)}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-purple-100 bg-white px-4 py-4 text-sm leading-7 text-slate-600">
            Teacher notes will appear here after your instructors review your work and live sessions.
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface-subtle p-5">
          <div className="flex items-center gap-2 text-purple-700">
            <Medal size={18} />
            <span className="text-sm font-semibold uppercase tracking-[0.12em]">Earned badges</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{homeData.badges.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Badges collected from trainings, challenges, and consistent participation.
          </p>
        </div>

        <div className="surface-subtle p-5">
          <div className="flex items-center gap-2 text-purple-700">
            <Award size={18} />
            <span className="text-sm font-semibold uppercase tracking-[0.12em]">Latest recognition</span>
          </div>
          {latestRecognition ? (
            <>
              <p className="mt-3 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">
                {latestRecognition.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{latestRecognition.description}</p>
              {latestRecognition.earnedAt ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  {latestRecognition.type} earned {formatDateTime(latestRecognition.earnedAt)}
                </p>
              ) : (
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  {latestRecognition.type}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm leading-7 text-slate-600">
              New badges and certificates will appear here as you finish training milestones.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentHome({ user }) {
  const [homeData, setHomeData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/home").then(setHomeData).catch(() => {});
  }, []);

  if (!homeData) {
    return (
      <SiteLayout>
        <section className="px-6 py-20 md:px-12">
          <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-primary">Loading your learning space...</p>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Student home"
        title={`Welcome back, ${user.displayName || user.firstName}`}
        description="Your courses, feedback, rankings, reminders, and earned progress stay close together here."
        aside={<StudentHighlightsPanel homeData={homeData} />}
      />

      <section className="px-6 py-6 md:px-12">
        <div className="mx-auto max-w-7xl panel-grid">
          <StatCard label="Ranking" value={`#${homeData.ranking.position}`} helper={`Out of ${homeData.ranking.totalStudents} students`} />
          <StatCard label="Score" value={`${homeData.ranking.score}%`} helper="Based on teacher feedback" />
          <StatCard label="Certificates" value={String(homeData.certificates.length)} helper="Earned from completed tracks" />
          <StatCard label="Badges" value={String(homeData.badges.length)} helper="Visible on your profile" />
        </div>
      </section>

      <section className="px-6 py-8 md:px-12">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-purple-100 bg-white p-8 shadow-lg">
          <SectionHeader
            eyebrow="Student leaderboard"
            title="See who is climbing this cycle"
            description="Track your place and keep an eye on the students leading the board right now."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {homeData.ranking.leaderboard.map((entry, index) => (
              <div key={entry.userId} className="surface-subtle p-5">
                <p className="text-sm font-semibold text-purple-700">#{index + 1}</p>
                <p className="mt-3 text-lg font-bold text-slate-900">{entry.name}</p>
                <p className="mt-2 text-sm text-slate-600">{entry.score}% feedback score</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-8 md:px-12">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Enrolled courses"
            title="Your current courses"
            description="Track progress, open the course page, and keep your class schedule close."
          />

          {homeData.enrolledCourses.length ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {homeData.enrolledCourses.map((course) => (
                <article key={course.enrollmentId} className="surface-card flex h-full flex-col overflow-hidden">
                  <img src={resolveCourseImage(course)} alt={course.title} className="h-56 w-full object-cover" />
                  <div className="flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-bold text-primary">{course.title}</h3>
                        <p className="mt-2 text-sm font-medium text-slate-600">{course.teacherName}</p>
                      </div>
                      <span className="pill">{course.progress}% progress</span>
                    </div>
                    <p className="mt-4 leading-7 text-slate-600">{course.summary}</p>

                    <div className="surface-subtle mt-5 p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                        <CalendarClock size={16} />
                        <span>{course.schedule?.name}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        {course.schedule?.days.join(", ")} at {course.schedule?.startTime}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{course.schedule?.location}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <a href={course.calendarUrl} className="secondary-btn">
                          Add reminder
                        </a>
                        <Link to={`/courses/${course.slug}`} className="primary-btn">
                          Open course
                        </Link>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <BellRing size={16} className="text-purple-700" />
                        {course.recordings.length} archived recordings
                      </span>
                      {course.remainingCents > 0 && course.remainingDueAt ? (
                        <span className={`inline-flex items-center gap-2 ${course.isPaymentPastDue ? "text-red-600" : "text-slate-600"}`}>
                          {course.isPaymentPastDue ? "Past due" : "Balance due"} on {formatDueDate(course.remainingDueAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="surface-card p-8">
              <p className="text-lg font-bold text-primary">You have not joined a course yet.</p>
              <p className="mt-3 leading-7 text-slate-600">
                Start with the course catalog and your home page will begin tracking class times, reminders, and feedback automatically.
              </p>
              <Link to="/courses" className="primary-btn mt-6">
                Explore courses
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-8 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="surface-card p-8">
            <SectionHeader
              eyebrow="Assignment reminders"
              title="Keep late work from slipping"
              description="Upload unfinished work before the due date to avoid penalties and keep your progress moving."
            />

            <div className="grid gap-4">
              {homeData.assignmentReminders.length ? (
                homeData.assignmentReminders.map((assignment) => (
                  <article
                    key={assignment.assignmentId}
                    className={`rounded-2xl border px-5 py-5 ${
                      assignment.isLate
                        ? "border-red-200 bg-red-50/80"
                        : "border-purple-100 bg-purple-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-purple-700">{assignment.courseTitle}</p>
                        <h3 className="mt-2 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">
                          {assignment.title}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          assignment.isLate ? "bg-white text-red-600" : "bg-white text-primary"
                        }`}
                      >
                        {assignment.isLate ? "Late" : `Due ${formatDueDate(assignment.dueAt)}`}
                      </span>
                    </div>
                    <div className="mt-4 flex items-start gap-3 text-sm leading-7 text-slate-600">
                      <ShieldCheck size={16} className="mt-1 text-purple-700" />
                      <p>{assignment.penaltyNote}</p>
                    </div>
                    <Link to={`/courses/${assignment.courseSlug}`} className="primary-btn mt-5">
                      Open Assignment
                    </Link>
                  </article>
                ))
              ) : (
                <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                  You are clear for now. New assignment deadlines will appear here automatically.
                </div>
              )}
            </div>
          </div>

          <div className="surface-card p-8">
            <SectionHeader
              eyebrow="Classmate notes"
              title="How your classmates describe you"
              description="Profile comments and peer feedback stay visible here so you can see how your learning style lands with the people around you."
            />

            <div className="grid gap-4">
              {[...homeData.profileComments, ...homeData.peerFeedback].slice(0, 6).map((entry) => (
                <article key={entry.id} className="surface-subtle p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-purple-700">
                        {entry.author?.displayName || "Classmate"}
                      </p>
                      <h3 className="mt-2 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">
                        {"courseTitle" in entry ? entry.courseTitle : "Profile note"}
                      </h3>
                    </div>
                    {"score" in entry ? (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary">
                        {entry.score}/5
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">
                    {entry.body}
                  </p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </article>
              ))}

              {!homeData.profileComments.length && !homeData.peerFeedback.length ? (
                <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                  Your classmates have not left profile notes yet.
                </div>
              ) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-purple-100 bg-white px-5 py-5">
              <div className="flex items-center gap-2 text-purple-700">
                <Users2 size={18} />
                <p className="font-semibold text-slate-900">Your classmates</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {homeData.classmates.length ? (
                  homeData.classmates.map((classmate) => (
                    <Link
                      key={classmate.id}
                      to={`/people/${classmate.id}`}
                      className="inline-flex max-w-full items-center rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-primary [overflow-wrap:anywhere]"
                    >
                      {classmate.displayName}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-slate-600">
                    Your active classmates will appear here once you share a live course.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="surface-card p-8">
            <SectionHeader
              eyebrow="Teacher feedback"
              title="Recent comments from your teachers"
              description="Keep track of what they want you to improve, repeat, or keep doing."
            />
            <div className="space-y-4">
              {homeData.feedback.length ? (
                homeData.feedback.map((entry) => (
                  <div key={entry.id} className="surface-subtle p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-purple-700">{entry.teacherName}</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{entry.courseTitle}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary">
                        {entry.score}%
                      </span>
                    </div>
                    <p className="mt-3 leading-7 text-slate-600">{entry.comment}</p>
                  </div>
                ))
              ) : (
                <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                  Teacher comments will appear here after your instructors begin reviewing your class work and progress.
                </div>
              )}
            </div>
          </div>

          <div className="surface-card p-8">
            <SectionHeader
              eyebrow="Recognition"
              title="Your certificates and badges"
              description="Everything you have earned stays visible and easy to revisit."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {homeData.certificates.map((certificate) => (
                <div key={certificate.id} className="surface-subtle p-5">
                  <div className="flex items-center gap-2 text-purple-700">
                    <Award size={18} />
                    <span className="text-sm font-semibold">Certificate</span>
                  </div>
                  <p className="mt-3 text-lg font-bold text-slate-900">{certificate.title}</p>
                  {certificate.earnedAt ? (
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                      Earned {formatDateTime(certificate.earnedAt)}
                    </p>
                  ) : null}
                </div>
              ))}
              {homeData.badges.map((badge) => (
                <div key={badge.id} className="surface-card p-5">
                  <div className="flex items-center gap-2 text-purple-700">
                    <Medal size={18} />
                    <span className="text-sm font-semibold">Badge</span>
                  </div>
                  <p className="mt-3 text-lg font-bold text-slate-900">{badge.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{badge.description}</p>
                  {badge.earnedAt ? (
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                      Earned {formatDateTime(badge.earnedAt)}
                    </p>
                  ) : null}
                </div>
              ))}
              {!homeData.certificates.length && !homeData.badges.length ? (
                <div className="surface-subtle p-5 text-sm leading-7 text-slate-600 sm:col-span-2">
                  Your earned certificates and badges will appear here as you complete milestones and finish courses.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-14 pt-4 md:px-12">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Recommended for you"
            title="Courses you may want next"
            description="These suggestions are based on the courses and learning direction you already chose."
          />

          <div className="grid gap-6 md:grid-cols-3">
            {homeData.suggestions.map((course) => (
              <article key={course.id} className="surface-card flex h-full flex-col overflow-hidden">
                <img src={resolveCourseImage(course)} alt={course.title} className="h-48 w-full object-cover" />
                <div className="flex h-full flex-col p-6">
                  <h3 className="text-2xl font-bold text-primary">{course.title}</h3>
                  <p className="mt-3 flex-1 leading-7 text-slate-600">{course.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <Star size={16} className="text-purple-700" />
                      {course.averageRating ? `${course.averageRating}/5` : "New rating"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Users2 size={16} className="text-purple-700" />
                      {course.joinerCount} joiner{course.joinerCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <Link to={`/courses/${course.slug}`} className="primary-btn mt-5">
                    Explore course
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function RoleHome({ user }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get("/dashboard/summary").then((payload) => setSummary(payload.summary)).catch(() => {});
  }, []);

  return (
    <SiteLayout>
      <PageHero
        eyebrow={`${user.role} home`}
        title={`Welcome back, ${user.displayName || user.firstName}`}
        description="Your main work area is ready, with quick access to the dashboard, courses, and profile."
        actions={
          <>
            <Link to="/dashboard" className="primary-btn">
              Open dashboard
            </Link>
            <Link to="/meeting-rooms" className="secondary-btn">
              Rooms and messages
            </Link>
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="surface-subtle p-5">
              <p className="text-sm font-semibold text-purple-700">Role focus</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary?.title || "Workspace"}</p>
            </div>
            <div className="surface-card p-5">
              <p className="text-sm font-semibold text-purple-700">Fast access</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Messaging, notifications, meetings, and course management are now closer together.</p>
            </div>
          </div>
        }
      />

      {summary ? (
        <section className="px-6 py-12 md:px-12">
          <div className="mx-auto max-w-7xl panel-grid">
            {summary.stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
        </section>
      ) : null}
    </SiteLayout>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated } = useContext(AuthContext);

  if (loading) {
    return (
      <SiteLayout>
        <section className="px-6 py-20 md:px-12">
          <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-primary">Loading edUKai...</p>
          </div>
        </section>
      </SiteLayout>
    );
  }

  if (!isAuthenticated) {
    return <PublicHome />;
  }

  if (user.role === "student") {
    return <StudentHome user={user} />;
  }

  return <RoleHome user={user} />;
}

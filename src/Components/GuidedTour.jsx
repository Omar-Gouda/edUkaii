import { useContext, useEffect, useMemo, useState } from "react";
import { CircleHelp, Compass, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const TOUR_SEEN_KEY = "edukai-tour-seen-v1";
const TOUR_COMPLETE_KEY = "edukai-tour-complete-v1";

function buildSteps(isAuthenticated, user) {
  if (!isAuthenticated) {
    return [
      {
        title: "Start on the home page",
        description: "The landing page explains the rhythm of the platform so new visitors can understand courses, meetings, and platform flow quickly.",
        path: "/",
        actionLabel: "Open home",
      },
      {
        title: "Browse the courses",
        description: "The courses page shows pricing, class timing, and the deposit flow up front so choosing a track feels straightforward.",
        path: "/courses",
        actionLabel: "Open courses",
      },
      {
        title: "Watch the community feed",
        description: "The community page is where updates, study wins, reminders, reactions, and comments stay attached to the same platform.",
        path: "/community",
        actionLabel: "Open community",
      },
      {
        title: "Create your account",
        description: "Sign up as a student to unlock your personal home page, course enrollment, payments, meetings, and profile tools.",
        path: "/signup",
        actionLabel: "Open sign up",
      },
      {
        title: "Meetings live here too",
        description: "Once you are inside a course, meeting rooms keep messages, invites, and classroom spaces together.",
        path: "/meeting-rooms",
        actionLabel: "Open rooms",
      },
    ];
  }

  return [
    {
      title: "Home is your control center",
      description:
        user?.role === "student"
          ? "Your home page keeps enrolled courses, reminders, rankings, and feedback close together."
          : "Your home page points you back into the dashboard, meetings, and the work that matters for your role.",
      path: "/",
      actionLabel: "Open home",
    },
    {
      title: "Courses stay practical",
      description: "Use the courses page to compare tracks, open course details, and move into enrollment or course management without digging.",
      path: "/courses",
      actionLabel: "Open courses",
    },
    {
      title: "The feed is for real activity",
      description: "Use the community feed for announcements, blockers, progress notes, reactions, and quick discussion threads that keep momentum moving.",
      path: "/community",
      actionLabel: "Open community",
    },
    {
      title: "Your dashboard changes by role",
      description:
        user?.role === "student"
          ? "Students use the dashboard area to review progress and platform status."
          : "Admins, moderators, and teachers use the dashboard to manage people, courses, approvals, and day-to-day workflow.",
      path: "/dashboard",
      actionLabel: "Open dashboard",
    },
    {
      title: "Messages and rooms are connected",
      description: "Meeting rooms keep conversations, invites, and live learning spaces inside the same platform instead of splitting them across apps.",
      path: "/meeting-rooms",
      actionLabel: "Open rooms",
    },
    {
      title: "Your profile stays editable",
      description: "Profile settings let you update personal details, avatar, and the information people see when they work with you.",
      path: "/profile-settings",
      actionLabel: "Open profile",
    },
  ];
}

export default function GuidedTour() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(() => buildSteps(isAuthenticated, user), [isAuthenticated, user]);
  const step = steps[stepIndex];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const alreadySeen = window.localStorage.getItem(TOUR_SEEN_KEY) === "1";
    const alreadyCompleted = window.localStorage.getItem(TOUR_COMPLETE_KEY) === "1";

    if (!alreadySeen && !alreadyCompleted) {
      setOpen(true);
      window.localStorage.setItem(TOUR_SEEN_KEY, "1");
    }
  }, []);

  function closeTour() {
    setOpen(false);
  }

  function startTour() {
    setStepIndex(0);
    setOpen(true);
  }

  function finishTour() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOUR_COMPLETE_KEY, "1");
    }

    setOpen(false);
  }

  function moveNext() {
    if (stepIndex >= steps.length - 1) {
      finishTour();
      return;
    }

    setStepIndex((current) => current + 1);
  }

  const isOnStepPage = step?.path === location.pathname;

  return (
    <>
      <button
        type="button"
        onClick={startTour}
        title="Open quick tour"
        aria-label="Open quick tour"
        className="fixed bottom-6 right-6 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-white text-primary shadow-xl shadow-purple-200/70 transition hover:-translate-y-0.5 hover:bg-purple-50"
      >
        <CircleHelp size={20} />
      </button>

      {open && step ? (
        <div className="fixed inset-0 z-[70] bg-slate-900/45 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex min-h-full max-w-2xl items-center">
            <div className="surface-card w-full overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-purple-100 px-6 py-5 sm:px-7">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-primary">
                    <Compass size={20} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-purple-700">Quick tour</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      Step {stepIndex + 1} of {steps.length}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeTour}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-6 sm:px-7">
                <div className="h-2 overflow-hidden rounded-full bg-purple-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                  />
                </div>

                <h3 className="mt-6 text-3xl font-bold text-slate-900">{step.title}</h3>
                <p className="mt-4 text-base leading-8 text-slate-600">{step.description}</p>

                <div className="mt-6 rounded-2xl bg-purple-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  {isOnStepPage
                    ? "You are already on this page. Move to the next step when you are ready."
                    : `Use ${step.actionLabel.toLowerCase()} to jump straight to this part of the website.`}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                      disabled={stepIndex === 0}
                      className="secondary-btn disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(step.path)}
                      disabled={isOnStepPage}
                      className="secondary-btn !border-primary !text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {step.actionLabel}
                    </button>
                  </div>

                  <button type="button" onClick={moveNext} className="primary-btn justify-center">
                    {stepIndex === steps.length - 1 ? "Finish tour" : "Next step"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpenText, CircleCheckBig, Mail, Sparkles } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { EDUKAI_EMAIL_DOMAIN, buildEdUkaiEmail } from "../lib/emailDomain";

const courses = [
  { value: "frontend", label: "Frontend Development" },
  { value: "english", label: "English Language" },
  { value: "interpretation", label: "Simultaneous Interpretation" },
  { value: "hr", label: "Human Resources Management" },
];

const studyPromises = [
  "A cleaner dashboard that stays readable during long sessions.",
  "Founders, teachers, and moderators aligned around student progress.",
  "Notifications, class reminders, and course access in one place.",
];

export default function RegisterationForm() {
  const navigate = useNavigate();
  const { register } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    emailLocalPart: "",
    password: "",
    phone: "",
    course: "",
    education: "",
    goals: "",
    experience: "",
    agree: false,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: buildEdUkaiEmail(formData.emailLocalPart),
        password: formData.password,
        phone: formData.phone,
        course: formData.course,
        education: formData.education,
        goals: formData.goals,
        experience: formData.experience,
      });
      navigate("/");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="px-4 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.94fr_1.06fr] lg:items-start">
        <div className="surface-card overflow-hidden p-8 sm:p-10">
          <div className="eyebrow">
            <Sparkles size={14} />
            Student onboarding
          </div>
          <h1 className="hero-title mt-6 text-[var(--text)]">Create your learning account with a calmer start.</h1>
          <p className="muted-copy mt-5 max-w-xl text-lg leading-8">
            We keep the signup flow focused on the details that matter: your learning direction, your study rhythm, and the email identity you will keep across the platform.
          </p>

          <div className="mt-8 grid gap-4">
            {studyPromises.map((promise) => (
              <div key={promise} className="surface-subtle flex items-start gap-3 p-4">
                <CircleCheckBig size={18} className="mt-0.5 text-primary" />
                <p className="text-sm leading-6 text-slate-700">{promise}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-purple-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-primary">
              <Mail size={18} />
              <p className="font-semibold">edUKai email format</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Every new student account is created under <strong>@{EDUKAI_EMAIL_DOMAIN}</strong> so records, payments, meetings, and support follow the same identity.
            </p>
            <div className="mt-4 rounded-2xl bg-purple-50 px-4 py-4 text-sm font-semibold text-primary">
              Example: yourname@{EDUKAI_EMAIL_DOMAIN}
            </div>
          </div>
        </div>

        <div className="shell-card p-8 sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">Join edUKai</p>
            <h2 className="mt-3 text-3xl font-bold text-primary">Set up your account</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tell us where you want to grow and we will shape your course path around it.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                First name
                <input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  placeholder="Omar"
                  className="px-4 py-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Last name
                <input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  placeholder="G."
                  className="px-4 py-3"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Email username
              <div className="field-shell">
                <input
                  name="emailLocalPart"
                  value={formData.emailLocalPart}
                  onChange={handleChange}
                  required
                  placeholder="yourname"
                  className="min-w-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus:border-0 focus:shadow-none"
                />
                <span className="whitespace-nowrap rounded-full bg-purple-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  @{EDUKAI_EMAIL_DOMAIN}
                </span>
              </div>
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Password
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Create a strong password"
                  className="px-4 py-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Phone number
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="0100 000 0000"
                  className="px-4 py-3"
                />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Course of interest
                <select
                  name="course"
                  value={formData.course}
                  onChange={handleChange}
                  required
                  className="px-4 py-3"
                >
                  <option value="">Choose a track</option>
                  {courses.map((course) => (
                    <option key={course.value} value={course.value}>
                      {course.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Education level
                <select
                  name="education"
                  value={formData.education}
                  onChange={handleChange}
                  required
                  className="px-4 py-3"
                >
                  <option value="">Choose your level</option>
                  <option value="High School">High School</option>
                  <option value="Bachelor's Degree">Bachelor&apos;s Degree</option>
                  <option value="Master's Degree">Master&apos;s Degree</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Learning goals
              <textarea
                name="goals"
                rows="4"
                value={formData.goals}
                onChange={handleChange}
                placeholder="Tell us what you want this learning season to unlock for you."
                className="px-4 py-3"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Previous experience
              <textarea
                name="experience"
                rows="4"
                value={formData.experience}
                onChange={handleChange}
                placeholder="Share the tools, topics, or study experience you already have."
                className="px-4 py-3"
              />
            </label>

            <label className="surface-subtle flex items-center gap-3 px-4 py-4 text-sm text-slate-700">
              <input
                type="checkbox"
                name="agree"
                checked={formData.agree}
                onChange={handleChange}
                required
                className="h-5 w-5 rounded border-purple-200 accent-primary"
              />
              <span>
                I agree to the platform terms and understand that course access is activated after payment confirmation.
              </span>
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="primary-btn disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Creating account..." : "Create student account"}
                <ArrowRight size={16} />
              </button>
              <Link to="/signin" className="secondary-btn">
                I already have an account
              </Link>
            </div>
          </form>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-dashed border-purple-100 bg-purple-50 px-4 py-4 text-sm text-slate-600">
            <BookOpenText size={18} className="text-primary" />
            Your course choice only shapes your first recommendation. You can still explore the full catalog after joining.
          </div>
        </div>
      </div>
    </section>
  );
}

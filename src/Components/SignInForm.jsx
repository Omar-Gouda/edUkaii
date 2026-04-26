import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { EDUKAI_EMAIL_DOMAIN, buildEdUkaiEmail, stripEdUkaiDomain } from "../lib/emailDomain";

export default function SignInForm() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    emailLocalPart: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login({
        email: buildEdUkaiEmail(formData.emailLocalPart),
        password: formData.password,
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
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <motion.div
          className="surface-card overflow-hidden p-8 sm:p-10"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="eyebrow">
            <Sparkles size={14} />
            Account access
          </div>
          <h1 className="hero-title mt-6 text-[var(--text)]">Welcome back to your learning rhythm.</h1>
          <p className="muted-copy mt-5 text-lg leading-8">
            Sign in and pick up your classes, payment updates, meetings, messages, and progress without having to dig around the platform.
          </p>

          <div className="mt-8 grid gap-4">
            <div className="surface-subtle flex items-start gap-3 p-4">
              <ShieldCheck size={18} className="mt-0.5 text-primary" />
              <div>
                <p className="font-semibold text-slate-900">Secure course access</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Your enrollments, deposits, meeting invites, and chat history stay attached to the same account.
                </p>
              </div>
            </div>
            <div className="surface-subtle flex items-start gap-3 p-4">
              <Mail size={18} className="mt-0.5 text-primary" />
              <div>
                <p className="font-semibold text-slate-900">edUKai email identity</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Sign in with your username and we will route it through <strong>@{EDUKAI_EMAIL_DOMAIN}</strong>.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="shell-card p-8 sm:p-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">Sign in</p>
            <h2 className="mt-3 text-3xl font-bold text-primary">Open your account</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Enter your edUKai username and password to continue into the platform.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Email username
              <div className="field-shell">
                <input
                  type="text"
                  name="emailLocalPart"
                  value={stripEdUkaiDomain(formData.emailLocalPart)}
                  onChange={handleChange}
                  placeholder="yourname"
                  required
                  className="min-w-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus:border-0 focus:shadow-none"
                />
                <span className="whitespace-nowrap rounded-full bg-purple-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  @{EDUKAI_EMAIL_DOMAIN}
                </span>
              </div>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Password
              <div className="field-shell">
                <KeyRound size={16} className="text-primary" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  className="min-w-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus:border-0 focus:shadow-none"
                />
              </div>
            </label>

            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Course access and notifications stay linked to this login.</span>
              <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={submitting} className="primary-btn w-full disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? "Signing in..." : "Continue to edUKai"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Need an account?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Create one
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

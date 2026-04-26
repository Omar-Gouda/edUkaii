import { motion } from "framer-motion";
import Header from "./Header";
import Footer from "./Footer";
import GuidedTour from "./GuidedTour";

export function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 28 },
    whileInView: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: "easeOut", delay },
    },
    viewport: { once: true, amount: 0.2 },
  };
}

export function SiteLayout({ children }) {
  return (
    <div className="page-shell min-h-screen text-slate-900">
      <Header />
      <main className="relative z-10">{children}</main>
      <GuidedTour />
      <Footer />
    </div>
  );
}

export function PageHero({ eyebrow, title, description, actions, aside }) {
  return (
    <section className="section-band px-5 pb-14 pt-10 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.14fr_0.86fr] lg:items-center">
        <motion.div {...fadeUp()} className="relative">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1 className="hero-title mt-5 max-w-4xl text-[var(--text)] [overflow-wrap:anywhere]">{title}</h1>
          <p className="muted-copy mt-5 max-w-2xl text-lg leading-8">{description}</p>
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </motion.div>
        {aside ? (
          <motion.div {...fadeUp(0.08)} className="shell-card p-6 sm:p-7">
            {aside}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}

export function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="mb-8 max-w-3xl">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2 className="section-title mt-4 text-[var(--text)]">{title}</h2>
      {description ? <p className="muted-copy mt-3 text-lg leading-8">{description}</p> : null}
    </div>
  );
}

export function StatCard({ label, value, helper }) {
  return (
    <div className="surface-card p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-extrabold text-slate-900">{value}</p>
      {helper ? <p className="muted-copy mt-2 text-sm">{helper}</p> : null}
    </div>
  );
}

export function BulletList({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <span className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

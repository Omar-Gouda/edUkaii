import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="relative z-10 mt-12 overflow-hidden border-t border-purple-100 bg-[linear-gradient(180deg,rgba(124,58,237,0.06),rgba(255,255,255,0.84))]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-70" />
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr_0.9fr] lg:px-12">
        <div>
          <p className="text-lg font-extrabold text-primary">edUKai</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">
            Practical learning, steady mentorship, and cleaner student journeys built around confidence, clarity, and real progress.
          </p>
        </div>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Platform</p>
          <div className="mt-4 flex flex-col gap-3 text-sm font-semibold text-slate-700">
            <Link to="/courses">Courses</Link>
            <Link to="/teachers">Instructors</Link>
            <Link to="/meeting-rooms">Meeting Rooms</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Company</p>
          <div className="mt-4 flex flex-col gap-3 text-sm font-semibold text-slate-700">
            <Link to="/about">About</Link>
            <Link to="/careers">Careers</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/signup">Register</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

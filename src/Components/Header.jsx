import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, LayoutDashboard, LogOut, Menu, MoonStar, Settings, Shield, SunMedium, UserCircle2, X } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";

const courseLinks = [
  { label: "All Courses", to: "/courses" },
  { label: "Frontend Development", to: "/courses/frontend" },
  { label: "English Language", to: "/courses/english" },
  { label: "Simultaneous Interpretation", to: "/courses/interpretation" },
  { label: "Human Resources Management", to: "/courses/hr" },
];

const aboutLinks = [
  { label: "About Us", to: "/about" },
  { label: "Our Instructors", to: "/teachers" },
  { label: "Careers", to: "/careers" },
  { label: "Contact Us", to: "/contact" },
];

function linkClass({ isActive }) {
  return `inline-flex items-center whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition ${
    isActive ? "bg-purple-50 text-primary" : "text-text hover:bg-purple-50 hover:text-primary"
  }`;
}

function Dropdown({ label, items }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-text transition hover:bg-purple-50 hover:text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown size={16} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 top-full mt-3 w-64 rounded-xl border border-purple-100 bg-white p-2 shadow-lg"
          >
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block rounded-lg px-3 py-2 text-sm text-text transition hover:bg-purple-50 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function getInitials(user) {
  const source = user?.displayName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Profile";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, isAuthenticated, logout } = useContext(AuthContext);
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const accountMenuRef = useRef(null);
  const canOpenAdminPanel = user?.role === "admin" || user?.role === "moderator";

  const navLinks = useMemo(
    () => [
      { label: isAuthenticated ? "My Home" : "Home", to: "/" },
      { label: "Community", to: "/community" },
      { label: "Meeting Rooms", to: "/meeting-rooms" },
    ],
    [isAuthenticated],
  );

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    }

    if (!accountOpen) {
      return undefined;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [accountOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-purple-100 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-12">
        <div className="flex min-w-0 flex-1 items-center gap-5 xl:gap-6">
          <Link to="/" className="group flex items-center gap-3 transition">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-100 bg-white text-lg font-bold text-primary shadow-sm transition group-hover:-translate-y-0.5">
              eK
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-bold tracking-[0.08em] text-primary">edUKai</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Learn With Rhythm
              </span>
            </span>
          </Link>
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
            {navLinks.map((item) => (
              <NavLink key={item.to} className={linkClass} to={item.to}>
                {item.label}
              </NavLink>
            ))}
            <Dropdown label="Courses" items={courseLinks} />
            <Dropdown label="About" items={aboutLinks} />
          </nav>
        </div>

        <div className="hidden flex-shrink-0 items-center gap-2.5 xl:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-100 bg-white text-primary shadow-sm transition hover:border-purple-200 hover:bg-purple-50"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? <SunMedium size={18} /> : <MoonStar size={18} />}
          </button>
          <NotificationBell />
          {isAuthenticated ? (
            <div className="flex items-center gap-3" ref={accountMenuRef}>
              <Link to="/dashboard" className="secondary-btn hidden whitespace-nowrap !border-primary !text-primary 2xl:inline-flex">
                Dashboard
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((value) => !value)}
                  className="inline-flex items-center gap-3 rounded-2xl border border-purple-100 bg-white px-3 py-2 text-left shadow-sm transition hover:border-purple-200 hover:bg-purple-50"
                  aria-expanded={accountOpen}
                  aria-label="Open account menu"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-sm font-bold text-primary">
                    {getInitials(user)}
                  </span>
                  <span className="hidden min-w-0 min-[1340px]:block">
                    <span className="block max-w-[8.5rem] truncate text-sm font-semibold text-slate-900">
                      {user?.displayName || "Profile"}
                    </span>
                    <span className="block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      {user?.role || "Member"}
                    </span>
                  </span>
                  <ChevronDown size={16} className={`text-slate-500 transition ${accountOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {accountOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute right-0 top-full mt-3 w-64 rounded-3xl border border-purple-100 bg-white/96 p-3 shadow-2xl backdrop-blur"
                    >
                      <div className="rounded-2xl bg-purple-50 px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">{user?.displayName || "Profile"}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-purple-700">{user?.role || "Member"}</p>
                      </div>
                      <div className="mt-3 grid gap-1.5">
                        <Link
                          to="/"
                          className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-purple-50 hover:text-primary"
                        >
                          <UserCircle2 size={16} />
                          My Home
                        </Link>
                        <Link
                          to="/dashboard"
                          className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-purple-50 hover:text-primary"
                        >
                          <LayoutDashboard size={16} />
                          Dashboard
                        </Link>
                        {canOpenAdminPanel ? (
                          <Link
                            to="/admin-panel"
                            className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-purple-50 hover:text-primary"
                          >
                            <Shield size={16} />
                            Admin Panel
                          </Link>
                        ) : null}
                        <Link
                          to={`/people/${user?.id}?preview=public`}
                          className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-purple-50 hover:text-primary"
                        >
                          <UserCircle2 size={16} />
                          Profile Preview
                        </Link>
                        <Link
                          to="/profile-settings"
                          className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-purple-50 hover:text-primary"
                        >
                          <Settings size={16} />
                          Profile Settings
                        </Link>
                        <button
                          type="button"
                          onClick={logout}
                          className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-purple-50 hover:text-primary"
                        >
                          <LogOut size={16} />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <>
              <Link to="/signup" className="primary-btn">
                Join edUKai
              </Link>
              <Link to="/signin" className="secondary-btn !border-primary !text-primary">
                Sign In
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex rounded-md border border-purple-100 bg-white p-3 text-primary xl:hidden"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border-t border-purple-100 bg-white xl:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 sm:px-8">
              {[...navLinks, ...courseLinks, ...aboutLinks].map((item) => (
                <Link
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${
                    location.pathname === item.to ? "bg-purple-50 text-primary" : "text-text"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2">
                <div className="pb-1">
                  <NotificationBell />
                </div>
                <button type="button" onClick={toggleTheme} className="secondary-btn !border-primary !text-primary">
                  {isDark ? "Use Light Theme" : "Use Dark Theme"}
                </button>
                {isAuthenticated ? (
                  <>
                    <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="secondary-btn !border-primary !text-primary">
                      Dashboard
                    </Link>
                    {canOpenAdminPanel ? (
                      <Link to="/admin-panel" onClick={() => setMobileOpen(false)} className="secondary-btn !border-primary !text-primary">
                        Admin Panel
                      </Link>
                    ) : null}
                    <Link
                      to={`/people/${user?.id}?preview=public`}
                      onClick={() => setMobileOpen(false)}
                      className="secondary-btn !border-primary !text-primary"
                    >
                      Profile Preview
                    </Link>
                    <Link to="/profile-settings" onClick={() => setMobileOpen(false)} className="secondary-btn !border-primary !text-primary">
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        setMobileOpen(false);
                      }}
                      className="secondary-btn !border-primary !text-primary"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/signup" onClick={() => setMobileOpen(false)} className="primary-btn">
                      Join edUKai
                    </Link>
                    <Link to="/signin" onClick={() => setMobileOpen(false)} className="secondary-btn !border-primary !text-primary">
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

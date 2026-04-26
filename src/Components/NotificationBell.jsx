import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Dot, ExternalLink } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";

function formatRelativeTime(value) {
  const date = new Date(value);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationBell() {
  const location = useLocation();
  const { isAuthenticated } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);

    try {
      const payload = await api.get("/notifications");
      setNotifications(payload.notifications || []);
      setUnreadCount(payload.unreadCount || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    loadNotifications();
  }, [isAuthenticated, loadNotifications]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, loadNotifications]);

  const visibleNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);

  async function handleReadAll() {
    try {
      await api.post("/notifications/read-all", {});
      setNotifications((current) => current.map((entry) => ({ ...entry, read: true })));
      setUnreadCount(0);
    } catch {
      return;
    }
  }

  async function handleReadOne(notificationId) {
    try {
      await api.post(`/notifications/${notificationId}/read`, {});
      setNotifications((current) =>
        current.map((entry) => (entry.id === notificationId ? { ...entry, read: true } : entry)),
      );
      setUnreadCount((current) => Math.max(current - 1, 0));
    } catch {
      return;
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) {
            loadNotifications();
          }
        }}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-purple-100 bg-white/90 text-primary transition hover:bg-purple-50"
        aria-label="Open notifications"
      >
        <Bell size={18} />
        {unreadCount ? (
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-slate-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="absolute right-0 top-full mt-3 w-[min(92vw,24rem)] rounded-3xl border border-purple-100 bg-white/96 p-4 shadow-2xl backdrop-blur"
          >
            <div className="flex items-center justify-between gap-4 border-b border-purple-100 pb-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">Notifications</p>
                <p className="mt-1 text-sm text-slate-500">Updates about payments, meetings, and messages.</p>
              </div>
              <button
                type="button"
                onClick={handleReadAll}
                className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-purple-100"
              >
                <CheckCheck size={14} />
                Read all
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              {loading ? (
                <div className="rounded-2xl bg-purple-50 px-4 py-5 text-sm text-slate-600">Loading updates...</div>
              ) : visibleNotifications.length ? (
                visibleNotifications.map((notification) => {
                  const content = (
                    <div
                      className={`rounded-2xl border px-4 py-4 transition ${
                        notification.read
                          ? "border-purple-100 bg-white"
                          : "border-purple-100 bg-purple-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {!notification.read ? <Dot size={18} className="text-[var(--accent)]" /> : null}
                            <p className="font-semibold text-slate-900">{notification.title}</p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                        </div>
                        {!notification.read ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleReadOne(notification.id);
                            }}
                            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm"
                          >
                            Read
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>{formatRelativeTime(notification.createdAt)}</span>
                        {notification.link ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-primary">
                            Open
                            <ExternalLink size={12} />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );

                  return notification.link ? (
                    <Link
                      key={notification.id}
                      to={notification.link}
                      onClick={() => {
                        if (!notification.read) {
                          handleReadOne(notification.id);
                        }
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={notification.id}>{content}</div>
                  );
                })
              ) : (
                <div className="rounded-2xl bg-purple-50 px-4 py-5 text-sm text-slate-600">
                  You are all caught up for now.
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

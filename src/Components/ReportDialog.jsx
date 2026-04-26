import { Flag, X } from "lucide-react";

export default function ReportDialog({
  open,
  title,
  description,
  reason,
  error = "",
  loading = false,
  onChangeReason,
  onClose,
  onSubmit,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-purple-700">
              <Flag size={14} />
              Report
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Close report dialog"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-6 grid gap-4"
        >
          <label className="grid gap-2 text-sm font-semibold text-text">
            Tell the moderation team what is wrong
            <textarea
              rows={5}
              value={reason}
              onChange={(event) => onChangeReason(event.target.value)}
              placeholder="Briefly explain the issue so admins and moderators can review it."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="secondary-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading || !reason.trim()} className="primary-btn disabled:opacity-70">
              {loading ? "Sending..." : "Send Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

const CATEGORY_OPTIONS = [
  { value: "technology", label: "Technology" },
  { value: "language", label: "Language" },
  { value: "business", label: "Business" },
];

const LEVEL_OPTIONS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Beginner - Intermediate",
  "All Levels",
];

function nextId() {
  return globalThis.crypto?.randomUUID?.() || `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function joinLines(items = []) {
  return items.join("\n");
}

function splitList(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildInitialSlot(slot = {}) {
  return {
    id: slot.id || nextId(),
    name: slot.name || "",
    daysText: (slot.days || []).join(", "),
    startTime: slot.startTime || "18:00",
    durationMinutes: String(slot.durationMinutes || 90),
    capacity: String(slot.capacity || 20),
    location: slot.location || "Online Classroom",
  };
}

function buildInitialState(course) {
  if (!course) {
    return {
      title: "",
      summary: "",
      description: "",
      brief: "",
      duration: "6 Weeks",
      level: "Beginner",
      priceCents: "",
      format: "Live classes + replay library",
      category: "technology",
      teacherId: "",
      published: true,
      audienceText: "",
      outcomesText: "",
      modulesText: "",
      thumbnail: null,
      slots: [buildInitialSlot()],
    };
  }

  return {
    title: course.title || "",
    summary: course.summary || "",
    description: course.description || "",
    brief: course.brief || "",
    duration: course.duration || "6 Weeks",
    level: course.level || "Beginner",
    priceCents: course.priceCents != null ? String(course.priceCents) : "",
    format: course.format || "Live classes + replay library",
    category: course.category || "technology",
    teacherId: course.teacher?.id || course.teacherId || "",
    published: course.published ?? true,
    audienceText: joinLines(course.audience),
    outcomesText: joinLines(course.outcomes),
    modulesText: joinLines(course.modules),
    thumbnail: null,
    slots: (course.slots || []).length ? course.slots.map(buildInitialSlot) : [buildInitialSlot()],
  };
}

function buildPayload(state) {
  const payload = new FormData();
  payload.append("title", state.title);
  payload.append("summary", state.summary);
  payload.append("description", state.description);
  payload.append("brief", state.brief);
  payload.append("duration", state.duration);
  payload.append("level", state.level);
  payload.append("priceCents", state.priceCents || "0");
  payload.append("format", state.format);
  payload.append("category", state.category);
  payload.append("teacherId", state.teacherId);
  payload.append("published", String(state.published));
  payload.append("audience", JSON.stringify(splitList(state.audienceText)));
  payload.append("outcomes", JSON.stringify(splitList(state.outcomesText)));
  payload.append("modules", JSON.stringify(splitList(state.modulesText)));
  payload.append(
    "slots",
    JSON.stringify(
      state.slots.map((slot) => ({
        id: slot.id,
        name: slot.name,
        days: splitList(slot.daysText),
        startTime: slot.startTime,
        durationMinutes: Number(slot.durationMinutes || 90),
        capacity: Number(slot.capacity || 20),
        location: slot.location,
      })),
    ),
  );

  if (state.thumbnail instanceof File) {
    payload.append("thumbnail", state.thumbnail);
  }

  return payload;
}

export default function CourseManagerForm({
  initialCourse = null,
  teachers = [],
  onSubmit,
  submitLabel,
  submitting = false,
  disabled = false,
}) {
  const [form, setForm] = useState(() => buildInitialState(initialCourse));

  useEffect(() => {
    setForm(buildInitialState(initialCourse));
  }, [initialCourse]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function setSlotField(slotId, name, value) {
    setForm((current) => ({
      ...current,
      slots: current.slots.map((slot) => (slot.id === slotId ? { ...slot, [name]: value } : slot)),
    }));
  }

  function addSlot() {
    setForm((current) => ({
      ...current,
      slots: [...current.slots, buildInitialSlot()],
    }));
  }

  function removeSlot(slotId) {
    setForm((current) => ({
      ...current,
      slots: current.slots.length === 1
        ? current.slots
        : current.slots.filter((slot) => slot.id !== slotId),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit(buildPayload(form));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-text">
          Course title
          <input
            value={form.title}
            onChange={(event) => setField("title", event.target.value)}
            required
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Teacher
          <select
            value={form.teacherId}
            onChange={(event) => setField("teacherId", event.target.value)}
            required
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          >
            <option value="">Select teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Summary
          <textarea
            value={form.summary}
            onChange={(event) => setField("summary", event.target.value)}
            required
            rows={4}
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Description
          <textarea
            value={form.description}
            onChange={(event) => setField("description", event.target.value)}
            required
            rows={4}
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text lg:col-span-2">
          Teacher brief
          <textarea
            value={form.brief}
            onChange={(event) => setField("brief", event.target.value)}
            rows={4}
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold text-text">
          Duration
          <input
            value={form.duration}
            onChange={(event) => setField("duration", event.target.value)}
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Level
          <select
            value={form.level}
            onChange={(event) => setField("level", event.target.value)}
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          >
            {LEVEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Price in piastres
          <input
            type="number"
            min="0"
            value={form.priceCents}
            onChange={(event) => setField("priceCents", event.target.value)}
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Format
          <input
            value={form.format}
            onChange={(event) => setField("format", event.target.value)}
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-text">
          Category
          <select
            value={form.category}
            onChange={(event) => setField("category", event.target.value)}
            disabled={disabled || submitting}
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Thumbnail
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setField("thumbnail", event.target.files?.[0] || null)}
            disabled={disabled || submitting}
            className="rounded-xl border border-dashed border-purple-200 bg-white px-4 py-3 text-sm text-text outline-none"
          />
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-purple-100 bg-white px-5 py-4 text-sm font-semibold text-text">
          <span>Published on the website</span>
          <input
            type="checkbox"
            checked={form.published}
            onChange={(event) => setField("published", event.target.checked)}
            disabled={disabled || submitting}
            className="h-5 w-5 rounded border-purple-200 accent-primary"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-text">
          Audience
          <textarea
            value={form.audienceText}
            onChange={(event) => setField("audienceText", event.target.value)}
            rows={5}
            disabled={disabled || submitting}
            placeholder="One item per line"
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Outcomes
          <textarea
            value={form.outcomesText}
            onChange={(event) => setField("outcomesText", event.target.value)}
            rows={5}
            disabled={disabled || submitting}
            placeholder="One item per line"
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-text">
          Modules
          <textarea
            value={form.modulesText}
            onChange={(event) => setField("modulesText", event.target.value)}
            rows={5}
            disabled={disabled || submitting}
            placeholder="One item per line"
            className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-primary">Class slots</h3>
            <p className="mt-1 text-sm text-gray-600">Create the weekly options students can join.</p>
          </div>
          <button
            type="button"
            onClick={addSlot}
            disabled={disabled || submitting}
            className="secondary-btn !border-primary !text-primary"
          >
            Add Slot
          </button>
        </div>

        {form.slots.map((slot, index) => (
          <div key={slot.id} className="grid gap-4 rounded-2xl border border-purple-100 bg-white px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold uppercase tracking-[0.08em] text-purple-700">
                Slot {index + 1}
              </p>
              {form.slots.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeSlot(slot.id)}
                  disabled={disabled || submitting}
                  className="text-sm font-semibold text-red-600 transition hover:text-red-700"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-text">
                Slot name
                <input
                  value={slot.name}
                  onChange={(event) => setSlotField(slot.id, "name", event.target.value)}
                  required
                  disabled={disabled || submitting}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text">
                Days
                <input
                  value={slot.daysText}
                  onChange={(event) => setSlotField(slot.id, "daysText", event.target.value)}
                  placeholder="Sunday, Tuesday, Thursday"
                  required
                  disabled={disabled || submitting}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text">
                Start time
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(event) => setSlotField(slot.id, "startTime", event.target.value)}
                  required
                  disabled={disabled || submitting}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text">
                Duration in minutes
                <input
                  type="number"
                  min="30"
                  step="15"
                  value={slot.durationMinutes}
                  onChange={(event) => setSlotField(slot.id, "durationMinutes", event.target.value)}
                  required
                  disabled={disabled || submitting}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text">
                Capacity
                <input
                  type="number"
                  min="1"
                  value={slot.capacity}
                  onChange={(event) => setSlotField(slot.id, "capacity", event.target.value)}
                  required
                  disabled={disabled || submitting}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text">
                Location
                <input
                  value={slot.location}
                  onChange={(event) => setSlotField(slot.id, "location", event.target.value)}
                  required
                  disabled={disabled || submitting}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled || submitting}
          className="primary-btn disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

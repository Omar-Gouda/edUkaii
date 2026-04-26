import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Camera,
  Clock3,
  Lock,
  MessageSquareMore,
  MonitorPlay,
  Send,
  Users,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHero, SectionHeader, SiteLayout, StatCard } from "../Components/SiteLayout";

const roomRules = [
  {
    icon: Clock3,
    title: "Scheduled launch",
    copy: "Classroom spaces are tied to real class times so students know exactly when their lesson room opens.",
  },
  {
    icon: Camera,
    title: "Video first",
    copy: "Rooms now generate joinable video sessions so teachers, moderators, and admins can actually start calls from inside the platform flow.",
  },
  {
    icon: Lock,
    title: "Invite-aware access",
    copy: "Private rooms, classrooms, and crew sessions only surface to the people who were invited or are allowed to host.",
  },
  {
    icon: MessageSquareMore,
    title: "Message before meeting",
    copy: "Teachers and students can talk inside the same workspace before they ever need to jump into a call.",
  },
];

function formatTimestamp(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PublicRoomsExperience() {
  return (
    <>
      <section id="classrooms" className="px-6 py-14 md:px-12">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Room types"
            title="Spaces built around real sessions"
            description="Students, teachers, moderators, and admins each get room types that match the way they meet inside the platform."
          />

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Classroom room",
                description: "Live lesson room with invite-based video access, waiting-room chat, and class continuity from one place.",
                status: "Teacher or staff started",
              },
              {
                title: "Private 1:1 room",
                description: "Teacher and student only, with follow-up handled through direct messages before or after the call.",
                status: "Invite only",
              },
              {
                title: "Leadership conference",
                description: "Admin, moderators, and teachers can coordinate hiring, incidents, and platform planning in one crew room.",
                status: "Crew access",
              },
            ].map((room) => (
              <article key={room.title} className="surface-card p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-primary">
                  <Users size={20} />
                </div>
                <h3 className="mt-5 text-2xl font-bold text-primary">{room.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{room.description}</p>
                <span className="mt-5 inline-flex rounded-full bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700">
                  {room.status}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Room standards"
            title="Clear rules that keep the experience smooth"
            description="Students should know what to expect before they join, whether they are opening a classroom or entering a private session."
          />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {roomRules.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="surface-card p-8">
                <Icon className="text-primary" size={22} />
                <h3 className="mt-5 text-xl font-bold text-primary">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] border border-purple-100 bg-[linear-gradient(125deg,rgba(124,58,237,0.96),rgba(91,33,182,0.88))] p-8 text-white shadow-2xl">
            <div className="flex items-center gap-3 text-white/90">
              <MonitorPlay size={20} />
              <h3 className="text-2xl font-bold">Class replay flow</h3>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82">
              After a class ends, students can return to the course space to revisit the replay, continue the classroom chat, and keep the learning context inside the platform.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-primary transition hover:-translate-y-0.5">
                Create an account
              </Link>
              <Link to="/courses" className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
                Explore courses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function MeetingsRooms() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [options, setOptions] = useState({
    canHost: false,
    hostCapabilities: { classroom: false, private: false, crew: false },
    contacts: [],
    courses: [],
  });
  const [meetings, setMeetings] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [startingMeeting, setStartingMeeting] = useState(false);
  const [endingMeetingId, setEndingMeetingId] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [meetingForm, setMeetingForm] = useState({
    type: "classroom",
    title: "",
    courseId: "",
    slotId: "",
    inviteeIds: [],
  });
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messageError, setMessageError] = useState("");
  const [meetingError, setMeetingError] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState("");

  const availableSlots = useMemo(
    () => options.courses.find((course) => course.id === meetingForm.courseId)?.slots || [],
    [meetingForm.courseId, options.courses],
  );

  const unreadConversationCount = useMemo(
    () => conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0),
    [conversations],
  );

  const availableMeetingTypes = useMemo(() => {
    const types = [];

    if (options.hostCapabilities?.classroom) {
      types.push({ value: "classroom", label: "Classroom" });
    }

    if (options.hostCapabilities?.private) {
      types.push({ value: "private", label: "Private 1:1" });
    }

    if (options.hostCapabilities?.crew) {
      types.push({ value: "crew", label: "Crew room" });
    }

    return types;
  }, [options.hostCapabilities]);

  const loadWorkspace = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setLoadingWorkspace(true);
    setMeetingError("");

    try {
      const [optionsPayload, meetingsPayload, conversationsPayload] = await Promise.all([
        api.get("/meetings/options"),
        api.get("/meetings"),
        api.get("/chat/conversations"),
      ]);

      setOptions(optionsPayload);
      setMeetings(meetingsPayload.meetings || []);
      setConversations(conversationsPayload.conversations || []);
      setMeetingForm((current) => ({
        ...current,
        courseId: current.courseId || optionsPayload.courses?.[0]?.id || "",
        slotId: current.slotId || optionsPayload.courses?.[0]?.slots?.[0]?.id || "",
        type:
          current.type && optionsPayload.hostCapabilities?.[current.type]
            ? current.type
            : optionsPayload.hostCapabilities?.classroom
              ? "classroom"
              : optionsPayload.hostCapabilities?.private
                ? "private"
                : optionsPayload.hostCapabilities?.crew
                  ? "crew"
                  : current.type,
      }));
    } catch (error) {
      setMeetingError(error.message);
    } finally {
      setLoadingWorkspace(false);
    }
  }, [isAuthenticated]);

  const loadConversation = useCallback(async (conversationId) => {
    if (!conversationId) {
      setSelectedConversation(null);
      setMessages([]);
      return;
    }

    try {
      const payload = await api.get(`/chat/conversations/${conversationId}`);
      setSelectedConversation(payload.conversation);
      setMessages(payload.messages || []);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0, lastMessage: payload.conversation.lastMessage }
            : conversation,
        ),
      );
    } catch (error) {
      setMessageError(error.message);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [isAuthenticated, loadWorkspace]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    loadConversation(selectedConversationId);
  }, [loadConversation, selectedConversationId]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadWorkspace();
      if (selectedConversationId) {
        loadConversation(selectedConversationId);
      }
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, loadConversation, loadWorkspace, selectedConversationId]);

  async function handleStartConversation() {
    if (!selectedContactId) {
      return;
    }

    setCreatingConversation(true);
    setMessageError("");

    try {
      const payload = await api.post("/chat/conversations", {
        participantId: selectedContactId,
      });
      await loadWorkspace();
      setSelectedConversationId(payload.conversation.id);
      setSelectedContactId("");
    } catch (error) {
      setMessageError(error.message);
    } finally {
      setCreatingConversation(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!selectedConversationId || !chatDraft.trim()) {
      return;
    }

    setSendingMessage(true);
    setMessageError("");

    try {
      const payload = await api.post(`/chat/conversations/${selectedConversationId}/messages`, {
        message: chatDraft.trim(),
      });
      setMessages((current) => [...current, payload.message]);
      setChatDraft("");
      await loadWorkspace();
    } catch (error) {
      setMessageError(error.message);
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleStartMeeting(event) {
    event.preventDefault();
    setStartingMeeting(true);
    setMeetingError("");
    setWorkspaceMessage("");

    try {
      const payload = await api.post("/meetings", {
        type: meetingForm.type,
        title: meetingForm.title,
        courseId: meetingForm.type === "classroom" ? meetingForm.courseId : "",
        slotId: meetingForm.type === "classroom" ? meetingForm.slotId : "",
        inviteeIds: meetingForm.type === "private" ? meetingForm.inviteeIds : [],
      });
      setWorkspaceMessage("Video room started successfully.");
      setMeetings((current) => [payload.meeting, ...current]);
      setMeetingForm((current) => ({
        ...current,
        title: "",
        inviteeIds: [],
      }));
      window.open(payload.meeting.meetingUrl, "_blank", "noopener,noreferrer");
      await loadWorkspace();
    } catch (error) {
      setMeetingError(error.message);
    } finally {
      setStartingMeeting(false);
    }
  }

  async function handleEndMeeting(meetingId) {
    setEndingMeetingId(meetingId);
    setMeetingError("");

    try {
      await api.post(`/meetings/${meetingId}/end`, {});
      await loadWorkspace();
    } catch (error) {
      setMeetingError(error.message);
    } finally {
      setEndingMeetingId("");
    }
  }

  useEffect(() => {
    if (!availableSlots.length) {
      return;
    }

    setMeetingForm((current) => ({
      ...current,
      slotId: availableSlots.some((slot) => slot.id === current.slotId)
        ? current.slotId
        : availableSlots[0].id,
    }));
  }, [availableSlots]);

  useEffect(() => {
    if (!availableMeetingTypes.length) {
      return;
    }

    if (availableMeetingTypes.some((entry) => entry.value === meetingForm.type)) {
      return;
    }

    setMeetingForm((current) => ({
      ...current,
      type: availableMeetingTypes[0].value,
      inviteeIds: [],
    }));
  }, [availableMeetingTypes, meetingForm.type]);

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Meeting rooms"
        title={
          isAuthenticated
            ? "Video rooms, invitations, and direct messages in one workspace."
            : "One place for classrooms, private coaching, and team conversations."
        }
        description={
          isAuthenticated
            ? "Teachers run classroom and private coaching rooms, while admins and moderators launch crew sessions without leaving the platform."
            : "Each room type is shaped around the way people actually learn and work on edUKai: class sessions, personal support, and staff coordination."
        }
        actions={
          isAuthenticated ? (
            <>
              <Link to="/courses" className="secondary-btn">
                Browse courses
              </Link>
              <Link to="/dashboard" className="primary-btn">
                Open dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/signup" className="primary-btn">
                Create account
              </Link>
              <Link to="/signin" className="secondary-btn">
                Sign in
              </Link>
            </>
          )
        }
      />

      {isAuthenticated ? (
        <>
          <section className="px-6 py-6 md:px-12">
            <div className="mx-auto max-w-7xl panel-grid">
                <StatCard label="Active rooms" value={String(meetings.filter((meeting) => meeting.status === "active").length)} helper="Live or ready to join" />
                <StatCard label="Direct chats" value={String(conversations.length)} helper={`${unreadConversationCount} unread messages`} />
                <StatCard label="Reachable contacts" value={String(options.contacts.length)} helper="Teachers, students, and staff you can message" />
              <StatCard
                label="Hosting access"
                value={options.canHost ? "Enabled" : "Read only"}
                helper={
                  options.hostCapabilities?.crew
                    ? "Crew rooms only"
                    : options.hostCapabilities?.classroom || options.hostCapabilities?.private
                      ? "Classroom and private rooms"
                      : "Join rooms you are invited to"
                }
              />
            </div>
          </section>

          <section className="px-6 py-8 md:px-12">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.96fr_1.04fr]">
              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Direct communication"
                  title="Teacher and student messages"
                  description="Start a conversation, keep the thread inside the platform, and move into a call only when it actually helps."
                />

                <div className="grid gap-4">
                  <div className="surface-subtle p-4">
                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      Start a conversation
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <select
                          value={selectedContactId}
                          onChange={(event) => setSelectedContactId(event.target.value)}
                          className="min-w-0 flex-1 px-4 py-3"
                        >
                          <option value="">Choose a contact</option>
                          {options.contacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.displayName} ({contact.role})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleStartConversation}
                          disabled={creatingConversation || !selectedContactId}
                          className="primary-btn disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {creatingConversation ? "Opening..." : "Open chat"}
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="grid gap-3">
                      {conversations.length ? (
                        conversations.map((conversation) => (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => setSelectedConversationId(conversation.id)}
                            className={`rounded-2xl border px-4 py-4 text-left transition ${
                              selectedConversationId === conversation.id
                                ? "border-primary bg-purple-50"
                                : "border-purple-100 bg-white hover:bg-purple-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">
                                  {conversation.counterpart?.displayName || "Conversation"}
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                                  {conversation.counterpart?.role || "Contact"}
                                </p>
                              </div>
                              {conversation.unreadCount ? (
                                <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-slate-900">
                                  {conversation.unreadCount}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                              {conversation.lastMessage?.body || "No messages yet."}
                            </p>
                          </button>
                        ))
                      ) : (
                        <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                          No conversations yet. Start with a teacher, student, or staff contact above.
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-purple-100 bg-white p-5">
                      {selectedConversation ? (
                        <>
                          <div className="border-b border-purple-100 pb-4">
                            <p className="text-lg font-bold text-primary [overflow-wrap:anywhere]">
                              {selectedConversation.counterpart?.displayName}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {selectedConversation.counterpart?.role}
                            </p>
                          </div>
                          <div className="mt-4 grid max-h-[25rem] gap-3 overflow-y-auto pr-1">
                            {messages.map((message) => {
                              const ownMessage = message.senderId === user?.id;
                              return (
                                <div
                                  key={message.id}
                                  className={`rounded-2xl px-4 py-4 ${
                                    ownMessage ? "bg-primary text-white" : "bg-purple-50 text-slate-700"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className={`text-sm font-semibold [overflow-wrap:anywhere] ${ownMessage ? "text-white" : "text-primary"}`}>
                                      {message.authorName}
                                    </p>
                                    <p className={`text-xs ${ownMessage ? "text-white/75" : "text-slate-500"}`}>
                                      {formatTimestamp(message.createdAt)}
                                    </p>
                                  </div>
                                  <p className={`mt-2 text-sm leading-6 [overflow-wrap:anywhere] ${ownMessage ? "text-white/92" : "text-slate-600"}`}>
                                    {message.body}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          <form onSubmit={handleSendMessage} className="mt-4 grid gap-3">
                            <textarea
                              rows="4"
                              value={chatDraft}
                              onChange={(event) => setChatDraft(event.target.value)}
                              placeholder="Write a message..."
                              className="px-4 py-3"
                            />
                            <button
                              type="submit"
                              disabled={sendingMessage || !chatDraft.trim()}
                              className="primary-btn w-fit disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <Send size={16} />
                              {sendingMessage ? "Sending..." : "Send message"}
                            </button>
                          </form>
                        </>
                      ) : (
                        <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                          Choose a conversation to read the thread and reply from here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface-card p-8">
                <SectionHeader
                  eyebrow="Video room studio"
                  title="Start a meeting and invite the right people"
                  description="Teachers host classrooms and private coaching, while admins or moderators keep internal crew meetings moving."
                />

                {meetingError ? (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {meetingError}
                  </div>
                ) : null}

                {workspaceMessage ? (
                  <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {workspaceMessage}
                  </div>
                ) : null}

                {options.canHost ? (
                  <form onSubmit={handleStartMeeting} className="grid gap-4 rounded-3xl border border-purple-100 bg-purple-50 p-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {availableMeetingTypes.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setMeetingForm((current) => ({
                              ...current,
                              type: option.value,
                              inviteeIds: [],
                            }))
                          }
                          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                            meetingForm.type === option.value
                              ? "bg-primary text-white"
                              : "bg-white text-slate-700"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      Room title
                      <input
                        value={meetingForm.title}
                        onChange={(event) => setMeetingForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder={
                          meetingForm.type === "classroom"
                            ? "Frontend evening live room"
                            : meetingForm.type === "crew"
                              ? "Urgent workflow sync"
                              : "Weekly coaching call"
                        }
                        className="px-4 py-3"
                      />
                    </label>

                    {meetingForm.type === "classroom" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2 text-sm font-semibold text-slate-700">
                          Course
                          <select
                            value={meetingForm.courseId}
                            onChange={(event) =>
                              setMeetingForm((current) => ({ ...current, courseId: event.target.value }))
                            }
                            className="px-4 py-3"
                          >
                            {options.courses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="grid gap-2 text-sm font-semibold text-slate-700">
                          Slot
                          <select
                            value={meetingForm.slotId}
                            onChange={(event) =>
                              setMeetingForm((current) => ({ ...current, slotId: event.target.value }))
                            }
                            className="px-4 py-3"
                          >
                            {availableSlots.map((slot) => (
                              <option key={slot.id} value={slot.id}>
                                {slot.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}

                    {meetingForm.type === "private" ? (
                      <label className="grid gap-2 text-sm font-semibold text-slate-700">
                        Invitee
                        <select
                          value={meetingForm.inviteeIds[0] || ""}
                          onChange={(event) =>
                            setMeetingForm((current) => ({ ...current, inviteeIds: [event.target.value] }))
                          }
                          className="px-4 py-3"
                        >
                          <option value="">Choose a contact</option>
                          {options.contacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.displayName} ({contact.role})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <button type="submit" disabled={startingMeeting} className="primary-btn w-fit disabled:cursor-not-allowed disabled:opacity-70">
                      <Video size={16} />
                      {startingMeeting ? "Starting room..." : "Start video room"}
                    </button>
                  </form>
                ) : (
                  <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                    Your account can join invited rooms from this page, but only teachers can start classroom or private sessions, and only admins or moderators can launch crew rooms.
                  </div>
                )}

                <div className="mt-6 grid gap-4">
                  {loadingWorkspace ? (
                    <div className="surface-subtle p-5 text-sm text-slate-600">Loading active rooms...</div>
                  ) : meetings.length ? (
                    meetings.map((meeting) => (
                      <div key={meeting.id} className="rounded-3xl border border-purple-100 bg-white p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">
                              {meeting.type}
                            </p>
                            <h3 className="mt-2 text-xl font-bold text-primary">{meeting.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              Hosted by {meeting.hostName}
                              {meeting.courseTitle ? ` | ${meeting.courseTitle}` : ""}
                              {meeting.slotName ? ` | ${meeting.slotName}` : ""}
                            </p>
                          </div>
                          <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-purple-700">
                            {meeting.status}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-slate-500">
                          <p>Started {formatTimestamp(meeting.startedAt)}</p>
                          <p>{meeting.inviteeCount} invited participants</p>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          {meeting.status === "active" ? (
                            <a
                              href={meeting.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="primary-btn"
                            >
                              Open video room
                            </a>
                          ) : null}
                          {meeting.canEnd && meeting.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => handleEndMeeting(meeting.id)}
                              disabled={endingMeetingId === meeting.id}
                              className="secondary-btn disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {endingMeetingId === meeting.id ? "Ending..." : "End room"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                      No rooms are active yet. Start one from the form above, or wait for an invitation from your teacher or team.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {messageError ? (
            <section className="px-6 pb-4 md:px-12">
              <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {messageError}
              </div>
            </section>
          ) : null}

          <section className="px-6 pb-14 pt-4 md:px-12">
            <div className="mx-auto max-w-7xl">
              <SectionHeader
                eyebrow="Room standards"
                title="The smoother workflow behind the rooms"
                description="Video calls are now only one part of the experience: invites, chat, notifications, and course context stay attached to the same platform."
              />

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {roomRules.map(({ icon: Icon, title, copy }) => (
                  <article key={title} className="surface-card p-8">
                    <Icon className="text-primary" size={22} />
                    <h3 className="mt-5 text-xl font-bold text-primary">{title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : (
        <PublicRoomsExperience />
      )}
    </SiteLayout>
  );
}

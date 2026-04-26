import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AtSign,
  FileText,
  Flag,
  Flame,
  Frown,
  Heart,
  ImagePlus,
  Link2,
  MessageSquareText,
  PartyPopper,
  Pencil,
  PlayCircle,
  Repeat2,
  Save,
  Send,
  Sparkles,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import ReportDialog from "../Components/ReportDialog";
import { SiteLayout } from "../Components/SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";

const COMMUNITY_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const reactionTypes = [
  { value: "like", icon: ThumbsUp, activeClass: "bg-purple-50 text-purple-700 border-purple-200", badgeClass: "bg-primary text-white" },
  { value: "love", icon: Heart, activeClass: "bg-rose-50 text-rose-700 border-rose-200", badgeClass: "bg-rose-500 text-white" },
  { value: "wow", icon: Sparkles, activeClass: "bg-amber-50 text-amber-700 border-amber-200", badgeClass: "bg-amber-500 text-white" },
  { value: "angry", icon: Flame, activeClass: "bg-orange-50 text-orange-700 border-orange-200", badgeClass: "bg-orange-500 text-white" },
  { value: "sad", icon: Frown, activeClass: "bg-slate-100 text-slate-700 border-slate-200", badgeClass: "bg-slate-500 text-white" },
  { value: "celebrate", icon: PartyPopper, activeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", badgeClass: "bg-emerald-500 text-white" },
];

const feelingOptions = [
  { value: "happy", label: "Happy" },
  { value: "grateful", label: "Grateful" },
  { value: "excited", label: "Excited" },
  { value: "proud", label: "Proud" },
  { value: "hopeful", label: "Hopeful" },
  { value: "motivated", label: "Motivated" },
];

const promptChips = [
  "Quick thought",
  "Need feedback",
  "Small win",
  "Check-in",
];

const promptBodies = {
  "Quick thought": "One thought I wanted to share with the community today.",
  "Need feedback": "I would love a second opinion on this idea.",
  "Small win": "Quick win from today and what I want to keep building.",
  "Check-in": "Quick check-in on how I am feeling and what support would help.",
};

const roleLabels = {
  admin: "Admin",
  moderator: "Moderator",
  teacher: "Teacher",
  student: "Student",
};

const roleAvatarStyles = {
  admin: "bg-slate-900 text-white",
  moderator: "bg-amber-100 text-amber-700",
  teacher: "bg-emerald-100 text-emerald-700",
  student: "bg-purple-100 text-purple-700",
};

const feelingLabels = Object.fromEntries(feelingOptions.map((item) => [item.value, item.label]));

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value) {
  if (!value) {
    return "";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d`;
}

function buildInitials(name) {
  return String(name || "Community Member")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function replacePost(posts, updatedPost) {
  return posts.map((post) => (post.id === updatedPost.id ? updatedPost : post));
}

function getCommunityCacheKey(userId) {
  return userId ? `edukai:community:${userId}` : "";
}

function readCachedPosts(userId) {
  if (!userId || typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getCommunityCacheKey(userId));
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedPosts(userId, posts) {
  if (!userId || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getCommunityCacheKey(userId), JSON.stringify(posts));
  } catch {
    // Ignore cache write issues and keep the live feed working.
  }
}

function mergeCachedPosts(serverPosts, cachedPosts, userId) {
  const mergedPosts = new Map(serverPosts.map((post) => [post.id, post]));
  const cutoffTime = Date.now() - COMMUNITY_CACHE_TTL_MS;

  cachedPosts.forEach((post) => {
    const timestamp = new Date(post.updatedAt || post.createdAt || 0).getTime();
    if (
      !mergedPosts.has(post.id) &&
      post.author?.id === userId &&
      Number.isFinite(timestamp) &&
      timestamp >= cutoffTime
    ) {
      mergedPosts.set(post.id, post);
    }
  });

  return [...mergedPosts.values()].sort(
    (left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt),
  );
}

function getHostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getAttachmentType(url, fallback = "link") {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(pathname)) {
      return "image";
    }

    if (/\.(mp4|mov|webm|avi|mkv)$/.test(pathname)) {
      return "video";
    }

    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(pathname)) {
      return "audio";
    }

    if (/\.(pdf|docx?|pptx?|xlsx?|txt|zip|rar)$/.test(pathname)) {
      return "document";
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function buildCommentThreads(comments) {
  const roots = [];
  const repliesByParent = new Map();

  comments.forEach((comment) => {
    if (comment.parentId) {
      repliesByParent.set(comment.parentId, [...(repliesByParent.get(comment.parentId) || []), comment]);
      return;
    }

    roots.push(comment);
  });

  return roots.map((root) => ({
    root,
    replies: repliesByParent.get(root.id) || [],
  }));
}

function getActiveMentionData(body, caretPosition) {
  if (typeof caretPosition !== "number") {
    return null;
  }

  const beforeCaret = body.slice(0, caretPosition);
  const match = beforeCaret.match(/(^|\s)@([a-z0-9._-]{0,30})$/i);
  if (!match) {
    return null;
  }

  return {
    query: match[2],
    start: beforeCaret.lastIndexOf("@"),
    end: caretPosition,
  };
}

function Avatar({ name, role, avatarUrl, size = "md" }) {
  const sizeClass =
    size === "lg"
      ? "h-12 w-12 text-base"
      : size === "sm"
        ? "h-9 w-9 text-xs"
        : "h-10 w-10 text-sm";

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name || "Community member"} className={`${sizeClass} rounded-full object-cover`} />;
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold ${sizeClass} ${
        roleAvatarStyles[role] || "bg-purple-100 text-purple-700"
      }`}
    >
      {buildInitials(name)}
    </span>
  );
}

function IconButton({ icon: Icon, title, onClick, disabled = false, tone = "default", type = "button" }) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50"
      : tone === "primary"
        ? "text-purple-700 hover:bg-purple-50"
        : "text-slate-500 hover:bg-slate-100";

  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${toneClass} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <Icon size={16} />
    </button>
  );
}

function ActionTextButton({ icon: Icon, label, onClick, tone = "default", disabled = false }) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50"
      : tone === "primary"
        ? "text-purple-700 hover:bg-purple-50"
        : "text-slate-600 hover:bg-slate-100";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${toneClass} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function FilterChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-white" : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function AttachmentPreview({ attachment, compact = false, onRemove }) {
  const attachmentType = attachment.type || getAttachmentType(attachment.url);
  const iconMap = {
    image: ImagePlus,
    video: Sparkles,
    audio: PlayCircle,
    document: FileText,
    link: Link2,
  };
  const Icon = iconMap[attachmentType] || Link2;

  if (attachmentType === "image") {
    return (
      <div className={`relative overflow-hidden rounded-3xl border border-slate-200 ${compact ? "h-40" : "h-56"}`}>
        <img src={attachment.url} alt={attachment.label || "Attachment"} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent px-4 py-3 text-white">
          <p className="text-sm font-semibold">{attachment.label || "Image"}</p>
          <p className="text-xs text-white/80">{getHostLabel(attachment.url)}</p>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/75 text-white"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
    );
  }

  if (attachmentType === "video") {
    return (
      <div className={`relative overflow-hidden rounded-3xl border border-purple-100 bg-slate-950 ${compact ? "h-auto" : "h-auto"}`}>
        <video controls src={attachment.url} className="h-full w-full" />
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/75 text-white"
          >
            <X size={14} />
          </button>
        ) : null}
        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-sm font-semibold text-white">{attachment.label || "Video"}</p>
          <p className="text-xs text-white/70">{getHostLabel(attachment.url)}</p>
        </div>
      </div>
    );
  }

  if (attachmentType === "audio") {
    return (
      <div className="rounded-3xl border border-purple-100 bg-purple-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-primary">
            <PlayCircle size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{attachment.label || "Music track"}</p>
            <p className="mt-1 text-sm text-slate-500">{getHostLabel(attachment.url)}</p>
          </div>
          {onRemove ? <IconButton icon={X} title="Remove attachment" onClick={() => onRemove(attachment.id)} /> : null}
        </div>
        <audio controls src={attachment.url} className="mt-4 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600">
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{attachment.label || "Attachment"}</p>
            <p className="mt-1 text-sm text-slate-500">{getHostLabel(attachment.url)}</p>
          </div>
        </div>
        {onRemove ? <IconButton icon={X} title="Remove attachment" onClick={() => onRemove(attachment.id)} /> : null}
      </div>
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-700"
      >
        Open
        <Link2 size={14} />
      </a>
    </div>
  );
}

function CommentRow({ comment, isReply = false, onReply, onDelete, onReport }) {
  return (
    <div className={`flex gap-3 rounded-3xl ${isReply ? "bg-slate-50 px-4 py-4" : "bg-white"}`}>
      <Avatar
        name={comment.author?.displayName}
        role={comment.author?.role}
        avatarUrl={comment.author?.avatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">
              {comment.author?.displayName || "Community member"}
            </p>
            <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
              {formatRelativeTime(comment.createdAt)} - {formatDate(comment.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {!isReply ? <ActionTextButton icon={MessageSquareText} label="Reply" onClick={onReply} /> : null}
            {comment.canReport ? <ActionTextButton icon={Flag} label="Report" onClick={onReport} tone="primary" /> : null}
            {comment.canDelete ? <ActionTextButton icon={Trash2} label="Delete" onClick={onDelete} tone="danger" /> : null}
          </div>
        </div>
        <p className="mt-2 text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">{comment.body}</p>
      </div>
    </div>
  );
}

function CommunityPost({
  post,
  isAuthenticated,
  currentUser,
  commentDrafts,
  replyTargets,
  setCommentDrafts,
  editingPostId,
  editDraft,
  setEditDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onReact,
  onRepost,
  onDeletePost,
  onReportPost,
  onReply,
  onCommentSubmit,
  onDeleteComment,
  onReportComment,
}) {
  const threads = useMemo(() => buildCommentThreads(post.comments || []), [post.comments]);
  const activeReactions = reactionTypes.filter(({ value }) =>
    post.reactionSummary.some((entry) => entry.type === value && entry.count > 0),
  );
  const isEditing = editingPostId === post.id;
  const visibleEditDraft = isEditing ? editDraft : null;

  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <Link to={`/people/${post.author?.id || ""}`}>
          <Avatar
            name={post.author?.displayName}
            role={post.author?.role}
            avatarUrl={post.author?.avatarUrl}
            size="lg"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/people/${post.author?.id || ""}`} className="font-bold text-slate-900">
                  {post.author?.displayName || "Community member"}
                </Link>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {roleLabels[post.author?.role] || "Member"}
                </span>
                {post.feeling ? (
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-purple-700">
                    {feelingLabels[post.feeling] || post.feeling}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
                {formatRelativeTime(post.updatedAt)} - {formatDate(post.updatedAt)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {post.canReport ? <ActionTextButton icon={Flag} label="Report" onClick={() => onReportPost(post)} tone="primary" /> : null}
              {post.canEdit ? <ActionTextButton icon={Pencil} label="Edit" onClick={() => onStartEdit(post)} /> : null}
              {post.canDelete ? <ActionTextButton icon={Trash2} label="Delete" onClick={() => onDeletePost(post)} tone="danger" /> : null}
              {isAuthenticated ? <ActionTextButton icon={Repeat2} label="Share" onClick={() => onRepost(post)} tone="primary" /> : null}
            </div>
          </div>

          {isEditing && visibleEditDraft ? (
            <div className="mt-4 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <input
                value={visibleEditDraft.body}
                onChange={(event) => setEditDraft((current) => ({ ...current, body: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={visibleEditDraft.feeling}
                  onChange={(event) => setEditDraft((current) => ({ ...current, feeling: event.target.value }))}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-primary"
                >
                  <option value="">No feeling</option>
                  {feelingOptions.map((feeling) => (
                    <option key={feeling.value} value={feeling.value}>
                      {feeling.label}
                    </option>
                  ))}
                </select>
                <IconButton icon={Save} title="Save post" onClick={() => onSaveEdit(post.id)} tone="primary" />
                <IconButton icon={X} title="Cancel edit" onClick={onCancelEdit} />
              </div>
            </div>
          ) : (
            <>
              {post.body ? <p className="mt-4 text-[15px] leading-8 text-slate-800 [overflow-wrap:anywhere]">{post.body}</p> : null}

              {post.mentions?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.mentions.map((mention) => (
                    <Link
                      key={mention.id}
                      to={`/people/${mention.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700"
                    >
                      <AtSign size={13} />
                      {mention.displayName}
                    </Link>
                  ))}
                </div>
              ) : null}

              {post.attachments?.length ? (
                <div className={`mt-4 grid gap-3 ${post.attachments.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {post.attachments.map((attachment) => (
                    <AttachmentPreview key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              ) : null}

              {post.repost ? (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-purple-700">Shared post</p>
                  <p className="mt-2 font-semibold text-slate-900">{post.repost.author?.displayName || "Community member"}</p>
                  {post.repost.body ? (
                    <p className="mt-2 text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">{post.repost.body}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-4">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="flex -space-x-2">
            {(activeReactions.length ? activeReactions : reactionTypes.slice(0, 1))
              .slice(0, 3)
              .map(({ value, icon: Icon, badgeClass }) => (
                <span
                  key={value}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white ${badgeClass}`}
                >
                  <Icon size={13} />
                </span>
              ))}
          </div>
          <span>{post.totalReactions}</span>
          <span>{post.totalComments}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reactionTypes.map(({ value, icon: Icon, activeClass }) => {
            const reaction = post.reactionSummary.find((entry) => entry.type === value);
            return (
              <button
                key={value}
                type="button"
                title={value}
                onClick={() => onReact(post.id, value)}
                disabled={!isAuthenticated}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  reaction?.reacted
                    ? activeClass
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                } ${!isAuthenticated ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <Icon size={14} />
                <span>{reaction?.count || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {threads.length ? (
          threads.map((thread) => (
            <div key={thread.root.id} className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
              <CommentRow
                comment={thread.root}
                onReply={() => onReply(post.id, thread.root)}
                onDelete={() => onDeleteComment(post.id, thread.root.id)}
                onReport={() => onReportComment(post.id, thread.root.id)}
              />
              {thread.replies.length ? (
                <div className="mt-4 space-y-3 border-l-2 border-purple-100 pl-4">
                  {thread.replies.map((reply) => (
                    <CommentRow
                      key={reply.id}
                      comment={reply}
                      isReply
                      onDelete={() => onDeleteComment(post.id, reply.id)}
                      onReport={() => onReportComment(post.id, reply.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-600">No comments yet.</div>
        )}

        {isAuthenticated ? (
          <form onSubmit={(event) => onCommentSubmit(event, post.id)} className="flex items-center gap-3">
            <Avatar
              name={currentUser?.displayName}
              role={currentUser?.role}
              avatarUrl={currentUser?.avatarUrl}
              size="sm"
            />
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                value={commentDrafts[post.id] || ""}
                onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                placeholder={
                  replyTargets[post.id] ? `Replying to ${replyTargets[post.id].authorName}` : "Write a comment"
                }
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
              />
              {replyTargets[post.id] ? <IconButton icon={X} title="Clear reply" onClick={() => onReply(post.id, null)} /> : null}
              <IconButton icon={Send} title="Post comment" tone="primary" type="submit" />
            </div>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default function Blog() {
  const { user, isAuthenticated, loading: authLoading } = useContext(AuthContext);
  const composerRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [composer, setComposer] = useState({
    body: "",
    feeling: "",
    repostOfId: "",
    attachments: [],
  });
  const [attachmentDraft, setAttachmentDraft] = useState({ url: "", label: "" });
  const [showFeelingPanel, setShowFeelingPanel] = useState(false);
  const [showMentionPanel, setShowMentionPanel] = useState(false);
  const [showAttachmentPanel, setShowAttachmentPanel] = useState(false);
  const [selectedMentionIds, setSelectedMentionIds] = useState([]);
  const [activeMention, setActiveMention] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [replyTargets, setReplyTargets] = useState({});
  const [editingPostId, setEditingPostId] = useState("");
  const [editDraft, setEditDraft] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState("");
  const [reporting, setReporting] = useState(false);
  const communityCacheKey = useMemo(() => getCommunityCacheKey(user?.id), [user?.id]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      setPosts([]);
      setMembers([]);
      setLoadingData(false);
      return;
    }

    async function loadCommunity() {
      setLoadingData(true);
      setError("");

      try {
        const [communityPayload, membersPayload] = await Promise.all([
          api.get("/community"),
          api.get("/community/members"),
        ]);
        const cachedPosts = readCachedPosts(user?.id);
        setPosts(mergeCachedPosts(communityPayload.posts || [], cachedPosts, user?.id));
        setMembers(membersPayload.members || []);
      } catch (loadError) {
        const cachedPosts = readCachedPosts(user?.id);
        if (cachedPosts.length) {
          setPosts(cachedPosts);
          setError("The live feed could not refresh, so your recent cached posts are still visible.");
        } else {
          setError(loadError.message);
        }
      } finally {
        setLoadingData(false);
      }
    }

    loadCommunity();
  }, [authLoading, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !communityCacheKey) {
      return;
    }

    writeCachedPosts(user?.id, posts);
  }, [communityCacheKey, isAuthenticated, posts, user?.id]);

  const mentionableMembers = useMemo(
    () => members.filter((member) => member.id !== user?.id),
    [members, user?.id],
  );

  const stats = useMemo(() => {
    const totalComments = posts.reduce((sum, post) => sum + (post.totalComments || 0), 0);
    const totalReactions = posts.reduce((sum, post) => sum + (post.totalReactions || 0), 0);
    const attachmentPosts = posts.filter((post) => post.attachments?.length).length;

    return [
      { label: "Posts", value: posts.length },
      { label: "Comments", value: totalComments },
      { label: "Reactions", value: totalReactions },
      { label: "Media", value: attachmentPosts },
    ];
  }, [posts]);

  const filterOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "discussed", label: "Discussed" },
      { value: "media", label: "Media" },
      { value: "mentions", label: "Mentions" },
      { value: "staff", label: "Staff" },
    ],
    [],
  );

  const filteredPosts = useMemo(() => {
    switch (activeFilter) {
      case "discussed":
        return [...posts].sort((left, right) => {
          const leftScore = (left.totalComments || 0) + (left.totalReactions || 0);
          const rightScore = (right.totalComments || 0) + (right.totalReactions || 0);
          return rightScore - leftScore;
        });
      case "media":
        return posts.filter((post) => post.attachments?.length);
      case "mentions":
        return posts.filter((post) => post.mentions?.length);
      case "staff":
        return posts.filter((post) => ["admin", "moderator", "teacher"].includes(post.author?.role || ""));
      default:
        return posts;
    }
  }, [activeFilter, posts]);

  const repostTarget = useMemo(
    () => posts.find((post) => post.id === composer.repostOfId) || null,
    [composer.repostOfId, posts],
  );

  const mentionSuggestions = useMemo(() => {
    if (!showMentionPanel && !activeMention) {
      return [];
    }

    const query = (activeMention?.query || "").toLowerCase();

    return mentionableMembers
      .filter((member) => {
        if (!query) {
          return true;
        }

        return member.displayName.toLowerCase().includes(query);
      })
      .slice(0, 6);
  }, [activeMention, mentionableMembers, showMentionPanel]);

  function syncActiveMention(nextBody, selectionStart) {
    setActiveMention(getActiveMentionData(nextBody, selectionStart));
  }

  function updateComposerBody(nextBody, selectionStart = nextBody.length) {
    setComposer((current) => ({ ...current, body: nextBody }));
    syncActiveMention(nextBody, selectionStart);
  }

  function handleComposerChange(event) {
    updateComposerBody(event.target.value, event.target.selectionStart);
  }

  function applyPrompt(label) {
    const nextBody = promptBodies[label] || "";
    setSelectedMentionIds([]);
    updateComposerBody(nextBody, nextBody.length);
  }

  function insertMention(member) {
    const caretPosition = composerRef.current?.selectionStart ?? composer.body.length;
    const target = getActiveMentionData(composer.body, caretPosition) || activeMention;
    const start = target?.start ?? caretPosition;
    const end = target?.end ?? caretPosition;
    const mentionText = `@${member.displayName} `;
    const nextBody = `${composer.body.slice(0, start)}${mentionText}${composer.body.slice(end)}`;
    const nextCaret = start + mentionText.length;

    setSelectedMentionIds((current) => [...new Set([...current, member.id])]);
    setShowMentionPanel(false);
    updateComposerBody(nextBody, nextCaret);

    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function removeAttachment(attachmentId) {
    setComposer((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  }

  function handleAddAttachment() {
    const url = attachmentDraft.url.trim();
    const label = attachmentDraft.label.trim();

    if (!url) {
      setError("Add an attachment URL first.");
      return;
    }

    if (composer.attachments.length >= 4) {
      setError("You can attach up to four items.");
      return;
    }

    try {
      new URL(url);
    } catch {
      setError("Attachment URL must be valid.");
      return;
    }

    setComposer((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        {
          id: `draft-${Date.now()}`,
          url,
          label,
          type: getAttachmentType(url),
        },
      ],
    }));
    setAttachmentDraft({ url: "", label: "" });
    setError("");
  }

  async function handlePostSubmit(event) {
    event.preventDefault();

    setPosting(true);
    setError("");
    setMessage("");

    try {
      const mentionedUserIds = selectedMentionIds.filter((memberId) => {
        const member = mentionableMembers.find((entry) => entry.id === memberId);
        return member && composer.body.toLowerCase().includes(`@${member.displayName.toLowerCase()}`);
      });

      const payload = await api.post("/community/posts", {
        body: composer.body,
        feeling: composer.feeling,
        repostOfId: composer.repostOfId,
        attachments: composer.attachments,
        mentionedUserIds,
      });

      setPosts((current) => [payload.post, ...current]);
      setComposer({
        body: "",
        feeling: "",
        repostOfId: "",
        attachments: [],
      });
      setAttachmentDraft({ url: "", label: "" });
      setSelectedMentionIds([]);
      setShowAttachmentPanel(false);
      setShowFeelingPanel(false);
      setShowMentionPanel(false);
      setActiveMention(null);
      setMessage("Post published.");
      setActiveFilter("all");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleReact(postId, type) {
    try {
      const payload = await api.post(`/community/posts/${postId}/reactions`, { type });
      setPosts((current) => replacePost(current, payload.post));
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function handleRepost(post) {
    setComposer((current) => ({ ...current, repostOfId: post.id }));
    setMessage(`Sharing ${post.author?.displayName || "this post"}.`);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }

  function handleReply(postId, comment) {
    setReplyTargets((current) => ({
      ...current,
      [postId]: comment
        ? {
            id: comment.id,
            authorName: comment.author?.displayName || "Community member",
          }
        : null,
    }));
  }

  function openReportDialog(nextTarget) {
    setReportTarget(nextTarget);
    setReportReason("");
    setReportError("");
  }

  function closeReportDialog() {
    setReportTarget(null);
    setReportReason("");
    setReportError("");
    setReporting(false);
  }

  async function handleCommentSubmit(event, postId) {
    event.preventDefault();

    const body = commentDrafts[postId] || "";
    if (!body.trim()) {
      return;
    }

    try {
      const payload = await api.post(`/community/posts/${postId}/comments`, {
        body: body.trim(),
        parentId: replyTargets[postId]?.id || "",
      });
      setPosts((current) => replacePost(current, payload.post));
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setReplyTargets((current) => ({ ...current, [postId]: null }));
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function handleStartEdit(post) {
    setEditingPostId(post.id);
    setEditDraft({
      body: post.body || "",
      feeling: post.feeling || "",
      attachments: post.attachments || [],
      mentionedUserIds: (post.mentions || []).map((entry) => entry.id),
    });
  }

  function handleCancelEdit() {
    setEditingPostId("");
    setEditDraft(null);
  }

  async function handleSaveEdit(postId) {
    if (!editDraft) {
      return;
    }

    try {
      const payload = await api.patch(`/community/posts/${postId}`, editDraft);
      setPosts((current) => replacePost(current, payload.post));
      setEditingPostId("");
      setEditDraft(null);
      setMessage("Post updated.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDeletePost(post) {
    const shouldDelete = window.confirm("Delete this post?");
    if (!shouldDelete) {
      return;
    }

    try {
      await api.delete(`/community/posts/${post.id}`);
      setPosts((current) => current.filter((entry) => entry.id !== post.id));
      setMessage("Post removed.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDeleteComment(postId, commentId) {
    const shouldDelete = window.confirm("Delete this comment?");
    if (!shouldDelete) {
      return;
    }

    try {
      const payload = await api.delete(`/community/posts/${postId}/comments/${commentId}`);
      setPosts((current) => replacePost(current, payload.post));
      setMessage("Comment removed.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function handleReportPost(post) {
    openReportDialog({
      type: "post",
      postId: post.id,
      title: "Report post",
      description: `This sends ${post.author?.displayName || "this member"}'s post to admins and moderators for review.`,
    });
  }

  function handleReportComment(postId, commentId) {
    openReportDialog({
      type: "comment",
      postId,
      commentId,
      title: "Report comment",
      description: "This sends the comment to admins and moderators so they can review the issue.",
    });
  }

  async function handleReportSubmit(event) {
    event.preventDefault();

    if (!reportTarget || !reportReason.trim()) {
      return;
    }

    setReporting(true);
    setReportError("");

    try {
      if (reportTarget.type === "post") {
        await api.post(`/community/posts/${reportTarget.postId}/report`, { reason: reportReason.trim() });
        setMessage("Post reported.");
      } else {
        await api.post(
          `/community/posts/${reportTarget.postId}/comments/${reportTarget.commentId}/report`,
          { reason: reportReason.trim() },
        );
        setMessage("Comment reported.");
      }

      closeReportDialog();
    } catch (submitError) {
      setReportError(submitError.message);
      setReporting(false);
    }
  }

  return (
    <SiteLayout>
      <section className="bg-background px-4 pb-12 pt-8 sm:px-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          {error ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          ) : null}

          {!isAuthenticated && !authLoading ? (
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-purple-700">Community</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Members only</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Sign in to view posts, share updates, react, and join the discussion.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/signin" className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white">
                  Sign In
                </Link>
                <Link to="/signup" className="inline-flex items-center justify-center rounded-full border border-purple-200 bg-purple-50 px-6 py-3 text-sm font-semibold text-purple-700">
                  Create Account
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-purple-700">Community</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Community feed</h1>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Share updates, media, and quick check-ins. Clear report buttons send issues straight to admins and moderators.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {stats.map((item) => (
                      <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <Avatar
                    name={user?.displayName}
                    role={user?.role}
                    avatarUrl={user?.avatarUrl}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl font-bold text-slate-900">What&apos;s on your mind?</h2>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {composer.body.length}
                      </span>
                    </div>

                    <form onSubmit={handlePostSubmit} className="mt-4 grid gap-4">
                      {repostTarget ? (
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-purple-700">Sharing</p>
                              <p className="mt-1 font-semibold text-slate-900">{repostTarget.author?.displayName || "Community member"}</p>
                            </div>
                            <IconButton
                              icon={X}
                              title="Clear shared post"
                              onClick={() => setComposer((current) => ({ ...current, repostOfId: "" }))}
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <textarea
                          ref={composerRef}
                          value={composer.body}
                          onChange={handleComposerChange}
                          onClick={(event) => syncActiveMention(event.target.value, event.target.selectionStart)}
                          onKeyUp={(event) => syncActiveMention(event.target.value, event.target.selectionStart)}
                          rows={4}
                          placeholder={`What's on your mind, ${user?.firstName || user?.displayName || "friend"}?`}
                          className="w-full resize-none bg-transparent text-sm leading-7 text-slate-800 outline-none"
                        />
                      </div>

                      {composer.feeling ? (
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700">
                          <Sparkles size={14} />
                          {feelingLabels[composer.feeling]}
                        </div>
                      ) : null}

                      {mentionSuggestions.length ? (
                        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="grid gap-2">
                            {mentionSuggestions.map((member) => (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => insertMention(member)}
                                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                              >
                                <Avatar
                                  name={member.displayName}
                                  role={member.role}
                                  avatarUrl={member.avatarUrl}
                                  size="sm"
                                />
                                <div>
                                  <p className="font-semibold text-slate-900">{member.displayName}</p>
                                  <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                                    {roleLabels[member.role] || "Member"}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {composer.attachments.length ? (
                        <div className={`grid gap-3 ${composer.attachments.length > 1 ? "sm:grid-cols-2" : ""}`}>
                          {composer.attachments.map((attachment) => (
                            <AttachmentPreview
                              key={attachment.id}
                              attachment={attachment}
                              compact={composer.attachments.length > 1}
                              onRemove={removeAttachment}
                            />
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2">
                        <IconButton
                          icon={Sparkles}
                          title="Choose feeling"
                          onClick={() => {
                            setShowFeelingPanel((current) => !current);
                            setShowMentionPanel(false);
                            setShowAttachmentPanel(false);
                          }}
                          tone="primary"
                        />
                        <IconButton
                          icon={AtSign}
                          title="Mention people"
                          onClick={() => {
                            setShowMentionPanel((current) => !current);
                            setShowFeelingPanel(false);
                            setShowAttachmentPanel(false);
                          }}
                          tone="primary"
                        />
                        <IconButton
                          icon={ImagePlus}
                          title="Add attachment"
                          onClick={() => {
                            setShowAttachmentPanel((current) => !current);
                            setShowFeelingPanel(false);
                            setShowMentionPanel(false);
                          }}
                          tone="primary"
                        />
                        <div className="ml-auto flex flex-wrap gap-2">
                          {promptChips.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => applyPrompt(chip)}
                              className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                        <button
                          type="submit"
                          disabled={posting}
                          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          title={posting ? "Publishing" : "Publish post"}
                        >
                          <Send size={16} />
                          {posting ? "Publishing" : "Post"}
                        </button>
                      </div>

                      {showFeelingPanel ? (
                        <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          {feelingOptions.map((feeling) => (
                            <button
                              key={feeling.value}
                              type="button"
                              onClick={() =>
                                setComposer((current) => ({
                                  ...current,
                                  feeling: current.feeling === feeling.value ? "" : feeling.value,
                                }))
                              }
                              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                composer.feeling === feeling.value
                                  ? "bg-primary text-white"
                                  : "bg-white text-slate-700"
                              }`}
                            >
                              {feeling.label}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {showAttachmentPanel ? (
                        <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                          <input
                            value={attachmentDraft.url}
                            onChange={(event) => setAttachmentDraft((current) => ({ ...current, url: event.target.value }))}
                            placeholder="Attachment URL"
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary"
                          />
                          <input
                            value={attachmentDraft.label}
                            onChange={(event) => setAttachmentDraft((current) => ({ ...current, label: event.target.value }))}
                            placeholder="Label"
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={handleAddAttachment}
                            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white"
                          >
                            Add
                          </button>
                        </div>
                      ) : null}
                    </form>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.map((filter) => (
                      <FilterChip
                        key={filter.value}
                        label={filter.label}
                        active={activeFilter === filter.value}
                        onClick={() => setActiveFilter(filter.value)}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">{filteredPosts.length} visible</p>
                </div>
              </div>

              {authLoading || loadingData ? (
                <div className="grid gap-5">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-56 animate-pulse rounded-[30px] bg-white shadow-sm" />
                  ))}
                </div>
              ) : filteredPosts.length ? (
                <div className="grid gap-5">
                  {filteredPosts.map((post) => (
                    <CommunityPost
                      key={post.id}
                      post={post}
                      isAuthenticated={isAuthenticated}
                      currentUser={user}
                      commentDrafts={commentDrafts}
                      replyTargets={replyTargets}
                      setCommentDrafts={setCommentDrafts}
                      editingPostId={editingPostId}
                      editDraft={editDraft}
                      setEditDraft={setEditDraft}
                      onStartEdit={handleStartEdit}
                      onCancelEdit={handleCancelEdit}
                      onSaveEdit={handleSaveEdit}
                      onReact={handleReact}
                      onRepost={handleRepost}
                      onDeletePost={handleDeletePost}
                      onReportPost={handleReportPost}
                      onReply={handleReply}
                      onCommentSubmit={handleCommentSubmit}
                      onDeleteComment={handleDeleteComment}
                      onReportComment={handleReportComment}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-[30px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-900">No posts yet</h2>
                  <p className="mt-2 text-sm text-slate-600">Try another filter or publish the first post.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      <ReportDialog
        open={Boolean(reportTarget)}
        title={reportTarget?.title || "Report content"}
        description={reportTarget?.description || ""}
        reason={reportReason}
        error={reportError}
        loading={reporting}
        onChangeReason={setReportReason}
        onClose={closeReportDialog}
        onSubmit={handleReportSubmit}
      />
    </SiteLayout>
  );
}

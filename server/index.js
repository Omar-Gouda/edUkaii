import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildDisplayName, createOpaqueToken, hashPassword, hashToken, normalizeEmail, nowIso, publicTeacher, safeUser, slugify, verifyPassword } from "./lib/auth.js";
import { ensureDbReady, flushDbWrites, getDb, getUploadsDir, initDb, updateDb } from "./lib/db.js";
import { buildSeedData } from "./lib/seed.js";
import { storeUploadedAsset } from "./lib/storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.API_PORT || 4101);
const ACCESS_COOKIE = "edukai_access";
const REFRESH_COOKIE = "edukai_refresh";
const ACCESS_TTL_MS = 1000 * 60 * 30;
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const LOGIN_ATTEMPTS = new Map();
const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:5173";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const EMAIL_DOMAIN = normalizeEmail(process.env.EMAIL_DOMAIN || "edukai.com");
const COURSE_DEPOSIT_RATE = Math.min(Math.max(Number(process.env.COURSE_DEPOSIT_RATE || 0.15), 0.05), 1);
const PAYMENT_CHECKOUT_GRACE_DAYS = Math.max(Number(process.env.PAYMENT_CHECKOUT_GRACE_DAYS || 7), 1);
const REMAINING_PAYMENT_GRACE_DAYS = Math.max(Number(process.env.REMAINING_PAYMENT_GRACE_DAYS || 14), 1);
const UPLOAD_FILE_SIZE_LIMIT_BYTES = Math.max(
  Number(process.env.UPLOAD_FILE_SIZE_LIMIT_BYTES || 25 * 1024 * 1024),
  1024 * 1024,
);
const PAYMOB_INTENTION_ENDPOINT = process.env.PAYMOB_INTENTION_ENDPOINT || "";
const PAYMOB_CHECKOUT_URL_TEMPLATE = process.env.PAYMOB_CHECKOUT_URL_TEMPLATE || "";
const PAYMOB_ALLOWED_METHODS = process.env.PAYMOB_ALLOWED_METHODS || "";
const PAYMOB_SECRET_KEY = process.env.PAYMOB_SECRET_KEY || "";
const PAYMOB_PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY || "";
const PAYMOB_WEBHOOK_URL = process.env.PAYMOB_WEBHOOK_URL || "";
const PAYMOB_SUCCESS_URL = process.env.PAYMOB_SUCCESS_URL || `${APP_BASE_URL}/payments?status=processing`;
const PAYMOB_FAILURE_URL = process.env.PAYMOB_FAILURE_URL || `${APP_BASE_URL}/payments?status=failed`;
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || "";
const PAYMOB_HMAC_FIELDS = process.env.PAYMOB_HMAC_FIELDS || "";
const COMMUNITY_REACTION_TYPES = ["like", "love", "wow", "angry", "sad", "celebrate"];
const COMMUNITY_FEELING_TYPES = ["happy", "grateful", "excited", "proud", "hopeful", "curious", "motivated", "calm"];
const COMMUNITY_ATTACHMENT_LIMIT = 4;
const COMMUNITY_MENTION_LIMIT = 8;

const app = express();
app.set("trust proxy", 1);

function mergeById(target, source) {
  const knownIds = new Set(target.map((entry) => entry.id));
  source.forEach((entry) => {
    if (!knownIds.has(entry.id)) {
      target.push(entry);
      knownIds.add(entry.id);
    }
  });
}

function ensureDemoStudentExperience(db) {
  const hasStudentAccounts = db.users.some((user) => user.role === "student");
  const hasTeacherAccounts = db.users.some((user) => user.role === "teacher");
  const hasLearningRecords = db.enrollments.length || db.feedback.length;

  if (hasStudentAccounts || hasTeacherAccounts || hasLearningRecords) {
    return db;
  }

  const seed = buildSeedData();
  const demoUsers = seed.users.filter((user) => user.role === "teacher" || user.role === "student");

  mergeById(db.users, demoUsers);
  mergeById(db.enrollments, seed.enrollments);
  mergeById(db.feedback, seed.feedback);
  mergeById(db.notifications, seed.notifications);
  mergeById(db.profileComments, seed.profileComments);
  mergeById(db.peerFeedback, seed.peerFeedback);
  mergeById(db.courseRatings, seed.courseRatings);

  const frontendCourse = db.courses.find((course) => course.id === "course_frontend");
  const seededFrontendCourse = seed.courses.find((course) => course.id === "course_frontend");

  if (frontendCourse && seededFrontendCourse) {
    frontendCourse.teacherId = frontendCourse.teacherId || seededFrontendCourse.teacherId;
    frontendCourse.teacherName =
      !frontendCourse.teacherName || frontendCourse.teacherName === "edUKai teaching team"
        ? seededFrontendCourse.teacherName
        : frontendCourse.teacherName;
  }

  return db;
}

initDb(buildSeedData);
updateDb((db) => {
  db.users = (Array.isArray(db.users) ? db.users : []).map((user) => ({
    ...user,
    isOriginalAdmin: Boolean(user.isOriginalAdmin || user.id === "user_admin"),
    moderatorPermissions:
      user.moderatorPermissions && typeof user.moderatorPermissions === "object"
        ? {
            manageUsers: Boolean(user.moderatorPermissions.manageUsers),
            manageCourses: Boolean(user.moderatorPermissions.manageCourses),
          }
        : {
            manageUsers: user.role === "admin" || user.role === "moderator",
            manageCourses: user.role === "admin",
          },
  }));
  db.courses = (Array.isArray(db.courses) ? db.courses : []).map((course) => ({
    ...course,
    materials: Array.isArray(course.materials) ? course.materials : [],
    documents: Array.isArray(course.documents) ? course.documents : [],
    assignments: Array.isArray(course.assignments) ? course.assignments : [],
    exams: Array.isArray(course.exams) ? course.exams : [],
  }));
  db.jobs = (Array.isArray(db.jobs) ? db.jobs : []).map((job) => ({
    ...job,
    status: ["open", "closed"].includes(job.status) ? job.status : "open",
    openings: Math.max(Number(job.openings || 1), 1),
    focusArea: String(job.focusArea || "").trim(),
    postedAt: job.postedAt || job.updatedAt || nowIso(),
    closedAt: job.status === "closed" ? job.closedAt || job.updatedAt || nowIso() : "",
    updatedAt: job.updatedAt || job.postedAt || nowIso(),
  }));
  db.enrollments = Array.isArray(db.enrollments) ? db.enrollments : [];
  db.feedback = Array.isArray(db.feedback) ? db.feedback : [];
  db.payments = Array.isArray(db.payments) ? db.payments : [];
  db.sessions = Array.isArray(db.sessions) ? db.sessions : [];
  db.reminders = Array.isArray(db.reminders) ? db.reminders : [];
  db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
  db.conversations = Array.isArray(db.conversations) ? db.conversations : [];
  db.meetings = Array.isArray(db.meetings) ? db.meetings : [];
  db.communityPosts = (Array.isArray(db.communityPosts) ? db.communityPosts : []).map((post) =>
    normalizeStoredCommunityPost(post, db),
  );
  if (!db.communityPosts.length) {
    db.communityPosts = buildStarterCommunityPosts(db);
  }
  db.reports = Array.isArray(db.reports) ? db.reports : [];
  db.profileComments = Array.isArray(db.profileComments) ? db.profileComments : [];
  db.peerFeedback = Array.isArray(db.peerFeedback) ? db.peerFeedback : [];
  db.courseRatings = Array.isArray(db.courseRatings) ? db.courseRatings : [];
  db.assignmentSubmissions = Array.isArray(db.assignmentSubmissions) ? db.assignmentSubmissions : [];
  ensureDemoStudentExperience(db);
  return db;
});

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = new Set(
      [
        APP_BASE_URL,
        process.env.CLIENT_ORIGIN,
        process.env.CORS_ORIGIN,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
      ]
        .map((value) => {
          try {
            return value ? new URL(value).origin : "";
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    );

    if (allowedOrigins.has(origin) || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_FILE_SIZE_LIMIT_BYTES,
  },
});

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(getUploadsDir()));
app.use("/api/uploads", express.static(getUploadsDir()));
app.use(async (_req, res, next) => {
  try {
    await ensureDbReady();
    next();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message || "Database initialization failed.",
      });
    }
  }
});

function withErrorBoundary(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
      await flushDbWrites();
    } catch (error) {
      console.error(error);
      try {
        await flushDbWrites();
      } catch (flushError) {
        console.error(flushError);
      }

      if (!res.headersSent) {
        res.status(error.statusCode || 500).json({
          error: error.message || "Something went wrong.",
        });
      }
    }
  };
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION || APP_BASE_URL.startsWith("https://"),
    maxAge,
    path: "/",
  };
}

function cleanupSessions(db) {
  const now = Date.now();
  db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
}

function issueSessionCookies(res, userId) {
  const accessToken = createOpaqueToken();
  const refreshToken = createOpaqueToken();
  const now = Date.now();

  updateDb((db) => {
    cleanupSessions(db);
    db.sessions.push(
      {
        id: crypto.randomUUID(),
        userId,
        type: "access",
        tokenHash: hashToken(accessToken),
        expiresAt: new Date(now + ACCESS_TTL_MS).toISOString(),
        createdAt: nowIso(),
      },
      {
        id: crypto.randomUUID(),
        userId,
        type: "refresh",
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(now + REFRESH_TTL_MS).toISOString(),
        createdAt: nowIso(),
      },
    );
  });

  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_TTL_MS));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_TTL_MS));
}

function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions(0));
  res.clearCookie(REFRESH_COOKIE, cookieOptions(0));
}

function consumeSessionToken(token, type) {
  if (!token) {
    return null;
  }

  const tokenHashValue = hashToken(token);
  const db = getDb();
  const now = Date.now();

  return db.sessions.find(
    (session) =>
      session.type === type &&
      session.tokenHash === tokenHashValue &&
      new Date(session.expiresAt).getTime() > now,
  );
}

function deleteSessionTokens(accessToken, refreshToken) {
  updateDb((db) => {
    const hashesToRemove = [accessToken, refreshToken].filter(Boolean).map(hashToken);
    db.sessions = db.sessions.filter((session) => !hashesToRemove.includes(session.tokenHash));
  });
}

function optionalAuth(req, _res, next) {
  const accessToken = req.cookies[ACCESS_COOKIE];
  const session = consumeSessionToken(accessToken, "access");

  if (!session) {
    req.user = null;
    next();
    return;
  }

  const db = getDb();
  req.user = db.users.find((user) => user.id === session.userId) || null;
  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    next();
  });
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You are not allowed to perform this action." });
      return;
    }

    next();
  };
}

function getTeacherUsers(db) {
  return db.users
    .filter((user) => user.role === "teacher" && user.teacherProfile)
    .sort((left, right) => (right.teacherProfile?.score || 0) - (left.teacherProfile?.score || 0));
}

function buildCourseSummary(course, db, user) {
  const teacher = db.users.find((entry) => entry.id === course.teacherId);
  const paymentSummary = user ? buildCoursePaymentSummary(course, user.id, db) : null;
  const ratingSummary = buildCourseRatingSummary(course.id, db);
  const activeEnrollment = user
    ? db.enrollments.find(
        (enrollment) =>
          enrollment.userId === user.id &&
          enrollment.courseId === course.id &&
          enrollment.status === "active",
      )
    : null;

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    description: course.description,
    brief: course.brief,
    duration: course.duration,
    level: course.level,
    priceCents: course.priceCents,
    currency: course.currency,
    published: course.published,
    format: course.format,
    imageKey: course.imageKey,
    thumbnailUrl: course.thumbnailUrl || "",
    category: course.category,
    joinerCount: courseJoinerCount(course.id, db),
    averageRating: ratingSummary.averageRating,
    ratingCount: ratingSummary.ratingCount,
    myRating:
      user && user.role === "student"
        ? db.courseRatings.find((entry) => entry.courseId === course.id && entry.userId === user.id)?.rating || 0
        : 0,
    teacherName: teacher ? safeUser(teacher).displayName : course.teacherName || "Assigned instructor",
    audience: course.audience,
    outcomes: course.outcomes,
    modules: course.modules,
    teacher: teacher
      ? {
          id: teacher.id,
          name: safeUser(teacher).displayName,
          title: teacher.teacherProfile?.title || "Instructor",
          specialty: teacher.teacherProfile?.specialty || "",
        }
      : course.teacherName
        ? {
            id: "",
            name: course.teacherName,
            title: "Instructor",
            specialty: "",
        }
      : null,
    materials: (course.materials || [])
      .filter((item) => item.published !== false || ["admin", "moderator", "teacher"].includes(user?.role || ""))
      .map((item) => ({
        ...item,
        createdByName: db.users.find((entry) => entry.id === item.createdBy)?.displayName || "Staff",
      })),
    documents: (course.documents || [])
      .filter((item) => item.published !== false || ["admin", "moderator", "teacher"].includes(user?.role || ""))
      .map((item) => ({
        ...item,
        createdByName: db.users.find((entry) => entry.id === item.createdBy)?.displayName || "Staff",
      })),
    exams: (course.exams || [])
      .filter((item) => item.published !== false || ["admin", "moderator", "teacher"].includes(user?.role || ""))
      .map((exam) => ({
        ...exam,
        createdByName: db.users.find((entry) => entry.id === exam.createdBy)?.displayName || "Staff",
      })),
    assignments: (course.assignments || [])
      .filter((item) => item.published !== false || ["admin", "moderator", "teacher"].includes(user?.role || ""))
      .map((assignment) => {
        const submission = user ? getAssignmentSubmission(assignment.id, user.id, db) : null;
        const dueAt = assignment.dueAt || "";
        return {
          ...assignment,
          createdByName: db.users.find((entry) => entry.id === assignment.createdBy)?.displayName || "Staff",
          submission,
          isLate:
            Boolean(dueAt) &&
            !submission &&
            new Date(dueAt).getTime() < Date.now(),
        };
      }),
    depositRate: COURSE_DEPOSIT_RATE,
    depositPercentage: Math.round(COURSE_DEPOSIT_RATE * 100),
    depositCents: calculateDepositCents(course.priceCents),
    paymentPlans: {
      full: buildPaymentPlanDescriptor("full", course.priceCents),
      installment: buildPaymentPlanDescriptor("installment", course.priceCents),
      threePayments: buildPaymentPlanDescriptor("three_payments", course.priceCents),
    },
    slots: course.slots.map((slot) => {
      const activeEnrollmentCount = db.enrollments.filter(
        (enrollment) =>
          enrollment.courseId === course.id &&
          enrollment.slotId === slot.id &&
          enrollment.status === "active",
      ).length;

      return {
        id: slot.id,
        name: slot.name,
        days: slot.days,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        capacity: slot.capacity,
        availableSeats: Math.max(slot.capacity - activeEnrollmentCount, 0),
        location: slot.location,
        recordings: slot.recordings,
        chatPreview: slot.chatMessages.slice(-3),
      };
    }),
    pendingEdits:
      user && user.role === "admin"
        ? course.pendingEdits
        : [],
    enrollment: activeEnrollment
      ? {
          id: activeEnrollment.id,
          slotId: activeEnrollment.slotId,
          selectedDays: activeEnrollment.selectedDays,
          daysPerWeek: activeEnrollment.daysPerWeek,
          enrolledAt: activeEnrollment.enrolledAt,
          paymentStatus: activeEnrollment.paymentStatus || "unpaid",
        }
      : null,
    paymentSummary,
    canManage:
      !!user &&
      (user.role === "admin" ||
        user.role === "moderator" ||
        (user.role === "teacher" && user.id === course.teacherId)),
    canPublish:
      !!user &&
      (user.role === "admin" ||
        (user.role === "moderator" && user.moderatorPermissions?.manageCourses)),
    isEnrolled:
      !!user &&
      db.enrollments.some(
        (enrollment) =>
          enrollment.userId === user.id &&
          enrollment.courseId === course.id &&
          enrollment.status === "active",
      ),
  };
}

function getStudentScore(studentId, db) {
  const studentFeedback = db.feedback.filter((entry) => entry.studentId === studentId);

  if (!studentFeedback.length) {
    return 0;
  }

  return Math.round(
    studentFeedback.reduce((sum, entry) => sum + entry.score, 0) / studentFeedback.length,
  );
}

function buildStudentLeaderboard(db, limit) {
  const ranked = db.users
    .filter((user) => user.role === "student")
    .map((student) => ({
      userId: student.id,
      name: safeUser(student).displayName,
      score: getStudentScore(student.id, db),
    }))
    .sort((left, right) => right.score - left.score);

  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}

function buildStudentRanking(userId, db) {
  const ranked = buildStudentLeaderboard(db);

  const position = ranked.findIndex((entry) => entry.userId === userId);

  return {
    position: position >= 0 ? position + 1 : ranked.length,
    totalStudents: ranked.length,
    score: ranked[position]?.score || 0,
    leaderboard: ranked.slice(0, 5),
  };
}

function getDayIndex(dayName) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(dayName);
}

function getNextSlotDate(slot) {
  const now = new Date();
  const [hours, minutes] = slot.startTime.split(":").map(Number);
  const candidates = slot.days
    .map((dayName) => {
      const current = new Date(now);
      const targetDay = getDayIndex(dayName);
      const diff = (targetDay - current.getDay() + 7) % 7;
      current.setDate(current.getDate() + diff);
      current.setHours(hours, minutes, 0, 0);
      if (current <= now) {
        current.setDate(current.getDate() + 7);
      }
      return current;
    })
    .sort((left, right) => left.getTime() - right.getTime());

  return candidates[0];
}

function buildStudentHome(user, db) {
  const enrollments = db.enrollments.filter(
    (enrollment) => enrollment.userId === user.id && enrollment.status === "active",
  );

  const enrolledCourses = enrollments.map((enrollment) => {
    const course = db.courses.find((entry) => entry.id === enrollment.courseId);
    const slot = course?.slots.find((entry) => entry.id === enrollment.slotId);
    const teacher = db.users.find((entry) => entry.id === course?.teacherId);
    const nextSession = slot ? getNextSlotDate(slot) : null;
    const paymentSummary = course ? buildCoursePaymentSummary(course, user.id, db) : null;

    return {
      enrollmentId: enrollment.id,
      courseId: course?.id,
      slug: course?.slug,
      title: course?.title,
      summary: course?.summary,
      imageKey: course?.imageKey,
      thumbnailUrl: course?.thumbnailUrl || "",
      teacherName: teacher ? safeUser(teacher).displayName : course?.teacherName || "Teacher",
      progress: Math.min(98, 40 + slot?.recordings.length * 12),
      paymentStatus: enrollment.paymentStatus || "unpaid",
      remainingCents: paymentSummary?.remainingCents || 0,
      remainingDueAt: paymentSummary?.remainingDueAt || paymentSummary?.checkoutDueAt || null,
      isPaymentPastDue: paymentSummary?.isPastDue || false,
      pastDueStage: paymentSummary?.pastDueStage || "",
      schedule: slot
        ? {
            slotId: slot.id,
            name: slot.name,
            days: slot.days,
            startTime: slot.startTime,
            durationMinutes: slot.durationMinutes,
            location: slot.location,
            nextSession: nextSession?.toISOString() || null,
          }
        : null,
      recordings: slot?.recordings || [],
      calendarUrl: slot ? `/api/calendar/classes/${slot.id}.ics?courseId=${course.id}` : "",
    };
  });

  const currentCourseIds = new Set(enrolledCourses.map((entry) => entry.courseId));
  const classmateIds = Array.from(
    new Set(
      db.enrollments
        .filter(
          (entry) =>
            entry.userId !== user.id &&
            entry.status === "active" &&
            currentCourseIds.has(entry.courseId),
        )
        .map((entry) => entry.userId),
    ),
  );
  const suggestions = db.courses
    .filter((course) => !currentCourseIds.has(course.id))
    .filter((course) => {
      if (user.focusTrack === "Fluency") {
        return course.category === "language";
      }

      if (user.focusTrack === "Professional Development") {
        return course.category === "business";
      }

      return course.category === "technology" || course.category === "language";
    })
    .sort((left, right) => {
      const leftRating = buildCourseRatingSummary(left.id, db);
      const rightRating = buildCourseRatingSummary(right.id, db);

      if (rightRating.averageRating !== leftRating.averageRating) {
        return rightRating.averageRating - leftRating.averageRating;
      }

      return courseJoinerCount(right.id, db) - courseJoinerCount(left.id, db);
    })
    .slice(0, 3)
    .map((course) => buildCourseSummary(course, db, user));

  const feedback = db.feedback
    .filter((entry) => entry.studentId === user.id)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((entry) => {
      const teacher = db.users.find((userEntry) => userEntry.id === entry.teacherId);
      const course = db.courses.find((courseEntry) => courseEntry.id === entry.courseId);
      return {
        id: entry.id,
        score: entry.score,
        comment: entry.comment,
        createdAt: entry.createdAt,
        teacherName: teacher ? safeUser(teacher).displayName : "Teacher",
        courseTitle: course?.title || "Course",
      };
    });

  const peerFeedback = db.peerFeedback
    .filter((entry) => entry.targetUserId === user.id)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((entry) => buildPeerFeedbackSummary(entry, db));

  const profileComments = db.profileComments
    .filter((entry) => entry.targetUserId === user.id)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((entry) => buildProfileCommentSummary(entry, db));

  const classmates = classmateIds
    .map((classmateId) => db.users.find((entry) => entry.id === classmateId))
    .filter(Boolean)
    .map((classmate) => ({
      id: classmate.id,
      displayName: safeUser(classmate).displayName,
      role: classmate.role,
      bio: classmate.bio,
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const assignmentReminders = enrolledCourses
    .flatMap((course) =>
      (course.assignments || [])
        .filter((assignment) => assignment.published !== false)
        .map((assignment) => ({
          courseId: course.courseId,
          courseTitle: course.title,
          courseSlug: course.slug,
          assignmentId: assignment.id,
          title: assignment.title,
          dueAt: assignment.dueAt,
          penaltyNote: assignment.penaltyNote || "Upload before the deadline to avoid a penalty.",
          submittedAt: assignment.submission?.submittedAt || "",
          isLate: assignment.isLate,
        })),
    )
    .filter((assignment) => !assignment.submittedAt)
    .sort((left, right) => new Date(left.dueAt || 0) - new Date(right.dueAt || 0));

  return {
    user: safeUser(user),
    enrolledCourses,
    ranking: buildStudentRanking(user.id, db),
    certificates: user.certificates || [],
    badges: (user.badges || []).filter((badge) => !user.privateBadges || badge.public),
    feedback,
    peerFeedback,
    profileComments,
    classmates,
    assignmentReminders,
    suggestions,
  };
}

function buildRoleSummary(user, db) {
  const pastDuePayments = getPastDuePaymentCases(db);
  const dueSoonPayments = getDueSoonPaymentCases(db);
  const students = db.users.filter((entry) => entry.role === "student");
  const studentsWithoutCourse = students.filter(
    (student) => !db.enrollments.some((entry) => entry.userId === student.id && entry.status === "active"),
  );
  const activeEnrollments = db.enrollments.filter((entry) => entry.status === "active");
  const communityPostCount = db.communityPosts.length;
  const communityCommentCount = db.communityPosts.reduce(
    (sum, post) => sum + (post.comments || []).length,
    0,
  );
  const communityReactionCount = db.communityPosts.reduce(
    (sum, post) => sum + (post.reactions || []).length,
    0,
  );
  const communityAttachmentCount = db.communityPosts.reduce(
    (sum, post) => sum + (post.attachments || []).length,
    0,
  );
  const activeMeetings = db.meetings.filter((entry) => entry.status === "active");
  const scheduledMeetings = db.meetings.filter((entry) => entry.status === "scheduled");
  const endedMeetings = db.meetings.filter((entry) => entry.status === "ended");
  const pendingApprovals = db.courses.reduce((sum, course) => sum + (course.pendingEdits || []).length, 0);
  const publishedCoursesCount = db.courses.filter((course) => course.published !== false).length;
  const draftCoursesCount = db.courses.filter((course) => course.published === false).length;
  const openJobsCount = db.jobs.filter((entry) => entry.status !== "closed").length;
  const closedJobsCount = db.jobs.filter((entry) => entry.status === "closed").length;
  const openReports = db.reports
    .filter((entry) => ["open", "reviewing"].includes(entry.status || "open"))
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const recentReports = openReports.slice(0, 8).map((entry) => buildReportSummary(entry, db));
  const courseEnrollmentChart = db.courses
    .map((course) => ({
      id: course.id,
      label: course.title,
      value: db.enrollments.filter((entry) => entry.courseId === course.id && entry.status === "active").length,
    }))
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
  const reportsByTypeChart = [
    {
      label: "Post reports",
      value: openReports.filter((entry) => entry.targetType === "community_post").length,
    },
    {
      label: "Comment reports",
      value: openReports.filter(
        (entry) => entry.targetType === "community_comment" || entry.targetType === "profile_comment",
      ).length,
    },
    {
      label: "Feedback reports",
      value: openReports.filter((entry) => entry.targetType === "profile_feedback").length,
    },
  ];
  const paymentStatusChart = [
    { label: "Due soon", value: dueSoonPayments.length },
    { label: "Past due", value: pastDuePayments.length },
    {
      label: "Paid records",
      value: db.payments.filter((entry) => entry.status === "paid").length,
    },
  ];
  const roleDistributionChart = [
    { label: "Admins", value: db.users.filter((entry) => entry.role === "admin").length },
    { label: "Moderators", value: db.users.filter((entry) => entry.role === "moderator").length },
    { label: "Teachers", value: db.users.filter((entry) => entry.role === "teacher").length },
    { label: "Students", value: students.length },
  ];
  const communityActivityChart = [
    { label: "Posts", value: communityPostCount },
    { label: "Comments", value: communityCommentCount },
    { label: "Reactions", value: communityReactionCount },
    { label: "Attachments", value: communityAttachmentCount },
  ];
  const meetingHealthChart = [
    { label: "Active rooms", value: activeMeetings.length },
    { label: "Scheduled rooms", value: scheduledMeetings.length },
    { label: "Ended rooms", value: endedMeetings.length },
    { label: "Direct chats", value: db.conversations.length },
  ];
  const contentHealthChart = [
    { label: "Published courses", value: publishedCoursesCount },
    { label: "Draft courses", value: draftCoursesCount },
    { label: "Pending approvals", value: pendingApprovals },
    { label: "Open jobs", value: openJobsCount },
    { label: "Closed jobs", value: closedJobsCount },
  ];
  const totalRevenueCents = db.payments
    .filter((entry) => entry.status === "paid")
    .reduce((sum, entry) => sum + Number(entry.amountCents || 0), 0);
  const commonInsights = {
    overview: {
      totalUsers: db.users.length,
      activeEnrollments: activeEnrollments.length,
      communityPosts: communityPostCount,
      openReports: openReports.length,
      activeMeetings: activeMeetings.length,
      directChats: db.conversations.length,
      publishedCourses: publishedCoursesCount,
      openJobs: openJobsCount,
    },
    reports: {
      openCount: openReports.length,
      recent: recentReports,
    },
    payments: {
      dueSoon: dueSoonPayments,
      pastDue: pastDuePayments,
      totalRevenueCents,
    },
    enrollments: {
      studentsWithoutCourseCount: studentsWithoutCourse.length,
      studentsWithoutCourse: studentsWithoutCourse
        .slice(0, 8)
        .map((student) => ({ id: student.id, displayName: safeUser(student).displayName })),
      courseChart: courseEnrollmentChart,
    },
    charts: {
      reports: reportsByTypeChart,
      payments: paymentStatusChart,
      roles: roleDistributionChart,
      community: communityActivityChart,
      meetings: meetingHealthChart,
      content: contentHealthChart,
      enrollments: courseEnrollmentChart,
    },
  };

  if (user.role === "admin") {
    return {
      title: "Admin Dashboard",
      summary: "Manage users, moderate reports, track payments, and monitor course joins across the platform.",
      stats: [
        { label: "Pending approvals", value: String(pendingApprovals) },
        { label: "Past due payments", value: String(pastDuePayments.length) },
        { label: "Open reports", value: String(openReports.length) },
        { label: "Students without course", value: String(studentsWithoutCourse.length) },
      ],
      priorities: [
        "Review moderator edit requests before they go live.",
        "Follow up on students with due-soon and past-due balances.",
        "Review new community and profile reports quickly.",
        "Track which courses are converting new student signups into active enrollments.",
      ],
      ...commonInsights,
    };
  }

  if (user.role === "moderator") {
    return {
      title: "Moderator Dashboard",
      summary: "Review reports, keep discussions safe, and monitor payment or enrollment risks before they escalate.",
      stats: [
        { label: "Past due payments", value: String(pastDuePayments.length) },
        { label: "Open reports", value: String(openReports.length) },
        { label: "Students without course", value: String(studentsWithoutCourse.length) },
        { label: "Live cohorts", value: String(db.courses.reduce((sum, course) => sum + course.slots.length, 0)) },
      ],
      priorities: [
        "Review flagged community posts, comments, and profile feedback.",
        "Follow up on due-soon and overdue student balances.",
        "Prepare course edits for admin approval.",
        "Watch which new students still have not joined a class.",
      ],
      ...commonInsights,
    };
  }

  if (user.role === "teacher") {
    const ownCourses = db.courses.filter((course) => course.teacherId === user.id);
    const ownEnrollments = db.enrollments.filter((enrollment) =>
      ownCourses.some((course) => course.id === enrollment.courseId),
    );

    return {
      title: "Teacher Dashboard",
      summary: "Manage your classes, update course details, review student progress, and keep recordings organized.",
      stats: [
        { label: "Assigned courses", value: String(ownCourses.length) },
        { label: "Students", value: String(ownEnrollments.length) },
        { label: "Class slots", value: String(ownCourses.reduce((sum, course) => sum + course.slots.length, 0)) },
        { label: "Feedback left", value: String(db.feedback.filter((entry) => entry.teacherId === user.id).length) },
      ],
      priorities: [
        "Keep your course brief, thumbnail, and slot schedule current.",
        "Review student progress and add comments after sessions.",
        "Prepare class recordings and notes for enrolled students.",
      ],
    };
  }

  return {
    title: "Student Dashboard",
    summary: "Track classes, badges, certificates, and feedback from your teachers.",
    stats: [
      { label: "Courses", value: String(db.enrollments.filter((entry) => entry.userId === user.id && entry.status === "active").length) },
      { label: "Badges", value: String((user.badges || []).length) },
      { label: "Certificates", value: String((user.certificates || []).length) },
      { label: "Feedback", value: String(db.feedback.filter((entry) => entry.studentId === user.id).length) },
    ],
    priorities: [
      "Check your next class time and export reminders to your calendar.",
      "Review teacher notes after each course session.",
      "Explore recommended tracks based on your recent enrollments.",
    ],
  };
}

function buildPersonProfile(viewer, targetUser, db) {
  const comments = db.profileComments
    .filter((entry) => entry.targetUserId === targetUser.id)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((entry) => buildProfileCommentSummary(entry, db, viewer));

  const peerFeedback = db.peerFeedback
    .filter((entry) => entry.targetUserId === targetUser.id)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((entry) => buildPeerFeedbackSummary(entry, db, viewer));

  const teacherFeedback = db.feedback
    .filter((entry) => entry.studentId === targetUser.id)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((entry) => {
      const teacher = db.users.find((userEntry) => userEntry.id === entry.teacherId);
      const course = db.courses.find((courseEntry) => courseEntry.id === entry.courseId);
      return {
        id: entry.id,
        score: entry.score,
        comment: entry.comment,
        createdAt: entry.createdAt,
        teacherName: teacher ? safeUser(teacher).displayName : "Teacher",
        courseTitle: course?.title || "Course",
        canDelete: Boolean(
          viewer &&
            (viewer.id === entry.teacherId || viewer.id === targetUser.id || canModerateCommunity(viewer)),
        ),
        canReport: Boolean(viewer && viewer.id !== entry.teacherId),
      };
    });
  const paymentHistory =
    viewer.id === targetUser.id
      ? db.payments
          .filter((entry) => entry.userId === targetUser.id)
          .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
          .map((entry) => {
            const summary = summarizePaymentRecord(entry, db);
            return {
              ...summary,
              paymentStage: entry.paymentStage || "deposit",
              paymentPlan: entry.paymentPlan || "installment",
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt || entry.createdAt,
              checkoutUrl: entry.checkoutUrl || "",
              mode: entry.mode || "mock",
            };
          })
      : [];

  return {
    user: safeUser(targetUser),
    comments,
    peerFeedback,
    teacherFeedback,
    paymentHistory,
    canComment: canCommentOnPerson(viewer, targetUser, db),
    canLeavePeerFeedback:
      viewer.id !== targetUser.id &&
      viewer.role === "student" &&
      targetUser.role === "student" &&
      usersShareActiveCourse(viewer.id, targetUser.id, db),
    canLeaveTeacherFeedback:
      viewer.id !== targetUser.id &&
      ["teacher", "admin", "moderator"].includes(viewer.role) &&
      targetUser.role === "student",
  };
}

function validatePasswordStrength(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

function isLoginLocked(key) {
  const entry = LOGIN_ATTEMPTS.get(key);
  return entry && entry.lockedUntil > Date.now();
}

function recordFailedLogin(key) {
  const current = LOGIN_ATTEMPTS.get(key) || { count: 0, lockedUntil: 0 };
  const count = current.count + 1;
  const lockedUntil = count >= 5 ? Date.now() + 10 * 60 * 1000 : 0;
  LOGIN_ATTEMPTS.set(key, { count, lockedUntil });
}

function clearFailedLogin(key) {
  LOGIN_ATTEMPTS.delete(key);
}

function calculateDepositCents(priceCents) {
  return Math.max(0, Math.ceil(Number(priceCents || 0) * COURSE_DEPOSIT_RATE));
}

function normalizePaymentPlan(value) {
  return value === "full" || value === "three_payments" ? value : "installment";
}

function splitIntoEqualInstallments(totalCents, count) {
  const safeCount = Math.max(Number(count || 1), 1);
  const baseAmount = Math.floor(Number(totalCents || 0) / safeCount);
  const remainder = Math.max(Number(totalCents || 0) - baseAmount * safeCount, 0);

  return Array.from({ length: safeCount }, (_, index) => baseAmount + (index < remainder ? 1 : 0));
}

function buildPaymentPlanInstallments(fullAmountCents, paymentPlan = "installment") {
  const normalizedPlan = normalizePaymentPlan(paymentPlan);
  const safeFullAmount = Math.max(Number(fullAmountCents || 0), 0);

  if (normalizedPlan === "full") {
    return [safeFullAmount];
  }

  if (normalizedPlan === "three_payments") {
    return splitIntoEqualInstallments(safeFullAmount, 3);
  }

  const depositCents = calculateDepositCents(safeFullAmount);
  return [depositCents, Math.max(safeFullAmount - depositCents, 0)];
}

function buildPaymentPlanDescriptor(paymentPlan, fullAmountCents) {
  const normalizedPlan = normalizePaymentPlan(paymentPlan);
  const installments = buildPaymentPlanInstallments(fullAmountCents, normalizedPlan);
  const depositPercentage = Math.round(COURSE_DEPOSIT_RATE * 100);

  if (normalizedPlan === "full") {
    return {
      key: "full",
      label: "Full payment",
      shortLabel: "Full",
      summary: "Pay the whole course amount at once and unlock the complete balance immediately.",
      installmentCount: 1,
      installments,
      initialAmountCents: installments[0] || 0,
      depositPercentage,
    };
  }

  if (normalizedPlan === "three_payments") {
    return {
      key: "three_payments",
      label: "3 payments",
      shortLabel: "3 payments",
      summary: "Split the course fee into three scheduled payments with the same account tracking and reminders.",
      installmentCount: installments.length,
      installments,
      initialAmountCents: installments[0] || 0,
      depositPercentage,
    };
  }

  return {
    key: "installment",
    label: `${depositPercentage}% deposit`,
    shortLabel: "Deposit plan",
    summary: `Reserve your seat with ${depositPercentage}% now, then finish the remaining balance before the course ends.`,
    installmentCount: installments.length,
    installments,
    initialAmountCents: installments[0] || 0,
    depositPercentage,
  };
}

function getPaymentInstallmentCount(payment, course) {
  return Number(
    payment?.installmentCount ||
      buildPaymentPlanDescriptor(
        payment?.paymentPlan,
        payment?.fullAmountCents || course?.priceCents || payment?.amountCents || 0,
      ).installmentCount,
  );
}

function getPaymentInstallmentIndex(payment, course) {
  if (payment?.installmentIndex) {
    return Number(payment.installmentIndex);
  }

  const normalizedPlan = normalizePaymentPlan(payment?.paymentPlan);

  if (normalizedPlan === "full") {
    return 1;
  }

  if (normalizedPlan === "installment") {
    return payment?.paymentStage === "remaining" ? 2 : 1;
  }

  if (payment?.paymentStage === "final") {
    return getPaymentInstallmentCount(payment, course);
  }

  return 1;
}

function getPaymentStageMeta(paymentPlan, installmentIndex, installmentCount, fullAmountCents) {
  const normalizedPlan = normalizePaymentPlan(paymentPlan);
  const planDetails = buildPaymentPlanDescriptor(normalizedPlan, fullAmountCents);

  if (normalizedPlan === "full") {
    return {
      paymentStage: "full",
      stageKey: "full-1",
      stageLabel: "Full payment",
      reminderLabel: "full payment",
      planLabel: planDetails.label,
    };
  }

  if (normalizedPlan === "installment" && installmentIndex === 1) {
    return {
      paymentStage: "deposit",
      stageKey: "installment-1",
      stageLabel: `${planDetails.depositPercentage}% deposit`,
      reminderLabel: "deposit",
      planLabel: planDetails.label,
    };
  }

  if (normalizedPlan === "installment") {
    return {
      paymentStage: "remaining",
      stageKey: "installment-2",
      stageLabel: "Remaining balance",
      reminderLabel: "remaining balance",
      planLabel: planDetails.label,
    };
  }

  if (installmentIndex >= installmentCount) {
    return {
      paymentStage: "final",
      stageKey: `${normalizedPlan}-${installmentIndex}`,
      stageLabel: "Final payment",
      reminderLabel: "final payment",
      planLabel: planDetails.label,
    };
  }

  return {
    paymentStage: "installment",
    stageKey: `${normalizedPlan}-${installmentIndex}`,
    stageLabel: `Payment ${installmentIndex} of ${installmentCount}`,
    reminderLabel: `payment ${installmentIndex} of ${installmentCount}`,
    planLabel: planDetails.label,
  };
}

function addDaysToIso(value, days) {
  const anchor = value ? new Date(value) : new Date();
  return new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isPastDate(value) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function formatCurrency(amountCents, currency = "EGP") {
  return `${(Number(amountCents || 0) / 100).toLocaleString("en-US")} ${currency}`;
}

function getPaymentCheckoutDueAt(payment) {
  return payment?.dueAt || addDaysToIso(payment?.createdAt, PAYMENT_CHECKOUT_GRACE_DAYS);
}

function getRemainingBalanceDueAt(payment) {
  return payment?.remainingDueAt || addDaysToIso(payment?.updatedAt || payment?.createdAt, REMAINING_PAYMENT_GRACE_DAYS);
}

function normalizePlatformEmail(value) {
  const normalized = normalizeEmail(value);

  if (!normalized) {
    return "";
  }

  if (!normalized.includes("@")) {
    return `${normalized}@${EMAIL_DOMAIN}`;
  }

  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain) {
    throw createError(400, "Please provide a valid email address.");
  }

  if (domain !== EMAIL_DOMAIN) {
    throw createError(400, `Email must use the @${EMAIL_DOMAIN} domain.`);
  }

  return `${localPart}@${domain}`;
}

function buildCoursePaymentSummary(course, userId, db) {
  const depositCents = calculateDepositCents(course.priceCents);
  const relatedPayments = db.payments
    .filter((payment) => payment.userId === userId && payment.courseId === course.id)
    .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt));
  const paidCents = relatedPayments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amountCents || 0), 0);
  const pendingCents = relatedPayments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + Number(payment.amountCents || 0), 0);
  const latestPayment = relatedPayments[0] || null;
  const latestPaymentSummary = latestPayment ? summarizePaymentRecord(latestPayment, db) : null;

  return {
    depositRate: COURSE_DEPOSIT_RATE,
    depositPercentage: Math.round(COURSE_DEPOSIT_RATE * 100),
    depositCents,
    paymentPlans: {
      full: buildPaymentPlanDescriptor("full", course.priceCents),
      installment: buildPaymentPlanDescriptor("installment", course.priceCents),
      threePayments: buildPaymentPlanDescriptor("three_payments", course.priceCents),
    },
    totalPaidCents: paidCents,
    pendingCents,
    remainingCents: latestPaymentSummary?.remainingCents ?? Math.max(Number(course.priceCents || 0) - paidCents, 0),
    isDepositSatisfied: paidCents >= depositCents,
    latestPaymentId: latestPayment?.id || "",
    latestPaymentStatus: latestPayment?.status || "unpaid",
    latestPaymentPlan: latestPaymentSummary?.paymentPlan || "",
    latestPaymentPlanLabel: latestPaymentSummary?.paymentPlanLabel || "",
    nextInstallmentIndex: latestPaymentSummary?.nextInstallmentIndex || null,
    nextInstallmentAmountCents: latestPaymentSummary?.nextInstallmentAmountCents || 0,
    nextStageLabel: latestPaymentSummary?.nextStageLabel || "",
    checkoutDueAt: latestPaymentSummary?.checkoutDueAt || null,
    remainingDueAt: latestPaymentSummary?.remainingDueAt || null,
    dueAt: latestPaymentSummary?.dueAt || null,
    dueStageLabel: latestPaymentSummary?.dueStageLabel || "",
    isPastDue: latestPaymentSummary?.isPastDue || false,
    pastDueStage: latestPaymentSummary?.dueStage || "",
    pastDueStageLabel: latestPaymentSummary?.dueStageLabel || "",
    pastDueAmountCents: latestPaymentSummary?.pastDueAmountCents || 0,
  };
}

function pushNotification(db, userId, payload) {
  if (!userId) {
    return;
  }

  db.notifications.unshift({
    id: crypto.randomUUID(),
    userId,
    type: payload.type || "general",
    title: payload.title,
    message: payload.message,
    link: payload.link || "",
    read: false,
    createdAt: nowIso(),
    meta: payload.meta || {},
  });
}

function pushNotifications(db, userIds, payload) {
  Array.from(new Set((userIds || []).filter(Boolean))).forEach((userId) => {
    pushNotification(db, userId, payload);
  });
}

function isStaffUser(user) {
  return Boolean(user && ["admin", "moderator"].includes(user.role));
}

function canModerateCommunity(user) {
  return isStaffUser(user);
}

function getStaffUserIds(db) {
  return db.users.filter((entry) => isStaffUser(entry)).map((entry) => entry.id);
}

function summarizeReportTargetLink(report) {
  if (report.targetType.startsWith("community_")) {
    return "/community";
  }

  if (report.targetUserId) {
    return `/people/${report.targetUserId}`;
  }

  return "/dashboard";
}

function getResponsibleTeacherIdsForCourse(courseId, db) {
  const course = resolveCourse(db, courseId);
  return course?.teacherId ? [course.teacherId] : [];
}

function getResponsibleTeacherIdsForUsers(userIds, db) {
  const relatedCourseIds = new Set(
    db.enrollments
      .filter((entry) => userIds.includes(entry.userId) && entry.status === "active")
      .map((entry) => entry.courseId),
  );

  return Array.from(
    new Set(
      db.courses
        .filter((course) => relatedCourseIds.has(course.id) && course.teacherId)
        .map((course) => course.teacherId),
    ),
  );
}

function buildReportSummary(report, db) {
  const reporter = db.users.find((entry) => entry.id === report.reporterId);
  const reportedUser = db.users.find((entry) => entry.id === report.reportedUserId);
  const targetUser = db.users.find((entry) => entry.id === report.targetUserId);

  return {
    id: report.id,
    targetType: report.targetType,
    reason: report.reason,
    excerpt: report.excerpt || "",
    status: report.status || "open",
    createdAt: report.createdAt,
    updatedAt: report.updatedAt || report.createdAt,
    link: summarizeReportTargetLink(report),
    reporter: reporter
      ? {
          id: reporter.id,
          role: reporter.role,
          displayName: safeUser(reporter).displayName,
        }
      : null,
    reportedUser: reportedUser
      ? {
          id: reportedUser.id,
          role: reportedUser.role,
          displayName: safeUser(reportedUser).displayName,
        }
      : null,
    targetUser: targetUser
      ? {
          id: targetUser.id,
          role: targetUser.role,
          displayName: safeUser(targetUser).displayName,
        }
      : null,
  };
}

function createReportRecord(db, payload) {
  const existing = db.reports.find(
    (entry) =>
      entry.reporterId === payload.reporterId &&
      entry.targetType === payload.targetType &&
      entry.targetId === payload.targetId &&
      ["open", "reviewing"].includes(entry.status || "open"),
  );

  if (existing) {
    return existing;
  }

  const report = {
    id: crypto.randomUUID(),
    reporterId: payload.reporterId,
    reportedUserId: payload.reportedUserId || "",
    targetUserId: payload.targetUserId || "",
    targetType: payload.targetType,
    targetId: payload.targetId,
    reason: normalizeDynamicText(payload.reason || "Needs review"),
    excerpt: normalizeDynamicText(payload.excerpt || "").slice(0, 180),
    courseId: payload.courseId || "",
    postId: payload.postId || "",
    commentId: payload.commentId || "",
    status: "open",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.reports.unshift(report);

  const relatedTeacherIds = payload.courseId
    ? getResponsibleTeacherIdsForCourse(payload.courseId, db)
    : getResponsibleTeacherIdsForUsers(
        [payload.reporterId, payload.reportedUserId, payload.targetUserId].filter(Boolean),
        db,
      );

  pushNotifications(db, [...getStaffUserIds(db), ...relatedTeacherIds], {
    type: "report",
    title: "New moderation report",
    message: `${payload.subject || "A report"} was submitted and is waiting for review.`,
    link: summarizeReportTargetLink(report),
    meta: {
      reportId: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
    },
  });

  if (payload.reportedUserId) {
    pushNotification(db, payload.reportedUserId, {
      type: "report",
      title: "Content under review",
      message: "One of your community or profile contributions was reported and is being reviewed.",
      link: summarizeReportTargetLink(report),
      meta: {
        reportId: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
      },
    });
  }

  if (payload.reporterId) {
    pushNotification(db, payload.reporterId, {
      type: "report",
      title: "Report received",
      message: "Your report was sent to the moderation team.",
      link: summarizeReportTargetLink(report),
      meta: {
        reportId: report.id,
      },
    });
  }

  return report;
}

function resolveReportsForTargets(db, targets) {
  const keys = new Set(targets.map((entry) => `${entry.targetType}:${entry.targetId}`));

  db.reports = db.reports.map((report) =>
    keys.has(`${report.targetType}:${report.targetId}`) && ["open", "reviewing"].includes(report.status || "open")
      ? {
          ...report,
          status: "resolved",
          updatedAt: nowIso(),
          resolvedAt: nowIso(),
        }
      : report,
  );
}

function summarizePaymentRecord(payment, db) {
  const course = resolveCourse(db, payment.courseId);
  const student = db.users.find((entry) => entry.id === payment.userId) || null;
  const fullAmountCents = Number(payment.fullAmountCents || course?.priceCents || payment.amountCents || 0);
  const normalizedPlan = normalizePaymentPlan(payment.paymentPlan);
  const planDetails = buildPaymentPlanDescriptor(normalizedPlan, fullAmountCents);
  const installmentCount = getPaymentInstallmentCount(payment, course);
  const installmentIndex = getPaymentInstallmentIndex(payment, course);
  const stageMeta = getPaymentStageMeta(normalizedPlan, installmentIndex, installmentCount, fullAmountCents);
  const totalPaidForCourse = db.payments
    .filter((entry) => entry.userId === payment.userId && entry.courseId === payment.courseId && entry.status === "paid")
    .reduce((sum, entry) => sum + Number(entry.amountCents || 0), 0);
  const completedInstallmentCount = db.payments
    .filter((entry) => entry.userId === payment.userId && entry.courseId === payment.courseId && entry.status === "paid")
    .reduce(
      (highestIndex, entry) => Math.max(highestIndex, getPaymentInstallmentIndex(entry, course)),
      0,
    );
  const remainingCents = Math.max(fullAmountCents - totalPaidForCourse, 0);
  const nextInstallmentIndex =
    remainingCents > 0 && completedInstallmentCount < planDetails.installmentCount
      ? completedInstallmentCount + 1
      : null;
  const nextStageMeta = nextInstallmentIndex
    ? getPaymentStageMeta(normalizedPlan, nextInstallmentIndex, planDetails.installmentCount, fullAmountCents)
    : null;
  const nextInstallmentAmountCents = nextInstallmentIndex
    ? planDetails.installments[nextInstallmentIndex - 1] || 0
    : 0;
  const checkoutDueAt = payment.status === "pending" ? getPaymentCheckoutDueAt(payment) : null;
  const pendingNextPayment =
    payment.status === "paid" && nextInstallmentIndex
      ? db.payments.find(
          (entry) =>
            entry.userId === payment.userId &&
            entry.courseId === payment.courseId &&
            entry.status === "pending" &&
            getPaymentInstallmentIndex(entry, course) === nextInstallmentIndex,
        ) || null
      : null;
  const remainingDueAt =
    payment.status === "paid" && remainingCents > 0 && !pendingNextPayment
      ? getRemainingBalanceDueAt(payment)
      : null;
  const dueAt = payment.status === "pending" ? checkoutDueAt : remainingDueAt;
  const dueStageMeta = payment.status === "pending" ? stageMeta : nextStageMeta;
  const isPastDue = Boolean(dueAt && dueStageMeta && isPastDate(dueAt));

  return {
    paymentId: payment.id,
    userId: payment.userId,
    studentName: student ? safeUser(student).displayName : "Student",
    role: student?.role || "",
    courseId: course?.id || payment.courseId,
    courseTitle: course?.title || "Course",
    currency: payment.currency || course?.currency || "EGP",
    status: payment.status,
    paymentStage: stageMeta.paymentStage,
    paymentPlan: normalizedPlan,
    paymentPlanLabel: planDetails.label,
    paymentPlanDetails: planDetails,
    amountCents: Number(payment.amountCents || 0),
    fullAmountCents,
    totalPaidForCourse,
    remainingCents,
    installmentIndex,
    installmentCount,
    completedInstallmentCount,
    currentStageLabel: stageMeta.stageLabel,
    currentStageKey: stageMeta.stageKey,
    nextInstallmentIndex,
    nextInstallmentAmountCents,
    nextStageLabel: nextStageMeta?.stageLabel || "",
    hasPendingNextInstallment: Boolean(pendingNextPayment),
    pendingNextPaymentId: pendingNextPayment?.id || "",
    checkoutDueAt,
    remainingDueAt,
    dueAt,
    dueStage: dueStageMeta?.paymentStage || "",
    dueStageKey: dueStageMeta?.stageKey || "",
    dueStageLabel: dueStageMeta?.stageLabel || "",
    pastDueStage: isPastDue ? dueStageMeta?.paymentStage || "" : "",
    pastDueAmountCents: payment.status === "pending" ? Number(payment.amountCents || 0) : nextInstallmentAmountCents,
    isPastDue,
  };
}

function getPastDuePaymentCases(db) {
  const seen = new Set();

  return db.payments
    .map((payment) => summarizePaymentRecord(payment, db))
    .filter((summary) => summary.role === "student" && summary.isPastDue)
    .filter((summary) => {
      const key = `${summary.userId}:${summary.courseId}:${summary.dueStageKey}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => new Date(left.dueAt || 0) - new Date(right.dueAt || 0));
}

function findPastDuePaymentsForUser(userId, db) {
  return getPastDuePaymentCases(db).filter((entry) => entry.userId === userId);
}

function getDueSoonPaymentCases(db, leadDays = 3) {
  const seen = new Set();
  const maxDiffMs = leadDays * 24 * 60 * 60 * 1000;

  return db.payments
    .map((payment) => summarizePaymentRecord(payment, db))
    .filter((summary) => summary.role === "student" && !summary.isPastDue)
    .filter((summary) => summary.dueAt)
    .filter((summary) => {
      const dueMs = new Date(summary.dueAt).getTime();
      const diffMs = dueMs - Date.now();
      return diffMs > 0 && diffMs <= maxDiffMs;
    })
    .filter((summary) => {
      const key = `${summary.userId}:${summary.courseId}:${summary.dueStageKey}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => new Date(left.dueAt) - new Date(right.dueAt));
}

function hasDueSoonNotification(db, userId, paymentId, stage) {
  return db.notifications.some(
    (notification) =>
      notification.userId === userId &&
      notification.type === "payment_reminder" &&
      notification.meta?.paymentId === paymentId &&
      notification.meta?.stage === stage,
  );
}

function hasPastDueNotification(db, userId, paymentId, stage) {
  return db.notifications.some(
    (notification) =>
      notification.userId === userId &&
      notification.type === "payment_overdue" &&
      notification.meta?.paymentId === paymentId &&
      notification.meta?.stage === stage,
  );
}

function ensurePastDuePaymentAlerts(db) {
  const staffIds = db.users
    .filter((entry) => ["admin", "moderator"].includes(entry.role))
    .map((entry) => entry.id);

  getPastDuePaymentCases(db).forEach((summary) => {
    const dueCopy =
      summary.dueStage === "deposit"
        ? `${summary.studentName} did not confirm the ${formatCurrency(summary.pastDueAmountCents, summary.currency)} deposit for ${summary.courseTitle}.`
        : `${summary.studentName} still owes ${formatCurrency(summary.pastDueAmountCents, summary.currency)} for ${summary.courseTitle} (${summary.dueStageLabel.toLowerCase()}).`;

    staffIds.forEach((staffId) => {
      if (hasPastDueNotification(db, staffId, summary.paymentId, summary.dueStageKey)) {
        return;
      }

      pushNotification(db, staffId, {
        type: "payment_overdue",
        title: "Past due student payment",
        message: `${dueCopy} Remove the account if payment is not resolved.`,
        link: "/dashboard",
        meta: {
          paymentId: summary.paymentId,
          stage: summary.dueStageKey,
          studentId: summary.userId,
          courseId: summary.courseId,
          amountCents: summary.pastDueAmountCents,
        },
      });
    });
  });
}

function ensureUpcomingPaymentReminders(db) {
  getDueSoonPaymentCases(db).forEach((summary) => {
    if (hasDueSoonNotification(db, summary.userId, summary.paymentId, summary.dueStageKey)) {
      return;
    }

    pushNotification(db, summary.userId, {
      type: "payment_reminder",
      title: "Upcoming payment due date",
      message: `Your ${summary.dueStageLabel.toLowerCase()} for ${summary.courseTitle} is due by ${new Date(summary.dueAt).toLocaleDateString("en-GB")}.`,
      link: `/payments?paymentId=${summary.paymentId}`,
      meta: {
        paymentId: summary.paymentId,
        stage: summary.dueStageKey,
        courseId: summary.courseId,
      },
    });
  });
}

function canChangeUserRole(actingUser, targetUser) {
  if (
    !actingUser ||
    !targetUser ||
    !canManageUsersByPermission(actingUser) ||
    actingUser.id === targetUser.id ||
    targetUser.isOriginalAdmin
  ) {
    return false;
  }

  if (actingUser.role === "admin") {
    return ["student", "teacher", "moderator", "admin"].includes(targetUser.role);
  }

  if (actingUser.role === "moderator") {
    return ["student", "teacher"].includes(targetUser.role);
  }

  return false;
}

function canDeleteUser(actingUser, targetUser) {
  if (
    !actingUser ||
    !targetUser ||
    !canManageUsersByPermission(actingUser) ||
    actingUser.id === targetUser.id ||
    targetUser.isOriginalAdmin
  ) {
    return false;
  }

  if (actingUser.role === "admin") {
    return ["student", "teacher", "moderator", "admin"].includes(targetUser.role);
  }

  if (actingUser.role === "moderator") {
    return ["student", "teacher"].includes(targetUser.role);
  }

  return false;
}

function buildManagedUser(targetUser, db, actingUser) {
  const overdueItems = findPastDuePaymentsForUser(targetUser.id, db).map((entry) => ({
    paymentId: entry.paymentId,
    courseId: entry.courseId,
    courseTitle: entry.courseTitle,
    stage: entry.dueStage,
    stageLabel: entry.dueStageLabel,
    amountCents: entry.pastDueAmountCents,
    currency: entry.currency,
    dueAt: entry.dueAt || null,
  }));
  const enrolledCourseTitles = db.enrollments
    .filter((entry) => entry.userId === targetUser.id && entry.status === "active")
    .map((entry) => resolveCourse(db, entry.courseId)?.title)
    .filter(Boolean);

  return {
    ...safeUser(targetUser),
    activeEnrollments: db.enrollments.filter(
      (entry) => entry.userId === targetUser.id && entry.status === "active",
    ).length,
    enrolledCourseTitles,
    accountStatus: overdueItems.length ? "past_due" : "clear",
    pastDuePaymentCount: overdueItems.length,
    pastDueItems: overdueItems,
    canChangeRole: canChangeUserRole(actingUser, targetUser),
    canDelete: canDeleteUser(actingUser, targetUser),
    isProtected: Boolean(targetUser.isOriginalAdmin),
  };
}

function deleteUserAccount(userId, db) {
  db.users = db.users.filter((entry) => entry.id !== userId);
  db.sessions = db.sessions.filter((entry) => entry.userId !== userId);
  db.notifications = db.notifications.filter(
    (entry) => entry.userId !== userId && entry.meta?.studentId !== userId,
  );
  db.enrollments = db.enrollments.filter((entry) => entry.userId !== userId);
  db.payments = db.payments.filter((entry) => entry.userId !== userId);
  db.courseRatings = db.courseRatings.filter((entry) => entry.userId !== userId);
  db.reports = db.reports.filter(
    (entry) => entry.reporterId !== userId && entry.reportedUserId !== userId && entry.targetUserId !== userId,
  );
  db.profileComments = db.profileComments.filter(
    (entry) => entry.targetUserId !== userId && entry.authorId !== userId,
  );
  db.peerFeedback = db.peerFeedback.filter(
    (entry) => entry.targetUserId !== userId && entry.authorId !== userId,
  );
  db.assignmentSubmissions = db.assignmentSubmissions.filter((entry) => entry.studentId !== userId);
  db.communityPosts = db.communityPosts
    .filter((entry) => entry.authorId !== userId)
    .map((entry) => ({
      ...entry,
      mentionedUserIds: (entry.mentionedUserIds || []).filter((mentionedUserId) => mentionedUserId !== userId),
      reactions: (entry.reactions || []).filter((reaction) => reaction.userId !== userId),
      comments: (entry.comments || []).filter((comment) => comment.authorId !== userId),
    }));
  db.feedback = db.feedback.filter(
    (entry) => entry.studentId !== userId && entry.teacherId !== userId,
  );
  db.conversations = db.conversations
    .map((conversation) => ({
      ...conversation,
      participantIds: conversation.participantIds.filter((participantId) => participantId !== userId),
      messages: conversation.messages
        .filter((message) => message.senderId !== userId)
        .map((message) => ({
          ...message,
          readBy: (message.readBy || []).filter((readerId) => readerId !== userId),
        })),
    }))
    .filter((conversation) => conversation.participantIds.length >= 2);
  db.meetings = db.meetings
    .filter((meeting) => meeting.hostId !== userId)
    .map((meeting) => ({
      ...meeting,
      invitedUserIds: (meeting.invitedUserIds || []).filter((inviteeId) => inviteeId !== userId),
    }));
  db.courses = db.courses.map((course) => {
    const detachedTeacher = course.teacherId === userId;

    return {
      ...course,
      teacherId: detachedTeacher ? "" : course.teacherId,
      teacherName: detachedTeacher ? "edUKai teaching team" : course.teacherName,
      pendingEdits: (course.pendingEdits || []).filter((edit) => edit.submittedBy !== userId),
      slots: course.slots.map((slot) => ({
        ...slot,
        chatMessages: (slot.chatMessages || []).filter((message) => message.userId !== userId),
      })),
      updatedAt: detachedTeacher ? nowIso() : course.updatedAt,
    };
  });
}

function syncSystemState() {
  updateDb((db) => {
    ensurePastDuePaymentAlerts(db);
    ensureUpcomingPaymentReminders(db);
    return db;
  });

  return getDb();
}

function buildNotificationFeed(userId, db) {
  const notifications = db.notifications
    .filter((notification) => notification.userId === userId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
  };
}

function courseJoinerCount(courseId, db) {
  return db.enrollments.filter(
    (entry) => entry.courseId === courseId && entry.status === "active",
  ).length;
}

function buildCourseRatingSummary(courseId, db) {
  const ratings = db.courseRatings.filter((entry) => entry.courseId === courseId);
  const total = ratings.reduce((sum, entry) => sum + Number(entry.rating || 0), 0);

  return {
    ratingCount: ratings.length,
    averageRating: ratings.length ? Number((total / ratings.length).toFixed(1)) : 0,
  };
}

function getAssignmentSubmission(assignmentId, studentId, db) {
  return (
    db.assignmentSubmissions
      .filter((entry) => entry.assignmentId === assignmentId && entry.studentId === studentId)
      .sort((left, right) => new Date(right.submittedAt) - new Date(left.submittedAt))[0] || null
  );
}

function normalizeDynamicText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function moderateCommunityText(value) {
  const text = normalizeDynamicText(value);

  if (!text) {
    return { ok: false, message: "Text is required." };
  }

  const blockedPatterns = [
    /\b(?:porn|porno|pornography|nude|nudes|sexual|sexcam|onlyfans|nsfw)\b/i,
    /\b(?:fuck you|fuck off|bitch|slut|whore|bastard|asshole|idiot|moron)\b/i,
    /\b(?:kill all|gas them|exterminate|wipe them out)\b/i,
    /\b(?:go back to your country|inferior race|white power)\b/i,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(text))) {
    return {
      ok: false,
      message:
        "Posts and comments must stay free of pornography, explicit sexual content, insults, and hateful or violent language.",
    };
  }

  return { ok: true, text };
}

function inferAttachmentType(value, fallback = "link") {
  const normalized = normalizeDynamicText(value).toLowerCase();

  if (["image", "video", "audio", "document", "link"].includes(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(value);
    const pathname = url.pathname.toLowerCase();

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

function normalizeCommunityFeeling(value, strict = false) {
  const feeling = normalizeDynamicText(value).toLowerCase();

  if (!feeling) {
    return "";
  }

  if (COMMUNITY_FEELING_TYPES.includes(feeling)) {
    return feeling;
  }

  if (strict) {
    throw createError(400, "Unsupported feeling.");
  }

  return "";
}

function normalizeCommunityMentionIds(value, db, strict = false) {
  const rawIds = Array.isArray(value) ? value : [];
  const ids = [...new Set(rawIds.map((entry) => String(entry || "").trim()).filter(Boolean))].slice(
    0,
    COMMUNITY_MENTION_LIMIT,
  );

  return ids.filter((id) => {
    const exists = db.users.some((user) => user.id === id);
    if (!exists && strict) {
      throw createError(400, "One of the mentioned users could not be found.");
    }
    return exists;
  });
}

function normalizeStoredCommunityAttachments(value) {
  const attachments = Array.isArray(value) ? value : [];

  return attachments
    .map((entry) => {
      const rawUrl = String(entry?.url || "").trim();
      if (!rawUrl) {
        return null;
      }

      try {
        const parsed = new URL(rawUrl);
        const type = inferAttachmentType(entry?.type || rawUrl);
        const label = normalizeDynamicText(entry?.label || parsed.hostname);

        return {
          id: String(entry?.id || crypto.randomUUID()),
          url: parsed.toString(),
          label: label || parsed.hostname,
          type,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(0, COMMUNITY_ATTACHMENT_LIMIT);
}

function normalizeCommunityAttachments(value) {
  const attachments = Array.isArray(value) ? value : [];

  return attachments.slice(0, COMMUNITY_ATTACHMENT_LIMIT).map((entry) => {
    const rawUrl = String(entry?.url || "").trim();
    if (!rawUrl) {
      throw createError(400, "Attachment URL is required.");
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw createError(400, "Attachment URL must be valid.");
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw createError(400, "Attachment URL must start with http or https.");
    }

    const label = normalizeDynamicText(entry?.label || parsedUrl.hostname).slice(0, 80);

    return {
      id: crypto.randomUUID(),
      url: parsedUrl.toString(),
      label: label || parsedUrl.hostname,
      type: inferAttachmentType(entry?.type || rawUrl),
    };
  });
}

function normalizeStoredCommunityPost(post, db) {
  const comments = Array.isArray(post?.comments) ? post.comments : [];
  const reactions = Array.isArray(post?.reactions) ? post.reactions : [];

  return {
    ...post,
    body: String(post?.body || ""),
    courseId: String(post?.courseId || "").trim(),
    repostOfId: String(post?.repostOfId || "").trim(),
    feeling: normalizeCommunityFeeling(post?.feeling),
    mentionedUserIds: normalizeCommunityMentionIds(post?.mentionedUserIds, db),
    attachments: normalizeStoredCommunityAttachments(post?.attachments),
    reactions: reactions
      .map((reaction) => ({
        id: String(reaction?.id || crypto.randomUUID()),
        userId: String(reaction?.userId || "").trim(),
        type: COMMUNITY_REACTION_TYPES.includes(String(reaction?.type || "").toLowerCase())
          ? String(reaction?.type || "").toLowerCase()
          : "like",
        createdAt: reaction?.createdAt || nowIso(),
      }))
      .filter((reaction) => reaction.userId),
    comments: comments
      .map((comment) => ({
        id: String(comment?.id || crypto.randomUUID()),
        parentId: String(comment?.parentId || "").trim(),
        authorId: String(comment?.authorId || "").trim(),
        body: String(comment?.body || "").trim(),
        createdAt: comment?.createdAt || nowIso(),
      }))
      .filter((comment) => comment.authorId && comment.body),
    createdAt: post?.createdAt || nowIso(),
    updatedAt: post?.updatedAt || post?.createdAt || nowIso(),
  };
}

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function buildStarterCommunityPosts(db) {
  const admin = db.users.find((user) => user.role === "admin") || db.users[0] || null;
  const moderator = db.users.find((user) => user.role === "moderator") || admin;
  const teacher = db.users.find((user) => user.role === "teacher") || moderator || admin;
  const student = db.users.find((user) => user.role === "student") || null;
  const posts = [];

  if (admin) {
    posts.push({
      id: "starter_post_welcome",
      authorId: admin.id,
      body:
        "Welcome to the community feed. This space is for registered members to share thoughts, quick wins, questions, feelings, and useful updates without tying every post to a class.",
      courseId: "",
      feeling: "happy",
      mentionedUserIds: moderator && moderator.id !== admin.id ? [moderator.id] : [],
      attachments: [],
      repostOfId: "",
      reactions: student
        ? [
            {
              id: "starter_reaction_welcome_love",
              userId: student.id,
              type: "love",
              createdAt: hoursAgoIso(17),
            },
          ]
        : [],
      comments: moderator
        ? [
            {
              id: "starter_comment_welcome",
              parentId: "",
              authorId: moderator.id,
              body: "Quick tip: the best posts are short, human, and easy to answer. Share what changed or what kind of support you need.",
              createdAt: hoursAgoIso(15),
            },
          ]
        : [],
      createdAt: hoursAgoIso(18),
      updatedAt: hoursAgoIso(15),
    });
  }

  if (moderator) {
    posts.push({
      id: "starter_post_rhythm",
      authorId: moderator.id,
      body:
        "Try this posting rhythm: one thought, one feeling, and one useful detail. That format makes it easier for people to react quickly and reply with context.",
      courseId: "",
      feeling: "motivated",
      mentionedUserIds: teacher && teacher.id !== moderator.id ? [teacher.id] : [],
      attachments: [],
      repostOfId: "",
      reactions: admin
        ? [
            {
              id: "starter_reaction_rhythm_celebrate",
              userId: admin.id,
              type: "celebrate",
              createdAt: hoursAgoIso(11),
            },
          ]
        : [],
      comments:
        teacher && teacher.id !== moderator.id
          ? [
              {
                id: "starter_comment_rhythm",
                parentId: "",
                authorId: teacher.id,
                body: "This layout works well because people can react fast first, then use replies for the longer conversation.",
                createdAt: hoursAgoIso(9),
              },
            ]
          : [],
      createdAt: hoursAgoIso(12),
      updatedAt: hoursAgoIso(9),
    });
  }

  if (teacher) {
    posts.push({
      id: "starter_post_course_update",
      authorId: teacher.id,
      body:
        "A good mention can pull the right person into the conversation. Use it when you want feedback, encouragement, or a second set of eyes on something you shared.",
      courseId: "",
      feeling: "curious",
      mentionedUserIds: student && student.id !== teacher.id ? [student.id] : [],
      attachments: [],
      repostOfId: "",
      reactions: admin
        ? [
            {
              id: "starter_reaction_course_wow",
              userId: admin.id,
              type: "wow",
              createdAt: hoursAgoIso(6),
            },
          ]
        : [],
      comments:
        student && student.id !== teacher.id
          ? [
              {
                id: "starter_comment_course",
                parentId: "",
                authorId: student.id,
                body: "The mention idea helps a lot. It feels much easier to invite the right person into the thread.",
                createdAt: hoursAgoIso(4),
              },
            ]
          : [],
      createdAt: hoursAgoIso(7),
      updatedAt: hoursAgoIso(4),
    });
  }

  return posts;
}

function usersShareActiveCourse(leftUserId, rightUserId, db) {
  if (!leftUserId || !rightUserId || leftUserId === rightUserId) {
    return false;
  }

  const leftCourses = new Set(
    db.enrollments
      .filter((entry) => entry.userId === leftUserId && entry.status === "active")
      .map((entry) => entry.courseId),
  );

  return db.enrollments.some(
    (entry) =>
      entry.userId === rightUserId &&
      entry.status === "active" &&
      leftCourses.has(entry.courseId),
  );
}

function canManageUsersByPermission(user) {
  return Boolean(
    user &&
      (user.role === "admin" ||
        (user.role === "moderator" && user.moderatorPermissions?.manageUsers)),
  );
}

function canPublishCoursesByPermission(user) {
  return Boolean(
    user &&
      (user.role === "admin" ||
        (user.role === "moderator" && user.moderatorPermissions?.manageCourses)),
  );
}

function canAccessPerson(viewer, targetUser, db) {
  if (!viewer || !targetUser) {
    return false;
  }

  if (viewer.id === targetUser.id) {
    return true;
  }

  if (["admin", "moderator"].includes(viewer.role)) {
    return true;
  }

  if (["admin", "moderator", "teacher"].includes(targetUser.role)) {
    return true;
  }

  if (canMessageUser(viewer, targetUser, db)) {
    return true;
  }

  return usersShareActiveCourse(viewer.id, targetUser.id, db);
}

function canCommentOnPerson(viewer, targetUser, db) {
  if (!viewer || !targetUser || viewer.id === targetUser.id) {
    return false;
  }

  if (["admin", "moderator"].includes(viewer.role)) {
    return true;
  }

  if (viewer.role === "teacher") {
    return targetUser.role === "student"
      ? userSharesCourseConnection(viewer, targetUser, db)
      : targetUser.role === "teacher";
  }

  if (viewer.role === "student") {
    if (targetUser.role === "student") {
      return usersShareActiveCourse(viewer.id, targetUser.id, db);
    }

    return userSharesCourseConnection(viewer, targetUser, db);
  }

  return false;
}

function canDeleteProfileComment(viewer, entry) {
  return Boolean(
    viewer &&
      entry &&
      (viewer.id === entry.authorId || viewer.id === entry.targetUserId || canModerateCommunity(viewer)),
  );
}

function canDeleteProfileFeedback(viewer, targetUserId, entry) {
  return Boolean(
    viewer &&
      entry &&
      (viewer.id === entry.authorId || viewer.id === targetUserId || canModerateCommunity(viewer)),
  );
}

function buildProfileCommentSummary(entry, db, viewer = null) {
  const author = db.users.find((user) => user.id === entry.authorId);

  return {
    id: entry.id,
    body: entry.body,
    createdAt: entry.createdAt,
    targetUserId: entry.targetUserId,
    canDelete: canDeleteProfileComment(viewer, entry),
    canReport: Boolean(viewer && viewer.id !== entry.authorId),
    author: author
      ? {
          id: author.id,
          role: author.role,
          displayName: safeUser(author).displayName,
        }
      : null,
  };
}

function buildPeerFeedbackSummary(entry, db, viewer = null) {
  const author = db.users.find((user) => user.id === entry.authorId);
  const course = resolveCourse(db, entry.courseId);

  return {
    id: entry.id,
    body: entry.body,
    score: Number(entry.score || 0),
    tone: entry.tone || "supportive",
    createdAt: entry.createdAt,
    courseId: entry.courseId,
    courseTitle: course?.title || "Course",
    canDelete: canDeleteProfileFeedback(viewer, entry.targetUserId, entry),
    canReport: Boolean(viewer && viewer.id !== entry.authorId),
    author: author
      ? {
          id: author.id,
          role: author.role,
          displayName: safeUser(author).displayName,
        }
      : null,
  };
}

function summarizeCommunityPost(post, db, currentUser) {
  const author = db.users.find((entry) => entry.id === post.authorId);
  const repost = post.repostOfId ? db.communityPosts.find((entry) => entry.id === post.repostOfId) : null;
  const course = post.courseId ? resolveCourse(db, post.courseId) : null;
  const reactions = post.reactions || [];
  const canEdit = Boolean(currentUser && currentUser.id === post.authorId);
  const canDelete = Boolean(currentUser && (currentUser.id === post.authorId || canModerateCommunity(currentUser)));
  const canReport = Boolean(currentUser && currentUser.id !== post.authorId);
  const reactionSummary = COMMUNITY_REACTION_TYPES.map((type) => ({
    type,
    count: reactions.filter((entry) => entry.type === type).length,
    reacted: Boolean(currentUser && reactions.some((entry) => entry.userId === currentUser.id && entry.type === type)),
  }));
  const mentions = (post.mentionedUserIds || [])
    .map((userId) => db.users.find((entry) => entry.id === userId))
    .filter(Boolean)
    .map((user) => ({
      id: user.id,
      role: user.role,
      displayName: safeUser(user).displayName,
      avatarUrl: safeUser(user).avatarUrl || "",
    }));

  return {
    id: post.id,
    body: post.body,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt || post.createdAt,
    courseId: post.courseId || "",
    courseTitle: course?.title || "",
    canEdit,
    canDelete,
    canReport,
    feeling: post.feeling || "",
    attachments: (post.attachments || []).map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      label: attachment.label,
      type: attachment.type || inferAttachmentType(attachment.url),
    })),
    mentions,
    repostOfId: post.repostOfId || "",
    repost:
      repost && repost.id !== post.id
        ? summarizeCommunityPost({ ...repost, repostOfId: "" }, db, currentUser)
        : null,
    author: author
      ? {
          id: author.id,
          role: author.role,
          displayName: safeUser(author).displayName,
          avatarUrl: safeUser(author).avatarUrl || "",
        }
      : null,
    comments: (post.comments || [])
      .slice()
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
      .map((comment) => ({
        id: comment.id,
        parentId: comment.parentId || "",
        body: comment.body,
        createdAt: comment.createdAt,
        canDelete: Boolean(
          currentUser &&
            (currentUser.id === comment.authorId ||
              currentUser.id === post.authorId ||
              canModerateCommunity(currentUser)),
        ),
        canReport: Boolean(currentUser && currentUser.id !== comment.authorId),
        author: (() => {
          const commentAuthor = db.users.find((entry) => entry.id === comment.authorId);
          return commentAuthor
            ? {
                id: commentAuthor.id,
                role: commentAuthor.role,
                displayName: safeUser(commentAuthor).displayName,
                avatarUrl: safeUser(commentAuthor).avatarUrl || "",
              }
            : null;
        })(),
      })),
    reactionSummary,
    totalComments: (post.comments || []).length,
    totalReactions: reactions.length,
  };
}

function userSharesCourseConnection(user, targetUser, db) {
  if (!user || !targetUser) {
    return false;
  }

  if (user.role === "teacher" && targetUser.role === "student") {
    return db.enrollments.some(
      (enrollment) =>
        enrollment.userId === targetUser.id &&
        enrollment.status === "active" &&
        db.courses.some((course) => course.id === enrollment.courseId && course.teacherId === user.id),
    );
  }

  if (user.role === "student" && targetUser.role === "teacher") {
    return db.enrollments.some(
      (enrollment) =>
        enrollment.userId === user.id &&
        enrollment.status === "active" &&
        db.courses.some((course) => course.id === enrollment.courseId && course.teacherId === targetUser.id),
    );
  }

  return false;
}

function canMessageUser(user, targetUser, db) {
  if (!user || !targetUser || user.id === targetUser.id) {
    return false;
  }

  if (["admin", "moderator"].includes(user.role)) {
    return true;
  }

  if (["admin", "moderator"].includes(targetUser.role)) {
    return true;
  }

  if (userSharesCourseConnection(user, targetUser, db)) {
    return true;
  }

  if (user.role === "teacher" && targetUser.role === "teacher") {
    return true;
  }

  return false;
}

function buildChatContacts(user, db) {
  return db.users
    .filter((candidate) => canMessageUser(user, candidate, db))
    .map((candidate) => ({
      id: candidate.id,
      role: candidate.role,
      displayName: safeUser(candidate).displayName,
      email: candidate.email,
      bio: candidate.bio,
      teacherProfile: candidate.teacherProfile || null,
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function findConversationByParticipants(db, participantIds) {
  const key = [...participantIds].sort().join(":");
  return db.conversations.find(
    (conversation) => [...conversation.participantIds].sort().join(":") === key,
  );
}

function ensureConversationAccess(user, conversation) {
  if (!conversation.participantIds.includes(user.id)) {
    throw createError(403, "You cannot access this conversation.");
  }
}

function markConversationRead(conversation, userId) {
  conversation.messages.forEach((message) => {
    if (!message.readBy) {
      message.readBy = [];
    }

    if (message.senderId !== userId && !message.readBy.includes(userId)) {
      message.readBy.push(userId);
    }
  });
}

function buildConversationSummary(conversation, userId, db) {
  const participants = conversation.participantIds
    .map((participantId) => db.users.find((user) => user.id === participantId))
    .filter(Boolean)
    .map((participant) => ({
      id: participant.id,
      role: participant.role,
      displayName: safeUser(participant).displayName,
      teacherProfile: participant.teacherProfile || null,
    }));
  const counterpart = participants.find((participant) => participant.id !== userId) || participants[0] || null;
  const lastMessage = conversation.messages[conversation.messages.length - 1] || null;
  const lastAuthor = lastMessage ? db.users.find((user) => user.id === lastMessage.senderId) : null;

  return {
    id: conversation.id,
    participants,
    counterpart,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
    unreadCount: conversation.messages.filter(
      (message) => message.senderId !== userId && !(message.readBy || []).includes(userId),
    ).length,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          body: lastMessage.body,
          createdAt: lastMessage.createdAt,
          authorName: lastAuthor ? safeUser(lastAuthor).displayName : "User",
        }
      : null,
  };
}

function canHostMeetings(user) {
  return Boolean(user && ["admin", "moderator", "teacher"].includes(user.role));
}

function canHostClassroomMeetings(user) {
  return Boolean(user && user.role === "teacher");
}

function canHostPrivateMeetings(user) {
  return Boolean(user && user.role === "teacher");
}

function canHostCrewMeetings(user) {
  return Boolean(user && ["admin", "moderator"].includes(user.role));
}

function getCrewUserIds(db) {
  return db.users
    .filter((user) => ["admin", "moderator", "teacher"].includes(user.role))
    .map((user) => user.id);
}

function getMeetingInviteContacts(user, db) {
  if (["admin", "moderator"].includes(user.role)) {
    return db.users
      .filter((candidate) => candidate.id !== user.id)
      .map((candidate) => ({
        id: candidate.id,
        displayName: safeUser(candidate).displayName,
        role: candidate.role,
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  return buildChatContacts(user, db).map((contact) => ({
    id: contact.id,
    displayName: contact.displayName,
    role: contact.role,
  }));
}

function getHostableCourses(user, db) {
  if (!canHostClassroomMeetings(user)) {
    return [];
  }

  return db.courses
    .filter((course) => course.teacherId === user.id)
    .map((course) => ({
      id: course.id,
      title: course.title,
      slots: course.slots.map((slot) => ({
        id: slot.id,
        name: slot.name,
        days: slot.days,
        startTime: slot.startTime,
      })),
    }));
}

function ensureMeetingAccess(user, meeting) {
  if (!meeting) {
    throw createError(404, "Meeting not found.");
  }

  if (["admin", "moderator"].includes(user.role)) {
    return;
  }

  if (meeting.hostId === user.id || meeting.invitedUserIds.includes(user.id)) {
    return;
  }

  throw createError(403, "You cannot access this meeting.");
}

function buildMeetingSummary(meeting, user, db) {
  const host = db.users.find((entry) => entry.id === meeting.hostId);
  const course = resolveCourse(db, meeting.courseId);
  const slot = course?.slots.find((entry) => entry.id === meeting.slotId);
  const invitees = meeting.invitedUserIds
    .map((userId) => db.users.find((entry) => entry.id === userId))
    .filter(Boolean)
    .map((entry) => ({
      id: entry.id,
      displayName: safeUser(entry).displayName,
      role: entry.role,
    }));

  return {
    id: meeting.id,
    type: meeting.type,
    title: meeting.title,
    status: meeting.status,
    hostId: meeting.hostId,
    hostName: host ? safeUser(host).displayName : "edUKai host",
    courseId: meeting.courseId || "",
    courseTitle: course?.title || "",
    slotId: meeting.slotId || "",
    slotName: slot?.name || "",
    meetingUrl: meeting.meetingUrl,
    roomCode: meeting.roomCode,
    invitees,
    inviteeCount: invitees.length,
    createdAt: meeting.createdAt,
    startedAt: meeting.startedAt || meeting.createdAt,
    canEnd: Boolean(user && (meeting.hostId === user.id || ["admin", "moderator"].includes(user.role))),
    isHost: Boolean(user && meeting.hostId === user.id),
  };
}

function parseJsonField(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (Array.isArray(value) || typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sanitizeCoursePatch(body) {
  return {
    title: body.title,
    summary: body.summary,
    description: body.description,
    brief: body.brief,
    duration: body.duration,
    level: body.level,
    teacherId: body.teacherId,
    teacherName: body.teacherName,
    format: body.format,
    category: body.category,
    audience: parseJsonField(body.audience, undefined),
    outcomes: parseJsonField(body.outcomes, undefined),
    modules: parseJsonField(body.modules, undefined),
    slots: parseJsonField(body.slots, undefined),
    priceCents: body.priceCents ? Number(body.priceCents) : undefined,
    published: body.published === "true" ? true : body.published === "false" ? false : undefined,
  };
}

function resolveCourse(db, courseIdOrSlug) {
  return db.courses.find((course) => course.id === courseIdOrSlug || course.slug === courseIdOrSlug);
}

function ensureCourseAccess(user, course, allowedRoles = ["admin", "moderator"]) {
  if (!user) {
    throw createError(401, "Authentication required.");
  }

  if (allowedRoles.includes(user.role)) {
    return;
  }

  if (user.role === "teacher" && course.teacherId === user.id) {
    return;
  }

  throw createError(403, "You are not allowed to modify this course.");
}

function normalizeCourseSlot(slot) {
  return {
    id: slot.id || crypto.randomUUID(),
    name: slot.name,
    days: slot.days || [],
    startTime: slot.startTime,
    durationMinutes: Number(slot.durationMinutes || 90),
    capacity: Number(slot.capacity || 20),
    location: slot.location || "Online Classroom",
    recordings: slot.recordings || [],
    chatMessages: slot.chatMessages || [],
  };
}

function mergeCourseSlots(existingSlots, incomingSlots) {
  return incomingSlots.map((slot) => {
    const existingSlot = existingSlots.find((entry) => entry.id === slot.id);
    const normalizedSlot = normalizeCourseSlot(slot);

    return {
      ...normalizedSlot,
      recordings: slot.recordings || existingSlot?.recordings || [],
      chatMessages: slot.chatMessages || existingSlot?.chatMessages || [],
    };
  });
}

function hasPaymobConfig() {
  return Boolean(
    PAYMOB_SECRET_KEY &&
      PAYMOB_PUBLIC_KEY &&
      PAYMOB_INTENTION_ENDPOINT &&
      PAYMOB_CHECKOUT_URL_TEMPLATE &&
      PAYMOB_ALLOWED_METHODS,
  );
}

function buildCheckoutUrl(clientSecret) {
  return PAYMOB_CHECKOUT_URL_TEMPLATE
    .replaceAll("{{publicKey}}", encodeURIComponent(PAYMOB_PUBLIC_KEY))
    .replaceAll("{{clientSecret}}", encodeURIComponent(clientSecret));
}

function appendQueryParams(baseUrl, params) {
  try {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });

    return url.toString();
  } catch {
    const search = new URLSearchParams(
      Object.entries(params).reduce((accumulator, [key, value]) => {
        if (value == null || value === "") {
          return accumulator;
        }

        accumulator[key] = String(value);
        return accumulator;
      }, {}),
    ).toString();

    if (!search) {
      return baseUrl;
    }

    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${search}`;
  }
}

function extractPaymobClientSecret(payload) {
  return (
    payload?.client_secret ||
    payload?.clientSecret ||
    payload?.data?.client_secret ||
    payload?.data?.clientSecret ||
    ""
  );
}

async function createPaymobCheckout(payment, course, user) {
  if (!hasPaymobConfig()) {
    return {
      mode: "mock",
      checkoutUrl: `${APP_BASE_URL}/payments?paymentId=${payment.id}`,
      providerReference: payment.id,
    };
  }

  const allowedMethods = PAYMOB_ALLOWED_METHODS
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  if (!allowedMethods.length) {
    throw createError(500, "Paymob integration IDs are missing. Add PAYMOB_ALLOWED_METHODS to enable live payments.");
  }

  const billingData = {
    first_name: user.firstName || "Student",
    last_name: user.lastName || "Account",
    email: user.email,
  };

  if (user.phone) {
    billingData.phone_number = user.phone;
  }

  const payload = {
    amount: payment.amountCents,
    currency: payment.currency,
    payment_methods: allowedMethods,
    merchant_order_id: payment.id,
    items: [
      {
        name: course.title,
        amount: payment.amountCents,
        description: course.summary,
        quantity: 1,
      },
    ],
    billing_data: billingData,
    special_reference: payment.id,
    notification_url: PAYMOB_WEBHOOK_URL || undefined,
    redirection_url: appendQueryParams(PAYMOB_SUCCESS_URL, {
      paymentId: payment.id,
      status: "processing",
    }),
  };

  const response = await fetch(PAYMOB_INTENTION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYMOB_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw createError(502, `Paymob intention request failed: ${errorText}`);
  }

  const responsePayload = await response.json();
  const clientSecret = extractPaymobClientSecret(responsePayload);

  if (!clientSecret) {
    throw createError(502, "Paymob did not return a client secret.");
  }

  return {
    mode: "live",
    checkoutUrl: buildCheckoutUrl(clientSecret),
    providerReference:
      responsePayload?.id ||
      responsePayload?.intention_order_id ||
      responsePayload?.data?.id ||
      clientSecret,
    raw: responsePayload,
  };
}

function verifyFlexiblePaymobHmac(body, receivedHmac) {
  if (!PAYMOB_HMAC_SECRET || !PAYMOB_HMAC_FIELDS) {
    return false;
  }

  const fields = PAYMOB_HMAC_FIELDS.split(",").map((field) => field.trim()).filter(Boolean);
  const base = body.obj || body;
  const concatenated = fields
    .map((field) => {
      const value = field.split(".").reduce((accumulator, key) => accumulator?.[key], base);
      return value == null ? "" : String(value);
    })
    .join("");

  const calculated = crypto
    .createHmac("sha512", PAYMOB_HMAC_SECRET)
    .update(concatenated)
    .digest("hex");

  return calculated === receivedHmac;
}

function finalizeEnrollmentFromPayment(paymentId, db) {
  const payment = db.payments.find((entry) => entry.id === paymentId);
  if (!payment || payment.status === "paid") {
    return payment;
  }

  payment.status = "paid";
  payment.updatedAt = nowIso();
  const course = resolveCourse(db, payment.courseId);
  const fullAmountCents = Number(payment.fullAmountCents || course?.priceCents || payment.amountCents || 0);
  const installmentIndex = getPaymentInstallmentIndex(payment, course);
  const installmentCount = getPaymentInstallmentCount(payment, course);
  const stageMeta = getPaymentStageMeta(payment.paymentPlan, installmentIndex, installmentCount, fullAmountCents);
  const totalPaidForCourse = db.payments
    .filter((entry) => entry.userId === payment.userId && entry.courseId === payment.courseId && entry.status === "paid")
    .reduce((sum, entry) => sum + Number(entry.amountCents || 0), 0);
  const paymentStatus = totalPaidForCourse >= fullAmountCents ? "paid" : "partial_paid";
  const remainingCents = Math.max(fullAmountCents - totalPaidForCourse, 0);
  const nextInstallmentIndex = remainingCents > 0 ? installmentIndex + 1 : null;
  const nextStageMeta = nextInstallmentIndex
    ? getPaymentStageMeta(payment.paymentPlan, nextInstallmentIndex, installmentCount, fullAmountCents)
    : null;

  payment.remainingDueAt = remainingCents > 0 ? getRemainingBalanceDueAt(payment) : "";

  const existingEnrollment = db.enrollments.find(
    (entry) =>
      entry.userId === payment.userId &&
      entry.courseId === payment.courseId &&
      entry.slotId === payment.slotId &&
      entry.status === "active",
  );

  if (!existingEnrollment) {
    db.enrollments.push({
      id: crypto.randomUUID(),
      userId: payment.userId,
      courseId: payment.courseId,
      slotId: payment.slotId,
      selectedDays: payment.selectedDays,
      daysPerWeek: payment.daysPerWeek,
      status: "active",
      paymentStatus,
      enrolledAt: nowIso(),
    });
  } else {
    existingEnrollment.paymentStatus = paymentStatus;
    existingEnrollment.selectedDays = payment.selectedDays;
    existingEnrollment.daysPerWeek = payment.daysPerWeek;
  }

  pushNotification(db, payment.userId, {
    type: "payment",
    title:
      paymentStatus === "paid"
        ? "Payment plan completed"
        : stageMeta.paymentStage === "deposit"
          ? "Deposit confirmed"
          : "Payment confirmed",
    message:
      paymentStatus === "paid"
        ? `Your payment for ${course?.title || "your course"} is fully confirmed.`
        : stageMeta.paymentStage === "full"
          ? `Your full payment for ${course?.title || "your course"} is confirmed.`
          : stageMeta.paymentStage === "deposit"
            ? `Your ${Math.round(COURSE_DEPOSIT_RATE * 100)}% deposit for ${course?.title || "your course"} is confirmed. The remaining balance stays on your account until ${new Date(payment.remainingDueAt).toLocaleDateString("en-GB")}.`
            : `Your ${stageMeta.stageLabel.toLowerCase()} for ${course?.title || "your course"} is confirmed. The ${nextStageMeta?.stageLabel?.toLowerCase() || "next payment"} stays on your account until ${new Date(payment.remainingDueAt).toLocaleDateString("en-GB")}.`,
    link: `/payments?paymentId=${payment.id}`,
  });

  return payment;
}

function buildIcsForSlot(course, slot) {
  const nextDate = getNextSlotDate(slot);
  const endDate = new Date(nextDate.getTime() + slot.durationMinutes * 60 * 1000);
  const weekdayMap = {
    Sunday: "SU",
    Monday: "MO",
    Tuesday: "TU",
    Wednesday: "WE",
    Thursday: "TH",
    Friday: "FR",
    Saturday: "SA",
  };
  const byDay = slot.days.map((day) => weekdayMap[day]).filter(Boolean).join(",");

  const formatDate = (date) =>
    date.toISOString().replace(/[-:]/g, "").replace(".000", "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//edUKai//Course Reminder//EN",
    "BEGIN:VEVENT",
    `UID:${slot.id}@${EMAIL_DOMAIN}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(nextDate)}`,
    `DTEND:${formatDate(endDate)}`,
    `SUMMARY:${course.title} - ${slot.name}`,
    `DESCRIPTION:Class reminder for ${course.title}`,
    `LOCATION:${slot.location}`,
    `RRULE:FREQ=WEEKLY;COUNT=12;BYDAY=${byDay}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post(
  "/api/auth/register",
  withErrorBoundary(async (req, res) => {
    const {
      firstName,
      lastName,
      email,
      password,
      phone = "",
      course = "",
      education = "",
      goals = "",
      experience = "",
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      throw createError(400, "First name, last name, email, and password are required.");
    }

    if (!validatePasswordStrength(password)) {
      throw createError(400, "Password must be at least 8 characters and include upper, lower, and numeric characters.");
    }

    const normalizedEmail = normalizePlatformEmail(email);
    const db = getDb();

    if (db.users.some((user) => user.email === normalizedEmail)) {
      throw createError(409, "An account with this email already exists.");
    }

    const { salt, passwordHash } = hashPassword(password);
    const createdAt = nowIso();

    const newUser = {
      id: crypto.randomUUID(),
      role: "student",
      isOriginalAdmin: false,
      email: normalizedEmail,
      salt,
      passwordHash,
      firstName,
      lastName,
      displayName: buildDisplayName(firstName, lastName),
      phone,
      bio: "",
      focusTrack: course === "english" ? "Fluency" : "Career Switch",
      education,
      goals,
      experience,
      privateBadges: false,
      avatarUrl: "",
      achievements: [],
      badges: [],
      certificates: [],
      moderatorPermissions: { manageUsers: false, manageCourses: false },
      teacherProfile: null,
      createdAt,
      updatedAt: createdAt,
    };

    updateDb((mutableDb) => {
      mutableDb.users.push(newUser);
      pushNotification(mutableDb, newUser.id, {
        type: "account",
        title: "Welcome to edUKai",
        message: "Your account is ready. Choose a course, reserve your seat, and keep an eye on your notifications for the next steps.",
        link: "/",
      });
    });

    issueSessionCookies(res, newUser.id);
    res.status(201).json({ user: safeUser(newUser) });
  }),
);

app.post(
  "/api/auth/login",
  withErrorBoundary(async (req, res) => {
    const email = normalizePlatformEmail(req.body.email);
    const password = req.body.password;

    if (!email || !password) {
      throw createError(400, "Email and password are required.");
    }

    if (isLoginLocked(email)) {
      throw createError(429, "Too many failed login attempts. Please try again later.");
    }

    const db = getDb();
    const user = db.users.find((entry) => entry.email === email);

    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      recordFailedLogin(email);
      throw createError(401, "Incorrect email or password.");
    }

    clearFailedLogin(email);
    issueSessionCookies(res, user.id);
    res.json({ user: safeUser(user) });
  }),
);

app.post(
  "/api/auth/logout",
  withErrorBoundary(async (req, res) => {
    deleteSessionTokens(req.cookies[ACCESS_COOKIE], req.cookies[REFRESH_COOKIE]);
    clearSessionCookies(res);
    res.json({ ok: true });
  }),
);

app.post(
  "/api/auth/refresh",
  withErrorBoundary(async (req, res) => {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    const session = consumeSessionToken(refreshToken, "refresh");

    if (!session) {
      clearSessionCookies(res);
      throw createError(401, "Session expired. Please sign in again.");
    }

    const db = getDb();
    const user = db.users.find((entry) => entry.id === session.userId);

    if (!user) {
      clearSessionCookies(res);
      throw createError(401, "Session user no longer exists.");
    }

    deleteSessionTokens(req.cookies[ACCESS_COOKIE], refreshToken);
    issueSessionCookies(res, user.id);
    res.json({ user: safeUser(user) });
  }),
);

app.get(
  "/api/auth/me",
  optionalAuth,
  withErrorBoundary(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    res.json({ user: safeUser(req.user) });
  }),
);

app.get(
  "/api/notifications",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = syncSystemState();
    res.json(buildNotificationFeed(req.user.id, db));
  }),
);

app.post(
  "/api/notifications/read-all",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    updateDb((db) => {
      db.notifications = db.notifications.map((notification) =>
        notification.userId === req.user.id
          ? { ...notification, read: true }
          : notification,
      );
    });

    res.json({ ok: true });
  }),
);

app.post(
  "/api/notifications/:notificationId/read",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    updateDb((db) => {
      const notification = db.notifications.find(
        (entry) => entry.id === req.params.notificationId && entry.userId === req.user.id,
      );

      if (!notification) {
        throw createError(404, "Notification not found.");
      }

      notification.read = true;
    });

    res.json({ ok: true });
  }),
);

app.get(
  "/api/chat/contacts",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    res.json({
      contacts: buildChatContacts(req.user, getDb()),
    });
  }),
);

app.get(
  "/api/chat/conversations",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const conversations = db.conversations
      .filter((conversation) => conversation.participantIds.includes(req.user.id))
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .map((conversation) => buildConversationSummary(conversation, req.user.id, db));

    res.json({ conversations });
  }),
);

app.post(
  "/api/chat/conversations",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const participantId = String(req.body.participantId || "");
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === participantId);

    if (!targetUser) {
      throw createError(404, "User not found.");
    }

    if (!canMessageUser(req.user, targetUser, db)) {
      throw createError(403, "You cannot start a conversation with this user.");
    }

    let conversation = findConversationByParticipants(db, [req.user.id, targetUser.id]);

    if (!conversation) {
      updateDb((mutableDb) => {
        mutableDb.conversations.push({
          id: crypto.randomUUID(),
          participantIds: [req.user.id, targetUser.id].sort(),
          createdBy: req.user.id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          messages: [],
        });
      });

      conversation = findConversationByParticipants(getDb(), [req.user.id, targetUser.id]);
    }

    res.status(201).json({
      conversation: buildConversationSummary(conversation, req.user.id, getDb()),
    });
  }),
);

app.get(
  "/api/chat/conversations/:conversationId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    updateDb((db) => {
      const conversation = db.conversations.find((entry) => entry.id === req.params.conversationId);

      if (!conversation) {
        throw createError(404, "Conversation not found.");
      }

      ensureConversationAccess(req.user, conversation);
      markConversationRead(conversation, req.user.id);
      conversation.updatedAt = conversation.updatedAt || conversation.createdAt;
    });

    const db = getDb();
    const conversation = db.conversations.find((entry) => entry.id === req.params.conversationId);

    res.json({
      conversation: buildConversationSummary(conversation, req.user.id, db),
      messages: conversation.messages.map((message) => {
        const author = db.users.find((entry) => entry.id === message.senderId);
        return {
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          senderId: message.senderId,
          authorName: author ? safeUser(author).displayName : "User",
          readBy: message.readBy || [],
        };
      }),
    });
  }),
);

app.post(
  "/api/chat/conversations/:conversationId/messages",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const nextBody = String(req.body.message || "").trim();

    if (!nextBody) {
      throw createError(400, "Message is required.");
    }

    let createdMessage = null;
    let participantIds = [];

    updateDb((db) => {
      const conversation = db.conversations.find((entry) => entry.id === req.params.conversationId);

      if (!conversation) {
        throw createError(404, "Conversation not found.");
      }

      ensureConversationAccess(req.user, conversation);
      participantIds = [...conversation.participantIds];
      createdMessage = {
        id: crypto.randomUUID(),
        senderId: req.user.id,
        body: nextBody,
        createdAt: nowIso(),
        readBy: [req.user.id],
      };

      conversation.messages.push(createdMessage);
      conversation.updatedAt = nowIso();

      pushNotifications(
        db,
        participantIds.filter((userId) => userId !== req.user.id),
        {
          type: "message",
          title: `New message from ${safeUser(req.user).displayName}`,
          message: nextBody.length > 90 ? `${nextBody.slice(0, 87)}...` : nextBody,
          link: "/meeting-rooms",
        },
      );
    });

    res.status(201).json({
      message: {
        ...createdMessage,
        authorName: safeUser(req.user).displayName,
      },
    });
  }),
);

app.get(
  "/api/meetings/options",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    res.json({
      canHost: canHostMeetings(req.user),
      hostCapabilities: {
        classroom: canHostClassroomMeetings(req.user),
        private: canHostPrivateMeetings(req.user),
        crew: canHostCrewMeetings(req.user),
      },
      contacts: getMeetingInviteContacts(req.user, db),
      courses: canHostMeetings(req.user) ? getHostableCourses(req.user, db) : [],
    });
  }),
);

app.get(
  "/api/meetings",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const meetings = db.meetings
      .filter((meeting) => {
        if (["admin", "moderator"].includes(req.user.role)) {
          return true;
        }

        return meeting.hostId === req.user.id || meeting.invitedUserIds.includes(req.user.id);
      })
      .sort((left, right) => new Date(right.startedAt || right.createdAt) - new Date(left.startedAt || left.createdAt))
      .map((meeting) => buildMeetingSummary(meeting, req.user, db));

    res.json({ meetings });
  }),
);

app.post(
  "/api/meetings",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    if (!canHostMeetings(req.user)) {
      throw createError(403, "You cannot start meeting rooms.");
    }

    const db = getDb();
    const type = String(req.body.type || "private");
    const requestedInviteeIds = Array.from(new Set((req.body.inviteeIds || []).map(String).filter(Boolean)));
    const title = String(req.body.title || "").trim();
    let course = null;
    let slot = null;
    let invitedUserIds = [];

    if (!["classroom", "private", "crew"].includes(type)) {
      throw createError(400, "Unsupported meeting type.");
    }

    if (type === "classroom") {
      if (!canHostClassroomMeetings(req.user)) {
        throw createError(403, "Only teachers can start classroom meetings.");
      }

      course = resolveCourse(db, req.body.courseId);
      slot = course?.slots.find((entry) => entry.id === req.body.slotId);

      if (!course || !slot) {
        throw createError(400, "Please choose a valid course and classroom slot.");
      }

      if (req.user.role === "teacher" && course.teacherId !== req.user.id) {
        throw createError(403, "Teachers can only start rooms for their own classes.");
      }

      invitedUserIds = db.enrollments
        .filter(
          (enrollment) =>
            enrollment.courseId === course.id &&
            enrollment.slotId === slot.id &&
            enrollment.status === "active",
        )
        .map((enrollment) => enrollment.userId);

      if (course.teacherId && course.teacherId !== req.user.id) {
        invitedUserIds.push(course.teacherId);
      }

      invitedUserIds.push(
        ...requestedInviteeIds.filter((inviteeId) => {
          const invitee = db.users.find((entry) => entry.id === inviteeId);
          return invitee && (["admin", "moderator"].includes(req.user.role) || canMessageUser(req.user, invitee, db));
        }),
      );
    }

    if (type === "private") {
      if (!canHostPrivateMeetings(req.user)) {
        throw createError(403, "Only teachers can start private coaching meetings.");
      }

      if (requestedInviteeIds.length !== 1) {
        throw createError(400, "Choose exactly one person for a private room.");
      }

      const invitee = db.users.find((entry) => entry.id === requestedInviteeIds[0]);

      if (!invitee) {
        throw createError(404, "Invitee not found.");
      }

      if (!["admin", "moderator"].includes(req.user.role) && !canMessageUser(req.user, invitee, db)) {
        throw createError(403, "You cannot invite this user.");
      }

      invitedUserIds = [invitee.id];
    }

    if (type === "crew") {
      if (!canHostCrewMeetings(req.user)) {
        throw createError(403, "Only admins and moderators can start crew meetings.");
      }

      invitedUserIds = getCrewUserIds(db).filter((userId) => userId !== req.user.id);
    }

    invitedUserIds = Array.from(new Set(invitedUserIds.filter((userId) => userId !== req.user.id)));
    const createdAt = nowIso();
    const roomCode = `${slugify(title || `${type}-${Date.now()}`)}-${crypto.randomUUID().slice(0, 8)}`;
    const meeting = {
      id: crypto.randomUUID(),
      type,
      title:
        title ||
        (type === "classroom"
          ? `${course?.title || "Course"} live room`
          : type === "crew"
            ? "Crew sync room"
            : "Private support room"),
      hostId: req.user.id,
      courseId: course?.id || "",
      slotId: slot?.id || "",
      invitedUserIds,
      meetingUrl: `https://meet.jit.si/edukai-${roomCode}`,
      roomCode,
      status: "active",
      createdAt,
      startedAt: createdAt,
      updatedAt: createdAt,
    };

    updateDb((mutableDb) => {
      mutableDb.meetings.unshift(meeting);
      pushNotifications(
        mutableDb,
        invitedUserIds,
        {
          type: "meeting",
          title: `${safeUser(req.user).displayName} started a meeting`,
          message: `Join ${meeting.title} from the meeting rooms page.`,
          link: "/meeting-rooms",
        },
      );
    });

    res.status(201).json({
      meeting: buildMeetingSummary(meeting, req.user, getDb()),
    });
  }),
);

app.post(
  "/api/meetings/:meetingId/end",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    updateDb((db) => {
      const meeting = db.meetings.find((entry) => entry.id === req.params.meetingId);

      ensureMeetingAccess(req.user, meeting);

      if (!(meeting.hostId === req.user.id || ["admin", "moderator"].includes(req.user.role))) {
        throw createError(403, "You cannot end this meeting.");
      }

      meeting.status = "ended";
      meeting.updatedAt = nowIso();
    });

    res.json({ ok: true });
  }),
);

app.get(
  "/api/teachers",
  withErrorBoundary(async (_req, res) => {
    const db = getDb();
    res.json({
      teachers: getTeacherUsers(db).map(publicTeacher),
    });
  }),
);

app.get(
  "/api/students/leaderboard",
  withErrorBoundary(async (_req, res) => {
    res.json({
      students: buildStudentLeaderboard(getDb()),
    });
  }),
);

app.get(
  "/api/jobs",
  optionalAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const jobs =
      req.user?.role === "admin"
        ? db.jobs
        : db.jobs.filter((job) => (job.status || "open") === "open");
    res.json({ jobs });
  }),
);

app.post(
  "/api/jobs",
  requireAuth,
  requireRoles(["admin"]),
  withErrorBoundary(async (req, res) => {
    const title = normalizeDynamicText(req.body.title);
    const department = normalizeDynamicText(req.body.department);
    const location = normalizeDynamicText(req.body.location);
    const type = normalizeDynamicText(req.body.type);
    const description = normalizeDynamicText(req.body.description);
    const focusArea = normalizeDynamicText(req.body.focusArea);
    const openings = Math.max(Number(req.body.openings || 1), 1);

    if (!title || !department || !location || !type || !description) {
      throw createError(400, "Title, department, location, type, and description are required.");
    }

    const createdAt = nowIso();
    const job = {
      id: crypto.randomUUID(),
      title,
      department,
      location,
      type,
      description,
      focusArea,
      openings,
      status: "open",
      postedAt: createdAt,
      closedAt: "",
      updatedAt: createdAt,
    };

    updateDb((mutableDb) => {
      mutableDb.jobs.unshift(job);
    });

    res.status(201).json({ job });
  }),
);

app.patch(
  "/api/jobs/:jobId",
  requireAuth,
  requireRoles(["admin"]),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const existingJob = db.jobs.find((entry) => entry.id === req.params.jobId);

    if (!existingJob) {
      throw createError(404, "Job not found.");
    }

    const nextStatus = req.body.status ? normalizeDynamicText(req.body.status).toLowerCase() : existingJob.status;
    if (!["open", "closed"].includes(nextStatus)) {
      throw createError(400, "Unsupported job status.");
    }

    updateDb((mutableDb) => {
      const mutableJob = mutableDb.jobs.find((entry) => entry.id === req.params.jobId);
      const nextTitle = normalizeDynamicText(req.body.title);
      const nextDepartment = normalizeDynamicText(req.body.department);
      const nextLocation = normalizeDynamicText(req.body.location);
      const nextType = normalizeDynamicText(req.body.type);
      const nextDescription = normalizeDynamicText(req.body.description);
      const nextFocusArea = normalizeDynamicText(req.body.focusArea);

      mutableJob.title = nextTitle || mutableJob.title;
      mutableJob.department = nextDepartment || mutableJob.department;
      mutableJob.location = nextLocation || mutableJob.location;
      mutableJob.type = nextType || mutableJob.type;
      mutableJob.description = nextDescription || mutableJob.description;
      mutableJob.focusArea = nextFocusArea || mutableJob.focusArea || "";
      if (req.body.openings !== undefined) {
        mutableJob.openings = Math.max(Number(req.body.openings || mutableJob.openings || 1), 1);
      }
      mutableJob.status = nextStatus;
      mutableJob.closedAt = nextStatus === "closed" ? mutableJob.closedAt || nowIso() : "";
      mutableJob.updatedAt = nowIso();
    });

    const freshJob = getDb().jobs.find((entry) => entry.id === req.params.jobId);
    res.json({ job: freshJob });
  }),
);

app.get(
  "/api/courses",
  optionalAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const includeDrafts = req.query.includeDrafts === "true";
    const courses = db.courses
      .filter((course) => course.published || (includeDrafts && req.user))
      .map((course) => buildCourseSummary(course, db, req.user));

    res.json({ courses });
  }),
);

app.get(
  "/api/courses/:slug",
  optionalAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.slug);

    if (!course) {
      throw createError(404, "Course not found.");
    }

    res.json({ course: buildCourseSummary(course, db, req.user) });
  }),
);

app.post(
  "/api/courses",
  requireAuth,
  upload.single("thumbnail"),
  withErrorBoundary(async (req, res) => {
    if (!canPublishCoursesByPermission(req.user)) {
      throw createError(403, "You are not allowed to publish courses.");
    }

    const db = getDb();
    const patch = sanitizeCoursePatch(req.body);
    const thumbnailUrl = req.file ? await storeUploadedAsset(req.file, "course-thumbnails") : "";

    if (!patch.title || !patch.teacherId || !patch.summary || !patch.description) {
      throw createError(400, "Title, teacher, summary, and description are required.");
    }

    const teacher = db.users.find((entry) => entry.id === patch.teacherId && entry.role === "teacher");

    if (!teacher) {
      throw createError(400, "Please assign a valid teacher.");
    }

    const newCourse = {
      id: crypto.randomUUID(),
      slug: slugify(patch.title),
      title: patch.title,
      summary: patch.summary,
      description: patch.description,
      brief: patch.brief || "",
      duration: patch.duration || "6 Weeks",
      level: patch.level || "Beginner",
      priceCents: Number(patch.priceCents || 0),
      currency: "EGP",
      format: patch.format || "Live sessions",
      imageKey: patch.category || "frontend",
      thumbnailUrl,
      teacherId: teacher.id,
      teacherName: safeUser(teacher).displayName,
      category: patch.category || "technology",
      audience: patch.audience || [],
      outcomes: patch.outcomes || [],
      modules: patch.modules || [],
      slots: (patch.slots || []).map(normalizeCourseSlot),
      published: patch.published ?? true,
      pendingEdits: [],
      createdBy: req.user.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    updateDb((mutableDb) => {
      mutableDb.courses.push(newCourse);
    });

    res.status(201).json({ course: buildCourseSummary(newCourse, getDb(), req.user) });
  }),
);

app.patch(
  "/api/courses/:courseId",
  requireAuth,
  upload.single("thumbnail"),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);
    const uploadedThumbnailUrl = req.file ? await storeUploadedAsset(req.file, "course-thumbnails") : "";

    if (!course) {
      throw createError(404, "Course not found.");
    }

    ensureCourseAccess(req.user, course);
    const patch = sanitizeCoursePatch(req.body);
    const safePatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));

    if (uploadedThumbnailUrl) {
      safePatch.thumbnailUrl = uploadedThumbnailUrl;
    }

    if (safePatch.slots) {
      safePatch.slots = mergeCourseSlots(course.slots, safePatch.slots);
    }

    if (safePatch.teacherId) {
      const teacher = db.users.find((entry) => entry.id === safePatch.teacherId && entry.role === "teacher");
      if (!teacher) {
        throw createError(400, "Please choose a valid teacher.");
      }
      safePatch.teacherName = safeUser(teacher).displayName;
    }

    if (req.user.role === "moderator" && !req.user.moderatorPermissions?.manageCourses) {
      const pendingEdit = {
        id: crypto.randomUUID(),
        submittedBy: req.user.id,
        submittedAt: nowIso(),
        patch: safePatch,
      };

      updateDb((mutableDb) => {
        const mutableCourse = resolveCourse(mutableDb, course.id);
        mutableCourse.pendingEdits.push(pendingEdit);
        mutableCourse.updatedAt = nowIso();
      });

      res.json({ pending: true, edit: pendingEdit });
      return;
    }

    updateDb((mutableDb) => {
      const mutableCourse = resolveCourse(mutableDb, course.id);
      Object.assign(mutableCourse, safePatch, {
        slug: safePatch.title ? slugify(safePatch.title) : mutableCourse.slug,
        updatedAt: nowIso(),
      });
    });

    const freshCourse = resolveCourse(getDb(), course.id);
    res.json({ course: buildCourseSummary(freshCourse, getDb(), req.user) });
  }),
);

app.post(
  "/api/courses/:courseId/pending-edits/:editId/approve",
  requireAuth,
  requireRoles(["admin"]),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);

    if (!course) {
      throw createError(404, "Course not found.");
    }

    const edit = course.pendingEdits.find((entry) => entry.id === req.params.editId);

    if (!edit) {
      throw createError(404, "Pending edit not found.");
    }

    updateDb((mutableDb) => {
      const mutableCourse = resolveCourse(mutableDb, course.id);
      Object.assign(mutableCourse, edit.patch, {
        slug: edit.patch.title ? slugify(edit.patch.title) : mutableCourse.slug,
        updatedAt: nowIso(),
      });
      mutableCourse.pendingEdits = mutableCourse.pendingEdits.filter((entry) => entry.id !== edit.id);
    });

    const freshCourse = resolveCourse(getDb(), course.id);
    res.json({ course: buildCourseSummary(freshCourse, getDb(), req.user) });
  }),
);

app.delete(
  "/api/courses/:courseId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    if (!canPublishCoursesByPermission(req.user)) {
      throw createError(403, "You are not allowed to delete courses.");
    }

    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);

    if (!course) {
      throw createError(404, "Course not found.");
    }

    updateDb((mutableDb) => {
      mutableDb.courses = mutableDb.courses.filter((entry) => entry.id !== course.id);
      mutableDb.enrollments = mutableDb.enrollments.filter((entry) => entry.courseId !== course.id);
      mutableDb.payments = mutableDb.payments.filter((entry) => entry.courseId !== course.id);
      mutableDb.feedback = mutableDb.feedback.filter((entry) => entry.courseId !== course.id);
      mutableDb.courseRatings = mutableDb.courseRatings.filter((entry) => entry.courseId !== course.id);
      mutableDb.peerFeedback = mutableDb.peerFeedback.filter((entry) => entry.courseId !== course.id);
      mutableDb.assignmentSubmissions = mutableDb.assignmentSubmissions.filter(
        (entry) => entry.courseId !== course.id,
      );
      mutableDb.meetings = mutableDb.meetings.filter((entry) => entry.courseId !== course.id);
    });

    res.json({ ok: true });
  }),
);

app.post(
  "/api/courses/:courseId/ratings",
  requireAuth,
  requireRoles(["student"]),
  withErrorBoundary(async (req, res) => {
    const rating = Number(req.body.rating || 0);
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);

    if (!course) {
      throw createError(404, "Course not found.");
    }

    const isEnrolled = db.enrollments.some(
      (entry) =>
        entry.userId === req.user.id &&
        entry.courseId === course.id &&
        entry.status === "active",
    );

    if (!isEnrolled) {
      throw createError(403, "Only enrolled students can rate this course.");
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw createError(400, "Rating must be between 1 and 5.");
    }

    updateDb((mutableDb) => {
      const existingRating = mutableDb.courseRatings.find(
        (entry) => entry.courseId === course.id && entry.userId === req.user.id,
      );

      if (existingRating) {
        existingRating.rating = rating;
        existingRating.review = normalizeDynamicText(req.body.review || existingRating.review || "");
        existingRating.updatedAt = nowIso();
        return;
      }

      mutableDb.courseRatings.push({
        id: crypto.randomUUID(),
        courseId: course.id,
        userId: req.user.id,
        rating,
        review: normalizeDynamicText(req.body.review || ""),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const freshCourse = resolveCourse(getDb(), course.id);
    res.json({ course: buildCourseSummary(freshCourse, getDb(), req.user) });
  }),
);

app.post(
  "/api/courses/:courseId/materials",
  requireAuth,
  upload.single("file"),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);
    const fileUrl = req.file ? await storeUploadedAsset(req.file, "course-materials") : "";

    if (!course) {
      throw createError(404, "Course not found.");
    }

    ensureCourseAccess(req.user, course, ["admin", "moderator", "teacher"]);

    const title = normalizeDynamicText(req.body.title);
    if (!title) {
      throw createError(400, "Material title is required.");
    }

    const material = {
      id: crypto.randomUUID(),
      title,
      description: normalizeDynamicText(req.body.description || ""),
      fileUrl,
      linkUrl: normalizeDynamicText(req.body.linkUrl || ""),
      published: req.body.published !== "false",
      createdBy: req.user.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    updateDb((mutableDb) => {
      const mutableCourse = resolveCourse(mutableDb, course.id);
      mutableCourse.materials.unshift(material);
      mutableCourse.updatedAt = nowIso();
    });

    const freshCourse = resolveCourse(getDb(), course.id);
    res.status(201).json({ course: buildCourseSummary(freshCourse, getDb(), req.user) });
  }),
);

app.post(
  "/api/courses/:courseId/documents",
  requireAuth,
  upload.single("file"),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);
    const fileUrl = req.file ? await storeUploadedAsset(req.file, "course-documents") : "";

    if (!course) {
      throw createError(404, "Course not found.");
    }

    ensureCourseAccess(req.user, course, ["admin", "moderator", "teacher"]);

    const title = normalizeDynamicText(req.body.title);
    if (!title) {
      throw createError(400, "Document title is required.");
    }

    const document = {
      id: crypto.randomUUID(),
      title,
      description: normalizeDynamicText(req.body.description || ""),
      fileUrl,
      linkUrl: normalizeDynamicText(req.body.linkUrl || ""),
      published: req.body.published !== "false",
      createdBy: req.user.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    updateDb((mutableDb) => {
      const mutableCourse = resolveCourse(mutableDb, course.id);
      mutableCourse.documents.unshift(document);
      mutableCourse.updatedAt = nowIso();
    });

    const freshCourse = resolveCourse(getDb(), course.id);
    res.status(201).json({ course: buildCourseSummary(freshCourse, getDb(), req.user) });
  }),
);

app.post(
  "/api/courses/:courseId/assignments",
  requireAuth,
  upload.single("file"),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);
    const attachmentUrl = req.file ? await storeUploadedAsset(req.file, "assignment-attachments") : "";

    if (!course) {
      throw createError(404, "Course not found.");
    }

    ensureCourseAccess(req.user, course, ["admin", "moderator", "teacher"]);

    const title = normalizeDynamicText(req.body.title);
    const dueAt = req.body.dueAt ? new Date(req.body.dueAt).toISOString() : "";

    if (!title || !dueAt) {
      throw createError(400, "Assignment title and due date are required.");
    }

    const assignment = {
      id: crypto.randomUUID(),
      title,
      description: normalizeDynamicText(req.body.description || ""),
      dueAt,
      penaltyNote:
        normalizeDynamicText(req.body.penaltyNote || "") ||
        "Upload before the due date or a penalty will occur.",
      attachmentUrl,
      published: req.body.published !== "false",
      createdBy: req.user.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    updateDb((mutableDb) => {
      const mutableCourse = resolveCourse(mutableDb, course.id);
      mutableCourse.assignments.unshift(assignment);
      mutableCourse.updatedAt = nowIso();
    });

    const freshCourse = resolveCourse(getDb(), course.id);
    res.status(201).json({ course: buildCourseSummary(freshCourse, getDb(), req.user) });
  }),
);

app.post(
  "/api/courses/:courseId/assignments/:assignmentId/submissions",
  requireAuth,
  requireRoles(["student"]),
  upload.single("file"),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);
    const assignment = course?.assignments.find((entry) => entry.id === req.params.assignmentId);
    const fileUrl = req.file ? await storeUploadedAsset(req.file, "assignment-submissions") : "";

    if (!course || !assignment) {
      throw createError(404, "Assignment not found.");
    }

    const isEnrolled = db.enrollments.some(
      (entry) =>
        entry.userId === req.user.id &&
        entry.courseId === course.id &&
        entry.status === "active",
    );

    if (!isEnrolled) {
      throw createError(403, "You cannot submit work for this course.");
    }

    if (!req.file && !normalizeDynamicText(req.body.note || "")) {
      throw createError(400, "Attach a file or include a submission note.");
    }

    const submission = {
      id: crypto.randomUUID(),
      assignmentId: assignment.id,
      courseId: course.id,
      studentId: req.user.id,
      note: normalizeDynamicText(req.body.note || ""),
      fileUrl,
      submittedAt: nowIso(),
      updatedAt: nowIso(),
    };

    updateDb((mutableDb) => {
      mutableDb.assignmentSubmissions = mutableDb.assignmentSubmissions.filter(
        (entry) => !(entry.assignmentId === assignment.id && entry.studentId === req.user.id),
      );
      mutableDb.assignmentSubmissions.unshift(submission);
      pushNotification(mutableDb, req.user.id, {
        type: "assignment",
        title: "Assignment uploaded",
        message: `${assignment.title} was submitted successfully.`,
        link: `/courses/${course.slug}`,
      });
    });

    const freshCourse = resolveCourse(getDb(), course.id);
    res.status(201).json({ course: buildCourseSummary(freshCourse, getDb(), req.user) });
  }),
);

app.post(
  "/api/courses/:courseId/exams",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);

    if (!course) {
      throw createError(404, "Course not found.");
    }

    ensureCourseAccess(req.user, course, ["admin", "moderator", "teacher"]);

    const title = normalizeDynamicText(req.body.title);
    const dueAt = req.body.dueAt ? new Date(req.body.dueAt).toISOString() : "";
    const questions = String(req.body.questionsText || "")
      .split("\n")
      .map((entry) => normalizeDynamicText(entry))
      .filter(Boolean)
      .map((prompt) => ({
        id: crypto.randomUUID(),
        prompt,
      }));

    if (!title || !dueAt || !questions.length) {
      throw createError(400, "Exam title, due date, and at least one question are required.");
    }

    const exam = {
      id: crypto.randomUUID(),
      title,
      instructions: normalizeDynamicText(req.body.instructions || ""),
      dueAt,
      questions,
      published: req.body.published !== "false",
      createdBy: req.user.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    updateDb((mutableDb) => {
      const mutableCourse = resolveCourse(mutableDb, course.id);
      mutableCourse.exams.unshift(exam);
      mutableCourse.updatedAt = nowIso();
    });

    const freshCourse = resolveCourse(getDb(), course.id);
    res.status(201).json({ course: buildCourseSummary(freshCourse, getDb(), req.user) });
  }),
);

app.get(
  "/api/people/:userId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);

    if (!targetUser) {
      throw createError(404, "User not found.");
    }

    if (!canAccessPerson(req.user, targetUser, db)) {
      throw createError(403, "You cannot access this profile.");
    }

    res.json(buildPersonProfile(req.user, targetUser, db));
  }),
);

app.post(
  "/api/people/:userId/comments",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);

    if (!targetUser) {
      throw createError(404, "User not found.");
    }

    if (!canAccessPerson(req.user, targetUser, db) || req.user.id === targetUser.id) {
      throw createError(403, "You cannot comment on this profile.");
    }

    const moderation = moderateCommunityText(req.body.body);
    if (!moderation.ok) {
      throw createError(400, moderation.message);
    }

    updateDb((mutableDb) => {
      mutableDb.profileComments.unshift({
        id: crypto.randomUUID(),
        targetUserId: targetUser.id,
        authorId: req.user.id,
        body: moderation.text,
        createdAt: nowIso(),
      });
    });

    res.status(201).json(buildPersonProfile(req.user, targetUser, getDb()));
  }),
);

app.delete(
  "/api/people/:userId/comments/:commentId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);
    const comment = db.profileComments.find(
      (entry) => entry.id === req.params.commentId && entry.targetUserId === req.params.userId,
    );

    if (!targetUser || !comment) {
      throw createError(404, "Comment not found.");
    }

    if (!canDeleteProfileComment(req.user, comment)) {
      throw createError(403, "You cannot delete this profile comment.");
    }

    updateDb((mutableDb) => {
      resolveReportsForTargets(mutableDb, [{ targetType: "profile_comment", targetId: req.params.commentId }]);
      mutableDb.profileComments = mutableDb.profileComments.filter((entry) => entry.id !== req.params.commentId);
    });

    res.json(buildPersonProfile(req.user, targetUser, getDb()));
  }),
);

app.post(
  "/api/people/:userId/comments/:commentId/report",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);
    const comment = db.profileComments.find(
      (entry) => entry.id === req.params.commentId && entry.targetUserId === req.params.userId,
    );

    if (!targetUser || !comment) {
      throw createError(404, "Comment not found.");
    }

    if (comment.authorId === req.user.id) {
      throw createError(400, "You cannot report your own profile comment.");
    }

    let report;
    updateDb((mutableDb) => {
      report = createReportRecord(mutableDb, {
        reporterId: req.user.id,
        reportedUserId: comment.authorId,
        targetUserId: targetUser.id,
        targetType: "profile_comment",
        targetId: comment.id,
        reason: normalizeDynamicText(req.body.reason || "Profile comment needs review"),
        excerpt: comment.body,
        subject: "A profile comment",
      });
    });

    res.status(201).json({ report: buildReportSummary(report, getDb()) });
  }),
);

app.post(
  "/api/people/:userId/feedback",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);

    if (!targetUser) {
      throw createError(404, "User not found.");
    }

    const moderation = moderateCommunityText(req.body.body || req.body.comment);
    if (!moderation.ok) {
      throw createError(400, moderation.message);
    }

    if (req.user.role === "student") {
      if (!(targetUser.role === "student" && usersShareActiveCourse(req.user.id, targetUser.id, db))) {
        throw createError(403, "You can only leave peer feedback for classmates.");
      }

      const courseId = String(req.body.courseId || "").trim();
      if (!courseId) {
        throw createError(400, "Course is required for peer feedback.");
      }

      updateDb((mutableDb) => {
        mutableDb.peerFeedback.unshift({
          id: crypto.randomUUID(),
          targetUserId: targetUser.id,
          authorId: req.user.id,
          courseId,
          body: moderation.text,
          score: Math.max(1, Math.min(Number(req.body.score || 5), 5)),
          tone: normalizeDynamicText(req.body.tone || "supportive"),
          createdAt: nowIso(),
        });
      });
    } else if (["teacher", "admin", "moderator"].includes(req.user.role) && targetUser.role === "student") {
      const score = Math.max(1, Math.min(Number(req.body.score || 80), 100));

      updateDb((mutableDb) => {
        mutableDb.feedback.unshift({
          id: crypto.randomUUID(),
          studentId: targetUser.id,
          teacherId: req.user.id,
          courseId: String(req.body.courseId || "").trim(),
          score,
          comment: moderation.text,
          createdAt: nowIso(),
        });
      });
    } else {
      throw createError(403, "You cannot leave feedback for this user.");
    }

    res.status(201).json(buildPersonProfile(req.user, targetUser, getDb()));
  }),
);

app.delete(
  "/api/people/:userId/feedback/:feedbackId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);
    const peerFeedback = db.peerFeedback.find(
      (entry) => entry.id === req.params.feedbackId && entry.targetUserId === req.params.userId,
    );
    const teacherFeedback = db.feedback.find(
      (entry) => entry.id === req.params.feedbackId && entry.studentId === req.params.userId,
    );
    const entry = peerFeedback || teacherFeedback;

    if (!targetUser || !entry) {
      throw createError(404, "Feedback not found.");
    }

    const authorId = peerFeedback ? peerFeedback.authorId : teacherFeedback.teacherId;
    if (!canDeleteProfileFeedback(req.user, targetUser.id, { ...entry, authorId })) {
      throw createError(403, "You cannot delete this feedback.");
    }

    updateDb((mutableDb) => {
      resolveReportsForTargets(mutableDb, [{ targetType: "profile_feedback", targetId: req.params.feedbackId }]);
      mutableDb.peerFeedback = mutableDb.peerFeedback.filter((feedback) => feedback.id !== req.params.feedbackId);
      mutableDb.feedback = mutableDb.feedback.filter((feedback) => feedback.id !== req.params.feedbackId);
    });

    res.json(buildPersonProfile(req.user, targetUser, getDb()));
  }),
);

app.post(
  "/api/people/:userId/feedback/:feedbackId/report",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);
    const peerFeedback = db.peerFeedback.find(
      (entry) => entry.id === req.params.feedbackId && entry.targetUserId === req.params.userId,
    );
    const teacherFeedback = db.feedback.find(
      (entry) => entry.id === req.params.feedbackId && entry.studentId === req.params.userId,
    );
    const entry = peerFeedback || teacherFeedback;

    if (!targetUser || !entry) {
      throw createError(404, "Feedback not found.");
    }

    const authorId = peerFeedback ? peerFeedback.authorId : teacherFeedback.teacherId;
    if (authorId === req.user.id) {
      throw createError(400, "You cannot report your own feedback.");
    }

    let report;
    updateDb((mutableDb) => {
      report = createReportRecord(mutableDb, {
        reporterId: req.user.id,
        reportedUserId: authorId,
        targetUserId: targetUser.id,
        targetType: "profile_feedback",
        targetId: req.params.feedbackId,
        reason: normalizeDynamicText(req.body.reason || "Profile feedback needs review"),
        excerpt: peerFeedback ? peerFeedback.body : teacherFeedback.comment,
        courseId: entry.courseId || "",
        subject: "A profile feedback entry",
      });
    });

    res.status(201).json({ report: buildReportSummary(report, getDb()) });
  }),
);

app.get(
  "/api/community/members",
  requireAuth,
  withErrorBoundary(async (_req, res) => {
    const db = getDb();
    const members = db.users
      .slice()
      .sort((left, right) => safeUser(left).displayName.localeCompare(safeUser(right).displayName))
      .map((member) => ({
        id: member.id,
        role: member.role,
        displayName: safeUser(member).displayName,
        avatarUrl: safeUser(member).avatarUrl || "",
      }));

    res.json({ members });
  }),
);

app.get(
  "/api/community",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    res.json({
      posts: db.communityPosts
        .slice()
        .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
        .map((post) => summarizeCommunityPost(post, db, req.user)),
    });
  }),
);

app.post(
  "/api/community/posts",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const repostOfId = String(req.body.repostOfId || "").trim();
    const courseId = String(req.body.courseId || "").trim();
    const rawBody = normalizeDynamicText(req.body.body || "");
    const feeling = normalizeCommunityFeeling(req.body.feeling, true);
    const attachments = normalizeCommunityAttachments(req.body.attachments);
    const mentionedUserIds = normalizeCommunityMentionIds(req.body.mentionedUserIds, db, true);

    if (!rawBody && !repostOfId && !attachments.length && !feeling) {
      throw createError(400, "Add some text, a feeling, an attachment, or a reshare before publishing.");
    }

    let body = "";
    if (rawBody) {
      const moderation = moderateCommunityText(rawBody);
      if (!moderation.ok) {
        throw createError(400, moderation.message);
      }
      body = moderation.text;
    }

    if (courseId && !resolveCourse(db, courseId)) {
      throw createError(404, "Course not found.");
    }

    if (repostOfId && !db.communityPosts.find((entry) => entry.id === repostOfId)) {
      throw createError(404, "Original post not found.");
    }

    const newPost = {
      id: crypto.randomUUID(),
      authorId: req.user.id,
      body,
      courseId,
      feeling,
      mentionedUserIds,
      attachments,
      repostOfId,
      reactions: [],
      comments: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    updateDb((mutableDb) => {
      mutableDb.communityPosts.unshift(newPost);
    });

    res.status(201).json({ post: summarizeCommunityPost(newPost, getDb(), req.user) });
  }),
);

app.patch(
  "/api/community/posts/:postId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const post = db.communityPosts.find((entry) => entry.id === req.params.postId);

    if (!post) {
      throw createError(404, "Post not found.");
    }

    if (post.authorId !== req.user.id) {
      throw createError(403, "You can only edit your own post.");
    }

    const rawBody = normalizeDynamicText(req.body.body || "");
    const feeling = normalizeCommunityFeeling(req.body.feeling, true);
    const attachments = normalizeCommunityAttachments(req.body.attachments);
    const mentionedUserIds = normalizeCommunityMentionIds(req.body.mentionedUserIds, db, true);

    if (!rawBody && !post.repostOfId && !attachments.length && !feeling) {
      throw createError(400, "Add some text, a feeling, or an attachment before saving.");
    }

    let body = "";
    if (rawBody) {
      const moderation = moderateCommunityText(rawBody);
      if (!moderation.ok) {
        throw createError(400, moderation.message);
      }
      body = moderation.text;
    }

    updateDb((mutableDb) => {
      const mutablePost = mutableDb.communityPosts.find((entry) => entry.id === req.params.postId);
      mutablePost.body = body;
      mutablePost.feeling = feeling;
      mutablePost.attachments = attachments;
      mutablePost.mentionedUserIds = mentionedUserIds;
      mutablePost.updatedAt = nowIso();
    });

    const freshDb = getDb();
    const freshPost = freshDb.communityPosts.find((entry) => entry.id === req.params.postId);
    res.json({ post: summarizeCommunityPost(freshPost, freshDb, req.user) });
  }),
);

app.delete(
  "/api/community/posts/:postId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const post = db.communityPosts.find((entry) => entry.id === req.params.postId);

    if (!post) {
      throw createError(404, "Post not found.");
    }

    if (!(post.authorId === req.user.id || canModerateCommunity(req.user))) {
      throw createError(403, "You cannot delete this post.");
    }

    updateDb((mutableDb) => {
      const targetPost = mutableDb.communityPosts.find((entry) => entry.id === req.params.postId);
      resolveReportsForTargets(
        mutableDb,
        [
          { targetType: "community_post", targetId: req.params.postId },
          ...((targetPost?.comments || []).map((comment) => ({
            targetType: "community_comment",
            targetId: comment.id,
          })) || []),
        ],
      );
      mutableDb.communityPosts = mutableDb.communityPosts.filter((entry) => entry.id !== req.params.postId);
    });

    res.json({ ok: true });
  }),
);

app.post(
  "/api/community/posts/:postId/report",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const post = db.communityPosts.find((entry) => entry.id === req.params.postId);

    if (!post) {
      throw createError(404, "Post not found.");
    }

    if (post.authorId === req.user.id) {
      throw createError(400, "You cannot report your own post.");
    }

    const reason = normalizeDynamicText(req.body.reason || "Community post needs review");

    let report;
    updateDb((mutableDb) => {
      report = createReportRecord(mutableDb, {
        reporterId: req.user.id,
        reportedUserId: post.authorId,
        targetType: "community_post",
        targetId: post.id,
        reason,
        excerpt: post.body,
        postId: post.id,
        subject: "A community post",
      });
    });

    res.status(201).json({ report: buildReportSummary(report, getDb()) });
  }),
);

app.post(
  "/api/community/posts/:postId/reactions",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const nextType = normalizeDynamicText(req.body.type || "").toLowerCase();
    if (!COMMUNITY_REACTION_TYPES.includes(nextType)) {
      throw createError(400, "Unsupported reaction.");
    }

    updateDb((db) => {
      const post = db.communityPosts.find((entry) => entry.id === req.params.postId);
      if (!post) {
        throw createError(404, "Post not found.");
      }

      post.reactions = (post.reactions || []).filter((entry) => entry.userId !== req.user.id);
      post.reactions.push({
        id: crypto.randomUUID(),
        userId: req.user.id,
        type: nextType,
        createdAt: nowIso(),
      });
      post.updatedAt = nowIso();
    });

    const db = getDb();
    const post = db.communityPosts.find((entry) => entry.id === req.params.postId);
    res.json({ post: summarizeCommunityPost(post, db, req.user) });
  }),
);

app.post(
  "/api/community/posts/:postId/comments",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const moderation = moderateCommunityText(req.body.body);
    if (!moderation.ok) {
      throw createError(400, moderation.message);
    }

    updateDb((db) => {
      const post = db.communityPosts.find((entry) => entry.id === req.params.postId);
      if (!post) {
        throw createError(404, "Post not found.");
      }

      const parentId = String(req.body.parentId || "").trim();
      if (parentId && !post.comments.some((comment) => comment.id === parentId)) {
        throw createError(404, "Comment thread not found.");
      }

      post.comments.push({
        id: crypto.randomUUID(),
        parentId,
        authorId: req.user.id,
        body: moderation.text,
        createdAt: nowIso(),
      });
      post.updatedAt = nowIso();
    });

    const db = getDb();
    const post = db.communityPosts.find((entry) => entry.id === req.params.postId);
    res.json({ post: summarizeCommunityPost(post, db, req.user) });
  }),
);

app.delete(
  "/api/community/posts/:postId/comments/:commentId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const post = db.communityPosts.find((entry) => entry.id === req.params.postId);
    const comment = post?.comments.find((entry) => entry.id === req.params.commentId);

    if (!post || !comment) {
      throw createError(404, "Comment not found.");
    }

    if (!(comment.authorId === req.user.id || post.authorId === req.user.id || canModerateCommunity(req.user))) {
      throw createError(403, "You cannot delete this comment.");
    }

    updateDb((mutableDb) => {
      const mutablePost = mutableDb.communityPosts.find((entry) => entry.id === req.params.postId);
      const removedIds = new Set([req.params.commentId]);
      mutablePost.comments
        .filter((entry) => entry.parentId === req.params.commentId)
        .forEach((entry) => removedIds.add(entry.id));
      resolveReportsForTargets(
        mutableDb,
        [...removedIds].map((commentId) => ({
          targetType: "community_comment",
          targetId: commentId,
        })),
      );
      mutablePost.comments = mutablePost.comments.filter((entry) => !removedIds.has(entry.id));
      mutablePost.updatedAt = nowIso();
    });

    const freshDb = getDb();
    const freshPost = freshDb.communityPosts.find((entry) => entry.id === req.params.postId);
    res.json({ post: summarizeCommunityPost(freshPost, freshDb, req.user) });
  }),
);

app.post(
  "/api/community/posts/:postId/comments/:commentId/report",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const post = db.communityPosts.find((entry) => entry.id === req.params.postId);
    const comment = post?.comments.find((entry) => entry.id === req.params.commentId);

    if (!post || !comment) {
      throw createError(404, "Comment not found.");
    }

    if (comment.authorId === req.user.id) {
      throw createError(400, "You cannot report your own comment.");
    }

    const reason = normalizeDynamicText(req.body.reason || "Community comment needs review");
    let report;
    updateDb((mutableDb) => {
      report = createReportRecord(mutableDb, {
        reporterId: req.user.id,
        reportedUserId: comment.authorId,
        targetType: "community_comment",
        targetId: comment.id,
        reason,
        excerpt: comment.body,
        postId: post.id,
        commentId: comment.id,
        subject: "A community comment",
      });
    });

    res.status(201).json({ report: buildReportSummary(report, getDb()) });
  }),
);

app.get(
  "/api/dashboard/home",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = syncSystemState();

    if (req.user.role !== "student") {
      res.json({ summary: buildRoleSummary(req.user, db) });
      return;
    }

    res.json(buildStudentHome(req.user, db));
  }),
);

app.get(
  "/api/dashboard/summary",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    res.json({ summary: buildRoleSummary(req.user, syncSystemState()) });
  }),
);

app.get(
  "/api/admin/users",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    if (!canManageUsersByPermission(req.user)) {
      throw createError(403, "You are not allowed to manage users.");
    }

    const db = syncSystemState();
    res.json({
      users: db.users.map((entry) => buildManagedUser(entry, db, req.user)),
    });
  }),
);

app.get(
  "/api/admin/reports",
  requireAuth,
  requireRoles(["admin", "moderator"]),
  withErrorBoundary(async (_req, res) => {
    const db = syncSystemState();
    const reports = db.reports
      .slice()
      .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
      .map((entry) => buildReportSummary(entry, db));

    res.json({
      reports,
      counts: {
        open: reports.filter((entry) => entry.status === "open").length,
        reviewing: reports.filter((entry) => entry.status === "reviewing").length,
        resolved: reports.filter((entry) => entry.status === "resolved").length,
        dismissed: reports.filter((entry) => entry.status === "dismissed").length,
      },
    });
  }),
);

app.post(
  "/api/admin/users",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    if (req.user.role !== "admin") {
      throw createError(403, "You are not allowed to create accounts.");
    }

    const { firstName, lastName, email, password, role, bio = "" } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      throw createError(400, "Please complete all required fields.");
    }

    if (!["teacher", "moderator", "student", "admin"].includes(role)) {
      throw createError(400, "Unsupported role.");
    }

    if (role === "admin" && req.user.role !== "admin") {
      throw createError(403, "Only admins can create admin accounts.");
    }

    const normalizedEmail = normalizePlatformEmail(email);
    const db = getDb();

    if (db.users.some((user) => user.email === normalizedEmail)) {
      throw createError(409, "This email is already in use.");
    }

    if (!validatePasswordStrength(password)) {
      throw createError(400, "Password must be at least 8 characters and include upper, lower, and numeric characters.");
    }

    const createdAt = nowIso();
    const { salt, passwordHash } = hashPassword(password);
    const teacherProfile =
      role === "teacher"
        ? {
            title: "New Instructor",
            specialty: "To be updated",
            score: 0,
            students: 0,
            classes: 0,
            growth: "0%",
          }
        : null;

    const newUser = {
      id: crypto.randomUUID(),
      role,
      isOriginalAdmin: false,
      email: normalizedEmail,
      salt,
      passwordHash,
      firstName,
      lastName,
      displayName: buildDisplayName(firstName, lastName),
      phone: "",
      bio,
      focusTrack: "Career Switch",
      education: "",
      goals: "",
      experience: "",
      privateBadges: false,
      avatarUrl: "",
      achievements: [],
      badges: [],
      certificates: [],
      moderatorPermissions: {
        manageUsers: role === "admin" || role === "moderator",
        manageCourses: role === "admin",
      },
      teacherProfile,
      createdAt,
      updatedAt: createdAt,
    };

    updateDb((mutableDb) => {
      mutableDb.users.push(newUser);
      pushNotification(mutableDb, newUser.id, {
        type: "account",
        title: "Your account was created",
        message: `Your ${role} access is ready inside edUKai.`,
        link: "/signin",
      });
    });

    const freshDb = syncSystemState();
    const freshUser = freshDb.users.find((entry) => entry.id === newUser.id);
    res.status(201).json({ user: buildManagedUser(freshUser, freshDb, req.user) });
  }),
);

app.patch(
  "/api/admin/users/:userId/role",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    if (!canManageUsersByPermission(req.user)) {
      throw createError(403, "You are not allowed to change user roles.");
    }

    const nextRole = req.body.role;
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);

    if (!["student", "teacher", "moderator", "admin"].includes(nextRole)) {
      throw createError(400, "Unsupported role.");
    }

    if (req.params.userId === req.user.id) {
      throw createError(400, "You cannot change your own role.");
    }

    if (req.user.role === "moderator" && nextRole === "moderator") {
      throw createError(403, "Moderators cannot assign moderator role.");
    }

    if (req.user.role !== "admin" && nextRole === "admin") {
      throw createError(403, "Only admins can assign admin role.");
    }

    if (!targetUser) {
      throw createError(404, "User not found.");
    }

    if (!canChangeUserRole(req.user, targetUser)) {
      throw createError(403, "You are not allowed to change this account.");
    }

    updateDb((mutableDb) => {
      const mutableUser = mutableDb.users.find((entry) => entry.id === req.params.userId);
      const previousRole = mutableUser.role;

      mutableUser.role = nextRole;
      mutableUser.moderatorPermissions =
        nextRole === "moderator"
          ? previousRole === "moderator"
            ? {
                manageUsers: Boolean(mutableUser.moderatorPermissions?.manageUsers),
                manageCourses: Boolean(mutableUser.moderatorPermissions?.manageCourses),
              }
            : { manageUsers: true, manageCourses: false }
          : nextRole === "admin"
            ? { manageUsers: true, manageCourses: true }
            : { manageUsers: false, manageCourses: false };
      if (nextRole === "teacher" && !mutableUser.teacherProfile) {
        mutableUser.teacherProfile = {
          title: "Instructor",
          specialty: "To be updated",
          score: 0,
          students: 0,
          classes: 0,
          growth: "0%",
        };
      }
      mutableUser.updatedAt = nowIso();
    });

    const freshDb = syncSystemState();
    const freshUser = freshDb.users.find((entry) => entry.id === req.params.userId);
    res.json({ user: buildManagedUser(freshUser, freshDb, req.user) });
  }),
);

app.delete(
  "/api/admin/users/:userId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    if (!canManageUsersByPermission(req.user)) {
      throw createError(403, "You are not allowed to delete accounts.");
    }

    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);

    if (!targetUser) {
      throw createError(404, "User not found.");
    }

    if (!canDeleteUser(req.user, targetUser)) {
      throw createError(403, "You are not allowed to delete this account.");
    }

    updateDb((mutableDb) => {
      deleteUserAccount(req.params.userId, mutableDb);
    });

    syncSystemState();
    res.json({ ok: true });
  }),
);

app.patch(
  "/api/admin/users/:userId/permissions",
  requireAuth,
  requireRoles(["admin"]),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const targetUser = db.users.find((entry) => entry.id === req.params.userId);

    if (!targetUser) {
      throw createError(404, "User not found.");
    }

    if (targetUser.role !== "moderator") {
      throw createError(400, "Permissions can only be updated for moderators.");
    }

    updateDb((mutableDb) => {
      const mutableUser = mutableDb.users.find((entry) => entry.id === req.params.userId);
      mutableUser.moderatorPermissions = {
        manageUsers: Boolean(req.body.manageUsers),
        manageCourses: Boolean(req.body.manageCourses),
      };
      mutableUser.updatedAt = nowIso();
    });

    const freshDb = syncSystemState();
    const freshUser = freshDb.users.find((entry) => entry.id === req.params.userId);
    res.json({ user: buildManagedUser(freshUser, freshDb, req.user) });
  }),
);

app.patch(
  "/api/admin/reports/:reportId",
  requireAuth,
  requireRoles(["admin", "moderator"]),
  withErrorBoundary(async (req, res) => {
    const nextStatus = normalizeDynamicText(req.body.status || "").toLowerCase();
    if (!["open", "reviewing", "resolved", "dismissed"].includes(nextStatus)) {
      throw createError(400, "Unsupported report status.");
    }

    updateDb((mutableDb) => {
      const report = mutableDb.reports.find((entry) => entry.id === req.params.reportId);
      if (!report) {
        throw createError(404, "Report not found.");
      }

      report.status = nextStatus;
      report.updatedAt = nowIso();
      report.resolvedAt = ["resolved", "dismissed"].includes(nextStatus) ? nowIso() : "";
    });

    const freshDb = syncSystemState();
    const report = freshDb.reports.find((entry) => entry.id === req.params.reportId);
    res.json({ report: buildReportSummary(report, freshDb) });
  }),
);

app.patch(
  "/api/profile",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const allowedFields = ["displayName", "bio", "focusTrack", "privateBadges", "achievements", "phone"];
    const nextValues = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedFields.includes(key)),
    );

    updateDb((mutableDb) => {
      const targetUser = mutableDb.users.find((entry) => entry.id === req.user.id);
      Object.assign(targetUser, nextValues, { updatedAt: nowIso() });
    });

    const freshUser = getDb().users.find((entry) => entry.id === req.user.id);
    res.json({ user: safeUser(freshUser) });
  }),
);

app.post(
  "/api/profile/avatar",
  requireAuth,
  upload.single("avatar"),
  withErrorBoundary(async (req, res) => {
    if (!req.file) {
      throw createError(400, "Please attach an image.");
    }

    const avatarUrl = await storeUploadedAsset(req.file, "avatars");

    updateDb((mutableDb) => {
      const targetUser = mutableDb.users.find((entry) => entry.id === req.user.id);
      targetUser.avatarUrl = avatarUrl;
      targetUser.updatedAt = nowIso();
    });

    const freshUser = getDb().users.find((entry) => entry.id === req.user.id);
    res.json({ user: safeUser(freshUser) });
  }),
);

app.patch(
  "/api/profile/password",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const db = getDb();
    const currentUser = db.users.find((entry) => entry.id === req.user.id);

    if (!verifyPassword(currentPassword, currentUser.passwordHash, currentUser.salt)) {
      throw createError(400, "Current password is incorrect.");
    }

    if (!validatePasswordStrength(newPassword)) {
      throw createError(400, "New password must be at least 8 characters and include upper, lower, and numeric characters.");
    }

    const nextHash = hashPassword(newPassword);

    updateDb((mutableDb) => {
      const mutableUser = mutableDb.users.find((entry) => entry.id === req.user.id);
      mutableUser.passwordHash = nextHash.passwordHash;
      mutableUser.salt = nextHash.salt;
      mutableUser.updatedAt = nowIso();
    });

    res.json({ ok: true });
  }),
);

app.patch(
  "/api/profile/email",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { currentPassword, newEmail } = req.body;
    const normalizedEmail = normalizePlatformEmail(newEmail);
    const db = getDb();
    const currentUser = db.users.find((entry) => entry.id === req.user.id);

    if (!verifyPassword(currentPassword, currentUser.passwordHash, currentUser.salt)) {
      throw createError(400, "Current password is incorrect.");
    }

    if (db.users.some((entry) => entry.email === normalizedEmail && entry.id !== currentUser.id)) {
      throw createError(409, "This email is already in use.");
    }

    updateDb((mutableDb) => {
      const mutableUser = mutableDb.users.find((entry) => entry.id === req.user.id);
      mutableUser.email = normalizedEmail;
      mutableUser.updatedAt = nowIso();
    });

    const freshUser = getDb().users.find((entry) => entry.id === req.user.id);
    res.json({ user: safeUser(freshUser) });
  }),
);

app.get(
  "/api/payments/config",
  requireAuth,
  withErrorBoundary(async (_req, res) => {
    res.json({
      provider: "paymob",
      mode: hasPaymobConfig() ? "live" : "mock",
    });
  }),
);

app.post(
  "/api/payments/create-checkout",
  requireAuth,
  requireRoles(["student"]),
  withErrorBoundary(async (req, res) => {
    const { courseId, slotId, selectedDays = [], daysPerWeek = 2, paymentPlan = "installment" } = req.body;
    const db = getDb();
    const course = resolveCourse(db, courseId);
    const normalizedPlan = normalizePaymentPlan(paymentPlan);

    if (!course) {
      throw createError(404, "Course not found.");
    }

    const slot = course.slots.find((entry) => entry.id === slotId);

    if (!slot) {
      throw createError(400, "Please choose a valid class slot.");
    }

    const alreadyEnrolled = db.enrollments.some(
      (entry) => entry.userId === req.user.id && entry.courseId === course.id && entry.status === "active",
    );

    if (alreadyEnrolled) {
      const currentPaymentSummary = buildCoursePaymentSummary(course, req.user.id, db);
      if (currentPaymentSummary.remainingCents > 0) {
        throw createError(409, "You already reserved your seat for this course. The remaining balance is still attached to your account.");
      }

      throw createError(409, "You are already enrolled in this course.");
    }

    if (!["installment", "full", "three_payments"].includes(normalizedPlan)) {
      throw createError(400, "Unsupported payment plan.");
    }

    const depositCents = calculateDepositCents(course.priceCents);
    const planDetails = buildPaymentPlanDescriptor(normalizedPlan, course.priceCents);
    const firstStageMeta = getPaymentStageMeta(
      normalizedPlan,
      1,
      planDetails.installmentCount,
      course.priceCents,
    );
    const amountCents = planDetails.initialAmountCents;

    const payment = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      courseId: course.id,
      slotId: slot.id,
      selectedDays,
      daysPerWeek,
      amountCents,
      fullAmountCents: course.priceCents,
      depositCents,
      remainingCents: Math.max(course.priceCents - amountCents, 0),
      paymentStage: firstStageMeta.paymentStage,
      paymentPlan: normalizedPlan,
      installmentIndex: 1,
      installmentCount: planDetails.installmentCount,
      currency: course.currency,
      status: "pending",
      provider: "paymob",
      providerReference: "",
      checkoutUrl: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      dueAt: addDaysToIso(nowIso(), PAYMENT_CHECKOUT_GRACE_DAYS),
      remainingDueAt: "",
    };

    const checkout = await createPaymobCheckout(payment, course, req.user);
    payment.providerReference = checkout.providerReference;
    payment.checkoutUrl = checkout.checkoutUrl;
    payment.mode = checkout.mode;

    updateDb((mutableDb) => {
      mutableDb.payments.push(payment);
      pushNotification(mutableDb, req.user.id, {
        type: "payment",
        title:
          normalizedPlan === "full"
            ? "Full payment checkout created"
            : normalizedPlan === "three_payments"
              ? "First payment checkout created"
              : "Deposit checkout created",
        message:
          normalizedPlan === "full"
            ? `Your full payment for ${course.title} is ready to confirm.`
            : normalizedPlan === "three_payments"
              ? `Payment 1 of ${planDetails.installmentCount} for ${course.title} is ready to confirm.`
              : `Your ${Math.round(COURSE_DEPOSIT_RATE * 100)}% deposit for ${course.title} is ready to confirm.`,
        link: `/payments?paymentId=${payment.id}`,
      });
    });

    res.status(201).json({
      payment: {
        id: payment.id,
        amountCents: payment.amountCents,
        fullAmountCents: payment.fullAmountCents,
        depositCents: payment.depositCents,
        remainingCents: payment.remainingCents,
        paymentPlan: payment.paymentPlan,
        paymentStage: payment.paymentStage,
        currency: payment.currency,
        status: payment.status,
        mode: payment.mode,
        checkoutUrl: payment.checkoutUrl,
        dueAt: payment.dueAt,
      },
    });
  }),
);

app.get(
  "/api/payments",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = syncSystemState();
    const payments = db.payments
      .filter((entry) => entry.userId === req.user.id)
      .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
      .map((entry) => {
        const summary = summarizePaymentRecord(entry, db);
        const course = resolveCourse(db, entry.courseId);

        return {
          ...entry,
          ...summary,
          courseSlug: course?.slug || "",
          courseTitle: course?.title || "Course",
          checkoutUrl: entry.checkoutUrl || "",
          mode: entry.mode || "mock",
        };
      });

    res.json({ payments });
  }),
);

app.post(
  "/api/payments/:paymentId/create-remaining-checkout",
  requireAuth,
  requireRoles(["student"]),
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const sourcePayment = db.payments.find(
      (entry) => entry.id === req.params.paymentId && entry.userId === req.user.id,
    );

    if (!sourcePayment) {
      throw createError(404, "Payment not found.");
    }

    if (sourcePayment.status !== "paid") {
      throw createError(400, "Confirm the first payment before creating the next checkout.");
    }

    const sourceSummary = summarizePaymentRecord(sourcePayment, db);
    if (!sourceSummary.nextInstallmentIndex || sourceSummary.remainingCents <= 0) {
      throw createError(400, "There is no remaining balance for this course.");
    }

    const course = resolveCourse(db, sourcePayment.courseId);
    const normalizedPlan = normalizePaymentPlan(sourcePayment.paymentPlan);
    const planDetails = buildPaymentPlanDescriptor(
      normalizedPlan,
      sourcePayment.fullAmountCents || course?.priceCents || sourceSummary.remainingCents,
    );
    const nextInstallmentIndex = sourceSummary.nextInstallmentIndex;
    const existingPending = db.payments.find(
      (entry) =>
        entry.userId === req.user.id &&
        entry.courseId === sourcePayment.courseId &&
        entry.status === "pending" &&
        getPaymentInstallmentIndex(entry, course) === nextInstallmentIndex,
    );

    if (existingPending) {
      const existingSummary = summarizePaymentRecord(existingPending, db);
      res.json({
        payment: {
          ...existingPending,
          ...existingSummary,
        },
      });
      return;
    }

    const nextStageMeta = getPaymentStageMeta(
      normalizedPlan,
      nextInstallmentIndex,
      planDetails.installmentCount,
      sourcePayment.fullAmountCents || course?.priceCents || sourceSummary.remainingCents,
    );
    const payment = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      courseId: sourcePayment.courseId,
      slotId: sourcePayment.slotId,
      selectedDays: sourcePayment.selectedDays || [],
      daysPerWeek: sourcePayment.daysPerWeek || 2,
      amountCents: planDetails.installments[nextInstallmentIndex - 1] || sourceSummary.remainingCents,
      fullAmountCents: sourcePayment.fullAmountCents || course?.priceCents || sourceSummary.remainingCents,
      depositCents: sourcePayment.depositCents || calculateDepositCents(course?.priceCents || sourceSummary.remainingCents),
      remainingCents: Math.max(
        Number(sourcePayment.fullAmountCents || course?.priceCents || sourceSummary.remainingCents) -
          planDetails.installments.slice(0, nextInstallmentIndex).reduce((sum, amount) => sum + amount, 0),
        0,
      ),
      paymentStage: nextStageMeta.paymentStage,
      paymentPlan: normalizedPlan,
      installmentIndex: nextInstallmentIndex,
      installmentCount: planDetails.installmentCount,
      currency: sourcePayment.currency || course?.currency || "EGP",
      status: "pending",
      provider: "paymob",
      providerReference: "",
      checkoutUrl: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      dueAt: sourceSummary.dueAt || addDaysToIso(nowIso(), REMAINING_PAYMENT_GRACE_DAYS),
      remainingDueAt: "",
    };

    const checkout = await createPaymobCheckout(payment, course, req.user);
    payment.providerReference = checkout.providerReference;
    payment.checkoutUrl = checkout.checkoutUrl;
    payment.mode = checkout.mode;

    updateDb((mutableDb) => {
      mutableDb.payments.push(payment);
      pushNotification(mutableDb, req.user.id, {
        type: "payment",
        title:
          nextStageMeta.paymentStage === "final"
            ? "Final payment checkout created"
            : "Next installment checkout created",
        message: `The ${nextStageMeta.stageLabel.toLowerCase()} for ${course?.title || "your course"} is ready to confirm.`,
        link: `/payments?paymentId=${payment.id}`,
      });
    });

    res.status(201).json({
      payment: {
        ...payment,
        ...summarizePaymentRecord(payment, getDb()),
      },
    });
  }),
);

app.get(
  "/api/payments/:paymentId",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = syncSystemState();
    const payment = db.payments.find(
      (entry) => entry.id === req.params.paymentId && entry.userId === req.user.id,
    );

    if (!payment) {
      throw createError(404, "Payment not found.");
    }

    const course = resolveCourse(db, payment.courseId);
    const paymentSummary = summarizePaymentRecord(payment, db);
    res.json({
      payment: {
        ...payment,
        ...paymentSummary,
        courseTitle: course?.title || "Course",
        courseSlug: course?.slug || "",
      },
    });
  }),
);

app.post(
  "/api/payments/:paymentId/mock-complete",
  requireAuth,
  requireRoles(["student"]),
  withErrorBoundary(async (req, res) => {
    updateDb((mutableDb) => {
      const payment = mutableDb.payments.find(
        (entry) => entry.id === req.params.paymentId && entry.userId === req.user.id,
      );

      if (!payment) {
        throw createError(404, "Payment not found.");
      }

      finalizeEnrollmentFromPayment(payment.id, mutableDb);
    });

    res.json({ ok: true });
  }),
);

app.post(
  "/api/payments/paymob/webhook",
  withErrorBoundary(async (req, res) => {
    const receivedHmac = req.body.hmac || req.headers["x-paymob-signature"] || "";

    if (PAYMOB_HMAC_SECRET && PAYMOB_HMAC_FIELDS && !verifyFlexiblePaymobHmac(req.body, receivedHmac)) {
      throw createError(401, "Invalid Paymob HMAC signature.");
    }

    const payload = req.body.obj || req.body;
    const paymentReference =
      payload.special_reference ||
      payload.order?.merchant_order_id ||
      payload.order?.id ||
      payload.merchant_order_id ||
      payload.id;
    const paymentSucceeded = Boolean(
      payload.success === true ||
        payload.is_paid === true ||
        payload.paid_at ||
        payload.status === "paid" ||
        payload.status === "success" ||
        payload.status === "succeeded",
    );

    if (!paymentReference || !paymentSucceeded) {
      res.json({ ok: true });
      return;
    }

    updateDb((mutableDb) => {
      finalizeEnrollmentFromPayment(String(paymentReference), mutableDb);
    });

    res.json({ ok: true });
  }),
);

app.get(
  "/api/courses/:courseId/slots/:slotId/chat",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);
    const slot = course?.slots.find((entry) => entry.id === req.params.slotId);

    if (!course || !slot) {
      throw createError(404, "Classroom not found.");
    }

    const isEnrolled = db.enrollments.some(
      (entry) =>
        entry.userId === req.user.id &&
        entry.courseId === course.id &&
        entry.slotId === slot.id &&
        entry.status === "active",
    );

    const canAccess = isEnrolled || course.teacherId === req.user.id || ["admin", "moderator"].includes(req.user.role);

    if (!canAccess) {
      throw createError(403, "You cannot access this classroom chat.");
    }

    const messages = slot.chatMessages.map((message) => {
      const author = db.users.find((entry) => entry.id === message.userId);
      return {
        ...message,
        authorName: author ? safeUser(author).displayName : "User",
      };
    });

    res.json({ messages });
  }),
);

app.post(
  "/api/courses/:courseId/slots/:slotId/chat",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.params.courseId);
    const slot = course?.slots.find((entry) => entry.id === req.params.slotId);

    if (!course || !slot) {
      throw createError(404, "Classroom not found.");
    }

    const isEnrolled = db.enrollments.some(
      (entry) =>
        entry.userId === req.user.id &&
        entry.courseId === course.id &&
        entry.slotId === slot.id &&
        entry.status === "active",
    );

    const canAccess = isEnrolled || course.teacherId === req.user.id || ["admin", "moderator"].includes(req.user.role);

    if (!canAccess) {
      throw createError(403, "You cannot access this classroom chat.");
    }

    if (!req.body.message) {
      throw createError(400, "Message is required.");
    }

    const newMessage = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      message: String(req.body.message).trim(),
      createdAt: nowIso(),
    };

    updateDb((mutableDb) => {
      const mutableCourse = resolveCourse(mutableDb, course.id);
      const mutableSlot = mutableCourse.slots.find((entry) => entry.id === slot.id);
      mutableSlot.chatMessages.push(newMessage);
    });

    res.status(201).json({
      message: {
        ...newMessage,
        authorName: safeUser(req.user).displayName,
      },
    });
  }),
);

app.get(
  "/api/calendar/classes/:slotId.ics",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const db = getDb();
    const course = resolveCourse(db, req.query.courseId);
    const slot = course?.slots.find((entry) => entry.id === req.params.slotId);

    if (!course || !slot) {
      throw createError(404, "Class slot not found.");
    }

    const isEnrolled = db.enrollments.some(
      (entry) =>
        entry.userId === req.user.id &&
        entry.courseId === course.id &&
        entry.slotId === slot.id &&
        entry.status === "active",
    );

    if (!(isEnrolled || ["admin", "moderator", "teacher"].includes(req.user.role))) {
      throw createError(403, "Calendar export is only available to the class participants.");
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${course.slug}-${slot.id}.ics"`);
    res.send(buildIcsForSlot(course, slot));
  }),
);

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({
      error: `Files can be up to ${Math.round(UPLOAD_FILE_SIZE_LIMIT_BYTES / (1024 * 1024))} MB.`,
    });
    return;
  }

  if (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Something went wrong.",
    });
    return;
  }

  next();
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  app.listen(PORT, () => {
    console.log(`edUKai API listening on http://127.0.0.1:${PORT}`);
  });
}

export default app;

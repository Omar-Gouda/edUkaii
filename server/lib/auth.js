import crypto from "node:crypto";

const KEY_LENGTH = 64;

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return { salt, passwordHash };
}

export function verifyPassword(password, passwordHash, salt) {
  const incomingHash = crypto.scryptSync(password, salt, KEY_LENGTH);
  const storedHash = Buffer.from(passwordHash, "hex");
  return (
    incomingHash.length === storedHash.length &&
    crypto.timingSafeEqual(incomingHash, storedHash)
  );
}

export function createOpaqueToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function safeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
    isOriginalAdmin: Boolean(user.isOriginalAdmin),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    phone: user.phone,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    focusTrack: user.focusTrack,
    education: user.education,
    goals: user.goals,
    experience: user.experience,
    privateBadges: user.privateBadges,
    achievements: user.achievements || [],
    badges: user.badges || [],
    certificates: user.certificates || [],
    moderatorPermissions: {
      manageUsers: Boolean(user.moderatorPermissions?.manageUsers),
      manageCourses: Boolean(user.moderatorPermissions?.manageCourses),
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    teacherProfile: user.teacherProfile || null,
  };
}

export function publicTeacher(user) {
  const base = safeUser(user);

  if (!base) {
    return null;
  }

  return {
    ...base,
    teacherProfile: user.teacherProfile || null,
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function buildDisplayName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

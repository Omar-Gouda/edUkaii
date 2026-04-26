export const EDUKAI_EMAIL_DOMAIN = "edukai.com";

export function stripEdUkaiDomain(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (normalized.endsWith(`@${EDUKAI_EMAIL_DOMAIN}`)) {
    return normalized.slice(0, -(`@${EDUKAI_EMAIL_DOMAIN}`.length));
  }

  return normalized.replace(/@.*$/, "");
}

export function buildEdUkaiEmail(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (normalized.includes("@")) {
    return normalized;
  }

  return `${normalized}@${EDUKAI_EMAIL_DOMAIN}`;
}

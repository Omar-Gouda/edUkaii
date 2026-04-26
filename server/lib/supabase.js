import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";
const SUPABASE_STATE_TABLE = process.env.SUPABASE_STATE_TABLE || "app_state";
const SUPABASE_STATE_ROW_ID = process.env.SUPABASE_STATE_ROW_ID || "primary";
const SUPABASE_STORAGE_BUCKETS = Object.freeze({
  default: process.env.SUPABASE_ASSETS_BUCKET || "edukai-assets",
  avatars: process.env.SUPABASE_AVATARS_BUCKET || "edukai-avatars",
  courseThumbnails:
    process.env.SUPABASE_COURSE_THUMBNAILS_BUCKET || "edukai-course-thumbnails",
  courseMaterials:
    process.env.SUPABASE_COURSE_MATERIALS_BUCKET || "edukai-course-materials",
  courseDocuments:
    process.env.SUPABASE_COURSE_DOCUMENTS_BUCKET || "edukai-course-documents",
  assignmentAttachments:
    process.env.SUPABASE_ASSIGNMENT_ATTACHMENTS_BUCKET ||
    "edukai-assignment-attachments",
  assignmentSubmissions:
    process.env.SUPABASE_ASSIGNMENT_SUBMISSIONS_BUCKET ||
    "edukai-assignment-submissions",
});

let adminClient = null;
let publicClient = null;

function createStableClient(key) {
  return createClient(SUPABASE_URL, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    assetsBucket: SUPABASE_STORAGE_BUCKETS.default,
    storageBuckets: { ...SUPABASE_STORAGE_BUCKETS },
    stateTable: SUPABASE_STATE_TABLE,
    stateRowId: SUPABASE_STATE_ROW_ID,
  };
}

export function hasSupabasePublicConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function isSupabaseServerEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseStorageEnabled() {
  return isSupabaseServerEnabled();
}

export function getSupabaseStateTable() {
  return SUPABASE_STATE_TABLE;
}

export function getSupabaseStateRowId() {
  return SUPABASE_STATE_ROW_ID;
}

export function getSupabaseAssetsBucket() {
  return SUPABASE_STORAGE_BUCKETS.default;
}

export function getSupabaseStorageBuckets() {
  return { ...SUPABASE_STORAGE_BUCKETS };
}

export function getSupabaseBucketForAsset(bucketKey = "default") {
  return SUPABASE_STORAGE_BUCKETS[bucketKey] || SUPABASE_STORAGE_BUCKETS.default;
}

export function getSupabaseAdminClient() {
  if (!isSupabaseServerEnabled()) {
    throw new Error(
      "Supabase server mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!adminClient) {
    adminClient = createStableClient(SUPABASE_SERVICE_ROLE_KEY);
  }

  return adminClient;
}

export function getSupabasePublicClient() {
  if (!hasSupabasePublicConfig()) {
    throw new Error(
      "Supabase public mode requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  if (!publicClient) {
    publicClient = createStableClient(SUPABASE_PUBLISHABLE_KEY);
  }

  return publicClient;
}

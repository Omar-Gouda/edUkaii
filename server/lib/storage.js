import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getUploadsDir } from "./db.js";
import {
  getSupabaseAdminClient,
  getSupabaseBucketForAsset,
  isSupabaseStorageEnabled,
} from "./supabase.js";

const STORAGE_TARGETS = Object.freeze({
  avatars: { bucketKey: "avatars", localDir: "avatars" },
  "course-thumbnails": {
    bucketKey: "courseThumbnails",
    localDir: "course-thumbnails",
  },
  "course-materials": {
    bucketKey: "courseMaterials",
    localDir: "course-materials",
  },
  "course-documents": {
    bucketKey: "courseDocuments",
    localDir: "course-documents",
  },
  "assignment-attachments": {
    bucketKey: "assignmentAttachments",
    localDir: "assignment-attachments",
  },
  "assignment-submissions": {
    bucketKey: "assignmentSubmissions",
    localDir: "assignment-submissions",
  },
  courses: { bucketKey: "default", localDir: "courses" },
});

function buildStoredFileName(originalName = "") {
  const extension = path.extname(originalName || "").toLowerCase() || ".bin";
  return `${Date.now()}-${crypto.randomUUID()}${extension}`;
}

function resolveStorageTarget(assetScope = "courses") {
  return STORAGE_TARGETS[assetScope] || STORAGE_TARGETS.courses;
}

export async function storeUploadedAsset(file, assetScope = "courses") {
  if (!file) {
    return "";
  }

  const fileName = buildStoredFileName(file.originalname);
  const target = resolveStorageTarget(assetScope);

  if (isSupabaseStorageEnabled()) {
    const objectPath = `${target.localDir}/${fileName}`;
    const client = getSupabaseAdminClient();
    const bucket = getSupabaseBucketForAsset(target.bucketKey);
    const { error } = await client.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
    return data.publicUrl;
  }

  const targetDir = path.join(getUploadsDir(), target.localDir);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, fileName), file.buffer);
  return `/uploads/${target.localDir}/${fileName}`;
}

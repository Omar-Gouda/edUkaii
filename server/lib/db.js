import fs from "node:fs";
import path from "node:path";
import {
  getSupabaseAdminClient,
  getSupabaseStateRowId,
  getSupabaseStateTable,
  hasSupabasePublicConfig,
  isSupabaseServerEnabled,
} from "./supabase.js";

const SOURCE_ROOT_DIR = path.resolve(process.cwd(), "server");
const ROOT_DIR = process.env.VERCEL ? path.join("/tmp", "edukai-server") : SOURCE_ROOT_DIR;
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOADS_DIR = path.join(ROOT_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SOURCE_DB_FILE = path.join(SOURCE_ROOT_DIR, "data", "db.json");

let dbCache = null;
let dbSeedFactory = null;
let readyPromise = Promise.resolve();
let remoteHydrationPending = false;
let pendingWritePromise = Promise.resolve();
let deferredMutators = [];

export function getUploadsDir() {
  return UPLOADS_DIR;
}

function ensureStructure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(UPLOADS_DIR, "avatars"), { recursive: true });
  fs.mkdirSync(path.join(UPLOADS_DIR, "courses"), { recursive: true });
}

function persistLocalMirror(db) {
  ensureStructure();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function loadSeedDb(seedFactory) {
  if (ROOT_DIR !== SOURCE_ROOT_DIR && fs.existsSync(SOURCE_DB_FILE)) {
    return JSON.parse(fs.readFileSync(SOURCE_DB_FILE, "utf8"));
  }

  return seedFactory();
}

function loadLocalDb(seedFactory) {
  ensureStructure();

  if (!fs.existsSync(DB_FILE)) {
    const seededDb = loadSeedDb(seedFactory);
    persistLocalMirror(seededDb);
    return seededDb;
  }

  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    const seededDb = loadSeedDb(seedFactory);
    persistLocalMirror(seededDb);
    return seededDb;
  }
}

function applyMutator(currentDb, mutator) {
  const nextDb = structuredClone(currentDb);
  const maybeNextValue = mutator(nextDb);
  return maybeNextValue || nextDb;
}

async function loadRemoteDb() {
  const client = getSupabaseAdminClient();
  const table = getSupabaseStateTable();
  const rowId = getSupabaseStateRowId();
  const { data, error } = await client
    .from(table)
    .select("id, payload")
    .eq("id", rowId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase state load failed: ${error.message}`);
  }

  return data?.payload && typeof data.payload === "object" ? data.payload : null;
}

async function persistRemoteDb(db) {
  const client = getSupabaseAdminClient();
  const table = getSupabaseStateTable();
  const rowId = getSupabaseStateRowId();
  const { error } = await client.from(table).upsert(
    {
      id: rowId,
      payload: structuredClone(db),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Supabase state save failed: ${error.message}`);
  }
}

async function hydrateRemoteDb() {
  await Promise.resolve();

  if (!isSupabaseServerEnabled()) {
    remoteHydrationPending = false;
    return structuredClone(dbCache);
  }

  const remoteDb = await loadRemoteDb();
  const hasDeferredMutators = deferredMutators.length > 0;

  if (remoteDb) {
    dbCache = structuredClone(remoteDb);
    if (hasDeferredMutators) {
      deferredMutators.forEach((mutator) => {
        dbCache = applyMutator(dbCache, mutator);
      });
      await persistRemoteDb(dbCache);
    }
  } else if (hasDeferredMutators) {
    deferredMutators = [];
    await persistRemoteDb(dbCache);
    persistLocalMirror(dbCache);
    remoteHydrationPending = false;
    return structuredClone(dbCache);
  }

  deferredMutators = [];
  persistLocalMirror(dbCache);
  remoteHydrationPending = false;
  return structuredClone(dbCache);
}

function queueRemoteWrite(db) {
  if (!isSupabaseServerEnabled() || remoteHydrationPending) {
    return pendingWritePromise;
  }

  const snapshot = structuredClone(db);
  pendingWritePromise = pendingWritePromise
    .catch(() => {})
    .then(() => persistRemoteDb(snapshot));
  return pendingWritePromise;
}

export function initDb(seedFactory) {
  dbSeedFactory = seedFactory;
  dbCache = loadLocalDb(seedFactory);
  remoteHydrationPending = isSupabaseServerEnabled();

  if (hasSupabasePublicConfig() && !isSupabaseServerEnabled()) {
    console.warn(
      "Supabase public config is present, but SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to local data persistence until the server key is configured.",
    );
  }

  readyPromise = hydrateRemoteDb();
  return structuredClone(dbCache);
}

export async function ensureDbReady() {
  if (!dbCache && dbSeedFactory) {
    dbCache = loadLocalDb(dbSeedFactory);
  }

  await readyPromise;
  return structuredClone(dbCache);
}

export async function flushDbWrites() {
  await readyPromise;
  await pendingWritePromise;
}

export function getDb() {
  return structuredClone(dbCache);
}

export function updateDb(mutator) {
  dbCache = applyMutator(dbCache, mutator);
  persistLocalMirror(dbCache);

  if (remoteHydrationPending) {
    deferredMutators.push(mutator);
    return structuredClone(dbCache);
  }

  queueRemoteWrite(dbCache);
  return structuredClone(dbCache);
}

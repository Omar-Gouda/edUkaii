# Supabase Production Bridge And Relational Schema

This project now supports two Supabase layers:

- `public.app_state` keeps the current Express API working without a full server rewrite.
- A relational `public.app_*` schema stays in sync from `app_state` through a database trigger, so reporting and future API migration can happen on real tables.

## What it does

- Uses `public.app_state` as the durable production store for the current app JSON payload.
- Fans the latest `app_state.payload` out into normalized tables for users, courses, slots, materials, documents, assignments, submissions, payments, meetings, community, reports, messaging, and profile activity.
- Uses dedicated storage buckets for avatars, course thumbnails, course materials, course documents, assignment attachments, and assignment submissions.
- Keeps local JSON and local uploads for local development and fallback.

## Required environment variables

Set these in Vercel or your production host:

```env
SUPABASE_URL=https://uobidxggdvdzziyzfrrq.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STATE_TABLE=app_state
SUPABASE_STATE_ROW_ID=primary
SUPABASE_ASSETS_BUCKET=edukai-assets
SUPABASE_AVATARS_BUCKET=edukai-avatars
SUPABASE_COURSE_THUMBNAILS_BUCKET=edukai-course-thumbnails
SUPABASE_COURSE_MATERIALS_BUCKET=edukai-course-materials
SUPABASE_COURSE_DOCUMENTS_BUCKET=edukai-course-documents
SUPABASE_ASSIGNMENT_ATTACHMENTS_BUCKET=edukai-assignment-attachments
SUPABASE_ASSIGNMENT_SUBMISSIONS_BUCKET=edukai-assignment-submissions
```

The frontend can also use:

```env
VITE_SUPABASE_URL=https://uobidxggdvdzziyzfrrq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Do not rely on `NEXT_PUBLIC_*` names for browser access here. This project is built with Vite, so only `VITE_*` variables are exposed to the frontend bundle.

## Setup steps

1. Open the Supabase SQL editor.
2. Run `supabase/migrations/20260426_init_edukai_bridge.sql`.
3. Run `supabase/migrations/20260426_create_edukai_platform_schema.sql`.
4. Add the production env vars, especially `SUPABASE_SERVICE_ROLE_KEY`.
5. Rotate any previously exposed service-role key before deploying.
6. Redeploy the app.

## Buckets created by the schema migration

- `edukai-assets`: legacy catch-all bucket kept for backward compatibility.
- `edukai-avatars`
- `edukai-course-thumbnails`
- `edukai-course-materials`
- `edukai-course-documents`
- `edukai-assignment-attachments`
- `edukai-assignment-submissions`

## Important note

The current Express API still writes the canonical snapshot into `public.app_state`. The new migration adds a trigger that immediately syncs that JSON snapshot into relational `app_*` tables, so the data stays queryable without waiting for a full backend rewrite.

Direct writes to the new `app_*` tables will not sync back into `app_state`; that should be the next migration phase if you want the API itself to become table-native.

This bridge is functional for launch, but it is not the final low-latency architecture. Each `app_state` write also triggers relational sync work, so the long-term production target should be direct relational writes from the API instead of full-payload fan-out.

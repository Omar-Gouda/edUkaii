create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.jsonb_array(input jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(coalesce(input, '[]'::jsonb)) = 'array' then coalesce(input, '[]'::jsonb)
    else '[]'::jsonb
  end;
$$;

create or replace function public.jsonb_text_array(input jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(select jsonb_array_elements_text(public.jsonb_array(input))),
    array[]::text[]
  );
$$;

create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_state_updated_at_idx on public.app_state (updated_at desc);

insert into public.app_state (id, payload)
values ('primary', '{}'::jsonb)
on conflict (id) do nothing;

create table if not exists public.app_users (
  id text primary key,
  role text not null check (role in ('admin', 'moderator', 'teacher', 'student')),
  email text not null,
  salt text,
  password_hash text,
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null default '',
  phone text not null default '',
  bio text not null default '',
  focus_track text not null default '',
  education text not null default '',
  goals text not null default '',
  experience text not null default '',
  private_badges boolean not null default false,
  avatar_url text not null default '',
  achievements jsonb not null default '[]'::jsonb,
  badges jsonb not null default '[]'::jsonb,
  certificates jsonb not null default '[]'::jsonb,
  teacher_profile jsonb,
  moderator_permissions jsonb not null default '{"manageUsers": false, "manageCourses": false}'::jsonb,
  is_original_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists app_users_email_lower_uidx on public.app_users (lower(email));
create index if not exists app_users_role_idx on public.app_users (role);
create index if not exists app_users_created_at_idx on public.app_users (created_at desc);

create table if not exists public.app_jobs (
  id text primary key,
  title text not null,
  department text not null default '',
  location text not null default '',
  employment_type text not null default '',
  description text not null default '',
  focus_area text not null default '',
  openings integer not null default 1 check (openings > 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  posted_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_jobs_status_idx on public.app_jobs (status);
create index if not exists app_jobs_updated_at_idx on public.app_jobs (updated_at desc);

create table if not exists public.app_courses (
  id text primary key,
  slug text not null,
  title text not null,
  teacher_id text references public.app_users (id) on delete set null,
  teacher_name text not null default '',
  duration text not null default '',
  level text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'EGP',
  summary text not null default '',
  description text not null default '',
  brief text not null default '',
  format text not null default '',
  image_key text not null default '',
  thumbnail_url text not null default '',
  category text not null default '',
  audience text[] not null default array[]::text[],
  outcomes text[] not null default array[]::text[],
  modules text[] not null default array[]::text[],
  published boolean not null default true,
  pending_edits jsonb not null default '[]'::jsonb,
  created_by text references public.app_users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists app_courses_slug_lower_uidx on public.app_courses (lower(slug));
create index if not exists app_courses_teacher_id_idx on public.app_courses (teacher_id);
create index if not exists app_courses_published_idx on public.app_courses (published);
create index if not exists app_courses_updated_at_idx on public.app_courses (updated_at desc);

create table if not exists public.app_course_slots (
  id text primary key,
  course_id text not null references public.app_courses (id) on delete cascade,
  name text not null,
  days text[] not null default array[]::text[],
  start_time time,
  duration_minutes integer not null default 90 check (duration_minutes > 0),
  capacity integer not null default 20 check (capacity > 0),
  location text not null default 'Online Classroom',
  recordings jsonb not null default '[]'::jsonb,
  chat_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_course_slots_course_id_idx on public.app_course_slots (course_id);

create table if not exists public.app_course_materials (
  id text primary key,
  course_id text not null references public.app_courses (id) on delete cascade,
  title text not null,
  description text not null default '',
  file_url text not null default '',
  link_url text not null default '',
  published boolean not null default true,
  created_by text references public.app_users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_course_materials_course_id_idx on public.app_course_materials (course_id);
create index if not exists app_course_materials_published_idx on public.app_course_materials (published);

create table if not exists public.app_course_documents (
  id text primary key,
  course_id text not null references public.app_courses (id) on delete cascade,
  title text not null,
  description text not null default '',
  file_url text not null default '',
  link_url text not null default '',
  published boolean not null default true,
  created_by text references public.app_users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_course_documents_course_id_idx on public.app_course_documents (course_id);
create index if not exists app_course_documents_published_idx on public.app_course_documents (published);

create table if not exists public.app_course_assignments (
  id text primary key,
  course_id text not null references public.app_courses (id) on delete cascade,
  title text not null,
  description text not null default '',
  due_at timestamptz,
  penalty_note text not null default '',
  attachment_url text not null default '',
  published boolean not null default true,
  created_by text references public.app_users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_course_assignments_course_id_idx on public.app_course_assignments (course_id);
create index if not exists app_course_assignments_due_at_idx on public.app_course_assignments (due_at);

create table if not exists public.app_course_exams (
  id text primary key,
  course_id text not null references public.app_courses (id) on delete cascade,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  questions jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  created_by text references public.app_users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_course_exams_course_id_idx on public.app_course_exams (course_id);
create index if not exists app_course_exams_due_at_idx on public.app_course_exams (due_at);

create table if not exists public.app_enrollments (
  id text primary key,
  user_id text not null references public.app_users (id) on delete cascade,
  course_id text not null references public.app_courses (id) on delete cascade,
  slot_id text,
  selected_days text[] not null default array[]::text[],
  days_per_week integer not null default 0,
  status text not null default 'pending',
  payment_status text not null default 'pending',
  enrolled_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_enrollments_user_id_idx on public.app_enrollments (user_id);
create index if not exists app_enrollments_course_id_idx on public.app_enrollments (course_id);
create index if not exists app_enrollments_status_idx on public.app_enrollments (status);

create table if not exists public.app_feedback (
  id text primary key,
  student_id text not null references public.app_users (id) on delete cascade,
  teacher_id text references public.app_users (id) on delete set null,
  course_id text references public.app_courses (id) on delete set null,
  score integer not null default 0 check (score between 0 and 100),
  comment text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_feedback_student_id_idx on public.app_feedback (student_id);
create index if not exists app_feedback_teacher_id_idx on public.app_feedback (teacher_id);
create index if not exists app_feedback_course_id_idx on public.app_feedback (course_id);

create table if not exists public.app_payments (
  id text primary key,
  user_id text not null references public.app_users (id) on delete cascade,
  course_id text not null references public.app_courses (id) on delete cascade,
  slot_id text,
  selected_days text[] not null default array[]::text[],
  days_per_week integer not null default 0,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  full_amount_cents integer not null default 0 check (full_amount_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  remaining_cents integer not null default 0 check (remaining_cents >= 0),
  payment_stage text not null default 'deposit',
  payment_plan text not null default 'full',
  installment_index integer not null default 1 check (installment_index > 0),
  installment_count integer not null default 1 check (installment_count > 0),
  currency text not null default 'EGP',
  status text not null default 'pending',
  provider text not null default 'paymob',
  provider_reference text not null default '',
  checkout_url text not null default '',
  mode text not null default 'mock',
  due_at timestamptz,
  remaining_due_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_payments_user_id_idx on public.app_payments (user_id);
create index if not exists app_payments_course_id_idx on public.app_payments (course_id);
create index if not exists app_payments_status_idx on public.app_payments (status);
create index if not exists app_payments_updated_at_idx on public.app_payments (updated_at desc);

create table if not exists public.app_sessions (
  id text primary key,
  user_id text not null references public.app_users (id) on delete cascade,
  session_type text not null check (session_type in ('access', 'refresh')),
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists app_sessions_token_hash_uidx on public.app_sessions (token_hash);
create index if not exists app_sessions_user_id_idx on public.app_sessions (user_id);
create index if not exists app_sessions_expires_at_idx on public.app_sessions (expires_at);

create table if not exists public.app_reminders (
  id text primary key,
  user_id text references public.app_users (id) on delete cascade,
  category text not null default 'general',
  title text not null default '',
  message text not null default '',
  link text not null default '',
  status text not null default 'pending',
  due_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_reminders_user_id_idx on public.app_reminders (user_id);
create index if not exists app_reminders_due_at_idx on public.app_reminders (due_at);

create table if not exists public.app_notifications (
  id text primary key,
  user_id text not null references public.app_users (id) on delete cascade,
  notification_type text not null default 'general',
  title text not null default '',
  message text not null default '',
  link text not null default '',
  is_read boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_notifications_user_id_idx on public.app_notifications (user_id);
create index if not exists app_notifications_user_read_idx on public.app_notifications (user_id, is_read, created_at desc);

create table if not exists public.app_conversations (
  id text primary key,
  created_by text references public.app_users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_conversations_updated_at_idx on public.app_conversations (updated_at desc);

create table if not exists public.app_conversation_participants (
  conversation_id text not null references public.app_conversations (id) on delete cascade,
  user_id text not null references public.app_users (id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, user_id)
);

create index if not exists app_conversation_participants_user_id_idx on public.app_conversation_participants (user_id);

create table if not exists public.app_conversation_messages (
  id text primary key,
  conversation_id text not null references public.app_conversations (id) on delete cascade,
  sender_id text not null references public.app_users (id) on delete cascade,
  body text not null default '',
  read_by text[] not null default array[]::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_conversation_messages_conversation_id_idx on public.app_conversation_messages (conversation_id, created_at asc);

create table if not exists public.app_meetings (
  id text primary key,
  meeting_type text not null check (meeting_type in ('classroom', 'private', 'crew')),
  title text not null,
  host_id text not null references public.app_users (id) on delete cascade,
  course_id text,
  slot_id text,
  meeting_url text not null default '',
  room_code text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'ended')),
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_meetings_host_id_idx on public.app_meetings (host_id);
create index if not exists app_meetings_status_idx on public.app_meetings (status);
create index if not exists app_meetings_created_at_idx on public.app_meetings (created_at desc);

create table if not exists public.app_meeting_invitees (
  meeting_id text not null references public.app_meetings (id) on delete cascade,
  user_id text not null references public.app_users (id) on delete cascade,
  invited_at timestamptz not null default timezone('utc', now()),
  primary key (meeting_id, user_id)
);

create index if not exists app_meeting_invitees_user_id_idx on public.app_meeting_invitees (user_id);

create table if not exists public.app_community_posts (
  id text primary key,
  author_id text not null references public.app_users (id) on delete cascade,
  course_id text,
  repost_of_id text,
  body text not null default '',
  feeling text not null default '',
  mentioned_user_ids text[] not null default array[]::text[],
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_community_posts_author_id_idx on public.app_community_posts (author_id);
create index if not exists app_community_posts_course_id_idx on public.app_community_posts (course_id);
create index if not exists app_community_posts_created_at_idx on public.app_community_posts (created_at desc);

create table if not exists public.app_community_post_reactions (
  id text primary key,
  post_id text not null references public.app_community_posts (id) on delete cascade,
  user_id text not null references public.app_users (id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists app_community_post_reactions_post_user_uidx on public.app_community_post_reactions (post_id, user_id);
create index if not exists app_community_post_reactions_post_id_idx on public.app_community_post_reactions (post_id);

create table if not exists public.app_community_post_comments (
  id text primary key,
  post_id text not null references public.app_community_posts (id) on delete cascade,
  parent_comment_id text,
  author_id text not null references public.app_users (id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_community_post_comments_post_id_idx on public.app_community_post_comments (post_id, created_at asc);
create index if not exists app_community_post_comments_parent_id_idx on public.app_community_post_comments (parent_comment_id);

create table if not exists public.app_reports (
  id text primary key,
  reporter_id text,
  reported_user_id text,
  target_user_id text,
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  excerpt text not null default '',
  course_id text,
  post_id text,
  comment_id text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_reports_status_idx on public.app_reports (status);
create index if not exists app_reports_target_idx on public.app_reports (target_type, target_id);
create index if not exists app_reports_created_at_idx on public.app_reports (created_at desc);

create table if not exists public.app_profile_comments (
  id text primary key,
  author_id text not null references public.app_users (id) on delete cascade,
  target_user_id text not null references public.app_users (id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_profile_comments_target_user_id_idx on public.app_profile_comments (target_user_id, created_at desc);

create table if not exists public.app_peer_feedback (
  id text primary key,
  author_id text not null references public.app_users (id) on delete cascade,
  target_user_id text not null references public.app_users (id) on delete cascade,
  course_id text,
  body text not null default '',
  score integer not null default 5 check (score between 1 and 5),
  tone text not null default 'supportive',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_peer_feedback_target_user_id_idx on public.app_peer_feedback (target_user_id, created_at desc);
create index if not exists app_peer_feedback_course_id_idx on public.app_peer_feedback (course_id);

create table if not exists public.app_course_ratings (
  id text primary key,
  course_id text not null,
  user_id text not null references public.app_users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists app_course_ratings_course_user_uidx on public.app_course_ratings (course_id, user_id);
create index if not exists app_course_ratings_course_id_idx on public.app_course_ratings (course_id);

create table if not exists public.app_assignment_submissions (
  id text primary key,
  assignment_id text not null,
  course_id text not null,
  student_id text not null references public.app_users (id) on delete cascade,
  note text not null default '',
  file_url text not null default '',
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists app_assignment_submissions_assignment_student_uidx on public.app_assignment_submissions (assignment_id, student_id);
create index if not exists app_assignment_submissions_course_id_idx on public.app_assignment_submissions (course_id);
create index if not exists app_assignment_submissions_student_id_idx on public.app_assignment_submissions (student_id);

do $$
declare
  managed_table text;
  managed_trigger text;
begin
  foreach managed_table in array array[
    'app_state',
    'app_users',
    'app_jobs',
    'app_courses',
    'app_course_slots',
    'app_course_materials',
    'app_course_documents',
    'app_course_assignments',
    'app_course_exams',
    'app_enrollments',
    'app_feedback',
    'app_payments',
    'app_sessions',
    'app_reminders',
    'app_notifications',
    'app_conversations',
    'app_conversation_messages',
    'app_meetings',
    'app_community_posts',
    'app_community_post_reactions',
    'app_community_post_comments',
    'app_reports',
    'app_profile_comments',
    'app_peer_feedback',
    'app_course_ratings',
    'app_assignment_submissions'
  ]
  loop
    managed_trigger := format('trg_%s_set_updated_at', managed_table);
    execute format('drop trigger if exists %I on public.%I', managed_trigger, managed_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_row_updated_at()',
      managed_trigger,
      managed_table
    );
  end loop;
end;
$$;

alter table public.app_state enable row level security;
alter table public.app_users enable row level security;
alter table public.app_jobs enable row level security;
alter table public.app_courses enable row level security;
alter table public.app_course_slots enable row level security;
alter table public.app_course_materials enable row level security;
alter table public.app_course_documents enable row level security;
alter table public.app_course_assignments enable row level security;
alter table public.app_course_exams enable row level security;
alter table public.app_enrollments enable row level security;
alter table public.app_feedback enable row level security;
alter table public.app_payments enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_reminders enable row level security;
alter table public.app_notifications enable row level security;
alter table public.app_conversations enable row level security;
alter table public.app_conversation_participants enable row level security;
alter table public.app_conversation_messages enable row level security;
alter table public.app_meetings enable row level security;
alter table public.app_meeting_invitees enable row level security;
alter table public.app_community_posts enable row level security;
alter table public.app_community_post_reactions enable row level security;
alter table public.app_community_post_comments enable row level security;
alter table public.app_reports enable row level security;
alter table public.app_profile_comments enable row level security;
alter table public.app_peer_feedback enable row level security;
alter table public.app_course_ratings enable row level security;
alter table public.app_assignment_submissions enable row level security;

create or replace function public.sync_edukai_relational_from_payload(target_payload jsonb)
returns void
language plpgsql
as $$
begin
  truncate table
    public.app_meeting_invitees,
    public.app_conversation_messages,
    public.app_conversation_participants,
    public.app_reports,
    public.app_community_post_comments,
    public.app_community_post_reactions,
    public.app_community_posts,
    public.app_meetings,
    public.app_notifications,
    public.app_reminders,
    public.app_sessions,
    public.app_payments,
    public.app_feedback,
    public.app_assignment_submissions,
    public.app_course_ratings,
    public.app_peer_feedback,
    public.app_profile_comments,
    public.app_enrollments,
    public.app_course_exams,
    public.app_course_assignments,
    public.app_course_documents,
    public.app_course_materials,
    public.app_course_slots,
    public.app_courses,
    public.app_jobs,
    public.app_conversations,
    public.app_users;

  if jsonb_typeof(coalesce(target_payload, '{}'::jsonb)) <> 'object' then
    return;
  end if;

  insert into public.app_users (
    id,
    role,
    email,
    salt,
    password_hash,
    first_name,
    last_name,
    display_name,
    phone,
    bio,
    focus_track,
    education,
    goals,
    experience,
    private_badges,
    avatar_url,
    achievements,
    badges,
    certificates,
    teacher_profile,
    moderator_permissions,
    is_original_admin,
    created_at,
    updated_at
  )
  select
    user_entry.user->>'id',
    coalesce(nullif(user_entry.user->>'role', ''), 'student'),
    coalesce(
      nullif(lower(user_entry.user->>'email'), ''),
      format('unknown-%s@edukai.local', user_entry.user->>'id')
    ),
    nullif(user_entry.user->>'salt', ''),
    nullif(user_entry.user->>'passwordHash', ''),
    coalesce(user_entry.user->>'firstName', ''),
    coalesce(user_entry.user->>'lastName', ''),
    coalesce(user_entry.user->>'displayName', ''),
    coalesce(user_entry.user->>'phone', ''),
    coalesce(user_entry.user->>'bio', ''),
    coalesce(user_entry.user->>'focusTrack', ''),
    coalesce(user_entry.user->>'education', ''),
    coalesce(user_entry.user->>'goals', ''),
    coalesce(user_entry.user->>'experience', ''),
    coalesce(nullif(user_entry.user->>'privateBadges', '')::boolean, false),
    coalesce(user_entry.user->>'avatarUrl', ''),
    public.jsonb_array(user_entry.user->'achievements'),
    public.jsonb_array(user_entry.user->'badges'),
    public.jsonb_array(user_entry.user->'certificates'),
    case
      when jsonb_typeof(user_entry.user->'teacherProfile') = 'object' then user_entry.user->'teacherProfile'
      else null
    end,
    case
      when jsonb_typeof(user_entry.user->'moderatorPermissions') = 'object' then user_entry.user->'moderatorPermissions'
      else '{"manageUsers": false, "manageCourses": false}'::jsonb
    end,
    coalesce(nullif(user_entry.user->>'isOriginalAdmin', '')::boolean, false),
    coalesce(nullif(user_entry.user->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(user_entry.user->>'updatedAt', '')::timestamptz,
      coalesce(nullif(user_entry.user->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'users')) as user_entry(user)
  where nullif(user_entry.user->>'id', '') is not null;

  insert into public.app_jobs (
    id,
    title,
    department,
    location,
    employment_type,
    description,
    focus_area,
    openings,
    status,
    posted_at,
    closed_at,
    updated_at
  )
  select
    job_entry.job->>'id',
    coalesce(job_entry.job->>'title', ''),
    coalesce(job_entry.job->>'department', ''),
    coalesce(job_entry.job->>'location', ''),
    coalesce(job_entry.job->>'type', ''),
    coalesce(job_entry.job->>'description', ''),
    coalesce(job_entry.job->>'focusArea', ''),
    coalesce(nullif(job_entry.job->>'openings', '')::integer, 1),
    coalesce(nullif(job_entry.job->>'status', ''), 'open'),
    coalesce(
      nullif(job_entry.job->>'postedAt', '')::timestamptz,
      coalesce(nullif(job_entry.job->>'updatedAt', '')::timestamptz, timezone('utc', now()))
    ),
    nullif(job_entry.job->>'closedAt', '')::timestamptz,
    coalesce(
      nullif(job_entry.job->>'updatedAt', '')::timestamptz,
      coalesce(nullif(job_entry.job->>'postedAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'jobs')) as job_entry(job)
  where nullif(job_entry.job->>'id', '') is not null;

  insert into public.app_courses (
    id,
    slug,
    title,
    teacher_id,
    teacher_name,
    duration,
    level,
    price_cents,
    currency,
    summary,
    description,
    brief,
    format,
    image_key,
    thumbnail_url,
    category,
    audience,
    outcomes,
    modules,
    published,
    pending_edits,
    created_by,
    created_at,
    updated_at
  )
  select
    course_entry.course->>'id',
    coalesce(course_entry.course->>'slug', ''),
    coalesce(course_entry.course->>'title', ''),
    case
      when exists (
        select 1
        from public.app_users app_user
        where app_user.id = nullif(course_entry.course->>'teacherId', '')
      ) then nullif(course_entry.course->>'teacherId', '')
      else null
    end,
    coalesce(course_entry.course->>'teacherName', ''),
    coalesce(course_entry.course->>'duration', ''),
    coalesce(course_entry.course->>'level', ''),
    coalesce(nullif(course_entry.course->>'priceCents', '')::integer, 0),
    coalesce(nullif(course_entry.course->>'currency', ''), 'EGP'),
    coalesce(course_entry.course->>'summary', ''),
    coalesce(course_entry.course->>'description', ''),
    coalesce(course_entry.course->>'brief', ''),
    coalesce(course_entry.course->>'format', ''),
    coalesce(course_entry.course->>'imageKey', ''),
    coalesce(course_entry.course->>'thumbnailUrl', ''),
    coalesce(course_entry.course->>'category', ''),
    public.jsonb_text_array(course_entry.course->'audience'),
    public.jsonb_text_array(course_entry.course->'outcomes'),
    public.jsonb_text_array(course_entry.course->'modules'),
    coalesce(nullif(course_entry.course->>'published', '')::boolean, true),
    public.jsonb_array(course_entry.course->'pendingEdits'),
    case
      when exists (
        select 1
        from public.app_users app_user
        where app_user.id = nullif(course_entry.course->>'createdBy', '')
      ) then nullif(course_entry.course->>'createdBy', '')
      else null
    end,
    coalesce(nullif(course_entry.course->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(course_entry.course->>'updatedAt', '')::timestamptz,
      coalesce(nullif(course_entry.course->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'courses')) as course_entry(course)
  where nullif(course_entry.course->>'id', '') is not null;

  insert into public.app_course_slots (
    id,
    course_id,
    name,
    days,
    start_time,
    duration_minutes,
    capacity,
    location,
    recordings,
    chat_messages,
    created_at,
    updated_at
  )
  select
    slot_entry.slot->>'id',
    course_entry.course->>'id',
    coalesce(slot_entry.slot->>'name', ''),
    public.jsonb_text_array(slot_entry.slot->'days'),
    nullif(slot_entry.slot->>'startTime', '')::time,
    coalesce(nullif(slot_entry.slot->>'durationMinutes', '')::integer, 90),
    coalesce(nullif(slot_entry.slot->>'capacity', '')::integer, 20),
    coalesce(slot_entry.slot->>'location', 'Online Classroom'),
    public.jsonb_array(slot_entry.slot->'recordings'),
    public.jsonb_array(slot_entry.slot->'chatMessages'),
    coalesce(nullif(course_entry.course->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(course_entry.course->>'updatedAt', '')::timestamptz,
      coalesce(nullif(course_entry.course->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'courses')) as course_entry(course)
  cross join lateral jsonb_array_elements(public.jsonb_array(course_entry.course->'slots')) as slot_entry(slot)
  where nullif(course_entry.course->>'id', '') is not null
    and nullif(slot_entry.slot->>'id', '') is not null;

  insert into public.app_course_materials (
    id,
    course_id,
    title,
    description,
    file_url,
    link_url,
    published,
    created_by,
    created_at,
    updated_at
  )
  select
    material_entry.material->>'id',
    course_entry.course->>'id',
    coalesce(material_entry.material->>'title', ''),
    coalesce(material_entry.material->>'description', ''),
    coalesce(material_entry.material->>'fileUrl', ''),
    coalesce(material_entry.material->>'linkUrl', ''),
    coalesce(nullif(material_entry.material->>'published', '')::boolean, true),
    case
      when exists (
        select 1
        from public.app_users app_user
        where app_user.id = nullif(material_entry.material->>'createdBy', '')
      ) then nullif(material_entry.material->>'createdBy', '')
      else null
    end,
    coalesce(
      nullif(material_entry.material->>'createdAt', '')::timestamptz,
      coalesce(nullif(course_entry.course->>'createdAt', '')::timestamptz, timezone('utc', now()))
    ),
    coalesce(
      nullif(material_entry.material->>'updatedAt', '')::timestamptz,
      coalesce(nullif(material_entry.material->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'courses')) as course_entry(course)
  cross join lateral jsonb_array_elements(public.jsonb_array(course_entry.course->'materials')) as material_entry(material)
  where nullif(course_entry.course->>'id', '') is not null
    and nullif(material_entry.material->>'id', '') is not null;

  insert into public.app_course_documents (
    id,
    course_id,
    title,
    description,
    file_url,
    link_url,
    published,
    created_by,
    created_at,
    updated_at
  )
  select
    document_entry.document->>'id',
    course_entry.course->>'id',
    coalesce(document_entry.document->>'title', ''),
    coalesce(document_entry.document->>'description', ''),
    coalesce(document_entry.document->>'fileUrl', ''),
    coalesce(document_entry.document->>'linkUrl', ''),
    coalesce(nullif(document_entry.document->>'published', '')::boolean, true),
    case
      when exists (
        select 1
        from public.app_users app_user
        where app_user.id = nullif(document_entry.document->>'createdBy', '')
      ) then nullif(document_entry.document->>'createdBy', '')
      else null
    end,
    coalesce(
      nullif(document_entry.document->>'createdAt', '')::timestamptz,
      coalesce(nullif(course_entry.course->>'createdAt', '')::timestamptz, timezone('utc', now()))
    ),
    coalesce(
      nullif(document_entry.document->>'updatedAt', '')::timestamptz,
      coalesce(nullif(document_entry.document->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'courses')) as course_entry(course)
  cross join lateral jsonb_array_elements(public.jsonb_array(course_entry.course->'documents')) as document_entry(document)
  where nullif(course_entry.course->>'id', '') is not null
    and nullif(document_entry.document->>'id', '') is not null;

  insert into public.app_course_assignments (
    id,
    course_id,
    title,
    description,
    due_at,
    penalty_note,
    attachment_url,
    published,
    created_by,
    created_at,
    updated_at
  )
  select
    assignment_entry.assignment->>'id',
    course_entry.course->>'id',
    coalesce(assignment_entry.assignment->>'title', ''),
    coalesce(assignment_entry.assignment->>'description', ''),
    nullif(assignment_entry.assignment->>'dueAt', '')::timestamptz,
    coalesce(assignment_entry.assignment->>'penaltyNote', ''),
    coalesce(assignment_entry.assignment->>'attachmentUrl', ''),
    coalesce(nullif(assignment_entry.assignment->>'published', '')::boolean, true),
    case
      when exists (
        select 1
        from public.app_users app_user
        where app_user.id = nullif(assignment_entry.assignment->>'createdBy', '')
      ) then nullif(assignment_entry.assignment->>'createdBy', '')
      else null
    end,
    coalesce(
      nullif(assignment_entry.assignment->>'createdAt', '')::timestamptz,
      coalesce(nullif(course_entry.course->>'createdAt', '')::timestamptz, timezone('utc', now()))
    ),
    coalesce(
      nullif(assignment_entry.assignment->>'updatedAt', '')::timestamptz,
      coalesce(nullif(assignment_entry.assignment->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'courses')) as course_entry(course)
  cross join lateral jsonb_array_elements(public.jsonb_array(course_entry.course->'assignments')) as assignment_entry(assignment)
  where nullif(course_entry.course->>'id', '') is not null
    and nullif(assignment_entry.assignment->>'id', '') is not null;

  insert into public.app_course_exams (
    id,
    course_id,
    title,
    instructions,
    due_at,
    questions,
    published,
    created_by,
    created_at,
    updated_at
  )
  select
    exam_entry.exam->>'id',
    course_entry.course->>'id',
    coalesce(exam_entry.exam->>'title', ''),
    coalesce(exam_entry.exam->>'instructions', ''),
    nullif(exam_entry.exam->>'dueAt', '')::timestamptz,
    public.jsonb_array(exam_entry.exam->'questions'),
    coalesce(nullif(exam_entry.exam->>'published', '')::boolean, true),
    case
      when exists (
        select 1
        from public.app_users app_user
        where app_user.id = nullif(exam_entry.exam->>'createdBy', '')
      ) then nullif(exam_entry.exam->>'createdBy', '')
      else null
    end,
    coalesce(
      nullif(exam_entry.exam->>'createdAt', '')::timestamptz,
      coalesce(nullif(course_entry.course->>'createdAt', '')::timestamptz, timezone('utc', now()))
    ),
    coalesce(
      nullif(exam_entry.exam->>'updatedAt', '')::timestamptz,
      coalesce(nullif(exam_entry.exam->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'courses')) as course_entry(course)
  cross join lateral jsonb_array_elements(public.jsonb_array(course_entry.course->'exams')) as exam_entry(exam)
  where nullif(course_entry.course->>'id', '') is not null
    and nullif(exam_entry.exam->>'id', '') is not null;

  insert into public.app_enrollments (
    id,
    user_id,
    course_id,
    slot_id,
    selected_days,
    days_per_week,
    status,
    payment_status,
    enrolled_at,
    created_at,
    updated_at
  )
  select
    enrollment_entry.enrollment->>'id',
    enrollment_entry.enrollment->>'userId',
    enrollment_entry.enrollment->>'courseId',
    nullif(enrollment_entry.enrollment->>'slotId', ''),
    public.jsonb_text_array(enrollment_entry.enrollment->'selectedDays'),
    coalesce(nullif(enrollment_entry.enrollment->>'daysPerWeek', '')::integer, 0),
    coalesce(nullif(enrollment_entry.enrollment->>'status', ''), 'pending'),
    coalesce(nullif(enrollment_entry.enrollment->>'paymentStatus', ''), 'pending'),
    coalesce(nullif(enrollment_entry.enrollment->>'enrolledAt', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(enrollment_entry.enrollment->>'enrolledAt', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(enrollment_entry.enrollment->>'enrolledAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(public.jsonb_array(target_payload->'enrollments')) as enrollment_entry(enrollment)
  where nullif(enrollment_entry.enrollment->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = enrollment_entry.enrollment->>'userId'
    )
    and exists (
      select 1 from public.app_courses app_course where app_course.id = enrollment_entry.enrollment->>'courseId'
    );

  insert into public.app_feedback (
    id,
    student_id,
    teacher_id,
    course_id,
    score,
    comment,
    created_at,
    updated_at
  )
  select
    feedback_entry.feedback->>'id',
    feedback_entry.feedback->>'studentId',
    case
      when exists (
        select 1 from public.app_users app_user where app_user.id = nullif(feedback_entry.feedback->>'teacherId', '')
      ) then nullif(feedback_entry.feedback->>'teacherId', '')
      else null
    end,
    case
      when exists (
        select 1 from public.app_courses app_course where app_course.id = nullif(feedback_entry.feedback->>'courseId', '')
      ) then nullif(feedback_entry.feedback->>'courseId', '')
      else null
    end,
    coalesce(nullif(feedback_entry.feedback->>'score', '')::integer, 0),
    coalesce(feedback_entry.feedback->>'comment', ''),
    coalesce(nullif(feedback_entry.feedback->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(feedback_entry.feedback->>'createdAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(public.jsonb_array(target_payload->'feedback')) as feedback_entry(feedback)
  where nullif(feedback_entry.feedback->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = feedback_entry.feedback->>'studentId'
    );

  insert into public.app_payments (
    id,
    user_id,
    course_id,
    slot_id,
    selected_days,
    days_per_week,
    amount_cents,
    full_amount_cents,
    deposit_cents,
    remaining_cents,
    payment_stage,
    payment_plan,
    installment_index,
    installment_count,
    currency,
    status,
    provider,
    provider_reference,
    checkout_url,
    mode,
    due_at,
    remaining_due_at,
    created_at,
    updated_at
  )
  select
    payment_entry.payment->>'id',
    payment_entry.payment->>'userId',
    payment_entry.payment->>'courseId',
    nullif(payment_entry.payment->>'slotId', ''),
    public.jsonb_text_array(payment_entry.payment->'selectedDays'),
    coalesce(nullif(payment_entry.payment->>'daysPerWeek', '')::integer, 0),
    coalesce(nullif(payment_entry.payment->>'amountCents', '')::integer, 0),
    coalesce(nullif(payment_entry.payment->>'fullAmountCents', '')::integer, 0),
    coalesce(nullif(payment_entry.payment->>'depositCents', '')::integer, 0),
    coalesce(nullif(payment_entry.payment->>'remainingCents', '')::integer, 0),
    coalesce(nullif(payment_entry.payment->>'paymentStage', ''), 'deposit'),
    coalesce(nullif(payment_entry.payment->>'paymentPlan', ''), 'full'),
    coalesce(nullif(payment_entry.payment->>'installmentIndex', '')::integer, 1),
    coalesce(nullif(payment_entry.payment->>'installmentCount', '')::integer, 1),
    coalesce(nullif(payment_entry.payment->>'currency', ''), 'EGP'),
    coalesce(nullif(payment_entry.payment->>'status', ''), 'pending'),
    coalesce(nullif(payment_entry.payment->>'provider', ''), 'paymob'),
    coalesce(payment_entry.payment->>'providerReference', ''),
    coalesce(payment_entry.payment->>'checkoutUrl', ''),
    coalesce(nullif(payment_entry.payment->>'mode', ''), 'mock'),
    nullif(payment_entry.payment->>'dueAt', '')::timestamptz,
    nullif(payment_entry.payment->>'remainingDueAt', '')::timestamptz,
    coalesce(nullif(payment_entry.payment->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(payment_entry.payment->>'updatedAt', '')::timestamptz,
      coalesce(nullif(payment_entry.payment->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'payments')) as payment_entry(payment)
  where nullif(payment_entry.payment->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = payment_entry.payment->>'userId'
    )
    and exists (
      select 1 from public.app_courses app_course where app_course.id = payment_entry.payment->>'courseId'
    );

  insert into public.app_sessions (
    id,
    user_id,
    session_type,
    token_hash,
    expires_at,
    created_at,
    updated_at
  )
  select
    session_entry.session->>'id',
    session_entry.session->>'userId',
    coalesce(nullif(session_entry.session->>'type', ''), 'access'),
    coalesce(session_entry.session->>'tokenHash', ''),
    coalesce(nullif(session_entry.session->>'expiresAt', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(session_entry.session->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(session_entry.session->>'createdAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(public.jsonb_array(target_payload->'sessions')) as session_entry(session)
  where nullif(session_entry.session->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = session_entry.session->>'userId'
    );

  insert into public.app_reminders (
    id,
    user_id,
    category,
    title,
    message,
    link,
    status,
    due_at,
    meta,
    created_at,
    updated_at
  )
  select
    reminder_entry.reminder->>'id',
    case
      when exists (
        select 1 from public.app_users app_user where app_user.id = nullif(reminder_entry.reminder->>'userId', '')
      ) then nullif(reminder_entry.reminder->>'userId', '')
      else null
    end,
    coalesce(nullif(reminder_entry.reminder->>'category', ''), nullif(reminder_entry.reminder->>'type', ''), 'general'),
    coalesce(reminder_entry.reminder->>'title', ''),
    coalesce(reminder_entry.reminder->>'message', reminder_entry.reminder->>'body', ''),
    coalesce(reminder_entry.reminder->>'link', ''),
    coalesce(nullif(reminder_entry.reminder->>'status', ''), 'pending'),
    nullif(reminder_entry.reminder->>'dueAt', '')::timestamptz,
    case
      when jsonb_typeof(reminder_entry.reminder->'meta') = 'object' then reminder_entry.reminder->'meta'
      when jsonb_typeof(reminder_entry.reminder->'payload') = 'object' then reminder_entry.reminder->'payload'
      else '{}'::jsonb
    end,
    coalesce(nullif(reminder_entry.reminder->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(reminder_entry.reminder->>'updatedAt', '')::timestamptz,
      coalesce(nullif(reminder_entry.reminder->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'reminders')) as reminder_entry(reminder)
  where nullif(reminder_entry.reminder->>'id', '') is not null;

  insert into public.app_notifications (
    id,
    user_id,
    notification_type,
    title,
    message,
    link,
    is_read,
    meta,
    created_at,
    updated_at
  )
  select
    notification_entry.notification->>'id',
    notification_entry.notification->>'userId',
    coalesce(nullif(notification_entry.notification->>'type', ''), 'general'),
    coalesce(notification_entry.notification->>'title', ''),
    coalesce(notification_entry.notification->>'message', ''),
    coalesce(notification_entry.notification->>'link', ''),
    coalesce(nullif(notification_entry.notification->>'read', '')::boolean, false),
    case
      when jsonb_typeof(notification_entry.notification->'meta') = 'object' then notification_entry.notification->'meta'
      else '{}'::jsonb
    end,
    coalesce(nullif(notification_entry.notification->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(notification_entry.notification->>'updatedAt', '')::timestamptz,
      coalesce(nullif(notification_entry.notification->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'notifications')) as notification_entry(notification)
  where nullif(notification_entry.notification->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = notification_entry.notification->>'userId'
    );

  insert into public.app_conversations (
    id,
    created_by,
    created_at,
    updated_at
  )
  select
    conversation_entry.conversation->>'id',
    case
      when exists (
        select 1 from public.app_users app_user where app_user.id = nullif(conversation_entry.conversation->>'createdBy', '')
      ) then nullif(conversation_entry.conversation->>'createdBy', '')
      else null
    end,
    coalesce(nullif(conversation_entry.conversation->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(conversation_entry.conversation->>'updatedAt', '')::timestamptz,
      coalesce(nullif(conversation_entry.conversation->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'conversations')) as conversation_entry(conversation)
  where nullif(conversation_entry.conversation->>'id', '') is not null;

  insert into public.app_conversation_participants (
    conversation_id,
    user_id,
    joined_at
  )
  select
    conversation_entry.conversation->>'id',
    participant_entry.user_id,
    coalesce(nullif(conversation_entry.conversation->>'createdAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(public.jsonb_array(target_payload->'conversations')) as conversation_entry(conversation)
  cross join lateral jsonb_array_elements_text(public.jsonb_array(conversation_entry.conversation->'participantIds')) as participant_entry(user_id)
  where nullif(conversation_entry.conversation->>'id', '') is not null
    and exists (
      select 1 from public.app_conversations app_conversation
      where app_conversation.id = conversation_entry.conversation->>'id'
    )
    and exists (
      select 1 from public.app_users app_user where app_user.id = participant_entry.user_id
    );

  insert into public.app_conversation_messages (
    id,
    conversation_id,
    sender_id,
    body,
    read_by,
    created_at,
    updated_at
  )
  select
    message_entry.message->>'id',
    conversation_entry.conversation->>'id',
    message_entry.message->>'senderId',
    coalesce(message_entry.message->>'body', ''),
    public.jsonb_text_array(message_entry.message->'readBy'),
    coalesce(nullif(message_entry.message->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(message_entry.message->>'updatedAt', '')::timestamptz,
      coalesce(nullif(message_entry.message->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'conversations')) as conversation_entry(conversation)
  cross join lateral jsonb_array_elements(public.jsonb_array(conversation_entry.conversation->'messages')) as message_entry(message)
  where nullif(conversation_entry.conversation->>'id', '') is not null
    and nullif(message_entry.message->>'id', '') is not null
    and exists (
      select 1 from public.app_conversations app_conversation
      where app_conversation.id = conversation_entry.conversation->>'id'
    )
    and exists (
      select 1 from public.app_users app_user where app_user.id = message_entry.message->>'senderId'
    );

  insert into public.app_meetings (
    id,
    meeting_type,
    title,
    host_id,
    course_id,
    slot_id,
    meeting_url,
    room_code,
    status,
    created_at,
    started_at,
    updated_at
  )
  select
    meeting_entry.meeting->>'id',
    coalesce(nullif(meeting_entry.meeting->>'type', ''), 'private'),
    coalesce(meeting_entry.meeting->>'title', ''),
    meeting_entry.meeting->>'hostId',
    nullif(meeting_entry.meeting->>'courseId', ''),
    nullif(meeting_entry.meeting->>'slotId', ''),
    coalesce(meeting_entry.meeting->>'meetingUrl', ''),
    coalesce(meeting_entry.meeting->>'roomCode', ''),
    coalesce(nullif(meeting_entry.meeting->>'status', ''), 'scheduled'),
    coalesce(nullif(meeting_entry.meeting->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(meeting_entry.meeting->>'startedAt', '')::timestamptz,
      coalesce(nullif(meeting_entry.meeting->>'createdAt', '')::timestamptz, timezone('utc', now()))
    ),
    coalesce(
      nullif(meeting_entry.meeting->>'updatedAt', '')::timestamptz,
      coalesce(nullif(meeting_entry.meeting->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'meetings')) as meeting_entry(meeting)
  where nullif(meeting_entry.meeting->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = meeting_entry.meeting->>'hostId'
    );

  insert into public.app_meeting_invitees (
    meeting_id,
    user_id,
    invited_at
  )
  select
    meeting_entry.meeting->>'id',
    invitee_entry.user_id,
    coalesce(nullif(meeting_entry.meeting->>'createdAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(public.jsonb_array(target_payload->'meetings')) as meeting_entry(meeting)
  cross join lateral jsonb_array_elements_text(public.jsonb_array(meeting_entry.meeting->'invitedUserIds')) as invitee_entry(user_id)
  where nullif(meeting_entry.meeting->>'id', '') is not null
    and exists (
      select 1 from public.app_meetings app_meeting where app_meeting.id = meeting_entry.meeting->>'id'
    )
    and exists (
      select 1 from public.app_users app_user where app_user.id = invitee_entry.user_id
    );

  insert into public.app_community_posts (
    id,
    author_id,
    course_id,
    repost_of_id,
    body,
    feeling,
    mentioned_user_ids,
    attachments,
    created_at,
    updated_at
  )
  select
    post_entry.post->>'id',
    post_entry.post->>'authorId',
    nullif(post_entry.post->>'courseId', ''),
    nullif(post_entry.post->>'repostOfId', ''),
    coalesce(post_entry.post->>'body', ''),
    coalesce(post_entry.post->>'feeling', ''),
    public.jsonb_text_array(post_entry.post->'mentionedUserIds'),
    public.jsonb_array(post_entry.post->'attachments'),
    coalesce(nullif(post_entry.post->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(post_entry.post->>'updatedAt', '')::timestamptz,
      coalesce(nullif(post_entry.post->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'communityPosts')) as post_entry(post)
  where nullif(post_entry.post->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = post_entry.post->>'authorId'
    );

  insert into public.app_community_post_reactions (
    id,
    post_id,
    user_id,
    reaction_type,
    created_at,
    updated_at
  )
  select
    reaction_entry.reaction->>'id',
    post_entry.post->>'id',
    reaction_entry.reaction->>'userId',
    coalesce(nullif(reaction_entry.reaction->>'type', ''), 'like'),
    coalesce(nullif(reaction_entry.reaction->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(reaction_entry.reaction->>'createdAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(public.jsonb_array(target_payload->'communityPosts')) as post_entry(post)
  cross join lateral jsonb_array_elements(public.jsonb_array(post_entry.post->'reactions')) as reaction_entry(reaction)
  where nullif(post_entry.post->>'id', '') is not null
    and nullif(reaction_entry.reaction->>'id', '') is not null
    and exists (
      select 1 from public.app_community_posts app_post where app_post.id = post_entry.post->>'id'
    )
    and exists (
      select 1 from public.app_users app_user where app_user.id = reaction_entry.reaction->>'userId'
    );

  insert into public.app_community_post_comments (
    id,
    post_id,
    parent_comment_id,
    author_id,
    body,
    created_at,
    updated_at
  )
  select
    comment_entry.comment->>'id',
    post_entry.post->>'id',
    nullif(comment_entry.comment->>'parentId', ''),
    comment_entry.comment->>'authorId',
    coalesce(comment_entry.comment->>'body', ''),
    coalesce(nullif(comment_entry.comment->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(comment_entry.comment->>'updatedAt', '')::timestamptz,
      coalesce(nullif(comment_entry.comment->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'communityPosts')) as post_entry(post)
  cross join lateral jsonb_array_elements(public.jsonb_array(post_entry.post->'comments')) as comment_entry(comment)
  where nullif(post_entry.post->>'id', '') is not null
    and nullif(comment_entry.comment->>'id', '') is not null
    and exists (
      select 1 from public.app_community_posts app_post where app_post.id = post_entry.post->>'id'
    )
    and exists (
      select 1 from public.app_users app_user where app_user.id = comment_entry.comment->>'authorId'
    );

  insert into public.app_reports (
    id,
    reporter_id,
    reported_user_id,
    target_user_id,
    target_type,
    target_id,
    reason,
    excerpt,
    course_id,
    post_id,
    comment_id,
    status,
    created_at,
    updated_at
  )
  select
    report_entry.report->>'id',
    nullif(report_entry.report->>'reporterId', ''),
    nullif(report_entry.report->>'reportedUserId', ''),
    nullif(report_entry.report->>'targetUserId', ''),
    coalesce(report_entry.report->>'targetType', ''),
    coalesce(report_entry.report->>'targetId', ''),
    coalesce(report_entry.report->>'reason', ''),
    coalesce(report_entry.report->>'excerpt', ''),
    nullif(report_entry.report->>'courseId', ''),
    nullif(report_entry.report->>'postId', ''),
    nullif(report_entry.report->>'commentId', ''),
    coalesce(nullif(report_entry.report->>'status', ''), 'open'),
    coalesce(nullif(report_entry.report->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(report_entry.report->>'updatedAt', '')::timestamptz,
      coalesce(nullif(report_entry.report->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'reports')) as report_entry(report)
  where nullif(report_entry.report->>'id', '') is not null;

  insert into public.app_profile_comments (
    id,
    author_id,
    target_user_id,
    body,
    created_at,
    updated_at
  )
  select
    comment_entry.comment->>'id',
    comment_entry.comment->>'authorId',
    comment_entry.comment->>'targetUserId',
    coalesce(comment_entry.comment->>'body', ''),
    coalesce(nullif(comment_entry.comment->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(comment_entry.comment->>'updatedAt', '')::timestamptz,
      coalesce(nullif(comment_entry.comment->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'profileComments')) as comment_entry(comment)
  where nullif(comment_entry.comment->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = comment_entry.comment->>'authorId'
    )
    and exists (
      select 1 from public.app_users app_user where app_user.id = comment_entry.comment->>'targetUserId'
    );

  insert into public.app_peer_feedback (
    id,
    author_id,
    target_user_id,
    course_id,
    body,
    score,
    tone,
    created_at,
    updated_at
  )
  select
    peer_entry.feedback->>'id',
    peer_entry.feedback->>'authorId',
    peer_entry.feedback->>'targetUserId',
    nullif(peer_entry.feedback->>'courseId', ''),
    coalesce(peer_entry.feedback->>'body', ''),
    coalesce(nullif(peer_entry.feedback->>'score', '')::integer, 5),
    coalesce(peer_entry.feedback->>'tone', 'supportive'),
    coalesce(nullif(peer_entry.feedback->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(peer_entry.feedback->>'updatedAt', '')::timestamptz,
      coalesce(nullif(peer_entry.feedback->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'peerFeedback')) as peer_entry(feedback)
  where nullif(peer_entry.feedback->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = peer_entry.feedback->>'authorId'
    )
    and exists (
      select 1 from public.app_users app_user where app_user.id = peer_entry.feedback->>'targetUserId'
    );

  insert into public.app_course_ratings (
    id,
    course_id,
    user_id,
    rating,
    review,
    created_at,
    updated_at
  )
  select
    rating_entry.rating->>'id',
    coalesce(rating_entry.rating->>'courseId', ''),
    rating_entry.rating->>'userId',
    coalesce(nullif(rating_entry.rating->>'rating', '')::integer, 5),
    coalesce(rating_entry.rating->>'review', ''),
    coalesce(nullif(rating_entry.rating->>'createdAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(rating_entry.rating->>'updatedAt', '')::timestamptz,
      coalesce(nullif(rating_entry.rating->>'createdAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'courseRatings')) as rating_entry(rating)
  where nullif(rating_entry.rating->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = rating_entry.rating->>'userId'
    );

  insert into public.app_assignment_submissions (
    id,
    assignment_id,
    course_id,
    student_id,
    note,
    file_url,
    submitted_at,
    created_at,
    updated_at
  )
  select
    submission_entry.submission->>'id',
    coalesce(submission_entry.submission->>'assignmentId', ''),
    coalesce(submission_entry.submission->>'courseId', ''),
    submission_entry.submission->>'studentId',
    coalesce(submission_entry.submission->>'note', ''),
    coalesce(submission_entry.submission->>'fileUrl', ''),
    coalesce(nullif(submission_entry.submission->>'submittedAt', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(submission_entry.submission->>'submittedAt', '')::timestamptz, timezone('utc', now())),
    coalesce(
      nullif(submission_entry.submission->>'updatedAt', '')::timestamptz,
      coalesce(nullif(submission_entry.submission->>'submittedAt', '')::timestamptz, timezone('utc', now()))
    )
  from jsonb_array_elements(public.jsonb_array(target_payload->'assignmentSubmissions')) as submission_entry(submission)
  where nullif(submission_entry.submission->>'id', '') is not null
    and exists (
      select 1 from public.app_users app_user where app_user.id = submission_entry.submission->>'studentId'
    );
end;
$$;

create or replace function public.sync_edukai_relational_from_app_state()
returns trigger
language plpgsql
as $$
begin
  perform public.sync_edukai_relational_from_payload(new.payload);
  return new;
end;
$$;

drop trigger if exists trg_app_state_sync_relational on public.app_state;
create trigger trg_app_state_sync_relational
after insert or update of payload on public.app_state
for each row
execute function public.sync_edukai_relational_from_app_state();

do $$
declare
  latest_payload jsonb;
begin
  select payload
  into latest_payload
  from public.app_state
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  perform public.sync_edukai_relational_from_payload(coalesce(latest_payload, '{}'::jsonb));
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('edukai-assets', 'edukai-assets', true, 52428800, null),
  ('edukai-avatars', 'edukai-avatars', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('edukai-course-thumbnails', 'edukai-course-thumbnails', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('edukai-course-materials', 'edukai-course-materials', true, 52428800, null),
  ('edukai-course-documents', 'edukai-course-documents', true, 52428800, null),
  ('edukai-assignment-attachments', 'edukai-assignment-attachments', true, 52428800, null),
  ('edukai-assignment-submissions', 'edukai-assignment-submissions', true, 52428800, null)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.app_state is
'Bridge row used by the current Express API. A trigger fans the JSON payload out into normalized app_* tables for reporting and the next migration phase.';

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

create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_state_updated_at_idx on public.app_state (updated_at desc);

drop trigger if exists trg_app_state_set_updated_at on public.app_state;
create trigger trg_app_state_set_updated_at
before update on public.app_state
for each row
execute function public.set_row_updated_at();

alter table public.app_state enable row level security;

insert into public.app_state (id, payload)
values ('primary', '{}'::jsonb)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('edukai-assets', 'edukai-assets', true, 52428800)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

comment on table public.app_state is
'Temporary production bridge for the existing Express + JSON app state. The long-term target should be a normalized relational schema in Supabase.';

create table if not exists public.events (
  id text primary key,
  title text not null,
  type text not null,
  severity text not null,
  status text not null,
  tags text[] not null default '{}',
  internal_notes text not null default '',
  alert_sent_at timestamptz,
  source_type text not null,
  source_url text not null default '',
  source_details jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  detected_at timestamptz not null,
  score integer not null,
  confidence integer not null,
  summary text not null,
  why_it_matters text not null,
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id bigserial primary key,
  source text not null,
  query text not null,
  status text not null,
  items_seen integer not null default 0,
  items_created integer not null default 0,
  duplicates_count integer not null default 0,
  filtered_count integer not null default 0,
  details jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.events
add column if not exists tags text[] not null default '{}';

alter table public.events
add column if not exists internal_notes text not null default '';

alter table public.events
add column if not exists alert_sent_at timestamptz;

alter table public.events
add column if not exists source_details jsonb not null default '{}'::jsonb;

alter table public.ingestion_runs
add column if not exists details jsonb not null default '[]'::jsonb;

create index if not exists events_status_idx on public.events (status);
create index if not exists events_detected_at_idx on public.events (detected_at desc);
create index if not exists events_fingerprint_idx on public.events (fingerprint);
create index if not exists events_tags_idx on public.events using gin (tags);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

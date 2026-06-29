-- Expert-curated review queue for /try submissions.
-- Run in Supabase → SQL Editor after docs/supabase-redesigns.sql.

create table if not exists public.pending_reviews (
  id uuid primary key default gen_random_uuid(),

  redesign_id uuid not null references public.redesigns (id) on delete cascade,
  website_url text not null,
  lead_email text,
  preview_token text not null,

  -- Public preview URL — filled when the redesign finishes generating
  redesign_url text,

  -- pending (queued) | ready (redesign generated) | delivered (prospect emailed)
  status text not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pending_reviews drop constraint if exists pending_reviews_status_check;

alter table public.pending_reviews
  add constraint pending_reviews_status_check
  check (status in ('pending', 'ready', 'delivered'));

create unique index if not exists pending_reviews_redesign_id_idx
  on public.pending_reviews (redesign_id);

create index if not exists pending_reviews_created_idx
  on public.pending_reviews (created_at desc);

comment on table public.pending_reviews is 'Expert-curated /try leads awaiting Alexander review before prospect delivery';

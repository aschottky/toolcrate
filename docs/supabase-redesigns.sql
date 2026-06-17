-- Run this in Supabase → SQL Editor (HTML redesign mockups ordered from the admin dashboard)
-- Safe for NEW projects and EXISTING tables (adds missing columns).

create table if not exists public.redesigns (
  id uuid primary key default gen_random_uuid(),

  website_url text not null,
  email text,

  -- Where the order came from: 'warm_lead' | 'audit' | 'manual'
  source_type text not null default 'manual',
  source_id uuid,

  -- Generation settings
  engine text not null,        -- 'gpt-4o' | 'claude-opus' | 'claude-sonnet'
  model text not null,         -- exact model slug used
  max_tokens integer not null default 20000,

  -- The generated single-file landing page (null while generation is still running)
  html text,

  -- Generation lifecycle: 'pending' (queued/generating) | 'ready' | 'failed'
  status text not null default 'ready',

  -- Prospect's answer to the wait-screen question ("biggest challenge right now")
  lead_intent text,

  -- "Your preview is ready" email already sent (prevents duplicates on retries)
  design_email_sent boolean default false,

  -- Unguessable slug for the public preview link (shared with the prospect)
  preview_token text not null unique default replace(gen_random_uuid()::text, '-', ''),

  created_at timestamptz not null default now()
);

-- Existing tables: allow pending rows (html filled in by background generation)
alter table public.redesigns alter column html drop not null;
alter table public.redesigns add column if not exists status text not null default 'ready';
alter table public.redesigns add column if not exists lead_intent text;
alter table public.redesigns add column if not exists design_email_sent boolean default false;

-- Prospect first name (optional — used in design-ready email greeting)
alter table public.redesigns add column if not exists first_name text;

comment on column public.redesigns.first_name is 'Prospect first name for personalized delivery email greeting';

-- AI site roast (Phase 1 — fast critique bullets shown in wait screen + roast page)
alter table public.redesigns add column if not exists roast_bullets jsonb;
alter table public.redesigns add column if not exists roast_status text not null default 'pending';

alter table public.redesigns drop constraint if exists redesigns_roast_status_check;

alter table public.redesigns
  add constraint redesigns_roast_status_check
  check (roast_status in ('pending', 'roast_ready', 'ready', 'failed'));

comment on column public.redesigns.roast_bullets is 'Site-specific AI roast bullets [{emoji, text}] for wait screen + /roast page';
comment on column public.redesigns.roast_status is 'pending (generating) | roast_ready | ready (legacy) | failed';

alter table public.redesigns drop constraint if exists redesigns_source_type_check;

alter table public.redesigns
  add constraint redesigns_source_type_check
  check (source_type in ('warm_lead', 'audit', 'manual'));

alter table public.redesigns drop constraint if exists redesigns_status_check;

alter table public.redesigns
  add constraint redesigns_status_check
  check (status in ('pending', 'ready', 'failed'));

create index if not exists redesigns_created_idx
  on public.redesigns (created_at desc);

create index if not exists redesigns_preview_token_idx
  on public.redesigns (preview_token);

create index if not exists redesigns_source_idx
  on public.redesigns (source_type, source_id);

comment on table public.redesigns is 'AI-generated landing page redesigns — previewed by prospects via usetoolcrate.com/preview/?t=<preview_token>';
comment on column public.redesigns.engine is 'gpt-4o | claude-opus | claude-sonnet';
comment on column public.redesigns.preview_token is 'Unguessable public preview slug';
comment on column public.redesigns.status is 'pending (generating) | ready | failed';
comment on column public.redesigns.lead_intent is 'Prospect''s wait-screen answer to "biggest challenge right now"';

-- Preview delete note: ALL prospect-facing preview state lives on this table only
-- (html, roast_bullets, roast_status, lead_intent, preview_token). There are no
-- separate roast/session/scrape-cache tables. Admin delete wipes every row whose
-- website_url resolves to the same root domain so /try cannot reuse stale tokens.

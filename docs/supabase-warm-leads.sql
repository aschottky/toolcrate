-- Run this in Supabase → SQL Editor (warm leads from Instantly.ai replies)
-- Safe for NEW projects and EXISTING tables (adds missing columns).

create table if not exists public.warm_leads (
  id uuid primary key default gen_random_uuid(),

  email text not null,
  website text,
  reply_text text,
  status text not null default 'pending',

  created_at timestamptz not null default now()
);

-- Add columns if you created warm_leads before follow-up tracking existed
alter table public.warm_leads
  add column if not exists follow_up_step integer not null default 0,
  add column if not exists last_emailed_at timestamptz;

alter table public.warm_leads drop constraint if exists warm_leads_status_check;

alter table public.warm_leads
  add constraint warm_leads_status_check
  check (status in ('pending', 'audit_sent', 'completed'));

create index if not exists warm_leads_status_created_idx
  on public.warm_leads (status, created_at desc);

create index if not exists warm_leads_email_idx
  on public.warm_leads (email);

create index if not exists warm_leads_nurture_idx
  on public.warm_leads (status, follow_up_step, last_emailed_at);

comment on table public.warm_leads is 'Leads who replied to cold email — manual free-audit delivery queue';
comment on column public.warm_leads.status is 'pending | audit_sent | completed';
comment on column public.warm_leads.follow_up_step is '0=new, 1=free audit sent, 2=first follow-up, 3=final follow-up';
comment on column public.warm_leads.last_emailed_at is 'When the last warm-lead email was sent';

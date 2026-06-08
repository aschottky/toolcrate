-- Run this in Supabase → SQL Editor (warm leads from Instantly.ai replies)

create table if not exists public.warm_leads (
  id uuid primary key default gen_random_uuid(),

  email text not null,
  website text,
  reply_text text,
  status text not null default 'pending' check (status in ('pending', 'audit_sent')),

  created_at timestamptz not null default now()
);

create index if not exists warm_leads_status_created_idx
  on public.warm_leads (status, created_at desc);

create index if not exists warm_leads_email_idx
  on public.warm_leads (email);

comment on table public.warm_leads is 'Leads who replied to cold email — manual free-audit delivery queue';
comment on column public.warm_leads.status is 'pending = awaiting audit, audit_sent = PDF emailed';

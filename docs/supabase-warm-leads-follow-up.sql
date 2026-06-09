-- Run in Supabase SQL Editor after supabase-warm-leads.sql

alter table public.warm_leads
  add column if not exists follow_up_step integer not null default 0,
  add column if not exists last_emailed_at timestamptz;

alter table public.warm_leads drop constraint if exists warm_leads_status_check;

alter table public.warm_leads
  add constraint warm_leads_status_check
  check (status in ('pending', 'audit_sent', 'completed'));

create index if not exists warm_leads_nurture_idx
  on public.warm_leads (status, follow_up_step, last_emailed_at);

comment on column public.warm_leads.follow_up_step is '0=new, 1=free audit sent, 2=first follow-up, 3=final follow-up (complete)';
comment on column public.warm_leads.last_emailed_at is 'When the last warm-lead email was sent (audit or follow-up)';

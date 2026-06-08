-- Run this in Supabase → SQL Editor (Step 1: nurture funnel)

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),

  email text not null,
  website_url text not null,
  stripe_session_id text not null,

  report jsonb not null,

  -- Nurture progress: 0 = delivery only (awaiting Day 2), 1 = Day 2 sent, 2 = Day 4 sent, 3 = Day 7 sent (complete)
  nurture_step smallint not null default 0 check (nurture_step >= 0 and nurture_step <= 3),

  day_2_sent boolean not null default false,
  day_4_sent boolean not null default false,
  day_7_sent boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  initial_email_sent_at timestamptz,
  last_nurture_email_at timestamptz,

  call_script text,
  call_script_generated_at timestamptz,

  constraint audits_stripe_session_id_key unique (stripe_session_id)
);

create index if not exists audits_nurture_queue_idx
  on public.audits (nurture_step, created_at);

create index if not exists audits_email_idx
  on public.audits (email);

comment on table public.audits is 'Paid Website Tear Down audits and nurture email state';
comment on column public.audits.nurture_step is '0=initial only, 1=Day2, 2=Day4, 3=Day7 complete';
comment on column public.audits.report is 'Full AI audit JSON (seo, leadCapture, mobile, trust, messaging, performance, security, tips)';

-- Optional: keep updated_at fresh on any change
create or replace function public.set_audits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists audits_set_updated_at on public.audits;

create trigger audits_set_updated_at
before update on public.audits
for each row
execute function public.set_audits_updated_at();

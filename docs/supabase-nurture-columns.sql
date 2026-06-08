-- Run in Supabase SQL Editor if your audits table was created before boolean flags.

alter table public.audits
  add column if not exists day_2_sent boolean not null default false,
  add column if not exists day_4_sent boolean not null default false,
  add column if not exists day_7_sent boolean not null default false;

-- Optional: migrate existing nurture_step values to booleans
update public.audits set day_2_sent = true where nurture_step >= 1;
update public.audits set day_4_sent = true where nurture_step >= 2;
update public.audits set day_7_sent = true where nurture_step >= 3;

create index if not exists audits_nurture_day2_idx
  on public.audits (day_2_sent, created_at) where day_2_sent = false;

create index if not exists audits_nurture_day4_idx
  on public.audits (day_4_sent, created_at) where day_4_sent = false;

create index if not exists audits_nurture_day7_idx
  on public.audits (day_7_sent, created_at) where day_7_sent = false;

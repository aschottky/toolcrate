-- Run in Supabase SQL Editor: cache AI call scripts on audits

alter table public.audits
  add column if not exists call_script text,
  add column if not exists call_script_generated_at timestamptz;

comment on column public.audits.call_script is 'Cached OpenAI phone sales script for this audit';
comment on column public.audits.call_script_generated_at is 'When call_script was last generated';

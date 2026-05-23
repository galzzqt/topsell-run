-- Track automated racepack email delivery after payment succeeds.
-- Run this once in Supabase SQL Editor before enabling SMTP email sending.

alter table public.participants
  add column if not exists racepack_email_sent_at timestamp with time zone,
  add column if not exists racepack_email_error text;

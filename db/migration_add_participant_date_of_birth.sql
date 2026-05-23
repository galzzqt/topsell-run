-- Add date of birth for every participant.

alter table public.participants
  add column if not exists date_of_birth date;

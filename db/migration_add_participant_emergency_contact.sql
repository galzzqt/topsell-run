-- Add emergency contact fields for every participant.

alter table public.participants
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

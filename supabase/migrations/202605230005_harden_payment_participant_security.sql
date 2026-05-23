-- Harden client-side database access for payment and racepack-sensitive fields.
-- Run this once in Supabase SQL Editor after the previous migrations.

drop policy if exists "Allow communities to update their own payments" on public.payments;
drop policy if exists "Allow communities to update their own registrations" on public.registrations;

create or replace function public.prevent_participant_protected_updates()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.payment_status <> 'pending' then
    raise exception 'Paid or failed participants cannot be edited by client users.';
  end if;

  if new.community_id is distinct from old.community_id
    or new.registration_id is distinct from old.registration_id
    or new.payment_status is distinct from old.payment_status
    or new.participant_code is distinct from old.participant_code
    or new.qr_code_data is distinct from old.qr_code_data
    or new.checked_in is distinct from old.checked_in
    or new.checked_in_at is distinct from old.checked_in_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Protected participant fields can only be updated by the server.';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists prevent_participant_protected_updates on public.participants;
create trigger prevent_participant_protected_updates
  before update on public.participants
  for each row execute function public.prevent_participant_protected_updates();

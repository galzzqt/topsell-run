-- Add participant BIB and medical fields to an existing Supabase database.
-- Run this once in Supabase SQL Editor if the database was created before these fields existed.

alter table public.participants
  add column if not exists bib_name text,
  add column if not exists blood_type text,
  add column if not exists medical_condition text;

update public.participants
set
  bib_name = coalesce(nullif(bib_name, ''), full_name)
where bib_name is null or bib_name = '';

alter table public.participants
  alter column bib_name set not null;

alter table public.participants
  drop constraint if exists participants_blood_type_check,
  add constraint participants_blood_type_check check (blood_type is null or blood_type in ('A', 'B', 'AB', 'O'));

create or replace function public.handle_payment_status_update()
returns trigger as $$
declare
  part_record record;
  part_seq int;
  new_code text;
  qr_payload text;
begin
  if new.status = 'paid' and old.status <> 'paid' then
    update public.registrations
    set status = 'paid'
    where id = new.registration_id;

    for part_record in
      select id, full_name, bib_name from public.participants
      where registration_id = new.registration_id
    loop
      select count(*) + 1001 into part_seq from public.participants
      where participant_code is not null;

      new_code := 'TSR-6K-' || part_seq;
      qr_payload := 'TSR_PARTICIPANT:' || part_record.id || '|BIB:' || new_code || '|NAME:' || coalesce(part_record.bib_name, part_record.full_name);

      update public.participants
      set
        payment_status = 'paid',
        participant_code = new_code,
        qr_code_data = qr_payload
      where id = part_record.id;
    end loop;

  elsif new.status = 'failed' and old.status <> 'failed' then
    update public.registrations
    set status = 'failed'
    where id = new.registration_id;

    update public.participants
    set payment_status = 'failed'
    where registration_id = new.registration_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

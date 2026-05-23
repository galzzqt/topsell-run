-- Add location fields used by the community and participant forms.
-- Run this once in Supabase SQL Editor for existing databases.

alter table public.communities
  add column if not exists provinsi text,
  add column if not exists kota text,
  add column if not exists kecamatan text;

alter table public.participants
  add column if not exists provinsi text,
  add column if not exists kota text,
  add column if not exists kecamatan text;

-- Backfill existing communities from auth metadata created during registration.
update public.communities c
set
  provinsi = coalesce(c.provinsi, u.raw_user_meta_data->>'provinsi'),
  kota = coalesce(c.kota, u.raw_user_meta_data->>'kota'),
  kecamatan = coalesce(c.kecamatan, u.raw_user_meta_data->>'kecamatan')
from auth.users u
where u.id = c.id;

-- Participants created during initial community registration do not have
-- individual address inputs, so inherit the community location when empty.
update public.participants p
set
  provinsi = coalesce(p.provinsi, c.provinsi),
  kota = coalesce(p.kota, c.kota),
  kecamatan = coalesce(p.kecamatan, c.kecamatan)
from public.communities c
where c.id = p.community_id;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  comm_name text;
  lead_name text;
  phone_num text;
  comm_code text;
  provinsi_val text;
  kota_val text;
  kecamatan_val text;
begin
  comm_name := coalesce(new.raw_user_meta_data->>'name', 'Komunitas Topsell');
  lead_name := coalesce(new.raw_user_meta_data->>'leader_name', 'Ketua Komunitas');
  phone_num := coalesce(new.raw_user_meta_data->>'phone', '');
  provinsi_val := coalesce(new.raw_user_meta_data->>'provinsi', null);
  kota_val := coalesce(new.raw_user_meta_data->>'kota', null);
  kecamatan_val := coalesce(new.raw_user_meta_data->>'kecamatan', null);
  comm_code := public.generate_community_code();

  insert into public.communities (id, name, leader_name, phone, community_code, provinsi, kota, kecamatan)
  values (new.id, comm_name, lead_name, phone_num, comm_code, provinsi_val, kota_val, kecamatan_val);
  return new;
end;
$$ language plpgsql security definer;

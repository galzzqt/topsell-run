create or replace function public.handle_new_user()
returns trigger as $$
declare
  comm_name text;
  lead_name text;
  email_val text;
  phone_num text;
  comm_code text;
  provinsi_val text;
  kota_val text;
  kecamatan_val text;
  custom_fields_val jsonb;
begin
  comm_name := coalesce(new.raw_user_meta_data->>'name', 'Komunitas Topsell');
  lead_name := coalesce(new.raw_user_meta_data->>'leader_name', 'Ketua Komunitas');
  email_val := coalesce(new.raw_user_meta_data->>'contact_email', null);
  phone_num := coalesce(new.raw_user_meta_data->>'phone', '');
  provinsi_val := coalesce(new.raw_user_meta_data->>'provinsi', null);
  kota_val := coalesce(new.raw_user_meta_data->>'kota', null);
  kecamatan_val := coalesce(new.raw_user_meta_data->>'kecamatan', null);
  custom_fields_val := coalesce(new.raw_user_meta_data->'custom_fields', '{}'::jsonb);
  comm_code := public.generate_community_code();

  insert into public.communities (id, name, leader_name, email, phone, community_code, provinsi, kota, kecamatan, custom_fields)
  values (new.id, comm_name, lead_name, email_val, phone_num, comm_code, provinsi_val, kota_val, kecamatan_val, custom_fields_val);
  return new;
end;
$$ language plpgsql security definer;

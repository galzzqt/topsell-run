-- ==========================================
-- TOPSELL RUN 2026 — SINGLE EVENT SCHEMA
-- DATABASE SCHEMA (Fresh Install)
-- Run this once in Supabase SQL Editor
-- ==========================================

-- A. Auto-update updated_at column helper
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- B. Unique community code generator helper
create or replace function public.generate_community_code()
returns text as $$
declare
  code text;
  is_unique boolean := false;
begin
  while not is_unique loop
    code := 'COMM-' || upper(substring(md5(random()::text) from 1 for 5));
    select not exists(select 1 from public.communities where community_code = code) into is_unique;
  end loop;
  return code;
end;
$$ language plpgsql;


-- 1. Communities Table (Linked to Supabase Auth)
create table public.communities (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  leader_name text not null,
  email text,
  phone text not null,
  community_code text not null unique,
  provinsi text,
  kota text,
  kecamatan text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index communities_phone_unique_idx on public.communities(phone);

-- 2. Registrations Table (Collective registration groups)
create table public.registrations (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references public.communities(id) on delete cascade not null,
  total_participants integer not null check (total_participants >= 1),
  total_amount integer not null,
  status text default 'pending'::text check (status in ('pending', 'paid', 'failed')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Payments Table (Xendit Payment Sessions)
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  registration_id uuid references public.registrations(id) on delete cascade not null,
  amount integer not null,
  payment_method text, -- e.g. 'qris', 'bank_transfer', etc.
  payment_reference text not null unique, -- Xendit reference_id
  snap_token text, -- legacy: stores checkout_url for compatibility
  provider text default 'xendit',
  xendit_session_id text,
  checkout_url text,
  status text default 'pending'::text check (status in ('pending', 'paid', 'failed')) not null,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Participants Table (Under a community, for TOPSELL RUN 6K Event)
create table public.participants (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references public.communities(id) on delete cascade not null,
  registration_id uuid references public.registrations(id) on delete set null,
  full_name text not null,
  bib_name text not null,
  email text not null,
  phone text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female')) not null,
  tshirt_size text check (tshirt_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL')) not null,
  blood_type text check (blood_type in ('A', 'B', 'AB', 'O')) not null,
  medical_condition text,
  emergency_contact_name text,
  emergency_contact_phone text,
  provinsi text,
  kota text,
  kecamatan text,
  participant_code text unique, -- assigned after successful payment (e.g. TSR-6K-10025)
  qr_code_data text, -- custom scanning text
  payment_status text default 'pending'::text check (payment_status in ('pending', 'paid', 'failed')) not null,
  checked_in boolean default false not null,
  checked_in_at timestamp with time zone,
  racepack_email_sent_at timestamp with time zone,
  racepack_email_error text,
  racepack_whatsapp_sent_at timestamp with time zone,
  racepack_whatsapp_error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.communities enable row level security;
alter table public.registrations enable row level security;
alter table public.payments enable row level security;
alter table public.participants enable row level security;

-- RLS POLICIES

-- Communities
create policy "Allow public read access to community profiles" on public.communities
  for select using (true);

create policy "Allow communities to update their own profiles" on public.communities
  for update using (auth.uid() = id);

-- Registrations
create policy "Allow communities to view their own registrations" on public.registrations
  for select using (auth.uid() = community_id);

create policy "Allow communities to create their own registrations" on public.registrations
  for insert with check (auth.uid() = community_id);

-- Payments
create policy "Allow communities to view their own payments" on public.payments
  for select using (exists (
    select 1 from public.registrations r 
    where r.id = payments.registration_id and r.community_id = auth.uid()
  ));

create policy "Allow communities to create their own payments" on public.payments
  for insert with check (exists (
    select 1 from public.registrations r 
    where r.id = payments.registration_id and r.community_id = auth.uid()
  ));

-- Participants
create policy "Allow communities to view their own participants" on public.participants
  for select using (auth.uid() = community_id);

create policy "Allow communities to insert their own participants" on public.participants
  for insert with check (auth.uid() = community_id);

create policy "Allow communities to update their own participants" on public.participants
  for update using (auth.uid() = community_id) with check (auth.uid() = community_id);

create policy "Allow communities to delete their own participants" on public.participants
  for delete using (auth.uid() = community_id);


-- TRIGGERS

-- 1. Apply updated_at columns
create trigger update_communities_timestamp before update on public.communities
  for each row execute function public.update_updated_at_column();

create trigger update_participants_timestamp before update on public.participants
  for each row execute function public.update_updated_at_column();

create trigger update_registrations_timestamp before update on public.registrations
  for each row execute function public.update_updated_at_column();

create trigger update_payments_timestamp before update on public.payments
  for each row execute function public.update_updated_at_column();

-- 1b. Prevent client-side updates to payment/racepack protected participant fields.
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

create trigger prevent_participant_protected_updates
  before update on public.participants
  for each row execute function public.prevent_participant_protected_updates();


-- 2. Auto-create community on Auth Sign Up (Using generated unique community code)
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
begin
  comm_name := coalesce(new.raw_user_meta_data->>'name', 'Komunitas Topsell');
  lead_name := coalesce(new.raw_user_meta_data->>'leader_name', 'Ketua Komunitas');
  email_val := coalesce(new.raw_user_meta_data->>'contact_email', null);
  phone_num := coalesce(new.raw_user_meta_data->>'phone', '');
  provinsi_val := coalesce(new.raw_user_meta_data->>'provinsi', null);
  kota_val := coalesce(new.raw_user_meta_data->>'kota', null);
  kecamatan_val := coalesce(new.raw_user_meta_data->>'kecamatan', null);
  comm_code := public.generate_community_code();

  insert into public.communities (id, name, leader_name, email, phone, community_code, provinsi, kota, kecamatan)
  values (new.id, comm_name, lead_name, email_val, phone_num, comm_code, provinsi_val, kota_val, kecamatan_val);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 3. Payment Success Syncing Trigger (Updates parent registration + participants lunas + allocates BIB and QR)
create or replace function public.handle_payment_status_update()
returns trigger as $$
declare
  part_record record;
  part_seq int;
  new_code text;
  qr_payload text;
begin
  -- Triggered when status transitions to 'paid'
  if new.status = 'paid' and old.status <> 'paid' then
    
    -- A. Update registration status
    update public.registrations
    set status = 'paid'
    where id = new.registration_id;
    
    -- B. Loop through and activate all associated participants
    for part_record in 
      select id, full_name, bib_name from public.participants 
      where registration_id = new.registration_id
    loop
      
      -- Assign unique participant sequence (e.g. beginning at 1000)
      select count(*) + 1001 into part_seq from public.participants 
      where participant_code is not null;
      
      -- Format: TSR-6K-10023
      new_code := 'TSR-6K-' || part_seq;
      
      -- QR payload used for Racepack Pick-Up & Check-In Day
      qr_payload := 'TSR_PARTICIPANT:' || part_record.id || '|BIB:' || new_code || '|NAME:' || coalesce(part_record.bib_name, part_record.full_name);
      
      update public.participants
      set 
        payment_status = 'paid',
        participant_code = new_code,
        qr_code_data = qr_payload
      where id = part_record.id;
      
    end loop;
    
  elsif new.status = 'failed' and old.status <> 'failed' then
    -- If transaction failed, sync parent registration and participants to failed
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

create trigger on_payment_status_update
  after update of status on public.payments
  for each row execute function public.handle_payment_status_update();

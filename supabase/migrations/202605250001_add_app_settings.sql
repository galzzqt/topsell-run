create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.app_settings enable row level security;

drop policy if exists "Deny public access to app settings" on public.app_settings;
create policy "Deny public access to app settings" on public.app_settings
  for all using (false) with check (false);

drop trigger if exists update_app_settings_timestamp on public.app_settings;
create trigger update_app_settings_timestamp before update on public.app_settings
  for each row execute function public.update_updated_at_column();

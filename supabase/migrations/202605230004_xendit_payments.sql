-- Add Xendit checkout metadata to an existing Supabase database.
-- Run this once in Supabase SQL Editor before using Xendit payments.

alter table public.payments
  add column if not exists provider text default 'xendit',
  add column if not exists xendit_session_id text,
  add column if not exists checkout_url text;

update public.payments
set provider = coalesce(provider, 'xendit');

drop policy if exists "Allow communities to update their own payments" on public.payments;
-- Payment status and metadata must only be updated by trusted server code using the service role.

drop trigger if exists on_payment_status_update on public.payments;

create trigger on_payment_status_update
  after update of status on public.payments
  for each row execute function public.handle_payment_status_update();

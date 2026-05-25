alter table public.communities
  add column if not exists custom_fields jsonb default '{}'::jsonb not null;

alter table public.participants
  add column if not exists custom_fields jsonb default '{}'::jsonb not null;

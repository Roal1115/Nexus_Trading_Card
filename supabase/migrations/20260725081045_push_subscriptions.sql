create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "select own subscriptions" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "insert own subscriptions" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "delete own subscriptions" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Accessor para que la edge function lea secretos de Vault vía RPC (solo service_role)
create or replace function public.get_vault_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name;
$$;

revoke all on function public.get_vault_secret(text) from public, anon, authenticated;
grant execute on function public.get_vault_secret(text) to service_role;

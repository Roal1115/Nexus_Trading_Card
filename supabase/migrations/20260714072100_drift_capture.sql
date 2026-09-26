-- Objetos que existen en producción pero nunca quedaron en una migración
-- (creados desde el dashboard). Se ordena antes de in_app_notifications,
-- add_fk_indexes_drop_duplicate y functions_fixed_search_path, que los usan.
-- Idempotente: en producción es un no-op; en un Branch nuevo los crea.

-- ---------- Extensiones (habilitadas en producción desde el dashboard) ----------
-- Mismos schemas que producción. Solo las instala; ningún cron job se crea aquí.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------- player_favorite_stores ----------
create table if not exists public.player_favorite_stores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_id, store_id)
);
create index if not exists idx_player_favorite_stores_player on public.player_favorite_stores (player_id);
alter table public.player_favorite_stores enable row level security;

create or replace function public.fn_check_favorite_store_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.player_favorite_stores
  where player_id = new.player_id;

  if v_count >= 5 then
    raise exception 'Máximo 5 tiendas favoritas por jugador';
  end if;

  return new;
end;
$function$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_favorite_store_limit' and tgrelid = 'public.player_favorite_stores'::regclass
  ) then
    create trigger trg_favorite_store_limit before insert on public.player_favorite_stores
      for each row execute function public.fn_check_favorite_store_limit();
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'player_favorite_stores' and policyname = 'service role bypass favorites') then
    create policy "service role bypass favorites" on public.player_favorite_stores
      for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'player_favorite_stores' and policyname = 'player reads own favorites') then
    create policy "player reads own favorites" on public.player_favorite_stores
      for select to authenticated
      using (player_id in (select players.id from public.players where players.auth_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'player_favorite_stores' and policyname = 'player inserts own favorites') then
    create policy "player inserts own favorites" on public.player_favorite_stores
      for insert to authenticated
      with check (player_id in (select players.id from public.players where players.auth_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'player_favorite_stores' and policyname = 'player deletes own favorites') then
    create policy "player deletes own favorites" on public.player_favorite_stores
      for delete to authenticated
      using (player_id in (select players.id from public.players where players.auth_user_id = auth.uid()));
  end if;
end $$;

-- ---------- tournament_rsvps (RLS activo, sin policies: solo service role) ----------
create table if not exists public.tournament_rsvps (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'attending' check (status in ('attending', 'cancelled')),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (tournament_id, player_id)
);
create index if not exists idx_tournament_rsvps_tournament on public.tournament_rsvps (tournament_id);
create index if not exists idx_tournament_rsvps_player on public.tournament_rsvps (player_id);
alter table public.tournament_rsvps enable row level security;

-- ---------- Storage: tournament-files (privado) y sponsor-assets (público) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tournament-files', 'tournament-files', false, 5242880,
   array['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('sponsor-assets', 'sponsor-assets', true, 512000, array['image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tournament_files_read') then
    create policy tournament_files_read on storage.objects for select
      using (bucket_id = 'tournament-files' and exists (
        select 1 from public.players
        where players.auth_user_id = auth.uid() and players.role in ('admin', 'tcg_manager', 'organizer')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tournament_files_insert') then
    create policy tournament_files_insert on storage.objects for insert
      with check (bucket_id = 'tournament-files' and exists (
        select 1 from public.players
        where players.auth_user_id = auth.uid() and players.role in ('admin', 'tcg_manager', 'organizer')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'sponsor_assets_public_read') then
    create policy sponsor_assets_public_read on storage.objects for select
      using (bucket_id = 'sponsor-assets');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'sponsor_assets_admin_insert') then
    create policy sponsor_assets_admin_insert on storage.objects for insert
      with check (bucket_id = 'sponsor-assets' and exists (
        select 1 from public.players where players.auth_user_id = auth.uid() and players.role = 'admin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'sponsor_assets_admin_update') then
    create policy sponsor_assets_admin_update on storage.objects for update
      using (bucket_id = 'sponsor-assets' and exists (
        select 1 from public.players where players.auth_user_id = auth.uid() and players.role = 'admin'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'sponsor_assets_admin_delete') then
    create policy sponsor_assets_admin_delete on storage.objects for delete
      using (bucket_id = 'sponsor-assets' and exists (
        select 1 from public.players where players.auth_user_id = auth.uid() and players.role = 'admin'));
  end if;
end $$;

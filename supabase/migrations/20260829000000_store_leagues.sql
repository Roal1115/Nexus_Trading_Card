-- Ligas propias de tienda: el organizador arma su propia liga interna
-- eligiendo manualmente qué torneos cuentan, en paralelo a la liga nacional.
create table public.store_leagues (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  active_weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
    -- 0=domingo..6=sábado, mismo formato que store_schedules.day_of_week
  winner_player_id uuid references public.players(id),
  winner_points numeric,
    -- se rellenan al archivar (server function); la regla de "2 mejores
    -- torneos" vive en TS, igual que el circuito nacional
  created_by uuid references public.players(id),
  created_at timestamptz not null default now()
);

create table public.store_league_tournaments (
  league_id uuid not null references public.store_leagues(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (league_id, tournament_id)
);

create table public.store_league_prizes (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.store_leagues(id) on delete cascade,
  description text not null,
  image_url text,
  sort_order int not null default 0
);

create index store_leagues_store_id_idx on public.store_leagues(store_id);
create index store_league_tournaments_tournament_id_idx on public.store_league_tournaments(tournament_id);
create index store_league_prizes_league_id_idx on public.store_league_prizes(league_id);

alter table public.store_leagues enable row level security;
alter table public.store_league_tournaments enable row level security;
alter table public.store_league_prizes enable row level security;

-- lectura pública: la página de tienda muestra leaderboard + premios de la liga activa
create policy "store_leagues_public_read" on public.store_leagues for select using (true);
create policy "store_league_prizes_public_read" on public.store_league_prizes for select using (true);
-- store_league_tournaments y las escrituras siguen solo por server functions (admin client)

-- bucket público para imágenes de premios, mismo patrón que sponsor-assets
insert into storage.buckets (id, name, public)
values ('league-assets', 'league-assets', true)
on conflict (id) do nothing;

create policy "league_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'league-assets');

-- escritura: solo organizer/admin (los mismos que pueden tocar store_leagues
-- desde el server; tcg_manager queda fuera por la regla de negocio 5)
create policy "league_assets_write_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'league-assets'
    and exists (
      select 1 from public.players
      where players.auth_user_id = auth.uid()
        and players.role in ('organizer', 'admin')
    )
  );

create policy "league_assets_write_update"
  on storage.objects for update
  using (
    bucket_id = 'league-assets'
    and exists (
      select 1 from public.players
      where players.auth_user_id = auth.uid()
        and players.role in ('organizer', 'admin')
    )
  );

create policy "league_assets_write_delete"
  on storage.objects for delete
  using (
    bucket_id = 'league-assets'
    and exists (
      select 1 from public.players
      where players.auth_user_id = auth.uid()
        and players.role in ('organizer', 'admin')
    )
  );

-- Catálogo de TCG que juega una tienda, independiente de `games` (circuito).
-- No afecta carga de torneos, ligas ni circuito. Las filas llegan después.
create table public.tcg_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

create table public.store_tcgs (
  store_id uuid not null references public.stores(id) on delete cascade,
  tcg_id uuid not null references public.tcg_catalog(id) on delete cascade,
  primary key (store_id, tcg_id)
);

create index store_tcgs_tcg_id_idx on public.store_tcgs(tcg_id);

alter table public.tcg_catalog enable row level security;
alter table public.store_tcgs enable row level security;

-- lectura pública: la página de tienda muestra los juegos; escrituras solo por
-- server functions (admin client), sin políticas de escritura
create policy "tcg_catalog_public_read" on public.tcg_catalog for select using (true);
create policy "store_tcgs_public_read" on public.store_tcgs for select using (true);

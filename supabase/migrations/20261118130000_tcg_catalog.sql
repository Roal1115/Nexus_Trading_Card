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

-- Solo server functions: RLS activo, sin policies y sin acceso de anon/authenticated.
alter table public.tcg_catalog enable row level security;
alter table public.store_tcgs enable row level security;
revoke all on public.tcg_catalog, public.store_tcgs from public, anon, authenticated;
grant select on public.tcg_catalog to service_role;
grant select, insert, delete on public.store_tcgs to service_role;

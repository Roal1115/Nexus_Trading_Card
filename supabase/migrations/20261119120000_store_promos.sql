-- Promoción propia de cada tienda (banner que se muestra en /stores/$slug) y sus
-- visualizaciones, para la sección "Marketing" de /organizer/analytics.
-- Separado de `sponsors` (anuncios globales de la plataforma, sin store_id).
-- Solo se escribe/lee vía service role (server functions): RLS activo sin policies,
-- igual que store_page_views y ad_metrics.
create table public.store_promos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  image_url text not null,
  link_url text check (link_url is null or link_url ~ '^https://'),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index store_promos_store_idx on public.store_promos(store_id);

-- Una fila por visualización (no un contador): permite rango de fechas y serie por día.
-- store_id va duplicado a propósito para consultar por tienda sin join.
create table public.store_promo_views (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.store_promos(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index store_promo_views_store_idx
  on public.store_promo_views(store_id, viewed_at desc);
create index store_promo_views_promo_idx
  on public.store_promo_views(promo_id);

alter table public.store_promos enable row level security;
alter table public.store_promo_views enable row level security;

-- Cuenta visitas a la página pública de una tienda (/stores/$slug), separadas
-- por sección vista (perfil, calendario, liga interna) para que el
-- organizador vea qué tanto tráfico recibe su página y qué mira la gente.
-- Solo se escribe/lee vía service role (nexus-public / nexus-organizer
-- server functions) — sin policies de acceso directo, igual que ad_metrics.
create table public.store_page_views (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  section text not null check (section in ('profile', 'calendario', 'liga_interna')),
  viewed_at timestamptz not null default now()
);

create index store_page_views_store_section_idx
  on public.store_page_views(store_id, section, viewed_at desc);

alter table public.store_page_views enable row level security;

-- Ajuste a store_promos antes de que haya datos:
-- 1) La promo la revisan Admin y Manager: nace "pending" y solo se muestra "approved".
-- 2) Visualizaciones y clics comparten tabla de eventos (kind), en vez de una tabla por tipo.
alter table public.store_promos
  add column status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

alter table public.store_promo_views rename to store_promo_events;
alter table public.store_promo_events rename column viewed_at to occurred_at;
alter table public.store_promo_events
  add column kind text not null check (kind in ('view', 'click'));
alter index store_promo_views_store_idx rename to store_promo_events_store_idx;
alter index store_promo_views_promo_idx rename to store_promo_events_promo_idx;

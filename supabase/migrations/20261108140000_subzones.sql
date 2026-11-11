-- Subzonas opcionales dentro de una zona (por ejemplo Norte, dentro de Zona Monterrey).
-- Las métricas siguen por zona; la subzona solo agrega detalle.
--
-- Aplicar junto con el código: cambia la firma de approve_store_signup.

create table public.subzones (
  zone text not null references public.zones(name) on update cascade on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60),
  description text not null default '' check (length(description) <= 200),
  created_at timestamptz not null default now(),
  primary key (zone, name)
);
alter table public.subzones enable row level security;
revoke all on public.subzones from public, anon, authenticated;

alter table public.stores add column subzone text;
-- La llave compuesta impide una subzona de otra zona. Diferida porque al renombrar una
-- zona stores.zone y subzones.zone cambian en pasos separados dentro de la misma orden.
alter table public.stores
  add constraint stores_subzone_fkey foreign key (zone, subzone)
  references public.subzones(zone, name)
  on update cascade on delete restrict
  deferrable initially deferred;

-- Sin llave foránea: si la subzona cambia antes de aprobar, Admin o Manager eligen otra.
alter table public.store_signup_requests add column subzone text;

drop function public.approve_store_signup(uuid, uuid, text, text);

-- Todo o nada: una solicitud nunca queda aprobada sin tienda u organizador.
create function public.approve_store_signup(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_slug text,
  p_zone text,
  p_subzone text
)
returns uuid
language plpgsql
set search_path = ''
as $fn$
declare
  v_request public.store_signup_requests;
  v_store_id uuid;
begin
  if p_zone is null then
    raise exception 'ZONE_REQUIRED';
  end if;
  if p_subzone is null and exists (select 1 from public.subzones where zone = p_zone) then
    raise exception 'SUBZONE_REQUIRED';
  end if;

  update public.store_signup_requests
     set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
   where id = p_request_id and status = 'pending'
  returning * into v_request;
  if not found then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  insert into public.stores (
    slug, name, city, state, phone, country, is_active, zone, subzone, address, google_maps_url,
    opening_hours, instagram, twitter, twitch, website
  )
  values (
    p_slug, v_request.store_name, v_request.city, v_request.state, v_request.phone, 'MX', true,
    p_zone, p_subzone, v_request.address, v_request.google_maps_url, v_request.opening_hours,
    v_request.instagram, v_request.twitter, v_request.twitch, v_request.website
  )
  returning id into v_store_id;

  update public.store_signup_requests set store_id = v_store_id where id = p_request_id;

  update public.players
     set role = 'organizer', home_store_id = v_store_id, is_active = true
   where id = v_request.player_id and role = 'player';
  if not found then
    raise exception 'ACCOUNT_NOT_ELIGIBLE';
  end if;

  return v_store_id;
end
$fn$;
revoke all on function public.approve_store_signup(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.approve_store_signup(uuid, uuid, text, text, text) to service_role;

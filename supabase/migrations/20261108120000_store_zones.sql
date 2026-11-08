-- Las zonas pasan a ser un catálogo que dan de alta Admin y Manager.
-- Antes stores.zone se calculaba de la ciudad con una lista fija: lo que no estaba en
-- la lista, o venía con acento ("Ciudad de México"), caía en Zona Extendida.
--
-- Aplicar junto con el código: hasta publicarlo, aprobar tiendas falla (firma nueva).

create table public.zones (
  name text primary key check (length(trim(name)) between 2 and 60),
  description text not null default '' check (length(description) <= 200),
  created_at timestamptz not null default now()
);
alter table public.zones enable row level security;
revoke all on public.zones from public, anon, authenticated;

insert into public.zones (name, description) values
  ('Zona Monterrey', 'Monterrey, San Pedro, Guadalupe, San Nicolás, Apodaca y área metropolitana'),
  ('Zona Guadalajara', 'Guadalajara, Zapopan, Tlaquepaque, Tonalá y área metropolitana'),
  ('Zona Centro', 'Ciudad de México y área metropolitana'),
  ('Zona Extendida', 'Cualquier otra ciudad del país');

-- Por si alguna base tiene un valor fuera de los cuatro de arriba.
insert into public.zones (name)
select distinct zone from public.stores where zone is not null
on conflict (name) do nothing;

-- Conserva el valor actual de cada tienda y deja de calcularlo.
alter table public.stores alter column zone drop expression;
alter table public.stores alter column zone set not null;
alter table public.stores
  add constraint stores_zone_fkey foreign key (zone) references public.zones(name)
  on update cascade on delete restrict;

-- zone null = la tienda eligió "No sé"; Admin o Manager la definen al aprobar.
-- Todo nullable: las solicitudes anteriores a este cambio no traen estos datos.
alter table public.store_signup_requests
  add column zone text references public.zones(name) on update cascade on delete set null,
  add column address text,
  add column google_maps_url text,
  add column opening_hours text,
  add column instagram text,
  add column twitter text,
  add column twitch text,
  add column website text;

drop function public.approve_store_signup(uuid, uuid, text);

-- Todo o nada: una solicitud nunca queda aprobada sin tienda u organizador.
create function public.approve_store_signup(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_slug text,
  p_zone text
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

  update public.store_signup_requests
     set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
   where id = p_request_id and status = 'pending'
  returning * into v_request;
  if not found then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  insert into public.stores (
    slug, name, city, state, phone, country, is_active, zone, address, google_maps_url,
    opening_hours, instagram, twitter, twitch, website
  )
  values (
    p_slug, v_request.store_name, v_request.city, v_request.state, v_request.phone, 'MX', true,
    p_zone, v_request.address, v_request.google_maps_url, v_request.opening_hours,
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
revoke all on function public.approve_store_signup(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.approve_store_signup(uuid, uuid, text, text) to service_role;

-- Aviso en la campanita a Admin y Manager cuando el dueño cambia datos de su tienda.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('tournament_published', 'round_reported', 'schedule_changed', 'store_changed'));

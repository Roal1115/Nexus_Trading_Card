-- Alta de tiendas por invitación privada. La tienda no existe en `stores` hasta
-- aprobarse, así que una solicitud no puede aparecer en calendario, ligas ni rankings.
create table public.store_signup_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  game_id uuid not null references public.games(id),
  created_by uuid references public.players(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.store_signup_requests (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique references public.store_signup_invites(id),
  game_id uuid not null references public.games(id),
  -- Null tras un rechazo: la cuenta se borra para que un enlace nuevo pueda usar el correo.
  player_id uuid references public.players(id) on delete set null,
  email text not null,
  store_name text not null,
  city text not null,
  state text not null,
  phone text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references public.players(id) on delete set null,
  reviewed_at timestamptz,
  store_id uuid references public.stores(id) on delete set null,
  created_at timestamptz not null default now()
);
create index store_signup_requests_pending_idx
  on public.store_signup_requests (game_id) where status = 'pending';

-- Solo el servidor las usa: sin políticas ni permisos para anon y authenticated.
alter table public.store_signup_invites enable row level security;
alter table public.store_signup_requests enable row level security;
revoke all on public.store_signup_invites from public, anon, authenticated;
revoke all on public.store_signup_requests from public, anon, authenticated;

-- Todo o nada: una solicitud nunca queda aprobada sin tienda o sin organizador.
create function public.approve_store_signup(p_request_id uuid, p_reviewer_id uuid, p_slug text)
returns uuid
language plpgsql
set search_path = ''
as $fn$
declare
  v_request public.store_signup_requests;
  v_store_id uuid;
begin
  update public.store_signup_requests
     set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
   where id = p_request_id and status = 'pending'
  returning * into v_request;
  if not found then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  -- stores.zone es una columna calculada a partir de la ciudad.
  insert into public.stores (slug, name, city, state, phone, country, is_active)
  values (p_slug, v_request.store_name, v_request.city, v_request.state,
          v_request.phone, 'MX', true)
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
revoke all on function public.approve_store_signup(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_store_signup(uuid, uuid, text) to service_role;

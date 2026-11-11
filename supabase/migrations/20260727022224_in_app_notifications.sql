create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  type text not null check (type in ('tournament_published','round_reported','schedule_changed')),
  title text not null,
  body text not null,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_player_unread_idx on public.notifications (player_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;

create policy "select own notifications" on public.notifications
  for select using (player_id in (select id from public.players where auth_user_id = auth.uid()));
create policy "update own notifications" on public.notifications
  for update using (player_id in (select id from public.players where auth_user_id = auth.uid()))
  with check (player_id in (select id from public.players where auth_user_id = auth.uid()));

-- 1) Torneo publicado -> notifica a jugadores con esa tienda como favorita o principal
create or replace function public.notify_tournament_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_name text;
  v_slug text;
begin
  if new.status = 'PUBLISHED' and (old.status is distinct from 'PUBLISHED') then
    select name, slug into v_store_name, v_slug from public.stores where id = new.store_id;

    insert into public.notifications (player_id, type, title, body, url)
    select distinct p.id, 'tournament_published',
      'Nuevo torneo publicado en ' || v_store_name,
      'Ya está disponible el torneo del ' || to_char(new.tournament_date, 'DD/MM/YYYY') || '.',
      '/stores/' || v_slug
    from public.players p
    where p.home_store_id = new.store_id
       or exists (
         select 1 from public.player_favorite_stores f
         where f.player_id = p.id and f.store_id = new.store_id
       );
  end if;
  return new;
end;
$$;

create trigger trg_notify_tournament_published
after update on public.tournaments
for each row execute function public.notify_tournament_published();

-- 2) Ronda reportada contra ti -> notifica al oponente cuando NO fue él quien reportó
create or replace function public.notify_round_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context text;
  v_url text;
begin
  if new.opponent_player_id is null or new.is_bye then
    return new;
  end if;
  if new.reporter_player_id is not null and new.reporter_player_id = new.opponent_player_id then
    return new;
  end if;

  if TG_TABLE_NAME = 'tournament_round_results' then
    select 'el torneo en ' || s.name into v_context
    from public.tournaments t join public.stores s on s.id = t.store_id
    where t.id = new.tournament_id;
    v_url := '/organizer/tournaments/' || new.tournament_id;
  else
    v_context := 'una sesión';
    v_url := '/sessions/' || new.session_id;
  end if;

  insert into public.notifications (player_id, type, title, body, url)
  values (
    new.opponent_player_id,
    'round_reported',
    'Reportaron una partida contra ti',
    'Ronda ' || new.round_number || ' en ' || coalesce(v_context, 'un torneo') || '.',
    v_url
  );
  return new;
end;
$$;

create trigger trg_notify_round_reported_tournament
after insert on public.tournament_round_results
for each row execute function public.notify_round_reported();

create trigger trg_notify_round_reported_standalone
after insert on public.standalone_round_results
for each row execute function public.notify_round_reported();

-- 3) Cambio de horario de tienda favorita
create or replace function public.notify_schedule_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid := coalesce(new.store_id, old.store_id);
  v_store_name text;
begin
  select name into v_store_name from public.stores where id = v_store_id;

  insert into public.notifications (player_id, type, title, body, url)
  select distinct p.id, 'schedule_changed',
    v_store_name || ' actualizó su calendario de torneos',
    'Revisa los nuevos horarios en el calendario.',
    '/calendar'
  from public.players p
  where exists (
    select 1 from public.player_favorite_stores f
    where f.player_id = p.id and f.store_id = v_store_id
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_notify_schedule_changed
after insert or update or delete on public.store_schedules
for each row execute function public.notify_schedule_changed();

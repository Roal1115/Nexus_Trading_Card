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

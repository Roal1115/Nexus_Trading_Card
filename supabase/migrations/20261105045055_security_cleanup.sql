-- Cierre de pendientes de seguridad, idempotente.
set local lock_timeout = '5s';

-- pg_trgm fuera de public: solo lo usa un índice, que sigue funcionando.
do $ext$
begin
  if (select extnamespace from pg_extension where extname = 'pg_trgm') = 'public'::regnamespace then
    alter extension pg_trgm set schema extensions;
  end if;
end
$ext$;

-- Funciones que solo llaman el servidor o los triggers.
revoke execute on function public.increment_sponsor_view(uuid) from public, anon, authenticated;
revoke execute on function public.fn_check_favorite_store_limit() from public, anon, authenticated;
revoke execute on function public.normalize_tcg_id() from public, anon, authenticated;

-- Mismo criterio que "Public read tournaments": nada de resultados sin publicar.
drop policy if exists "Public read results" on public.tournament_results;
drop policy if exists tournament_results_public_read on public.tournament_results;
create policy tournament_results_public_read on public.tournament_results
  for select to public
  using (exists (select 1 from public.tournaments t
                  where t.id = tournament_results.tournament_id
                    and t.status in ('PUBLISHED', 'APPROVED')));

-- league-assets es público: sin esto un organizer puede subir HTML o SVG con script.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id = 'league-assets';

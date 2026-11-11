-- search_path fijo (advisor function_search_path_mutable)
alter function public.normalize_tcg_id set search_path = public, pg_temp;
alter function public.fn_match_standalone_sessions_on_publish set search_path = public, pg_temp;
alter function public.increment_sponsor_view set search_path = public, pg_temp;
alter function public.fn_check_favorite_store_limit set search_path = public, pg_temp;

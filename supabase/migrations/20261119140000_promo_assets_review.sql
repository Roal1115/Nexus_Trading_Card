-- Revisión de promos (quién y cuándo queda en admin_audit_log; aquí solo cuándo y por qué se rechazó)
-- y bucket de imágenes de promo.
alter table public.store_promos
  add column reviewed_at timestamptz,
  add column rejection_reason text;

-- Público (se muestra en /stores/$slug). Sin SVG ni gif: un SVG público puede llevar script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promo-assets', 'promo-assets', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "promo_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'promo-assets');

-- Un organizer solo escribe en la carpeta de su tienda ({store_id}/archivo); admin en cualquiera.
-- tcg_manager no sube: revisa, no crea.
create policy "promo_assets_write_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'promo-assets'
    and exists (
      select 1 from public.players p
      where p.auth_user_id = auth.uid()
        and (
          p.role = 'admin'
          or (p.role = 'organizer' and (storage.foldername(name))[1] = p.home_store_id::text)
        )
    )
  );

-- Aplicar DESPUÉS de publicar el código que firma enlaces en el servidor: la versión
-- anterior del formulario firma desde el navegador y necesita la política de lectura.

-- Los archivos traen Bandai IDs y nombres. Ya no se guarda un enlace de un año, solo la ruta.
update public.tournaments
set csv_url = substring(csv_url from '/tournament-files/([^?]+)')
where csv_url like '%/tournament-files/%';

-- La lectura pasa por getTournamentFileUrl, que revisa la tienda o el TCG del torneo.
-- Con esta política, cualquier organizador podía leer los archivos de otras tiendas.
drop policy if exists tournament_files_read on storage.objects;

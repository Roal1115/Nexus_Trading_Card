-- Datos del registro de tienda: encargado y plan de afiliación.
-- El plan aún no lo usa la plataforma, solo se guarda. El teléfono del encargado se copia a su
-- "Contacto principal" al aprobar, para el WhatsApp del calendario.
-- Nulos en solicitudes anteriores a este cambio.
alter table public.store_signup_requests
  add column manager_name text check (length(trim(manager_name)) between 2 and 120),
  add column manager_phone text check (length(trim(manager_phone)) between 7 and 20),
  add column affiliation_plan text check (affiliation_plan in ('oro', 'platino', 'diamante'));

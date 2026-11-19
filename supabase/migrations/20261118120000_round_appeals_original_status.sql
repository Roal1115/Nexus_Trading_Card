-- Estado de la ronda antes de apelar, para restaurarlo si el organizador elimina la apelación.
-- Nulo en apelaciones anteriores a este cambio (al eliminar, la ronda vuelve a 'pending').
alter table public.round_appeals add column original_round_status text;

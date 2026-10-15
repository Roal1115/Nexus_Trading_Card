# Fase 0 — raíz de confianza de `players`

Corrige una escalada de privilegios: `anon` y `authenticated` tenían `UPDATE` sobre todas las columnas de `public.players` (incluida `role`), con la política `players_update_own` y sin ningún trigger de protección. Cualquier usuario autenticado podía cambiarse su propio `role` a `admin`.

## Estado

- **Aplicada en producción** (`tbtyxtigbsljyrwyelqr`) el 2026-10-15 ~04:58 UTC, vía `execute_sql` (no está en el historial de `supabase_migrations`).
- Probada antes en el sandbox `nexus-admin-test` (A1–A12 y R1–R8, todas PASS).

## Archivos

| Archivo | md5 del texto |
|---|---|
| `phase0-players-trust-root.apply.sql` | `30c416619f98c75e412b3f14ff5bd830` |
| `phase0-players-trust-root.rollback.sql` | `7dcedd5568f034d600bb2ac2d34156eb` |

El md5 se calcula sobre el texto con saltos de línea `LF` y **sin salto de línea final**:
`select md5($t$<contenido del archivo>$t$);`

## Qué hace

- `anon` y `authenticated` quedan solo con `SELECT` en `players`, `players_public` y `public_players_view`.
- Añade `players_guard_privileged_cols()` y el trigger `trg_players_guard` (defensa en profundidad: bloquea cambios a `id`, `role`, `auth_user_id`, `email`, `home_store_id` e `is_active` hechos como `anon`/`authenticated`).
- Cada script es **un único `DO` atómico** con precondiciones y postcondiciones; si el estado no es el esperado, aborta sin cambios.

## Importante

- **Son de un solo uso y no deben ir en `supabase/migrations/`**: el apply aborta si el estado ya no es el original, así que un `supabase db push` fallaría. Por eso viven aquí.
- El rollback solo funciona sobre el estado exacto que deja el apply.
- Ejecutar siempre como `postgres`.
- No incluye las fases 0b/0c ni nada del Circuit. Quedan abiertos, entre otros: escritura propia en `player_tcg_ids`, `recompute_player_achievements` ejecutable por `anon`/`authenticated`, y privilegios `TRUNCATE`/`TRIGGER`/`REFERENCES` concedidos por defecto en las demás tablas públicas.

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
- No incluye las fases 0b/0c ni nada del Circuit. Quedan abiertos, entre otros, los privilegios `TRUNCATE`/`TRIGGER`/`REFERENCES` concedidos por defecto en las demás tablas públicas.

# Cierre de `player_tcg_ids` y `recompute_player_achievements`

Corrige dos permisos abiertos: cada usuario podía insertar, cambiar y borrar su Bandai ID directo por PostgREST, saltándose `assign_tcg_id`, y cualquiera sin sesión podía ejecutar `recompute_player_achievements` para cualquier jugador.

## Estado

- **Aplicado en producción** (`tbtyxtigbsljyrwyelqr`) el 2026-11-05 (UTC), vía `execute_sql` (no está en el historial de `supabase_migrations`).
- Probado antes en `nexus-admin-test` con `scripts/tcg-ids-hardening.test.mts`, incluido el ciclo apply, rollback y reapply. El sandbox queda aplicado.

## Archivos

| Archivo | md5 del texto |
|---|---|
| `tcg-ids-achievements.apply.sql` | `21f470795c0568a8d71323f29a218c30` |
| `tcg-ids-achievements.rollback.sql` | `48119501c29a63f0804bf822aa9bbea0` |

## Qué hace

- `anon` y `authenticated` quedan solo con `SELECT` en `player_tcg_ids` (la lectura sigue limitada por RLS).
- Elimina la policy `player_tcg_ids_own_write`.
- `recompute_player_achievements` queda ejecutable solo por `postgres` y `service_role`; se revoca también a `PUBLIC`.
- Las mismas reglas de la Fase 0: un solo uso, fuera de `supabase/migrations/` y siempre como `postgres`.

## Sigue abierto

- `addMyTcgId` no comprueba la propiedad del Bandai ID. Pendiente por decisión: los IDs son reales y el admin puede corregirlos desde el panel.
- `pg_default_acl` en `public` da todos los privilegios a `anon` y `authenticated` en cada tabla nueva y `EXECUTE` en cada función nueva.
- Reconstruir la base desde `supabase/migrations/` reabre estos permisos y los de la Fase 0.

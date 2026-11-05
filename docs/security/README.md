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

# Línea base de permisos

`supabase/migrations/20261105040921_security_baseline.sql`, aplicada en producción el 2026-11-05 (UTC) y registrada en `supabase_migrations`. Es idempotente e incluye la Fase 0 y el cierre de `player_tcg_ids`, así que reconstruir la base desde migraciones ya no reabre esos permisos.

## Qué permite

- `anon`: solo `SELECT`, limitado por RLS.
- `authenticated`: `SELECT`, `UPDATE (read_at)` en `notifications`, e `INSERT`/`DELETE` en `push_subscriptions`. Son las únicas escrituras directas del navegador.
- `service_role`: sin cambios.
- `SELECT` no se puede quitar de `players`: las policies de storage y de otras tablas lo leen como el rol llamante.

## Regla para migraciones nuevas

**Toda tabla o función nueva nace cerrada** para `anon` y `authenticated`. Si el navegador la necesita, su migración debe incluir el `grant` explícito. Las server functions usan `service_role` y no necesitan nada.

## Verificación y rollback

- `scripts/security-baseline.test.mts`, solo contra `nexus-admin-test`.
- `docs/security/security-baseline.rollback.sql` restaura las demás tablas y los privilegios por defecto, y conserva cerrados `players`, `player_tcg_ids` y `recompute_player_achievements`.

## Sigue abierto

- Protección de contraseñas filtradas apagada en Supabase Auth; se activa desde el dashboard.
- `supabase_admin` conserva sus privilegios por defecto abiertos; postgres no puede cambiarlos (probado). Las migraciones corren como postgres.
- `updateMyEmail` sigue fallando a propósito hasta tener SMTP propio.

# Limpieza final

`supabase/migrations/20261105045055_security_cleanup.sql`, aplicada en producción el 2026-11-05 (UTC).

- `pg_trgm` pasa al esquema `extensions`.
- Ninguna función de `public` queda ejecutable por `anon`.
- `tournament_results` solo se lee en torneos `PUBLISHED` o `APPROVED`.
- `league-assets` solo acepta PNG, JPEG, WebP y GIF de hasta 5 MB.
- `signupPlayer` limita a 10 registros por IP cada 10 minutos.

## Auditoría del 2026-11-05

- Historial de git: sin tokens `service_role`; la única clave secreta encontrada ya fue eliminada.
- Edge functions y `/api/cron/publish-approved`: exigen secreto. El código de `send-tournament-reminders` no está en el repo.
- Server functions con sesión: auditadas con Codex, sin acceso a datos ajenos. Se verificaron sus hallazgos, no cada función.

## Riesgo aceptado

- Las policies de escritura sin grant quedan inactivas; quitarlas no aporta seguridad.
- Cualquier organizer puede leer los CSV de `tournament-files` y sobrescribir imágenes de `league-assets` de otros organizers.

# Hardening de `player_tcg_ids` y `recompute_player_achievements` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la escritura directa de `player_tcg_ids` y la ejecución pública de `recompute_player_achievements`, sin cambiar código de la app.

**Architecture:** Solo permisos de base de datos. La app ya escribe y recalcula con service role (`getNexusAdmin`), y el navegador no toca estas tablas, así que se retiran permisos que hoy nadie legítimo usa. Un script `DO` atómico con pre y postcondiciones, más su rollback, siguiendo el patrón de la Fase 0.

**Tech Stack:** Supabase Postgres 17.6, supabase-js, scripts `.mts` con `npx tsx`.

**Spec:** No hay spec separado. La fuente es `docs/security/README.md` ("Quedan abiertos") más el diagnóstico de abajo.

## Diagnóstico (producción, 2026-11-04, solo lectura)

**`player_tcg_ids`** (53 filas, 52 jugadores)
- `anon` y `authenticated` tienen todos los privilegios (`arwdDxtm`, incluye `MAINTAIN`). Grantor `postgres`, sin grant options y sin ACL por columna.
- La policy `player_tcg_ids_own_write` (`FOR ALL`, `TO public`, sin `WITH CHECK`) deja a cada usuario insertar, editar y borrar sus filas directo por PostgREST con la clave publicable.
- Eso salta `addMyTcgId` y `assign_tcg_id`: la regla "solo INSERT, nunca UPDATE", `TCG_ID_TAKEN`, el `btrim` y el límite de 50 caracteres.
- `normalize_tcg_id()` solo quita ceros, no espacios: `' 123'` y `'123'` normalizan distinto, y una escritura directa con espacios evade `uq_player_tcg_ids_game_normalized`.
- Impacto: `resolvePlayer` atribuye resultados por Bandai ID, así que quien cambie su ID directamente recibe resultados futuros de ese ID.
- No hay `updated_at` ni auditoría en la tabla, así que los datos no permiten saber si esto ya se usó.
- Sin duplicados de `(game_id, tcg_user_id_normalized)` y sin normalizados vacíos.

**`recompute_player_achievements(uuid)`**
- `SECURITY DEFINER`, owner `postgres`, ACL `{=X/postgres, anon=X, authenticated=X, service_role=X}`. **`PUBLIC` también tiene EXECUTE**, así que hay que revocarlo a `PUBLIC` además de a los dos roles.
- Cualquiera, sin sesión, puede lanzarla para cualquier jugador: consulta pesada repetible, y como cuenta torneos `APPROVED` puede otorgar logros antes de la publicación.

**Quién depende de esto**
- Escrituras a `player_tcg_ids`: `src/lib/player-identity.server.ts`, RPC `assign_tcg_id`, `merge_placeholder_player`, `claim_tcg_placeholders`. Todas service role o `SECURITY DEFINER`; esas RPC ya no son ejecutables por `anon`/`authenticated`.
- Llamadas a `recompute_player_achievements`: `src/lib/nexus-publication.server.ts:123` (service role) y `merge_placeholder_player` (definer, owner `postgres`).
- `assign_tcg_id`, `merge_placeholder_player` y `claim_tcg_placeholders` son de `postgres`, dueño de la tabla, y su ACL es solo `postgres` y `service_role`, así que el cambio no les afecta.
- Ninguna vista usa `player_tcg_ids`. El cliente `nexus` del navegador no hace `.from()` ni `.rpc()`.

## Global Constraints

- Sin cambios en `src/`, RLS de otras tablas, lifecycle, scheduler ni migraciones.
- Probar primero en `nexus-admin-test`. Nunca correr tests contra `tbtyxtigbsljyrwyelqr`.
- Producción solo con aprobación explícita del usuario, ejecutando como `postgres`.
- Conservar `SELECT` para `anon` y `authenticated`: la lectura ya está limitada por RLS y así el cambio es mínimo.
- Los scripts viven en `docs/security/`, no en `supabase/migrations/`, porque abortan si el estado no es el original (mismo motivo que la Fase 0).
- Los scripts no usan los nombres "0b"/"0c": esas fases no están definidas en el repo.

## Review Focus

1. Un jugador con sesión agrega su Bandai ID desde Ajustes y debe seguir funcionando.
2. Un usuario se registra con el ID de un placeholder y debe adoptar sus torneos, incluido el recálculo dentro de `merge_placeholder_player`.
3. Una publicación, manual o del scheduler, debe seguir otorgando logros y no reportar `failures`.
4. Revocar solo a `anon`/`authenticated` deja la función abierta por `PUBLIC`; la postcondición debe comprobarlo con `has_function_privilege`.
5. El sandbox puede no estar en el mismo estado que producción; el script debe abortar sin cambios, no aplicar a medias.

---

### Task 1: Test de regresión (falla antes de aplicar)

**Files:**
- Create: `scripts/tcg-ids-hardening.test.mts`

**Interfaces:**
- Consumes: `.env.test` con `NEXUS_URL`, `NEXUS_SERVICE_ROLE_KEY`, `NEXUS_ANON_KEY`. **Falta `NEXUS_ANON_KEY`: lo agrega el usuario.**
- Produces: `npx tsx scripts/tcg-ids-hardening.test.mts`, exit 0 solo si todo pasa.

- [ ] **Step 1: Crear el script** con el mismo arnés de `scripts/organizer-assignment.test.mts` (guarda `PROD_REF`, `check()`, limpieza por prefijo `zzhard`, resumen final). Crea con `svc` dos usuarios reales, cada uno con su fila en `players` (`auth_user_id` = id del usuario de auth, porque las policies comparan contra `auth.uid()`) y una fila en `player_tcg_ids`. Inicia sesión como el primero con la clave anon.

Cada caso negativo inspecciona `error.code`, porque supabase-js devuelve `{ error }` sin lanzar excepción, y confirma el estado final con `svc`. Cada caso positivo exige `error === null`.

Casos:
  - `authenticated` no puede `insert` en otro juego → error `42501`.
  - `authenticated` no puede `update` su fila; con `svc`, el valor sigue igual.
  - `authenticated` no puede `delete` su fila; con `svc`, la fila sigue ahí.
  - `authenticated` sí lee su fila → 1 resultado.
  - `authenticated` no lee la fila del segundo usuario, ni filtrando por su `player_id` → 0 resultados.
  - `anon` no lee filas → 0 resultados.
  - `anon` y `authenticated` reciben `42501` en `rpc("recompute_player_achievements")`.
  - `svc` ejecuta esa RPC sin error.
  - `svc` en `assign_tcg_id` con ID de un placeholder → devuelve `1` sin error y sus resultados pasan al jugador real. El recálculo corre dentro de la fusión, así que un fallo de permisos ahí haría fallar toda la RPC.
  - `svc` en `assign_tcg_id` con ID de una cuenta real → `TCG_ID_TAKEN`.

- [ ] **Step 2: Correrlo en el sandbox**

Run: `npx tsx scripts/tcg-ids-hardening.test.mts`
Expected: FAIL en los casos de denegación; PASS en lectura propia y en los casos `svc`. Si fallan los `svc`, parar: el sandbox no representa producción.

- [ ] **Step 3: Commit** (con aprobación del usuario)

```bash
git add scripts/tcg-ids-hardening.test.mts
git commit -m "test(security): agrega regresión de player_tcg_ids y recompute"
```

### Task 2: Scripts apply y rollback, verificados en sandbox

**Files:**
- Create: `docs/security/tcg-ids-achievements.apply.sql`
- Create: `docs/security/tcg-ids-achievements.rollback.sql`

**Interfaces:**
- Consumes: el test de la Task 1.
- Produces: dos scripts de un solo `DO` atómico.

- [ ] **Step 1: Comparar el ACL del sandbox con producción.** Producción: tabla `{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`; función `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. Si difieren, parar y reportar.

- [ ] **Step 2: Escribir `apply`** con `lock_timeout` de 5s, chequeo `current_user = 'postgres'` y `lock table public.player_tcg_ids in share row exclusive mode`.

Precondiciones: existe `player_tcg_ids_own_write`, `authenticated` tiene `INSERT` y `anon` tiene EXECUTE.

```sql
drop policy player_tcg_ids_own_write on public.player_tcg_ids;
revoke all on table public.player_tcg_ids from anon, authenticated;
grant select on table public.player_tcg_ids to anon, authenticated;
revoke execute on function public.recompute_player_achievements(uuid)
  from public, anon, authenticated;
```

Postcondiciones: `relacl` y `proacl` coinciden exactamente con el estado esperado (tabla: `anon=r` y `authenticated=r`, resto igual; función: solo `postgres` y `service_role`). Además `has_function_privilege` da `false` para `anon` y `authenticated`, y la policy ya no existe.

Se conserva `player_tcg_ids_admin_all`: sin permisos de escritura no tiene efecto y deja el cambio más chico.

- [ ] **Step 3: Escribir `rollback`**, un `DO` que exige el estado que deja `apply` y restaura policy (`FOR ALL TO public`, mismo `USING`), `grant all` en la tabla y `EXECUTE` a `public, anon, authenticated`. Como corre como `postgres`, el grantor queda igual; la postcondición compara `relacl` y `proacl` con los strings de la Step 1.

- [ ] **Step 4: Aplicar en sandbox y correr todo**

Run: `npx tsx scripts/tcg-ids-hardening.test.mts && npx tsx scripts/identity.check.mts && npx tsx scripts/organizer-assignment.test.mts && npx tsx scripts/lifecycle-test.mts`
Expected: todo PASS. `lifecycle-test` cubre publicación con recálculo.

- [ ] **Step 5: Probar rollback y reaplicar en sandbox**

Tras el rollback, el test debe volver al resultado de la Task 1 Step 2. Tras reaplicar, todo PASS. Correr dos veces `apply` debe abortar en la segunda, sin cambios.

- [ ] **Step 6: Commit** (con aprobación del usuario)

```bash
git add docs/security/tcg-ids-achievements.apply.sql docs/security/tcg-ids-achievements.rollback.sql
git commit -m "docs(security): agrega scripts para cerrar player_tcg_ids y recompute"
```

### Task 3: Aplicación en producción

**Files:**
- Modify: `docs/security/README.md`

**Interfaces:**
- Consumes: `docs/security/tcg-ids-achievements.apply.sql`, ya probado.

- [ ] **Step 1: Revisar logs de API** antes de aplicar: `POST`, `PATCH`, `DELETE` a `/rest/v1/player_tcg_ids` y `POST` a `/rest/v1/rpc/recompute_player_achievements`. Reportar si hay tráfico que no venga del server. La retención de logs es limitada: un resultado vacío no prueba que nunca pasó.

- [ ] **Step 2: Pedir aprobación explícita del usuario**, evitando una publicación en curso.

- [ ] **Step 3: Aplicar y verificar** con la misma consulta de catálogo del diagnóstico.

Expected: solo `SELECT` para `anon` y `authenticated`, sin `own_write`, ACL de la función solo con `postgres` y `service_role`.

- [ ] **Step 4: Prueba de humo.** El usuario agrega un ID desde Ajustes con una cuenta de prueba. En la siguiente publicación, confirmar que no hay `failures` de recálculo.

- [ ] **Step 5: Actualizar `docs/security/README.md`** con fecha, archivos y lo que sigue abierto. Commit con aprobación del usuario.

```bash
git add docs/security/README.md
git commit -m "docs(security): registra el cierre de player_tcg_ids y recompute"
```

## Estado (2026-11-04)

- Tasks 1 y 2 hechas en `nexus-admin-test`, que queda con el cambio aplicado.
- Task 3 aplicada en producción el 2026-11-05 (UTC) y verificada por catálogo y como `anon`. Falta la prueba de humo (Step 4).
- Antes de aplicar: 7/12. Después: 12/12. Tras rollback: 7/12, mismos 5 fallos. Tras reaplicar: 12/12.
- `identity.check` 29/29 y `lifecycle-test` 23/23 antes y después.
- `organizer-assignment` 13/14 antes y después: el caso 3 falla porque el sandbox no tiene la Fase 0, no por este cambio.
- Task 3 Step 1: logs de producción de las últimas 24 h, una sola lectura `GET` y ninguna escritura ni RPC. Los logs solo cubren ese periodo.

## Fuera de alcance (decisión del usuario)

- **Reclamar IDs ajenos:** `addMyTcgId` no comprueba que el Bandai ID sea tuyo. Un usuario puede registrar un ID libre, o el de un placeholder y absorber sus torneos con `merge_placeholder_player`. Este plan no lo cierra. **Decisión del usuario (2026-11-04): queda pendiente**, porque los IDs son reales y el admin puede corregirlos a mano desde el panel.
- **Causa de fondo:** `pg_default_acl` en `public` da a `anon` y `authenticated` todos los privilegios en cada tabla nueva y `EXECUTE` en cada función nueva. Por eso existen estos huecos, y cada objeto nuevo nace abierto hasta que alguien lo cierre.
- `TRUNCATE`/`TRIGGER`/`REFERENCES` en las demás tablas públicas.
- Reconstruir la base desde `supabase/migrations/` vuelve a abrir estos permisos, igual que con la Fase 0.

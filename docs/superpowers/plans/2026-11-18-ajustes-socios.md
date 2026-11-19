# Ajustes de los socios: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** implementar los 8 ajustes pedidos en la junta del 2026-11-18: leaders obligatorios, dado y turno visibles, filtros del Dashboard, plazo de edición de 7 días, borrar apelaciones, torneos en varias ligas, catálogo de TCG por tienda y estado de jugadores en el inicio del organizador.

**Architecture:** las reglas nuevas viven como funciones puras en `src/lib/round-rules.ts` (y un módulo nuevo para filtros y ligas), probadas con scripts `scripts/*.check.mts` (`npx tsx`), la convención del repo. Las funciones del servidor (`createServerFn`) llaman a esas reglas, así pantalla y servidor comparten una sola fuente. Dos migraciones nuevas: una columna en `round_appeals` y las tablas del catálogo de TCG.

**Tech Stack:** React 19, TanStack Start/Router, Supabase (Postgres + RLS), zod, recharts, Tailwind, `npx tsx` para checks.

**Spec:** `docs/superpowers/specs/2026-11-18-ajustes-socios-design.md`

## Global Constraints

- Todo cambio sigue `.claude/skills/ponytail/SKILL.md` (diff mínimo, reutilizar). Todo cambio de pantalla sigue `.claude/skills/impeccable/SKILL.md`.
- Textos de la interfaz en español de México.
- Nunca probar contra producción: `npm run dev` apunta a producción. Probar con el servidor sandbox (puerto 8081, proyecto `ssbifqcvuhcfijbdtjjh`) en el navegador integrado. Las migraciones se aplican **solo en sandbox**; producción queda pendiente para el fundador.
- Leaders: "Selecciona tu leader para guardar la ronda" y "Selecciona el leader del oponente para guardar la ronda". Los Bye no piden leaders.
- Plazo: `EDIT_WINDOW_DAYS = 7`, contado desde `approved_at ?? published_at` del torneo. Mensaje: "Este torneo ya no se puede editar (pasaron 7 días)".
- Rama de trabajo: `feat/ajustes-socios`, creada desde `impeccable/jugador-y-acceso`.
- Cada tarea termina con `npx tsc --noEmit` sin errores nuevos y `npm run lint` sin errores nuevos en los archivos tocados.

## Review Focus

1. **Torneo sin `approved_at` ni `published_at`** (borrador o datos viejos): el plazo se considera abierto, para no bloquear a nadie por datos faltantes. Lo prueba la tarea 3.
2. **Ronda de Bye con leaders vacíos**: se guarda sin error. Lo prueba la tarea 2.
3. **Apelación vieja sin `original_round_status`**: al borrarla, la ronda vuelve a `pending`. Lo prueba la tarea 4.
4. **Torneo solo de ligas al que se le quita su liga principal**: `league_id` pasa a otra liga vinculada. Si era la última, se bloquea. Lo prueba la tarea 9.
5. **Filtros del Dashboard que no dejan resultados**: la tabla muestra un estado vacío con "Sin torneos con estos filtros", no la invitación a jugar el primer torneo. Lo prueba la tarea 6.

---

### Task 0: Rama

- [ ] **Step 1:** `git switch -c feat/ajustes-socios`. Expected: `Switched to a new branch 'feat/ajustes-socios'`.
- [ ] **Step 2:** `git add docs/superpowers && git commit -m "docs: diseño y plan de ajustes de socios"`.

---

### Task 1: Dado y turno visibles por defecto (punto 2)

**Files:**
- Modify: `src/components/tournament-tracker/round-ui.tsx:375-490` (`RoundOutcomeFields`)

**Interfaces:** sin cambio de props. `compact` sigue existiendo.

- [ ] **Step 1:** en la rama `compact`, renderizar `result`, después `details` (dado y turno) a la vista y, por último, un `<details>` "Más detalles" que solo contenga `extra`, con el subtítulo "(notas)". Si `extra` no viene, no se renderiza `<details>`. Quitar `hasDetails`, que deja de usarse.
- [ ] **Step 2:** verificación en sandbox: abrir una sesión (`/sessions/<id>`) y el Performance Tracker. Dado y Turno se ven sin hacer clic y Notas sigue plegado.
- [ ] **Step 3:** `git commit -am "feat(rondas): dado y turno visibles por defecto"`

---

### Task 2: Leaders propio y rival obligatorios (punto 1)

**Files:**
- Modify: `src/lib/round-rules.ts` (función nueva)
- Modify: `scripts/round-rules.check.mts`
- Modify: `src/lib/nexus-tournament-tracker.functions.ts:303` (`saveRoundResult`)
- Modify: `src/lib/nexus-standalone.functions.ts:350` (`saveStandaloneRound`, reemplaza la validación de la línea ~395)
- Modify: `src/components/tournament-tracker/PerformanceTrackerModal.tsx` (guardado, ~397)
- Modify: `src/routes/sessions.$sessionId.tsx:797` (`handleSave`)

**Interfaces:**
- Produces: `roundLeadersProblem(r: { is_bye: boolean; player_leader_id: string | null | undefined; opponent_leader_id: string | null | undefined }): string | null` en `src/lib/round-rules.ts`.

- [ ] **Step 1: prueba que falla**, al final de `scripts/round-rules.check.mts`:

```ts
import { roundLeadersProblem } from "../src/lib/round-rules.ts";
const L = "00000000-0000-0000-0000-000000000001";
assert.equal(roundLeadersProblem({ is_bye: true, player_leader_id: null, opponent_leader_id: null }), null);
assert.equal(roundLeadersProblem({ is_bye: false, player_leader_id: L, opponent_leader_id: L }), null);
assert.equal(roundLeadersProblem({ is_bye: false, player_leader_id: null, opponent_leader_id: L }), "Selecciona tu leader para guardar la ronda");
assert.equal(roundLeadersProblem({ is_bye: false, player_leader_id: L, opponent_leader_id: undefined }), "Selecciona el leader del oponente para guardar la ronda");
assert.equal(roundLeadersProblem({ is_bye: false, player_leader_id: null, opponent_leader_id: null }), "Selecciona tu leader para guardar la ronda");
```

(El `import` va con los demás, arriba del archivo.)

- [ ] **Step 2:** `npx tsx scripts/round-rules.check.mts`. Expected: falla porque `roundLeadersProblem` no existe.
- [ ] **Step 3:** implementar `roundLeadersProblem`. Primero se revisa el leader propio y después el rival.
- [ ] **Step 4:** `npx tsx scripts/round-rules.check.mts`. Expected: sale sin error.
- [ ] **Step 5: servidor.** En `saveRoundResult`, justo después de la validación de oponente, `const p = roundLeadersProblem(data); if (p) throw new Error(p);`. En `saveStandaloneRound`, leer también `player_leader_id` de la sesión en el mismo `select` y llamar con `player_leader_id: data.player_leader_id ?? session.player_leader_id`, reemplazando el chequeo actual de rival.
- [ ] **Step 6: pantalla.** En `PerformanceTrackerModal` y en `sessions.$sessionId.tsx` `handleSave`, antes de enviar, llamar a `roundLeadersProblem` con el leader efectivo (`round.player_leader_id ?? myLeader?.id` en el modal; el leader de la sesión o de la ronda en sesiones). Si devuelve texto, `toast.error(texto)` y no enviar. En sesiones, si falta el leader propio, abrir además el selector de leader del encabezado (el "Cambiar leader" que ya existe).
- [ ] **Step 7:** verificación en sandbox. Guardar una ronda sin leader propio muestra el mensaje y no guarda. Con los dos leaders, guarda. Un Bye guarda sin leaders.
- [ ] **Step 8:** `git commit -am "feat(rondas): leader propio y rival obligatorios"`

---

### Task 3: Plazo de 7 días para editar (punto 4)

**Files:**
- Modify: `src/lib/round-rules.ts`, `scripts/round-rules.check.mts`
- Modify: `src/lib/nexus-tournament-tracker.functions.ts` (`saveRoundResult`, `updateMyTournamentLeader:474`, `clearTournamentRounds:523`, `deleteRoundResult:546`, y el resumen que devuelve `getTournamentRoundsForPlayer:112`)
- Modify: `src/lib/nexus-appeals.functions.ts:13` (`createAppeal`)
- Modify: `src/components/tournament-tracker/RoundsAccordionReadOnly.tsx:450-465`

**Interfaces:**
- Produces: `EDIT_WINDOW_DAYS = 7` y `editWindow(t: { approved_at: string | null; published_at: string | null }, now: Date): { open: boolean; daysLeft: number | null }` en `round-rules.ts`. Si no hay ninguna de las dos fechas: `{ open: true, daysLeft: null }`.
- Produces: `assertEditWindow(admin, tournamentId: string): Promise<void>` (no exportada) en `nexus-tournament-tracker.functions.ts`. Lee `approved_at, published_at` de `tournaments` y, si el plazo ya cerró, lanza el error con el mensaje de Global Constraints. `createAppeal` necesita la misma regla: exportarla desde un archivo `.server.ts` si las reglas de importación de TanStack lo exigen; si no, exportarla del mismo archivo.
- Produces: `getTournamentRoundsForPlayer` agrega `edit_window: { open: boolean; daysLeft: number | null }` a su respuesta.

- [ ] **Step 1: prueba que falla:**

```ts
import { editWindow, EDIT_WINDOW_DAYS } from "../src/lib/round-rules.ts";
const t0 = "2026-11-01T18:00:00.000Z";
const at = (ms: number) => new Date(Date.parse(t0) + ms);
const DAY = 86_400_000;
assert.equal(EDIT_WINDOW_DAYS, 7);
assert.deepEqual(editWindow({ approved_at: null, published_at: null }, new Date()), { open: true, daysLeft: null });
assert.deepEqual(editWindow({ approved_at: t0, published_at: null }, at(0)), { open: true, daysLeft: 7 });
assert.equal(editWindow({ approved_at: t0, published_at: null }, at(7 * DAY - 1)).open, true);
assert.equal(editWindow({ approved_at: t0, published_at: null }, at(7 * DAY)).open, false);
assert.equal(editWindow({ approved_at: null, published_at: t0 }, at(8 * DAY)).open, false);
assert.equal(editWindow({ approved_at: t0, published_at: null }, at(6.5 * DAY)).daysLeft, 1);
```

- [ ] **Step 2:** correr el check. Expected: falla porque `editWindow` no existe.
- [ ] **Step 3:** implementar. El plazo cierra en `inicio + 7 × 24 h` (marca de tiempo absoluta, así la zona horaria no influye). `daysLeft = Math.ceil(restante / DAY)` mientras esté abierto, y `0` cuando cierra.
- [ ] **Step 4:** correr el check. Expected: pasa.
- [ ] **Step 5:** llamar a `assertEditWindow` al inicio del handler de `saveRoundResult`, `updateMyTournamentLeader`, `clearTournamentRounds`, `deleteRoundResult` y `createAppeal`. **No** en `confirmRoundResult` ni en la vinculación de sesiones (decisión del diseño).
- [ ] **Step 6:** en `RoundsAccordionReadOnly`, mostrar "Editar" solo si `edit_window.open`. Si `daysLeft` no es null, agregar "· quedan N días" al `title` del botón.
- [ ] **Step 7:** verificación en sandbox. En un torneo con `approved_at` de hace 8 días el botón no aparece, y llamar a `saveRoundResult` desde la consola devuelve el mensaje. Con `approved_at` de hace 1 día sí aparece.
- [ ] **Step 8:** `git commit -am "feat(rondas): plazo de 7 días para editar tras aprobación"`

---

### Task 4: Eliminar apelaciones (punto 5)

**Files:**
- Create: `supabase/migrations/20261118120000_round_appeals_original_status.sql`
- Modify: `src/lib/nexus-appeals.functions.ts` (`createAppeal:13`, nueva `deleteAppeal`)
- Modify: `src/lib/database.types.ts` (tabla `round_appeals`)
- Modify: `src/routes/organizer.appeals.tsx`

**Interfaces:**
- Produces: `deleteAppeal` (POST, `requireNexusUser`), entrada `{ appeal_id: string (uuid) }`, salida `{ ok: true }`.
- Produces: la columna `round_appeals.original_round_status text null`.

- [ ] **Step 1:** migración `alter table public.round_appeals add column original_round_status text;`, aplicada en sandbox. Agregar la columna a `database.types.ts` (Row, Insert y Update).
- [ ] **Step 2:** en `createAppeal`, leer `status` de la ronda en el `select` existente y guardarlo en `original_round_status` al insertar la apelación.
- [ ] **Step 3:** `deleteAppeal`. Mismo control de rol y tienda que `resolveAppeal:219` (la apelación debe ser de `player.home_store_id`). Después: `update tournament_round_results set status = coalesce(original_round_status, 'pending') where id = original_round_id and status = 'under_appeal'`, borrar la apelación y llamar a `logAction` como hace `createAppeal`. No se toca ninguna otra columna de la ronda.
- [ ] **Step 4:** en `organizer.appeals.tsx`, botón "Eliminar" (variante destructiva, secundaria) en cada tarjeta, con `AlertDialog`: título "¿Eliminar esta apelación?", texto "La ronda vuelve a como estaba antes de apelar. No se puede deshacer." Al confirmar, llamar a `deleteAppeal`, quitar la tarjeta de la lista y mostrar `toast.success("Apelación eliminada")`.
- [ ] **Step 5:** verificación en sandbox con la cuenta de organizador. Crear una apelación sobre una ronda `confirmed` y borrarla: la ronda vuelve a `confirmed`. Con una apelación sin `original_round_status` (ponerlo en null a mano), la ronda vuelve a `pending`. Desde otra tienda, `deleteAppeal` falla.
- [ ] **Step 6:** `git add -A supabase src && git commit -m "feat(apelaciones): el organizador puede eliminarlas"`

---

### Task 5: Estado de jugadores y asistencia en el inicio del organizador (punto 8)

**Files:**
- Modify: `src/routes/organizer.index.tsx`
- Create (si el archivo de la ruta se vuelve grande): `src/components/organizer/HomeInsights.tsx`

**Interfaces:**
- Consumes: `getStoreAnalytics` (`src/lib/nexus-organizer-analytics.functions.ts:76`) con `{ data: {} }`, que usa su rango por defecto. Usa `category_summary: Record<PlayerStatus, number>` y `attendance_trend`. Las etiquetas y colores vienen de `PLAYER_STATUSES`, `PLAYER_STATUS_LABELS` y `PLAYER_STATUS_COLORS` (`src/lib/player-status.ts`).

- [ ] **Step 1:** panel "Estado de jugadores" con el mismo `Panel` que los paneles existentes: una fila por estado con su color, etiqueta y conteo. El pie del panel es un enlace "Ver estadísticas" a `/organizer/analytics`.
- [ ] **Step 2:** panel "Asistencia" con un `AreaChart` de recharts de unos 120 px de alto, sin ejes ni leyenda, con los últimos 8 puntos de `attendance_trend` (mismo `dataKey` que `organizer.analytics.tsx:383`). Todo el panel es un `Link` a `/organizer/analytics`, con `aria-label="Ver estadísticas de asistencia"`.
- [ ] **Step 3:** estados de carga y error iguales a los demás paneles (`busy`). Si todos los conteos son 0: "Aún no hay jugadores registrados".
- [ ] **Step 4:** verificación en sandbox (organizador), en escritorio y a 375 px. Los conteos coinciden con los de `/organizer/analytics` y el clic en cualquiera de los dos paneles lleva a Estadísticas.
- [ ] **Step 5:** `git commit -am "feat(organizador): estado de jugadores y asistencia en el inicio"`

---

### Task 6: Filtros de Torneos recientes (punto 3)

**Files:**
- Create: `src/lib/recent-events-filter.ts`
- Create: `scripts/recent-events-filter.check.mts`
- Modify: `src/routes/dashboard.tsx:255-275, 630-700`
- Modify (solo si hace falta): la función del servidor que arma `data.events` del dashboard, para agregar `season_start: string | null` con `getActiveSeason` (`src/lib/nexus-admin-core.ts:79`)

**Interfaces:**
- Produces: `type RecentFilters = { tcg: string | null; store: string | null; range: "all" | "month" | "season"; result: "all" | "top4" | "positive" }`.
- Produces: `filterRecentEvents<T extends { game_id: string; store: string; date: string; placement: number | null; wins: number; losses: number }>(events: T[], f: RecentFilters, ctx: { today: string; seasonStart: string | null }): T[]`. `today` y las fechas van en formato `YYYY-MM-DD`. `month` = mismo año y mes que `today`. `season` = `date >= seasonStart`; si `seasonStart` es null, no filtra.

- [ ] **Step 1: prueba que falla** en `scripts/recent-events-filter.check.mts`. Usar 4 eventos sintéticos: dos tiendas, dos meses y uno en temporada, con colocaciones 1, 3, 5 y null, y récords 3-1, 1-3, 2-2 y 0-0. Afirmar:
  - `all` devuelve los 4;
  - `store: "A"` devuelve solo los de A;
  - `month` con `today = "2026-11-18"` devuelve solo los de noviembre de 2026;
  - `season` con `seasonStart = "2026-10-01"` excluye los anteriores, y con `null` devuelve los 4;
  - `top4` devuelve colocaciones 1 y 3 (null queda fuera);
  - `positive` devuelve solo el 3-1;
  - `store: "A"` + `top4` combinados se intersecan.
- [ ] **Step 2:** `npx tsx scripts/recent-events-filter.check.mts`. Expected: falla porque el módulo no existe.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** correr el check. Expected: pasa.
- [ ] **Step 5:** en `dashboard.tsx`, reemplazar el estado `historyTcg` por `RecentFilters` (las pestañas TCG siguen igual y manejan `tcg`). Debajo de las pestañas, una fila con tres `PillSelect` (`src/components/ui/pill-select.tsx`): Tienda (las tiendas presentes en `events`), Fechas (Todo / Este mes / Esta temporada) y Resultado (Todos / Top 4 / Récord positivo). Cualquier cambio vuelve a `setPage(1)`. El contador del encabezado usa la lista filtrada. Si `events.length > 0` y el filtro deja 0: fila "Sin torneos con estos filtros".
- [ ] **Step 6:** verificación en sandbox (jugador), en escritorio y en móvil (la vista de tarjetas, `dashboard.tsx:817`, usa la misma lista).
- [ ] **Step 7:** `git add -A src scripts && git commit -m "feat(dashboard): filtros de tienda, fechas y resultado en torneos recientes"`

---

### Task 7: Catálogo de TCG por tienda (punto 7)

**Files:**
- Create: `supabase/migrations/20261118130000_tcg_catalog.sql`
- Create: `src/lib/nexus-store-tcgs.functions.ts`
- Modify: `src/lib/database.types.ts`
- Modify: `src/routes/organizer.store.tsx`, `src/components/stores/StoreEditDialog.tsx`, `src/routes/stores.$slug.index.tsx`

**Interfaces:**
- Produces: tablas `tcg_catalog (id uuid pk default gen_random_uuid(), name text not null unique, sort_order int not null default 0)` y `store_tcgs (store_id uuid references stores on delete cascade, tcg_id uuid references tcg_catalog on delete cascade, primary key (store_id, tcg_id))`. RLS activa con lectura pública (`using (true)`) y sin políticas de escritura: se escribe solo con el cliente admin, igual que `store_league_tournaments`.
- Produces: `getTcgCatalog(): { id: string; name: string }[]` (ordenado por `sort_order`, `name`), `getStoreTcgs({ store_id }): { tcg_ids: string[] }` y `setStoreTcgs({ store_id?: string; tcg_ids: string[] }): { ok: true }`. Si el usuario es organizador, `store_id` se ignora y se usa su `home_store_id`. Admin y Manager deben mandar `store_id`. Cualquier otro rol recibe error. Se reemplaza el conjunto completo (delete + insert).

- [ ] **Step 1:** migración aplicada en sandbox, con las tablas vacías (la lista llega después). Actualizar `database.types.ts`.
- [ ] **Step 2:** server functions con el mismo middleware y control de rol que `src/lib/nexus-organizer-leagues.functions.ts`. Validar con zod que `tcg_ids` sean uuids que existan en el catálogo.
- [ ] **Step 3:** en Mi tienda y en `StoreEditDialog`, sección "Juegos que se juegan aquí" con casillas del catálogo y botón Guardar. Si el catálogo está vacío: "El catálogo de juegos aún no está disponible."
- [ ] **Step 4:** en la página pública de la tienda, sección "Juegos" con chips de nombres. Se oculta si la tienda no marcó ninguno.
- [ ] **Step 5:** verificación en sandbox. Insertar 3 TCG de prueba con prefijo `zz`, marcarlos como organizador y luego como Admin en otra tienda, y verlos en la página pública. Al terminar, borrar las filas `zz`.
- [ ] **Step 6:** `git add -A supabase src && git commit -m "feat(tiendas): catálogo de TCG por tienda"`

---

### Task 8: Las tablas de liga solo cuentan torneos aprobados (prerrequisito del punto 6)

**Files:**
- Modify: `src/lib/nexus-public.functions.ts:556` (`computeLeagueStandings`)

- [ ] **Step 1:** en la consulta de `tournament_results`, agregar `tournaments!inner(status)` y `.in("tournaments.status", ["APPROVED", "PUBLISHED"])`, el mismo patrón que `assertPlayedTournament`.
- [ ] **Step 2:** buscar con `grep -rn "store_league_tournaments" src/lib` otros cálculos de puntos de liga. Si alguno suma resultados sin filtrar por estado, aplicarle el mismo filtro.
- [ ] **Step 3:** verificación en sandbox. Un torneo en `DRAFT` vinculado a una liga no suma en su tabla; al aprobarlo, sí suma.
- [ ] **Step 4:** `git commit -am "fix(ligas): las tablas solo cuentan torneos aprobados o publicados"`

---

### Task 9: Un torneo en varias ligas (punto 6)

**Files:**
- Create: `src/lib/league-assignment.ts`, `scripts/league-assignment.check.mts`
- Modify: `src/lib/nexus-organizer-tournaments.functions.ts:210-360, 410-435`
- Modify: `src/components/upload/TournamentUploadForm.tsx` (selector de liga, ~541)
- Modify: `src/lib/nexus-organizer-leagues.functions.ts:180` (`setLeagueTournaments`), `src/lib/nexus-admin-tournaments.functions.ts:436` (`updateTournamentLeague`)

**Interfaces:**
- Produces: `assignLeagues(input: { counts_for_circuit: boolean; league_ids: string[] }): { league_id: string | null; link_ids: string[] } | { error: string }`. Con circuito: `league_id: null` y `link_ids` = las ligas sin duplicados. Solo ligas: `league_id = league_ids[0]` y `link_ids` = todas. Sin circuito y sin ligas: `{ error: "Elige el Circuito Nacional o al menos una liga" }`.
- Produces: `nextPrimaryLeague(current: string | null, remaining: string[]): { league_id: string | null } | { blocked: true }`. Si `current` es null (torneo de circuito): `{ league_id: null }` siempre. Si `current` está en `remaining`: se conserva. Si no, `{ league_id: remaining[0] }`. Si `remaining` está vacío: `{ blocked: true }`.
- La entrada de la función de subida cambia de `league_id: string | null` a `counts_for_circuit: boolean` + `league_ids: string[]`.

- [ ] **Step 1: prueba que falla** en `scripts/league-assignment.check.mts`, con todos los casos de las dos firmas de arriba: circuito + 2 ligas, circuito sin ligas, solo 2 ligas, ninguna opción, ligas duplicadas; y para `nextPrimaryLeague`, circuito, se conserva, cambia y bloqueado.
- [ ] **Step 2:** correr el check. Expected: falla porque el módulo no existe.
- [ ] **Step 3:** implementar `src/lib/league-assignment.ts`.
- [ ] **Step 4:** correr el check. Expected: pasa.
- [ ] **Step 5: servidor de subida.** Usar `assignLeagues`. Validar todas las `link_ids` con la consulta que hoy valida una sola liga (`:289`): de la tienda, activa y del mismo TCG. Las reglas de duplicados (`:309`), `status`, `approved_at`/`published_at` y torneo cancelado (`:430`) siguen leyendo el `league_id` resultante, sin otros cambios. Insertar una fila de `store_league_tournaments` por cada `link_id`.
- [ ] **Step 6: formulario.** Reemplazar el selector único por una casilla "Cuenta para el Circuito Nacional" (marcada por defecto) y casillas con las ligas activas de la tienda y del TCG elegido. Los Managers siguen sin ver ligas y siempre mandan `counts_for_circuit: true, league_ids: []`. Mostrar el error de `assignLeagues` en línea, antes de enviar.
- [ ] **Step 7: quitar ligas después.** En `setLeagueTournaments` y `updateTournamentLeague`, para cada torneo afectado con `league_id` no nulo, calcular `nextPrimaryLeague` con sus vínculos restantes. Si da `blocked`, lanzar el error "Este torneo solo pertenece a esta liga; no se puede quitar". Si cambia, actualizar `tournaments.league_id`.
- [ ] **Step 8:** verificación en sandbox con una tienda con dos ligas activas del mismo TCG:
  - Circuito + 2 ligas: queda `DRAFT` y no suma en las ligas; al aprobarlo, suma en las dos.
  - Solo 2 ligas: se publica directo y suma en ambas.
  - Quitar la liga principal: `league_id` pasa a la otra.
  - Quitar la última liga: se bloquea.
- [ ] **Step 9:** `git add -A src scripts && git commit -m "feat(ligas): un torneo puede contar para varias ligas y el circuito"`

---

### Task 10: Revisión final

- [ ] **Step 1:** correr todos los checks tocados: `npx tsx scripts/round-rules.check.mts && npx tsx scripts/recent-events-filter.check.mts && npx tsx scripts/league-assignment.check.mts && npx tsx scripts/organizer-home.check.mts && npx tsx scripts/player-status.check.mts`. Expected: todos salen sin error.
- [ ] **Step 2:** `npx tsc --noEmit` y `npm run lint`. Expected: sin errores nuevos.
- [ ] **Step 3:** revisión estilo `/ponytail-review` sobre `git diff impeccable/jugador-y-acceso...HEAD`.
- [ ] **Step 4:** dejar anotado para el fundador: las migraciones `20261118120000` y `20261118130000` están solo en sandbox, y falta cargar la lista del catálogo de TCG.

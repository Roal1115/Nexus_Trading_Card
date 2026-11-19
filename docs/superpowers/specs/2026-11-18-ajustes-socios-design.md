# Ajustes pedidos por los socios (junta 2026-11-18): diseño

Fecha: 2026-11-18. Estado: borrador para aprobación. Sin código escrito.

## Intención y por qué

En la última junta, los socios del fundador pidieron ocho ajustes. Vienen de usar la plataforma como jugadores y organizadores. Buscan datos de partidas más completos (leader y dado), menos fricción para el organizador (apelaciones, inicio, ligas) y una tienda que diga qué juega, más allá del circuito.

## Metas

1. El leader propio y el del rival son obligatorios en toda ronda capturada por el jugador (salvo Bye), en torneos y en sesiones.
2. Dado y turno se ven abiertos por defecto al capturar una ronda.
3. "Torneos recientes" del Dashboard del jugador se filtra por tienda, rango de fechas y resultado.
4. El jugador no puede editar las rondas de un torneo pasados 7 días desde la fecha del torneo.
5. El organizador puede eliminar cualquier apelación de su tienda.
6. Un torneo puede contar para varias ligas internas a la vez, y además, si se elige, para el Circuito Nacional.
7. Cada tienda tiene una lista de los TCG que juega, independiente de los juegos del circuito.
8. El inicio del organizador muestra el estado de sus jugadores y una gráfica de asistencia. Las dos llevan a Estadísticas.

## No metas

- Pantalla para administrar el catálogo de TCG (punto 7). El fundador carga la lista después y entra por migración.
- Cambiar los umbrales de estado de jugador. El inicio usa los fijos de hoy; los umbrales propios siguen siendo de Platino (ver `2026-11-17-organizer-tiers-design.md`).
- Exigir leader en rondas importadas por CSV o por el organizador. Solo aplica a lo que captura el jugador.
- Plazo de edición para organizadores, Admin o Manager.

## Anti-metas (fracaso aunque funcione)

- Que un torneo de liga interna empiece a contar para el circuito sin que el organizador lo pida, o al revés.
- Que el plazo de 7 días se salte llamando directo a la función del servidor.
- Que borrar una apelación cambie o borre la ronda apelada.
- Que una tienda vea o borre apelaciones de otra tienda.

## Qué existe hoy (hallazgos)

| # | Hoy |
|---|---|
| 1 | `sessions.$sessionId.tsx:799` y `saveStandaloneRound` exigen `opponent_leader_id`. `PerformanceTrackerModal` → `saveRoundResult` (`nexus-tournament-tracker.functions.ts:303`) **no** lo exige. |
| 2 | `RoundOutcomeFields` con `compact` pliega dado y turno en `<details>` ("Más detalles", `round-ui.tsx:475`), abierto solo si ya tienen valor. |
| 3 | `dashboard.tsx:630` filtra por TCG en el cliente (`historyTcg`), con pestañas que solo salen si hay más de un TCG. Las columnas ya incluyen tienda, fecha, V/D y posición. |
| 4 | Botón "Editar" en `RoundsAccordionReadOnly.tsx:458` (abre el tracker). Sin límite de tiempo en pantalla ni en servidor. |
| 5 | `nexus-appeals.functions.ts`: `createAppeal`, `getStoreAppeals` (solo `pending`), `resolveAppeal`. No hay borrado. |
| 6 | `tournaments.league_id`: `NULL` = circuito; un valor = torneo solo de esa liga, publicado directo sin revisión. La tabla `store_league_tournaments` (muchos a muchos) ya existe y alimenta las tablas de liga (`nexus-public.functions.ts:617`, `nexus-organizer-leagues.functions.ts`). Hay unas 140 lecturas de `league_id` que asumen "`NULL` = circuito". |
| 7 | No existe catálogo de TCG por tienda. La tabla `games` es la de los juegos del circuito. |
| 8 | `organizer.index.tsx` tiene paneles "Necesita atención", "Tus torneos enviados" y "Esta semana". `player-status.ts` calcula el estado (56 días, 3 faltas, 2 visitas) y ya se usa en `organizer.analytics.tsx`. |

## Enfoques considerados

**Punto 6, elegida A.**
- **A (elegida):** casilla "Cuenta para el Circuito Nacional" (marcada por defecto) más selección múltiple de ligas internas. Las ligas van en `store_league_tournaments`.
- **B (descartada):** todo torneo cuenta siempre para el circuito y las ligas son extra. Se pierden los torneos de liga casual que hoy no tocan el circuito.

**Punto 7, elegida A.**
- **A (elegida):** catálogo propio (`tcg_catalog`) más una tabla de unión tienda-TCG. El organizador marca en Mi tienda y se ve en la página pública.
- **B (descartada):** etiquetas de texto libre. "Pokemon", "Pokémon" y "PKMN" quedarían como juegos distintos y no se podrían agrupar.

Los puntos 1 a 5 y 8 tienen un solo camino razonable.

## Diseño por punto

### 1. Leader propio y rival obligatorios

Decisión del fundador: al registrar una ronda (que no sea Bye) son obligatorios **los dos leaders**, el del jugador y el del rival. Ninguno es opcional.

- **Torneo (Performance Tracker):** `saveRoundResult` rechaza la ronda si falta `player_leader_id` o `opponent_leader_id`. `PerformanceTrackerModal` ya rellena `player_leader_id` con el leader del torneo (`myLeader`). Si no hay leader elegido, pide elegirlo antes de guardar la primera ronda.
- **Sesiones (Nueva partida):** `saveStandaloneRound` ya exige el rival y además exige el leader del jugador (el de la ronda o, si no viene, el de la sesión). `sessions.$sessionId.tsx` pide elegir "tu leader" antes de guardar si la sesión no lo tiene.
- Mensajes: "Selecciona tu leader para guardar la ronda" y el ya existente "Selecciona el leader del oponente para guardar la ronda".
- Las rondas viejas sin leader no se tocan. Solo se exige al guardar.

### 2. Dado y turno visibles

- En `RoundOutcomeFields` `compact`, dado y turno salen del `<details>` y quedan a la vista bajo Resultado. Las notas siguen plegadas en "Más detalles".
- Dado y turno siguen siendo opcionales. El pedido es que se vean, no que se exijan.

### 3. Filtros en Torneos recientes

- Se agregan tres filtros a los datos que ya se cargan, sin consulta nueva: **Tienda** (select con las tiendas presentes), **Fechas** (este mes, esta temporada, todo) y **Resultado** (Top 4, récord positivo, todos).
- El filtro por TCG se queda como está.
- Los filtros se combinan entre sí. Cambiar un filtro vuelve a la página 1.

### 4. Edición limitada a 7 días

- Regla (decisión del fundador): los 7 días corren desde que el jugador puede capturar, es decir, desde `approved_at` (o `published_at` si no hay `approved_at`), no desde la fecha del torneo. Motivo: los torneos del circuito esperan revisión y publicación dominical, y el plazo no debe vencer antes de que el jugador vea el torneo. Zona horaria de México, como el resto del sistema.
- Servidor: `saveRoundResult`, `deleteRoundResult`, `clearTournamentRounds`, `updateMyTournamentLeader` y `createAppeal` rechazan fuera de plazo con el mensaje "Este torneo ya no se puede editar (pasaron 7 días)".
- Quedan fuera del bloqueo (decisión del constructor, revisable): `confirmRoundResult` (aceptar la ronda que capturó el oponente no cambia datos propios) y la vinculación de sesiones (`linkSessionManually`, `undoSessionLink` y el autolink de la base), que corre al publicar y es automática.
- Pantalla: el botón "Editar" se oculta fuera de plazo. Dentro de plazo muestra cuántos días quedan.
- La constante vive en un solo lugar, compartido por servidor y pantalla.
- Las sesiones independientes no vinculadas (`nexus-standalone`) no entran: no son torneos.

### 5. Eliminar apelaciones

- Nueva función `deleteAppeal` en `nexus-appeals.functions.ts`. Solo el organizador, y solo si la apelación es de su tienda (mismo control que `resolveAppeal`).
- Al apelar, `createAppeal` pone la ronda en `under_appeal` (`nexus-appeals.functions.ts:101`). Decisión del fundador: al borrar la apelación, la ronda **vuelve a su estado anterior**, sin cambiar ningún otro dato. Para eso, la apelación guarda el estado previo de la ronda al crearse (columna nueva, p. ej. `original_round_status`; las apelaciones existentes sin ese dato vuelven a `pending`). Es la única excepción a "borrar no toca la ronda": se restaura el estado, nunca los datos.
- En `organizer.appeals.tsx`, cada tarjeta lleva un botón "Eliminar" con diálogo de confirmación ("No se puede deshacer").
- La lista hoy solo muestra las pendientes, así que en la práctica se borran pendientes. No se agrega una vista de resueltas.

### 6. Un torneo en varias ligas

Modelo, sin cambiar lo que hoy significa `league_id`, para no tocar las ~140 lecturas:
- **Cuenta para el circuito:** `league_id = NULL`, pasa por revisión como hoy. Las ligas elegidas se guardan en `store_league_tournaments`.
- **Solo ligas:** `league_id` = la primera liga elegida (conserva la publicación directa y la regla de duplicados de hoy). Todas las ligas elegidas van en `store_league_tournaments`.
- Las tablas de liga ya leen de `store_league_tournaments`, así que suman el torneo en cada liga sin cambios.

Pantalla de subida (`TournamentUploadForm`): la casilla del circuito más una selección múltiple con las ligas activas de la tienda y del mismo TCG. Se exige al menos una opción (circuito o una liga).

Servidor (`nexus-organizer-tournaments.functions.ts`): recibe `counts_for_circuit` y `league_ids[]`. Valida que cada liga sea de la tienda, esté activa y sea del mismo TCG.

Un torneo que cuenta para el circuito y para ligas espera la revisión de Admin o Manager. Sus puntos de liga aparecen cuando se publica, igual que los del circuito. Hoy `computeLeagueStandings` (`nexus-public.functions.ts:556`) suma todos los torneos vinculados **sin filtrar por estado**, así que se agrega el filtro `APPROVED`/`PUBLISHED`. Esto también evita que cuente un torneo de circuito rechazado (vuelve a `DRAFT` y conserva sus vínculos).

Cambios posteriores de ligas (decisión del constructor): si `setLeagueTournaments` o la edición de Admin quita la liga guardada en `league_id` de un torneo solo de ligas, `league_id` pasa a otra liga vinculada. Si era la última, se bloquea la operación, porque dejar `league_id` en `NULL` lo convertiría en torneo de circuito sin revisión.

Fuera de alcance: Managers subiendo torneos a ligas (hoy siempre suben al circuito).

### 7. Catálogo de TCG por tienda

- Migración: `tcg_catalog (id, name unique, sort_order)` y `store_tcgs (store_id, tcg_id, primary key ambos)`. Lectura pública. Escritura solo por funciones del servidor (mismo patrón que `store_league_tournaments`).
- El fundador entrega la lista. Mientras tanto la migración crea las tablas vacías y la lista entra en una migración posterior.
- Mi tienda (organizador) y el diálogo de edición de tienda (Admin/Manager, `StoreEditDialog`): casillas con el catálogo.
- Página pública de la tienda: "Juegos" con los nombres marcados. Si no hay ninguno, la sección no se muestra.
- No afecta la subida de torneos, las ligas ni el circuito.

### 8. Inicio del organizador

- Nuevo panel "Estado de jugadores": conteo por estado con `player-status.ts` y los umbrales fijos, el mismo cálculo que Estadísticas. Todo el panel lleva a `/organizer/analytics`.
- Nuevo panel con una gráfica chica de asistencia (últimas 8 semanas), reutilizando el componente de Estadísticas. Al hacer clic lleva a `/organizer/analytics`.
- Disponible en todos los tiers. Sigue la skill Impeccable y el estilo de los paneles existentes.

## Orden de entrega

1. Puntos 2, 1, 5 y 4 (chicos; el 5 lleva una columna nueva en apelaciones).
2. Puntos 8 y 3 (solo pantalla y lectura).
3. Punto 7 (migración nueva, independiente).
4. Punto 6 (el de más riesgo; se prueba en sandbox con una tienda de dos ligas).

Cada bloque se prueba en sandbox (`npm run dev:sandbox`) con las cuentas de jugador y organizador antes de pasar al siguiente.

## Lo que queda al constructor

- Nombres finales de componentes y textos de los filtros.
- Si el conteo del punto 8 se calcula en el servidor o en el cliente, reutilizando lo que ya hace Estadísticas.
- Pruebas: una prueba de la regla de 7 días (límite exacto) y una del modelo de ligas del punto 6.

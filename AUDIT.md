# GeekArena — Auditoría de seguridad y mejoras

Fecha: 2026-07-06 · Alcance: `src/` completo (~44k LOC), config del repo, flujo de auth y las 154 server functions.

---

## 1. Vulnerabilidades y riesgos de seguridad

### 🔴 CRÍTICO

#### 1.1 Service role key commiteada en git
- **Dónde:** `.env` está trackeado en git (`git ls-files` lo confirma) y contiene `GEEKARENA_SERVICE_ROLE_KEY`.
- **Riesgo:** cualquiera con acceso al repo (colaborador, fork, leak del historial) tiene **acceso total a la base de datos**, bypaseando RLS y toda la lógica de autorización. La key vive en el historial aunque la borres del archivo.
- **Fix:**
  1. Rotar la service role key en el dashboard de Supabase **ya** (Settings → API → regenerate).
  2. `git rm --cached .env` y agregar `.env` a `.gitignore`.
  3. Considerar `git filter-repo` para purgar el historial si el repo se comparte.
  4. Crear un `.env.example` sin valores para documentar las variables.

### 🟠 ALTO

#### 1.2 Enumeración de emails sin autenticación (`resolveEmailByGeekTag`)
- **Dónde:** `src/lib/geekarena-auth-helpers.functions.ts:5`.
- **Riesgo:** endpoint público que convierte cualquier `geek_tag` en el **email real del jugador**. Un atacante puede scrapear el leaderboard (tags públicos) y construir una lista de correos para phishing dirigido. Además usa `ilike` sin escapar, así que `%` como tag devuelve el primer email de la tabla.
- **Fix:** en lugar de devolver el email al cliente, haz el sign-in del lado del servidor: una server function `loginWithGeekTag(tag, password)` que resuelve el email internamente y llama a `signInWithPassword` con el admin client, devolviendo solo la sesión o el error. El email nunca viaja al navegador de un no-autenticado.

#### 1.3 Métricas de sponsors inflables sin autenticación
- **Dónde:** `registerAdView` y `registerSponsorView` en `geekarena-ads.functions.ts` (sin middleware).
- **Riesgo:** si les cobras o reportas vistas a los sponsors, cualquiera puede inflar los contadores con un loop de `fetch`. Es fraude de métricas trivial.
- **Fix mínimo:** requerir `requireGeekarenaUser` + dedupe por (player, sponsor, día) en una tabla o constraint único. Si necesitas contar vistas anónimas, agrega rate limiting por IP en el edge (Cloudflare WAF rule) y acepta que el número es aproximado.

### 🟡 MEDIO

#### 1.4 `ilike` con input sin escapar (wildcard injection)
- **Dónde:** patrón repetido — `searchStores` (`ilike("name", \`%${search}%\`)`), middleware (`ilike("email", email)`), `resolveEmailByGeekTag`.
- **Riesgo:** `%` y `_` son metacaracteres. En el middleware, un usuario de Supabase Auth con email `a%@dominio.com` (válido para Auth) haría match con el player `ab@dominio.com` → **suplantación de cuenta**. En búsquedas es solo ruido.
- **Fix:** para el middleware usa `.eq("email", email)` con emails normalizados a lowercase al registrarse (la comparación case-insensitive que buscas con `ilike` se resuelve guardando siempre lowercase). Para búsquedas, escapa: `search.replace(/[%_]/g, "\\$&")`.

#### 1.5 Sin rate limiting en endpoints de autenticación
- **Dónde:** login/signup/reset dependen solo del rate limit de Supabase Auth; `resolveEmailByGeekTag` y todas las server functions públicas no tienen ninguno. El "cooldown" de 3s en `login.tsx` es solo client-side (se bypasea con curl).
- **Fix:** ya estás en Cloudflare (`@cloudflare/vite-plugin`) — configura rate limiting rules para `/_serverFn/*` (p. ej. 30 req/min por IP). Cero código.

#### 1.6 Mensajes de error internos expuestos al cliente
- **Dónde:** patrón `if (error) throw new Error(error.message)` en casi todas las server functions.
- **Riesgo:** los mensajes de PostgREST filtran nombres de tablas, columnas y constraints al navegador — mapa gratis del esquema para un atacante.
- **Fix:** loggear `error.message` en el servidor y lanzar un mensaje genérico ("Error al consultar datos"). Un helper de 5 líneas usado en todos los handlers.

### 🟢 BAJO / observaciones

- **1.7** `seedTestAccounts` (`geekarena-setup.functions.ts`) está gated a admin, pero código de seeding no debería llegar a producción — muévelo a un script o borra.
- **1.8** El anon key hardcodeado en `src/integrations/geekarena/client.ts` está bien (es publishable por diseño), pero **verifica que RLS esté habilitado en TODAS las tablas** del proyecto GeekArena. Hoy nada del cliente lee tablas directamente, pero el anon key permite intentarlo. Corre: `select tablename from pg_tables where schemaname='public' and rowsecurity=false;`
- **1.9** Tokens de sesión en `localStorage` (`storageKey: "geekarena.auth"`) — estándar de supabase-js, pero significa que cualquier XSS roba la sesión. El único `dangerouslySetInnerHTML` está en `chart.tsx` (shadcn, contenido controlado) — OK hoy, mantenlo así.
- **1.10** El middleware hace 2 round-trips a Supabase por **cada** server function call (getUser + select player). Con navegación normal son decenas por minuto por usuario. Considera cachear el lookup del player por token unos segundos (Map en memoria con TTL), o validar el JWT localmente con el JWT secret.

---

## 2. Calidad de código / arquitectura

- **2.1 `inputValidator` deprecado** — las 3 funciones de `geekarena-public.functions.ts` (y probablemente el resto) usan la API deprecada de TanStack Start. Migrar a `.validator()` antes de que un upgrade lo rompa.
- **2.2 `as any` y `any[]` por todos lados** — los tipos de fila están escritos a mano y desincronizados. Genera tipos reales: `supabase gen types typescript --project-id tbtyxtigbsljyrwyelqr > src/integrations/geekarena/types.ts` y tipa el client. Elimina la mitad de los `as any` de golpe.
- **2.3 `geekarena-admin.functions.ts` tiene 2,100+ líneas** — divide por dominio (stores, players, seasons, tournaments, staff). Mismo caso `geekarena-standalone.functions.ts` (~950).
- **2.4 Fetch imperativo repetido** — cada ruta repite el patrón `useState + useEffect + setLoading`. Ya tienes `@tanstack/react-query` instalado y no lo usas en las rutas. Migrar gradualmente: elimina estados de loading manuales, agrega cache/retry/refetch gratis, y de paso los `// eslint-disable exhaustive-deps` desaparecen.
- **2.5 Colores de TCG duplicados** — `GAME_COLORS` existe en `weekly-grid.tsx` (por slug) y una versión vieja por nombre existía en `calendar.tsx`; `admin.calendar.tsx` tiene `ZONE_COLORS` propio. Un solo módulo `src/lib/game-colors.ts` como fuente de verdad — idealmente el color debería venir de la tabla `games` para que agregar un TCG no requiera deploy.
- **2.6 Lógica de "semana" duplicada** — `useWeekNav` (domingo-based) vs `getManagerCalendar` (lunes-based) vs `getPublicCalendar`. Unifica la convención (elige domingo o lunes) o habrá bugs de off-by-one en los bordes.
- **2.7 `.toISOString().split("T")[0]`** para fechas locales — convierte a UTC primero; en México (UTC-6) un `weekStart` a las 00:00 local se serializa como el **día anterior**. Es un bug latente real en `useWeekNav`/`getPublicCalendar`. Usa un helper `toLocalDateStr(d)` con `getFullYear/getMonth/getDate`.

---

## 3. Recomendaciones de features

1. **Registro/confirmación de asistencia ("Voy a ir")** — el calendario ya distingue torneos reales de proyectados; deja que el player marque asistencia anticipada. Le da a las tiendas un headcount y a ti engagement diario. Tabla `tournament_rsvps (tournament_id, player_id)` + botón en el modal.
2. **Notificaciones/recordatorios** — "tu tienda tiene torneo mañana a las 20:30". Web push o email semanal. La infraestructura de schedules ya existe.
3. **Generación automática de torneos desde `store_schedules`** — hoy los organizers crean cada instancia a mano y por eso el calendario se quedó vacío (el bug de Geek Collector). Un cron (pg_cron o Supabase scheduled function) que materialice la próxima semana como DRAFT resuelve la causa raíz.
4. **Página de torneo individual pública** — hoy el modal es el final del camino. Una ruta `/tournaments/$id` con resultados, standings y decks compartible en redes sociales es marketing gratis para las tiendas.
5. **Filtro "solo mi tienda" / favoritos** — el player ya tiene `home_store_id`; un toggle en el calendario para ver solo su tienda + tiendas favoritas.
6. **ICS export** — botón "agregar a mi calendario" en el modal. Es un string ICS de 10 líneas, cero dependencias.

## 4. Diseño / UX

- **4.1 Inconsistencia de tokens de color** — conviven `border-white/10 bg-black/30` (admin), `border-[#2A3A57] bg-[#111A2E]` (calendar público) y clase `glass`. Define tokens (`--surface`, `--border-subtle`) en CSS y usa uno solo; hoy el mismo "card" se ve distinto en cada sección.
- **4.2 El grid semanal en móvil** requiere scroll horizontal de 760px. Para pantallas chicas considera una vista lista agrupada por día (los datos ya están; es un `<div>` alterno bajo `sm:hidden`), el grid de horas solo aporta en desktop.
- **4.3 Estados vacíos** — el grid semanal sin torneos muestra celdas vacías sin mensaje. Reusa el patrón "Sin torneos esta semana + CTA de cambiar filtros" que ya tenía la vista mensual.
- **4.4 Accesibilidad:** los modales no tienen `role="dialog"`, focus trap ni cierre con Escape — ya tienes Radix `Dialog` instalado, úsalo en lugar de los divs fixed manuales. Los botones de navegación de semana necesitan `aria-label`.
- **4.5 Animaciones:** tienes `framer-motion` instalado; una transición sutil (150ms fade/slide) al cambiar de semana y al abrir modales haría mucho por la percepción de calidad. No agregues más que eso — la app es rápida y debe sentirse así.
- **4.6 Tipografía:** revisa la jerarquía — hay `text-[9px]`/`text-[10px]` en mucha UI funcional que en móvil queda por debajo del mínimo legible (~11px). Los tamaños micro solo en el grid, no en modales.

---

## Prioridad sugerida

| # | Acción | Estado |
|---|--------|--------|
| 1 | Rotar service role key + sacar `.env` de git (1.1) | ⚠️ **PENDIENTE — requiere dashboard de Supabase (usuario)** |
| 2 | Login server-side sin exponer email (1.2) | ✅ 2026-07-06 — `loginWithIdentifier`/`resendConfirmation`/`sendPasswordReset`; email nunca sale del server, enmascarado para UI |
| 3 | Escape de wildcards en `ilike` del middleware (1.4) | ✅ 2026-07-06 — se escapa `%`/`_`/`\` (se mantuvo case-insensitive para no romper emails con mayúsculas en DB) |
| 4 | Dedupe en views de sponsors (1.3) | ✅ 2026-07-06 — dedupe por IP+sponsor/hora en server + guard sessionStorage en cliente. Sin auth obligatoria: los ads viven en páginas públicas |
| 5 | Fix `.toISOString()` timezone en fechas (2.7) | ✅ 2026-07-07 — `toLocalDateStr()` + `todayInMexicoStr()` en utils; el bug real era "hoy" en UTC ocultando torneos después de las 6pm MX |
| 6 | Rate limiting (1.5) | ✅ 2026-07-07 — en código (`rate-limit.server.ts`): login 5/min/IP, resend/reset 3/min/IP. No hay dashboard de Cloudflare propio (hosting vía Lovable); si algún día lo hay, migrar a WAF rules |
| 7 | Errores genéricos al cliente (1.6) | ✅ 2026-07-07 — `failDb()` en 131 sitios: loggea el error real de Postgres en server, lanza mensaje genérico al cliente |
| 8 | Auto-generación de torneos desde schedules (feature 3) | ✅ N/A — **no se construye**: un row de `tournaments` es un reporte de resultados (DRAFT = pendiente de revisión), no un evento agendado. Pre-crear rows vacíos inundaría la cola de aprobación del admin. La causa raíz (calendario vacío) se resolvió proyectando `store_schedules` como eventos `is_scheduled` en `getPublicCalendar` |

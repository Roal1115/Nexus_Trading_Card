# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Web app responsive con manifest PWA (`public/manifest.webmanifest`, `display: standalone`). El público principal la usa en el celular.

## Users

- **Primario: jugador competitivo de TCG en México** (One Piece, Magic: The Gathering, Pokémon TCG). Suele consultarla desde el celular entre torneos o en la tienda: su posición en el ranking, su perfil, las stats de la temporada, el calendario de tiendas y sus Sessions ronda por ronda. Cuando hay que priorizar, gana este usuario.
- Roles secundarios, operativos, que trabajan en paneles:
  - **Organizador de tienda** (`/organizer`): administra su tienda, sube resultados de torneos (Excel), calendario y apelaciones.
  - **TCG manager** (`/tcg-manager`): modera los torneos de sus juegos asignados, la red de tiendas, las zonas y los playoffs.
  - **Admin** (`/admin`): opera todo el circuito: temporadas, publicación, jugadores, sponsors y ads, staff y actividad.

## Product Purpose

Nexus es el circuito nacional de ranking para TCG competitivo en México. Las tiendas suben resultados, los managers los moderan, el admin los publica y se actualizan el leaderboard y los perfiles de jugador. El éxito es que el jugador tenga motivos para abrir la app entre torneos y que el ranking nacional sea creíble porque hay suficientes tiendas activas en cada zona.

## Positioning

Es el único producto que combina un **ranking oficial y moderado de circuito nacional**, un **tracker personal ronda por ronda (Sessions)** y una **red de tiendas locales** en México. La competencia solo cubre una parte: Bandai TCG+, Melee y TopDeck corren torneos; Limitless cubre el meta global; Logia y OPTCG.GG hacen tracking aislado. TCG Arena es genérico y no tiene un circuito curado (ver `BUSINESS_ANALYSIS.md`).

## Operating Context

- Pipeline de resultados: la tienda sube → el TCG manager modera → el admin publica → leaderboard.
- Temporadas mensuales y semestrales, por juego, con filtros por zona, región y tienda. Hay playoffs de los Niveles 1 a 3.
- Las tiendas se dan de alta por invitación (`/registro-tienda/$token`) y tienen ficha pública (`/stores/$slug`).
- Cada jugador se identifica con un geek tag (`/players/$playerTag`) y tiene logros e historial por temporada.
- Hay espacios de sponsors y ads en las superficies públicas.

## Capabilities and Constraints

- Stack: TanStack Start + React 19, Tailwind 4, shadcn/Radix, framer-motion y recharts. Supabase (auth + Postgres). Se despliega en Cloudflare Workers y se publica vía Lovable.
- Cuatro roles, cada uno con su propia navegación.
- Toda la UI está en español de México (`lang: es-MX`).
- **Decisión abierta:** el modelo premium (para tiendas, jugadores o ambos) no está definido. No hay que inventar planes, precios ni features premium.
- Los logros solo se suman: un logro otorgado nunca se revoca.

## Brand Commitments

- Nombre: **Nexus**. "Trading Card Nexus" se usa solo como nombre largo (en el manifest).
- Assets existentes: `public/icons/`, `public/favicon.ico`, `public/TCN.ico`, `public/social/`.
- Soporta tres juegos: One Piece, MTG y Pokémon. Sus marcas no se usan como identidad propia de Nexus.

## Evidence on Hand

- Análisis de mercado y competencia: `BUSINESS_ANALYSIS.md`.
- Reglas de negocio: `SourceOfTruthBuissnesLogic.md` y `docs/reglas-de-negocio.md`.
- Datos reales en Supabase: leaderboard, torneos y tiendas en vivo.
- Todavía no hay testimonios, métricas de usuarios ni prensa. No inventarlos.

## Product Principles

1. **El jugador primero.** Las superficies públicas y de jugador van antes que los paneles operativos.
2. **La credibilidad del circuito es el producto.** El ranking, los resultados y la moderación deben verse oficiales y confiables.
3. **Local y mexicano.** Tiendas, zonas y regiones importan tanto como la vista nacional.
4. **Dar motivos para volver.** Cada superficie de jugador muestra algo nuevo: posición, racha, próximo torneo o logro.
5. **Paneles rápidos para el staff.** Los roles operativos necesitan escaneo rápido y eficiencia, no espectáculo.

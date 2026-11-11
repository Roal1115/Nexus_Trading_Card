# Nexus — Análisis de negocio y estudio de mercado

> Fecha: 2026-07-22 · Enfoque: negocio/producto, NO técnico (para eso está `AUDIT.md`).
> Objetivo: identificar áreas débiles del producto, mapear la competencia y definir dónde diferenciarnos para ser la herramienta más completa del circuito TCG en México.

---

## 1. Qué es Nexus hoy (resumen de producto)

- **Circuito nacional de ranking** para TCG competitivo (One Piece, MTG, Pokémon) en México.
- 4 roles: jugador, organizador de tienda, TCG manager, admin.
- Pipeline de resultados: tienda sube → manager modera → admin publica → leaderboard.
- **Sessions**: tracker personal ronda por ronda (líder propio/rival, dado, turno, resultado, notas, win rate) con auto-vinculación a torneos oficiales.
- Directorio de tiendas + calendario semanal + sistema de sponsors/ads + temporadas.

**Nuestra tesis de valor:** nadie más combina *ranking oficial de circuito* + *tracker personal de partidas* + *red de tiendas locales* en un solo producto pensado para México.

---

## 2. Áreas débiles (negocio/producto)

### 🔴 Críticas — bloquean crecimiento

| # | Debilidad | Por qué importa |
|---|-----------|-----------------|
| D1 | **El jugador no tiene motivo para abrir la app entre torneos.** El leaderboard cambia 1 vez/semana; Sessions es útil pero pasivo. | Retención. Apps rivales (TCG Arena) tienen chat, trades, colección — razones diarias para abrir. |
| D2 | **Cold start de tiendas.** El valor del calendario/circuito depende de que las tiendas suban resultados; si una zona no tiene tiendas activas, el jugador ve una app vacía. | Sin masa crítica por ciudad, el ranking "nacional" no es creíble. |
| D3 | **Sin app móvil nativa / PWA instalable.** Nuestro público principal es móvil; competimos contra apps de store (Bandai TCG+, TCG Arena, Logia). | Fricción de adopción: "búscalo en el navegador" pierde contra un ícono en el home screen. |
| D4 | **Sin modelo de ingresos claro más allá de sponsors/ads.** Ads requieren tráfico que aún no existe (huevo-gallina). | Sostenibilidad. Los rivales cobran a tiendas (TopDeck: SaaS por evento) o premium a jugadores. |
| D5 | **Dependencia de captura manual.** Todo resultado depende de que un organizador suba un Excel; no hay pairings en vivo ni check-in, así que Nexus llega *después* del torneo, no *durante*. | El torneo en vivo es donde está la atención. Quien corre los pairings (Bandai TCG+, TopDeck, Melee) es dueño de la relación con el jugador esa noche. |

### 🟠 Importantes

| # | Debilidad | Nota |
|---|-----------|------|
| D6 | **Sin torneo público compartible** (`/tournaments/$id`). Cada torneo publicado es marketing gratis para la tienda si se puede compartir en redes; hoy muere en un modal. | Ya identificado en AUDIT §3.4. |
| D7 | **Sin datos de meta agregados públicos.** Tenemos líder por ronda en Sessions y resultados de torneos: podríamos publicar "meta de México" (win rate por líder, matchups). Limitless/onepiecetopdecks viven de esto y no tienen datos locales MX. | Es nuestro dato único; nadie más lo tiene a nivel tienda local en México. |
| D8 | **Sin notificaciones** (torneo mañana en tu tienda, apareciste en un resultado, temporada por cerrar). | El engagement loop está roto sin push/email. |
| D9 | **Sin RSVP/pre-registro.** La tienda no sabe cuánta gente va; el jugador no puede apartar lugar. | Feature puente perfecta: da valor a tienda Y jugador antes del torneo (ataca D5 sin construir pairings). |
| D10 | **Onboarding del jugador nuevo.** Si no jugaste un torneo aún, dashboard vacío. Sessions casual ayuda pero no se descubre sola. | Primer sesión = momento crítico de retención. |
| D11 | **Solo español/México por diseño, pero sin roadmap LATAM.** El mismo playbook sirve para Colombia/Chile/Argentina donde tampoco hay circuito unificado. | Oportunidad de expansión antes de que TCG Arena u otro lo haga. |

### 🟡 Menores

- Sin colección/decklists: el jugador guarda "líder", no su deck de 50 cartas. Los rivales de tracking (Logia, OPTCG.GG) sí lo hacen.
- Sin perfil social rico (avatar, logros, badges de temporada) — el geek tag es un buen inicio pero no hay "presume tu temporada".
- Sponsors sin self-service: todo pasa por el admin.

---

## 3. Mapa de mercado

### 3.1 Plataformas oficiales / de organización de torneos

| Herramienta | Qué hace | Fortaleza | Debilidad vs Nexus |
|---|---|---|---|
| **[Bandai TCG+](https://lp.bandai-tcg-plus.com/en/)** | App oficial Bandai: buscar torneos, inscribirse, check-in, pairings, historial. | Oficial, obligatoria para eventos sancionados One Piece. | Solo juegos Bandai; sin ranking de circuito local; sin stats personales ricas; UX pobre; no le importa el ecosistema de tienda mexicana. |
| **[Melee.gg](https://melee.gg/)** | Plataforma de eventos/torneos multi-TCG (usada en circuitos oficiales grandes). | Estándar en eventos grandes (MTG, Lorcana, etc.). | Orientada a organizadores de eventos grandes, no a comunidad local; sin ranking nacional agregado entre tiendas; inglés. |
| **[TopDeck.gg](https://topdeck.gg/)** | SaaS de torneos: Swiss, brackets, app, Discord bot; 60k+ eventos. | Muy buen software de "correr el torneo". | Es una herramienta para el organizador, no un circuito: no hay ranking entre tiendas ni identidad de jugador nacional. |
| **[Limitless (play.limitlesstcg.com)](https://play.limitlesstcg.com/)** | Torneos online + la base de datos de resultados/meta más grande (Pokémon, One Piece). | Referencia mundial de meta y decklists. | Cero presencia local/física; no sabe qué pasa en una tienda de Guadalajara. |
| **[Play! Pokémon](https://play.pokemon.com/)** | Sistema oficial Pokémon de ligas locales y rankings. | Oficial. | Solo Pokémon; ranking cerrado al sistema oficial. |

### 3.2 Trackers personales / stats (competencia directa de Sessions)

| Herramienta | Qué hace | Debilidad vs Nexus |
|---|---|---|
| **[Logia (iOS)](https://apps.apple.com/us/app/logia-optcg-companion/id6743872871)** | Tracker OPTCG: W/L por deck, stats vs líderes. | Solo tracking personal, aislado: no conecta con torneos reales ni tiendas ni ranking. |
| **[OPTCG.GG Match Tracker](https://www.optcg.gg/match-tracker)** | Log de partidas con líder, dado, W/L, notas (muy parecido a Sessions). | Igual: dato muerto, sin circuito ni comunidad local. |
| **[OPTCG Replay](https://optcgreplay.com/)** | Replays y stats del simulador online. | Nicho de sim, no juego físico. |
| **[TCG Match Making / Egman Events](https://egmanevents.com/op08-tcg-matchmaking)** | Power rankings y stats de matchups con datos de miles de juegos. | Datos de juego online/alto nivel, no de tu meta local. |

### 3.3 El competidor más parecido en concepto

| Herramienta | Qué hace | Diferencia clave |
|---|---|---|
| **[TCG Arena](https://play.google.com/store/apps/details?id=com.tcgarena.android)** | App que conecta jugadores, coleccionistas y tiendas: mapa de tiendas, registro a torneos, check-in digital, leaderboards locales, trade radar, colección, chat/comunidad. | **Es la amenaza más directa al concepto** (jugador + tienda + leaderboard). Pero: es genérica multi-región, sin circuito nacional curado con moderación por rol, sin temporadas, sin tracker ronda-por-ronda con win rate. Nuestro foso es la *capa de circuito oficial mexicano moderado* + el dato de partida granular. |

---

## 4. Diferenciación: qué tiene la gente hoy vs qué ofrecemos

**Hoy un jugador mexicano usa 3-4 herramientas sueltas:**
1. Bandai TCG+ para inscribirse al torneo (obligado).
2. WhatsApp/Facebook de la tienda para enterarse de eventos.
3. Limitless/YouTube para el meta global.
4. (Los más clavados) una app de tracking tipo Logia o una hoja de Excel.

**Nadie une:** su historial real de torneos locales + su win rate personal + el meta de SU ciudad + un ranking nacional con temporadas. Ese es exactamente el hueco de Nexus.

**Nuestros fosos defendibles (en orden):**
1. **La red de tiendas y managers moderando** — relación humana, no se copia con código.
2. **El dato granular local** — win rates por líder *en México*, por tienda, por temporada. Ni Bandai ni Limitless lo tienen.
3. **Identidad de circuito** (geek tag, temporadas, ranking nacional) — status social que crece con el tiempo.

---

## 5. Recomendaciones priorizadas (roadmap de negocio)

### Ahora (retención + credibilidad, bajo esfuerzo)
1. **PWA instalable + push notifications** (ataca D3, D8). "Torneo mañana en tu tienda" y "ya salió el resultado donde jugaste" son los dos triggers de re-apertura más fuertes.
2. **Página pública de torneo compartible** (D6) — la tienda la comparte en su Facebook/WhatsApp; cada torneo publicado trae jugadores nuevos al funnel.
3. **RSVP "Voy a ir"** (D9) — valor inmediato para tienda (headcount) y jugador (compromiso), sin construir pairings.

### Siguiente (el dato como producto)
4. **Meta de México público** (D7): win rate por líder y matchups con los datos de Sessions + torneos, filtrable por ciudad/temporada. Es el contenido que se comparte solo y que ningún rival puede replicar.
5. **Perfil de temporada compartible** (tarjeta con récord, líder más jugado, rank) — marketing orgánico en redes al cierre de cada temporada.

### Después (monetización + expansión)
6. **Plan de tienda de pago** (D4): tienda destacada en el directorio, analytics de sus jugadores, RSVP ilimitado, badge verificado. Cobrar a tiendas (B2B) escala mejor que cobrar a jugadores en LATAM.
7. **Pairings en vivo simplificado** (D5): Swiss básico para torneos de tienda no sancionados (donde Bandai TCG+ no es obligatorio). Cierra el loop "antes/durante/después" del torneo.
8. **Playbook LATAM** (D11): replicar el modelo ciudad por ciudad — el circuito es franquiciable.

### Explícitamente NO hacer (por ahora)
- Colección/precios/trades: es el terreno de TCG Arena y los marketplaces; nos diluiría.
- Torneos online: es el terreno de Limitless; nuestro valor es lo físico/local.
- Deck builder completo: commodity; enlazar a Limitless basta.

---

## 6. Fuentes

- [Bandai TCG+ (oficial)](https://lp.bandai-tcg-plus.com/en/) · [Google Play](https://play.google.com/store/apps/details?id=com.bandai.bandaitcgplus&hl=en_US)
- [Melee.gg](https://melee.gg/)
- [TopDeck.gg](https://topdeck.gg/subscribe) · [Player experience](https://topdeck.gg/features/player-experience)
- [Limitless play platform](https://play.limitlesstcg.com/) · [Limitless One Piece](https://onepiece.limitlesstcg.com/) · [Player rankings](https://onepiece.limitlesstcg.com/players)
- [TCG Arena — Google Play](https://play.google.com/store/apps/details?id=com.tcgarena.android&hl=en_US) · [App Store](https://apps.apple.com/us/app/tcg-arena/id6757301894)
- [Logia: OPTCG Companion](https://apps.apple.com/us/app/logia-optcg-companion/id6743872871)
- [OPTCG.GG Match Tracker](https://www.optcg.gg/match-tracker)
- [OPTCG Replay](https://optcgreplay.com/)
- [Egman Events — TCG Matchmaking](https://egmanevents.com/op08-tcg-matchmaking)
- [Play! Pokémon local tournaments](https://play.pokemon.com/en-us/local-tournaments/)
- [One Piece Top Decks](https://onepiecetopdecks.com/)
- Ligas locales MX de referencia: [LoftyTCG](https://loftytcg.com/pages/liga-one-piece), [Pokemillon](https://www.pokemillon.com/pages/torneos-one-piece-tcg), [MasterForce](https://masterforcemx.com/)

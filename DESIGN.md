---
name: Nexus
description: Circuito nacional de ranking TCG en México — tema oscuro único, acento cian.
colors:
  primary: "#32d9ff"
  on-primary: "#08111f"
  accent-violet: "#9c5cff"
  night-navy: "#08111f"
  card-navy: "#111a2e"
  raised-navy: "#17233d"
  panel-border: "#2a3a57"
  text-primary: "#f5f7fa"
  text-secondary: "#aab6d1"
  text-subtle: "#8a98b3"
  text-muted: "#72819d"
  success: "#4ef0a2"
  warning: "#ffd54a"
  danger: "#ff5f6d"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
  stat:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 700
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.night-navy}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.card-navy}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  nav-item-active:
    backgroundColor: "#32d9ff26"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
---

# Design System: Nexus

<!-- Actualizado 2026-11-11. Pantallas migradas a la dirección "Tabla Oficial" y que
     sirven de referencia: /dashboard, el ranking público (/), el perfil público del
     jugador, el directorio de tiendas (/stores), la ficha de tienda (/stores/$slug),
     el resultado de un torneo (/tournaments/$id), el calendario (/calendar) y el
     selector de líder y arte de /sessions/$sessionId. Glass, gradientes, glows y
     shimmer ya no son parte del sistema; el resto de pantallas todavía los usa y es
     deuda a migrar. design-system/nexus/MASTER.md (morado + Russo One) NO refleja el código. -->

## Overview

**Creative North Star: "La Tabla Oficial"**

Nexus debería leerse como la tabla de posiciones de una liga oficial: el rango y los números son el héroe, la información se ordena en filas y la autoridad viene de la sobriedad, no de los efectos. La meta es que el jugador lo sienta como la referencia oficial del circuito mexicano.

El sistema vive en un **tema oscuro único** (nunca hay tema claro): un fondo navy profundo, superficies navy sólidas un poco más claras, un solo acento cian y tipografía de tres familias (Space Grotesk para títulos, Inter para texto, JetBrains Mono para cifras). La jerarquía sale de la tipografía, el tamaño de las cifras y las líneas divisorias, nunca de los efectos. Glass con desenfoque, gradientes, glows y destellos quedaron fuera del sistema. Todavía aparecen en otras pantallas (163 líneas con `.glass` en 54 archivos, sobre todo paneles de staff) y son deuda a migrar. `/dashboard`, el ranking público (`/`), el perfil público del jugador, el directorio y la ficha de tienda (`/stores`, `/stores/$slug`), el resultado de un torneo (`/tournaments/$id`), el calendario (`/calendar`) y el selector de líder y arte (`/sessions/$sessionId`) son las referencias de cómo debe verse.

La densidad es media: los paneles operativos (organizador, manager, admin) usan tablas que en móvil se convierten en tarjetas, y las superficies de jugador priorizan el rango y el historial reciente.

**Key Characteristics:**
- Tema oscuro único, fondo `night-navy`; el halo radial del shell es lo único atmosférico que queda.
- Un acento cian que se usa con escasez: acción principal, estado activo y "tu" fila o rango.
- Números siempre en mono tabular (`font-mono-stat`); el rango es la cifra más grande de la pantalla.
- Superficies planas: `card-navy` sólido con borde de 1px, un solo nivel, sin tarjetas dentro de tarjetas.
- Datos secundarios como filas de texto (label de 12px + cifra), no como tiles con ícono.
- Español de México en toda la UI.

## Colors

La paleta es un navy nocturno con un solo acento cian eléctrico y tres colores de estado.

### Primary
- **Cian Circuito** (`primary`): el único color de marca. Se usa en la acción principal de cada pantalla, en el estado activo de la navegación, en el anillo de foco y para señalar "lo tuyo" (tu rango, tu fila). Sobre él el texto va en `on-primary` (navy).

### Secondary
- **Violeta Nexus** (`accent-violet`): solo vive en el halo de fondo del shell (`.bg-radial-nexus`) y en el `accent` de hover de shadcn. No tiene un rol propio en el contenido y no se usa en gradientes nuevos.

### Neutral
- **Navy Nocturno** (`night-navy`): fondo de página (`html`, `body`) y texto sobre cian.
- **Navy Tarjeta** (`card-navy`): tarjetas, popovers y el sidebar.
- **Navy Elevado** (`raised-navy`): inputs, superficies secundarias y elementos muted.
- **Borde de Panel** (`panel-border`): borde por defecto de todos los elementos (`* { border-color }`).
- **Texto Principal** (`text-primary`): títulos y texto de cuerpo.
- **Texto Secundario** (`text-secondary`): descripciones y labels de apoyo.
- **Texto Tenue** (`text-subtle`) y **Texto Apagado** (`text-muted`): metadatos y placeholders. Ojo: `text-muted` sobre `card-navy` no llega a AA en texto pequeño.

### Estado
- **Verde Victoria** (`success`), **Amarillo Aviso** (`warning`) y **Rojo Derrota** (`danger`). Se usan en V/D, en validaciones y en alertas. El rojo es también el `destructive` de shadcn.

### Named Rules
**The Scarce Cyan Rule.** El cian marca solo tres cosas: la acción principal de la pantalla, dónde estás (navegación activa, foco) y lo tuyo (tu rango, tu fila). Si en una pantalla hay más de unos pocos elementos cian, el acento ya dejó de señalar.

**The One Theme Rule.** No hay tema claro ni toggle `.dark`. Todo color se define para el fondo `night-navy`.

## Typography

**Display Font:** Space Grotesk (con system-ui)
**Body Font:** Inter (con system-ui)
**Label/Mono Font:** JetBrains Mono (con ui-monospace), solo para cifras

**Character:** Space Grotesk le da a los títulos un tono técnico y competitivo, Inter mantiene el texto neutro y legible, y JetBrains Mono hace que rangos, puntos y récords se alineen como en un marcador.

### Hierarchy
- **Display** (700, 2.5rem, 1.1): el nombre del jugador o el título principal de una página pública.
- **Headline** (700, 2rem, 1.15): títulos de página.
- **Title** (600, 1.25rem): títulos de sección y de tarjeta. Todos los h1–h4 usan Space Grotesk con tracking −0.02em.
- **Body** (400, 0.875rem, 1.5): texto general de la UI. En los inputs se fuerza un mínimo de 16px para evitar el zoom de iOS.
- **Label** (600, 0.75rem): labels, badges y encabezados de tabla.
- **Stat** (JetBrains Mono 700, tabular): rangos, puntos, récords V/D y porcentajes.

La escala declarada es 12, 14, 16, 20, 24, 32 y 40 px. El rango del hero llega a 72–96px (`text-7xl`/`text-8xl`), porque es el ancla de la pantalla. Nada de UI baja de 12px: sidebar, BottomNav y badges ya usan `text-xs`.

### Named Rules
**The Mono Numbers Rule.** Toda cifra competitiva (rango, puntos, V/D, %, OMW) va en `font-mono-stat` con números tabulares, para que las columnas se alineen.

**The No Kicker Rule.** No hay etiquetas en mayúsculas espaciadas encima de un título ("TU NEXUS TAG", "DETALLE DEL TORNEO"). El título se sostiene solo. Las mayúsculas quedan reservadas para los encabezados de tabla.

## Layout

El shell tiene un sidebar fijo a la izquierda en escritorio (`PanelSidebar`, unos 16rem, sticky; pasa a `position: fixed` mientras Radix bloquea el scroll) y una barra inferior en móvil (`BottomNav` con 5 pestañas que llevan ícono y label). El contenido se centra en contenedores de `max-w-5xl` a `max-w-6xl`. En `xl` aparecen rieles verticales de anuncios a los lados.

El ancho útil del contenido no es el de la ventana: con sesión, el sidebar (16rem) y los rieles de anuncios de `xl` lo dejan en ~600px aun en una pantalla de 1280px. Por eso las composiciones que dependen del ancho del contenido (podio, tabla del ranking, hero del perfil) usan **container queries** de Tailwind (`@container` en la superficie y `@lg:`/`@2xl:`/`@3xl:`/`@4xl:`/`@5xl:` dentro), no los breakpoints `sm`/`lg` de la ventana. Las páginas de contenido (ficha de tienda, resultado de torneo) ponen `@container` en su `<main>` de `max-w-3xl`/`max-w-4xl`. Los breakpoints de ventana quedan para lo que sí depende de ella: la barra inferior móvil, el sidebar y los tamaños de toque.

El ritmo de espaciado sigue la escala de Tailwind de 4px. Lo más común es `gap-2`/`gap-3` dentro de los componentes y `p-4`/`p-6` en las tarjetas. Debajo de 1024px, las tablas con la clase `.table-cards` se convierten en tarjetas apiladas, con el nombre de cada columna tomado de `data-label`. La barra de scroll de la página va oculta; las barras internas son finas (8px).

## Elevation & Depth

El sistema es **plano, con capas tonales**. La profundidad sale de pasar de `night-navy` (página) a `card-navy` (superficie) y a `raised-navy` (controles y segmentados), con un borde `panel-border` de 1px. El contenido no lleva sombras. La única elevación real es la de lo que flota sobre la página: modales, popovers y menús. El halo radial del shell (`.bg-radial-nexus`) se queda como fondo de la app, pero no se repite dentro del contenido.

### Shadow Vocabulary
- **Sombra flotante** (`box-shadow` `shadow-2xl` de Tailwind): solo para modales y popovers, que flotan sobre la página.
- **Sombra base** (`--shadow`, `0 8px 30px rgba(0,0,0,0.45)`): sigue definida; úsala solo en elementos flotantes.

### Named Rules
**The Flat Content Rule.** Nada que esté en el flujo de la página lleva `backdrop-filter`, gradiente, glow o sombra. Si algo necesita destacarse, se hace con tamaño, peso o el acento cian, no con efectos.

**The One Surface Rule.** Una superficie nunca contiene otra superficie con fondo y borde propios. Dentro de una tarjeta se separa con líneas (`divide-border`) y espacio.

### Legado a migrar
`.glass`, `.glow-primary`, `.glow-accent`, `.gradient-*` y el naranja `rgba(232,106,34,…)` (ese sigue en el thumb del scrollbar) siguen en `src/styles.css` y en 54 archivos de otras pantallas (163 líneas con `.glass`, 25 con `backdrop-blur`). No se usan en trabajo nuevo; se eliminan conforme se migre cada pantalla.

## Shapes

Las esquinas son moderadas y consistentes: 8px en los controles (botones, inputs, badges, items de navegación), 12px en las tarjetas y 16px en las superficies grandes y los modales. Los avatares, los anillos de progreso y el thumb del scrollbar son completamente redondos. Todos los bordes son de 1px. No hay formas recortadas ni siluetas propias.

## Components

### Buttons
- **Shape:** esquinas suaves (8px), alto de 36px (32px en `sm`, 40px en `lg`).
- **Primary:** fondo cian, texto navy, `text-sm` 500 y sombra ligera. En hover el cian baja al 90%.
- **Outline / Secondary / Ghost:** el outline lleva borde `raised-navy` sobre el fondo; el secondary es un relleno `raised-navy`; el ghost solo cambia el fondo en hover.
- **Focus:** anillo cian de 1px (shadcn). A nivel global, `:focus-visible` usa un outline cian de 2px con offset de 2px.
- **Acción de fila (repetida en tablas):** outline neutro con borde `panel-border`, texto secundario y hover blanco al 5%. Nunca cian: cuando se repite 10 veces compite con la acción principal. Si en móvil solo muestra el ícono, lleva `aria-label`.
- **Prohibido:** destellos (`shimmer`), escalado de íconos en hover y glows en botones.

### Chips / Badges
- **Style:** esquinas de 8px, `text-xs` 600. Las variantes son cian sólido, navy secundario, rojo y outline.

### Cards / Containers
- **Corner Style:** 12px en secciones y 16px en el hero y los modales.
- **Background:** `card-navy` sólido, borde `panel-border` de 1px, sin sombra (The Flat Content Rule).
- **Contenido interno:** filas separadas con `divide-border`; nunca cajas `bg-black/30` dentro de la tarjeta (The One Surface Rule).
- **Internal Padding:** 16–24px; 24–40px en el hero.

### Stat Row
Para los datos secundarios (Mensual, Torneos, Puntos, Ganados, Tienda favorita) se usa una fila `<dl>`: label de 12px en `text-subtle` sobre la cifra en mono semibold, con un gap de 20px entre pares. No van tiles, íconos ni bordes.

### Inputs / Fields
- **Style:** fondo transparente, borde `raised-navy`, esquinas de 8px y 36px de alto en escritorio y 44px en móvil. El texto es de 16px en móvil para evitar el zoom.
- **Focus:** anillo cian de 1px.

### Navigation
- **Sidebar (escritorio, todos los roles):** superficie `card-navy` sólida con borde derecho `panel-border`, sin glass. El item activo lleva fondo cian al 15% y texto cian (`aria-current`); el inactivo va en `text-secondary` y en hover sube a `text-primary` sobre blanco al 5%. Los grupos se titulan en 12px, minúsculas, `text-subtle`. Marca: trofeo en blanco + "Nexus" y el rol en 12px `text-subtle`. Pie: fila de identidad (ver abajo), colapsar y cerrar sesión como filas discretas (sin borde).
- **Orden del jugador (`player-nav.tsx`):** Mi carrera (Inicio, Mis partidas, Mis stats, Mi perfil) → Circuito (Ranking, Calendario, Playoffs, Tiendas, Meta) → Cuenta (Configuración, Ayuda). Un ícono distinto por destino; el trofeo es solo la marca.
- **Badges de conteo:** cian con texto navy (`primary` / `primary-foreground`), 12px mono. Nunca rojo ni texto blanco sobre cian.
- **BottomNav (móvil):** barra `card-navy` sólida con borde superior, sin gradiente ni blur. 5 pestañas en el mismo orden que el sidebar (Inicio, Partidas, Ranking, Calendario, Menú), ícono + label de 12px. La activa es cian con una píldora `primary/15`, sin glow.

### Rank Display (signature)
El rango del jugador es el elemento propio del sistema (`RankStory` en el dashboard). Es una cifra en mono de 72px en móvil y 96px en escritorio, sin caja ni ícono, con un label de 14px encima ("Ranking de temporada · Temporada X"). Debajo cuenta **qué cambió**: "Subiste/Bajaste N lugares" en `success`/`danger` con una flecha, "desde tu torneo del 5 nov" y "A N pts del #N-1". Son los únicos usos de verde y rojo fuera de V/D. En el top 3 la cifra toma color de podio: oro `yellow-400`, plata `slate-200` y bronce `amber-600`. En las tablas, los rangos fuera del podio van en `text-secondary`, para que el podio resalte. Es el ancla visual del dashboard y del leaderboard.

### Round Strip ("Tu último torneo")
Es el resumen del evento más reciente en el dashboard (`LastTournament`), en una sola superficie plana:
- **Encabezado:** tienda · ciudad · "5 nov" a la izquierda y, a la derecha, el lugar final en mono de 36px con color de podio, más "+12 pts · 3V–1D".
- **Tira de rondas:** una celda por ronda, separadas con `divide-border` y nunca como tarjetas. Cada celda muestra "R1" en mono `text-subtle`, la letra V/D en `success`/`danger` (con `aria-label` "Victoria"/"Derrota"), la miniatura del líder rival (40×56px, borde de 1px), su nombre y "vs geek_tag". En escritorio va en horizontal con scroll si hay más de ~6 rondas; en móvil, en lista vertical.
- **Pie:** "Rival más difícil: XYZ (#4)", más "Editar rondas" (ghost) y "Ver detalle" (outline).
- **Estados:** skeleton con la misma forma; error con "Reintentar"; sin rondas registradas, un texto que invita a registrarlas y el botón "Registrar rondas"; bye como texto "Bye".

### Ranking Band
Es la franja de apertura del ranking público (`/`, `RankingBand`): una sola superficie plana sobre la tabla.
- **Podio:** tres celdas separadas con `divide-border` (en una fila desde 1024px, como lista compacta debajo). Cada una lleva la carta del leader (80×112px en escritorio, 40×56px en móvil), el lugar en mono con color de podio, el tag y los puntos. Sin carta (perfil privado o sin rondas registradas), un círculo con iniciales; nunca una carta de relleno.
- **Pie:** a la izquierda la acción según quién llega y a la derecha una Stat Row (jugadores, tiendas, torneos). Las cifras siguen el periodo y los filtros de la tabla, no la búsqueda.
- **Acción:** visitante, una línea de beneficio y "Crear cuenta" (única acción; las tiendas entran solo por invitación, no hay CTA de registro de tienda). Jugador con sesión, su historia de rango: "#N", "Subiste/Bajaste N lugares" y "A N pts del #N-1". Staff, solo las cifras.
- **Movimiento:** un solo momento. Al llegar los primeros datos, las cartas entran con escalonado y los puntos cuentan hacia arriba (~600ms, ease-out exponencial). No se repite al cambiar filtros y se omite con `prefers-reduced-motion`.
- **Estados:** esqueleto con la misma forma; la banda se oculta si no hay jugadores.

### Filtros y búsqueda
Es el patrón de control para listas largas (ranking, directorio de tiendas); vive en una sección sobre la lista.
- **Búsqueda:** `type="search"` de ancho completo en móvil y tope de `max-w-md` en escritorio, 44px de alto (36px en `sm`), texto de 16px en móvil, ícono de lupa decorativo y `aria-label` que dice qué busca. Es insensible a acentos y mayúsculas, y varias palabras se combinan con AND ("monterrey sur").
- **Grupo de filtro:** botones de 8px de radio dentro de un `role="group"` con `aria-label`; el activo lleva `aria-pressed`, fondo cian al 15%, borde y texto cian; los inactivos van en borde `panel-border` y texto secundario. Hacen scroll horizontal en móvil, no se parten en filas, y el chip activo se lleva al centro (`scrollIntoView`) para que un enlace compartido no llegue con el filtro oculto.
- **Segundo nivel:** al elegir una zona aparece un segundo grupo con su región (la subzona o, si no hay, la ciudad), con "Toda la zona" como opción inicial. Cambiar de zona descarta la región.
- **Conteo:** una línea en mono 14px `text-subtle` con `role="status"`; sin filtros dice "52 tiendas" y con ellos "6 de 52 tiendas".
- **Restablecer:** texto "Restablecer filtros" sin borde, visible solo si hay algo aplicado. Vuelve a la vista completa.
- **Estado:** la URL es la fuente de verdad (`?q=…&zone=…`): se comparte y sobrevive atrás y adelante. Teclear usa `replace` para no ensuciar el historial.
- **Sin resultados:** una superficie plana con la frase "Sin tiendas para “…”", la pista de que las tiendas entran por invitación (nunca un CTA de registro de tienda) y el botón "Restablecer filtros".

### Calendario semanal
El calendario comparte una sola superficie plana y cambia de una rejilla semanal en escritorio a una agenda vertical en móvil.
- **Eventos:** fondo `card-navy`, borde `panel-border` y texto principal, sin rellenos de color por juego. El evento completo es el botón; en la agenda móvil mide al menos 44px de alto. La tienda va en 14px semibold y la hora, la liga y los estados en 12px como mínimo.
- **Estados:** el día actual usa un tinte cian discreto; cancelado usa rojo y texto tachado; asistencia e interés se indican con sus íconos y nombres accesibles. Un horario habitual muestra "Por confirmar" en la entrada y "Horario habitual de la tienda · Por confirmar" en el detalle.
- **Carga y error:** el esqueleto conserva la estructura. Un fallo muestra `InlineError` con "No pudimos cargar los torneos." y "Reintentar"; nunca se presenta como una semana sin eventos.

### Selector de líder y arte
En `/sessions/$sessionId`, la carta del encabezado abre una hoja inferior de hasta 90dvh en móvil y un diálogo centrado de hasta 80vh en escritorio. La superficie es `popover` sólida con borde de 1px y sombra flotante.
- **Dos recorridos:** un segmentado con `role="group"` separa "Elegir arte" y "Otro líder"; el activo lleva `aria-pressed`. Con un líder elegido, el recorrido inicial es el arte.
- **Arte actual:** una vista previa de 92×128px acompaña al nombre y al identificador de la impresión, separados de las versiones por una línea. No se mete otra tarjeta dentro del diálogo.
- **Versiones:** rejilla de tres columnas en móvil y cuatro en escritorio, con cartas de proporción 5:7, nombre e identificador en 12px como mínimo. La seleccionada lleva borde y anillo cian más una marca de confirmación; toda la carta es el área de acción.
- **Otro líder:** búsqueda con label visible, 44px de alto y texto de 16px en móvil. Los estados de carga y vacío explican si se están buscando versiones o líderes.

### Fila o tarjeta con enlace estirado
Para que toda una fila o tarjeta sea un enlace sin meter botones dentro de un `<a>`: el enlace real vive en el nombre (`after:absolute after:inset-0`) y el contenedor es `relative`. Los demás controles (estrella, "Cómo llegar", chip de liga) llevan `relative z-10` y son sus propios enlaces o botones. El foco se dibuja en el `::after` (`focus-visible:after:ring-2`). Así la fila se abre con teclado y con clic medio, y toda su altura es el área de toque aunque el enlace mida 24px.

### Store Card (directorio)
Una tienda en dos líneas dentro de una sola superficie `card-navy` de 12px: nombre en 16px semibold con la estrella de favorita a la derecha (44px de toque en móvil, `warning` cuando está marcada), "ciudad · subzona" en 14px `text-secondary`, y abajo el horario en 12px `text-subtle` con "Cómo llegar" como acción outline neutra, nunca cian. El nombre del juego solo aparece si el circuito tiene más de uno. No lleva íconos sociales ni chips. Mide ~122px en escritorio y ~130px en móvil. Las tiendas se agrupan por zona con un h2 en sentence case y el conteo en mono, en una rejilla `auto-fill` de mínimo 280px.

### Profile Hero (perfil público)
El perfil del jugador es una superficie plana de 16px con dos zonas y un pie:
- **Identidad (izquierda):** avatar de 64–80px (iniciales si no hay imagen), el tag en 24px en móvil y 40px en escritorio (`text-2xl sm:text-4xl`), el nameplate, título e insignia como chips neutros de 8px (nunca con color propio), y una línea "Ciudad · Miembro desde …".
- **Lugar (derecha):** la carta del leader (40×56px en móvil, 80×112px en escritorio) junto al **lugar de temporada del TCG principal** en mono de 60/72/96px con color de podio, un label de 14px encima y "N pts · N torneos · N ganados" debajo. En un contenedor angosto las dos zonas se apilan (`@4xl:`).
- **Pie:** una Stat Row (torneos ganados, win rate, leader principal, últimos 5 lugares con "Lugar" para lectores de pantalla) y el botón de compartir.
- **Otros TCG y logros:** filas dentro de una sola superficie separada por líneas, no tarjetas.
- **Historial:** filas con enlace estirado al torneo, lugar en mono, puntos sin ceros ("+21") y una fila de dos líneas en móvil.
- **Decks y privacidad:** un perfil privado no muestra su leader a nadie. Un jugador con perfil privado tampoco ve el de los demás, salvo el suyo (`useHidesOthersDecks`). Es reciprocidad de interfaz, no un control de seguridad.

### Ficha de tienda (`/stores/$slug`)
Una página con `<main>` y `@container`, y una sola superficie plana (`SECTION`: 12px, borde de 1px, 16px de relleno que sube a 24px en `@2xl`) por bloque, sin tarjetas dentro de tarjetas. Los bloques compartidos viven en `src/components/stores/store-ui.tsx` (`SECTION`, `BTN_OUTLINE`, `FOCUS_RING`, `ChipGroup`, `InlineError`) y los usan también el directorio y el torneo.
- **Hero:** el nombre en `h1` (24px en móvil, 30px en `@2xl`), "zona · subzona" y los juegos en texto secundario, "Cómo llegar" outline y la estrella de favorita (44px de toque, `warning` si está marcada). No hay eyebrow. Debajo, separado por una línea, "Próximo torneo" como `h2` pequeño sobre la fecha en 20px bold, el costo y el formato; una fecha cancelada va en texto `destructive`, sin caja.
- **Pestañas:** `<nav aria-label="Secciones de la tienda">` con dos enlaces de 44px (Perfil, Torneos y Liga), sentence case, activa con borde inferior cian y `aria-current="page"`.
- **Perfil:** dos superficies (Ubicación y contacto; Actividad reciente) en una rejilla de dos columnas desde `@2xl`. Los íconos sociales llevan el nombre de la tienda y "(se abre en otra pestaña)". La actividad son enlaces de 44px separados con `divide-border`.
- **Torneos y Liga:** datos del torneo, próximas fechas, una sección por liga y el historial, todo con filas separadas por líneas. Las posiciones de la liga son una `<table>` con `caption` y `th scope`; en un contenedor angosto Torneos, Ganados y OMW pasan a una segunda línea bajo el jugador. "Cómo leer la tabla" (`<details>`) explica puntos, ganados y OMW %.
- **Estado en la URL:** el juego filtrado y la página del historial son `?game=` y `?page=`; un valor inválido se ignora.
- **Errores:** cada consulta conserva su error y muestra `InlineError` ("No pudimos cargar…" + "Reintentar", `role="alert"`); "sin datos" se reserva para respuestas exitosas vacías. Un slug inexistente tiene su `<main>` y `h1` propios y se distingue de un fallo de red.

### Resultado de torneo (`/tournaments/$id`)
Un `<main class="@container">` de `max-w-3xl` con cuatro superficies planas: encabezado, campeón, posiciones y, solo para visitantes, la invitación a crear cuenta.
- **Navegación:** un solo enlace de 44px con destino fijo, "Volver a {tienda}" (o al ranking si no hay tienda), no el historial del navegador, que con un enlace compartido puede llevar a cualquier parte.
- **Encabezado:** la tienda en `h1`, "juego · zona", ciudad y fecha larga con íconos decorativos. En un torneo futuro, el conteo de interesados, el aviso de RSVP y las acciones; la principal ("Me interesa ir") es la única en cian y pasa a outline con "Quitar" y `aria-pressed` cuando ya está marcada; calendario y compartir son outline. Una Stat Row (Jugadores, Rondas, Invictos) cierra el bloque; "Rondas" son las partidas que jugó el primer lugar.
- **Campeón:** fila con la carta del leader (44×64px; un trofeo neutro si el perfil es privado o el visitante oculta decks) y el tag en 18px bold. Sin gradiente, borde cian ni emoji.
- **Posiciones:** `<table>` con `caption`, `th scope="col"`, lugar, jugador, V/D/E, OMW % y Pts en mono tabular; los lugares 1–3 en bold y el resto en `text-subtle`. En un contenedor angosto OMW % pasa a la segunda línea bajo el jugador. La fila del jugador con sesión lleva `bg-primary/10` y `id="mi-lugar"`, y un botón "Ir a mi lugar (#N)" en el encabezado de la sección hace scroll hasta ella. Las filas son de 44px en móvil (36px en `sm`).
- **Ayuda:** "Cómo leer la tabla" explica Pts, V/D/E, OMW %, rondas e invictos.
- **Estados:** 404 ("Torneo no disponible") y error de carga ("No pudimos cargar el torneo" + Reintentar) son pantallas distintas; solo el mensaje "no encontrado" del servidor produce un 404.

### Identity Row
Va en el pie del sidebar y en la cabecera del drawer móvil. Lleva un círculo de 32px `raised-navy` con las iniciales en 12px bold, el geek tag en 14px medium y, debajo, "#62 · Temporada 2026" en 12px `text-subtle`. Para el staff, esa línea muestra el rol. Es un link al perfil público; colapsada solo quedan las iniciales. Reemplaza el rótulo genérico "Sesión".

### Confirmación destructiva
Cerrar sesión (y cualquier acción que saque al usuario o borre algo) pasa por un `AlertDialog` (`ConfirmLogout`):
- `card-navy`, esquinas de 12px, `max-w-sm` y 16px de margen en móvil.
- Título en pregunta ("¿Cerrar sesión?") y una línea con la consecuencia.
- Botones Cancelar (outline) y la acción (primary), que muestra "Cerrando…" mientras termina.
- Nunca se ejecuta con un solo clic.

### Notificaciones
- La campana anuncia el conteo ("Notificaciones, 6 sin leer").
- El popover es `popover` plano, sin blur; recibe el foco al abrir y lo devuelve a la campana al cerrar.
- Los tiempos van cortos en 12px ("hace 9 h", "hace 3 d", "5 nov").
- No leído = punto cian sin glow y fila con tinte `primary/6`.

## Do's and Don'ts

### Do:
- **Do** reservar el cian (#32d9ff) para la acción principal, el estado activo y lo que es del jugador (The Scarce Cyan Rule).
- **Do** poner toda cifra competitiva en `font-mono-stat` con números tabulares.
- **Do** usar las superficies del sistema (`night-navy` → `card-navy` → `raised-navy`) y el borde `panel-border` antes de inventar otras.
- **Do** mantener las esquinas en la escala: 8px para controles, 12px para tarjetas y 16px para superficies grandes.
- **Do** usar inputs con texto de al menos 16px.
- **Do** usar superficies planas: `card-navy` sólido con borde de 1px, y separar dentro con líneas.
- **Do** mostrar los datos secundarios como fila de texto (Stat Row), no como tiles.
- **Do** tomar `/dashboard`, el ranking público, el perfil público, el directorio y la ficha de tienda y el resultado de torneo como referencia al migrar otra pantalla.
- **Do** reutilizar `SECTION`, `BTN_OUTLINE`, `FOCUS_RING`, `ChipGroup` e `InlineError` de `src/components/stores/store-ui.tsx` antes de escribir otra versión.
- **Do** marcar con `<table>`, `caption` y `th scope` toda lista de datos con columnas, y mover las columnas secundarias a una segunda línea en un contenedor angosto en vez de ocultarlas.
- **Do** conservar el error de cada consulta y ofrecer "Reintentar"; "sin datos" solo para respuestas exitosas vacías.
- **Do** dar a "Volver" un destino fijo cuando la página se comparte por enlace.
- **Do** pedir confirmación (`AlertDialog`) antes de cerrar sesión o de cualquier acción destructiva.
- **Do** usar container queries (`@container` + `@3xl:`) para lo que depende del ancho del contenido, porque el sidebar y los rieles lo reducen.
- **Do** hacer clicable una fila o tarjeta completa con un enlace estirado, y dejar los demás controles encima con `relative z-10`.
- **Do** dar a las listas largas búsqueda, filtro, conteo y "Restablecer filtros", con el estado en la URL.
- **Do** mostrar fechas cortas en `es-MX` ("5 nov", con año solo si no es el actual) y puntos sin ceros sobrantes ("+12", no "+12.00").

### Don't:
- **Don't** usar `.glass`, `backdrop-filter`, gradientes, glows ni destellos en el contenido.
- **Don't** meter una tarjeta dentro de otra tarjeta.
- **Don't** poner etiquetas en mayúsculas espaciadas encima de un título (The No Kicker Rule).
- **Don't** poner íconos decorativos junto a labels de datos (coronas, espadas, dianas).
- **Don't** pintar de cian acciones que se repiten por fila.
- **Don't** introducir un tema claro ni colores pensados para fondos claros.
- **Don't** usar el naranja `rgba(232,106,34)`: es un resto de una paleta anterior.
- **Don't** meter un `<button>` dentro de un `<a>` (ni al revés): es anidamiento interactivo inválido.
- **Don't** usar los breakpoints de la ventana (`sm`/`lg`) para decidir una composición que depende del ancho del contenido.
- **Don't** repetir en cada tarjeta un dato que es igual para toda la lista (por ejemplo el único juego del circuito).
- **Don't** mostrar un CTA de registro de tienda en ninguna superficie pública: las tiendas entran solo por invitación.
- **Don't** usar `design-system/nexus/MASTER.md` (morado, Russo One, Chakra Petch) como referencia; no refleja el código.
- **Don't** convertir un fallo de red en "no existe" o "sin datos": un `catch` que devuelve `[]` esconde el error.
- **Don't** resaltar al campeón con degradado, borde de color o emoji; se destaca con tamaño y peso.
- **Don't** usar `text-[10px]` ni el naranja de una paleta anterior en botones.
- **Don't** bajar labels a menos de 12px ni usar `text-muted` (#72819d) para texto pequeño sobre las tarjetas.

# TCG League / Nexus: cómo funciona la plataforma y sus reglas de negocio

> Última actualización: 2026-11-08.
> Este documento describe lo que el código hace hoy y lo acordado entre los socios.

**Cómo leer las etiquetas**

| Etiqueta | Significado |
|---|---|
| ✅ Implementado | La plataforma ya lo hace |
| 🟡 Acordado, sin construir | Es la regla, pero el sistema todavía no la aplica |
| ❓ Por definir | Falta una decisión de los socios |

Si no hay etiqueta, la regla está implementada.

## Contenido

1. [Qué es la plataforma](#1-qué-es-la-plataforma)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Geografía: zonas, subzonas y regiones](#3-geografía-zonas-subzonas-y-regiones)
4. [Temporadas](#4-temporadas)
5. [Ciclo de vida de un torneo](#5-ciclo-de-vida-de-un-torneo)
6. [Puntos y ranking](#6-puntos-y-ranking)
7. [Playoffs](#7-playoffs)
8. [Calendario](#8-calendario)
9. ["Me interesa ir"](#9-me-interesa-ir)
10. [Ligas internas de tienda](#10-ligas-internas-de-tienda)
11. [Estado de los jugadores y analítica](#11-estado-de-los-jugadores-y-analítica)
12. [Identidad y perfil del jugador](#12-identidad-y-perfil-del-jugador)
13. [Performance tracker y apelaciones](#13-performance-tracker-y-apelaciones)
14. [Meta](#14-meta)
15. [Logros](#15-logros)
16. [Registro de tiendas](#16-registro-de-tiendas)
17. [Sponsors](#17-sponsors)
18. [Seguridad, auditoría y alertas](#18-seguridad-auditoría-y-alertas)
19. [Pendientes y diferencias conocidas](#19-pendientes-y-diferencias-conocidas)

---

## 1. Qué es la plataforma

Circuito competitivo de TCG en México (One Piece, Magic, Pokémon y otros juegos dados de alta). Las tiendas organizan torneos, suben resultados y estos alimentan un ranking, un calendario, el meta y los playoffs de temporada.

**Glosario**

| Término | Significado |
|---|---|
| Circuito Nacional | Torneos oficiales que cuentan para ranking y playoffs |
| Liga interna | Competencia propia de una tienda; no cuenta para el circuito |
| Temporada | Periodo definido por Admin; solo una está activa a la vez |
| Geek Tag | Nombre público del jugador en la plataforma |
| OMW% | Porcentaje de victorias de los rivales; primer desempate |
| Big Three | Monterrey, Ciudad de México y Guadalajara |
| Región Extendida | Todo lo que no es Big Three ni una zona propia |
| Bo1 / Bo3 | Partida única / serie al mejor de 3 |

## 2. Roles y permisos

| Rol | Alcance | Qué hace |
|---|---|---|
| **Jugador** | Sus propios datos | Perfil, stats, tracker, "Me interesa ir", tiendas favoritas, apelaciones |
| **Organizador** | Su tienda | Crea torneos, sube resultados, ligas internas, ficha de tienda, analítica de su tienda, resuelve apelaciones |
| **TCG Manager** | Las tiendas a su cargo | Aprueba o rechaza torneos, calendario y excepciones, analítica de territorio, sube a nombre de una tienda, captura playoffs |
| **Admin** | Toda la plataforma | Tiendas, staff, roles, temporadas, sponsors, publicación, auditoría, captura playoffs |

## 3. Geografía: zonas, subzonas y regiones

- Las **zonas** son un catálogo que administran Admin y Manager. Cada tienda pertenece a una zona.
- Las **subzonas** son opcionales y existen solo si se dan de alta. Una subzona debe pertenecer a la zona de la tienda.
- La **región** de una tienda es su subzona; si su zona no tiene subzonas, es su ciudad.
- Si una zona tiene subzonas, al aprobar una tienda es obligatorio elegir una.
- Renombrar una zona actualiza tiendas y solicitudes automáticamente.

**Estructura de las Big Three**: cada ciudad tiene exactamente 4 subregiones, llamadas `<Ciudad> Norte`, `Sur`, `Este` y `Oeste`. La zona "Zona Centro" se muestra en Playoffs como "Ciudad de México".

## 4. Temporadas

- Las crea y administra Admin, con fecha de inicio y de fin. Solo una está activa.
- Un torneo fuera del rango de la temporada activa no se puede publicar.
- Cada torneo calcula su mes, semestre (enero a junio = 1, julio a diciembre = 2) y año de clasificación a partir de su fecha.
- Los 5 meses de clasificación a playoffs arrancan en la fecha de inicio de la temporada que define Admin en `/admin/seasons`.

## 5. Ciclo de vida de un torneo

```
Organizador sube → Por revisar → Aprobado → Publicado → (Despublicado)
                        ↓
                    Rechazado
```

| Estado | Significado |
|---|---|
| Por revisar | Subido, esperando a Manager o Admin |
| Rechazado | Con motivo documentado |
| Aprobado | Ya revisado, aún no cuenta para el ranking |
| Publicado | Visible y cuenta para el ranking |
| Despublicado | Retirado; se puede volver a aprobar |

**Acciones por rol**

| Estado | Manager | Admin (además) |
|---|---|---|
| Por revisar | Aprobar, rechazar | Cambiar liga |
| Rechazado | Ninguna | Aprobar de todos modos (justificación de al menos 10 caracteres) |
| Aprobado | Quitar aprobación; deshacer si sigue la ventana | Publicar ahora, cambiar liga |
| Publicado | Despublicar | Cambiar liga, recalcular ranking |
| Despublicado | Volver a aprobar | Igual |

**Ventana de corrección**: al aprobar se abren 48 horas para corregir.

**Publicación automática**: corre cada domingo a las 00:00, hora de México. Un torneo se publica si cumple todo:

1. Está aprobado.
2. Hay temporada activa.
3. Su fecha está dentro de la temporada.
4. Terminó su ventana de corrección de 48 horas (solo aplica a la automática; "Publicar ahora" no la espera).
5. Su fecha ya ocurrió.
6. Tiene resultados cargados.

La corrida es segura de repetir: publicar dos veces no duplica nada. Al publicar se recalculan ranking y logros.

**Cancelaciones y sede** (según el FAQ): un torneo cancelado antes de empezar no cuenta; uno cancelado por causas externas después de empezar toma los resultados de la última ronda completada; uno que cambia de sede con aviso previo sí cuenta.

**Jugadores nuevos**: si un resultado trae a alguien sin cuenta, el sistema lo registra automáticamente al aprobar.

## 6. Puntos y ranking

**Puntos por torneo**

```
Puntos = (match points del jugador / match points del 1.er lugar) × 100
```

- Los match points son 3-1-0 (victoria, empate, derrota).
- El ganador obtiene 100. Se guardan con dos decimales.
- Si el 1.er lugar tiene 0 match points, todos reciben 0.

**Tope semanal**: solo cuentan los **2 mejores torneos de cada semana** (lunes a domingo). El ejemplo oficial, con 4 torneos en una semana:

| Torneos | Puntos | Cuenta |
|---|---|---|
| Norte: 100 y 80 | 180 | Ranking de subregión Norte |
| Sur: 100 y 60 | 160 | Ranking de subregión Sur |
| Todos juntos | 100 + 100 = **200** | Ranking general |

Máximo por semana y por tabla: 200 puntos.

**Ranking público**

- Solo incluye torneos **publicados** y que no sean de liga interna.
- Se muestra por mes y por temporada, con filtros de juego, ciudad, zona, región y tienda.
- Orden: puntos y luego OMW%.

Ver la diferencia sobre el tope en [sección 19](#19-pendientes-y-diferencias-conocidas).

## 7. Playoffs

Alcance actual: **One Piece, en las Big Three**. En la Región Extendida cada ciudad participante, con hasta cuatro tiendas, forma una subregión y sus jugadores empiezan en el Playoff de Ciudad. 🟡 Sus vías de clasificación y plazas dependen del reglamento; por ahora sus 4 finalistas se escriben a mano.

### 7.1 Los tres niveles

| Nivel | Jugadores | Formato | Avanzan |
|---|---|---|---|
| **Playoff Subregional** | 16 | 4 grupos todos contra todos (Bo1) y Top 8 eliminatorio (Bo3) | Top 4 (ganadores de cuartos) |
| **Playoff de Ciudad** | 16 (4 subregiones × 4) | Eliminación directa Bo3 | Top 4 (ganadores de cuartos) |
| **Torneo Nacional, en Monterrey** | 16 (3 ciudades × 4 + 4 de Región Extendida) | Eliminación directa Bo3 | Campeón |

### 7.2 Clasificación a los 16 lugares

Cada subregión clasifica durante **5 meses**, y los playoffs se juegan en el mes 6.

- **10 lugares mensuales**: los 2 mejores de cada mes. Quien ya clasificó se salta y su lugar pasa al siguiente mejor de ese mes.
- **6 lugares por puntos**: los mejores del ranking general entre los jugadores de esa subregión que no clasificaron. No compiten contra los ya clasificados.
- **Puntos**: los lugares mensuales usan solo lo ganado en esa subregión; los lugares por puntos usan el ranking general.
- Un mes da lugares cuando ya terminó.
- **Lugar asegurado**: quien clasifica no sale de la lista, salvo por la regla del 60%.
- **Siempre 16** en todos los niveles.

**Regla del 60%**: para jugar, el jugador debe haber asistido al menos a un torneo en el 60% de las semanas de los 5 meses, en cualquier tienda del circuito. Con 22 semanas son 14. Quien ya no pueda alcanzarlo queda fuera.

Si quien pierde el lugar era clasificado mensual, ese lugar **no pasa al siguiente del mes**: se agrega uno más por puntos (por ejemplo, 9 mensuales + 7 por puntos).

De manera realista toda subregión tiene al menos 16 jugadores elegibles, así que los 16 lugares siempre se llenan.

**Un jugador solo clasifica en una subregión**. Si gana lugar en dos el mismo mes, se queda donde tenga más puntos, y el lugar de la otra pasa al siguiente. Si empata: OMW%, asistencia a torneos en la subregión, subregión donde jugó su primer torneo y Legacy Points.

**Durante la temporada** cada jugador se muestra como **Clasificado** o **Provisional**. Los lugares faltantes se llenan con los mejores en puntos, con la leyenda de que el orden puede cambiar.

### 7.3 Playoff Subregional: grupos y Top 8

**Numeración 1 a 16 por orden de clasificación** (no por tabla general):

- #1 y #2: los del mes 1. #3 y #4: los del mes 2. Y así hasta #9 y #10.
- #11 al #16: los clasificados por puntos.

**Grupos**

| Grupo A | Grupo B | Grupo C | Grupo D |
|---|---|---|---|
| 1 | 2 | 3 | 4 |
| 8 | 7 | 6 | 5 |
| 12 | 11 | 10 | 9 |
| 16 | 15 | 14 | 13 |

- Todos contra todos, Bo1. Pasan los 2 mejores de cada grupo.
- **Empate**, en este orden: puntos del ranking general, OMW%, más asistencia y Legacy Points. No importa quién le ganó a quién.

**Top 8, Bo3**: 1.º de A vs 2.º de D, 1.º de B vs 2.º de C, 1.º de C vs 2.º de B, 1.º de D vs 2.º de A. Los **4 ganadores de cuartos** suben al Playoff de Ciudad. No se juegan semifinal ni final del nivel.

### 7.4 Playoff de Ciudad y Torneo Nacional

- Eliminación directa, Bo3, cruces 1 vs 16, 2 vs 15, etc. El 1 y el 2 solo pueden verse en la final.
- **Ranking general**: toda la clasificación, en cualquier tienda, con los 2 mejores resultados de cada semana sin importar la subregión.

**Orden del #1 al #16**, en este orden:

1. Puntos del ranking general.
2. OMW%.
3. Más asistencia.
4. Quien jugó primero un torneo de la temporada.
5. Legacy Points.

"Asistencia" significa número de torneos jugados.

### 7.5 Operación

Admin o Manager, en el panel **Playoffs**:

1. **Congelar grupos** por subregión: solo al cerrar los 5 meses y con 16 clasificados. No se puede deshacer; desde ahí los torneos ya no mueven a nadie.
2. **Capturar partidas**: se elige al ganador. En Bo3 se indica 2-0, 2-1 o Default. Quien no pueda asistir debe avisar a la tienda sede. Antes de congelar entra el siguiente en puntos; después pierde por Default.
3. El **Top 8** se genera al capturar las 24 partidas de grupos.
4. **Crear llave de Playoff de Ciudad** cuando las 4 subregiones de la ciudad terminan.
5. **Crear llave de Torneo Nacional** cuando las 3 ciudades terminan, escribiendo los 4 Geek Tags de Región Extendida.

**Correcciones**

- Volver a tocar al ganador borra el resultado.
- Si cambia un grupo con el Top 8 sin resultados, el Top 8 se rehace.
- No se puede corregir una ronda si la siguiente ya tiene resultado.
- Una vez creado el siguiente nivel, los resultados del anterior ya no cambian.

## 8. Calendario

- **Plantilla semanal**: cada tienda define por juego el día y la hora de sus torneos. El sistema la proyecta a cada semana (lunes a domingo).
- **Excepciones por fecha**: cambian la hora o ponen nombre especial a una sola fecha, sin tocar la regla. Las del circuito las hacen Admin y Manager; las de liga, el organizador.
- **Ligas en el calendario**: una liga puede compartir el horario nacional (solo lo etiqueta con su nombre) o tener su propio horario.
- **Filtros públicos**: juego, zona, región, tienda y tiendas favoritas.
- Los torneos del circuito solo los definen Admin y Manager, no el registro ni la aprobación de una tienda.
- Hay vistas de calendario para público, organizador, Manager y Admin.

## 9. "Me interesa ir"

- **No es una inscripción ni aparta lugar**. La inscripción oficial se hace en la app de Bandai.
- Abre 14 días antes del torneo y cierra a la hora de inicio; sin hora conocida, al terminar el día.
- El staff ve la lista en orden de llegada.

## 10. Ligas internas de tienda

- Son de organizadores y Admin (Manager no), y la tienda debe tenerlas habilitadas.
- Un organizador solo administra las de su tienda.
- Incluyen torneos asignados, premios, horarios propios y excepciones.
- Sus torneos **no cuentan** para ranking nacional ni playoffs. Para que uno nacional cuente en una liga, se agrega manualmente.
- Su tabla suma todos los puntos, sin tope semanal.
- Un torneo de liga interna puede publicarse directo, sin la cola de aprobación.

## 11. Estado de los jugadores y analítica

Clasificación por tienda, siempre a fecha de hoy y medida contra los torneos que la tienda **sí hizo**, para no culpar al jugador por semanas sin torneo.

| Estado | Regla | Color |
|---|---|---|
| **Por recuperar** | Faltó a los últimos 3 torneos de la tienda (se evalúa primero) | Rojo |
| **Frecuente** | Vino a la mitad o más de los torneos de las últimas 8 semanas (56 días), y al menos a 2 | Verde |
| **Nuevo** | Solo ha venido a 1 torneo | Azul |
| **Ocasional** | Ha venido más de una vez, pero menos de la mitad | Amarillo |

En vistas de varias tiendas solo cuentan los torneos de las tiendas donde el jugador ha ido.

**Analítica**

- **Nuevos y recurrentes**: el primer torneo de un jugador cuenta como nuevo; los demás, como recurrente.
- **Bajas**: un jugador se cuenta una sola vez, en la semana en que cumple el umbral de inactividad (45 días por defecto, configurable por tienda).
## 12. Identidad y perfil del jugador

- **Geek Tag**: 3 a 30 caracteres, solo letras, números y guiones bajos. Los tags viejos siguen funcionando.
- **ID de juego** (Bandai ID en One Piece): único por juego; sirve para ligar resultados con la cuenta.
- **Perfil público** por tag y por temporada, con control de privacidad.
- Tarjeta de jugador, títulos, insignias y placas según logros.

## 13. Performance tracker y apelaciones

**Tracker**: el jugador registra sesiones y rondas fuera del sistema oficial. El sistema sugiere el torneo oficial cruzando juego, fecha y sede; el jugador confirma y puede deshacerlo.

No se puede vincular si:

- Ya hay resultados para esa ronda.
- Las victorias superan las del resultado oficial.
- Las rondas superan las del torneo.

**Apelaciones**: el jugador puede apelar una ronda autocompletada proponiendo correcciones, con 24 horas de espera entre apelaciones de la misma ronda. La ronda queda "en apelación" hasta que el organizador la resuelve.

## 14. Meta

Win rates y enfrentamientos por líder, públicos y anónimos, solo con rondas de torneos publicados. Un líder necesita al menos 5 rondas y un enfrentamiento al menos 3.

## 15. Logros

- Catálogo de más de 70 logros, con recompensas de título, insignia y placa.
- Solo se otorgan automáticamente los que se pueden calcular con los datos actuales; se recalculan al publicar.
- 🟡 Los logros de playoffs (Regional Qualifier, Top 8, National Qualifier, campeón MCL) siguen sin otorgarse. Ya existen los datos, falta conectarlos.

## 16. Registro de tiendas

1. Admin o Manager genera un enlace de invitación, válido 7 días.
2. La tienda llena sus datos: dirección, enlace de Google Maps, horario, redes y zona ("No sé" es válido).
3. Admin o Manager aprueba y define zona y subzona.
4. Se crean la tienda y su organizador en un solo paso: nunca queda a medias.

El enlace se puede revocar.

## 17. Sponsors

Administrados por Admin, con anuncios en páginas públicas. Las vistas cuentan máximo 1 por IP y sponsor por hora. Es un conteo aproximado, no apto todavía para facturar.

## 18. Seguridad, auditoría y alertas

- Cada tienda y Manager ve solo lo suyo; Admin ve todo.
- Toda acción sensible queda en la bitácora: quién, qué y cuándo.
- Alertas al canal de staff en Discord: tienda nueva o modificada, torneo subido, cambio de rol y publicación automática, entre otras.
- Límites de intentos por IP contra abuso.
- Los archivos de torneo son privados, con enlaces temporales.

## 19. Pendientes y diferencias conocidas

**Decisiones de los socios**

| # | Tema | Situación hoy |
|---|---|---|
| 1 | Vías y cupos de Región Extendida | Dependen del reglamento; sus 4 finalistas se escriben a mano |
| 2 | Torneo cancelado a mitad | El FAQ dice que cuentan las rondas completas; falta definir cómo se captura |
| 3 | Reglamento de la temporada | Falta el documento; `REGLAMENTO_URL` en `src/routes/faq.tsx` lo publica |
| 4 | Correo de contacto | Falta definirlo |

**Por construir**

| Tema | Detalle |
|---|---|
| Ficha del torneo | Costo y beneficios (tournament packs, booster packs o crédito de tienda) |
| Cancelar torneo antes de empezar | Organizador, Manager y Admin, por causa extraordinaria; no cuenta para la liga |

**Diferencias entre lo acordado y el sistema**

| Tema | Acordado | Sistema hoy |
|---|---|---|
| Tope de 2 por semana en el ranking público | 2 mejores por semana en cada subregión; 2 mejores por semana en el ranking general (ejemplo: 180, 160 y 200) | Por tienda: el ranking de la home puede sumar más que Playoffs |
| Roadmap | Marca wildcards y playoffs como existentes | Playoffs ya existe; wildcards no |
| Logros de playoffs | Deben otorgarse | No conectados |

**Puesta en producción de Playoffs**

- Las tablas ya están en producción y el código en la rama `experiemental`.
- Falta crear las 12 subzonas de Monterrey, Ciudad de México y Guadalajara, y asignar cada tienda real a la suya.
- Definir la temporada real antes de que los lugares empiecen a contar.

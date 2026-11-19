# Tiers para organizadores (Oro, Diamante, Platino): diseño

Fecha: 2026-11-17. Estado: borrador para aprobación. Sin código escrito.

## Intención y por qué

El organizador es el dueño de una tienda y es el cliente de la plataforma. Admin y Manager son roles internos que revisan lo que hacen los organizadores. Se quiere vender la plataforma en tres niveles: cuanto más alto el tier, más y mejores funciones. Oro es la base, Diamante el nivel medio y Platino el máximo.

Distribución esperada de tiendas, con 40 a 60 en total: 80 % Oro, 15 % Diamante, 5 % Platino. Por eso Oro debe sentirse completo: es lo que ve casi todo el mundo.

## Metas

- Cada tienda tiene un tier y accede solo a lo que su tier incluye (tabla abajo, validada por el socio del usuario el 2026-11-17).
- El bloqueo se aplica en el servidor, no solo en pantalla.
- Ninguna tienda actual pierde nada el día que se enciendan los bloqueos.

## No metas

- Cobro y asignación automática del tier: se ve más adelante. Por ahora lo asigna Admin a mano.
- Reporte personalizado "1 dato a petición": se atiende a mano cuando llegue el momento.
- Market share por subzona: se pule en una conversación posterior.
- Colores de las gráficas: se rehacen con la skill Impeccable en su momento.

## Anti-metas (fracaso aunque funcione)

- Que alguien salte un bloqueo llamando directo a una función del servidor.
- Que una cuenta hija abra acceso a datos de otra tienda.
- Que una tienda actual quede sin ligas o sin calendario por activar los tiers.

## Qué existe hoy (hallazgos)

- Un organizador se define por rol `organizer` más `home_store_id` en su perfil (`nexus-auth.middleware.ts`). Una cuenta, una tienda.
- `affiliation_plan` (oro, platino, diamante) existe solo en `store_signup_requests`. No está en `stores` y nada lo usa.
- Páginas de organizador: inicio, torneos, apelaciones, calendario, ligas, estadísticas, jugadores, historial, tienda.
- El organizador solo edita los horarios de sus ligas internas. Los del circuito los fijan Admin y Manager. Sí puede cancelar y restaurar fechas y proponer fichas, que revisa el personal interno.
- Estado de jugador (`player-status.ts`): se calcula "a hoy", con constantes (56 días, 3 faltas, 2 visitas) y la función ya recibe la fecha.
- Lectura de CSV y XLSX en el navegador con `read-excel-file` 9.3.14 (sin la dependencia vulnerable). Aceptar `.xls` es un hueco: la librería solo lee `.xlsx`.
- No hay librería que escriba XLSX ni PDF.
- Existe `store_page_views` (secciones perfil, calendario y liga interna) y `admin.ads`.
- Las temporadas son de 5 meses.

## Tabla de funciones por tier (confirmada)

| Función | Oro | Diamante | Platino |
|---|---|---|---|
| Inicio, Mi tienda, Subir torneos, Historial, Apelaciones | sí | sí | sí |
| Calendario: ver, cancelar y restaurar eventos, proponer fichas | sí | sí | sí |
| Ligas internas | no | no | sí |
| Jugadores: lista y detalle | sí | sí | sí |
| Jugadores: pie charts por mes (asistencia y torneos) | no | sí | sí |
| Estadísticas: vista fija | sí | sí | sí |
| Estadísticas configurables (fechas, tarjetas) | no | sí | sí |
| Estado de jugadores con umbrales propios y comparación con la fecha del filtro | no | no | sí |
| Área graph de asistencia y Marketing | sí | sí | sí |
| Exportar estadísticas (PDF, XLSX, CSV) | no | sí | sí |
| Reporte de fin de temporada (nacional, mes 5) | sí | sí | sí |
| Reporte mensual con market share de zona y subzona | no | sí | sí |
| Reporte semanal | no | no | sí |
| Reporte personalizado (1 dato a petición) | no | no | sí |
| Ver resultados de las 5 preguntas genéricas | sí | sí | sí |
| Encuesta propia | no | 1 en mes 3 y 1 en mes 5 | 1 cada fin de mes |
| Cuentas hijas (solo subir torneos y resolver apelaciones) | no | hasta 3 | ilimitadas |

## Decisiones tomadas

- Un tier por tienda, en una columna de `stores`, con una única función de servidor que exige un tier mínimo. Las cuentas hijas heredan el tier de la tienda.
- Cancelar eventos lo puede hacer todo organizador, en cualquier tier.
- Platino configura el estado de jugador con un filtro propio donde mueve los valores que quiera ver.
- Los datos del reporte de temporada ya existen; el trabajo es presentarlos legibles.
- La baja de una tienda por código de ética la registra Admin a mano, con criterio caso por caso.
- Las encuestas se construyen, como proyecto aparte, junto con lo legal.

## Mis decisiones (no acordadas, cámbialas si no te gustan)

- Las tiendas actuales no pierden nada: se añade la columna, Admin asigna el tier de cada una (las que hoy tienen ligas activas, Platino) y los bloqueos se encienden después.
- Exportar muestra solo lo que la pantalla ya muestra, con geek tag y sin correos ni nombres reales. CSV sin librería y con BOM, XLSX con `write-excel-file`, y PDF con la impresión del navegador.
- Dejar de aceptar `.xls` en la subida de torneos y decirlo claro.
- Las cuentas hijas son un rol nuevo de personal de tienda, no un organizador completo.

## Decisiones añadidas tras la revisión (mías, cámbialas si no te gustan)

- **Encendido de bloqueos.** `stores.tier` con valor por defecto `oro` y una bandera global "tiers activos", apagada al inicio. Mientras esté apagada, la función de servidor deja pasar todo. Admin asigna el tier a cada tienda actual y después se enciende.
- **Tienda nueva.** Al aprobar una solicitud se copia `affiliation_plan` como tier solicitado, pero la tienda empieza en Oro hasta que Admin confirme. Así nadie se declara Platino al registrarse sin pagar.
- **Bajar de tier.** Nunca se borra nada. Las ligas en curso terminan y no se pueden crear nuevas. Las cuentas hijas por encima del límite quedan suspendidas, y se conservan las más antiguas.
- **Admin y Manager** pasan siempre la función de tier; se rigen por su rol.
- **Umbrales de estado de jugador (Platino).** Se guardan por tienda y los comparten todos los usuarios de la tienda.
- **Market share.** Mínimo de tiendas por subzona y qué mostrar cuando no se cumple: se define cuando lo pulamos.
- **Marketing.** Es la vista de visitas al perfil y visualizaciones para la tienda. No depende del consentimiento de los jugadores, así que no bloquea la fase 3.

## Enfoques considerados

1. **Un tier por tienda y un chequeo único en el servidor.** Elegido: es lo más pequeño que cubre la tabla.
2. **Tabla de capacidades por tienda**, con el tier como plantilla. Permite tratos a medida, pero nadie lo pidió.
3. **Tier en el perfil del organizador.** Descartado: las cuentas hijas y los cambios de tienda lo rompen.

## Fases propuestas

1. **Cimientos, sin funciones nuevas.** Columna de tier, chequeo de servidor, tier en la sesión, pantalla de Admin para asignarlo y asignación inicial de las tiendas actuales.
2. **Bloqueos de lo que ya existe.** Ligas y estadísticas configurables.
3. **Estadísticas.** Estado de jugador a fecha pasada, filtro de umbrales de Platino, área graph, pie charts y Marketing.
4. **Exportar.** CSV, luego XLSX y PDF.
5. **Cuentas hijas.** Fase propia con revisión de seguridad.
6. **Reportes.** Fin de temporada, mensual y semanal.
7. **Encuestas.** Proyecto aparte, con lo legal.

## Restricciones y riesgos

- Los bloqueos viven en el servidor; la pantalla solo avisa.
- Toda función que use `home_store_id` debe exigir rol, y las cuentas hijas añaden un rol más a revisar.
- Estado de jugador histórico: calcularlo por fecha para muchos jugadores puede ser costoso.
- Datos personales: exportaciones y encuestas deben declararse en el Aviso de Privacidad, que aún no está publicado. Marketing depende del consentimiento ya definido.
- Market share con subzonas pequeñas puede exponer datos de otra tienda.
- Cambio de tier: falta definir qué pasa con ligas en curso y cuentas hijas sobrantes al bajar de nivel.
- Encuestas: quién responde (mayores de 18), anonimato y mínimo de respuestas por ciudad.

## Pendiente para el constructor

Hora exacta de subida de resultados para las franjas de 24, 48 y 72 horas (sale del registro de auditoría `TOURNAMENT_UPLOADED`), definición de "zona mejor establecida" y "mayor crecimiento", y detalle de cada reporte.

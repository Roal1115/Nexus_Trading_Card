# Rescan de seguridad (solo lectura, sin cambios de código)

## Estado actual
- Escaneo rápido de la base de datos: sin problemas.
- Escaneo profundo: se lanzó de nuevo y está corriendo (5 a 15 min). El avance aparece en la sección Seguridad.

## Hallazgos críticos abiertos (de un escaneo anterior, del 6 de octubre)
Los dos hallazgos de "registro de organizer" (`..._0d280448` y `..._c76d1c81`) apuntan a:
- `src/lib/nexus-organizer-stores.functions.ts`, líneas 53-54 (entrada) y 100-107 (`admin.from("players").insert({ role: "organizer", home_store_id: data.store_id })`).

En el código actual eso ya no existe: las líneas 50-52 ahora son un comentario que dice que solo un admin asigna el rol organizer, y la línea 54 es `updateHomeStore` (protegido con `requireNexusOrganizer`, solo un admin puede cambiar tienda). No queda `signupStoreOrganizer` ni la ruta `/organizer-signup`. Los únicos `role: "organizer"` restantes están en el panel de admin y en la página de documentación. Se ven obsoletos; el escaneo nuevo debería confirmarlo.

## Cuando termine el escaneo profundo
1. Reportar qué sigue abierto, con archivo, función y línea exactos.
2. Si los dos críticos siguen abiertos, mostrar la ubicación exacta que cita el escáner nuevo.
3. Revisar que `/registro-tienda/$token` no aparezca como registro público de organizer.
4. Dejar sin cambios el conteo de visitas de tiendas (ya aceptado) y las dependencias (zod v4 se planea aparte).

Sin cambios de código en ningún paso.

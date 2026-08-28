# Plan: Cambiar el entorno de preview a tu backend Nexus

**Objetivo:** Dejar el preview de Lovable apuntando a tu proyecto Nexus (`tbtyxtigbsljyrwyelqr`), igual que tu `.env` local, para que los filtros y el resto del app funcionen.

## Pasos

1. **Actualizar `.env` con las variables seguras de Nexus**
   - Reemplazar `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` y sus equivalentes `VITE_SUPABASE_*` por los valores de tu instancia Nexus (publishable key y URL).
   - **No incluir `NEXUS_SERVICE_ROLE_KEY` en `.env`**: acabamos de corregir el security finding por exponer service role key en `.env`; volver a ponerla la reintroduciría.

2. **Guardar `NEXUS_SERVICE_ROLE_KEY` como runtime secret**
   - Usar el secret manager de Lovable para registrar el service role key con el nombre `NEXUS_SERVICE_ROLE_KEY`.
   - El código en `src/lib/nexus-admin.server.ts` ya acepta `NEXUS_SERVICE_ROLE_KEY ?? GEEKARENA_SERVICE_ROLE_KEY`, así que las funciones server-only lo encontrarán.

3. **Verificar consistencia del cliente Nexus**
   - `src/integrations/nexus/client.ts` ya está hardcodeado a `tbtyxtigbsljyrwyelqr`, así que coincide con tu `.env` local.
   - Opcional: refactorizarlo para leer de `import.meta.env.VITE_NEXUS_*` en lugar de hardcoded (no bloqueante).

4. **Build + validación**
   - Correr build para descartar errores de variables faltantes.
   - Reprobar la carga de filtros que estaba fallando.

## Nota de riesgo

Este cambio redirige las variables `SUPABASE_*` hacia tu Nexus. Si alguna parte del app o de Lovable Cloud depende de las credenciales de Lovable Cloud propias (por ejemplo, ciertos flujos de auth generados automáticamente), podría romperse. Hasta ahora el proyecto usa `nexus` para datos y auth del app, por lo que el cambio es coherente.

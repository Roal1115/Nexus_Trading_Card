import type { getNexusAdmin } from "./nexus-admin.server";

/**
 * Alertas críticas por torneo (duplicado o jugador en otro torneo el mismo día), para marcarlas en
 * las listas del organizador. Las mismas reglas que el detalle; ver la función SQL
 * tournament_critical_alert_counts. Solo trae los torneos que tienen al menos una.
 *
 * Si la consulta falla la lista sigue funcionando sin marcas (el detalle conserva todas las
 * alertas) y el error queda en el log del servidor.
 */
export async function criticalAlertCounts(
  admin: ReturnType<typeof getNexusAdmin>,
  tournamentIds: string[],
): Promise<Record<string, number>> {
  if (tournamentIds.length === 0) return {};
  const { data, error } = await admin.rpc("tournament_critical_alert_counts", {
    p_ids: tournamentIds,
  });
  if (error) {
    console.error("critical alert counts error:", error.message);
    return {};
  }
  return Object.fromEntries(
    (data ?? [])
      .filter((r) => r.critical_alerts > 0)
      .map((r) => [r.tournament_id, r.critical_alerts]),
  );
}

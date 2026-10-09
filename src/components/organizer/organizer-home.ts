// Lógica pura del panel del organizador (Inicio y pestañas de Torneos). Reparte
// por el estado derivado del lifecycle (deriveState): no hay estados nuevos;
// "rechazado" es DRAFT con rejection_reason, igual que en el resto de la app.
import { deriveState } from "@/lib/tournament-state";

export type OrganizerTab = "pending" | "rejected" | "approved" | "published";

const TAB_OF: Record<string, OrganizerTab | undefined> = {
  review: "pending",
  rejected: "rejected",
  approved: "approved",
  published: "published",
};

/** Torneos de la tienda por pestaña. Los despublicados solo aparecen en "Todos". */
export function tournamentsByTab<T extends { status: string; rejection_reason?: string | null }>(
  rows: T[],
): Record<OrganizerTab, T[]> {
  const out: Record<OrganizerTab, T[]> = { pending: [], rejected: [], approved: [], published: [] };
  for (const r of rows) {
    const tab =
      TAB_OF[deriveState({ status: r.status, rejection_reason: r.rejection_reason ?? null })];
    if (tab) out[tab].push(r);
  }
  return out;
}

export type WeekEntry = {
  report_status: "submitted" | "overdue" | "pending" | "upcoming";
  is_today: boolean;
};

/**
 * Calendario de la semana (getOrganizerCalendar): torneos ya jugados sin
 * resultados (acción: subirlos) y los que faltan por jugarse.
 */
export function weekOutlook<T extends WeekEntry>(entries: T[]): { overdue: T[]; upcoming: T[] } {
  return {
    overdue: entries.filter((e) => e.report_status === "overdue"),
    upcoming: entries.filter(
      (e) => e.report_status === "upcoming" || (e.is_today && e.report_status === "pending"),
    ),
  };
}

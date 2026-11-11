// Fuente única de verdad para el estado de un torneo en la UI, las acciones
// permitidas y las reglas de elegibilidad de publicación. Funciones puras:
// se derivan del estado canónico de la BD (tournaments.status +
// rejection_reason + undo_deadline) y nunca guardan un estado paralelo.
// La hora se inyecta (`now`/`at`) para poder probarlas sin esperar al domingo.

export type TournamentRow = {
  status: string;
  rejection_reason: string | null;
  undo_deadline: string | null;
  tournament_date: string; // YYYY-MM-DD
};

export type Season = { start_date: string; end_date: string } | null;

export type TournamentState =
  "review" | "rejected" | "approved" | "published" | "unpublished" | "unknown";

export function deriveState(
  t: Pick<TournamentRow, "status" | "rejection_reason">,
): TournamentState {
  switch (t.status) {
    case "DRAFT":
      return t.rejection_reason ? "rejected" : "review";
    case "APPROVED":
      return "approved";
    case "PUBLISHED":
      return "published";
    case "UNPUBLISHED":
      return "unpublished";
    default:
      // PENDING_APPROVAL y CANCELLED existen en el enum pero ningún código los escribe.
      return "unknown";
  }
}

export type StateTone = "warning" | "danger" | "info" | "success" | "neutral";

export const STATE_PRESENTATION: Record<TournamentState, { label: string; tone: StateTone }> = {
  review: { label: "Por revisar", tone: "warning" },
  rejected: { label: "Rechazado", tone: "danger" },
  approved: { label: "Aprobado · sin publicar", tone: "info" },
  published: { label: "Publicado", tone: "success" },
  unpublished: { label: "Despublicado", tone: "neutral" },
  unknown: { label: "Estado desconocido", tone: "neutral" },
};

// ---------- Tiempo (America/Mexico_City: UTC−6 todo el año desde 2022) ----------

const MX_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Instante en que empieza (00:00 hora de México) el día YYYY-MM-DD. */
export function mexicoDayStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + MX_OFFSET_MS);
}

/** Próxima corrida programada (domingo 00:00 México) en o después de `from`. */
export function nextScheduledRun(from: Date): Date {
  const mx = new Date(from.getTime() - MX_OFFSET_MS); // reloj de pared MX en campos UTC
  const todayStart =
    Date.UTC(mx.getUTCFullYear(), mx.getUTCMonth(), mx.getUTCDate()) + MX_OFFSET_MS;
  const daysUntilSunday = (7 - mx.getUTCDay()) % 7;
  let run = todayStart + daysUntilSunday * DAY_MS;
  if (run < from.getTime()) run += 7 * DAY_MS;
  return new Date(run);
}

// ---------- Elegibilidad de publicación ----------

export type IneligibleReason =
  | "not_approved"
  | "no_active_season"
  | "out_of_season"
  | "correction_window"
  | "future_date"
  | "no_results";

export const INELIGIBLE_LABELS: Record<IneligibleReason, string> = {
  not_approved: "No está aprobado",
  no_active_season: "No hay temporada activa",
  out_of_season: "Fuera del rango de la temporada activa",
  correction_window: "Ventana de corrección abierta",
  future_date: "La fecha del torneo aún no ocurre",
  no_results: "No tiene resultados cargados",
};

export type EligibilityContext = {
  season: Season;
  resultCount: number;
  at: Date;
  mode: "scheduled" | "manual";
};

/**
 * Reglas R1–R6. Manual y programada comparten todas salvo R4: "Publicar ahora"
 * es la decisión explícita del admin de no esperar la ventana de corrección.
 * R5 (fecha): el día del torneo debe haber empezado ANTES de `at` — a las
 * 00:00 del domingo un torneo del domingo todavía no ocurrió.
 */
export function publicationEligibility(
  t: TournamentRow,
  ctx: EligibilityContext,
): { eligible: boolean; reasons: IneligibleReason[] } {
  const reasons: IneligibleReason[] = [];
  if (t.status !== "APPROVED") reasons.push("not_approved");
  if (!ctx.season) reasons.push("no_active_season");
  else if (t.tournament_date < ctx.season.start_date || t.tournament_date > ctx.season.end_date)
    reasons.push("out_of_season");
  if (
    ctx.mode === "scheduled" &&
    t.undo_deadline &&
    new Date(t.undo_deadline).getTime() > ctx.at.getTime()
  )
    reasons.push("correction_window");
  if (mexicoDayStart(t.tournament_date).getTime() >= ctx.at.getTime()) reasons.push("future_date");
  if (ctx.resultCount < 1) reasons.push("no_results");
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Domingo en que la publicación automática tomará este torneo, o null si nunca
 * lo hará sin intervención (rechazado, fuera de temporada, sin resultados…).
 */
export function scheduledPublicationDate(
  t: TournamentRow,
  ctx: { season: Season; resultCount: number; now: Date },
): Date | null {
  if (t.status !== "APPROVED") return null;
  let run = nextScheduledRun(ctx.now);
  if (t.undo_deadline) {
    const deadline = new Date(t.undo_deadline);
    if (deadline > run) run = nextScheduledRun(deadline);
  }
  const dayStart = mexicoDayStart(t.tournament_date);
  if (dayStart >= run) run = nextScheduledRun(new Date(dayStart.getTime() + 1));
  const { eligible } = publicationEligibility(t, {
    season: ctx.season,
    resultCount: ctx.resultCount,
    at: run,
    mode: "scheduled",
  });
  return eligible ? run : null;
}

// ---------- Acciones permitidas ----------

export type Role = "admin" | "tcg_manager" | "organizer" | "player";

export type TournamentAction =
  | "approve"
  | "reject"
  | "override_approve"
  | "undo_approval"
  | "unapprove"
  | "publish_now"
  | "unpublish"
  | "reapprove"
  | "change_league"
  | "recompute_rankings";

/** Qué puede hacer `role` con el torneo ahora. No evalúa elegibilidad de publicación. */
export function allowedActions(t: TournamentRow, role: Role, now: Date): TournamentAction[] {
  const isAdmin = role === "admin";
  if (!isAdmin && role !== "tcg_manager") return [];
  const actions: TournamentAction[] = [];
  switch (deriveState(t)) {
    case "review":
      actions.push("approve", "reject");
      if (isAdmin) actions.push("change_league");
      break;
    case "rejected":
      if (isAdmin) actions.push("override_approve");
      break;
    case "approved": {
      const windowOpen = !!t.undo_deadline && new Date(t.undo_deadline) > now;
      if (windowOpen) actions.push("undo_approval");
      actions.push("unapprove");
      if (isAdmin) actions.push("publish_now", "change_league");
      break;
    }
    case "published":
      actions.push("unpublish");
      if (isAdmin) actions.push("change_league", "recompute_rankings");
      break;
    case "unpublished":
      actions.push("reapprove");
      break;
    case "unknown":
      break;
  }
  return actions;
}

// ---------- Validación de aprobación (admin y TCG manager) ----------

export const OVERRIDE_MIN_JUSTIFICATION = 10;

/**
 * Error que impide aprobar, o null si se puede. Un torneo rechazado solo lo
 * aprueba un admin con "Aprobar de todos modos" y una justificación.
 */
export function approvalError(
  t: { status: string | null; rejection_reason: string | null },
  role: Role,
  opts: { override?: boolean; justification?: string } = {},
): string | null {
  if (role !== "admin" && role !== "tcg_manager") return "No autorizado";
  if (t.status !== "DRAFT") return "Solo se pueden aprobar torneos por revisar o rechazados";
  if (!t.rejection_reason) return null;
  if (role !== "admin") return "Este torneo fue rechazado. Solo un administrador puede aprobarlo.";
  if (!opts.override) return "Este torneo fue rechazado. Usa «Aprobar de todos modos».";
  if ((opts.justification?.trim().length ?? 0) < OVERRIDE_MIN_JUSTIFICATION)
    return `La justificación debe tener al menos ${OVERRIDE_MIN_JUSTIFICATION} caracteres.`;
  return null;
}

// Lógica pura de Inicio del admin. No define reglas nuevas: la publicación
// usa las de tournament-state.ts y el estado del scheduler sale de los
// eventos SCHEDULED_PUBLICATION_RUN_* que ya escribe runScheduledPublication.
import {
  nextScheduledRun,
  publicationEligibility,
  scheduledPublicationDate,
  type IneligibleReason,
  type Season,
  type TournamentRow,
} from "@/lib/tournament-state";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type PublicationOutlook = {
  /** Domingo en que la publicación automática lo tomará, o null si no lo hará. */
  date: Date | null;
  /** Lo que impide publicarlo sin intervención (sin resultados, fuera de temporada…). */
  blockers: IneligibleReason[];
  /** Fin de la ventana de corrección si sigue abierta. */
  windowOpenUntil: Date | null;
};

/** Mismo cálculo que el detalle del torneo (admin.tournaments.$id.tsx). */
export function publicationOutlook(
  t: TournamentRow,
  season: Season,
  resultCount: number,
  now: Date,
): PublicationOutlook {
  const date = scheduledPublicationDate(t, { season, resultCount, now });
  const blockers = publicationEligibility(t, {
    season,
    resultCount,
    at: nextScheduledRun(now),
    mode: "scheduled",
  }).reasons.filter((r) => r !== "correction_window" && r !== "future_date");
  const deadline = t.undo_deadline ? new Date(t.undo_deadline) : null;
  return { date, blockers, windowOpenUntil: deadline && deadline > now ? deadline : null };
}

export type RunEvent = {
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type SchedulerStatus = {
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  detail?: string;
  lastRunAt: Date | null;
  nextRunAt: Date;
};

const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/**
 * Estado de la publicación programada a partir de la última corrida
 * iniciada/terminada. `runningGraceMs`: cuánto puede tardar una corrida antes
 * de considerarse incompleta (el cron espera 60 s; damos margen).
 */
export function schedulerStatus(
  lastStarted: RunEvent | null,
  lastFinished: RunEvent | null,
  now: Date,
  runningGraceMs = 15 * 60 * 1000,
): SchedulerStatus {
  const nextRunAt = nextScheduledRun(now);
  if (!lastStarted && !lastFinished) {
    return { tone: "info", title: "Sin corridas registradas todavía", lastRunAt: null, nextRunAt };
  }

  const startedAt = lastStarted ? new Date(lastStarted.created_at) : null;
  const finishedAt = lastFinished ? new Date(lastFinished.created_at) : null;
  const startedRun = lastStarted?.metadata?.run_id;
  const finishedRun = lastFinished?.metadata?.run_id;

  // La última corrida iniciada no tiene su evento de fin.
  if (startedAt && startedRun !== finishedRun && (!finishedAt || startedAt > finishedAt)) {
    if (now.getTime() - startedAt.getTime() < runningGraceMs) {
      return {
        tone: "info",
        title: "Publicación programada en curso",
        lastRunAt: startedAt,
        nextRunAt,
      };
    }
    return {
      tone: "danger",
      title: "La última publicación programada no terminó",
      detail: "Se inició pero no registró su fin. Revisa el Registro y los torneos aprobados.",
      lastRunAt: startedAt,
      nextRunAt,
    };
  }

  const lastRunAt = finishedAt ?? startedAt;
  // El domingo anterior debió haber una corrida y no se registró ninguna.
  const previousRun = new Date(nextRunAt.getTime() - WEEK_MS);
  if (
    lastRunAt &&
    lastRunAt < previousRun &&
    now.getTime() - previousRun.getTime() > runningGraceMs
  ) {
    return {
      tone: "danger",
      title: "No se registró la publicación programada del último domingo",
      detail: "El cron no corrió o el endpoint falló antes de iniciar. Revisa pg_cron y la app.",
      lastRunAt,
      nextRunAt,
    };
  }

  const m = lastFinished?.metadata ?? {};
  const published = len(m.published);
  const skipped = len(m.skipped);
  const failures = len(m.recompute_failures) + len(m.achievement_failures);
  const summary = `${published} publicado${published === 1 ? "" : "s"}, ${skipped} omitido${skipped === 1 ? "" : "s"}`;
  if (failures > 0) {
    return {
      tone: "warning",
      title: "La última publicación terminó con problemas",
      detail: `${summary}. ${failures} recálculo${failures === 1 ? "" : "s"} de ranking o logros falló; recalcula desde el detalle del torneo.`,
      lastRunAt,
      nextRunAt,
    };
  }
  return {
    tone: "success",
    title: "Funcionando",
    detail: `Última corrida: ${summary}.`,
    lastRunAt,
    nextRunAt,
  };
}

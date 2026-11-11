// Núcleo de publicación de torneos. Lo usan "Publicar ahora", la publicación
// masiva, la corrida programada del domingo y la recuperación de ranking.
// Sin dependencias de TanStack: se prueba directo con scripts/lifecycle-test.mts.
//
// Idempotencia: la transición a PUBLISHED es un UPDATE condicionado a
// status = 'APPROVED'; solo las filas que realmente cambiaron reciben
// auditoría, recálculo de ranking y logros. Correrlo dos veces publica 0.
import type { getNexusAdmin } from "./nexus-admin.server";
import {
  getActiveSeason,
  logAction,
  recomputeSnapshot,
  SYSTEM_ACTOR,
  tfMonth,
  tournamentAuditLabel,
  type AuditActor,
} from "./nexus-admin-core";
import { publicationEligibility, type IneligibleReason } from "./tournament-state";

type Admin = ReturnType<typeof getNexusAdmin>;

export type PublishTrigger = "manual" | "scheduled";

export type SliceFailure = { tournament_id: string; slice: string; error: string };

export type PublishResult = {
  run_id: string;
  published: string[];
  skipped: Array<{ id: string; reasons: IneligibleReason[] }>;
  recompute_failures: SliceFailure[];
  achievement_failures: Array<{ player_id: string; error: string }>;
  dry_run: boolean;
};

type TournamentRow = {
  id: string;
  status: string;
  rejection_reason: string | null;
  undo_deadline: string | null;
  tournament_date: string;
  store_id: string;
  game_id: string;
  qualifying_year: number;
  qualifying_month: number;
  season_id: string | null;
};

const TOURNAMENT_COLS =
  "id, status, rejection_reason, undo_deadline, tournament_date, store_id, game_id, qualifying_year, qualifying_month, season_id";

async function resultCounts(admin: Admin, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!ids.length) return counts;
  const { data, error } = await admin
    .from("tournament_results")
    .select("tournament_id")
    .in("tournament_id", ids);
  if (error) throw new Error(`No se pudieron leer resultados: ${error.message}`);
  for (const r of data ?? []) counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1);
  return counts;
}

/** Recalcula las rebanadas MONTHLY y SEMESTRAL de un torneo. Un reintento por rebanada. */
async function recomputeSlicesFor(
  admin: Admin,
  t: Pick<TournamentRow, "id" | "store_id" | "game_id" | "qualifying_year" | "qualifying_month">,
  season: { id: string; slug: string } | null,
): Promise<SliceFailure[]> {
  const month = tfMonth(t.qualifying_month, t.qualifying_year);
  const slices: Array<{ name: string; run: () => Promise<void> }> = [
    {
      name: `MONTHLY ${month}`,
      run: () =>
        recomputeSnapshot(admin, t.game_id, t.store_id, "MONTHLY", month, {
          year: t.qualifying_year,
          month: t.qualifying_month,
        }),
    },
  ];
  if (season) {
    slices.push({
      name: `SEMESTRAL ${season.slug}`,
      run: () =>
        recomputeSnapshot(
          admin,
          t.game_id,
          t.store_id,
          "SEMESTRAL",
          season.slug,
          { season_id: season.id },
          season.id,
        ),
    });
  }
  const failures: SliceFailure[] = [];
  for (const slice of slices) {
    try {
      await slice.run();
    } catch {
      try {
        await slice.run();
      } catch (e) {
        failures.push({
          tournament_id: t.id,
          slice: slice.name,
          error: String((e as Error).message ?? e),
        });
      }
    }
  }
  return failures;
}

async function recomputeAchievements(admin: Admin, tournamentIds: string[]) {
  const failures: Array<{ player_id: string; error: string }> = [];
  if (!tournamentIds.length) return failures;
  const { data } = await admin
    .from("tournament_results")
    .select("player_id")
    .in("tournament_id", tournamentIds);
  const players = Array.from(new Set((data ?? []).map((r) => r.player_id)));
  for (const pid of players) {
    const { error } = await admin.rpc("recompute_player_achievements" as any, { p_player_id: pid });
    if (error) failures.push({ player_id: pid, error: error.message });
  }
  return failures;
}

export async function publishTournamentsCore(
  admin: Admin,
  opts: {
    ids: string[];
    actor: AuditActor;
    trigger: PublishTrigger;
    now?: Date;
    dryRun?: boolean;
    runId?: string;
  },
): Promise<PublishResult> {
  const now = opts.now ?? new Date();
  const runId = opts.runId ?? crypto.randomUUID();
  const result: PublishResult = {
    run_id: runId,
    published: [],
    skipped: [],
    recompute_failures: [],
    achievement_failures: [],
    dry_run: !!opts.dryRun,
  };
  if (!opts.ids.length) return result;

  const season = await getActiveSeason(admin);
  const { data: rows, error } = await admin
    .from("tournaments")
    .select(TOURNAMENT_COLS)
    .in("id", opts.ids);
  if (error) throw new Error(`No se pudieron leer los torneos: ${error.message}`);
  const counts = await resultCounts(admin, opts.ids);

  const eligible: TournamentRow[] = [];
  for (const t of (rows ?? []) as TournamentRow[]) {
    const { eligible: ok, reasons } = publicationEligibility(t, {
      season,
      resultCount: counts.get(t.id) ?? 0,
      at: now,
      mode: opts.trigger,
    });
    if (ok) eligible.push(t);
    else result.skipped.push({ id: t.id, reasons });
  }
  if (opts.dryRun || !eligible.length || !season) {
    result.published = opts.dryRun ? eligible.map((t) => t.id) : [];
    return result;
  }

  // Transición atómica y condicionada: una corrida duplicada o un clic
  // simultáneo no puede publicar el mismo torneo dos veces.
  const { data: updated, error: ue } = await admin
    .from("tournaments")
    .update({ status: "PUBLISHED", published_at: now.toISOString(), season_id: season.id })
    .in(
      "id",
      eligible.map((t) => t.id),
    )
    .eq("status", "APPROVED")
    .select("id");
  if (ue) throw new Error(`No se pudo publicar: ${ue.message}`);
  const publishedIds = new Set((updated ?? []).map((r) => r.id));
  const published = eligible.filter((t) => publishedIds.has(t.id));
  result.published = published.map((t) => t.id);

  // La publicación ya ocurrió: se audita antes del recálculo para que quede
  // registrada aunque el recálculo falle después.
  for (const t of published) {
    await logAction(
      admin,
      opts.actor,
      "TOURNAMENT_PUBLISHED",
      "tournament",
      t.id,
      await tournamentAuditLabel(admin, t.id),
      {
        trigger: opts.trigger,
        run_id: runId,
        season_id: season.id,
      },
    );
  }

  for (const t of published) {
    result.recompute_failures.push(...(await recomputeSlicesFor(admin, t, season)));
  }
  result.achievement_failures = await recomputeAchievements(admin, result.published);
  return result;
}

/**
 * Corrida del domingo 00:00 (America/Mexico_City). Evalúa todos los torneos
 * APPROVED con las reglas programadas (R1–R6) y registra inicio y fin.
 */
export async function runScheduledPublication(
  admin: Admin,
  opts: { now?: Date; dryRun?: boolean } = {},
): Promise<PublishResult> {
  const now = opts.now ?? new Date();
  const runId = crypto.randomUUID();
  const { data, error } = await admin.from("tournaments").select("id").eq("status", "APPROVED");
  if (error) throw new Error(`No se pudieron leer los torneos aprobados: ${error.message}`);
  const ids = (data ?? []).map((r) => r.id);

  if (!opts.dryRun) {
    await logAction(
      admin,
      SYSTEM_ACTOR,
      "SCHEDULED_PUBLICATION_RUN_STARTED",
      "system",
      null,
      "Publicación programada",
      {
        run_id: runId,
        at: now.toISOString(),
        candidates: ids,
      },
    );
  }
  const result = await publishTournamentsCore(admin, {
    ids,
    actor: SYSTEM_ACTOR,
    trigger: "scheduled",
    now,
    dryRun: opts.dryRun,
    runId,
  });
  if (!opts.dryRun) {
    await logAction(
      admin,
      SYSTEM_ACTOR,
      "SCHEDULED_PUBLICATION_RUN_FINISHED",
      "system",
      null,
      "Publicación programada",
      {
        run_id: runId,
        published: result.published,
        skipped: result.skipped,
        recompute_failures: result.recompute_failures,
        achievement_failures: result.achievement_failures,
      } as any,
    );
  }
  return result;
}

/**
 * Recuperación tras una publicación parcial: recalcula las rebanadas de
 * ranking del torneo y los logros de sus jugadores. Idempotente.
 */
export async function recomputeTournamentRankingsCore(
  admin: Admin,
  tournamentId: string,
  actor: AuditActor,
) {
  const { data: t, error } = await admin
    .from("tournaments")
    .select(TOURNAMENT_COLS)
    .eq("id", tournamentId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el torneo: ${error.message}`);
  if (!t) throw new Error("Torneo no encontrado");
  const row = t as TournamentRow;
  let season: { id: string; slug: string } | null = null;
  if (row.season_id) {
    const { data: s } = await admin
      .from("seasons")
      .select("id, slug")
      .eq("id", row.season_id)
      .maybeSingle();
    season = (s as { id: string; slug: string } | null) ?? null;
  }
  const recompute_failures = await recomputeSlicesFor(admin, row, season);
  const achievement_failures =
    row.status === "PUBLISHED" ? await recomputeAchievements(admin, [row.id]) : [];
  await logAction(
    admin,
    actor,
    "LEADERBOARD_RECOMPUTED",
    "tournament",
    row.id,
    await tournamentAuditLabel(admin, row.id),
    {
      recompute_failures,
      achievement_failures,
    } as any,
  );
  return { recompute_failures, achievement_failures };
}

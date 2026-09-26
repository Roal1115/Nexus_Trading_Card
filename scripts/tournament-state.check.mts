// Run: node --experimental-strip-types scripts/tournament-state.check.mts
import assert from "node:assert/strict";
import {
  allowedActions,
  deriveState,
  nextScheduledRun,
  publicationEligibility,
  scheduledPublicationDate,
  type TournamentRow,
} from "../src/lib/tournament-state.ts";

// 2026-09-21 es lunes → domingo 2026-09-27. México = UTC−6.
const mx = (local: string) => new Date(`${local}-06:00`);
const SUN_27 = mx("2026-09-27T00:00:00");
const SUN_OCT_4 = mx("2026-10-04T00:00:00");
const season = { start_date: "2026-01-01", end_date: "2026-12-31" };

const t = (over: Partial<TournamentRow>): TournamentRow => ({
  status: "APPROVED",
  rejection_reason: null,
  undo_deadline: null,
  tournament_date: "2026-09-22",
  ...over,
});
const plus48h = (d: Date) => new Date(d.getTime() + 48 * 3600 * 1000).toISOString();

// deriveState
assert.equal(deriveState({ status: "DRAFT", rejection_reason: null }), "review");
assert.equal(deriveState({ status: "DRAFT", rejection_reason: "x" }), "rejected");
assert.equal(deriveState({ status: "APPROVED", rejection_reason: null }), "approved");
assert.equal(deriveState({ status: "PUBLISHED", rejection_reason: null }), "published");
assert.equal(deriveState({ status: "UNPUBLISHED", rejection_reason: null }), "unpublished");
assert.equal(deriveState({ status: "CANCELLED", rejection_reason: null }), "unknown");

// nextScheduledRun: domingo 00:00 MX = 06:00 UTC
assert.equal(SUN_27.toISOString(), "2026-09-27T06:00:00.000Z");
assert.equal(nextScheduledRun(mx("2026-09-24T12:00:00")).getTime(), SUN_27.getTime());
assert.equal(nextScheduledRun(SUN_27).getTime(), SUN_27.getTime(), "exactamente la hora de corrida");
assert.equal(nextScheduledRun(mx("2026-09-26T23:59:59")).getTime(), SUN_27.getTime());
assert.equal(nextScheduledRun(mx("2026-09-27T00:00:01")).getTime(), SUN_OCT_4.getTime());

// Corte del viernes 00:00 (ventana de 48h)
const approvedThu = mx("2026-09-24T10:00:00");
const approvedFriMidnight = mx("2026-09-25T00:00:00");
const approvedFriMorning = mx("2026-09-25T09:00:00");
const sched = (row: TournamentRow, now: Date) =>
  scheduledPublicationDate(row, { season, resultCount: 10, now })?.getTime() ?? null;
assert.equal(sched(t({ undo_deadline: plus48h(approvedThu) }), approvedThu), SUN_27.getTime());
assert.equal(sched(t({ undo_deadline: plus48h(approvedFriMidnight) }), approvedFriMidnight), SUN_27.getTime());
assert.equal(sched(t({ undo_deadline: plus48h(approvedFriMorning) }), approvedFriMorning), SUN_OCT_4.getTime());

// R4 solo aplica a la corrida programada
const inWindow = t({ undo_deadline: plus48h(approvedFriMorning) });
assert.deepEqual(
  publicationEligibility(inWindow, { season, resultCount: 1, at: SUN_27, mode: "scheduled" }).reasons,
  ["correction_window"],
);
assert.ok(publicationEligibility(inWindow, { season, resultCount: 1, at: approvedFriMorning, mode: "manual" }).eligible);

// R5 fecha futura: misma regla manual y programada
const sundayTournament = t({ tournament_date: "2026-09-27" });
assert.deepEqual(
  publicationEligibility(sundayTournament, { season, resultCount: 1, at: SUN_27, mode: "scheduled" }).reasons,
  ["future_date"],
);
assert.equal(sched(sundayTournament, mx("2026-09-25T12:00:00")), SUN_OCT_4.getTime());
assert.deepEqual(
  publicationEligibility(t({ tournament_date: "2026-09-26" }), { season, resultCount: 1, at: mx("2026-09-25T20:00:00"), mode: "manual" }).reasons,
  ["future_date"],
);
assert.ok(
  publicationEligibility(t({ tournament_date: "2026-09-24" }), { season, resultCount: 1, at: mx("2026-09-24T23:00:00"), mode: "manual" }).eligible,
  "el mismo día del torneo sí se puede publicar a mano",
);

// R1, R2, R3, R6
const ctx = { resultCount: 1, at: SUN_27, mode: "scheduled" as const };
assert.deepEqual(publicationEligibility(t({ status: "DRAFT" }), { ...ctx, season }).reasons, ["not_approved"]);
assert.deepEqual(publicationEligibility(t({}), { ...ctx, season: null }).reasons, ["no_active_season"]);
assert.deepEqual(publicationEligibility(t({ tournament_date: "2025-12-31" }), { ...ctx, season }).reasons, ["out_of_season"]);
assert.deepEqual(publicationEligibility(t({}), { ...ctx, season, resultCount: 0 }).reasons, ["no_results"]);
assert.equal(sched(t({ tournament_date: "2025-12-31" }), approvedThu), null);
assert.equal(sched(t({ status: "DRAFT", rejection_reason: "x" }), approvedThu), null);

// allowedActions: override y publicar son solo admin
const now = approvedThu;
const rejected = t({ status: "DRAFT", rejection_reason: "Datos incorrectos" });
assert.deepEqual(allowedActions(rejected, "admin", now), ["override_approve"]);
assert.deepEqual(allowedActions(rejected, "tcg_manager", now), []);
const approvedOpen = t({ undo_deadline: plus48h(now) });
assert.deepEqual(allowedActions(approvedOpen, "admin", now), ["undo_approval", "unapprove", "publish_now", "change_league"]);
assert.deepEqual(allowedActions(approvedOpen, "tcg_manager", now), ["undo_approval", "unapprove"]);
assert.deepEqual(allowedActions(t({ undo_deadline: plus48h(new Date(now.getTime() - 72 * 3600e3)) }), "admin", now), ["unapprove", "publish_now", "change_league"]);
assert.deepEqual(allowedActions(t({ status: "PUBLISHED" }), "tcg_manager", now), ["unpublish"]);
assert.deepEqual(allowedActions(t({ status: "PUBLISHED" }), "admin", now), ["unpublish", "change_league", "recompute_rankings"]);
assert.deepEqual(allowedActions(t({ status: "UNPUBLISHED" }), "tcg_manager", now), ["reapprove"]);
assert.deepEqual(allowedActions(t({ status: "DRAFT" }), "organizer", now), []);

console.log("tournament-state: all checks passed");

// approvalError: override solo admin, con justificación ≥ 10
import { approvalError } from "../src/lib/tournament-state.ts";
const review = { status: "DRAFT", rejection_reason: null };
const rej = { status: "DRAFT", rejection_reason: "CSV incompleto" };
assert.equal(approvalError(review, "tcg_manager"), null);
assert.equal(approvalError(review, "admin"), null);
assert.match(approvalError(rej, "tcg_manager")!, /Solo un administrador/);
assert.match(approvalError(rej, "admin")!, /Aprobar de todos modos/);
assert.match(approvalError(rej, "admin", { override: true, justification: "corto" })!, /10 caracteres/);
assert.match(approvalError(rej, "admin", { override: true, justification: "         x" })!, /10 caracteres/, "espacios no cuentan");
assert.equal(approvalError(rej, "admin", { override: true, justification: "Organizador corrigió el CSV" }), null);
assert.match(approvalError({ status: "APPROVED", rejection_reason: null }, "admin")!, /por revisar/);
assert.equal(approvalError(review, "organizer"), "No autorizado");
console.log("approvalError: all checks passed");

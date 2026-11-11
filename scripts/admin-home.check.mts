// Run: npx tsx scripts/admin-home.check.mts
import assert from "node:assert/strict";
import { publicationOutlook, schedulerStatus } from "../src/components/admin/admin-home.ts";

// México = UTC−6. 2026-10-08 es jueves → próxima corrida domingo 2026-10-11 00:00.
const mx = (local: string) => new Date(`${local}-06:00`);
const THU = mx("2026-10-08T12:00:00");
const SUN_11 = mx("2026-10-11T00:00:00");
const season = { start_date: "2026-01-01", end_date: "2026-12-31" };
const approved = {
  status: "APPROVED",
  rejection_reason: null,
  undo_deadline: mx("2026-10-08T20:00:00").toISOString(),
  tournament_date: "2026-10-03",
};

// --- Próximamente: reutiliza las reglas del lifecycle ---
let o = publicationOutlook(approved, season, 8, THU);
assert.equal(o.date?.getTime(), SUN_11.getTime(), "se publica el domingo 11");
assert.deepEqual(o.blockers, []);
assert.ok(o.windowOpenUntil, "ventana de corrección abierta");

o = publicationOutlook(approved, season, 0, THU);
assert.equal(o.date, null);
assert.deepEqual(o.blockers, ["no_results"]);

o = publicationOutlook({ ...approved, tournament_date: "2025-12-20" }, season, 8, THU);
assert.deepEqual(o.blockers, ["out_of_season"]);

o = publicationOutlook(approved, null, 8, THU);
assert.deepEqual(o.blockers, ["no_active_season"]);

// --- Sistema: estado del scheduler ---
const ev = (at: Date, metadata: Record<string, unknown>) => ({
  created_at: at.toISOString(),
  metadata,
});
const SUN_4 = mx("2026-10-04T00:00:00");

assert.equal(schedulerStatus(null, null, THU).tone, "info", "sin corridas");
assert.equal(schedulerStatus(null, null, THU).nextRunAt.getTime(), SUN_11.getTime());

const ok = schedulerStatus(
  ev(SUN_4, { run_id: "a" }),
  ev(new Date(SUN_4.getTime() + 5000), {
    run_id: "a",
    published: ["x", "y"],
    skipped: [{}],
    recompute_failures: [],
    achievement_failures: [],
  }),
  THU,
);
assert.equal(ok.tone, "success");
assert.match(ok.detail!, /2 publicados, 1 omitido/);

const partial = schedulerStatus(
  ev(SUN_4, { run_id: "a" }),
  ev(SUN_4, {
    run_id: "a",
    published: ["x"],
    skipped: [],
    recompute_failures: [{}],
    achievement_failures: [],
  }),
  THU,
);
assert.equal(partial.tone, "warning", "fallos de recálculo");

const unfinished = schedulerStatus(
  ev(SUN_4, { run_id: "b" }),
  ev(mx("2026-09-27T00:00:05"), { run_id: "a" }),
  THU,
);
assert.equal(unfinished.tone, "danger", "iniciada sin fin");

const running = schedulerStatus(
  ev(SUN_11, { run_id: "c" }),
  null,
  new Date(SUN_11.getTime() + 60_000),
);
assert.equal(running.tone, "info", "en curso dentro del margen");

const missed = schedulerStatus(
  ev(mx("2026-09-27T00:00:00"), { run_id: "a" }),
  ev(mx("2026-09-27T00:00:05"), { run_id: "a", published: [], skipped: [] }),
  THU,
);
assert.equal(missed.tone, "danger", "faltó la corrida del domingo 4");

console.log("admin-home: all checks passed");

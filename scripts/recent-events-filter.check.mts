// Filtros de Torneos recientes: npx tsx scripts/recent-events-filter.check.mts
import assert from "node:assert/strict";
import { filterRecentEvents, type RecentFilters } from "../src/lib/recent-events-filter.ts";

const ev = (id: string, store: string, date: string, placement: number | null, wins: number, losses: number) => ({
  id, game_id: "g1", store, date, placement, wins, losses,
});
const events = [
  ev("a", "A", "2026-11-10", 1, 3, 1),
  ev("b", "B", "2026-10-05", 3, 1, 3),
  ev("c", "A", "2026-09-20", 5, 2, 2),
  ev("d", "B", "2026-11-01", null, 0, 0),
];
const none: RecentFilters = { tcg: null, store: null, range: "all", result: "all" };
const ctx = { today: "2026-11-18", seasonStart: "2026-10-01" };
const ids = (f: Partial<RecentFilters>, c = ctx) =>
  filterRecentEvents(events, { ...none, ...f }, c).map((e) => e.id).join("");

assert.equal(ids({}), "abcd");
assert.equal(ids({ tcg: "g2" }), "");
assert.equal(ids({ store: "A" }), "ac");
assert.equal(ids({ range: "month" }), "ad");
assert.equal(ids({ range: "season" }), "abd");
assert.equal(ids({ range: "season" }, { ...ctx, seasonStart: null }), "abcd");
assert.equal(ids({ result: "top4" }), "ab");
assert.equal(ids({ result: "positive" }), "a");
assert.equal(ids({ store: "A", result: "top4" }), "a");
console.log("recent-events-filter ok");

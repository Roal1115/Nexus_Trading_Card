// Reglas puras de rondas: npx tsx scripts/round-rules.check.mts
import assert from "node:assert/strict";
import { maxWinsFor, roundLeadersProblem, sessionLinkProblem } from "../src/lib/round-rules.ts";

const round = (round_number: number, won_match: boolean | null) => ({ round_number, won_match });

assert.equal(maxWinsFor(9), 3);
assert.equal(maxWinsFor(7), 2);
assert.equal(maxWinsFor(null), 0);

const base = { matchPoints: 6, maxRounds: 3, takenRounds: [] as ReturnType<typeof round>[] };
assert.equal(
  sessionLinkProblem({ ...base, rounds: [round(1, true), round(2, true), round(3, false)] }),
  null,
);
assert.match(
  sessionLinkProblem({ ...base, rounds: [round(1, true), round(2, true), round(3, true)] }) ?? "",
  /3 victorias/,
);
assert.match(
  sessionLinkProblem({ ...base, rounds: [1, 2, 3, 4].map((n) => round(n, false)) }) ?? "",
  /ronda 4/,
);
assert.match(
  sessionLinkProblem({ ...base, rounds: [round(2, false)], takenRounds: [round(2, true)] }) ?? "",
  /ronda 2 /,
);
// Los límites suman lo ya registrado: 2 victorias en sesión + 1 existente exceden 2.
assert.match(
  sessionLinkProblem({
    ...base,
    rounds: [round(2, true), round(3, true)],
    takenRounds: [round(1, true)],
  }) ?? "",
  /3 victorias/,
);
// Sin rondas conocidas (torneo sin match points) no se bloquea por conteo.
assert.equal(
  sessionLinkProblem({ ...base, maxRounds: 0, rounds: [1, 2, 3, 4].map((n) => round(n, false)) }),
  null,
);


const L = "00000000-0000-0000-0000-000000000001";
assert.equal(roundLeadersProblem({ is_bye: true, player_leader_id: null, opponent_leader_id: null }), null);
assert.equal(roundLeadersProblem({ is_bye: false, player_leader_id: L, opponent_leader_id: L }), null);
assert.equal(roundLeadersProblem({ is_bye: false, player_leader_id: null, opponent_leader_id: L }), "Selecciona tu leader para guardar la ronda");
assert.equal(roundLeadersProblem({ is_bye: false, player_leader_id: L, opponent_leader_id: undefined }), "Selecciona el leader del oponente para guardar la ronda");
assert.equal(roundLeadersProblem({ is_bye: false, player_leader_id: null, opponent_leader_id: null }), "Selecciona tu leader para guardar la ronda");
import { editWindow, EDIT_WINDOW_DAYS } from "../src/lib/round-rules.ts";
const t0 = "2026-11-01T18:00:00.000Z";
const at = (ms: number) => new Date(Date.parse(t0) + ms);
const DAY = 86_400_000;
assert.equal(EDIT_WINDOW_DAYS, 7);
assert.deepEqual(editWindow({ approved_at: null, published_at: null }, new Date()), { open: true, daysLeft: null });
assert.deepEqual(editWindow({ approved_at: t0, published_at: null }, at(0)), { open: true, daysLeft: 7 });
assert.equal(editWindow({ approved_at: t0, published_at: null }, at(7 * DAY - 1)).open, true);
assert.equal(editWindow({ approved_at: t0, published_at: null }, at(7 * DAY)).open, false);
assert.equal(editWindow({ approved_at: null, published_at: t0 }, at(8 * DAY)).open, false);
assert.equal(editWindow({ approved_at: t0, published_at: null }, at(6.5 * DAY)).daysLeft, 1);
assert.deepEqual(editWindow({ approved_at: t0, published_at: "2026-10-01T00:00:00.000Z" }, at(8 * DAY)), { open: false, daysLeft: 0 });
console.log("round-rules: ok");

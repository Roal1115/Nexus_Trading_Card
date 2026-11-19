// Reglas puras de circuito/ligas: npx tsx scripts/league-assignment.check.mts
import assert from "node:assert/strict";
import { assignLeagues, nextPrimaryLeague } from "../src/lib/league-assignment.ts";

const A = "liga-a";
const B = "liga-b";

// assignLeagues
assert.deepEqual(assignLeagues({ counts_for_circuit: true, league_ids: [A, B] }), {
  league_id: null,
  link_ids: [A, B],
});
assert.deepEqual(assignLeagues({ counts_for_circuit: true, league_ids: [] }), {
  league_id: null,
  link_ids: [],
});
assert.deepEqual(assignLeagues({ counts_for_circuit: false, league_ids: [A, B] }), {
  league_id: A,
  link_ids: [A, B],
});
assert.deepEqual(assignLeagues({ counts_for_circuit: false, league_ids: [] }), {
  error: "Elige el Circuito Nacional o al menos una liga",
});
assert.deepEqual(assignLeagues({ counts_for_circuit: false, league_ids: [B, A, B] }), {
  league_id: B,
  link_ids: [B, A],
});
assert.deepEqual(assignLeagues({ counts_for_circuit: true, league_ids: [A, A] }), {
  league_id: null,
  link_ids: [A],
});

// nextPrimaryLeague
assert.deepEqual(nextPrimaryLeague(null, []), { league_id: null });
assert.deepEqual(nextPrimaryLeague(null, [A]), { league_id: null });
assert.deepEqual(nextPrimaryLeague(A, [B, A]), { league_id: A });
assert.deepEqual(nextPrimaryLeague(A, [B]), { league_id: B });
assert.deepEqual(nextPrimaryLeague(A, []), { blocked: true });

console.log("league-assignment: ok");

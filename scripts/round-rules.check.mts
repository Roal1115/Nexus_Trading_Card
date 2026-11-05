// Reglas puras de rondas: npx tsx scripts/round-rules.check.mts
import assert from "node:assert/strict";
import { maxWinsFor, sessionLinkProblem } from "../src/lib/round-rules.ts";

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

console.log("round-rules: ok");

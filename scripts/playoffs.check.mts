// Clasificación a playoffs: npx tsx scripts/playoffs.check.mts
import assert from "node:assert/strict";
import {
  canMeetAttendance,
  classify,
  compareSeeding,
  firstRound,
  groupSchedule,
  groupStandings,
  lastRound,
  parentRegion,
  qualifyingMonths,
  quarterFinals,
  requiredWeeks,
  standingsOf,
  weeksOfMonths,
  type PlayoffResult,
} from "../src/lib/playoffs.ts";

const r = (
  playerId: string,
  subregion: string,
  date: string,
  points: number,
  omw = 50,
): PlayoffResult => ({ playerId, subregion, date, month: date.slice(0, 7), points, omw });

assert.deepEqual(qualifyingMonths("2026-10"), [
  "2026-10",
  "2026-11",
  "2026-12",
  "2027-01",
  "2027-02",
]);
assert.equal(requiredWeeks(22), 14);

// Solo cuentan los 2 mejores torneos de la semana.
const capped = standingsOf([
  r("a", "Sur", "2026-08-03", 10),
  r("a", "Sur", "2026-08-04", 8),
  r("a", "Sur", "2026-08-05", 6),
]);
assert.equal(capped[0].points, 18);
assert.equal(capped[0].played, 3);

// Quien ganó el mes 1 no vuelve a ocupar lugar: pasa el siguiente del mes 2.
// Los lugares por puntos no compiten con los ya clasificados.
const base = {
  subregions: ["Sur"],
  closedMonths: ["2026-08", "2026-09"],
  seasonFinished: false,
  ineligible: new Set<string>(),
};
const list = classify({
  ...base,
  results: [
    r("a", "Sur", "2026-08-03", 30),
    r("b", "Sur", "2026-08-03", 20),
    r("c", "Sur", "2026-08-03", 10),
    r("a", "Sur", "2026-09-07", 30),
    r("c", "Sur", "2026-09-07", 12),
    r("d", "Sur", "2026-09-07", 11),
    r("e", "Sur", "2026-09-07", 5),
  ],
}).get("Sur")!;
assert.deepEqual(
  list.map((q) => [q.seed, q.playerId, q.source, q.confirmed]),
  [
    [1, "a", "month", true],
    [2, "b", "month", true],
    [3, "c", "month", true],
    [4, "d", "month", true],
    [5, "e", "points", false],
  ],
);

// En dos subregiones el mismo mes: se queda en la de más puntos y el lugar
// de la otra pasa al siguiente.
const two = classify({
  ...base,
  subregions: ["Norte", "Sur"],
  closedMonths: ["2026-08"],
  results: [
    r("x", "Sur", "2026-08-03", 30),
    r("x", "Norte", "2026-08-03", 20),
    r("n1", "Norte", "2026-08-03", 15),
    r("n2", "Norte", "2026-08-03", 9),
    r("n3", "Norte", "2026-08-03", 1),
  ],
});
assert.deepEqual(
  two.get("Sur")!.map((q) => q.playerId),
  ["x"],
);
assert.deepEqual(
  two.get("Norte")!.map((q) => q.playerId),
  ["n1", "n2", "n3"],
);

// Empate exacto de puntos en dos subregiones: decide el OMW.
const tie = classify({
  ...base,
  subregions: ["Norte", "Sur"],
  closedMonths: ["2026-08"],
  results: [r("x", "Sur", "2026-08-03", 20, 40), r("x", "Norte", "2026-08-03", 20, 60)],
});
assert.equal(tie.get("Norte")!.length, 1);
assert.equal(tie.get("Sur")!.length, 0);

// Nunca más de 16, y sin el 60% no ocupa lugar.
const many = Array.from({ length: 20 }, (_, i) => r(`p${i}`, "Sur", "2026-08-03", 100 - i));
const full = classify({ ...base, closedMonths: [], results: many }).get("Sur")!;
assert.equal(full.length, 16);
const out = classify({
  ...base,
  closedMonths: [],
  results: many,
  ineligible: new Set(["p0"]),
}).get("Sur")!;
assert.equal(out[0].playerId, "p1");

// 60%: alcanza mientras lo asistido más lo que falta llegue al mínimo.
const weeks = weeksOfMonths(["2026-08", "2026-09"]);
const need = requiredWeeks(weeks.length);
const today = "2026-09-30";
assert.equal(canMeetAttendance(new Set(weeks.slice(0, need)), weeks, today), true);
assert.equal(canMeetAttendance(new Set(), weeks, today), false);

// Todos contra todos: 6 partidas por grupo, sin repetir rival.
const schedule = groupSchedule([
  ["a", "b", "c", "d"],
  ["e", "f", "g", "h"],
  ["i", "j", "k", "l"],
  ["m", "n", "o", "p"],
]);
assert.equal(schedule.length, 24);
assert.equal(new Set(schedule.map((m) => `${m.round}:${m.slot}`)).size, 24);
assert.equal(new Set(schedule.map((m) => [m.player_a, m.player_b].sort().join())).size, 24);

// Empate en victorias: pasa el de más puntos, aunque haya perdido contra el otro.
const table = groupStandings(
  [
    { playerId: "a", seed: 1, points: 50 },
    { playerId: "b", seed: 8, points: 90 },
    { playerId: "c", seed: 12, points: 10 },
    { playerId: "d", seed: 16, points: 5 },
  ],
  [
    { playerA: "a", playerB: "b", winnerId: "a" },
    { playerA: "b", playerB: "c", winnerId: "b" },
    { playerA: "b", playerB: "d", winnerId: "b" },
    { playerA: "a", playerB: "c", winnerId: "c" },
    { playerA: "a", playerB: "d", winnerId: "a" },
    { playerA: "c", playerB: "d", winnerId: "d" },
  ],
);
assert.deepEqual(
  table.map((p) => [p.playerId, p.wins]),
  [
    ["b", 2],
    ["a", 2],
    ["c", 1],
    ["d", 1],
  ],
);

// Cuartos cruzados: 1.º de A vs 2.º de D, 1.º de B vs 2.º de C.
assert.deepEqual(
  quarterFinals([
    ["a1", "a2"],
    ["b1", "b2"],
    ["c1", "c2"],
    ["d1", "d2"],
  ]).map((m) => [m.player_a, m.player_b]),
  [
    ["a1", "d2"],
    ["b1", "c2"],
    ["c1", "b2"],
    ["d1", "a2"],
  ],
);

// Llave de 16: 1 vs 16 arriba y 2 vs 15 abajo, cada jugador una sola vez.
const seeds16 = Array.from({ length: 16 }, (_, i) => `s${i + 1}`);
const round = firstRound(seeds16);
assert.deepEqual([round[0].player_a, round[0].player_b], ["s1", "s16"]);
assert.deepEqual([round[7].player_a, round[7].player_b], ["s2", "s15"]);
assert.equal(new Set(round.flatMap((m) => [m.player_a, m.player_b])).size, 16);

// Desempates de orden: puntos, OMW, asistencia, quien jugó primero.
const stat = (playerId: string, points: number, omw: number, played: number, firstDate: string) => ({
  playerId,
  points,
  omw,
  played,
  firstDate,
});
assert.deepEqual(
  [
    stat("e", 10, 50, 5, "2026-08-02"),
    stat("d", 10, 50, 5, "2026-08-01"),
    stat("c", 10, 50, 6, "2026-09-01"),
    stat("b", 10, 60, 1, "2026-09-01"),
    stat("a", 20, 10, 1, "2026-09-01"),
  ]
    .sort(compareSeeding)
    .map((s) => s.playerId),
  ["a", "b", "c", "d", "e"],
);
assert.equal(lastRound(2), 1);
assert.equal(lastRound(3), 3);
assert.equal(parentRegion("Ciudad de México Norte"), "Ciudad de México");

console.log("playoffs.check OK");

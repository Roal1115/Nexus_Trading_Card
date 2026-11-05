// Run: npx tsx scripts/player-status.check.mts
import assert from "node:assert/strict";
import { playerStatus } from "../src/lib/player-status.ts";

const TODAY = "2026-11-05";
const status = (player: string[], store: string[]) => playerStatus(player, store, TODAY);

// Tienda semanal: 8 torneos en las últimas 8 semanas.
const weekly = [
  "2026-09-17", "2026-09-24", "2026-10-01", "2026-10-08",
  "2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05",
];

// Frecuente: la mitad de lo que la tienda realmente hizo.
assert.equal(status(weekly.filter((_, i) => i % 2 === 1), weekly).status, "frecuente");
assert.equal(status(weekly, weekly).status, "frecuente");

// No hace falta venir cada semana si la tienda tampoco abrió: 2 de 3 torneos.
const sparse = ["2026-09-20", "2026-10-03", "2026-10-06"];
assert.equal(status(["2026-10-03", "2026-10-06"], sparse).status, "frecuente");

// Menos de la mitad, sin haber faltado a 3 seguidos: ocasional.
assert.equal(status(["2026-09-24", "2026-10-29"], weekly).status, "ocasional");

// Un solo torneo en una tienda con un solo torneo no es "frecuente".
assert.equal(status(["2026-11-01"], ["2026-11-01"]).status, "nuevo");
assert.equal(status(["2026-10-29"], weekly).status, "nuevo");

// Por recuperar: faltó a los últimos 3 torneos de la tienda.
assert.deepEqual(status(["2026-10-08"], weekly), { status: "por_recuperar", missed: 4 });
assert.deepEqual(status(["2026-10-15", "2026-10-08"], weekly), { status: "por_recuperar", missed: 3 });

// Faltar a 2 todavía no cuenta.
assert.equal(status(["2026-10-15", "2026-10-22"], weekly).missed, 2);
assert.notEqual(status(["2026-10-15", "2026-10-22"], weekly).status, "por_recuperar");

// Tienda sin torneos en un mes: nadie queda "por recuperar" por culpa de la tienda.
const quiet = ["2026-09-22", "2026-09-29", "2026-10-06"];
assert.notEqual(status(["2026-10-06"], quiet).status, "por_recuperar");
assert.equal(status(["2026-10-06"], quiet).missed, 0);

// Sin tope: alguien ausente hace meses sigue en la lista.
const longGone = [...weekly, "2026-03-01"].sort();
assert.equal(status(["2026-03-01"], longGone).status, "por_recuperar");

// Torneos a futuro no cuentan como faltas ni como torneos hechos.
assert.equal(status(["2026-11-05"], [...weekly, "2026-11-12", "2026-11-19", "2026-11-26"]).missed, 0);

// Dos torneos el mismo día son dos oportunidades, no una.
assert.equal(status(["2026-10-01"], ["2026-10-01", "2026-10-02", "2026-10-02", "2026-10-03"]).missed, 3);

console.log("player-status: ok");

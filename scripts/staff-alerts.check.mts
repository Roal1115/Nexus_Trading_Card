// Avisos a Discord: npx tsx scripts/staff-alerts.check.mts
import assert from "node:assert/strict";
import { notifyStaff, staffAlertText } from "../src/lib/staff-alerts.server.ts";

// Solo avisa la lista cerrada.
assert.equal(staffAlertText("TOURNAMENT_APPROVED", "Ana", "x"), null);
assert.equal(staffAlertText("STORE_INVITE_CREATED", "Ana", "correo@ejemplo.com"), null);
assert.ok(staffAlertText("STORE_SIGNUP_SUBMITTED", "Sistema", "Tienda")?.includes("Tienda"));

// El actor de sistema no se muestra; una persona sí.
assert.ok(!staffAlertText("APPEAL_CREATED", "Sistema", "T")?.includes("Por:"));
assert.ok(staffAlertText("APPEAL_CREATED", "Ana", "T")?.includes("Por: Ana"));

// Enlaces disfrazados y formato salen como texto.
const evil = staffAlertText("STORE_SIGNUP_SUBMITTED", "Sistema", "[Paga aquí](http://x.y)\n# Hola");
assert.ok(evil?.includes("\\[Paga aquí\\]\\(http://x.y\\)"));
assert.ok(!evil?.split("\n")[1].includes("\n"));
assert.ok((staffAlertText("APPEAL_CREATED", "Ana", "x".repeat(900))?.length ?? 0) < 300);

// Resumen de la publicación, con y sin fallas.
const run = (m: unknown) => staffAlertText("SCHEDULED_PUBLICATION_RUN_FINISHED", "Sistema", "P", m);
assert.ok(run({ published: [1, 2], skipped: [] })?.includes("Publicados: 2 · Omitidos: 0"));
assert.ok(!run({ published: [1] })?.includes("Fallas"));
assert.ok(
  run({ published: [], recompute_failures: [1], achievement_failures: [2] })?.includes("Fallas: 2"),
);

// Envío: sin webhook no llama; con webhook bloquea menciones; un fallo no lanza.
const calls: Array<{ url: string; body: any }> = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, body: JSON.parse(init.body as string) });
  return new Response(null, { status: 204 });
}) as typeof fetch;

delete process.env.DISCORD_STAFF_WEBHOOK_URL;
await notifyStaff("APPEAL_CREATED", "Ana", "T");
assert.equal(calls.length, 0);

process.env.DISCORD_STAFF_WEBHOOK_URL = "https://discord.com/api/webhooks/1/x";
await notifyStaff("TOURNAMENT_APPROVED", "Ana", "T");
assert.equal(calls.length, 0);
await notifyStaff("APPEAL_CREATED", "Ana", "@everyone");
assert.equal(calls.length, 1);
assert.deepEqual(calls[0].body.allowed_mentions, { parse: [] });

const realError = console.error;
console.error = () => {};
globalThis.fetch = (async () => {
  throw new Error("boom");
}) as typeof fetch;
await notifyStaff("APPEAL_CREATED", "Ana", "T");
console.error = realError;

console.log("staff-alerts: ok");

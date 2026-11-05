// Reglas de preferencia: npx tsx scripts/rsvp-rules.check.mts
import assert from "node:assert/strict";
import { slotRsvpState } from "../src/lib/rsvp-rules.ts";

const at = (date: string, startTime: string | null, nowTime: string) =>
  slotRsvpState({ date, startTime, today: "2026-11-05", nowTime });

assert.equal(at("2026-11-04", "18:00:00", "10:00"), "started"); // ayer
assert.equal(at("2026-11-06", "18:00:00", "23:00"), "open"); // mañana
assert.equal(at("2026-11-05", "18:00:00", "17:59"), "open");
assert.equal(at("2026-11-05", "18:00:00", "18:00"), "started"); // ya empezó
assert.equal(at("2026-11-05", null, "23:59"), "open"); // sin hora: todo el día
assert.equal(at("2026-11-19", "18:00:00", "10:00"), "open"); // justo 14 días
assert.equal(at("2026-11-20", "18:00:00", "10:00"), "early"); // 15 días
// Cambio de mes y de año.
assert.equal(
  slotRsvpState({ date: "2027-01-08", startTime: null, today: "2026-12-25", nowTime: "10:00" }),
  "open",
);
assert.equal(
  slotRsvpState({ date: "2027-01-09", startTime: null, today: "2026-12-25", nowTime: "10:00" }),
  "early",
);

console.log("rsvp-rules: ok");

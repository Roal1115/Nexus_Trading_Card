// Run: npx tsx scripts/organizer-home.check.mts
// Datos sintéticos: no toca la base. Cubre estados que hoy no existen en
// producción (rechazado, próximos torneos de la semana).
import assert from "node:assert/strict";
import { tournamentsByTab, weekOutlook } from "../src/components/organizer/organizer-home.ts";
import { statusPresentation } from "../src/components/admin/status-presentation.ts";

// --- Presentación para quien sube vs. quien revisa (solo texto) ---
const up = (status: string, reason: string | null = null) =>
  statusPresentation(status, reason, "uploader").label;
const rev = (status: string, reason: string | null = null) =>
  statusPresentation(status, reason).label;

assert.equal(up("DRAFT"), "En revisión");
assert.equal(up("DRAFT", "El CSV no corresponde a la fecha del torneo."), "Rechazado");
assert.equal(up("APPROVED"), "Aprobado");
assert.equal(up("PUBLISHED"), "Publicado");
assert.equal(up("UNPUBLISHED"), "Despublicado");
// Admin y TCG manager no cambian.
assert.equal(rev("DRAFT"), "Por revisar");
assert.equal(rev("DRAFT", "motivo"), "Rechazado");
assert.equal(rev("APPROVED"), "Aprobado · sin publicar");
assert.equal(rev("PUBLISHED"), "Publicado");
// Mismo estado y tono en ambos: solo cambia la etiqueta.
assert.equal(
  statusPresentation("DRAFT", null, "uploader").state,
  statusPresentation("DRAFT", null).state,
);
assert.equal(
  statusPresentation("DRAFT", null, "uploader").tone,
  statusPresentation("DRAFT", null).tone,
);

// --- Pestañas de Torneos ---
const rows = [
  { id: "a", status: "DRAFT", rejection_reason: null },
  { id: "b", status: "DRAFT", rejection_reason: "Faltan rondas en el archivo" },
  { id: "c", status: "APPROVED", rejection_reason: null },
  { id: "d", status: "PUBLISHED", rejection_reason: null },
  { id: "e", status: "UNPUBLISHED", rejection_reason: null },
];
const tabs = tournamentsByTab(rows);
assert.deepEqual(
  tabs.pending.map((r) => r.id),
  ["a"],
);
assert.deepEqual(
  tabs.rejected.map((r) => r.id),
  ["b"],
  "rechazado = DRAFT + rejection_reason",
);
assert.deepEqual(
  tabs.approved.map((r) => r.id),
  ["c"],
);
assert.deepEqual(
  tabs.published.map((r) => r.id),
  ["d"],
);
assert.ok(
  !Object.values(tabs)
    .flat()
    .some((r) => r.id === "e"),
  "despublicado solo en Todos",
);

// --- Semana: atrasados vs. próximos ---
const week = [
  { id: "past-sent", report_status: "submitted" as const, is_today: false },
  { id: "past-missing", report_status: "overdue" as const, is_today: false },
  { id: "today-ended-missing", report_status: "overdue" as const, is_today: true },
  { id: "today-ongoing", report_status: "pending" as const, is_today: true },
  { id: "later", report_status: "upcoming" as const, is_today: false },
];
const w = weekOutlook(week);
assert.deepEqual(
  w.overdue.map((e) => e.id),
  ["past-missing", "today-ended-missing"],
);
assert.deepEqual(
  w.upcoming.map((e) => e.id),
  ["today-ongoing", "later"],
  "un atrasado nunca sale como próximo",
);

console.log("organizer-home: all checks passed");

// Horario de tienda: npx tsx scripts/store-hours.check.mts
import assert from "node:assert/strict";
import {
  CLOSED_WEEK,
  formatWeekHours,
  isValidWeek,
  parseWeekHours,
  type WeekHours,
} from "../src/lib/store-hours.ts";

const regular = { open: "12:00", close: "20:00" };
const sunday = { open: "14:00", close: "18:00" };

// Los días iguales y seguidos se agrupan; el horario especial queda aparte.
const week: WeekHours = [regular, regular, regular, regular, regular, null, sunday];
assert.equal(formatWeekHours(week), "Lun-Vie 12:00-20:00 · Dom 14:00-18:00");
assert.deepEqual(parseWeekHours(formatWeekHours(week)), week);

// Un día cerrado en medio parte el grupo.
const gap: WeekHours = [regular, null, regular, null, null, null, null];
assert.equal(formatWeekHours(gap), "Lun 12:00-20:00 · Mié 12:00-20:00");
assert.deepEqual(parseWeekHours(formatWeekHours(gap)), gap);

// El peor caso (7 horarios distintos) cabe en el límite de 200 de opening_hours.
const allDifferent: WeekHours = [10, 11, 12, 13, 14, 15, 16].map((h) => ({
  open: `${h}:00`,
  close: `${h + 5}:30`,
}));
assert.ok(formatWeekHours(allDifferent).length <= 200);

// Validación.
assert.equal(isValidWeek(week), true);
assert.equal(isValidWeek(CLOSED_WEEK), false, "al menos un día abierto");
assert.equal(isValidWeek(week.slice(0, 6)), false, "siempre 7 días");
const single = (open: string, close: string): WeekHours => [{ open, close }, ...CLOSED_WEEK.slice(1)];
assert.equal(isValidWeek(single("20:00", "12:00")), false, "cierra antes de abrir");
assert.equal(isValidWeek(single("12:00", "12:00")), false, "abre y cierra igual");
assert.equal(isValidWeek(single("12:15", "20:00")), false, "solo intervalos de 30 minutos");
assert.equal(isValidWeek(single("14:00", "00:00")), true, "cierre a medianoche");
assert.equal(isValidWeek(single("00:00", "00:00")), false, "no hay 24 horas con 00:00");

// Textos capturados a mano antes: no se interpretan, el formulario arranca vacío.
for (const legacy of ["", null, undefined, "Todos los días", "Lunes a viernes 12-8", "Vie-Lun 12:00-20:00"]) {
  assert.equal(parseWeekHours(legacy), null, String(legacy));
}

console.log("store-hours: ok");

// Horario de una tienda: se captura por selección y se guarda como texto en
// stores.opening_hours, que es lo que ya muestran las páginas públicas.

export const WEEK_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export type DayHours = { open: string; close: string } | null;
export type WeekHours = DayHours[];

export const CLOSED_WEEK: WeekHours = [null, null, null, null, null, null, null];

export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, "0");
  return `${hour}:${i % 2 ? "30" : "00"}`;
});

// 00:00 como cierre significa medianoche. Horarios que cruzan a otro día no se aceptan.
function isValidDay(day: NonNullable<DayHours>): boolean {
  if (!TIME_OPTIONS.includes(day.open) || !TIME_OPTIONS.includes(day.close)) return false;
  return day.close === "00:00" ? day.open !== "00:00" : day.open < day.close;
}

export function isValidWeek(week: WeekHours): boolean {
  if (week.length !== 7) return false;
  const open = week.filter((d): d is NonNullable<DayHours> => d !== null);
  return open.length > 0 && open.every(isValidDay);
}

const sameHours = (a: DayHours, b: DayHours) => a?.open === b?.open && a?.close === b?.close;

/** "Lun-Vie 12:00-20:00 · Dom 14:00-18:00". Los días cerrados no aparecen. */
export function formatWeekHours(week: WeekHours): string {
  const parts: string[] = [];
  let i = 0;
  while (i < 7) {
    const day = week[i];
    let end = i;
    while (end + 1 < 7 && sameHours(week[end + 1], day)) end++;
    if (day) {
      const days = i === end ? WEEK_LABELS[i] : `${WEEK_LABELS[i]}-${WEEK_LABELS[end]}`;
      parts.push(`${days} ${day.open}-${day.close}`);
    }
    i = end + 1;
  }
  return parts.join(" · ");
}

/** Devuelve null si el texto no tiene este formato (horarios capturados a mano antes). */
export function parseWeekHours(text: string | null | undefined): WeekHours | null {
  if (!text?.trim()) return null;
  const week: WeekHours = [...CLOSED_WEEK];
  for (const part of text.split(" · ")) {
    const match = /^(\S{3})(?:-(\S{3}))? (\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(part.trim());
    if (!match) return null;
    const start = WEEK_LABELS.indexOf(match[1] as (typeof WEEK_LABELS)[number]);
    const end = match[2] ? WEEK_LABELS.indexOf(match[2] as (typeof WEEK_LABELS)[number]) : start;
    if (start < 0 || end < start) return null;
    for (let i = start; i <= end; i++) week[i] = { open: match[3], close: match[4] };
  }
  return isValidWeek(week) ? week : null;
}

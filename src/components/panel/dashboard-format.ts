// Helpers de los Inicio de panel: formato en hora de México, estado de secciones y clases de filas.
import { INELIGIBLE_LABELS, type IneligibleReason } from "@/lib/tournament-state";

// ---------- Formato (hora de México) ----------
export const TZ = "America/Mexico_City";
export const fmtDay = (d: Date) =>
  d.toLocaleDateString("es-MX", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
export const fmtDayTime = (d: Date) =>
  d.toLocaleString("es-MX", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
export const fmtTournamentDate = (ymd: string) => fmtDay(new Date(`${ymd}T12:00:00-06:00`));
export const rtf = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });
export function ago(iso: string, now: Date) {
  const min = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
}

export type Section<T> =
  { state: "loading" } | { state: "error"; message: string } | { state: "ok"; data: T };
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const footerLink =
  "inline-flex min-h-8 items-center gap-1 rounded py-1 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
export const rowLink =
  "flex min-h-11 items-center gap-3 px-5 py-3 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";

export const reasonsText = (r: IneligibleReason[]) =>
  r.map((x) => INELIGIBLE_LABELS[x]).join(" · ");

type IcsEvent = {
  title: string;
  description?: string;
  location?: string;
  date: string; // "YYYY-MM-DD"
  time?: string | null; // "HH:MM" or "HH:MM:SS", null = all-day
  durationHours?: number; // default 4
  uid: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtUtc(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(event: IcsEvent): string {
  const timePart = (event.time ?? "12:00").slice(0, 5);
  const start = new Date(`${event.date}T${timePart}:00`);
  const end = new Date(start.getTime() + (event.durationHours ?? 4) * 3600 * 1000);
  const stamp = fmtUtc(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trading Card Nexus//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@tradingcardnexus`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function icsDataUri(ics: string): string {
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
}

export function icsFileName(title: string): string {
  const safe = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${safe || "torneo"}.ics`;
}

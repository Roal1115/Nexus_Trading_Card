// Reglas de la preferencia en torneos. No es una inscripción: el registro oficial
// se hace en la app de Bandai, y Nexus no puede garantizar un lugar.
export const RSVP_NOTICE = "No es tu inscripción oficial: esa se hace en la app de Bandai.";

export const RSVP_WINDOW_DAYS = 14;

// Abre RSVP_WINDOW_DAYS antes, para que nadie aparte todas las semanas del año, y
// cierra a la hora de inicio. Sin hora conocida, cierra al terminar el día.
export function slotRsvpState({
  date,
  startTime,
  today,
  nowTime,
}: {
  date: string;
  startTime: string | null | undefined;
  today: string;
  nowTime: string; // "HH:MM"
}): "early" | "open" | "started" {
  const opensFor = new Date(`${today}T00:00:00Z`);
  opensFor.setUTCDate(opensFor.getUTCDate() + RSVP_WINDOW_DAYS);
  if (date > opensFor.toISOString().slice(0, 10)) return "early";
  if (date < today) return "started";
  return date === today && startTime && nowTime >= startTime.slice(0, 5) ? "started" : "open";
}

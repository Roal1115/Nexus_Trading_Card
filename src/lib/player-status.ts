// Estado de un jugador en una tienda. Siempre es a fecha de hoy (no depende del
// rango elegido) y se mide contra los torneos que la tienda hizo de verdad, para
// no culpar al jugador de las semanas en que no hubo torneo.
// Sin dependencias de TanStack: se prueba con scripts/player-status.check.mts.

export type PlayerStatus = "frecuente" | "ocasional" | "nuevo" | "por_recuperar";

export const PLAYER_STATUSES: PlayerStatus[] = ["frecuente", "ocasional", "nuevo", "por_recuperar"];

const RECENT_DAYS = 56;
const MIN_FREQUENT_VISITS = 2;
const MISSED_TO_RECOVER = 3;

// Fecha en que el jugador pasa a "por recuperar": el 3.er torneo de la tienda que
// se pierde tras su última visita. null si aún no llega ahí. Misma regla que playerStatus.
export function lostDate(
  playerDates: string[],
  storeDates: string[],
  today: string,
): string | null {
  const lastVisit = playerDates.reduce((a, b) => (b > a ? b : a), "");
  const missed = storeDates.filter((d) => d > lastVisit && d <= today).sort();
  return missed[MISSED_TO_RECOVER - 1] ?? null;
}

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  frecuente: "Frecuente",
  ocasional: "Ocasional",
  nuevo: "Nuevo",
  por_recuperar: "Por recuperar",
};

export const PLAYER_STATUS_COLORS: Record<PlayerStatus, string> = {
  // Verde y rojo son solo resultados de match (The Result Colors Rule): escala azul neutra y
  // amarillo de aviso para quien hay que recuperar.
  frecuente: "#8fb4ff",
  ocasional: "#aab6d1",
  nuevo: "#f2f5fb",
  por_recuperar: "#ffd54a",
};

export const PLAYER_STATUS_HELP: Record<PlayerStatus, string> = {
  frecuente: "vino a la mitad o más de los torneos de las últimas 8 semanas, y al menos a 2.",
  ocasional: "ha venido más de una vez, pero menos de la mitad de los torneos recientes.",
  nuevo: "solo ha venido a un torneo.",
  por_recuperar: `faltó a los últimos ${MISSED_TO_RECOVER} torneos de la tienda.`,
};

// Fechas YYYY-MM-DD: se comparan como texto, sin problemas de zona horaria.
export function playerStatus(
  playerDates: string[],
  storeDates: string[],
  today: string,
): { status: PlayerStatus; missed: number } {
  const lastVisit = playerDates.reduce((a, b) => (b > a ? b : a), "");
  const held = storeDates.filter((d) => d <= today);
  const missed = held.filter((d) => d > lastVisit).length;
  if (missed >= MISSED_TO_RECOVER) return { status: "por_recuperar", missed };

  const since = new Date(`${today}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - RECENT_DAYS);
  const sinceStr = since.toISOString().slice(0, 10);
  const recentHeld = held.filter((d) => d >= sinceStr).length;
  const recentVisits = playerDates.filter((d) => d >= sinceStr && d <= today).length;
  if (recentVisits >= MIN_FREQUENT_VISITS && recentVisits * 2 >= recentHeld) {
    return { status: "frecuente", missed };
  }

  return { status: playerDates.length === 1 ? "nuevo" : "ocasional", missed };
}

// Para vistas de varias tiendas: solo cuentan los torneos de las tiendas donde el
// jugador ha ido. Que otra tienda haga torneos no lo vuelve "por recuperar".
export function statusAcrossStores(
  visits: Array<{ store_id: string; date: string }>,
  tournaments: Array<{ store_id: string; date: string }>,
  today: string,
) {
  const stores = new Set(visits.map((v) => v.store_id));
  return playerStatus(
    visits.map((v) => v.date),
    tournaments.filter((t) => stores.has(t.store_id)).map((t) => t.date),
    today,
  );
}

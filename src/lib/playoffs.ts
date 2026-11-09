// Reglas de clasificación a playoffs (Nivel 1, subregión). Sin dependencias:
// se prueba con npx tsx scripts/playoffs.check.mts

export type PlayoffResult = {
  playerId: string;
  subregion: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  points: number;
  omw: number;
};

export type Standing = { playerId: string; points: number; omw: number; played: number };

export type Qualified = Standing & {
  seed: number;
  source: "month" | "points";
  month: string | null;
  confirmed: boolean;
};

export const PLAYOFF_SIZE = 16;
export const QUALIFYING_MONTHS = 5;
const SPOTS_PER_MONTH = 2;

/** Acomodo oficial de los 4 grupos por número de clasificado. */
export const SEED_GROUPS = [
  [1, 8, 12, 16],
  [2, 7, 11, 15],
  [3, 6, 10, 14],
  [4, 5, 9, 13],
];

/** Partidas todos contra todos de los 4 grupos: 3 rondas, 2 partidas por grupo. */
export function groupSchedule(groups: string[][]) {
  const pairings = [
    [
      [0, 3],
      [1, 2],
    ],
    [
      [0, 2],
      [1, 3],
    ],
    [
      [0, 1],
      [2, 3],
    ],
  ];
  return groups.flatMap((players, group) =>
    pairings.flatMap((round, roundIndex) =>
      round.map(([a, b], i) => ({
        round: roundIndex,
        slot: group * 2 + i,
        player_a: players[a],
        player_b: players[b],
      })),
    ),
  );
}

export type GroupEntry = { playerId: string; seed: number; points: number };
export type GroupMatch = { playerA: string; playerB: string; winnerId: string | null };

/** Tabla del grupo: victorias y, si empatan, más puntos en el ranking general. */
export function groupStandings(entries: GroupEntry[], matches: GroupMatch[]) {
  return entries
    .map((entry) => {
      const played = matches.filter(
        (m) => m.winnerId && (m.playerA === entry.playerId || m.playerB === entry.playerId),
      );
      const wins = played.filter((m) => m.winnerId === entry.playerId).length;
      return { ...entry, wins, losses: played.length - wins };
    })
    .sort((a, b) => b.wins - a.wins || b.points - a.points || a.seed - b.seed);
}

/** Cuartos: 1.º de A vs 2.º de D, 1.º de B vs 2.º de C, y así. */
export function quarterFinals(groups: Array<[string, string]>) {
  return groups.map(([first], i) => ({
    round: 0,
    slot: i,
    player_a: first,
    player_b: groups[groups.length - 1 - i][1],
  }));
}

export const FINAL_REGION = "Final Nacional";

export type SeedingStats = Standing & { firstDate: string };

/** Orden de Niveles 2 y 3: puntos, OMW, asistencia y quien jugó primero. */
export function compareSeeding(a: SeedingStats, b: SeedingStats): number {
  return (
    b.points - a.points ||
    b.omw - a.omw ||
    b.played - a.played ||
    a.firstDate.localeCompare(b.firstDate) ||
    a.playerId.localeCompare(b.playerId)
  );
}

// Llave clásica: 1 vs 16, 2 vs 15, y el 1 y el 2 solo pueden verse en la final.
const BRACKET_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];

/** Primera ronda de una llave de 16; recibe a los jugadores del #1 al #16. */
export function firstRound(players: string[]) {
  return Array.from({ length: 8 }, (_, slot) => ({
    round: 0,
    slot,
    player_a: players[BRACKET_ORDER[slot * 2] - 1],
    player_b: players[BRACKET_ORDER[slot * 2 + 1] - 1],
  }));
}

/** Nivel 2 termina en cuartos (salen 4); Nivel 3 se juega hasta el campeón. */
export function lastRound(level: number): number {
  return level === 2 ? 1 : 3;
}

/** "Monterrey Norte" pertenece a "Monterrey". */
export function parentRegion(subregion: string): string {
  return subregion.slice(0, subregion.lastIndexOf(" "));
}

/** Clave "YYYY-WNN" de la semana (lunes a domingo) de una fecha YYYY-MM-DD. */
export function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z");
  const day = date.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  const year = monday.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7,
  );
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

/** Meses YYYY-MM de la clasificación, desde el mes inicial. */
export function qualifyingMonths(start: string): string[] {
  const [year, month] = start.split("-").map(Number);
  return Array.from({ length: QUALIFYING_MONTHS }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    return d.toISOString().slice(0, 7);
  });
}

/** Semanas de los meses dados, en orden. */
export function weeksOfMonths(months: string[]): string[] {
  const weeks = new Set<string>();
  const [year, month] = months[0].split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1 + months.length, 1));
  for (let d = new Date(Date.UTC(year, month - 1, 1)); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    weeks.add(getWeekKey(d.toISOString().slice(0, 10)));
  }
  return Array.from(weeks);
}

export function requiredWeeks(totalWeeks: number): number {
  return Math.ceil(totalWeeks * 0.6);
}

/**
 * ¿Todavía puede cumplir el 60%? Cuenta lo asistido más las semanas que faltan,
 * así nadie queda fuera mientras le alcance el calendario.
 */
export function canMeetAttendance(attended: Set<string>, weeks: string[], today: string): boolean {
  const currentWeek = getWeekKey(today);
  const remaining = weeks.filter((week) => week >= currentWeek);
  return new Set([...attended, ...remaining]).size >= requiredWeeks(weeks.length);
}

/** Tabla con el tope de 2 torneos por semana de la subregión. */
export function standingsOf(results: PlayoffResult[]): Standing[] {
  const byPlayerWeek = new Map<string, Map<string, PlayoffResult[]>>();
  for (const r of results) {
    const weeks = byPlayerWeek.get(r.playerId) ?? new Map<string, PlayoffResult[]>();
    byPlayerWeek.set(r.playerId, weeks);
    const key = getWeekKey(r.date);
    weeks.set(key, [...(weeks.get(key) ?? []), r]);
  }

  const standings = Array.from(byPlayerWeek, ([playerId, weeks]) => {
    const all = Array.from(weeks.values());
    const counted = all.flatMap((rows) =>
      [...rows].sort((a, b) => b.points - a.points).slice(0, 2),
    );
    return {
      playerId,
      points: counted.reduce((sum, r) => sum + r.points, 0),
      omw: counted.reduce((sum, r) => sum + r.omw, 0) / counted.length,
      played: all.reduce((sum, rows) => sum + rows.length, 0),
    };
  });
  return standings.sort(compareStandings);
}

function compareStandings(a: Standing, b: Standing): number {
  return (
    b.points - a.points ||
    b.omw - a.omw ||
    b.played - a.played ||
    a.playerId.localeCompare(b.playerId)
  );
}

/** Asigna lugares; quien sale en dos subregiones se queda en la que va mejor. */
function pick(
  tables: Map<string, Standing[]>,
  spots: (subregion: string) => number,
  taken: Set<string>,
): Map<string, Standing[]> {
  const banned = new Set<string>();
  for (;;) {
    const picks = new Map<string, Standing[]>();
    for (const [subregion, table] of tables) {
      picks.set(
        subregion,
        table
          .filter((s) => !taken.has(s.playerId) && !banned.has(`${subregion}:${s.playerId}`))
          .slice(0, spots(subregion)),
      );
    }

    const seats = new Map<string, Array<{ subregion: string; standing: Standing }>>();
    for (const [subregion, standings] of picks) {
      for (const standing of standings) {
        seats.set(standing.playerId, [
          ...(seats.get(standing.playerId) ?? []),
          { subregion, standing },
        ]);
      }
    }

    let changed = false;
    for (const [playerId, list] of seats) {
      if (list.length < 2) continue;
      const [, ...losers] = [...list].sort(
        (a, b) =>
          compareStandings(a.standing, b.standing) || a.subregion.localeCompare(b.subregion),
      );
      for (const loser of losers) banned.add(`${loser.subregion}:${playerId}`);
      changed = true;
    }
    if (!changed) return picks;
  }
}

function tablesOf(results: PlayoffResult[], subregions: string[]): Map<string, Standing[]> {
  return new Map(
    subregions.map((subregion) => [
      subregion,
      standingsOf(results.filter((r) => r.subregion === subregion)),
    ]),
  );
}

/**
 * Clasificados de cada subregión. El número sale del orden en que clasifican:
 * primero los meses cerrados y después los lugares por puntos de la temporada.
 */
export function classify(input: {
  results: PlayoffResult[];
  subregions: string[];
  closedMonths: string[];
  seasonFinished: boolean;
  ineligible: Set<string>;
}): Map<string, Qualified[]> {
  const results = input.results.filter((r) => !input.ineligible.has(r.playerId));
  const taken = new Set<string>();
  const lists = new Map<string, Qualified[]>(input.subregions.map((s) => [s, []]));
  const add = (
    subregion: string,
    standing: Standing,
    source: Qualified["source"],
    month: string | null,
    confirmed: boolean,
  ) => {
    const list = lists.get(subregion)!;
    list.push({ ...standing, seed: list.length + 1, source, month, confirmed });
    taken.add(standing.playerId);
  };

  for (const month of input.closedMonths) {
    const tables = tablesOf(
      results.filter((r) => r.month === month),
      input.subregions,
    );
    const picks = pick(tables, () => SPOTS_PER_MONTH, taken);
    for (const [subregion, standings] of picks) {
      for (const standing of standings) add(subregion, standing, "month", month, true);
    }
  }

  const picks = pick(
    tablesOf(results, input.subregions),
    (subregion) => PLAYOFF_SIZE - lists.get(subregion)!.length,
    taken,
  );
  for (const [subregion, standings] of picks) {
    for (const standing of standings) {
      add(subregion, standing, "points", null, input.seasonFinished);
    }
  }
  return lists;
}

import { describe, expect, it } from "vitest";
import {
  computeTournamentSummary,
  filterStatsByDate,
  getStatsSourceState,
} from "./my-stats";

const DAY = 86400000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
const recent = iso(5);
const old = iso(120);

const round = (date: string, wonMatch: boolean) => ({
  round_number: 1,
  tournament_date: date,
  store_name: "Tienda",
  opponent_tag: "Rival",
  won_match: wonMatch,
  turn_order: "first",
  won_die_roll: true,
  notes: null,
  status: "confirmed",
});

const stats = () => ({
  total_tournaments_won: 2,
  total_tournament_win_dates: [recent, old],
  total_rounds_in_meta: 100,
  leaders: [
    {
      total_games: 2,
      wins: 1,
      losses: 1,
      tournaments_won: 2,
      tournament_win_dates: [recent, old],
      matchups: [
        {
          total: 2,
          wins: 1,
          round_history: [round(recent, true), round(old, false)],
        },
      ],
    },
  ],
  no_leader_rounds: [],
});

const query = (data?: any, overrides = {}) => ({
  data,
  isLoading: false,
  isError: false,
  ...overrides,
});

describe("errores por fuente en Mis Stats", () => {
  it("distingue un error de Oficial de un historial vacío", () => {
    const state = getStatsSourceState("official", {
      official: query(undefined, { isError: true }),
      casual: query(),
      pending: query(),
    });

    expect(state.stats).toBeNull();
    expect(state.failedSources).toEqual(["official"]);
  });

  it("conserva Oficial y Pendientes cuando Casual falla en Todo", () => {
    const state = getStatsSourceState("all", {
      official: query(stats()),
      casual: query(undefined, { isError: true }),
      pending: query({ ...stats(), leaders: [] }),
    });

    expect(state.failedSources).toEqual(["casual"]);
    expect(state.stats?.leaders).toHaveLength(1);
  });

  it("espera a que las demás fuentes terminen antes de mostrar parciales", () => {
    const state = getStatsSourceState("all", {
      official: query(stats()),
      casual: query(undefined, { isLoading: true }),
      pending: query({ ...stats(), leaders: [] }),
    });

    expect(state.loadingStats).toBe(true);
    expect(state.stats).toBeNull();
  });

  it("reporta las tres fuentes cuando todas fallan", () => {
    const state = getStatsSourceState("all", {
      official: query(undefined, { isError: true }),
      casual: query(undefined, { isError: true }),
      pending: query(undefined, { isError: true }),
    });

    expect(state.failedSources).toEqual(["official", "casual", "pending"]);
    expect(state.stats).toBeNull();
  });
});

describe("periodo de Mis Stats", () => {
  it("filtra las victorias globales de torneos a los últimos 30 días", () => {
    expect(filterStatsByDate(stats() as any, 30).total_tournaments_won).toBe(1);
  });

  it("filtra las victorias de cada líder a los últimos 30 días", () => {
    expect(filterStatsByDate(stats() as any, 30).leaders[0].tournaments_won).toBe(1);
  });

  it("filtra fuentes sin victorias de torneo sin romper sus estadísticas", () => {
    const casual = stats() as any;
    delete casual.total_tournament_win_dates;
    delete casual.leaders[0].tournament_win_dates;

    const filtered = filterStatsByDate(casual, 30);
    expect(filtered.total_tournaments_won).toBe(0);
    expect(filtered.leaders[0].tournaments_won).toBe(0);
    expect(filtered.leaders[0].total_games).toBe(1);
  });

  it("calcula mejor puesto y Top 8 solo con torneos de los últimos 30 días", () => {
    const summary = computeTournamentSummary(
      [
        { game_id: "g", placement: 2, date: recent },
        { game_id: "g", placement: 1, date: old },
      ],
      "g",
      30,
    );

    expect(summary).toMatchObject({ played: 1, best: 2, avg: 2, topCutRate: 100 });
  });
});

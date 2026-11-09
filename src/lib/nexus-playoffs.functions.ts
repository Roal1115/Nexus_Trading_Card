// Playoffs públicos, Nivel 1. Se calcula al vuelo con los torneos publicados.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { getActiveSeason } from "./nexus-admin-core";
import { logAction } from "./nexus-admin-shared";
import { requireNexusManager } from "./nexus-auth.middleware";
import {
  canMeetAttendance,
  classify,
  compareSeeding,
  FINAL_REGION,
  firstRound,
  getWeekKey,
  groupSchedule,
  groupStandings,
  lastRound,
  parentRegion,
  PLAYOFF_SIZE,
  qualifyingMonths,
  quarterFinals,
  requiredWeeks,
  SEED_GROUPS,
  standingsOf,
  weeksOfMonths,
  type PlayoffResult,
} from "./playoffs";

export type FrozenMatch = {
  id: string;
  player_a: string;
  player_b: string;
  tag_a: string;
  tag_b: string;
  winner_id: string | null;
  loser_wins: number | null;
  forfeit: boolean;
};

export type FrozenEvent = {
  groups: Array<{
    players: Array<{
      player_id: string;
      geek_tag: string;
      seed: number;
      wins: number;
      losses: number;
      advances: boolean;
    }>;
    matches: FrozenMatch[];
  }>;
  bracket: FrozenMatch[];
  top_four: string[];
  top_four_ids: string[];
};

export type BracketEvent = {
  level: number;
  rounds: Array<{ name: string; matches: FrozenMatch[] }>;
  top_four: string[];
  top_four_ids: string[];
  champion: string | null;
};

const ROUND_NAMES = ["Octavos", "Cuartos", "Semifinal", "Final"];

const CACHE_TTL = 3 * 60 * 1000;
const PAGE_SIZE = 1000;
let cache: { data: Awaited<ReturnType<typeof computeLevelOne>>; ts: number } | null = null;

type ResultRow = {
  player_id: string;
  points_earned: number | null;
  omw_percentage: number;
  tournaments: {
    store_id: string;
    tournament_date: string;
    qualifying_year: number;
    qualifying_month: number;
  };
};

async function fetchSeasonResults(
  admin: ReturnType<typeof getNexusAdmin>,
  gameId: string,
  season: { start_date: string; end_date: string },
): Promise<ResultRow[]> {
  const rows: ResultRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("tournament_results")
      .select(
        "id, player_id, points_earned, omw_percentage, tournaments!inner(store_id, tournament_date, qualifying_year, qualifying_month, status, game_id, league_id)",
      )
      .eq("tournaments.status", "PUBLISHED")
      .eq("tournaments.game_id", gameId)
      .is("tournaments.league_id", null)
      .gte("tournaments.tournament_date", season.start_date)
      .lte("tournaments.tournament_date", season.end_date)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) failDb(error);
    rows.push(...((data ?? []) as unknown as ResultRow[]));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

const monthOf = (row: ResultRow) =>
  `${row.tournaments.qualifying_year}-${String(row.tournaments.qualifying_month).padStart(2, "0")}`;

async function computeLevelOne() {
  const admin = getNexusAdmin();
  const [season, gameRes, storesRes] = await Promise.all([
    getActiveSeason(admin),
    admin.from("games").select("id").eq("slug", "one-piece").maybeSingle(),
    admin
      .from("stores")
      .select("id, zone, subzone")
      .eq("is_active", true)
      .not("subzone", "is", null),
  ]);
  if (gameRes.error) failDb(gameRes.error);
  if (storesRes.error) failDb(storesRes.error);
  if (!season || !gameRes.data) return null;

  const rows = await fetchSeasonResults(admin, gameRes.data.id, season);
  if (rows.length === 0) return null;

  // ponytail: la temporada no guarda cuándo empieza la clasificación; se toma
  // el primer mes con torneos. Si Admin define la fecha, usarla aquí.
  const months = qualifyingMonths(rows.map(monthOf).sort()[0]);
  const windowRows = rows.filter((row) => months.includes(monthOf(row)));

  const subregionOf = new Map(
    (storesRes.data ?? []).map((s) => [
      s.id,
      `${(s.zone ?? "").replace(/^Zona /, "").replace(/^Centro$/, "Ciudad de México")} ${s.subzone}`.trim(),
    ]),
  );
  const subregions = Array.from(new Set(subregionOf.values())).sort((a, b) =>
    a.localeCompare(b, "es-MX"),
  );

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const weeks = weeksOfMonths(months);

  // El 60% cuenta asistencia en cualquier tienda del circuito.
  const attendance = new Map<string, Set<string>>();
  for (const row of windowRows) {
    const attended = attendance.get(row.player_id) ?? new Set<string>();
    attended.add(getWeekKey(row.tournaments.tournament_date));
    attendance.set(row.player_id, attended);
  }
  const ineligible = new Set(
    Array.from(attendance)
      .filter(([, attended]) => !canMeetAttendance(attended, weeks, today))
      .map(([playerId]) => playerId),
  );

  const results: PlayoffResult[] = windowRows.flatMap((row) => {
    const subregion = subregionOf.get(row.tournaments.store_id);
    if (!subregion) return [];
    return [
      {
        playerId: row.player_id,
        subregion,
        date: row.tournaments.tournament_date,
        month: monthOf(row),
        points: row.points_earned ?? 0,
        omw: Number(row.omw_percentage),
      },
    ];
  });

  const closedMonths = months.filter((month) => month < today.slice(0, 7));
  const lists = classify({
    results,
    subregions,
    closedMonths,
    seasonFinished: closedMonths.length === months.length,
    ineligible,
  });

  const playerIds = Array.from(lists.values()).flatMap((list) => list.map((q) => q.playerId));
  const playersRes = playerIds.length
    ? await admin.from("players").select("id, geek_tag").in("id", playerIds)
    : { data: [], error: null };
  if (playersRes.error) failDb(playersRes.error);
  const tags = new Map((playersRes.data ?? []).map((p) => [p.id, p.geek_tag]));

  // Ranking general: 2 mejores de la semana sin importar la subregión.
  const generalPoints = new Map(
    standingsOf(
      windowRows.map((row) => ({
        playerId: row.player_id,
        subregion: "general",
        date: row.tournaments.tournament_date,
        month: monthOf(row),
        points: row.points_earned ?? 0,
        omw: Number(row.omw_percentage),
      })),
    ).map((s) => [s.playerId, s.points]),
  );
  const frozen = await loadFrozenEvents(admin, season.id, gameRes.data.id);
  const brackets = await loadBracketEvents(admin, season.id, gameRes.data.id);
  const parents = Array.from(new Set(subregions.map(parentRegion))).map((name) => {
    const children = subregions.filter((s) => parentRegion(s) === name);
    return {
      name,
      ready:
        children.length === 4 && children.every((s) => frozen.get(s)?.top_four_ids.length === 4),
      bracket: brackets.get(name) ?? null,
    };
  });

  return {
    parents,
    final: {
      ready: parents.length === 3 && parents.every((p) => p.bracket?.top_four_ids.length === 4),
      bracket: brackets.get(FINAL_REGION) ?? null,
    },
    season_id: season.id,
    game_id: gameRes.data.id,
    can_freeze: closedMonths.length === months.length,
    season_name: season.name,
    months,
    closed_months: closedMonths,
    total_weeks: weeks.length,
    required_weeks: requiredWeeks(weeks.length),
    subregions: subregions.map((name) => ({
      name,
      frozen: frozen.get(name) ?? null,
      players: lists.get(name)!.map((q) => ({
        seed: q.seed,
        player_id: q.playerId,
        geek_tag: tags.get(q.playerId) ?? "—",
        points: q.points,
        general_points: generalPoints.get(q.playerId) ?? 0,
        source: q.source,
        month: q.month,
        confirmed: q.confirmed,
        weeks_attended: attendance.get(q.playerId)?.size ?? 0,
      })),
    })),
  };
}

export const getPlayoffsLevelOne = createServerFn({ method: "POST" }).handler(async () => {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  const data = await computeLevelOne();
  cache = { data, ts: Date.now() };
  return data;
});

export const freezePlayoffGroups = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { region: string }) =>
    z.object({ region: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const current = await computeLevelOne();
    if (!current?.can_freeze) {
      throw new Error("Los grupos se congelan al cerrar los 5 meses de clasificación.");
    }
    const subregion = current.subregions.find((s) => s.name === data.region);
    if (!subregion) throw new Error("Subregión no encontrada.");
    if (subregion.players.length !== PLAYOFF_SIZE) {
      throw new Error(`La subregión necesita ${PLAYOFF_SIZE} clasificados para congelarse.`);
    }

    const bySeed = new Map(subregion.players.map((p) => [p.seed, p]));
    const entries = SEED_GROUPS.flatMap((seeds, groupIndex) =>
      seeds.map((seed) => {
        const p = bySeed.get(seed)!;
        return {
          player_id: p.player_id,
          seed,
          group_index: groupIndex,
          points: p.general_points,
        };
      }),
    );
    const matches = groupSchedule(
      SEED_GROUPS.map((seeds) => seeds.map((seed) => bySeed.get(seed)!.player_id)),
    );

    const { data: eventId, error } = await (admin as any).rpc("freeze_playoff_level_one", {
      p_season_id: current.season_id,
      p_game_id: current.game_id,
      p_region: data.region,
      p_actor_id: player.id,
      p_entries: entries,
      p_matches: matches,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Esta subregión ya está congelada.");
      failDb(error);
    }
    cache = null;
    await logAction(admin, player, "playoff_freeze", "playoff_event", eventId, data.region);
    return { ok: true };
  });

export const savePlayoffMatch = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: {
      match_id: string;
      winner_id: string | null;
      loser_wins: number | null;
      forfeit: boolean;
    }) =>
      z
        .object({
          match_id: z.string().uuid(),
          winner_id: z.string().uuid().nullable(),
          loser_wins: z.number().int().min(0).max(1).nullable(),
          forfeit: z.boolean(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { player } = context;
    const db = context.admin as any;
    const { data: match, error } = await db
      .from("playoff_matches")
      .select(
        "id, event_id, phase, round, slot, player_a, player_b, playoff_events!inner(level, region, season_id, game_id)",
      )
      .eq("id", data.match_id)
      .maybeSingle();
    if (error) failDb(error);
    if (!match) throw new Error("Partida no encontrada.");
    const event = match.playoff_events;

    // Ya alimentó al siguiente nivel: cambiarlo dejaría a otro jugador en esa llave.
    if (event.level < 3) {
      const { data: nextLevel, error: nextLevelError } = await db
        .from("playoff_events")
        .select("id")
        .eq("season_id", event.season_id)
        .eq("game_id", event.game_id)
        .eq("level", event.level + 1)
        .eq("region", event.level === 1 ? parentRegion(event.region) : FINAL_REGION)
        .maybeSingle();
      if (nextLevelError) failDb(nextLevelError);
      if (nextLevel) throw new Error("El siguiente nivel ya se creó: este resultado ya no cambia.");
    }
    if (data.winner_id && data.winner_id !== match.player_a && data.winner_id !== match.player_b) {
      throw new Error("El ganador debe ser uno de los dos jugadores.");
    }

    const isBracket = match.phase === "bracket";
    if (isBracket && data.winner_id && !data.forfeit && data.loser_wins == null) {
      throw new Error("Indica el marcador de la serie.");
    }

    if (!isBracket) {
      // Corregir un grupo cambia quién pasa: el Top 8 se rehace si aún no se juega.
      const { data: bracket, error: bracketError } = await db
        .from("playoff_matches")
        .select("id, winner_id")
        .eq("event_id", match.event_id)
        .eq("phase", "bracket");
      if (bracketError) failDb(bracketError);
      if ((bracket ?? []).some((m: { winner_id: string | null }) => m.winner_id)) {
        throw new Error("El Top 8 ya tiene resultados: borra esos resultados antes de corregir.");
      }
      if ((bracket ?? []).length > 0) {
        const { error: deleteError } = await db
          .from("playoff_matches")
          .delete()
          .eq("event_id", match.event_id)
          .eq("phase", "bracket");
        if (deleteError) failDb(deleteError);
      }
    }

    const advances = isBracket && event.level > 1 && match.round < lastRound(event.level);
    if (advances) {
      const nextSlot = match.slot >> 1;
      const next = () =>
        db
          .from("playoff_matches")
          .select("id, winner_id")
          .eq("event_id", match.event_id)
          .eq("phase", "bracket")
          .eq("round", match.round + 1)
          .eq("slot", nextSlot);
      const { data: following, error: followingError } = await next().maybeSingle();
      if (followingError) failDb(followingError);
      if (following?.winner_id) {
        throw new Error("La siguiente ronda ya tiene resultado: bórralo antes de corregir.");
      }
      if (following) {
        const { error: deleteError } = await db
          .from("playoff_matches")
          .delete()
          .eq("id", following.id);
        if (deleteError) failDb(deleteError);
      }
    }

    const { error: updateError } = await db
      .from("playoff_matches")
      .update({
        winner_id: data.winner_id,
        loser_wins: isBracket && data.winner_id ? (data.forfeit ? 0 : data.loser_wins) : null,
        forfeit: data.winner_id ? data.forfeit : false,
        updated_by: player.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);
    if (updateError) failDb(updateError);

    if (!isBracket) await createBracketIfGroupsDone(db, match.event_id);
    if (advances && data.winner_id) {
      const { data: pair, error: pairError } = await db
        .from("playoff_matches")
        .select("slot, winner_id")
        .eq("event_id", match.event_id)
        .eq("phase", "bracket")
        .eq("round", match.round)
        .in("slot", [match.slot & ~1, match.slot | 1])
        .order("slot");
      if (pairError) failDb(pairError);
      if (pair?.length === 2 && pair.every((m: { winner_id: string | null }) => m.winner_id)) {
        const { error: nextError } = await db.from("playoff_matches").insert({
          event_id: match.event_id,
          phase: "bracket",
          round: match.round + 1,
          slot: match.slot >> 1,
          player_a: pair[0].winner_id,
          player_b: pair[1].winner_id,
        });
        if (nextError) failDb(nextError);
      }
    }
    cache = null;
    await logAction(
      context.admin,
      player,
      "playoff_match_save",
      "playoff_match",
      match.id,
      match.phase,
    );
    return { ok: true };
  });

async function createBracketIfGroupsDone(db: any, eventId: string) {
  const [entriesRes, matchesRes] = await Promise.all([
    db
      .from("playoff_entries")
      .select("player_id, seed, group_index, points")
      .eq("event_id", eventId),
    db
      .from("playoff_matches")
      .select("player_a, player_b, winner_id, slot")
      .eq("event_id", eventId)
      .eq("phase", "group"),
  ]);
  if (entriesRes.error) failDb(entriesRes.error);
  if (matchesRes.error) failDb(matchesRes.error);
  const matches = matchesRes.data ?? [];
  if (matches.some((m: any) => !m.winner_id)) return;

  const qualified = SEED_GROUPS.map((_, groupIndex) => {
    const table = groupStandings(
      (entriesRes.data ?? [])
        .filter((e: any) => e.group_index === groupIndex)
        .map((e: any) => ({ playerId: e.player_id, seed: e.seed, points: Number(e.points) })),
      matches
        .filter((m: any) => Math.floor(m.slot / 2) === groupIndex)
        .map((m: any) => ({ playerA: m.player_a, playerB: m.player_b, winnerId: m.winner_id })),
    );
    return [table[0].playerId, table[1].playerId] as [string, string];
  });

  const { error } = await db.from("playoff_matches").upsert(
    quarterFinals(qualified).map((m) => ({ ...m, event_id: eventId, phase: "bracket" })),
    { onConflict: "event_id,phase,round,slot", ignoreDuplicates: true },
  );
  if (error) failDb(error);
}

async function loadFrozenEvents(
  admin: ReturnType<typeof getNexusAdmin>,
  seasonId: string,
  gameId: string,
) {
  const db = admin as any;
  const { data: events, error } = await db
    .from("playoff_events")
    .select("id, region")
    .eq("season_id", seasonId)
    .eq("game_id", gameId)
    .eq("level", 1);
  if (error) failDb(error);
  const frozen = new Map<string, FrozenEvent>();
  if (!events?.length) return frozen;

  const ids = events.map((e: { id: string }) => e.id);
  const [entriesRes, matchesRes] = await Promise.all([
    db
      .from("playoff_entries")
      .select("event_id, player_id, seed, group_index, points")
      .in("event_id", ids),
    db
      .from("playoff_matches")
      .select(
        "id, event_id, phase, round, slot, player_a, player_b, winner_id, loser_wins, forfeit",
      )
      .in("event_id", ids)
      .order("round")
      .order("slot"),
  ]);
  if (entriesRes.error) failDb(entriesRes.error);
  if (matchesRes.error) failDb(matchesRes.error);
  const entries: any[] = entriesRes.data ?? [];
  const matches: any[] = matchesRes.data ?? [];

  const playersRes = await admin
    .from("players")
    .select("id, geek_tag")
    .in("id", Array.from(new Set(entries.map((e) => e.player_id))));
  if (playersRes.error) failDb(playersRes.error);
  const tags = new Map((playersRes.data ?? []).map((p) => [p.id, p.geek_tag]));
  const tag = (id: string) => tags.get(id) ?? "—";
  const shapeMatch = (m: any) => ({
    id: m.id as string,
    player_a: m.player_a as string,
    player_b: m.player_b as string,
    tag_a: tag(m.player_a),
    tag_b: tag(m.player_b),
    winner_id: m.winner_id as string | null,
    loser_wins: m.loser_wins as number | null,
    forfeit: m.forfeit as boolean,
  });

  for (const event of events as Array<{ id: string; region: string }>) {
    const eventEntries = entries.filter((e) => e.event_id === event.id);
    const eventMatches = matches.filter((m) => m.event_id === event.id);
    const bracket = eventMatches.filter((m) => m.phase === "bracket");
    const groups = SEED_GROUPS.map((_, groupIndex) => {
      const groupMatches = eventMatches.filter(
        (m) => m.phase === "group" && Math.floor(m.slot / 2) === groupIndex,
      );
      const done = groupMatches.every((m) => m.winner_id);
      const table = groupStandings(
        eventEntries
          .filter((e) => e.group_index === groupIndex)
          .map((e) => ({ playerId: e.player_id, seed: e.seed, points: Number(e.points) })),
        groupMatches.map((m) => ({
          playerA: m.player_a,
          playerB: m.player_b,
          winnerId: m.winner_id,
        })),
      );
      return {
        players: table.map((p, i) => ({
          player_id: p.playerId,
          geek_tag: tag(p.playerId),
          seed: p.seed,
          wins: p.wins,
          losses: p.losses,
          advances: done && i < 2,
        })),
        matches: groupMatches.map(shapeMatch),
      };
    });
    frozen.set(event.region, {
      groups,
      bracket: bracket.map(shapeMatch),
      top_four: bracket.filter((m) => m.winner_id).map((m) => tag(m.winner_id)),
      top_four_ids: bracket.filter((m) => m.winner_id).map((m) => m.winner_id as string),
    });
  }
  return frozen;
}

async function loadBracketEvents(
  admin: ReturnType<typeof getNexusAdmin>,
  seasonId: string,
  gameId: string,
) {
  const db = admin as any;
  const { data: events, error } = await db
    .from("playoff_events")
    .select("id, region, level")
    .eq("season_id", seasonId)
    .eq("game_id", gameId)
    .gt("level", 1);
  if (error) failDb(error);
  const brackets = new Map<string, BracketEvent>();
  if (!events?.length) return brackets;

  const { data: matches, error: matchesError } = await db
    .from("playoff_matches")
    .select("id, event_id, round, slot, player_a, player_b, winner_id, loser_wins, forfeit")
    .in(
      "event_id",
      events.map((e: { id: string }) => e.id),
    )
    .order("round")
    .order("slot");
  if (matchesError) failDb(matchesError);

  const playerIds = Array.from(
    new Set((matches ?? []).flatMap((m: any) => [m.player_a, m.player_b])),
  ) as string[];
  const playersRes = await admin.from("players").select("id, geek_tag").in("id", playerIds);
  if (playersRes.error) failDb(playersRes.error);
  const tags = new Map((playersRes.data ?? []).map((p) => [p.id, p.geek_tag]));
  const tag = (id: string) => tags.get(id) ?? "—";

  for (const event of events as Array<{ id: string; region: string; level: number }>) {
    const eventMatches = (matches ?? []).filter((m: any) => m.event_id === event.id);
    const last = lastRound(event.level);
    const shaped = (round: number): FrozenMatch[] =>
      eventMatches
        .filter((m: any) => m.round === round)
        .map((m: any) => ({
          id: m.id,
          player_a: m.player_a,
          player_b: m.player_b,
          tag_a: tag(m.player_a),
          tag_b: tag(m.player_b),
          winner_id: m.winner_id,
          loser_wins: m.loser_wins,
          forfeit: m.forfeit,
        }));
    const winners = (round: number) =>
      shaped(round)
        .map((m) => m.winner_id)
        .filter((id): id is string => Boolean(id));
    const lastWinners = winners(last);
    brackets.set(event.region, {
      level: event.level,
      rounds: Array.from({ length: last + 1 }, (_, round) => ({
        name: ROUND_NAMES[round],
        matches: shaped(round),
      })),
      top_four_ids: event.level === 2 ? lastWinners : [],
      top_four: event.level === 2 ? lastWinners.map(tag) : [],
      champion: event.level === 3 && lastWinners[0] ? tag(lastWinners[0]) : null,
    });
  }
  return brackets;
}

/** Puntos del ranking general y desempates de cada jugador de la temporada. */
async function loadSeedingStats(
  admin: ReturnType<typeof getNexusAdmin>,
  gameId: string,
  season: { start_date: string; end_date: string },
) {
  const rows = await fetchSeasonResults(admin, gameId, season);
  const months = qualifyingMonths(rows.map(monthOf).sort()[0]);
  const window = rows.filter((row) => months.includes(monthOf(row)));
  const firstDates = new Map<string, string>();
  for (const row of rows) {
    const date = row.tournaments.tournament_date;
    const current = firstDates.get(row.player_id);
    if (!current || date < current) firstDates.set(row.player_id, date);
  }
  return new Map(
    standingsOf(
      window.map((row) => ({
        playerId: row.player_id,
        subregion: "general",
        date: row.tournaments.tournament_date,
        month: monthOf(row),
        points: row.points_earned ?? 0,
        omw: Number(row.omw_percentage),
      })),
    ).map((s) => [s.playerId, { ...s, firstDate: firstDates.get(s.playerId) ?? "9999-12-31" }]),
  );
}

export const createPlayoffBracket = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { level: 2 | 3; region: string; extended_tags: string[] }) =>
    z
      .object({
        level: z.union([z.literal(2), z.literal(3)]),
        region: z.string().trim().min(2).max(120),
        extended_tags: z.array(z.string().trim().min(1).max(60)).max(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const current = await computeLevelOne();
    if (!current) throw new Error("No hay temporada activa con resultados.");

    let qualified: string[];
    const region = data.level === 3 ? FINAL_REGION : data.region;
    if (data.level === 2) {
      const parent = current.parents.find((p) => p.name === data.region);
      if (!parent?.ready) {
        throw new Error("Faltan subregiones por terminar su Top 8.");
      }
      qualified = current.subregions
        .filter((s) => parentRegion(s.name) === data.region)
        .flatMap((s) => s.frozen!.top_four_ids);
    } else {
      if (!current.final.ready) throw new Error("Faltan regiones por terminar su Nivel 2.");
      if (new Set(data.extended_tags).size !== 4) {
        throw new Error("Captura los 4 jugadores de Zona Extendida, sin repetir.");
      }
      const { data: extended, error } = await admin
        .from("players")
        .select("id, geek_tag")
        .in("geek_tag", data.extended_tags);
      if (error) failDb(error);
      const missing = data.extended_tags.filter(
        (tag) => !(extended ?? []).some((p) => p.geek_tag === tag),
      );
      if (missing.length) throw new Error(`No existe: ${missing.join(", ")}`);
      qualified = [
        ...current.parents.flatMap((p) => p.bracket!.top_four_ids),
        ...(extended ?? []).map((p) => p.id),
      ];
    }
    if (new Set(qualified).size !== PLAYOFF_SIZE) {
      throw new Error(`Se necesitan ${PLAYOFF_SIZE} jugadores distintos.`);
    }

    const season = await getActiveSeason(admin);
    const stats = await loadSeedingStats(admin, current.game_id, season!);
    const ordered = qualified
      .map(
        (playerId) =>
          stats.get(playerId) ?? {
            playerId,
            points: 0,
            omw: 0,
            played: 0,
            firstDate: "9999-12-31",
          },
      )
      .sort(compareSeeding);

    const { data: eventId, error } = await (admin as any).rpc("create_playoff_bracket", {
      p_season_id: current.season_id,
      p_game_id: current.game_id,
      p_level: data.level,
      p_region: region,
      p_actor_id: player.id,
      p_entries: ordered.map((s, i) => ({
        player_id: s.playerId,
        seed: i + 1,
        points: s.points,
      })),
      p_matches: firstRound(ordered.map((s) => s.playerId)),
    });
    if (error) {
      if (error.code === "23505") throw new Error("Este nivel ya se creó.");
      failDb(error);
    }
    cache = null;
    await logAction(admin, player, "playoff_bracket_create", "playoff_event", eventId, region);
    return { ok: true };
  });

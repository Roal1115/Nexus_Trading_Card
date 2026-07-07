import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusUser } from "./nexus-auth.middleware";

const MIN_ROUNDS = 5;

export const getMetaStats = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator(
    (d: {
      game_id: string;
      season_id?: string | null;
      zone?: string | null;
      store_id?: string | null;
      date_from?: string | null;
      date_to?: string | null;
    }) =>
      z
        .object({
          game_id: z.string().uuid(),
          season_id: z.string().uuid().nullable().optional(),
          zone: z.string().nullable().optional(),
          store_id: z.string().uuid().nullable().optional(),
          date_from: z.string().nullable().optional(),
          date_to: z.string().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;

    // 1. Obtener torneos filtrados
    let tournamentQuery = admin
      .from("tournaments")
      .select("id, tournament_date, store_id, stores!inner(zone)")
      .eq("game_id", data.game_id)
      .eq("status", "PUBLISHED");

    if (data.date_from) tournamentQuery = tournamentQuery.gte("tournament_date", data.date_from);
    if (data.date_to) tournamentQuery = tournamentQuery.lte("tournament_date", data.date_to);
    if (data.store_id) tournamentQuery = tournamentQuery.eq("store_id", data.store_id);
    if (data.zone) tournamentQuery = tournamentQuery.eq("stores.zone", data.zone);

    const { data: tournaments } = await tournamentQuery;
    const tournamentIds = (tournaments ?? []).map((t: any) => t.id);

    if (tournamentIds.length === 0) {
      return { leaders: [], total_rounds: 0, filters: data };
    }

    // 2. Todas las rondas del meta
    const { data: rounds } = await admin
      .from("tournament_round_results")
      .select("player_leader_id, opponent_leader_id, won_match, turn_order, is_bye")
      .in("tournament_id", tournamentIds)
      .eq("is_bye", false)
      .not("won_match", "is", null);

    const allRounds = rounds ?? [];
    const totalRounds = allRounds.length;

    // 3. Agrupar por player_leader_id
    const leaderMap = new Map<
      string,
      {
        total: number;
        wins: number;
        first: number;
        firstWins: number;
        second: number;
        secondWins: number;
      }
    >();

    for (const r of allRounds as any[]) {
      if (!r.player_leader_id) continue;
      const entry = leaderMap.get(r.player_leader_id) ?? {
        total: 0,
        wins: 0,
        first: 0,
        firstWins: 0,
        second: 0,
        secondWins: 0,
      };
      entry.total++;
      if (r.won_match) entry.wins++;
      if (r.turn_order === "first") {
        entry.first++;
        if (r.won_match) entry.firstWins++;
      }
      if (r.turn_order === "second") {
        entry.second++;
        if (r.won_match) entry.secondWins++;
      }
      leaderMap.set(r.player_leader_id, entry);
    }

    // 4. Filtrar mínimo de rondas y fetchear info de leaders
    const qualifiedIds = Array.from(leaderMap.entries())
      .filter(([, v]) => v.total >= MIN_ROUNDS)
      .map(([id]) => id);

    if (qualifiedIds.length === 0) {
      return { leaders: [], total_rounds: totalRounds, filters: data };
    }

    // Resolver canónicos
    const { data: rawLeaders } = await admin
      .from("deck_identifiers")
      .select("id, base_name, card_image, card_set_id, colors, canonical_leader_id")
      .in("id", qualifiedIds);

    const variantToCanonical = new Map<string, string>();
    for (const l of rawLeaders ?? []) {
      if (l.canonical_leader_id) variantToCanonical.set(l.id, l.canonical_leader_id);
    }

    const missingCanonicalIds = Array.from(new Set(Array.from(variantToCanonical.values()))).filter(
      (id) => !(rawLeaders ?? []).find((l: any) => l.id === id),
    );

    const { data: canonicalLeaders } = missingCanonicalIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, colors, canonical_leader_id")
          .in("id", missingCanonicalIds)
      : { data: [] as any[] };

    const allLeaders = new Map(
      [...(rawLeaders ?? []), ...(canonicalLeaders ?? [])].map((l: any) => [l.id, l]),
    );

    const resolveId = (id: string) => variantToCanonical.get(id) ?? id;

    // Consolidar por canónico
    const canonicalMap = new Map<string, typeof leaderMap extends Map<any, infer V> ? V : never>();
    for (const [id, stats] of leaderMap.entries()) {
      const canonicalId = resolveId(id);
      const existing = canonicalMap.get(canonicalId);
      if (existing) {
        existing.total += stats.total;
        existing.wins += stats.wins;
        existing.first += stats.first;
        existing.firstWins += stats.firstWins;
        existing.second += stats.second;
        existing.secondWins += stats.secondWins;
      } else {
        canonicalMap.set(canonicalId, { ...stats });
      }
    }

    // 5. Construir resultado final
    const leaders = Array.from(canonicalMap.entries())
      .filter(([, v]) => v.total >= MIN_ROUNDS)
      .map(([canonicalId, stats]) => {
        const leader = allLeaders.get(canonicalId);
        return {
          leader_id: canonicalId,
          leader_name: leader?.base_name ?? "Desconocido",
          leader_image: leader?.card_image ?? null,
          card_set_id: leader?.card_set_id ?? null,
          colors: (leader?.colors ?? []) as string[],
          total_rounds: stats.total,
          wins: stats.wins,
          win_rate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 1000) / 10 : 0,
          play_rate: totalRounds > 0 ? Math.round((stats.total / totalRounds) * 1000) / 10 : 0,
          first_win_rate:
            stats.first > 0 ? Math.round((stats.firstWins / stats.first) * 1000) / 10 : null,
          second_win_rate:
            stats.second > 0 ? Math.round((stats.secondWins / stats.second) * 1000) / 10 : null,
          first_rounds: stats.first,
          second_rounds: stats.second,
        };
      })
      .sort((a, b) => b.play_rate - a.play_rate);

    return { leaders, total_rounds: totalRounds, filters: data };
  });

export const getMetaFilterOptions = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { game_id: string }) => z.object({ game_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = context;

    const [gamesRes, storesRes, zonesRes, seasonsRes] = await Promise.all([
      admin.from("games").select("id, name, slug").eq("is_active", true).order("name"),
      admin.from("stores").select("id, name, city, zone").eq("is_active", true).order("name"),
      admin.from("stores").select("zone").eq("is_active", true),
      admin
        .from("seasons")
        .select("id, name, slug, start_date, end_date, is_active")
        .order("created_at", { ascending: false }),
    ]);

    const uniqueZones = Array.from(
      new Set(((zonesRes.data ?? []) as any[]).map((s: any) => s.zone).filter(Boolean)),
    ).sort();

    return {
      games: gamesRes.data ?? [],
      stores: storesRes.data ?? [],
      zones: uniqueZones,
      seasons: seasonsRes.data ?? [],
    };
  });

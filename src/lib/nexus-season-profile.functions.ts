// Perfil público de temporada: tarjeta compartible con récord, líder más
// jugado, puntos y rank del jugador en una temporada.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNexusAdmin } from "./nexus-admin.server";
import { resolveLeaders } from "./nexus-meta.functions";

export const getSeasonProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { player_tag: string; season_id: string }) =>
    z.object({ player_tag: z.string().min(1), season_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();

    const { data: player } = await admin
      .from("players")
      .select("id, geek_tag, display_name, avatar_url, is_profile_public")
      .ilike("geek_tag", data.player_tag)
      .maybeSingle();
    if (!player) return { not_found: true as const };
    if (player.is_profile_public === false) {
      return { is_private: true as const, geek_tag: player.geek_tag };
    }

    const { data: season } = await admin
      .from("seasons")
      .select("id, name, slug, start_date, end_date")
      .eq("id", data.season_id)
      .maybeSingle();
    if (!season) return { not_found: true as const };

    // Torneos publicados de la temporada
    const { data: tournaments } = await admin
      .from("tournaments")
      .select("id, game_id, tournament_date, stores(name)")
      .eq("season_id", season.id)
      .eq("status", "PUBLISHED");
    const tournamentIds = (tournaments ?? []).map((t: any) => t.id);

    if (!tournamentIds.length) {
      return { player, season, results: [], record: null, rank: null, leaders: [] };
    }

    // Resultados de TODOS los jugadores (para el rank) y los del jugador
    const { data: allResults } = await admin
      .from("tournament_results")
      .select("player_id, wins, losses, draws, points_earned, rank, tournament_id")
      .in("tournament_id", tournamentIds);

    const byPlayer = new Map<string, number>();
    for (const r of allResults ?? []) {
      byPlayer.set(r.player_id, (byPlayer.get(r.player_id) ?? 0) + Number(r.points_earned ?? 0));
    }
    const standings = Array.from(byPlayer.entries()).sort((a, b) => b[1] - a[1]);
    const rankIndex = standings.findIndex(([id]) => id === player.id);

    const mine = (allResults ?? []).filter((r: any) => r.player_id === player.id);
    const record = {
      wins: mine.reduce((s: number, r: any) => s + (r.wins ?? 0), 0),
      losses: mine.reduce((s: number, r: any) => s + (r.losses ?? 0), 0),
      draws: mine.reduce((s: number, r: any) => s + (r.draws ?? 0), 0),
      points: mine.reduce((s: number, r: any) => s + Number(r.points_earned ?? 0), 0),
      tournaments_played: mine.length,
      best_rank: mine.length ? Math.min(...mine.map((r: any) => r.rank ?? 999)) : null,
    };

    // Stats por líder en la temporada
    const { data: rounds } = await admin
      .from("tournament_round_results")
      .select("player_leader_id, won_match")
      .in("tournament_id", tournamentIds)
      .eq("player_id", player.id)
      .eq("is_bye", false)
      .not("won_match", "is", null);

    const leaderAgg = new Map<string, { total: number; wins: number }>();
    for (const r of rounds ?? []) {
      if (!r.player_leader_id) continue;
      const e = leaderAgg.get(r.player_leader_id) ?? { total: 0, wins: 0 };
      e.total++;
      if (r.won_match) e.wins++;
      leaderAgg.set(r.player_leader_id, e);
    }
    const { info, resolve } = await resolveLeaders(admin, Array.from(leaderAgg.keys()));
    const canonical = new Map<string, { total: number; wins: number }>();
    for (const [id, stats] of leaderAgg.entries()) {
      const cid = resolve(id);
      const e = canonical.get(cid) ?? { total: 0, wins: 0 };
      e.total += stats.total;
      e.wins += stats.wins;
      canonical.set(cid, e);
    }
    const leaders = Array.from(canonical.entries())
      .map(([id, stats]) => {
        const l = info.get(id);
        return {
          leader_id: id,
          leader_name: l?.base_name ?? "Desconocido",
          leader_image: l?.card_image ?? null,
          total_rounds: stats.total,
          wins: stats.wins,
          win_rate: Math.round((stats.wins / stats.total) * 1000) / 10,
        };
      })
      .sort((a, b) => b.total_rounds - a.total_rounds);

    return {
      player: {
        geek_tag: player.geek_tag,
        display_name: player.display_name,
        avatar_url: player.avatar_url,
      },
      season,
      record,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      total_players: standings.length,
      leaders,
    };
  });

export const getSeasonsList = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getNexusAdmin();
  const { data } = await admin
    .from("seasons")
    .select("id, name, slug, start_date, end_date, is_active")
    .order("start_date", { ascending: false });
  return data ?? [];
});

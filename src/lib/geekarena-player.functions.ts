import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireGeekarenaUser } from "./geekarena-auth.middleware";

export const getMyDashboard = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const storeRes = player.home_store_id
      ? await admin
          .from("stores")
          .select("city, name")
          .eq("id", player.home_store_id)
          .maybeSingle()
      : { data: null as { city: string | null; name: string | null } | null };

    const now = new Date();
    const month = now.getMonth() + 1;
    const semester = month <= 6 ? 1 : 2;
    const year = now.getFullYear();
    const semKey = `${year}-S${semester}`;

    const { data: snapshots } = await admin
      .from("leaderboard_snapshots")
      .select(
        "game_id, total_points, tournaments_played, tournaments_won, rank_position",
      )
      .eq("player_id", player.id)
      .eq("timeframe_type", "SEMESTRAL")
      .eq("timeframe_value", semKey);

    const snapGameIds = (snapshots ?? []).map((s) => s.game_id);
    const { data: snapGames } = snapGameIds.length
      ? await admin
          .from("games")
          .select("id, name, slug")
          .in("id", snapGameIds)
      : { data: [] as Array<{ id: string; name: string; slug: string }> };

    const snapGameMap = new Map(
      (snapGames ?? []).map((g) => [g.id, g]),
    );

    const tcgStats = (snapshots ?? [])
      .map((s) => ({
        game_id: s.game_id,
        game_name: snapGameMap.get(s.game_id)?.name ?? "—",
        game_slug: snapGameMap.get(s.game_id)?.slug ?? "",
        total_points: s.total_points ?? 0,
        tournaments_played: s.tournaments_played ?? 0,
        tournaments_won: s.tournaments_won ?? 0,
        rank_position: s.rank_position ?? 0,
      }))
      .sort((a, b) => b.total_points - a.total_points);

    const { data: results } = await admin
      .from("tournament_results")
      .select(
        "rank, points_earned, match_points, wins, losses, draws, tournament_id, tournaments!inner(status, tournament_date, game_id, store_id)",
      )
      .eq("player_id", player.id)
      .eq("tournaments.status", "PUBLISHED")
      .order("tournaments(tournament_date)", { ascending: false })
      .limit(100);

    const tournamentIds = Array.from(
      new Set((results ?? []).map((r: any) => r.tournament_id)),
    );

    const { data: maxPoints } = tournamentIds.length
      ? await admin
          .from("tournament_results")
          .select("tournament_id, match_points")
          .in("tournament_id", tournamentIds)
          .eq("rank", 1)
      : { data: [] as Array<{ tournament_id: string; match_points: number | null }> };

    const maxPointsMap = new Map(
      (maxPoints ?? []).map((m: any) => [m.tournament_id, m.match_points ?? 0]),
    );

    const storeIds = Array.from(
      new Set(
        (results ?? [])
          .map((r: any) => r.tournaments?.store_id)
          .filter(Boolean),
      ),
    );
    const allGameIds = Array.from(
      new Set(
        (results ?? [])
          .map((r: any) => r.tournaments?.game_id)
          .filter(Boolean),
      ),
    );

    const [storesData, gamesData] = await Promise.all([
      storeIds.length
        ? admin.from("stores").select("id, name, city").in("id", storeIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; name: string; city: string | null }>,
          }),
      allGameIds.length
        ? admin.from("games").select("id, name").in("id", allGameIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);

    const storeMap = new Map(
      (storesData.data ?? []).map((s: any) => [s.id, s]),
    );
    const gameMap = new Map(
      (gamesData.data ?? []).map((g: any) => [g.id, g.name as string]),
    );

    const events = (results ?? []).map((r: any) => {
      const t = r.tournaments;
      const store = t ? (storeMap.get(t.store_id) as any) : null;
      const maxMp = (maxPointsMap.get(r.tournament_id) as number | undefined) ?? 0;

      let calculatedWins: number | null = null;
      let calculatedLosses: number | null = null;
      let totalRounds: number | null = null;

      if (r.wins != null) {
        calculatedWins = r.wins;
        calculatedLosses = r.losses ?? 0;
        totalRounds = (r.wins ?? 0) + (r.losses ?? 0) + (r.draws ?? 0);
      } else if (r.match_points != null && maxMp > 0) {
        totalRounds = Math.round(maxMp / 3);
        calculatedWins = Math.floor((r.match_points ?? 0) / 3);
        const remaining = (r.match_points ?? 0) % 3;
        const draws = remaining === 1 ? 1 : 0;
        calculatedLosses = totalRounds - calculatedWins - draws;
      }

      return {
        id: r.tournament_id,
        date: t?.tournament_date ?? "—",
        store: store?.name ?? "—",
        city: store?.city ?? "—",
        tcg: t ? (gameMap.get(t.game_id) ?? "—") : "—",
        placement: r.rank,
        pointsEarned: Number(r.points_earned ?? 0),
        matchPoints: r.match_points ?? null,
        maxMatchPoints: maxMp > 0 ? maxMp : null,
        wins: calculatedWins,
        losses: calculatedLosses,
        totalRounds,
      };
    });

    return {
      storeCity:
        (storeRes.data as { city: string | null } | null)?.city ?? null,
      storeName:
        (storeRes.data as { name: string | null } | null)?.name ?? null,
      tcgStats,
      semesterLabel: `S${semester} ${year}`,
      monthLabel: new Date(year, month - 1).toLocaleString("es-MX", {
        month: "long",
        year: "numeric",
      }),
      events,
    };
  });

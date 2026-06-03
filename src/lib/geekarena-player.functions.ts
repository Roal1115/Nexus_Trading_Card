import { createServerFn } from "@tanstack/react-start";
import { requireGeekarenaUser } from "./geekarena-auth.middleware";

export const getMyDashboard = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const storeRes = player.home_store_id
      ? await admin
          .from("stores")
          .select("city")
          .eq("id", player.home_store_id)
          .maybeSingle()
      : { data: null as { city: string | null } | null };

    const now = new Date();
    const month = now.getMonth() + 1;
    const semester = month <= 6 ? 1 : 2;
    const year = now.getFullYear();
    const semKey = `${year}-S${semester}`;

    const { data: snapshot } = await admin
      .from("leaderboard_snapshots")
      .select(
        "total_points, tournaments_played, tournaments_won, rank_position",
      )
      .eq("player_id", player.id)
      .eq("timeframe_type", "SEMESTRAL")
      .eq("timeframe_value", semKey)
      .is("store_id", null)
      .maybeSingle();

    const { data: results } = await admin
      .from("tournament_results")
      .select("rank, points_earned, tournament_id, tournaments!inner(status, tournament_date)")
      .eq("player_id", player.id)
      .eq("tournaments.status", "PUBLISHED")
      .order("tournaments(tournament_date)", { ascending: false })
      .limit(8);

    const tournamentIds = (results ?? []).map((r) => r.tournament_id);
    let events: Array<{
      id: string;
      date: string;
      store: string;
      city: string;
      tcg: string;
      placement: number;
      pointsEarned: number;
    }> = [];

    if (tournamentIds.length > 0) {
      const { data: tournaments } = await admin
        .from("tournaments")
        .select("id, tournament_date, store_id, game_id")
        .in("id", tournamentIds);

      const storeIds = Array.from(
        new Set((tournaments ?? []).map((t) => t.store_id)),
      );
      const gameIds = Array.from(
        new Set((tournaments ?? []).map((t) => t.game_id)),
      );

      const [storesData, gamesData] = await Promise.all([
        storeIds.length
          ? admin.from("stores").select("id, name, city").in("id", storeIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string; city: string | null }> }),
        gameIds.length
          ? admin.from("games").select("id, name").in("id", gameIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      ]);

      const storeMap = new Map(
        (storesData.data ?? []).map((s) => [s.id, s]),
      );
      const gameMap = new Map(
        (gamesData.data ?? []).map((g) => [g.id, g.name]),
      );

      events = (results ?? []).map((r) => {
        const t = (tournaments ?? []).find((x) => x.id === r.tournament_id);
        const store = t ? storeMap.get(t.store_id) : null;
        return {
          id: r.tournament_id,
          date: t?.tournament_date ?? "—",
          store: store?.name ?? "—",
          city: store?.city ?? "—",
          tcg: t ? (gameMap.get(t.game_id) ?? "—") : "—",
          placement: r.rank,
          pointsEarned: r.points_earned ?? 0,
        };
      });
    }


    return {
      storeCity: (storeRes.data as { city: string | null } | null)?.city ?? null,
      totalPoints: snapshot?.total_points ?? 0,
      tournamentsPlayed: snapshot?.tournaments_played ?? 0,
      tournamentsWon: snapshot?.tournaments_won ?? 0,
      rankPosition: snapshot?.rank_position ?? 0,
      semesterLabel: `S${semester} ${year}`,
      events,
    };
  });

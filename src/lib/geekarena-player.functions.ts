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
    const year = now.getFullYear();

    const { data: activeSeason } = await admin
      .from("seasons")
      .select("id, name, slug, start_date, end_date")
      .eq("is_active", true)
      .maybeSingle();

    const semKey = (activeSeason?.slug as string | undefined) ?? null;
    const semesterLabel = (activeSeason?.name as string | undefined) ?? "Sin temporada";

    const snapshotsRes = semKey
      ? await admin
          .from("leaderboard_snapshots")
          .select(
            "game_id, total_points, tournaments_played, tournaments_won, rank_position",
          )
          .eq("player_id", player.id)
          .eq("timeframe_type", "SEMESTRAL")
          .eq("timeframe_value", semKey)
      : { data: [] as any[] };
    const rawSnapshots = snapshotsRes.data ?? [];
    const snapshots = Array.from(
      rawSnapshots.reduce((map: Map<string, any>, s: any) => {
        const existing = map.get(s.game_id);
        if (!existing || (s.total_points ?? 0) > (existing.total_points ?? 0)) {
          map.set(s.game_id, s);
        }
        return map;
      }, new Map<string, any>()).values(),
    );

    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const { data: monthlyRaw } = semKey
      ? await admin
          .from("leaderboard_snapshots")
          .select("game_id, rank_position")
          .eq("player_id", player.id)
          .eq("timeframe_type", "MONTHLY")
          .eq("timeframe_value", monthKey)
      : { data: [] as any[] };
    const monthlyMap = new Map<string, number>();
    for (const m of monthlyRaw ?? []) {
      const existing = monthlyMap.get(m.game_id);
      if (existing == null || (m.rank_position ?? 0) < existing) {
        monthlyMap.set(m.game_id, m.rank_position ?? 0);
      }
    }


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
        game_id: t?.game_id ?? null,
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
      semesterLabel,
      monthLabel: new Date(year, month - 1).toLocaleString("es-MX", {
        month: "long",
        year: "numeric",
      }),
      events,
    };
  });

export const getTournamentDetail = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: tournament } = await admin
      .from("tournaments")
      .select(
        "id, tournament_date, qualifying_month, qualifying_year, qualifying_semester, game_id, store_id, status",
      )
      .eq("id", data.tournament_id)
      .eq("status", "PUBLISHED")
      .single();

    if (!tournament) throw new Error("Torneo no encontrado");

    const [{ data: store }, { data: game }, { data: results }] = await Promise.all([
      admin
        .from("stores")
        .select("name, city, state, country")
        .eq("id", tournament.store_id)
        .single(),
      admin
        .from("games")
        .select("name, publisher")
        .eq("id", tournament.game_id)
        .single(),
      admin
        .from("tournament_results")
        .select(
          "player_id, rank, match_points, points_earned, omw_percentage, wins, losses, draws",
        )
        .eq("tournament_id", data.tournament_id)
        .order("rank", { ascending: true }),
    ]);

    const playerIds = (results ?? []).map((r: any) => r.player_id);
    const { data: players } = playerIds.length
      ? await admin
          .from("players")
          .select("id, geek_tag")
          .in("id", playerIds)
      : { data: [] as Array<{ id: string; geek_tag: string }> };

    const playerMap = new Map(
      (players ?? []).map((p: any) => [p.id, p.geek_tag]),
    );

    const maxMatchPoints = Math.max(
      0,
      ...(results ?? []).map((r: any) => r.match_points ?? 0),
    );

    const rankings = (results ?? []).map((r: any) => {
      let calcWins: number | null = r.wins ?? null;
      let calcLosses: number | null = r.losses ?? null;

      if (r.wins == null && r.match_points != null && maxMatchPoints > 0) {
        const totalRounds = Math.round(maxMatchPoints / 3);
        calcWins = Math.floor((r.match_points ?? 0) / 3);
        const draws = (r.match_points ?? 0) % 3 === 1 ? 1 : 0;
        calcLosses = totalRounds - calcWins - draws;
      }

      return {
        rank: r.rank,
        geek_tag: (playerMap.get(r.player_id) as string | undefined) ?? "—",
        player_id: r.player_id,
        match_points: r.match_points,
        points_earned: Number(r.points_earned ?? 0).toFixed(2),
        omw_percentage: r.omw_percentage,
        wins: calcWins,
        losses: calcLosses,
        draws: r.draws ?? 0,
        is_me: r.player_id === player.id,
      };
    });

    return {
      tournament_id: tournament.id,
      date: tournament.tournament_date,
      month: tournament.qualifying_month,
      year: tournament.qualifying_year,
      semester: tournament.qualifying_semester,
      store: {
        name: (store as any)?.name ?? "—",
        city: (store as any)?.city ?? "—",
        state: (store as any)?.state ?? "—",
      },
      game: {
        name: (game as any)?.name ?? "—",
        publisher: (game as any)?.publisher ?? "—",
      },
      total_participants: rankings.length,
      my_rank: rankings.find((r) => r.is_me)?.rank ?? null,
      rankings,
    };
  });

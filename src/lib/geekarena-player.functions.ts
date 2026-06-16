import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireGeekarenaUser } from "./geekarena-auth.middleware";

export const getMyDashboard = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const storeRes = player.home_store_id
      ? await admin.from("stores").select("city, name").eq("id", player.home_store_id).maybeSingle()
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
          .select("game_id, total_points, tournaments_played, tournaments_won, rank_position")
          .eq("player_id", player.id)
          .eq("timeframe_type", "SEMESTRAL")
          .eq("timeframe_value", semKey)
      : { data: [] as any[] };
    const rawSnapshots = snapshotsRes.data ?? [];
    const snapshots = Array.from(
      rawSnapshots
        .reduce((map: Map<string, any>, s: any) => {
          const existing = map.get(s.game_id);
          if (!existing || (s.total_points ?? 0) > (existing.total_points ?? 0)) {
            map.set(s.game_id, s);
          }
          return map;
        }, new Map<string, any>())
        .values(),
    );

    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const { data: monthlyRaw } = semKey
      ? await admin
          .from("leaderboard_snapshots")
          .select("game_id, rank_position, total_points")
          .eq("player_id", player.id)
          .eq("timeframe_type", "MONTHLY")
          .eq("timeframe_value", monthKey)
      : { data: [] as any[] };
    const monthlyMap = new Map<string, { rank: number; points: number }>();
    for (const m of monthlyRaw ?? []) {
      const existing = monthlyMap.get(m.game_id);
      const rank = m.rank_position ?? 0;
      const pts = m.total_points ?? 0;
      if (!existing || (rank > 0 && (existing.rank === 0 || rank < existing.rank)) || pts > existing.points) {
        monthlyMap.set(m.game_id, { rank, points: pts });
      }
    }

    const snapGameIds = (snapshots ?? []).map((s) => s.game_id);
    const { data: snapGames } = snapGameIds.length
      ? await admin.from("games").select("id, name, slug").in("id", snapGameIds)
      : { data: [] as Array<{ id: string; name: string; slug: string }> };

    const snapGameMap = new Map((snapGames ?? []).map((g) => [g.id, g]));

    const tcgStats = (snapshots ?? [])
      .map((s) => ({
        game_id: s.game_id,
        game_name: snapGameMap.get(s.game_id)?.name ?? "—",
        game_slug: snapGameMap.get(s.game_id)?.slug ?? "",
        total_points: s.total_points ?? 0,
        tournaments_played: s.tournaments_played ?? 0,
        tournaments_won: s.tournaments_won ?? 0,
        rank_position: s.rank_position ?? 0,
        monthly_rank_position: monthlyMap.get(s.game_id)?.rank ?? 0,
        monthly_total_points: monthlyMap.get(s.game_id)?.points ?? 0,
      }))
      .sort((a, b) => b.total_points - a.total_points);

    const { data: tcgIdRows } = await admin
      .from("player_tcg_ids" as any)
      .select("game_id")
      .eq("player_id", player.id);

    const { data: privacyRow } = await admin
      .from("players")
      .select("id, is_profile_public" as any)
      .eq("id", player.id)
      .maybeSingle();
    const isProfilePublic = ((privacyRow as any)?.is_profile_public ?? true) as boolean;

    const { data: results } = await admin
      .from("tournament_results")
      .select(
        "rank, points_earned, match_points, wins, losses, draws, tournament_id, tournaments!inner(status, tournament_date, game_id, store_id)",
      )
      .eq("player_id", player.id)
      .in("tournaments.status", ["APPROVED", "PUBLISHED"])
      .order("tournaments(tournament_date)", { ascending: false })
      .limit(100);

    const tournamentIds = Array.from(new Set((results ?? []).map((r: any) => r.tournament_id)));

    const { data: maxPoints } = tournamentIds.length
      ? await admin
          .from("tournament_results")
          .select("tournament_id, match_points")
          .in("tournament_id", tournamentIds)
          .eq("rank", 1)
      : { data: [] as Array<{ tournament_id: string; match_points: number | null }> };

    const maxPointsMap = new Map((maxPoints ?? []).map((m: any) => [m.tournament_id, m.match_points ?? 0]));

    const storeIds = Array.from(new Set((results ?? []).map((r: any) => r.tournaments?.store_id).filter(Boolean)));
    const allGameIds = Array.from(new Set((results ?? []).map((r: any) => r.tournaments?.game_id).filter(Boolean)));

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

    const storeMap = new Map((storesData.data ?? []).map((s: any) => [s.id, s]));
    const gameMap = new Map((gamesData.data ?? []).map((g: any) => [g.id, g.name as string]));

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
        tournament_status: (t?.status ?? null) as "APPROVED" | "PUBLISHED" | null,
      };
    });

    return {
      storeCity: (storeRes.data as { city: string | null } | null)?.city ?? null,
      storeName: (storeRes.data as { name: string | null } | null)?.name ?? null,
      tcgStats,
      semesterLabel,
      monthLabel: new Date(year, month - 1).toLocaleString("es-MX", {
        month: "long",
        year: "numeric",
      }),
      events,
      is_profile_public: isProfilePublic,
      registered_game_ids: ((tcgIdRows ?? []) as any[]).map((t) => t.game_id),
    };
  });

export const getTournamentDetail = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { tournament_id: string }) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: tournament } = await admin
      .from("tournaments")
      .select("id, tournament_date, qualifying_month, qualifying_year, qualifying_semester, game_id, store_id, status")
      .eq("id", data.tournament_id)
      .in("status", ["APPROVED", "PUBLISHED"])
      .single();

    if (!tournament) throw new Error("Torneo no encontrado");

    const [{ data: store }, { data: game }, { data: results }] = await Promise.all([
      admin.from("stores").select("name, city, state, country").eq("id", tournament.store_id).single(),
      admin.from("games").select("name, publisher").eq("id", tournament.game_id).single(),
      admin
        .from("tournament_results")
        .select("player_id, rank, match_points, points_earned, omw_percentage, wins, losses, draws")
        .eq("tournament_id", data.tournament_id)
        .order("rank", { ascending: true }),
    ]);

    const playerIds = (results ?? []).map((r: any) => r.player_id);
    const { data: players } = playerIds.length
      ? await admin.from("players").select("id, geek_tag").in("id", playerIds)
      : { data: [] as Array<{ id: string; geek_tag: string }> };

    const playerMap = new Map((players ?? []).map((p: any) => [p.id, p.geek_tag]));

    const maxMatchPoints = Math.max(0, ...(results ?? []).map((r: any) => r.match_points ?? 0));

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
      game_id: tournament.game_id,
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

export const toggleProfilePrivacy = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { is_public: boolean }) => z.object({ is_public: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin
      .from("players")
      .update({ is_profile_public: data.is_public } as any)
      .eq("id", player.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getPublicProfile = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { player_tag: string }) => z.object({ player_tag: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player: viewer } = context;

    const { data: target } = await admin
      .from("players")
      .select("id, geek_tag, display_name, avatar_url, created_at, home_store_id, is_profile_public" as any)
      .eq("geek_tag", data.player_tag)
      .maybeSingle();

    if (!target) throw new Error("Jugador no encontrado");
    const t = target as any;

    const isOwner = viewer.id === t.id;
    const isSuperior = viewer.role === "admin" || viewer.role === "tcg_manager";
    const isPublic = t.is_profile_public ?? true;
    const canView = isOwner || isSuperior || isPublic;

    if (!canView) {
      return {
        is_private: true as const,
        geek_tag: t.geek_tag as string,
        display_name: null as string | null,
        avatar_url: null as string | null,
        store_name: null as string | null,
        store_city: null as string | null,
        member_since: null as string | null,
        is_owner: false,
        rankings: [] as any[],
        tournaments: [] as any[],
      };
    }

    const [storeRes, snapshotsRes, resultsRes] = await Promise.all([
      t.home_store_id
        ? admin.from("stores").select("name, city").eq("id", t.home_store_id).maybeSingle()
        : Promise.resolve({ data: null as any }),
      admin
        .from("leaderboard_snapshots")
        .select(
          "game_id, timeframe_type, timeframe_value, total_points, rank_position, tournaments_played, tournaments_won",
        )
        .eq("player_id", t.id)
        .eq("timeframe_type", "SEMESTRAL")
        .order("total_points", { ascending: false }),
      admin
        .from("tournament_results")
        .select(
          "rank, points_earned, match_points, omw_percentage, wins, losses, draws, tournament_id, tournaments!inner(status, tournament_date, game_id, store_id)",
        )
        .eq("player_id", t.id)
        .in("tournaments.status", ["APPROVED", "PUBLISHED"])
        .order("tournaments(tournament_date)", { ascending: false })
        .limit(100),
    ]);

    // Dedupe snapshots by game_id, keep highest points
    const snapMap = new Map<string, any>();
    for (const s of (snapshotsRes.data ?? []) as any[]) {
      const ex = snapMap.get(s.game_id);
      if (!ex || (s.total_points ?? 0) > (ex.total_points ?? 0)) {
        snapMap.set(s.game_id, s);
      }
    }
    const snaps = Array.from(snapMap.values());

    const results = (resultsRes.data ?? []) as any[];

    const tStoreIds = Array.from(new Set(results.map((r: any) => r.tournaments?.store_id).filter(Boolean)));
    const gameIds = Array.from(
      new Set([...snaps.map((s) => s.game_id), ...results.map((r: any) => r.tournaments?.game_id).filter(Boolean)]),
    );
    const tournamentIds = results.map((r: any) => r.tournament_id);

    const [storesRes, gamesRes, maxPtsRes] = await Promise.all([
      tStoreIds.length
        ? admin.from("stores").select("id, name, city").in("id", tStoreIds)
        : Promise.resolve({ data: [] as any[] }),
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] }),
      tournamentIds.length
        ? admin
            .from("tournament_results")
            .select("tournament_id, match_points")
            .in("tournament_id", tournamentIds)
            .eq("rank", 1)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const storeMap = new Map(((storesRes.data ?? []) as any[]).map((s: any) => [s.id, s]));
    const gamesMap = new Map(((gamesRes.data ?? []) as any[]).map((g: any) => [g.id, g.name]));
    const maxPtsMap = new Map(
      ((maxPtsRes.data ?? []) as any[]).map((m: any) => [m.tournament_id, m.match_points ?? 0]),
    );

    const tournaments = results.map((r: any) => {
      const tr = r.tournaments;
      const store = tr ? storeMap.get(tr.store_id) : null;
      const maxMp = maxPtsMap.get(r.tournament_id) ?? 0;

      let calcWins: number | null = r.wins;
      let calcLosses: number | null = r.losses;
      if (r.wins == null && r.match_points != null && maxMp > 0) {
        const totalRounds = Math.round(maxMp / 3);
        calcWins = Math.floor((r.match_points ?? 0) / 3);
        const draws = (r.match_points ?? 0) % 3 === 1 ? 1 : 0;
        calcLosses = totalRounds - calcWins - draws;
      }

      return {
        id: r.tournament_id,
        date: tr?.tournament_date ?? "—",
        store: (store as any)?.name ?? "—",
        city: (store as any)?.city ?? "—",
        tcg: gamesMap.get(tr?.game_id) ?? "—",
        game_id: tr?.game_id ?? null,
        placement: r.rank,
        pointsEarned: Number(r.points_earned ?? 0).toFixed(2),
        wins: calcWins,
        losses: calcLosses,
      };
    });

    return {
      is_private: false as const,
      geek_tag: t.geek_tag as string,
      display_name: t.display_name as string | null,
      avatar_url: t.avatar_url as string | null,
      store_name: ((storeRes.data as any)?.name ?? null) as string | null,
      store_city: ((storeRes.data as any)?.city ?? null) as string | null,
      member_since: t.created_at as string | null,
      is_owner: isOwner,
      rankings: snaps.map((s: any) => ({
        game_id: s.game_id,
        game_name: gamesMap.get(s.game_id) ?? "—",
        rank_position: s.rank_position ?? 0,
        total_points: s.total_points ?? 0,
        tournaments_played: s.tournaments_played ?? 0,
        tournaments_won: s.tournaments_won ?? 0,
        timeframe_value: s.timeframe_value,
      })),
      tournaments,
    };
  });

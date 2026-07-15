import { failDb } from "./nexus-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusUser } from "./nexus-auth.middleware";

export const getMyDashboard = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
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
      if (
        !existing ||
        (rank > 0 && (existing.rank === 0 || rank < existing.rank)) ||
        pts > existing.points
      ) {
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

    const maxPointsMap = new Map(
      (maxPoints ?? []).map((m: any) => [m.tournament_id, m.match_points ?? 0]),
    );

    const storeIds = Array.from(
      new Set((results ?? []).map((r: any) => r.tournaments?.store_id).filter(Boolean)),
    );
    const allGameIds = Array.from(
      new Set((results ?? []).map((r: any) => r.tournaments?.game_id).filter(Boolean)),
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

    // Top 3 decks por TCG desde tournament_round_results
    const allTcgGameIds = tcgStats.map((t) => t.game_id);

    // Traer rondas del player con player_leader_id por TCG
    const { data: deckRounds } = allTcgGameIds.length
      ? await admin
          .from("tournament_round_results")
          .select("player_leader_id, tournament_id, tournaments!inner(game_id)")
          .eq("player_id", player.id)
          .eq("is_bye", false)
          .not("player_leader_id", "is", null)
          .in("tournaments.game_id", allTcgGameIds)
      : { data: [] as any[] };

    // Agrupar por game_id → contar usos de cada leader
    const leaderUsageByGame = new Map<string, Map<string, number>>();
    for (const r of (deckRounds ?? []) as any[]) {
      const gameId = r.tournaments?.game_id;
      const leaderId = r.player_leader_id;
      if (!gameId || !leaderId) continue;
      if (!leaderUsageByGame.has(gameId)) leaderUsageByGame.set(gameId, new Map());
      const gameMap = leaderUsageByGame.get(gameId)!;
      gameMap.set(leaderId, (gameMap.get(leaderId) ?? 0) + 1);
    }

    // Top 3 leader IDs por game
    const top3LeaderIdsByGame = new Map<string, string[]>();
    for (const [gameId, usageMap] of leaderUsageByGame.entries()) {
      const sorted = Array.from(usageMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
      top3LeaderIdsByGame.set(gameId, sorted);
    }

    // Fetchear info de esos leaders
    const allTopLeaderIds = Array.from(new Set(Array.from(top3LeaderIdsByGame.values()).flat()));
    const { data: topLeaderRows } = allTopLeaderIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, canonical_leader_id")
          .in("id", allTopLeaderIds)
      : { data: [] as any[] };

    // Resolver canónicos
    const topLeaderMap = new Map((topLeaderRows ?? []).map((l: any) => [l.id, l]));
    const resolveTopLeader = (id: string) => {
      const l = topLeaderMap.get(id);
      if (l?.canonical_leader_id) return topLeaderMap.get(l.canonical_leader_id) ?? l;
      return l;
    };

    // Construir top3Decks por game_id
    const top3DecksByGame: Record<
      string,
      Array<{ id: string; name: string; image: string | null; count: number }>
    > = {};
    for (const [gameId, leaderIds] of top3LeaderIdsByGame.entries()) {
      const usage = leaderUsageByGame.get(gameId)!;
      top3DecksByGame[gameId] = leaderIds.map((id) => {
        const resolved = resolveTopLeader(id);
        return {
          id: resolved?.id ?? id,
          name: resolved?.base_name ?? "—",
          image: resolved?.card_image ?? null,
          count: usage.get(id) ?? 0,
        };
      });
    }

    // Stats globales W-L-D del player
    const totalWins = events.reduce((acc, e) => acc + (e.wins ?? 0), 0);
    const totalLosses = events.reduce((acc, e) => acc + (e.losses ?? 0), 0);
    const totalGames = totalWins + totalLosses;

    return {
      top3DecksByGame,
      globalRecord: { wins: totalWins, losses: totalLosses, total: totalGames },
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
  .middleware([requireNexusUser])
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
      .in("status", ["APPROVED", "PUBLISHED"])
      .single();

    if (!tournament) throw new Error("Torneo no encontrado");

    const [{ data: store }, { data: game }, { data: results }] = await Promise.all([
      admin
        .from("stores")
        .select("name, city, state, country")
        .eq("id", tournament.store_id)
        .single(),
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
  .middleware([requireNexusUser])
  .inputValidator((d: { is_public: boolean }) => z.object({ is_public: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin
      .from("players")
      .update({ is_profile_public: data.is_public } as any)
      .eq("id", player.id);
    if (error) failDb(error);
    return { success: true };
  });

export const getPublicProfile = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { player_tag: string }) => z.object({ player_tag: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player: viewer } = context;

    const { data: target } = await admin
      .from("players")
      .select(
        "id, geek_tag, display_name, avatar_url, created_at, home_store_id, is_profile_public" as any,
      )
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

    const snapMap = new Map<string, any>();
    for (const s of (snapshotsRes.data ?? []) as any[]) {
      const ex = snapMap.get(s.game_id);
      if (!ex || (s.total_points ?? 0) > (ex.total_points ?? 0)) {
        snapMap.set(s.game_id, s);
      }
    }
    const snaps = Array.from(snapMap.values());

    const results = (resultsRes.data ?? []) as any[];

    const tStoreIds = Array.from(
      new Set(results.map((r: any) => r.tournaments?.store_id).filter(Boolean)),
    );
    const gameIds = Array.from(
      new Set([
        ...snaps.map((s) => s.game_id),
        ...results.map((r: any) => r.tournaments?.game_id).filter(Boolean),
      ]),
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

export const getMyStats = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { game_id: string }) => z.object({ game_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // 1. IDs de torneos del TCG seleccionado
    const { data: tcgTournaments } = await admin
      .from("tournaments")
      .select("id")
      .eq("game_id", data.game_id);
    const tcgTournamentIds = (tcgTournaments ?? []).map((t: any) => t.id);

    if (tcgTournamentIds.length === 0) {
      const { data: game } = await admin
        .from("games")
        .select("name, slug")
        .eq("id", data.game_id)
        .single();
      return {
        game_id: data.game_id,
        game_name: (game as any)?.name ?? "TCG",
        game_slug: (game as any)?.slug ?? "",
        total_rounds_in_meta: 0,
        leaders: [],
      };
    }

    // 2. Rondas del player — incluye opponent_player_id
    const { data: rounds, error } = await admin
      .from("tournament_round_results")
      .select(
        "id, round_number, is_bye, player_leader_id, opponent_leader_id, opponent_player_id, won_match, turn_order, won_die_roll, is_auto_populated, status, tournament_id, notes",
      )
      .eq("player_id", player.id)
      .eq("is_bye", false)
      .not("won_match", "is", null)
      .in("tournament_id", tcgTournamentIds);

    if (error) failDb(error);
    const allRounds = rounds ?? [];

    // 3. Total de rondas en el meta para Play Rate
    const { count: totalMetaRounds } = await admin
      .from("tournament_round_results")
      .select("id", { count: "exact", head: true })
      .eq("is_bye", false)
      .not("won_match", "is", null)
      .in("tournament_id", tcgTournamentIds);

    // 4. Enriquecer con datos de torneo+tienda y oponentes
    const tournamentIdsInRounds = Array.from(new Set(allRounds.map((r: any) => r.tournament_id)));
    const opponentPlayerIds = Array.from(
      new Set(
        allRounds.map((r: any) => r.opponent_player_id).filter((id: any): id is string => !!id),
      ),
    );

    const [tournamentsEnrich, opponentsEnrich] = await Promise.all([
      tournamentIdsInRounds.length
        ? admin
            .from("tournaments")
            .select("id, tournament_date, store_id, stores!inner(name)")
            .in("id", tournamentIdsInRounds)
        : Promise.resolve({ data: [] as any[] }),
      opponentPlayerIds.length
        ? admin.from("players").select("id, geek_tag").in("id", opponentPlayerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const tournamentMetaMap = new Map(
      ((tournamentsEnrich.data ?? []) as any[]).map((t: any) => [
        t.id,
        {
          date: t.tournament_date as string,
          store_name: (t.stores as any)?.name ?? "—",
        },
      ]),
    );

    const opponentTagMap = new Map(
      ((opponentsEnrich.data ?? []) as any[]).map((p: any) => [p.id, p.geek_tag as string]),
    );

    // 5. Fetchear leaders con canonical_leader_id
    const rawLeaderIds = Array.from(
      new Set(
        [
          ...allRounds.map((r: any) => r.player_leader_id),
          ...allRounds.map((r: any) => r.opponent_leader_id),
        ].filter((id): id is string => !!id),
      ),
    );

    const { data: rawLeaders } = rawLeaderIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, canonical_leader_id, colors")
          .in("id", rawLeaderIds)
      : { data: [] as any[] };

    // 6. Mapa variante → canónico
    const variantToCanonical = new Map<string, string>();
    for (const l of rawLeaders ?? []) {
      if (l.canonical_leader_id) {
        variantToCanonical.set(l.id, l.canonical_leader_id);
      }
    }

    // 7. Fetchear canónicos faltantes
    const existingIds = new Set((rawLeaders ?? []).map((l: any) => l.id));
    const missingCanonicalIds = Array.from(new Set(Array.from(variantToCanonical.values()))).filter(
      (id) => !existingIds.has(id),
    );

    const { data: canonicalLeaders } = missingCanonicalIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, canonical_leader_id, colors")
          .in("id", missingCanonicalIds)
      : { data: [] as any[] };

    // 8. Mapa final de leaders
    const leaderMap = new Map(
      [...(rawLeaders ?? []), ...(canonicalLeaders ?? [])].map((l: any) => [l.id, l]),
    );

    const resolveId = (id: string): string => variantToCanonical.get(id) ?? id;

    // 9. Agrupar rondas por leader canónico del player
    const byLeader = new Map<string, any[]>();
    for (const r of allRounds) {
      if (!r.player_leader_id) continue;
      const canonicalId = resolveId(r.player_leader_id);
      if (!byLeader.has(canonicalId)) byLeader.set(canonicalId, []);
      byLeader.get(canonicalId)!.push(r);
    }

    // 10. Calcular stats por leader
    const leaderStats = Array.from(byLeader.entries())
      .map(([leaderId, lRounds]) => {
        const leader = leaderMap.get(leaderId);

        const total = lRounds.length;
        const wins = lRounds.filter((r: any) => r.won_match === true).length;
        const confirmedRounds = lRounds.filter((r: any) => r.status === "confirmed");
        const confirmedWins = confirmedRounds.filter((r: any) => r.won_match === true).length;
        const hasUncertain = lRounds.some((r: any) => r.status !== "confirmed");

        const firstRounds = lRounds.filter((r: any) => r.turn_order === "first");
        const secondRounds = lRounds.filter((r: any) => r.turn_order === "second");
        const firstWins = firstRounds.filter((r: any) => r.won_match === true).length;
        const secondWins = secondRounds.filter((r: any) => r.won_match === true).length;

        // Matchup breakdown agrupado por opponent leader canónico
        const byOpponent = new Map<string, any[]>();
        for (const r of lRounds) {
          if (!r.opponent_leader_id) continue;
          const canonicalOppLeaderId = resolveId(r.opponent_leader_id);
          if (!byOpponent.has(canonicalOppLeaderId)) byOpponent.set(canonicalOppLeaderId, []);
          byOpponent.get(canonicalOppLeaderId)!.push(r);
        }

        const matchups = Array.from(byOpponent.entries())
          .map(([oppLeaderId, oppRounds]) => {
            const oppLeader = leaderMap.get(oppLeaderId);
            const oppTotal = oppRounds.length;
            const oppWins = oppRounds.filter((r: any) => r.won_match === true).length;
            const oppFirst = oppRounds.filter((r: any) => r.turn_order === "first");
            const oppSecond = oppRounds.filter((r: any) => r.turn_order === "second");
            const oppHasUncertain = oppRounds.some((r: any) => r.status !== "confirmed");

            // Historial de rondas individuales enriquecido
            const roundHistory = oppRounds
              .map((r: any) => {
                const meta = tournamentMetaMap.get(r.tournament_id);
                const oppTag = r.opponent_player_id
                  ? (opponentTagMap.get(r.opponent_player_id) ?? "Sin registrar")
                  : "Sin registrar";
                return {
                  round_number: r.round_number as number,
                  tournament_date: meta?.date ?? null,
                  store_name: meta?.store_name ?? "—",
                  opponent_tag: oppTag,
                  won_match: r.won_match as boolean,
                  turn_order: r.turn_order as "first" | "second" | null,
                  won_die_roll: r.won_die_roll as boolean | null,
                  notes: r.notes as string | null,
                  status: r.status as string,
                };
              })
              .sort((a: any, b: any) => {
                if (!a.tournament_date) return 1;
                if (!b.tournament_date) return -1;
                return b.tournament_date.localeCompare(a.tournament_date);
              });

            return {
              opponent_leader_id: oppLeaderId,
              opponent_leader_name: oppLeader?.base_name ?? "Desconocido",
              opponent_leader_image: oppLeader?.card_image ?? null,
              opponent_leader_colors: (oppLeader?.colors as string[] | null) ?? null,
              total: oppTotal,
              wins: oppWins,
              overall_win_rate: oppTotal > 0 ? Math.round((oppWins / oppTotal) * 100) : 0,
              first_total: oppFirst.length,
              first_wins: oppFirst.filter((r: any) => r.won_match === true).length,
              first_win_rate:
                oppFirst.length > 0
                  ? Math.round(
                      (oppFirst.filter((r: any) => r.won_match === true).length / oppFirst.length) *
                        100,
                    )
                  : null,
              second_total: oppSecond.length,
              second_wins: oppSecond.filter((r: any) => r.won_match === true).length,
              second_win_rate:
                oppSecond.length > 0
                  ? Math.round(
                      (oppSecond.filter((r: any) => r.won_match === true).length /
                        oppSecond.length) *
                        100,
                    )
                  : null,
              has_uncertain_data: oppHasUncertain,
              round_history: roundHistory,
            };
          })
          .sort((a, b) => b.total - a.total);

        return {
          leader_id: leaderId,
          leader_name: leader?.base_name ?? "Desconocido",
          leader_image: leader?.card_image ?? null,
          total_games: total,
          wins,
          losses: total - wins,
          raw_win_rate: total > 0 ? Math.round((wins / total) * 100 * 10) / 10 : 0,
          wtd_win_rate:
            confirmedRounds.length > 0
              ? Math.round((confirmedWins / confirmedRounds.length) * 100 * 10) / 10
              : 0,
          play_rate:
            (totalMetaRounds ?? 0) > 0
              ? Math.round((total / (totalMetaRounds ?? 1)) * 100 * 100) / 100
              : 0,
          first_games: firstRounds.length,
          first_win_rate:
            firstRounds.length > 0
              ? Math.round((firstWins / firstRounds.length) * 100 * 10) / 10
              : null,
          second_games: secondRounds.length,
          second_win_rate:
            secondRounds.length > 0
              ? Math.round((secondWins / secondRounds.length) * 100 * 10) / 10
              : null,
          has_uncertain_data: hasUncertain,
          matchups,
        };
      })
      .sort((a, b) => b.total_games - a.total_games);

    // 11. Nombre del juego
    const { data: game } = await admin
      .from("games")
      .select("name, slug")
      .eq("id", data.game_id)
      .single();

    return {
      game_id: data.game_id,
      game_name: (game as any)?.name ?? "TCG",
      game_slug: (game as any)?.slug ?? "",
      total_rounds_in_meta: totalMetaRounds ?? 0,
      leaders: leaderStats,
    };
  });

export const getMyStatsGames = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const { data: tournamentIds } = await admin
      .from("tournament_round_results")
      .select("tournament_id")
      .eq("player_id", player.id)
      .eq("is_bye", false)
      .not("won_match", "is", null);

    const uniqueTournamentIds = Array.from(
      new Set((tournamentIds ?? []).map((r: any) => r.tournament_id)),
    );

    if (uniqueTournamentIds.length === 0) return { games: [] };

    const { data: tournaments } = await admin
      .from("tournaments")
      .select("game_id")
      .in("id", uniqueTournamentIds);

    const uniqueGameIds = Array.from(new Set((tournaments ?? []).map((t: any) => t.game_id)));

    if (uniqueGameIds.length === 0) return { games: [] };

    const { data: games } = await admin
      .from("games")
      .select("id, name, slug")
      .in("id", uniqueGameIds)
      .order("name");

    return { games: games ?? [] };
  });

export const getMyCasualStats = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { game_id: string }) => z.object({ game_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Info del juego
    const { data: game } = await admin
      .from("games")
      .select("id, name, slug")
      .eq("id", data.game_id)
      .maybeSingle();

    // 1. Sesiones casuales del player para este TCG
    const { data: sessions } = await admin
      .from("standalone_sessions")
      .select("id, session_date, store_id")
      .eq("player_id", player.id)
      .eq("game_id", data.game_id)
      .eq("session_type", "casual");

    const sessionList = sessions ?? [];
    const sessionIds = sessionList.map((s: any) => s.id);

    if (sessionIds.length === 0) {
      return {
        game_id: data.game_id,
        game_name: (game as any)?.name ?? "—",
        game_slug: (game as any)?.slug ?? "",
        total_rounds_in_meta: 0,
        leaders: [],
      };
    }

    // Mapa session_id → info de sesión (para round_history)
    const sessionMap = new Map(sessionList.map((s: any) => [s.id, s]));

    // Store names para las sesiones que tienen store_id
    const storeIds = Array.from(new Set(sessionList.map((s: any) => s.store_id).filter(Boolean)));
    const { data: stores } = storeIds.length
      ? await admin.from("stores").select("id, name").in("id", storeIds)
      : { data: [] as any[] };
    const storeNameMap = new Map(((stores ?? []) as any[]).map((s: any) => [s.id, s.name]));

    // 2. Rondas de esas sesiones
    const { data: rounds } = await admin
      .from("standalone_round_results")
      .select(
        "id, session_id, round_number, is_bye, player_leader_id, opponent_leader_id, opponent_player_id, won_match, turn_order, won_die_roll, status, notes",
      )
      .in("session_id", sessionIds)
      .eq("is_bye", false)
      .not("won_match", "is", null);

    const allRounds = rounds ?? [];

    if (allRounds.length === 0) {
      return {
        game_id: data.game_id,
        game_name: (game as any)?.name ?? "—",
        game_slug: (game as any)?.slug ?? "",
        total_rounds_in_meta: 0,
        leaders: [],
      };
    }

    // 3. Opponent tags (si hay opponent_player_id)
    const opponentIds = Array.from(
      new Set(allRounds.map((r: any) => r.opponent_player_id).filter(Boolean)),
    );
    const { data: opponents } = opponentIds.length
      ? await admin.from("players").select("id, geek_tag").in("id", opponentIds)
      : { data: [] as any[] };
    const opponentTagMap = new Map(
      ((opponents ?? []) as any[]).map((p: any) => [p.id, p.geek_tag]),
    );

    // 4. Resolución canónica de leaders (idéntico a getMyStats pasos 5-8)
    const rawLeaderIds = Array.from(
      new Set(
        [
          ...allRounds.map((r: any) => r.player_leader_id),
          ...allRounds.map((r: any) => r.opponent_leader_id),
        ].filter((id): id is string => !!id),
      ),
    );
    const { data: rawLeaders } = rawLeaderIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, canonical_leader_id, colors")
          .in("id", rawLeaderIds)
      : { data: [] as any[] };

    const variantToCanonical = new Map<string, string>();
    for (const l of rawLeaders ?? []) {
      if (l.canonical_leader_id) variantToCanonical.set(l.id, l.canonical_leader_id);
    }

    const existingIds = new Set((rawLeaders ?? []).map((l: any) => l.id));
    const missingCanonicalIds = Array.from(new Set(Array.from(variantToCanonical.values()))).filter(
      (id) => !existingIds.has(id),
    );

    const { data: canonicalLeaders } = missingCanonicalIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, canonical_leader_id, colors")
          .in("id", missingCanonicalIds)
      : { data: [] as any[] };

    const leaderMap = new Map(
      [...(rawLeaders ?? []), ...(canonicalLeaders ?? [])].map((l: any) => [l.id, l]),
    );
    const resolveId = (id: string): string => variantToCanonical.get(id) ?? id;

    // 5. Agregación por leader canónico — MISMA lógica que getMyStats
    //    pero con round_history usando session_date + store fallback
    type LeaderAgg = {
      leader_id: string;
      total_games: number;
      wins: number;
      confirmed_total: number;
      confirmed_wins: number;
      first_games: number;
      first_wins: number;
      second_games: number;
      second_wins: number;
      matchups: Map<string, any>;
    };

    const leaderAggs = new Map<string, LeaderAgg>();

    for (const r of allRounds as any[]) {
      if (!r.player_leader_id) continue;
      const canonicalLeaderId = resolveId(r.player_leader_id);

      let agg = leaderAggs.get(canonicalLeaderId);
      if (!agg) {
        agg = {
          leader_id: canonicalLeaderId,
          total_games: 0,
          wins: 0,
          confirmed_total: 0,
          confirmed_wins: 0,
          first_games: 0,
          first_wins: 0,
          second_games: 0,
          second_wins: 0,
          matchups: new Map(),
        };
        leaderAggs.set(canonicalLeaderId, agg);
      }

      agg.total_games++;
      if (r.won_match) agg.wins++;
      if (r.status === "confirmed") {
        agg.confirmed_total++;
        if (r.won_match) agg.confirmed_wins++;
      }
      if (r.turn_order === "first") {
        agg.first_games++;
        if (r.won_match) agg.first_wins++;
      } else if (r.turn_order === "second") {
        agg.second_games++;
        if (r.won_match) agg.second_wins++;
      }

      // Matchup
      const oppCanonical = r.opponent_leader_id ? resolveId(r.opponent_leader_id) : "unknown";
      let mu = agg.matchups.get(oppCanonical);
      if (!mu) {
        mu = {
          opponent_leader_id: oppCanonical,
          total: 0,
          wins: 0,
          first_total: 0,
          first_wins: 0,
          second_total: 0,
          second_wins: 0,
          round_history: [],
        };
        agg.matchups.set(oppCanonical, mu);
      }
      mu.total++;
      if (r.won_match) mu.wins++;
      if (r.turn_order === "first") {
        mu.first_total++;
        if (r.won_match) mu.first_wins++;
      } else if (r.turn_order === "second") {
        mu.second_total++;
        if (r.won_match) mu.second_wins++;
      }

      const session = sessionMap.get(r.session_id);
      mu.round_history.push({
        round_number: r.round_number,
        tournament_date: (session as any)?.session_date ?? null,
        store_name: (session as any)?.store_id
          ? (storeNameMap.get((session as any).store_id) ?? "Casual / sin tienda")
          : "Casual / sin tienda",
        opponent_tag: r.opponent_player_id
          ? (opponentTagMap.get(r.opponent_player_id) ?? "Sin registrar")
          : "Sin registrar",
        won_match: r.won_match,
        turn_order: r.turn_order,
        won_die_roll: r.won_die_roll,
        notes: r.notes,
        status: r.status,
      });
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    // 6. Construir shape final
    const leaders = Array.from(leaderAggs.values())
      .map((agg) => {
        const leader = leaderMap.get(agg.leader_id);
        const matchups = Array.from(agg.matchups.values())
          .map((mu: any) => {
            const oppLeader = leaderMap.get(mu.opponent_leader_id);
            return {
              opponent_leader_id: mu.opponent_leader_id,
              opponent_leader_name: oppLeader?.base_name ?? "Desconocido",
              opponent_leader_image: oppLeader?.card_image ?? null,
              opponent_leader_colors: (oppLeader?.colors as string[] | null) ?? null,
              total: mu.total,
              wins: mu.wins,
              overall_win_rate: mu.total > 0 ? round1((mu.wins / mu.total) * 100) : 0,
              first_total: mu.first_total,
              first_wins: mu.first_wins,
              first_win_rate:
                mu.first_total > 0 ? round1((mu.first_wins / mu.first_total) * 100) : null,
              second_total: mu.second_total,
              second_wins: mu.second_wins,
              second_win_rate:
                mu.second_total > 0 ? round1((mu.second_wins / mu.second_total) * 100) : null,
              has_uncertain_data: mu.round_history.some((h: any) => h.status !== "confirmed"),
              round_history: mu.round_history.sort((a: any, b: any) =>
                (b.tournament_date ?? "").localeCompare(a.tournament_date ?? ""),
              ),
            };
          })
          .sort((a: any, b: any) => b.total - a.total);

        return {
          leader_id: agg.leader_id,
          leader_name: leader?.base_name ?? "Desconocido",
          leader_image: leader?.card_image ?? null,
          total_games: agg.total_games,
          wins: agg.wins,
          losses: agg.total_games - agg.wins,
          raw_win_rate: agg.total_games > 0 ? round1((agg.wins / agg.total_games) * 100) : 0,
          wtd_win_rate:
            agg.confirmed_total > 0 ? round1((agg.confirmed_wins / agg.confirmed_total) * 100) : 0,
          play_rate: 0, // sin meta en casual
          first_games: agg.first_games,
          first_win_rate:
            agg.first_games > 0 ? round1((agg.first_wins / agg.first_games) * 100) : null,
          second_games: agg.second_games,
          second_win_rate:
            agg.second_games > 0 ? round1((agg.second_wins / agg.second_games) * 100) : null,
          matchups,
        };
      })
      .sort((a, b) => b.total_games - a.total_games);

    return {
      game_id: data.game_id,
      game_name: (game as any)?.name ?? "—",
      game_slug: (game as any)?.slug ?? "",
      total_rounds_in_meta: 0,
      leaders,
    };
  });

export const getMyPendingStats = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { game_id: string }) => z.object({ game_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: game } = await admin
      .from("games")
      .select("id, name, slug")
      .eq("id", data.game_id)
      .maybeSingle();

    // Sesiones COMPETITIVAS UNLINKED del player para este TCG
    const { data: sessions } = await admin
      .from("standalone_sessions")
      .select("id, session_date, store_id")
      .eq("player_id", player.id)
      .eq("game_id", data.game_id)
      .eq("session_type", "competitive")
      .eq("status", "unlinked");

    const sessionList = sessions ?? [];
    const sessionIds = sessionList.map((s: any) => s.id);

    if (sessionIds.length === 0) {
      return {
        game_id: data.game_id,
        game_name: (game as any)?.name ?? "—",
        game_slug: (game as any)?.slug ?? "",
        total_rounds_in_meta: 0,
        leaders: [],
      };
    }

    const sessionMap = new Map(sessionList.map((s: any) => [s.id, s]));

    const storeIds = Array.from(new Set(sessionList.map((s: any) => s.store_id).filter(Boolean)));
    const { data: stores } = storeIds.length
      ? await admin.from("stores").select("id, name").in("id", storeIds)
      : { data: [] as any[] };
    const storeNameMap = new Map(((stores ?? []) as any[]).map((s: any) => [s.id, s.name]));

    const { data: rounds } = await admin
      .from("standalone_round_results")
      .select(
        "id, session_id, round_number, is_bye, player_leader_id, opponent_leader_id, opponent_player_id, won_match, turn_order, won_die_roll, status, notes",
      )
      .in("session_id", sessionIds)
      .eq("is_bye", false)
      .not("won_match", "is", null);

    const allRounds = rounds ?? [];

    if (allRounds.length === 0) {
      return {
        game_id: data.game_id,
        game_name: (game as any)?.name ?? "—",
        game_slug: (game as any)?.slug ?? "",
        total_rounds_in_meta: 0,
        leaders: [],
      };
    }

    const opponentIds = Array.from(
      new Set(allRounds.map((r: any) => r.opponent_player_id).filter(Boolean)),
    );
    const { data: opponents } = opponentIds.length
      ? await admin.from("players").select("id, geek_tag").in("id", opponentIds)
      : { data: [] as any[] };
    const opponentTagMap = new Map(
      ((opponents ?? []) as any[]).map((p: any) => [p.id, p.geek_tag]),
    );

    const rawLeaderIds = Array.from(
      new Set(
        [
          ...allRounds.map((r: any) => r.player_leader_id),
          ...allRounds.map((r: any) => r.opponent_leader_id),
        ].filter((id): id is string => !!id),
      ),
    );
    const { data: rawLeaders } = rawLeaderIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, canonical_leader_id, colors")
          .in("id", rawLeaderIds)
      : { data: [] as any[] };

    const variantToCanonical = new Map<string, string>();
    for (const l of rawLeaders ?? []) {
      if (l.canonical_leader_id) variantToCanonical.set(l.id, l.canonical_leader_id);
    }

    const existingIds = new Set((rawLeaders ?? []).map((l: any) => l.id));
    const missingCanonicalIds = Array.from(new Set(Array.from(variantToCanonical.values()))).filter(
      (id) => !existingIds.has(id),
    );

    const { data: canonicalLeaders } = missingCanonicalIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, canonical_leader_id, colors")
          .in("id", missingCanonicalIds)
      : { data: [] as any[] };

    const leaderMap = new Map(
      [...(rawLeaders ?? []), ...(canonicalLeaders ?? [])].map((l: any) => [l.id, l]),
    );
    const resolveId = (id: string): string => variantToCanonical.get(id) ?? id;

    const leaderAggs = new Map<string, any>();

    for (const r of allRounds as any[]) {
      if (!r.player_leader_id) continue;
      const canonicalLeaderId = resolveId(r.player_leader_id);

      let agg = leaderAggs.get(canonicalLeaderId);
      if (!agg) {
        agg = {
          leader_id: canonicalLeaderId,
          total_games: 0,
          wins: 0,
          confirmed_total: 0,
          confirmed_wins: 0,
          first_games: 0,
          first_wins: 0,
          second_games: 0,
          second_wins: 0,
          matchups: new Map(),
        };
        leaderAggs.set(canonicalLeaderId, agg);
      }

      agg.total_games++;
      if (r.won_match) agg.wins++;
      if (r.status === "confirmed") {
        agg.confirmed_total++;
        if (r.won_match) agg.confirmed_wins++;
      }
      if (r.turn_order === "first") {
        agg.first_games++;
        if (r.won_match) agg.first_wins++;
      } else if (r.turn_order === "second") {
        agg.second_games++;
        if (r.won_match) agg.second_wins++;
      }

      const oppCanonical = r.opponent_leader_id ? resolveId(r.opponent_leader_id) : "unknown";
      let mu = agg.matchups.get(oppCanonical);
      if (!mu) {
        mu = {
          opponent_leader_id: oppCanonical,
          total: 0,
          wins: 0,
          first_total: 0,
          first_wins: 0,
          second_total: 0,
          second_wins: 0,
          round_history: [],
        };
        agg.matchups.set(oppCanonical, mu);
      }
      mu.total++;
      if (r.won_match) mu.wins++;
      if (r.turn_order === "first") {
        mu.first_total++;
        if (r.won_match) mu.first_wins++;
      } else if (r.turn_order === "second") {
        mu.second_total++;
        if (r.won_match) mu.second_wins++;
      }

      const session = sessionMap.get(r.session_id);
      mu.round_history.push({
        round_number: r.round_number,
        tournament_date: (session as any)?.session_date ?? null,
        store_name: (session as any)?.store_id
          ? (storeNameMap.get((session as any).store_id) ?? "Sin tienda")
          : "Sin tienda",
        opponent_tag: r.opponent_player_id
          ? (opponentTagMap.get(r.opponent_player_id) ?? "Sin registrar")
          : "Sin registrar",
        won_match: r.won_match,
        turn_order: r.turn_order,
        won_die_roll: r.won_die_roll,
        notes: r.notes,
        status: r.status,
        is_pending: true,
      });
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    const leaders = Array.from(leaderAggs.values())
      .map((agg: any) => {
        const leader = leaderMap.get(agg.leader_id);
        const matchups = Array.from(agg.matchups.values())
          .map((mu: any) => {
            const oppLeader = leaderMap.get(mu.opponent_leader_id);
            return {
              opponent_leader_id: mu.opponent_leader_id,
              opponent_leader_name: oppLeader?.base_name ?? "Desconocido",
              opponent_leader_image: oppLeader?.card_image ?? null,
              opponent_leader_colors: (oppLeader?.colors as string[] | null) ?? null,
              total: mu.total,
              wins: mu.wins,
              overall_win_rate: mu.total > 0 ? round1((mu.wins / mu.total) * 100) : 0,
              first_total: mu.first_total,
              first_wins: mu.first_wins,
              first_win_rate:
                mu.first_total > 0 ? round1((mu.first_wins / mu.first_total) * 100) : null,
              second_total: mu.second_total,
              second_wins: mu.second_wins,
              second_win_rate:
                mu.second_total > 0 ? round1((mu.second_wins / mu.second_total) * 100) : null,
              has_uncertain_data: true,
              round_history: mu.round_history.sort((a: any, b: any) =>
                (b.tournament_date ?? "").localeCompare(a.tournament_date ?? ""),
              ),
            };
          })
          .sort((a: any, b: any) => b.total - a.total);

        return {
          leader_id: agg.leader_id,
          leader_name: leader?.base_name ?? "Desconocido",
          leader_image: leader?.card_image ?? null,
          total_games: agg.total_games,
          wins: agg.wins,
          losses: agg.total_games - agg.wins,
          raw_win_rate: agg.total_games > 0 ? round1((agg.wins / agg.total_games) * 100) : 0,
          wtd_win_rate:
            agg.confirmed_total > 0 ? round1((agg.confirmed_wins / agg.confirmed_total) * 100) : 0,
          play_rate: 0,
          first_games: agg.first_games,
          first_win_rate:
            agg.first_games > 0 ? round1((agg.first_wins / agg.first_games) * 100) : null,
          second_games: agg.second_games,
          second_win_rate:
            agg.second_games > 0 ? round1((agg.second_wins / agg.second_games) * 100) : null,
          matchups,
        };
      })
      .sort((a: any, b: any) => b.total_games - a.total_games);

    return {
      game_id: data.game_id,
      game_name: (game as any)?.name ?? "—",
      game_slug: (game as any)?.slug ?? "",
      total_rounds_in_meta: 0,
      leaders,
    };
  });

export const getMyFavoriteStores = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const { data: favs } = await (admin as any)
      .from("player_favorite_stores")
      .select("store_id, created_at")
      .eq("player_id", player.id)
      .order("created_at", { ascending: true });

    const favList = (favs ?? []) as any[];
    const storeIds = favList.map((f) => f.store_id);

    if (storeIds.length === 0) return { stores: [], store_ids: [] };

    const { data: stores } = await admin
      .from("stores")
      .select("id, slug, name, city, state, zone")
      .in("id", storeIds);

    const storeMap = new Map(((stores ?? []) as any[]).map((s) => [s.id, s]));

    return {
      stores: favList.map((f) => storeMap.get(f.store_id)).filter(Boolean) as Array<{
        id: string;
        slug: string;
        name: string;
        city: string | null;
        state: string | null;
        zone: string | null;
      }>,
      store_ids: storeIds as string[],
    };
  });

export const toggleFavoriteStore = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: existing } = await (admin as any)
      .from("player_favorite_stores")
      .select("id")
      .eq("player_id", player.id)
      .eq("store_id", data.store_id)
      .maybeSingle();

    if (existing) {
      const { error } = await (admin as any)
        .from("player_favorite_stores")
        .delete()
        .eq("id", (existing as any).id);
      if (error) throw new Error(error.message);
      return { is_favorite: false };
    }

    const { count } = await (admin as any)
      .from("player_favorite_stores")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player.id);

    if ((count ?? 0) >= 5) {
      throw new Error("Ya tienes 5 tiendas favoritas. Quita una para agregar otra.");
    }

    const { error } = await (admin as any)
      .from("player_favorite_stores")
      .insert({ player_id: player.id, store_id: data.store_id });

    if (error) {
      if (error.message.includes("Máximo 5 tiendas favoritas")) {
        throw new Error("Ya tienes 5 tiendas favoritas. Quita una para agregar otra.");
      }
      throw new Error(error.message);
    }

    return { is_favorite: true };
  });

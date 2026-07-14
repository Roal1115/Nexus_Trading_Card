import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { todayInMexicoStr, mondayOfWeek, toLocalDateStr } from "./utils";
import type { TablesInsert } from "./database.types";
import type { TournamentStatus } from "./nexus-admin-shared";


export const getOrganizerTournamentHistory = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: {
      status?: string;
      game_id?: string;
      date_from?: string;
      date_to?: string;
      season_id?: string;
      page?: number;
    }) =>
      z
        .object({
          status: z.string().optional(),
          game_id: z.string().optional(),
          date_from: z.string().optional(),
          date_to: z.string().optional(),
          season_id: z.string().optional(),
          page: z.number().min(1).default(1),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const PAGE_SIZE = 25;
    const page = data.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    if (!player.home_store_id) {
      return { total: 0, page, stats: {}, tournaments: [] };
    }

    const baseCols = "id, tournament_date, status, csv_url, approved_at, published_at, created_at, game_id, store_id";
    const extraCols = ", rejection_reason, approved_by, season_id";

    const build = (cols: string) => {
      let q = admin
        .from("tournaments")
        .select(cols, { count: "exact" })
.eq("store_id", player.home_store_id as string)
        .order("tournament_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (data.status) q = q.eq("status", data.status as TournamentStatus);
      if (data.game_id) q = q.eq("game_id", data.game_id);
      if (data.date_from) q = q.gte("tournament_date", data.date_from);
      if (data.date_to) q = q.lte("tournament_date", data.date_to);
      if (data.season_id) q = q.eq("season_id", data.season_id);
      return q;
    };

    let res = await build(baseCols + extraCols);
    if (res.error && /column .* does not exist/i.test(res.error.message)) {
      res = await build(baseCols);
    }
    if (res.error) failDb(res.error);

    const rows = (res.data ?? []) as any[];
    const count = res.count;
    const gameIds = Array.from(new Set(rows.map((r) => r.game_id)));
    const approverIds = Array.from(new Set(rows.filter((r) => r.approved_by).map((r) => r.approved_by as string)));
    const tournamentIds = rows.map((r) => r.id);

    const [gmsRes, storeRes, approversRes, resultsRes, allStatsRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] }),
      admin.from("stores").select("id, name, city").eq("id", player.home_store_id).maybeSingle(),
      approverIds.length
        ? admin.from("players").select("id, geek_tag, role").in("id", approverIds)
        : Promise.resolve({ data: [] as any[] }),
      tournamentIds.length
        ? admin.from("tournament_results").select("tournament_id").in("tournament_id", tournamentIds)
        : Promise.resolve({ data: [] as any[] }),
      admin.from("tournaments").select("status").eq("store_id", player.home_store_id),
    ]);

    const gamesMap = Object.fromEntries((gmsRes.data ?? []).map((g: any) => [g.id, g.name]));
    const store: any = storeRes.data;
    const approversMap = Object.fromEntries((approversRes.data ?? []).map((p: any) => [p.id, p]));
    const participantMap = (resultsRes.data ?? []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.tournament_id] = (acc[r.tournament_id] ?? 0) + 1;
      return acc;
    }, {});
    const globalStats = (allStatsRes.data ?? []).reduce((acc: Record<string, number>, t: any) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: count ?? 0,
      page,
      stats: globalStats,
      tournaments: rows.map((r) => {
        const approver: any = r.approved_by ? approversMap[r.approved_by] : null;
        return {
          ...r,
          game_name: gamesMap[r.game_id] ?? "—",
          store_name: store?.name ?? "—",
          store_city: store?.city ?? "—",
          approved_by_tag: approver?.geek_tag ?? null,
          approved_by_role: approver?.role ?? null,
          participants: participantMap[r.id] ?? 0,
        };
      }),
    };
  });

export const getOrganizerFilterOptions = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    if (!player.home_store_id) {
      return { games: [], stores: [], seasons: [] };
    }

    const [schedulesRes, seasonsRes] = await Promise.all([
      admin.from("store_schedules").select("game_id, games(id, name)").eq("store_id", player.home_store_id),
      admin.from("seasons").select("id, name, slug, status").order("start_date", { ascending: false }),
    ]);

    const gamesMap = new Map<string, string>();
    for (const s of (schedulesRes.data ?? []) as any[]) {
      if (s.games?.id) gamesMap.set(s.games.id, s.games.name);
    }
    const games = Array.from(gamesMap.entries()).map(([id, name]) => ({ id, name }));

    return {
      games,
      stores: [],
      seasons: seasonsRes.data ?? [],
    };
  });

type Alert = {
  level: "CRITICAL" | "WARNING";
  message: string;
  link?: { to: string; label: string } | null;
};

export const getOrganizerTournamentDetail = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context as any;

    const { data: t, error: te } = await admin
      .from("tournaments")
      .select(
        "id, store_id, game_id, status, tournament_date, qualifying_month, qualifying_semester, qualifying_year, approved_at, undo_deadline, published_at, created_at, rejection_reason",
      )
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) failDb(te);
    if (!t) throw new Error("Torneo no encontrado");

    // Security: organizer can only view tournaments of their home store.
    if (!player?.home_store_id || t.store_id !== player.home_store_id) {
      throw new Error("No tienes acceso a este torneo");
    }

    const [storeRes, gameRes, resultsRes] = await Promise.all([
      admin.from("stores").select("id, name, city, state").eq("id", t.store_id).maybeSingle(),
      admin.from("games").select("id, name, slug").eq("id", t.game_id).maybeSingle(),
      (async () => {
        const full = await admin
          .from("tournament_results")
          .select("player_id, rank, wins, losses, draws, points_earned, match_points, omw_percentage")
          .eq("tournament_id", t.id)
          .order("rank", { ascending: true });
        if (full.error && /column .* does not exist/i.test(full.error.message)) {
          return await admin
            .from("tournament_results")
            .select("player_id, rank, wins, losses, points_earned")
            .eq("tournament_id", t.id)
            .order("rank", { ascending: true });
        }
        return full;
      })(),
    ]);
    if (storeRes.error) failDb(storeRes.error);
    if (gameRes.error) failDb(gameRes.error);
    if (resultsRes.error) failDb(resultsRes.error);

    const playerIds = Array.from(new Set((resultsRes.data ?? []).map((r: any) => r.player_id)));
    const playersRes = playerIds.length
      ? await admin.from("players").select("id, geek_tag, email, created_at, home_store_id").in("id", playerIds)
      : { data: [] as any[], error: null };
    if ((playersRes as any).error) throw new Error((playersRes as any).error.message);

    const pMap = new Map<string, any>(((playersRes as any).data ?? []).map((p: any) => [p.id, p]));

    const tCreated = new Date(t.created_at ?? new Date().toISOString()).getTime();
    const results: Array<{
      rank: number;
      geek_tag: string;
      match_points: number | null;
      omw_percentage: number | null;
      points_earned: number;
      wins: number;
      losses: number;
      draws: number;
      is_new_player: boolean;
    }> = ((resultsRes.data ?? []) as any[]).map((r: any) => {
      const p = pMap.get(r.player_id);
      const pCreated = p?.created_at ? new Date(p.created_at).getTime() : 0;
      return {
        rank: r.rank,
        geek_tag: p?.geek_tag ?? "—",
        match_points: r.match_points ?? null,
        omw_percentage: r.omw_percentage ?? null,
        points_earned: r.points_earned ?? 0,
        wins: r.wins ?? 0,
        losses: r.losses ?? 0,
        draws: r.draws ?? 0,
        is_new_player: p ? Math.abs(pCreated - tCreated) < 60_000 || pCreated >= tCreated : false,
      };
    });

    const { data: orgs } = await admin
      .from("players")
      .select("geek_tag, email, role")
      .eq("home_store_id", t.store_id)
      .in("role", ["organizer", "admin"])
      .limit(1);
    const uploaded_by = orgs && orgs[0] ? { geek_tag: orgs[0].geek_tag, email: orgs[0].email } : null;

    const alerts: Alert[] = [];

    const { data: dups } = await admin
      .from("tournaments")
      .select("id, status")
      .eq("store_id", t.store_id)
      .eq("game_id", t.game_id)
      .eq("tournament_date", t.tournament_date)
      .neq("id", t.id)
      .in("status", ["APPROVED", "PUBLISHED"]);
    for (const d of dups ?? []) {
      alerts.push({
        level: "CRITICAL",
        message: `Ya existe un torneo ${d.status} de ${gameRes.data?.name ?? ""} en ${storeRes.data?.name ?? ""} el ${t.tournament_date}`,
        link: null,
      });
    }

    if (playerIds.length > 0) {
      const { data: sameDayT } = await admin
        .from("tournaments")
        .select("id")
        .eq("game_id", t.game_id)
        .eq("tournament_date", t.tournament_date)
        .neq("id", t.id);
      const sameDayIds = (sameDayT ?? []).map((x: any) => x.id);
      if (sameDayIds.length > 0) {
        const { data: clash } = await admin
          .from("tournament_results")
          .select("player_id, tournament_id")
          .in("tournament_id", sameDayIds)
          .in("player_id", playerIds);
        const clashedPlayerIds = Array.from(new Set((clash ?? []).map((c: any) => c.player_id as string))) as string[];
        for (const pid of clashedPlayerIds) {
          const tag = pMap.get(pid)?.geek_tag ?? pid;
          alerts.push({
            level: "CRITICAL",
            message: `El jugador ${tag} aparece en otro torneo de ${gameRes.data?.name ?? ""} el mismo día ${t.tournament_date}`,
            link: null,
          });
        }
      }
    }

    const newCount = results.filter((r) => r.is_new_player).length;
    if (newCount > 0) {
      alerts.push({
        level: "WARNING",
        message: `${newCount} jugadores nuevos serán registrados automáticamente al aprobar`,
        link: null,
      });
    }

    if (t.created_at && t.tournament_date) {
      const dt = new Date(t.tournament_date + "T00:00:00").getTime();
      const cr = new Date(t.created_at).getTime();
      const days = Math.floor((cr - dt) / 86_400_000);
      if (days > 3) {
        alerts.push({
          level: "WARNING",
          message: `Este torneo fue subido ${days} días después de la fecha del torneo`,
          link: null,
        });
      }
    }

    const haveMp = results.some((r) => typeof r.match_points === "number");
    if (haveMp) {
      const sorted = [...results].sort((a, b) => a.rank - b.rank);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].match_points ?? -Infinity;
        const cur = sorted[i].match_points ?? -Infinity;
        if (cur > prev) {
          alerts.push({
            level: "WARNING",
            message: `El participante #${sorted[i].rank} tiene ${cur} match points pero está en posición ${sorted[i].rank}`,
            link: null,
          });
          break;
        }
      }
    }

    // Try to read csv_url separately (column may not exist in all schemas).
    let csv_url: string | null = null;
    try {
      const r = await admin.from("tournaments").select("csv_url").eq("id", t.id).maybeSingle();
      csv_url = (r.data as any)?.csv_url ?? null;
    } catch { /* noop */ }

    return {
      tournament: {
        id: t.id,
        status: t.status,
        tournament_date: t.tournament_date,
        qualifying_month: t.qualifying_month,
        qualifying_semester: t.qualifying_semester,
        qualifying_year: t.qualifying_year,
        approved_at: t.approved_at,
        undo_deadline: t.undo_deadline,
        published_at: t.published_at,
        created_at: t.created_at,
        rejection_reason: (t as any).rejection_reason ?? null,
        csv_url,
      },
      store: storeRes.data ?? { id: t.store_id, name: "—", city: null, state: null },
      game: gameRes.data ?? { id: t.game_id, name: "—", slug: "" },
      uploaded_by,
      results,
      alerts,
    };
  });


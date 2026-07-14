import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb } from "./nexus-admin.server";
import { requireNexusManager, requireNexusAdmin } from "./nexus-auth.middleware";
import { loadTournamentDetail } from "./nexus-tournament-detail.server";
import { logAction, recomputeSnapshot, tfMonth, type TournamentStatus } from "./nexus-admin.functions";
import { mondayOfWeek, toLocalDateStr } from "./utils";
import { getManagerGameIds, assertManagerOwnsGame } from "./nexus-manager-shared";


export const getManagerPublishedTournaments = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    if (gameIds.length === 0) return [];

    const { data, error } = await admin
      .from("tournaments")
      .select(
        "id, tournament_date, status, published_at, csv_url, store_id, game_id, stores(name, city, state), games(name)",
      )
      .eq("status", "PUBLISHED")
      .in("game_id", gameIds)
      .order("published_at", { ascending: false });
    if (error) failDb(error);
    return data ?? [];
  });

export const unpublishManagerTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { tournament_id: string; reason: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
        reason: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select(
        "status, game_id, store_id, tournament_date, qualifying_year, qualifying_month, season_id",
      )
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t || (t as any).status !== "PUBLISHED") {
      throw new Error("Solo se pueden despublicar torneos en estado Publicado");
    }
    await assertManagerOwnsGame(admin, player, (t as any).game_id);

    const { error } = await admin
      .from("tournaments")
      .update({
        status: "UNPUBLISHED",
        unpublish_reason: data.reason,
        unpublished_at: new Date().toISOString(),
        unpublished_by: player.id,
      } as any)
      .eq("id", data.tournament_id);
    if (error) failDb(error);

    const monthKey = tfMonth((t as any).qualifying_month, (t as any).qualifying_year);
    await recomputeSnapshot(admin, (t as any).game_id, (t as any).store_id, "MONTHLY", monthKey, {
      year: (t as any).qualifying_year,
      month: (t as any).qualifying_month,
    });
    if ((t as any).season_id) {
      const { data: season } = await admin
        .from("seasons")
        .select("slug")
        .eq("id", (t as any).season_id)
        .maybeSingle();
      if ((season as any)?.slug) {
        await recomputeSnapshot(
          admin,
          (t as any).game_id,
          (t as any).store_id,
          "SEMESTRAL",
          (season as any).slug,
          { season_id: (t as any).season_id },
          (t as any).season_id,
        );
      }
    }

    await logAction(
      admin,
      player,
      "TOURNAMENT_UNPUBLISHED",
      "tournament",
      data.tournament_id,
      `${(t as any).game_id} — ${(t as any).store_id}`,
      { reason: data.reason, unpublished_by_role: player.role },
    );
    return { success: true };
  });

// ---------- Historial de Torneos (scoped al manager) ----------
export const getManagerTournamentHistory = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: {
      status?: string;
      game_id?: string;
      store_id?: string;
      date_from?: string;
      date_to?: string;
      season_id?: string;
      page?: number;
    }) =>
      z
        .object({
          status: z.string().optional(),
          game_id: z.string().optional(),
          store_id: z.string().optional(),
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

    const managerGameIds = await getManagerGameIds(admin, player);
    if (managerGameIds.length === 0) {
      return { total: 0, page, stats: {}, tournaments: [] };
    }

    const gameIdsFilter = data.game_id
      ? managerGameIds.includes(data.game_id)
        ? [data.game_id]
        : []
      : managerGameIds;

    if (gameIdsFilter.length === 0) {
      return { total: 0, page, stats: {}, tournaments: [] };
    }

    const baseCols =
      "id, tournament_date, status, csv_url, approved_at, published_at, created_at, game_id, store_id";
    const extraCols = ", rejection_reason, approved_by, season_id";

    const build = (cols: string) => {
      let q = admin
        .from("tournaments")
        .select(cols, { count: "exact" })
        .in("game_id", gameIdsFilter)
        .order("tournament_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (data.status) q = q.eq("status", data.status as TournamentStatus);
      if (data.store_id) q = q.eq("store_id", data.store_id);
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
    const storeIds = Array.from(new Set(rows.map((r) => r.store_id)));
    const approverIds = Array.from(
      new Set(rows.filter((r) => r.approved_by).map((r) => r.approved_by as string)),
    );
    const tournamentIds = rows.map((r) => r.id);

    const [gmsRes, storesRes, approversRes, resultsRes, allStatsRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] }),
      storeIds.length
        ? admin.from("stores").select("id, name, city").in("id", storeIds)
        : Promise.resolve({ data: [] as any[] }),
      approverIds.length
        ? admin.from("players").select("id, geek_tag, role").in("id", approverIds)
        : Promise.resolve({ data: [] as any[] }),
      tournamentIds.length
        ? admin
            .from("tournament_results")
            .select("tournament_id")
            .in("tournament_id", tournamentIds)
        : Promise.resolve({ data: [] as any[] }),
      admin.from("tournaments").select("status").in("game_id", gameIdsFilter),
    ]);

    const gamesMap = Object.fromEntries((gmsRes.data ?? []).map((g: any) => [g.id, g.name]));
    const storesMap = Object.fromEntries((storesRes.data ?? []).map((s: any) => [s.id, s]));
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
        const store: any = storesMap[r.store_id];
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

export const getManagerFilterOptions = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);

    const [gamesRes, seasonsRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds).order("name")
        : Promise.resolve({ data: [] as any[] }),
      admin
        .from("seasons")
        .select("id, name, slug, status")
        .order("start_date", { ascending: false }),
    ]);

    let stores: any[] = [];
    if (gameIds.length) {
      const { data: schedules } = await admin
        .from("store_schedules")
        .select("store_id")
        .in("game_id", gameIds);
      const storeIds = Array.from(new Set((schedules ?? []).map((s: any) => s.store_id)));
      if (storeIds.length) {
        const { data } = await admin
          .from("stores")
          .select("id, name, city")
          .in("id", storeIds)
          .order("city")
          .order("name");
        stores = data ?? [];
      }
    }

    return {
      games: gamesRes.data ?? [],
      stores,
      seasons: seasonsRes.data ?? [],
    };
  });



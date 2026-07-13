import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb } from "./nexus-admin.server";
import { requireNexusAdmin } from "./nexus-auth.middleware";
import { logAction, recomputeSnapshot, getActiveSeason, tfMonth, PAGE_SIZE, type TournamentStatus } from "./nexus-admin-shared";
import type { TablesUpdate } from "./database.types";

type Alert = {
  level: "CRITICAL" | "WARNING";
  message: string;
  link?: { to: string; label: string } | null;
};

export const listTournamentsByStatus = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { statuses: string[] }) =>
    z
      .object({
        statuses: z.array(z.string()).min(1).max(6),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    let q = admin
      .from("tournaments")
      .select(
        "id, store_id, game_id, tournament_date, qualifying_month, qualifying_semester, qualifying_year, status, csv_url, approved_at, published_at, created_at, rejection_reason",
      )
      .in("status", data.statuses as TournamentStatus[])
      .order("tournament_date", { ascending: false });
    // Excluir torneos rechazados de la cola de pendientes (DRAFT con rejection_reason).
    if (data.statuses.includes("DRAFT")) q = q.is("rejection_reason", null);
    const { data: rows, error } = await q;
    if (error) failDb(error);

    const gameIds = Array.from(new Set((rows ?? []).map((r) => r.game_id)));
    const storeIds = Array.from(new Set((rows ?? []).map((r) => r.store_id)));
    const [gms, sts] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [], error: null } as const),
      storeIds.length
        ? admin.from("stores").select("id, name, city, state").in("id", storeIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    const gMap = Object.fromEntries((gms.data ?? []).map((g) => [g.id, g.name]));
    const sMap = Object.fromEntries(
      (sts.data ?? []).map((s) => [s.id, { name: s.name, city: s.city, state: s.state }]),
    );

    return {
      tournaments: (rows ?? []).map((r) => ({
        ...r,
        game_name: gMap[r.game_id] ?? "—",
        store: sMap[r.store_id] ?? { name: "—", city: null, state: null },
      })),
    };
  });

export const approveTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const now = new Date();
    const undoDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: undoDeadline.toISOString(),
        approved_by: player.id,
      })
      .eq("id", data.tournament_id);
    if (error) failDb(error);

    const { data: t } = await admin
      .from("tournaments")
      .select("tournament_date, store_id, game_id, stores(name), games(name)")
      .eq("id", data.tournament_id)
      .maybeSingle();
    const game = (t as any)?.games;
    const store = (t as any)?.stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_APPROVED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${t?.tournament_date ?? ""}`,
      { store_id: t?.store_id, game_id: t?.game_id },
    );
    return { ok: true };
  });

export const rejectTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select("tournament_date, stores(name), games(name)")
      .eq("id", data.tournament_id)
      .maybeSingle();
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "DRAFT",
        approved_at: null,
        undo_deadline: null,
      })
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    const game = (t as any)?.games;
    const store = (t as any)?.stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_REJECTED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${t?.tournament_date ?? ""}`,
      {},
    );
    return { ok: true };
  });

export const publishTournaments = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { tournament_ids: string[] }) =>
    z
      .object({
        tournament_ids: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const season = await getActiveSeason(admin);
    if (!season) {
      throw new Error("No hay una temporada activa. Crea una temporada antes de publicar torneos.");
    }
    const seasonStart = season.start_date;
    const seasonEnd = season.end_date;

    const { data: tournaments, error: te } = await admin
      .from("tournaments")
      .select("id, store_id, game_id, tournament_date, qualifying_year, qualifying_month, status")
      .in("id", data.tournament_ids);
    if (te) failDb(te);

    const approved = (tournaments ?? []).filter((t) => t.status === "APPROVED");
    const publishable = approved.filter((t) => {
      const d = t.tournament_date;
      return d >= seasonStart && d <= seasonEnd;
    });
    const outOfSeason = approved.filter((t) => !publishable.includes(t));
    if (outOfSeason.length > 0) {
      throw new Error(
        `${outOfSeason.length} torneo(s) tienen fecha fuera del rango de la temporada activa (${seasonStart} — ${seasonEnd}).`,
      );
    }
    if (publishable.length === 0) {
      return { published: 0 };
    }

    const nowIso = new Date().toISOString();
    const { error: ue } = await admin
      .from("tournaments")
      .update({
        status: "PUBLISHED",
        published_at: nowIso,
        approved_at: nowIso,
        season_id: season.id,
      })
      .in(
        "id",
        publishable.map((t) => t.id),
      );
    if (ue) failDb(ue);

    const slices = new Set<string>();
    for (const t of publishable) {
      const monthKey = tfMonth(t.qualifying_month, t.qualifying_year);
      slices.add(`${t.game_id}|${t.store_id}|MONTHLY|${monthKey}|y=${t.qualifying_year}|m=${t.qualifying_month}`);
      slices.add(`${t.game_id}|${t.store_id}|SEMESTRAL|${season.slug}|season_id=${season.id}`);
    }

    for (const key of slices) {
      const parts = key.split("|");
      const game_id = parts[0];
      const store_id = parts[1];
      const type = parts[2] as "MONTHLY" | "SEMESTRAL";
      const value = parts[3];
      const filter: { year?: number; month?: number; season_id?: string } = {};
      for (const p of parts.slice(4)) {
        const [k, v] = p.split("=");
        if (k === "y") filter.year = Number(v);
        if (k === "m") filter.month = Number(v);
        if (k === "season_id") filter.season_id = v;
      }
      await recomputeSnapshot(
        admin,
        game_id,
        store_id,
        type,
        value,
        filter,
        type === "SEMESTRAL" ? season.id : undefined,
      );
    }

    for (const t of publishable) {
      await logAction(
        admin,
        player,
        "TOURNAMENT_PUBLISHED",
        "tournament",
        t.id,
        `${t.game_id} — ${t.store_id} — ${t.tournament_date}`,
        { season_id: season.id },
      );
    }

    return { published: publishable.length };
  });

// ---------- Stores ----------
export const getTournamentDetail = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { tournament_id: string }) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = context;

    const { data: t, error: te } = await admin
      .from("tournaments")
      .select(
        "id, store_id, game_id, status, tournament_date, qualifying_month, qualifying_semester, qualifying_year, approved_at, undo_deadline, published_at, created_at, rejection_reason",
      )
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) failDb(te);
    if (!t) throw new Error("Torneo no encontrado");

    const [storeRes, gameRes, resultsRes] = await Promise.all([
      admin.from("stores").select("id, name, city, state").eq("id", t.store_id).maybeSingle(),
      admin.from("games").select("id, name, slug").eq("id", t.game_id).maybeSingle(),
      (async () => {
        // Try with optional columns first; fall back if columns missing.
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

    // is_new_player: player created at or after tournament upload.
    const tCreated = new Date(t.created_at ?? new Date().toISOString()).getTime();
    const results = (resultsRes.data ?? []).map((r: any) => {
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

    // Uploaded_by: best-effort — organizer of the store.
    const { data: orgs } = await admin
      .from("players")
      .select("geek_tag, email, role")
      .eq("home_store_id", t.store_id)
      .in("role", ["organizer", "admin"])
      .limit(1);
    const uploaded_by = orgs && orgs[0] ? { geek_tag: orgs[0].geek_tag, email: orgs[0].email } : null;

    // ---------- Alerts ----------
    const alerts: Alert[] = [];

    // CRITICAL: duplicate tournament (same store+game+date) already APPROVED/PUBLISHED.
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
        link: { to: `/admin/tournaments/${d.id}`, label: "Ver torneo existente" },
      });
    }

    // CRITICAL: same player appears in another tournament for the same game on the same day.
    if (playerIds.length > 0) {
      const { data: sameDayT } = await admin
        .from("tournaments")
        .select("id")
        .eq("game_id", t.game_id)
        .eq("tournament_date", t.tournament_date)
        .neq("id", t.id);
      const sameDayIds = (sameDayT ?? []).map((x) => x.id);
      if (sameDayIds.length > 0) {
        const { data: clash } = await admin
          .from("tournament_results")
          .select("player_id, tournament_id")
          .in("tournament_id", sameDayIds)
          .in("player_id", playerIds);
        const clashedPlayerIds = Array.from(new Set((clash ?? []).map((c) => c.player_id)));
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

    // WARNING: number of new players.
    const newCount = results.filter((r) => r.is_new_player).length;
    if (newCount > 0) {
      alerts.push({
        level: "WARNING",
        message: `${newCount} jugadores nuevos serán registrados automáticamente al aprobar`,
        link: null,
      });
    }

    // WARNING: uploaded > 3 days after tournament date.
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

    // WARNING: match_points not monotonically decreasing with rank.
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
      },
      store: storeRes.data ?? { id: t.store_id, name: "—", city: null, state: null },
      game: gameRes.data ?? { id: t.game_id, name: "—", slug: "" },
      uploaded_by,
      results,
      alerts,
    };
  });

export const rejectTournamentWithReason = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { tournament_id: string; reason: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
        reason: z.string().min(20).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: tBefore } = await admin
      .from("tournaments")
      .select("tournament_date, stores(name), games(name)")
      .eq("id", data.tournament_id)
      .maybeSingle();
    const update: TablesUpdate<"tournaments"> = {
      status: "DRAFT",
      approved_at: null,
      undo_deadline: null,
      rejection_reason: data.reason,
    };
    let { error } = await admin.from("tournaments").update(update).eq("id", data.tournament_id);
    if (error && /column .*rejection_reason.* does not exist/i.test(error.message)) {
      // Column missing — fall back to status reset only.
      delete update.rejection_reason;
      const retry = await admin.from("tournaments").update(update).eq("id", data.tournament_id);
      error = retry.error;
    }
    if (error) failDb(error);
    const game = (tBefore as any)?.games;
    const store = (tBefore as any)?.stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_REJECTED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${tBefore?.tournament_date ?? ""}`,
      { reason: data.reason },
    );
    return { ok: true };
  });

export const approveTournamentForReview = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { tournament_id: string }) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const now = new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: deadline.toISOString(),
        rejection_reason: null,
        approved_by: player.id,
      })
      .eq("id", data.tournament_id);
    if (error) {
      if (/column .*rejection_reason.* does not exist/i.test(error.message)) {
        const retry = await admin
          .from("tournaments")
          .update({
            status: "APPROVED",
            approved_at: now.toISOString(),
            undo_deadline: deadline.toISOString(),
            approved_by: player.id,
          })
          .eq("id", data.tournament_id);
        if (retry.error) failDb(retry.error);
      } else {
        failDb(error);
      }
    }
    const { data: tAfter } = await admin
      .from("tournaments")
      .select("tournament_date, store_id, game_id, stores(name), games(name)")
      .eq("id", data.tournament_id)
      .maybeSingle();
    const game = (tAfter as any)?.games;
    const store = (tAfter as any)?.stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_APPROVED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${tAfter?.tournament_date ?? ""}`,
      { store_id: tAfter?.store_id, game_id: tAfter?.game_id },
    );
    return { ok: true };
  });

export const undoApproveTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { tournament_id: string }) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: t, error: te } = await admin
      .from("tournaments")
      .select("status, undo_deadline")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) failDb(te);
    if (!t) throw new Error("Torneo no encontrado");
    if (t.status !== "APPROVED") {
      throw new Error("Solo se puede deshacer un torneo aprobado");
    }
    if (t.undo_deadline && new Date(t.undo_deadline).getTime() < Date.now()) {
      throw new Error("La ventana de corrección expiró");
    }
    const { error } = await admin
      .from("tournaments")
      .update({ status: "DRAFT", approved_at: null, undo_deadline: null })
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    return { ok: true };
  });

// ---------- Store edit & organizer assignment ----------
export const getAdminTournamentHistory = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
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
    const { admin } = context;
    const PAGE_SIZE = 25;
    const page = data.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    const baseCols = "id, tournament_date, status, csv_url, approved_at, published_at, created_at, game_id, store_id";
    const extraCols = ", rejection_reason, approved_by, season_id";

    const build = (cols: string) => {
      let q = admin
        .from("tournaments")
        .select(cols, { count: "exact" })
        .order("tournament_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (data.status) q = q.eq("status", data.status as TournamentStatus);
      if (data.game_id) q = q.eq("game_id", data.game_id);
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
    const approverIds = Array.from(new Set(rows.filter((r) => r.approved_by).map((r) => r.approved_by as string)));
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
        ? admin.from("tournament_results").select("tournament_id").in("tournament_id", tournamentIds)
        : Promise.resolve({ data: [] as any[] }),
      admin.from("tournaments").select("status"),
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

// ---------- Filter dropdowns (admin history page) ----------
export const getAdminFilterOptions = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;
    const [gamesRes, storesRes, seasonsRes] = await Promise.all([
      admin.from("games").select("id, name").eq("is_active", true).order("name"),
      admin.from("stores").select("id, name, city").eq("is_active", true).order("city").order("name"),
      admin.from("seasons").select("id, name, slug, status").order("start_date", { ascending: false }),
    ]);
    return {
      games: gamesRes.data ?? [],
      stores: storesRes.data ?? [],
      seasons: seasonsRes.data ?? [],
    };
  });

// ---------- Manager TCG assignment helper ----------
export const unapproveAdminTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
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
      .select("status, game_id, store_id, tournament_date")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t || (t as any).status !== "APPROVED") {
      throw new Error("Torneo no válido para des-aprobación");
    }
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "DRAFT",
        approved_at: null,
        undo_deadline: null,
        approved_by: null,
        rejection_reason: data.reason,
      })
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    await logAction(
      admin,
      player,
      "TOURNAMENT_REJECTED",
      "tournament",
      data.tournament_id,
      `${(t as any).game_id} — ${(t as any).store_id}`,
      { reason: data.reason, unapproved_by_role: player.role },
    );
    return { success: true };
  });

export const unpublishTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
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
        "status, game_id, store_id, tournament_date, qualifying_year, qualifying_month, season_id, stores(name), games(name)",
      )
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t || (t as any).status !== "PUBLISHED") {
      throw new Error("Solo se pueden despublicar torneos en estado Publicado");
    }

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
    await recomputeSnapshot(
      admin,
      (t as any).game_id,
      (t as any).store_id,
      "MONTHLY",
      monthKey,
      { year: (t as any).qualifying_year, month: (t as any).qualifying_month },
    );
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

    const game = (t as any).games;
    const store = (t as any).stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_UNPUBLISHED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${(t as any).tournament_date}`,
      { reason: data.reason },
    );
    return { success: true };
  });

export const republishTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select("status")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t || (t as any).status !== "UNPUBLISHED") {
      throw new Error("Solo se pueden re-aprobar torneos despublicados");
    }
    const now = new Date();
    const undoDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: undoDeadline.toISOString(),
        approved_by: player.id,
        unpublish_reason: null,
      } as any)
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    await logAction(
      admin,
      player,
      "TOURNAMENT_APPROVED",
      "tournament",
      data.tournament_id,
      data.tournament_id,
      { source: "republish" },
    );
    return { success: true };
  });

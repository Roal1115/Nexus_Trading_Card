import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { todayInMexicoStr } from "./utils";

function normalizeId(id: string): string {
  const stripped = id.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

async function resolvePlayer(
  admin: ReturnType<typeof getNexusAdmin>,
  geekTag: string,
  membershipId: string | null,
  gameId: string,
): Promise<{ id: string; isNew: boolean }> {
  // 1. Try TCG ID (normalized) first
  if (membershipId) {
    const normalizedInput = normalizeId(membershipId);
    const { data: byId } = await admin
      .from("player_tcg_ids")
      .select("player_id")
      .eq("game_id", gameId)
      .eq("tcg_user_id_normalized", normalizedInput)
      .maybeSingle();
    if (byId?.player_id) {
      return { id: byId.player_id as string, isNew: false };
    }
  }

  // 2. Fall back to geek_tag
  const { data: byTag } = await admin.from("players").select("id").eq("geek_tag", geekTag).maybeSingle();
  if (byTag?.id) {
    return { id: byTag.id as string, isNew: false };
  }

  // 3. Auto-create
  const { data: newPlayer, error } = await admin
    .from("players")
    .insert({
      geek_tag: geekTag,
      is_active: true,
      role: "player",
    })
    .select("id")
    .single();
  if (error || !newPlayer) {
    throw new Error(`No se pudo crear el jugador: ${geekTag}`);
  }

  if (membershipId && newPlayer.id) {
    await admin.from("player_tcg_ids").upsert(
      {
        player_id: newPlayer.id,
        game_id: gameId,
        tcg_user_id: membershipId,
        tcg_user_id_normalized: normalizeId(membershipId),
      },
      { onConflict: "player_id,game_id", ignoreDuplicates: true },
    );
  }

  return { id: newPlayer.id as string, isNew: true };
}

function computeQualifying(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1; // 1..12
  const year = d.getFullYear();
  const semester = month <= 6 ? 1 : 2;
  return { qualifying_month: month, qualifying_semester: semester, qualifying_year: year };
}

// ---------- Mi Tienda ----------
export const getOrganizerOverview = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const [storesRes, gamesRes, homeStoreRes] = await Promise.all([
      admin
        .from("stores")
        .select("id, slug, name, city, state, country, is_active")
        .eq("is_active", true)
        .order("city", { ascending: true })
        .order("name", { ascending: true }),
      admin.from("games").select("id, slug, name, publisher, logo_url, is_active").eq("is_active", true).order("name"),
      player.home_store_id
        ? admin
            .from("stores")
            .select(
              "id, slug, name, city, state, country, is_active, address, phone, google_maps_url, description, opening_hours, instagram, website, twitter, twitch",
            )
            .eq("id", player.home_store_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    if (storesRes.error) failDb(storesRes.error);
    if (gamesRes.error) failDb(gamesRes.error);
    if (homeStoreRes.error) failDb(homeStoreRes.error);

    return {
      player,
      stores: storesRes.data ?? [],
      games: gamesRes.data ?? [],
      homeStore: homeStoreRes.data ?? null,
    };
  });

export const updateHomeStore = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.role !== "admin") {
      throw new Error("Tu tienda es asignada por el administrador. Contacta a soporte para cambios.");
    }
    const { error } = await admin.from("players").update({ home_store_id: data.store_id }).eq("id", player.id);
    if (error) failDb(error);
    return { ok: true };
  });

export const updateStoreInfo = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: {
      store_id: string;
      name: string;
      city?: string;
      state?: string;
      address?: string;
      phone?: string;
      google_maps_url?: string;
      description?: string;
      opening_hours?: string;
      instagram?: string;
      website?: string;
      twitter?: string;
      twitch?: string;
    }) =>
      z
        .object({
          store_id: z.string().uuid(),
          name: z.string().min(1).max(120),
          city: z.string().max(120).optional(),
          state: z.string().max(120).optional(),
          address: z.string().max(300).optional(),
          phone: z.string().max(20).optional(),
          google_maps_url: z.string().max(500).optional(),
          description: z.string().max(500).optional(),
          opening_hours: z.string().max(200).optional(),
          instagram: z.string().max(100).optional(),
          website: z.string().max(200).optional(),
          twitter: z.string().max(100).optional(),
          twitch: z.string().max(100).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.home_store_id !== data.store_id && player.role !== "admin") {
      throw new Error("Solo puedes editar tu tienda asignada");
    }
    const { store_id, ...fields } = data;
    const { error } = await admin
      .from("stores")
      .update({
        name: fields.name,
        city: fields.city || null,
        state: fields.state || null,
        address: fields.address || null,
        phone: fields.phone || null,
        google_maps_url: fields.google_maps_url || null,
        description: fields.description || null,
        opening_hours: fields.opening_hours || null,
        instagram: fields.instagram || null,
        website: fields.website || null,
        twitter: fields.twitter || null,
        twitch: fields.twitch || null,
      })
      .eq("id", store_id);
    if (error) failDb(error);
    return { ok: true };
  });

// ---------- Mis Torneos ----------
export const getMyTournaments = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { status?: string; game_id?: string; date_from?: string; date_to?: string }) =>
    z
      .object({
        status: z.string().optional(),
        game_id: z.string().optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (!player.home_store_id) return { tournaments: [], store_name: null, stats: {} as Record<string, number> };

    const { data: store } = await admin
      .from("stores")
      .select("name, city")
      .eq("id", player.home_store_id)
      .maybeSingle();

    const baseCols = "id, game_id, tournament_date, status, csv_url, approved_at, published_at, created_at";
    const extraCols = ", rejection_reason, approved_by";

    let rows: any[] | null = null;
    let err: { message: string } | null = null;
    {
      let q = admin
        .from("tournaments")
        .select(baseCols + extraCols)
        .eq("store_id", player.home_store_id)
        .order("tournament_date", { ascending: false });
      if (data.status) q = q.eq("status", data.status);
      if (data.game_id) q = q.eq("game_id", data.game_id);
      if (data.date_from) q = q.gte("tournament_date", data.date_from);
      if (data.date_to) q = q.lte("tournament_date", data.date_to);
      const res = await q;
      rows = res.data as any[] | null;
      err = res.error;
    }
    if (err && /column .* does not exist/i.test(err.message)) {
      let q = admin
        .from("tournaments")
        .select(baseCols)
        .eq("store_id", player.home_store_id)
        .order("tournament_date", { ascending: false });
      if (data.status) q = q.eq("status", data.status);
      if (data.game_id) q = q.eq("game_id", data.game_id);
      if (data.date_from) q = q.gte("tournament_date", data.date_from);
      if (data.date_to) q = q.lte("tournament_date", data.date_to);
      const res = await q;
      rows = res.data as any[] | null;
      err = res.error;
    }
    if (err) failDb(err);

    const tournamentIds = (rows ?? []).map((r) => r.id);
    const gameIds = Array.from(new Set((rows ?? []).map((r) => r.game_id)));
    const approverIds = Array.from(
      new Set((rows ?? []).filter((r) => r.approved_by).map((r) => r.approved_by as string)),
    );

    const [gmsRes, approversRes, resultsRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] }),
      approverIds.length
        ? admin.from("players").select("id, geek_tag").in("id", approverIds)
        : Promise.resolve({ data: [] as any[] }),
      tournamentIds.length
        ? admin.from("tournament_results").select("tournament_id").in("tournament_id", tournamentIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const gamesMap = Object.fromEntries((gmsRes.data ?? []).map((g: any) => [g.id, g.name]));
    const approversMap = Object.fromEntries((approversRes.data ?? []).map((p: any) => [p.id, p.geek_tag]));
    const participantMap = (resultsRes.data ?? []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.tournament_id] = (acc[r.tournament_id] ?? 0) + 1;
      return acc;
    }, {});

    const stats = (rows ?? []).reduce((acc: Record<string, number>, t: any) => {
      const key = t.rejection_reason && t.status === "DRAFT" ? "REJECTED" : t.status;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      store_name: store ? `${store.name} — ${store.city ?? ""}`.trim() : null,
      stats,
      tournaments: (rows ?? []).map((r: any) => ({
        ...r,
        game_name: gamesMap[r.game_id] ?? "—",
        approved_by_tag: r.approved_by ? (approversMap[r.approved_by] ?? "—") : null,
        participants: participantMap[r.id] ?? 0,
      })),
    };
  });

export const deleteDraftTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { tournament_id: string }) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t, error: te } = await admin
      .from("tournaments")
      .select("id, store_id, status")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) failDb(te);
    if (!t) throw new Error("Torneo no encontrado");
    if (t.store_id !== player.home_store_id && player.role !== "admin") {
      throw new Error("Este torneo no pertenece a tu tienda");
    }
    if (t.status !== "DRAFT" && player.role !== "admin") {
      throw new Error("Solo se pueden eliminar torneos en estado DRAFT");
    }
    const { error } = await admin.from("tournaments").delete().eq("id", data.tournament_id);
    if (error) failDb(error);
    return { ok: true };
  });

// ---------- Subir Torneo (DRAFT vacío, legacy) ----------
export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { game_id: string; tournament_date: string; csv_url?: string | null }) =>
    z
      .object({
        game_id: z.string().uuid(),
        tournament_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        csv_url: z.string().url().max(2048).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (!player.home_store_id) {
      throw new Error("Primero asigna una tienda en 'Mi Tienda'");
    }
    const q = computeQualifying(data.tournament_date);
    const { data: created, error } = await admin
      .from("tournaments")
      .insert({
        store_id: player.home_store_id,
        game_id: data.game_id,
        tournament_date: data.tournament_date,
        ...q,
        status: "DRAFT",
        csv_url: data.csv_url ?? null,
      })
      .select("id")
      .single();
    if (error) failDb(error);
    return { id: created.id };
  });

// ---------- Upload Tournament Results (CSV parsed client-side) ----------
const ResultRowSchema = z.object({
  rank: z.number().int().min(1),
  geek_tag: z.string().min(1).max(120),
  membership_id: z.string().max(120).nullable().optional(),
  match_points: z.number().int().min(0).nullable(),
  omw_percentage: z.number().min(0).max(100).nullable(),
  wins: z.number().int().min(0).nullable(),
  losses: z.number().int().min(0).nullable(),
  draws: z.number().int().min(0).nullable(),
  points_earned: z.number().min(0),
});

export const uploadTournamentResults = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: {
      store_id: string;
      game_id: string;
      tournament_date: string;
      rows: Array<z.infer<typeof ResultRowSchema>>;
      tournament_id?: string;
      csv_url?: string | null;
    }) =>
      z
        .object({
          store_id: z.string().uuid(),
          game_id: z.string().uuid(),
          tournament_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          rows: z.array(ResultRowSchema).min(1).max(2000),
          tournament_id: z.string().uuid().optional(),
          csv_url: z.string().url().max(2048).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.role !== "admin" && player.role !== "tcg_manager" && player.home_store_id !== data.store_id) {
      throw new Error("No puedes subir un torneo para esta tienda");
    }

    // Validar que el manager tiene autoridad sobre este TCG
    if (player.role === "tcg_manager") {
      const { data: mg } = await admin
        .from("manager_games")
        .select("id")
        .eq("player_id", player.id)
        .eq("game_id", data.game_id)
        .maybeSingle();
      if (!mg) {
        throw new Error("No tienes permisos para subir torneos de este TCG.");
      }
    }

    // Restringir fecha a la semana actual (lunes → hoy). Admin puede saltar la validación.
    if (player.role !== "admin") {
      // "Hoy" en zona horaria de México, no UTC del servidor
      const todayStr = todayInMexicoStr();
      const today = new Date(todayStr + "T12:00:00");

      const dayOfWeek = today.getDay();
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysSinceMonday);
      monday.setHours(0, 0, 0, 0);

      const tDate = new Date(data.tournament_date + "T12:00:00");
      if (tDate > today) {
        throw new Error("No se pueden subir torneos con fecha futura.");
      }
      if (tDate < monday) {
        throw new Error(
          `Solo se pueden subir torneos de la semana actual (desde el ${monday.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}).`,
        );
      }
    }

    // Validar que la tienda ofrece este TCG
    if (player.role !== "admin") {
      const { data: scheduleCheck } = await admin
        .from("store_schedules")
        .select("id")
        .eq("store_id", data.store_id)
        .eq("game_id", data.game_id)
        .limit(1)
        .maybeSingle();
      if (!scheduleCheck) {
        throw new Error("Esta tienda no tiene este TCG configurado en su calendario de torneos.");
      }
    }

    const { data: existing, error: dupErr } = await admin
      .from("tournaments")
      .select("id")
      .eq("store_id", data.store_id)
      .eq("game_id", data.game_id)
      .eq("tournament_date", data.tournament_date)
      .maybeSingle();
    if (dupErr) failDb(dupErr);
    if (existing) {
      return {
        ok: false as const,
        reason: "duplicate" as const,
        message: "Ya existe un torneo registrado para esta tienda, juego y fecha.",
      };
    }

    const q = computeQualifying(data.tournament_date);
    const insertPayload: Record<string, unknown> = {
      store_id: data.store_id,
      game_id: data.game_id,
      tournament_date: data.tournament_date,
      ...q,
      status: "DRAFT",
      csv_url: data.csv_url ?? null,
    };
    if (data.tournament_id) insertPayload.id = data.tournament_id;
    const { data: tournament, error: te } = await admin.from("tournaments").insert(insertPayload).select("id").single();
    if (te) failDb(te);
    const tournamentId = tournament.id;

    const cleanup = async (msg: string): Promise<never> => {
      await admin.from("tournament_results").delete().eq("tournament_id", tournamentId);
      await admin.from("tournaments").delete().eq("id", tournamentId);
      throw new Error(msg);
    };

    const baseRows: Array<{
      tournament_id: string;
      player_id: string;
      rank: number;
      wins: number | null;
      losses: number | null;
      draws: number;
      points_earned: number;
      match_points: number | null;
      omw_percentage: number | null;
    }> = [];
    let createdPlayers = 0;

    try {
      for (const r of data.rows) {
        const { id: playerId, isNew } = await resolvePlayer(
          admin,
          r.geek_tag.trim(),
          r.membership_id ? r.membership_id.trim() || null : null,
          data.game_id,
        );
        if (isNew) createdPlayers++;
        baseRows.push({
          tournament_id: tournamentId,
          player_id: playerId,
          rank: r.rank,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws ?? 0,
          points_earned: r.points_earned,
          match_points: r.match_points,
          omw_percentage: r.omw_percentage,
        });
      }
    } catch (e) {
      await cleanup((e as Error).message);
    }

    let insertErr = (await admin.from("tournament_results").insert(baseRows)).error;
    if (insertErr && /column .* does not exist/i.test(insertErr.message)) {
      const stripped = baseRows.map(({ match_points: _m, omw_percentage: _o, ...rest }) => rest);
      insertErr = (await admin.from("tournament_results").insert(stripped)).error;
    }
    if (insertErr) await cleanup(insertErr.message);

    return {
      ok: true as const,
      id: tournamentId,
      inserted: baseRows.length,
      created_players: createdPlayers,
    };
  });

// ---------- Stores list (organizer/admin) ----------
export const listActiveStores = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .handler(async ({ context }) => {
    const { admin } = context;
    const { data, error } = await admin
      .from("stores")
      .select("id, name, city")
      .eq("is_active", true)
      .order("city", { ascending: true })
      .order("name", { ascending: true });
    if (error) failDb(error);
    return { stores: data ?? [] };
  });

// ---------- Check existing player tags (for preview) ----------
export const lookupPlayerTags = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { tags: string[] }) =>
    z.object({ tags: z.array(z.string().min(1).max(120)).min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: rows, error } = await admin.from("players").select("geek_tag").in("geek_tag", data.tags);
    if (error) failDb(error);
    return { existing: (rows ?? []).map((r) => r.geek_tag) };
  });

// ---------- Badge counts ----------
export const getOrganizerBadgeCounts = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    if (!player.home_store_id) return { pending: 0, approved: 0, appeals: 0 };

    const [pending, approved, appealsRes] = await Promise.all([
      admin
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .eq("store_id", player.home_store_id)
        .eq("status", "DRAFT"),
      admin
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .eq("store_id", player.home_store_id)
        .eq("status", "APPROVED"),
      admin
        .from("round_appeals")
        .select("*", { count: "exact", head: true })
        .eq("store_id", player.home_store_id)
        .eq("status", "pending"),
    ]);

    return {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      appeals: appealsRes.count ?? 0,
    };
  });

// ---------- Organizer read-only calendar (scoped to home_store) ----------
export const getOrganizerCalendar = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { week_start?: string }) => z.object({ week_start: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const today = new Date();
    let monday: Date;
    if (data.week_start) {
      monday = new Date(data.week_start + "T00:00:00");
    } else {
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const mondayStr = monday.toISOString().split("T")[0];
    const sundayStr = sunday.toISOString().split("T")[0];

    const emptyStats = {
      total_overdue: 0,
      uploaded_so_far: 0,
      days_elapsed: 0,
      total_expected: 0,
      today_expected: 0,
      today_submitted: 0,
    };

    if (!player.home_store_id) {
      return { week_start: mondayStr, week_end: sundayStr, entries: [], stats: emptyStats };
    }

    const { data: schedules, error: se } = await admin
      .from("store_schedules")
      .select("id, store_id, game_id, day_of_week, start_time, stores(id, name, city, state, zone, phone, instagram)")
      .eq("store_id", player.home_store_id);
    if (se) failDb(se);

    const gameIds = Array.from(new Set((schedules ?? []).map((s: any) => s.game_id)));
    const { data: gamesData } = gameIds.length
      ? await admin.from("games").select("id, name").in("id", gameIds)
      : { data: [] as any[] };
    const gameNamesMap = new Map((gamesData ?? []).map((g: any) => [g.id, g.name]));

    const { data: weekTournaments } = await admin
      .from("tournaments")
      .select("id, store_id, game_id, tournament_date, status, rejection_reason")
      .eq("store_id", player.home_store_id)
      .gte("tournament_date", mondayStr)
      .lte("tournament_date", sundayStr);

    const tournamentMap = new Map<string, any>();
    (weekTournaments ?? []).forEach((t: any) => {
      const d = new Date(t.tournament_date + "T12:00:00");
      tournamentMap.set(`${t.store_id}-${t.game_id}-${d.getDay()}`, t);
    });

    const nowMs = Date.now();
    const entries = (schedules ?? []).map((s: any) => {
      const store = s.stores;
      const tournament = tournamentMap.get(`${s.store_id}-${s.game_id}-${s.day_of_week}`);
      const offset = s.day_of_week === 0 ? 6 : s.day_of_week - 1;
      const entryDate = new Date(monday);
      entryDate.setDate(monday.getDate() + offset);
      const entryDateStr = entryDate.toISOString().split("T")[0];
      const [h, m] = String(s.start_time).split(":").map(Number);
      const tStart = new Date(entryDate);
      tStart.setHours(h, m, 0, 0);
      const tEnd = new Date(tStart);
      tEnd.setHours(h + 3, m, 0, 0);
      const isToday = entryDate.toDateString() === today.toDateString();
      const isPast = entryDate < today && !isToday;
      const isFuture = entryDate > today && !isToday;
      const isOngoing = isToday && nowMs >= tStart.getTime() && nowMs <= tEnd.getTime();
      const hasEnded = isPast || (isToday && nowMs > tEnd.getTime());
      const isSubmitted =
        tournament &&
        (tournament.status !== "DRAFT" || (tournament.status === "DRAFT" && !tournament.rejection_reason));
      let reportStatus: "submitted" | "overdue" | "pending" | "upcoming";
      if (isSubmitted) reportStatus = "submitted";
      else if (hasEnded && !tournament) reportStatus = "overdue";
      else if (isFuture) reportStatus = "upcoming";
      else reportStatus = "pending";
      return {
        id: `${s.store_id}-${s.game_id}-${s.day_of_week}`,
        store_id: s.store_id,
        game_id: s.game_id,
        game_name: gameNamesMap.get(s.game_id) ?? "—",
        store_name: store?.name ?? "—",
        city: store?.city ?? "—",
        zone: store?.zone ?? "Zona Extendida",
        phone: store?.phone ?? null,
        instagram: store?.instagram ?? null,
        day_of_week: s.day_of_week,
        date: entryDateStr,
        start_time: String(s.start_time).slice(0, 5),
        is_past: isPast,
        is_today: isToday,
        is_future: isFuture,
        is_ongoing: isOngoing,
        has_ended: hasEnded,
        report_status: reportStatus,
        tournament_id: tournament?.id ?? null,
        tournament_status: tournament?.status ?? null,
      };
    });

    const elapsedEntries = entries.filter((e: any) => !e.is_future);
    const uploadedSoFar = elapsedEntries.filter((e: any) => e.report_status === "submitted").length;
    const totalOverdue = entries.filter((e: any) => e.report_status === "overdue").length;
    return {
      week_start: mondayStr,
      week_end: sundayStr,
      entries,
      stats: {
        total_overdue: totalOverdue,
        uploaded_so_far: uploadedSoFar,
        days_elapsed: elapsedEntries.length,
        total_expected: entries.length,
        today_expected: entries.filter((e: any) => e.is_today).length,
        today_submitted: entries.filter((e: any) => e.is_today && e.report_status === "submitted").length,
      },
    };
  });

// ---------- Store Analytics ----------

type PlayerCategory = "recurrente" | "ocasional" | "una_vez" | "inactivo";

const CATEGORY_RANK: Record<PlayerCategory, number> = {
  recurrente: 3,
  ocasional: 2,
  una_vez: 1,
  inactivo: 0,
};

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekRanges(start: Date, end: Date): Array<{ start: Date; end: Date }> {
  const weeks: Array<{ start: Date; end: Date }> = [];
  let cur = getMondayOf(start);
  while (cur <= end) {
    const weekEnd = new Date(cur);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    weeks.push({ start: new Date(cur), end: weekEnd });
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function classifyPlayer(
  tournamentDates: string[], // ISO date strings "YYYY-MM-DD", sorted
  rangeStart: Date,
  rangeEnd: Date,
): PlayerCategory {
  const datesInRange = tournamentDates
    .map((d) => new Date(d + "T12:00:00"))
    .filter((d) => d >= rangeStart && d <= rangeEnd);

  if (datesInRange.length === 0) return "inactivo";
  if (datesInRange.length === 1) return "una_vez";

  const weeks = getWeekRanges(rangeStart, rangeEnd);
  const allWeeksCovered = weeks.every((w) =>
    datesInRange.some((d) => d >= w.start && d <= w.end),
  );

  return allWeeksCovered ? "recurrente" : "ocasional";
}

export const getStoreAnalytics = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: { store_id?: string; date_from?: string; date_to?: string; game_id?: string }) =>
      z
        .object({
          store_id: z.string().uuid().optional(),
          date_from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          date_to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          game_id: z.string().uuid().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Scope: organizer can only query their own store; admin can pass any store_id
    let storeId = player.home_store_id;
    if (data.store_id) {
      if (player.role === "admin") {
        storeId = data.store_id;
      } else if (data.store_id !== player.home_store_id) {
        throw new Error("No tienes permiso para ver analytics de esta tienda");
      }
    }
    if (!storeId) {
      throw new Error("Esta tienda no tiene torneos registrados aún");
    }

    // Threshold settings (defaults if no row exists)
    const { data: settings } = await admin
      .from("store_analytics_settings")
      .select("inactive_threshold_days, at_risk_threshold_days")
      .eq("store_id", storeId)
      .maybeSingle();
    const inactiveThresholdDays = settings?.inactive_threshold_days ?? 45;
    const atRiskThresholdDays = settings?.at_risk_threshold_days ?? 21;

    // Date range: default = first tournament of store -> today
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let rangeStart: Date;
    let rangeEnd: Date = data.date_to ? new Date(data.date_to + "T23:59:59") : today;

    if (data.date_from) {
      rangeStart = new Date(data.date_from + "T00:00:00");
    } else {
      const { data: firstT } = await admin
        .from("tournaments")
        .select("tournament_date")
        .eq("store_id", storeId)
        .order("tournament_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      rangeStart = firstT?.tournament_date
        ? new Date(firstT.tournament_date + "T00:00:00")
        : new Date(today.getFullYear(), today.getMonth(), 1);
    }

    // Fetch all results for this store with tournament date + game_id + player info
    const { data: tournamentsInStore } = await admin
      .from("tournaments")
      .select("id, tournament_date, game_id")
      .eq("store_id", storeId)
      .in("status", ["APPROVED", "PUBLISHED"]);

    const tournamentIds = (tournamentsInStore ?? []).map((t) => t.id);
    const tournamentMap = new Map(
      (tournamentsInStore ?? []).map((t) => [t.id, t]),
    );

    const { data: allResults } = tournamentIds.length
      ? await admin
          .from("tournament_results")
          .select("player_id, tournament_id")
          .in("tournament_id", tournamentIds)
      : { data: [] as Array<{ player_id: string; tournament_id: string }> };

    // Build per-player list of tournament dates (all-time, for inactivity calc)
    let playerDatesAll = new Map<string, string[]>();
    for (const r of allResults ?? []) {
      const t = tournamentMap.get(r.tournament_id);
      if (!t) continue;
      const arr = playerDatesAll.get(r.player_id) ?? [];
      arr.push(t.tournament_date);
      playerDatesAll.set(r.player_id, arr);
    }
    for (const arr of playerDatesAll.values()) arr.sort();

    const playerIds = Array.from(playerDatesAll.keys());
    const { data: playersData } = playerIds.length
      ? await admin.from("players").select("id, geek_tag").in("id", playerIds)
      : { data: [] as Array<{ id: string; geek_tag: string }> };
    const geekTagMap = new Map((playersData ?? []).map((p) => [p.id, p.geek_tag]));

    // gameBreakdown is computed below from the unfiltered allResults/tournamentMap so
    // the TCG tabs always show every game in the store. The filter for game_id is
    // applied AFTER gameBreakdown, replacing playerDatesAll for all downstream metrics.

    // ---------- 1. Total players in range (computed AFTER possible game_id filter) ----------
    const computePlayersInRange = () => {
      const s = new Set<string>();
      for (const [pid, dates] of playerDatesAll.entries()) {
        const inRange = dates.some((d) => {
          const dt = new Date(d + "T12:00:00");
          return dt >= rangeStart && dt <= rangeEnd;
        });
        if (inRange) s.add(pid);
      }
      return s;
    };
    let playersInRange = computePlayersInRange();

    // ---------- 2. Breakdown by TCG (only games in store_schedules) ----------
    const { data: schedules } = await admin
      .from("store_schedules")
      .select("game_id, games(id, name)")
      .eq("store_id", storeId);
    const storeGameIds = Array.from(
      new Set((schedules ?? []).map((s: any) => s.game_id)),
    );
    const gameNameMap = new Map(
      (schedules ?? []).map((s: any) => [s.game_id, s.games?.name ?? "—"]),
    );

    const gameBreakdown = storeGameIds.map((gameId) => {
      const players = new Set<string>();
      for (const r of allResults ?? []) {
        const t = tournamentMap.get(r.tournament_id);
        if (!t || t.game_id !== gameId) continue;
        const dt = new Date(t.tournament_date + "T12:00:00");
        if (dt >= rangeStart && dt <= rangeEnd) players.add(r.player_id);
      }
      return {
        game_id: gameId,
        game_name: gameNameMap.get(gameId) ?? "—",
        players: players.size,
      };
    });

    // If filtering by game_id, rebuild playerDatesAll using only that game's tournaments.
    // gameBreakdown above intentionally stays unfiltered so the tabs always show every TCG.
    if (data.game_id) {
      const filtered = new Map<string, string[]>();
      for (const r of allResults ?? []) {
        const t = tournamentMap.get(r.tournament_id);
        if (!t || t.game_id !== data.game_id) continue;
        const arr = filtered.get(r.player_id) ?? [];
        arr.push(t.tournament_date);
        filtered.set(r.player_id, arr);
      }
      for (const arr of filtered.values()) arr.sort();
      playerDatesAll = filtered;
      playersInRange = computePlayersInRange();
    }


    // ---------- 3. Attendance trend (weekly) ----------
    const weeks = getWeekRanges(rangeStart, rangeEnd);
    const attendanceTrend = weeks.map((w) => {
      const players = new Set<string>();
      for (const [pid, dates] of playerDatesAll.entries()) {
        const has = dates.some((d) => {
          const dt = new Date(d + "T12:00:00");
          return dt >= w.start && dt <= w.end;
        });
        if (has) players.add(pid);
      }
      return {
        week_start: w.start.toISOString().split("T")[0],
        players: players.size,
      };
    });

    // ---------- 4. Player classification (range + current) ----------
    const currentRangeEnd = today;
    const currentRangeStart = new Date(today);
    currentRangeStart.setDate(currentRangeStart.getDate() - 45); // matches inactive threshold

    const classification = Array.from(playerDatesAll.entries())
      .map(([pid, dates]) => {
        const categoryInRange = classifyPlayer(dates, rangeStart, rangeEnd);
        const categoryCurrent = classifyPlayer(dates, currentRangeStart, currentRangeEnd);
        const lastVisit = dates[dates.length - 1];
        return {
          player_id: pid,
          geek_tag: geekTagMap.get(pid) ?? "—",
          tournaments_in_range: dates.filter((d) => {
            const dt = new Date(d + "T12:00:00");
            return dt >= rangeStart && dt <= rangeEnd;
          }).length,
          category_range: categoryInRange,
          category_current: categoryCurrent,
          last_visit: lastVisit,
          trend:
            CATEGORY_RANK[categoryCurrent] === CATEGORY_RANK[categoryInRange]
              ? "same"
              : CATEGORY_RANK[categoryCurrent] < CATEGORY_RANK[categoryInRange]
                ? "down"
                : "up",
        };
      })
      .filter((c) => playersInRange.has(c.player_id) || c.category_current !== c.category_range);

    // ---------- 5. Category summary (donut) ----------
    const categorySummary: Record<PlayerCategory, number> = {
      recurrente: 0,
      ocasional: 0,
      una_vez: 0,
      inactivo: 0,
    };
    for (const c of classification) {
      if (playersInRange.has(c.player_id)) {
        categorySummary[c.category_range]++;
      }
    }

    // ---------- 6. At-risk players (always vs today) ----------
    const atRisk = Array.from(playerDatesAll.entries())
      .map(([pid, dates]) => {
        const lastVisit = new Date(dates[dates.length - 1] + "T12:00:00");
        const daysSince = Math.floor((today.getTime() - lastVisit.getTime()) / 86_400_000);
        return { player_id: pid, geek_tag: geekTagMap.get(pid) ?? "—", days_since: daysSince };
      })
      .filter((p) => p.days_since > atRiskThresholdDays && p.days_since <= inactiveThresholdDays)
      .sort((a, b) => a.days_since - b.days_since);

    // ---------- 7. Top players ----------
    const topPlayers = Array.from(playerDatesAll.entries())
      .map(([pid, dates]) => ({
        player_id: pid,
        geek_tag: geekTagMap.get(pid) ?? "—",
        tournaments: dates.filter((d) => {
          const dt = new Date(d + "T12:00:00");
          return dt >= rangeStart && dt <= rangeEnd;
        }).length,
      }))
      .filter((p) => p.tournaments > 0)
      .sort((a, b) => b.tournaments - a.tournaments)
      .slice(0, 10);

    return {
      store_id: storeId,
      range: {
        start: rangeStart.toISOString().split("T")[0],
        end: rangeEnd.toISOString().split("T")[0],
      },
      settings: {
        inactive_threshold_days: inactiveThresholdDays,
        at_risk_threshold_days: atRiskThresholdDays,
      },
      total_players: playersInRange.size,
      game_breakdown: gameBreakdown,
      attendance_trend: attendanceTrend,
      category_summary: categorySummary,
      classification,
      at_risk: atRisk,
      top_players: topPlayers,
    };
  });

// ---------- Historial de Torneos (organizer scoped) ----------
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
        .eq("store_id", player.home_store_id)
        .order("tournament_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (data.status) q = q.eq("status", data.status);
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

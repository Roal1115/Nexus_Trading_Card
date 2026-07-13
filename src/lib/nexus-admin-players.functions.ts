import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { requireNexusAdmin } from "./nexus-auth.middleware";
import { logAction, PAGE_SIZE } from "./nexus-admin-shared";
import type { TablesUpdate } from "./database.types";


export const listPlayers = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator(
    (d: {
      search?: string;
      role?: "all" | "player" | "organizer" | "tcg_manager" | "admin";
      active?: "all" | "true" | "false";
      store_id?: string | null;
      sort?: "recent" | "geek_tag" | "points";
      page?: number;
      include_last_sign_in?: boolean;
    }) =>
      z
        .object({
          search: z.string().max(120).optional(),
          role: z.enum(["all", "player", "organizer", "tcg_manager", "admin"]).optional(),
          active: z.enum(["all", "true", "false"]).optional(),
          store_id: z.string().uuid().optional().nullable(),
          sort: z.enum(["recent", "geek_tag", "points"]).optional(),
          page: z.number().int().min(1).max(10000).optional(),
          include_last_sign_in: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const page = data.page ?? 1;
    const sort = data.sort ?? "recent";

    let orderedIdsByPoints: string[] | null = null;
    if (sort === "points") {
      const { data: snaps, error: se } = await admin
        .from("leaderboard_snapshots")
        .select("player_id, total_points")
        .eq("timeframe_type", "SEMESTRAL");
      if (se) failDb(se);
      const sum = new Map<string, number>();
      for (const s of snaps ?? []) {
        sum.set(s.player_id, (sum.get(s.player_id) ?? 0) + (s.total_points ?? 0));
      }
      orderedIdsByPoints = Array.from(sum.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = admin
      .from("players")
      .select(
        "id, geek_tag, display_name, email, role, home_store_id, is_active, created_at, manager_games(game_id, games(name))",
        { count: "exact" },
      );

    if (data.role && data.role !== "all") q = q.eq("role", data.role);
    if (data.active && data.active !== "all") q = q.eq("is_active", data.active === "true");
    if (data.store_id) q = q.eq("home_store_id", data.store_id);

    if (data.search) {
      const term = data.search.trim();
      if (term.length > 0) {
        const safe = term.replace(/[%,()]/g, "");
        if (safe.includes("@")) {
          q = q.ilike("email", `%${safe}%`);
        } else {
          q = q.ilike("geek_tag", `%${safe}%`);
        }
      }
    }

    if (sort === "points" && orderedIdsByPoints) {
      const idsForPage = orderedIdsByPoints.slice(from, to + 1);
      if (idsForPage.length === 0) {
        const { count } = await q;
        return { players: [], total: count ?? 0, page, page_size: PAGE_SIZE };
      }
      q = q.in("id", idsForPage);
      const { data: rows, error, count } = await q;
      if (error) failDb(error);
      const map = new Map((rows ?? []).map((r) => [r.id, r]));
      const ordered = idsForPage.map((id) => map.get(id)).filter(Boolean);
      return await withLastSignIn(admin, ordered, {
        total: count ?? ordered.length,
        page,
        include: data.include_last_sign_in,
      });
    }

    if (sort === "geek_tag") {
      q = q.order("geek_tag", { ascending: true });
    } else {
      q = q.order("created_at", { ascending: false });
    }
    q = q.range(from, to);

    const { data: rows, error, count } = await q;
    if (error) failDb(error);

    return await withLastSignIn(admin, rows ?? [], {
      total: count ?? 0,
      page,
      include: data.include_last_sign_in,
    });
  });

async function withLastSignIn(
  admin: ReturnType<typeof getNexusAdmin>,
  rows: any[],
  meta: { total: number; page: number; include?: boolean },
) {
  let enriched = rows;
  if (meta.include) {
    enriched = await Promise.all(
      rows.map(async (r) => {
        if (!r?.email) return { ...r, last_sign_in_at: null };
        try {
          const { data } = await (admin as any).auth.admin.listUsers({
            page: 1,
            perPage: 1,
          });
          const u = (data?.users ?? []).find((x: any) => x.email === r.email);
          return { ...r, last_sign_in_at: u?.last_sign_in_at ?? null };
        } catch {
          return { ...r, last_sign_in_at: null };
        }
      }),
    );
  }
  return {
    players: enriched,
    total: meta.total,
    page: meta.page,
    page_size: PAGE_SIZE,
  };
}

export const setPlayerActive = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { player_id: string; is_active: boolean }) =>
    z
      .object({
        player_id: z.string().uuid(),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin.from("players").update({ is_active: data.is_active }).eq("id", data.player_id);
    if (error) failDb(error);
    return { ok: true };
  });

export const getPlayerDetail = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { player_id: string }) =>
    z
      .object({
        player_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const baseCols = "id, geek_tag, display_name, email, avatar_url, role, home_store_id, is_active, created_at";
    const extraCols = ", gender, birth_date, is_profile_public";

    let player: any = null;
    {
      const r = await admin
        .from("players")
        .select(baseCols + extraCols)
        .eq("id", data.player_id)
        .maybeSingle();
      if (r.error && /column .* does not exist/i.test(r.error.message)) {
        const r2 = await admin.from("players").select(baseCols).eq("id", data.player_id).maybeSingle();
        if (r2.error) failDb(r2.error);
        player = r2.data;
      } else if (r.error) {
        failDb(r.error);
      } else {
        player = r.data;
      }
    }
    if (!player) throw new Error("Jugador no encontrado");

    const [storeRes, resultsRes, snapsRes, tcgIdsRes] = await Promise.all([
      player.home_store_id
        ? admin.from("stores").select("id, name, city, state").eq("id", player.home_store_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      admin
        .from("tournament_results")
        .select("tournament_id, rank, wins, losses, points_earned")
        .eq("player_id", data.player_id),
      admin
        .from("leaderboard_snapshots")
        .select("game_id, timeframe_type, timeframe_value, total_points, rank_position")
        .eq("player_id", data.player_id)
        .eq("timeframe_type", "SEMESTRAL")
        .order("timeframe_value", { ascending: false }),
      admin.from("player_tcg_ids").select("game_id, tcg_user_id, games(name)").eq("player_id", data.player_id),
    ]);

    const tIds = Array.from(new Set((resultsRes.data ?? []).map((r) => r.tournament_id)));
    const { data: tournaments } = tIds.length
      ? await admin.from("tournaments").select("id, tournament_date, game_id, store_id").in("id", tIds)
      : { data: [] as any[] };

    const totalPoints = (resultsRes.data ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0);
    const wins = (resultsRes.data ?? []).filter((r) => r.rank === 1).length;

    return {
      player,
      store: storeRes.data ?? null,
      tournaments_played: tIds.length,
      tournaments_won: wins,
      total_points: totalPoints,
      results: resultsRes.data ?? [],
      tournaments: tournaments ?? [],
      yearly_snapshots: snapsRes.data ?? [],
      tcg_ids: ((tcgIdsRes.data ?? []) as any[]).map((r) => ({
        game_id: r.game_id as string,
        tcg_user_id: r.tcg_user_id as string,
        games: Array.isArray(r.games) ? (r.games[0] ?? null) : (r.games ?? null),
      })) as Array<{
        game_id: string;
        tcg_user_id: string;
        games: { name: string } | null;
      }>,
    };
  });

function normalizeTcgId(id: string): string {
  const stripped = id.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

export const updatePlayerDetail = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator(
    (d: {
      player_id: string;
      display_name?: string | null;
      gender?: string | null;
      birth_date?: string | null;
      is_profile_public?: boolean;
      tcg_ids?: Array<{ game_id: string; tcg_user_id: string }>;
    }) =>
      z
        .object({
          player_id: z.string().uuid(),
          display_name: z.string().max(120).nullable().optional(),
          gender: z.string().max(40).nullable().optional(),
          birth_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .optional(),
          is_profile_public: z.boolean().optional(),
          tcg_ids: z
            .array(
              z.object({
                game_id: z.string().uuid(),
                tcg_user_id: z.string().min(1).max(120),
              }),
            )
            .optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const update: TablesUpdate<"players"> = {};
    if (data.display_name !== undefined) update.display_name = data.display_name || null;
    if (data.gender !== undefined) update.gender = data.gender || null;
    if (data.birth_date !== undefined) update.birth_date = data.birth_date || null;
    if (data.is_profile_public !== undefined) update.is_profile_public = data.is_profile_public;

    if (Object.keys(update).length > 0) {
      const { error } = await admin.from("players").update(update).eq("id", data.player_id);
      if (error && !/column .* does not exist/i.test(error.message)) {
        failDb(error);
      }
      if (error) {
        // Retry only with always-present columns
        const safe: TablesUpdate<"players"> = {};
        if (update.display_name !== undefined) safe.display_name = update.display_name;
        if (Object.keys(safe).length > 0) {
          const r2 = await admin.from("players").update(safe).eq("id", data.player_id);
          if (r2.error) failDb(r2.error);
        }
      }
    }

    if (data.tcg_ids) {
      const rows = data.tcg_ids.map((t) => ({
        player_id: data.player_id,
        game_id: t.game_id,
        tcg_user_id: t.tcg_user_id.trim(),
        tcg_user_id_normalized: normalizeTcgId(t.tcg_user_id.trim()),
      }));
      if (rows.length > 0) {
        const { error } = await admin.from("player_tcg_ids").upsert(rows, { onConflict: "player_id,game_id" });
        if (error) failDb(error);
      }
    }

    const { data: target } = await admin.from("players").select("geek_tag").eq("id", data.player_id).maybeSingle();

    await logAction(
      admin,
      player,
      "PLAYER_DETAIL_UPDATED",
      "player",
      data.player_id,
      target?.geek_tag ?? data.player_id,
      { fields: Object.keys(update), tcg_ids_count: data.tcg_ids?.length ?? 0 },
    );

    return { ok: true };
  });

export const setPlayerRole = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator(
    (d: { player_id: string; role: "player" | "organizer" | "tcg_manager" | "admin"; home_store_id?: string | null }) =>
      z
        .object({
          player_id: z.string().uuid(),
          role: z.enum(["player", "organizer", "tcg_manager", "admin"]),
          home_store_id: z.string().uuid().optional().nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: targetPlayer } = await admin
      .from("players")
      .select("geek_tag, role")
      .eq("id", data.player_id)
      .maybeSingle();
    const update: TablesUpdate<"players"> = { role: data.role };
    if (data.home_store_id !== undefined) update.home_store_id = data.home_store_id;
    const { error } = await admin.from("players").update(update).eq("id", data.player_id);
    if (error) failDb(error);

    // Limpiar TCGs asignados si el rol ya no es tcg_manager
    if (data.role !== "tcg_manager") {
      await admin.from("manager_games").delete().eq("player_id", data.player_id);
    }

    await logAction(admin, player, "ROLE_CHANGED", "player", data.player_id, targetPlayer?.geek_tag ?? data.player_id, {
      old_role: targetPlayer?.role,
      new_role: data.role,
    });
    return { ok: true };
  });

// ---------- Detalle de torneo (admin review) ----------

export const deletePlayerAccount = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { player_id: string; confirm_tag: string }) =>
    z
      .object({
        player_id: z.string().uuid(),
        confirm_tag: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player: actor } = context;
    const { data: target } = await admin
      .from("players")
      .select("id, geek_tag, auth_user_id, role")
      .eq("id", data.player_id)
      .maybeSingle();
    if (!target) throw new Error("Usuario no encontrado");
    if ((target as any).geek_tag !== data.confirm_tag) {
      throw new Error("El Player Tag no coincide");
    }
    if ((target as any).role === "admin") {
      throw new Error("No puedes eliminar una cuenta de admin");
    }
    const authUserId = (target as any).auth_user_id as string | null;
    if (authUserId) {
      try {
        await admin.auth.admin.deleteUser(authUserId);
      } catch (e) {
        console.error("auth deleteUser error:", e);
      }
    }
    const { error } = await admin.from("players").delete().eq("id", data.player_id);
    if (error) failDb(error);
    await logAction(admin, actor, "ACCOUNT_DELETED", "player", data.player_id, (target as any).geek_tag);
    return { success: true };
  });

// ==================== Unapprove Tournament (Admin) ====================

export const listStaffMembers = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;

    const { data, error } = await admin
      .from("players")
      .select(
        "id, geek_tag, email, role, is_active, home_store_id, work_schedule, contact_primary, contact_backup, created_at, manager_games(game_id, games(id, name))",
      )
      .in("role", ["organizer", "tcg_manager", "admin"])
      .order("role", { ascending: true })
      .order("geek_tag", { ascending: true });

    if (error) failDb(error);

    const storeIds = Array.from(
      new Set((data ?? []).filter((p: any) => p.home_store_id).map((p: any) => p.home_store_id as string)),
    );
    const storesRes = storeIds.length
      ? await admin.from("stores").select("id, name, city").in("id", storeIds)
      : { data: [] as any[] };
    const storeMap = new Map(((storesRes.data ?? []) as any[]).map((s: any) => [s.id, s]));

    return (data ?? []).map((p: any) => ({
      id: p.id,
      geek_tag: p.geek_tag,
      email: p.email,
      role: p.role,
      is_active: p.is_active,
      home_store: p.home_store_id ? (storeMap.get(p.home_store_id) ?? null) : null,
      manager_games: p.manager_games ?? [],
      work_schedule: p.work_schedule ?? null,
      contact_primary: p.contact_primary ?? null,
      contact_backup: p.contact_backup ?? null,
      created_at: p.created_at,
    }));
  });

export const upsertStaffMember = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator(
    (d: {
      email: string;
      geek_tag: string;
      role: "tcg_manager" | "organizer";
      work_schedule?: string;
      contact_primary?: string;
      contact_backup?: string;
    }) =>
      z
        .object({
          email: z.string().email(),
          geek_tag: z.string().min(3).max(30),
          role: z.enum(["tcg_manager", "organizer"]),
          work_schedule: z.string().max(200).optional(),
          contact_primary: z.string().max(50).optional(),
          contact_backup: z.string().max(50).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player: actor } = context;

    const opFields = {
      work_schedule: data.work_schedule ?? null,
      contact_primary: data.contact_primary ?? null,
      contact_backup: data.contact_backup ?? null,
    };

    // Step 1 — check if player already exists by email
    const { data: existingByEmail } = await admin
      .from("players")
      .select("id, geek_tag, role")
      .eq("email", data.email)
      .maybeSingle();

    if (existingByEmail) {
      const updates: TablesUpdate<"players"> = {
        role: data.role,
        ...opFields,
      };
      if (existingByEmail.geek_tag !== data.geek_tag) {
        const { data: tagTaken } = await admin
          .from("players")
          .select("id")
          .eq("geek_tag", data.geek_tag)
          .neq("id", existingByEmail.id)
          .maybeSingle();
        if (!tagTaken) updates.geek_tag = data.geek_tag;
      }
      const { error } = await admin.from("players").update(updates).eq("id", existingByEmail.id);
      if (error) failDb(error);

      if (existingByEmail.role === "tcg_manager" && data.role !== "tcg_manager") {
        await admin.from("manager_games").delete().eq("player_id", existingByEmail.id);
      }

      await logAction(admin, actor, "ROLE_CHANGED", "player", existingByEmail.id, existingByEmail.geek_tag, {
        old_role: existingByEmail.role,
        new_role: data.role,
        source: "staff_upsert",
      });

      return { player_id: existingByEmail.id as string, was_existing: true };
    }

    // Scenario A — new user: create auth account, then update player record
    const tempPassword = Math.random().toString(36).slice(2) + "Aa1!";
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { geek_tag: data.geek_tag },
    });
    if (authErr) failDb(authErr);

    // Trigger handle_new_auth_user should create the players row; fetch it
    const { data: newPlayer } = await admin
      .from("players")
      .select("id")
      .eq("auth_user_id", authUser.user.id)
      .maybeSingle();

    let playerId: string | null = newPlayer?.id ?? null;

    if (playerId) {
      await admin
        .from("players")
        .update({
          role: data.role,
          email: data.email,
          geek_tag: data.geek_tag,
          is_active: true,
          ...opFields,
        })
        .eq("id", playerId);
    }

    await logAction(admin, actor, "ROLE_CHANGED", "player", playerId, data.geek_tag, {
      new_role: data.role,
      source: "staff_created",
    });

    return { player_id: playerId, was_existing: false };
  });

export const updateStaffOperationalFields = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator(
    (d: {
      player_id: string;
      work_schedule?: string | null;
      contact_primary?: string | null;
      contact_backup?: string | null;
    }) =>
      z
        .object({
          player_id: z.string().uuid(),
          work_schedule: z.string().max(200).nullable().optional(),
          contact_primary: z.string().max(50).nullable().optional(),
          contact_backup: z.string().max(50).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin
      .from("players")
      .update({
        work_schedule: data.work_schedule ?? null,
        contact_primary: data.contact_primary ?? null,
        contact_backup: data.contact_backup ?? null,
      })
      .eq("id", data.player_id);
    if (error) failDb(error);
    return { success: true };
  });

export const deactivateStaffMember = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { player_id: string; action: "deactivate" | "delete" }) =>
    z
      .object({
        player_id: z.string().uuid(),
        action: z.enum(["deactivate", "delete"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player: actor } = context;
    if (data.action === "deactivate") {
      const { error } = await admin.from("players").update({ is_active: false }).eq("id", data.player_id);
      if (error) failDb(error);
      await logAction(admin, actor, "ROLE_CHANGED", "player", data.player_id, data.player_id, {
        action: "deactivated",
      });
    } else {
      const { error } = await admin
        .from("players")
        .update({ role: "player", is_active: false })
        .eq("id", data.player_id);
      if (error) failDb(error);
      await admin.from("manager_games").delete().eq("player_id", data.player_id);
      await logAction(admin, actor, "ROLE_CHANGED", "player", data.player_id, data.player_id, {
        action: "removed_from_staff",
      });
    }
    return { success: true };
  });

// ==================== Store Schedules (Admin) ====================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb } from "./nexus-admin.server";
import { requireNexusAdmin } from "./nexus-auth.middleware";
import { logAction, PAGE_SIZE } from "./nexus-admin-shared";

export const listSeasons = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.admin
      .from("seasons")
      .select("id, name, slug, start_date, end_date, is_active, status, created_at")
      .order("start_date", { ascending: false });
    if (error) failDb(error);
    return data ?? [];
  });

export const createSeason = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { name: string; slug: string; start_date: string; end_date: string }) =>
    z
      .object({
        name: z.string().min(3).max(120),
        slug: z
          .string()
          .min(3)
          .max(80)
          .regex(/^[a-z0-9-]+$/, "Slug inválido"),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (data.end_date < data.start_date) {
      throw new Error("La fecha de fin debe ser posterior a la de inicio.");
    }
    const { data: newSeason, error } = await admin
      .from("seasons")
      .insert({
        name: data.name,
        slug: data.slug,
        start_date: data.start_date,
        end_date: data.end_date,
        is_active: false,
        status: "UPCOMING",
      })
      .select("id")
      .maybeSingle();
    if (error) failDb(error);
    await logAction(admin, player, "SEASON_CREATED", "season", newSeason?.id ?? null, data.name, {
      start_date: data.start_date,
      end_date: data.end_date,
    });
    return { ok: true };
  });

export const activateSeason = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { season_id: string }) => z.object({ season_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error: de } = await admin.from("seasons").update({ is_active: false }).neq("id", data.season_id);
    if (de) failDb(de);
    const { error } = await admin
      .from("seasons")
      .update({ is_active: true, status: "ACTIVE" })
      .eq("id", data.season_id);
    if (error) failDb(error);
    const { data: season } = await admin.from("seasons").select("name").eq("id", data.season_id).maybeSingle();
    await logAction(admin, player, "SEASON_ACTIVATED", "season", data.season_id, season?.name ?? data.season_id);
    return { ok: true };
  });

export const closeSeason = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { season_id: string }) => z.object({ season_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin
      .from("seasons")
      .update({ is_active: false, status: "CLOSED" })
      .eq("id", data.season_id);
    if (error) failDb(error);
    const { data: season } = await admin.from("seasons").select("name").eq("id", data.season_id).maybeSingle();
    await logAction(admin, player, "SEASON_CLOSED", "season", data.season_id, season?.name ?? data.season_id);
    return { ok: true };
  });

// ---------- Audit log ----------
export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator(
    (d: {
      action?: string;
      actor_role?: string;
      target_type?: string;
      date_from?: string;
      date_to?: string;
      search?: string;
      page?: number;
    }) =>
      z
        .object({
          action: z.string().optional(),
          actor_role: z.string().optional(),
          target_type: z.string().optional(),
          date_from: z.string().optional(),
          date_to: z.string().optional(),
          search: z.string().max(100).optional(),
          page: z.number().min(1).default(1),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const PAGE_SIZE = 25;
    const page = data.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    let q = admin
      .from("admin_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (data.action) q = q.eq("action", data.action);
    if (data.actor_role) q = q.eq("actor_role", data.actor_role);
    if (data.target_type) q = q.eq("target_type", data.target_type);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to + "T23:59:59Z");
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      const pat = `%${s}%`;
      q = q.or(`actor_tag.ilike.${pat},target_label.ilike.${pat},action.ilike.${pat},target_type.ilike.${pat}`);
    }

    const { data: logs, count, error } = await q;
    if (error) failDb(error);

    return {
      logs: (logs ?? []) as AuditLogRow[],
      total: count ?? 0,
      page,
      page_size: PAGE_SIZE,
    };
  });

export type AuditLogRow = {
  id: string;
  actor_id: string;
  actor_role: string;
  actor_tag: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string;
  metadata: { [key: string]: string | number | boolean | null | undefined } | null;
  created_at: string;
};

// ---------- Badge counts ----------
export const getAdminBadgeCounts = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { activity_last_seen?: string }) => z.object({ activity_last_seen: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const nowIso = new Date().toISOString();

    const pendingP = admin
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "DRAFT")
      .is("rejection_reason", null);

    const readyP = admin
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "APPROVED")
      .lt("undo_deadline", nowIso);

    const approvedActiveP = admin
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "APPROVED");

    let activityQ = admin.from("admin_audit_log").select("*", { count: "exact", head: true });
    if (data.activity_last_seen) {
      activityQ = activityQ.gt("created_at", data.activity_last_seen);
    }

    const [pending, readyToPublish, approvedActive, activityCount] = await Promise.all([
      pendingP,
      readyP,
      approvedActiveP,
      activityQ,
    ]);

    return {
      pending: pending.count ?? 0,
      readyToPublish: readyToPublish.count ?? 0,
      approvedActive: approvedActive.count ?? 0,
      activity: activityCount.count ?? 0,
    };
  });

// ---------- Historial Global de Torneos ----------
export const getManagerAssignedGames = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { player_id: string }) => z.object({ player_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { admin } = context;
    const [allGames, assigned] = await Promise.all([
      admin.from("games").select("id, name, slug").eq("is_active", true).order("name"),
      admin.from("manager_games").select("game_id").eq("player_id", data.player_id),
    ]);
    const assignedIds = new Set((assigned.data ?? []).map((r: any) => r.game_id));
    return {
      all_games: (allGames.data ?? []) as Array<{ id: string; name: string; slug: string }>,
      assigned_game_ids: Array.from(assignedIds) as string[],
    };
  });

// ---------- Staff (organizer / tcg_manager) management ----------

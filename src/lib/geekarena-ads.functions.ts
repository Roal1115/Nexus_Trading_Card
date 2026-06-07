import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";
import { requireGeekarenaAdmin } from "./geekarena-auth.middleware";
import { logAction } from "./geekarena-admin.functions";

// ─── Helper: ensure ad_metrics row exists ────────────────────────────────
async function ensureMetricsRow(admin: ReturnType<typeof getGeekarenaAdmin>) {
  const { data } = await admin.from("ad_metrics").select("*").maybeSingle();
  if (data) return data;
  const { data: inserted } = await admin
    .from("ad_metrics")
    .insert({ total_views: 0, total_cycles: 0 })
    .select("*")
    .single();
  return inserted;
}

// ─── Public: get active sponsor ───────────────────────────────────────────
export const getActiveSponsor = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getGeekarenaAdmin();
  const metrics = await ensureMetricsRow(admin);
  if (!metrics) return null;

  if (!metrics.current_sponsor_id) {
    const { data: first } = await admin
      .from("sponsors")
      .select("*")
      .eq("is_active", true)
      .order("priority_rank", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (first) {
      await admin
        .from("ad_metrics")
        .update({ current_sponsor_id: first.id, updated_at: new Date().toISOString() })
        .eq("id", metrics.id);
    }
    return first ?? null;
  }

  const { data: sponsor } = await admin
    .from("sponsors")
    .select("*")
    .eq("id", metrics.current_sponsor_id)
    .maybeSingle();

  return sponsor ?? null;
});

// ─── Public: list all active sponsors for the carousel ───────────────────
export const listActiveSponsors = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getGeekarenaAdmin();
  const { data } = await admin
    .from("sponsors")
    .select("*")
    .eq("is_active", true)
    .order("priority_rank", { ascending: true });
  return data ?? [];
});

// ─── Public: register a page view and rotate if needed ────────────────────
export const registerAdView = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getGeekarenaAdmin();
  const metrics = await ensureMetricsRow(admin);
  if (!metrics) return null;

  let currentId = metrics.current_sponsor_id;
  if (!currentId) {
    const { data: first } = await admin
      .from("sponsors")
      .select("*")
      .eq("is_active", true)
      .order("priority_rank", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!first) return null;
    currentId = first.id;
    await admin
      .from("ad_metrics")
      .update({ current_sponsor_id: currentId, updated_at: new Date().toISOString() })
      .eq("id", metrics.id);
  }

  const { data: current } = await admin
    .from("sponsors")
    .select("*")
    .eq("id", currentId)
    .maybeSingle();
  if (!current) return null;

  const newViews = (current.views_count ?? 0) + 1;

  if (newViews >= (current.view_limit ?? 0)) {
    const { data: nextSponsor } = await admin
      .from("sponsors")
      .select("*")
      .eq("is_active", true)
      .gt("priority_rank", current.priority_rank)
      .order("priority_rank", { ascending: true })
      .limit(1)
      .maybeSingle();

    await admin
      .from("sponsors")
      .update({
        views_count: 0,
        cycles_count: (current.cycles_count ?? 0) + 1,
      })
      .eq("id", current.id);

    if (nextSponsor) {
      await admin
        .from("ad_metrics")
        .update({
          total_views: (metrics.total_views ?? 0) + 1,
          current_sponsor_id: nextSponsor.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", metrics.id);
    } else {
      const { data: first } = await admin
        .from("sponsors")
        .select("*")
        .eq("is_active", true)
        .order("priority_rank", { ascending: true })
        .limit(1)
        .maybeSingle();

      await admin
        .from("ad_metrics")
        .update({
          total_views: (metrics.total_views ?? 0) + 1,
          total_cycles: (metrics.total_cycles ?? 0) + 1,
          current_sponsor_id: first?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", metrics.id);
    }
  } else {
    await admin.from("sponsors").update({ views_count: newViews }).eq("id", current.id);
    await admin
      .from("ad_metrics")
      .update({
        total_views: (metrics.total_views ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", metrics.id);
  }

  return current;
});

// ─── Admin: list all sponsors ──────────────────────────────────────────────
export const listSponsors = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;
    await ensureMetricsRow(admin);
    const [sponsorsRes, metricsRes] = await Promise.all([
      admin.from("sponsors").select("*").order("priority_rank", { ascending: true }),
      admin.from("ad_metrics").select("*").maybeSingle(),
    ]);

    const sponsors = sponsorsRes.data ?? [];
    const totalViewLimit = sponsors.reduce(
      (sum: number, s: any) => sum + (s.view_limit ?? 0),
      0,
    );
    const updatedAt = metricsRes.data?.updated_at;
    const days = updatedAt
      ? Math.max(
          Math.ceil((Date.now() - new Date(updatedAt).getTime()) / 86400000),
          1,
        )
      : 1;
    const avgDailyViews = metricsRes.data?.total_views
      ? Math.round((metricsRes.data.total_views ?? 0) / days)
      : 0;

    return {
      sponsors,
      metrics: {
        total_sponsors: sponsors.length,
        total_views: metricsRes.data?.total_views ?? 0,
        total_cycles: metricsRes.data?.total_cycles ?? 0,
        total_view_limit_per_cycle: totalViewLimit,
        current_sponsor_id: metricsRes.data?.current_sponsor_id ?? null,
        avg_daily_views: avgDailyViews,
      },
    };
  });

// ─── Admin: create sponsor ─────────────────────────────────────────────────
export const createSponsor = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { name: string; priority_rank: number; view_limit: number }) =>
    z
      .object({
        name: z.string().min(2).max(120),
        priority_rank: z.number().int().min(1),
        view_limit: z.number().int().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.admin.from("sponsors").insert({
      name: data.name,
      priority_rank: data.priority_rank,
      view_limit: data.view_limit,
      views_count: 0,
      cycles_count: 0,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Admin: update sponsor images ─────────────────────────────────────────
export const updateSponsorImages = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      sponsor_id: string;
      logo_url?: string;
      vertical_url?: string;
      horizontal_url?: string;
    }) =>
      z
        .object({
          sponsor_id: z.string().uuid(),
          logo_url: z.string().url().optional(),
          vertical_url: z.string().url().optional(),
          horizontal_url: z.string().url().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const update: Record<string, string> = {};
    if (data.logo_url) update.logo_url = data.logo_url;
    if (data.vertical_url) update.vertical_url = data.vertical_url;
    if (data.horizontal_url) update.horizontal_url = data.horizontal_url;
    if (Object.keys(update).length === 0) return { success: true };
    const { error } = await context.admin
      .from("sponsors")
      .update(update)
      .eq("id", data.sponsor_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Admin: update sponsor settings ───────────────────────────────────────
export const updateSponsor = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      sponsor_id: string;
      name?: string;
      priority_rank?: number;
      view_limit?: number;
      is_active?: boolean;
    }) =>
      z
        .object({
          sponsor_id: z.string().uuid(),
          name: z.string().min(2).max(120).optional(),
          priority_rank: z.number().int().min(1).optional(),
          view_limit: z.number().int().min(1).optional(),
          is_active: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sponsor_id, ...fields } = data;
    const { error } = await context.admin
      .from("sponsors")
      .update(fields)
      .eq("id", sponsor_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Admin: reset a sponsor's view count ──────────────────────────────────
export const resetSponsorViews = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { sponsor_id: string }) =>
    z.object({ sponsor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.admin
      .from("sponsors")
      .update({ views_count: 0 })
      .eq("id", data.sponsor_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Admin: delete a sponsor ─────────────────────────────────────────────
export const deleteSponsor = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { sponsor_id: string }) =>
    z.object({ sponsor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Get sponsor name before deleting for the audit log
    const { data: sponsor } = await admin
      .from("sponsors")
      .select("name, priority_rank")
      .eq("id", data.sponsor_id)
      .maybeSingle();

    // If this was the active sponsor, clear current_sponsor_id in metrics
    await admin
      .from("ad_metrics")
      .update({ current_sponsor_id: null })
      .eq("current_sponsor_id", data.sponsor_id);

    const { error } = await admin
      .from("sponsors")
      .delete()
      .eq("id", data.sponsor_id);

    if (error) throw new Error(error.message);

    await logAction(
      admin,
      player,
      "SPONSOR_DELETED",
      "sponsor",
      data.sponsor_id,
      sponsor?.name ?? data.sponsor_id,
      { priority_rank: sponsor?.priority_rank },
    );

    return { success: true };
  });

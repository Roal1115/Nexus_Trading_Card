import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb, getNexusAdmin } from "./nexus-admin.server";
import { logAction } from "./nexus-admin-shared";
import { requireNexusManager, requireNexusOrganizer } from "./nexus-auth.middleware";
import { assertManagerOwnsGame, getManagerGameIds } from "./nexus-manager-shared";
import {
  addDays,
  creditPercentTotal,
  MIN_NOTICE_DAYS,
  pickFichaVersions,
  PRIZE_KINDS,
  sameCommercialTerms,
  type Prize,
  type PrizeKind,
} from "./ficha";
import { getActiveSeason } from "./nexus-admin-core";
import { nowInMexicoTimeStr, todayInMexicoStr } from "./utils";

type Admin = ReturnType<typeof getNexusAdmin>;
type Caller = { id: string; role: string; home_store_id?: string | null };

const slotSchema = z.object({
  store_id: z.string().uuid(),
  game_id: z.string().uuid(),
  league_id: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
type Slot = z.infer<typeof slotSchema>;

const dayOf = (date: string) => new Date(`${date}T12:00:00`).getDay();

async function assertCanManage(admin: Admin, player: Caller, storeId: string, gameId: string) {
  if (player.role === "organizer") {
    if (player.home_store_id !== storeId) throw new Error("Esta tienda no es la tuya");
    return;
  }
  await assertManagerOwnsGame(admin, player, gameId);
}

/** Hora efectiva de la fecha; falla si la tienda no tiene ese horario. */
async function slotStartTime(admin: Admin, slot: Slot): Promise<string | null> {
  const day = dayOf(slot.date);
  if (slot.league_id) {
    const { data, error } = await admin
      .from("store_league_schedules")
      .select("id, start_time")
      .eq("store_id", slot.store_id)
      .eq("game_id", slot.game_id)
      .eq("league_id", slot.league_id)
      .eq("day_of_week", day)
      .eq("shares_national_slot", false)
      .limit(1)
      .maybeSingle();
    if (error) failDb(error);
    if (!data) throw new Error("Este horario ya no está disponible");
    const { data: override } = await admin
      .from("store_league_schedule_overrides")
      .select("start_time")
      .eq("league_schedule_id", data.id)
      .eq("occurrence_date", slot.date)
      .maybeSingle();
    return override?.start_time || data.start_time;
  }
  const { data, error } = await admin
    .from("store_schedules")
    .select("id, start_time")
    .eq("store_id", slot.store_id)
    .eq("game_id", slot.game_id)
    .eq("day_of_week", day)
    .maybeSingle();
  if (error) failDb(error);
  if (!data) throw new Error("Este horario ya no está disponible");
  const { data: override } = await admin
    .from("store_schedule_overrides")
    .select("start_time")
    .eq("national_schedule_id", data.id)
    .eq("occurrence_date", slot.date)
    .maybeSingle();
  return override?.start_time || data.start_time;
}

async function assertNotStarted(admin: Admin, slot: Slot) {
  const start = await slotStartTime(admin, slot);
  const today = todayInMexicoStr();
  const started =
    slot.date < today ||
    (slot.date === today && !!start && start.slice(0, 5) <= nowInMexicoTimeStr().slice(0, 5));
  if (started) throw new Error("Este torneo ya empezó");
}

const whereLeague = <Q extends { eq: any; is: any }>(query: Q, leagueId: string | null): Q =>
  leagueId ? query.eq("league_id", leagueId) : query.is("league_id", null);

export const cancelScheduleOccurrence = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: Slot & { reason: string }) =>
    slotSchema.extend({ reason: z.string().trim().min(3).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    await assertCanManage(admin, player, data.store_id, data.game_id);
    await assertNotStarted(admin, data);

    const { data: existing, error: te } = await whereLeague(
      admin
        .from("tournaments")
        .select("id")
        .eq("store_id", data.store_id)
        .eq("game_id", data.game_id)
        .eq("tournament_date", data.date),
      data.league_id,
    ).limit(1);
    if (te) failDb(te);
    if (existing?.length) throw new Error("Esta fecha ya tiene un torneo registrado");

    const { error } = await (admin as any).from("schedule_cancellations").insert({
      store_id: data.store_id,
      game_id: data.game_id,
      league_id: data.league_id,
      occurrence_date: data.date,
      reason: data.reason,
      cancelled_by: player.id,
    });
    if (error?.code === "23505") throw new Error("Esta fecha ya estaba cancelada");
    if (error) failDb(error);
    await logAction(admin, player, "SCHEDULE_CANCELLED", "store", data.store_id, data.date, {
      game_id: data.game_id,
      league_id: data.league_id,
      reason: data.reason,
    });
    return { ok: true };
  });

export const restoreScheduleOccurrence = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: Slot) => slotSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    await assertCanManage(admin, player, data.store_id, data.game_id);
    await assertNotStarted(admin, data);

    const { data: removed, error } = await whereLeague(
      (admin as any)
        .from("schedule_cancellations")
        .delete()
        .eq("store_id", data.store_id)
        .eq("game_id", data.game_id)
        .eq("occurrence_date", data.date),
      data.league_id,
    ).select("id");
    if (error) failDb(error);
    if (!removed?.length) throw new Error("Esta fecha no estaba cancelada");
    await logAction(admin, player, "SCHEDULE_RESTORED", "store", data.store_id, data.date, {
      game_id: data.game_id,
      league_id: data.league_id,
    });
    return { ok: true };
  });

const prizeKinds = Object.keys(PRIZE_KINDS) as [PrizeKind, ...PrizeKind[]];
const fichaSchema = z
  .object({
    store_id: z.string().uuid(),
    game_id: z.string().uuid(),
    entry_fee_mxn: z.number().int().min(0).max(100000),
    prizes: z
      .array(
        z.object({
          place: z.string().trim().min(1).max(40),
          kind: z.enum(prizeKinds),
          amount: z.number().int().min(1).max(1000000),
        }),
      )
      .max(12),
    pool_percent: z.number().int().min(1).max(100).nullable(),
    format: z.string().trim().max(80).nullable(),
    capacity: z.number().int().min(1).max(1024).nullable(),
    registration_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .refine((v) => creditPercentTotal(v.prizes) <= 100, "El crédito no puede pasar del 100% del pool")
  .refine(
    (v) => creditPercentTotal(v.prizes) === 0 || v.pool_percent !== null,
    "Indica qué porcentaje de las inscripciones va al pool",
  );

async function loadVersions(admin: Admin, storeId: string, gameId: string, seasonId: string) {
  const { data, error } = await (admin as any)
    .from("tournament_fichas")
    .select("*")
    .eq("store_id", storeId)
    .eq("game_id", gameId)
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  if (error) failDb(error);
  return (data ?? []) as any[];
}

async function requireSeason(admin: Admin) {
  const season = await getActiveSeason(admin);
  if (!season) throw new Error("No hay una temporada activa");
  return season;
}

export const getFichaEditor = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id: string; game_id: string }) =>
    z.object({ store_id: z.string().uuid(), game_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    await assertCanManage(admin, player, data.store_id, data.game_id);
    const season = await getActiveSeason(admin);
    if (!season) return null;
    const versions = await loadVersions(admin, data.store_id, data.game_id, season.id);
    return {
      ...pickFichaVersions(versions, todayInMexicoStr()),
      pending: versions.find((v) => v.status === "pending") ?? null,
      rejected: versions[0]?.status === "rejected" ? versions[0] : null,
    };
  });

async function notifyStaffOfFicha(admin: Admin, storeId: string, gameId: string) {
  const [staffRes, managersRes, storeRes] = await Promise.all([
    admin.from("players").select("id").eq("role", "admin"),
    admin.from("manager_games").select("player_id").eq("game_id", gameId),
    admin.from("stores").select("name").eq("id", storeId).maybeSingle(),
  ]);
  const rows = [
    ...(staffRes.data ?? []).map((p) => ({ player_id: p.id, url: "/admin/fichas" })),
    ...(managersRes.data ?? []).map((m) => ({
      player_id: m.player_id,
      url: "/tcg-manager/fichas",
    })),
  ].map((r) => ({
    ...r,
    type: "ficha_review",
    title: "Ficha de tienda por revisar",
    body: `${storeRes.data?.name ?? "Una tienda"} envió costo y premios para revisión.`,
  }));
  if (rows.length === 0) return;
  // Un aviso fallido no debe deshacer un guardado que ya ocurrió.
  const { error } = await admin.from("notifications").insert(rows);
  if (error) console.error("ficha notify:", error.message);
}

/** Avisa a los jugadores de la tienda de un cambio que ya tiene fecha. */
async function notifyPlayersOfChange(admin: Admin, storeId: string, effectiveDate: string) {
  const [storeRes, homeRes, favoritesRes] = await Promise.all([
    admin.from("stores").select("name, slug").eq("id", storeId).maybeSingle(),
    admin.from("players").select("id").eq("home_store_id", storeId),
    admin.from("player_favorite_stores").select("player_id").eq("store_id", storeId),
  ]);
  const ids = new Set([
    ...(homeRes.data ?? []).map((p) => p.id),
    ...(favoritesRes.data ?? []).map((f) => f.player_id),
  ]);
  if (ids.size === 0 || !storeRes.data) return;
  const [y, m, d] = effectiveDate.split("-");
  const { error } = await admin.from("notifications").insert(
    Array.from(ids, (player_id) => ({
      player_id,
      type: "ficha_changed",
      title: `Cambian los datos del torneo en ${storeRes.data!.name}`,
      body: `El nuevo costo y los premios aplican a partir del ${d}/${m}/${y}.`,
      url: `/stores/${storeRes.data!.slug}/tournaments`,
    })),
  );
  if (error) console.error("ficha notify:", error.message);
}

export const saveFicha = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: z.infer<typeof fichaSchema>) => fichaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    await assertCanManage(admin, player, data.store_id, data.game_id);
    const season = await requireSeason(admin);
    const today = todayInMexicoStr();
    const versions = await loadVersions(admin, data.store_id, data.game_id, season.id);
    const { current, upcoming } = pickFichaVersions(versions, today);
    const baseline = upcoming ?? current;
    const pending = versions.find((v) => v.status === "pending");
    const now = new Date().toISOString();
    const details = {
      format: data.format || null,
      capacity: data.capacity,
      registration_time: data.registration_time,
      notes: data.notes || null,
    };
    const terms = {
      entry_fee_mxn: data.entry_fee_mxn,
      prizes: data.prizes,
      pool_percent: creditPercentTotal(data.prizes) > 0 ? data.pool_percent : null,
    };
    const table = () => (admin as any).from("tournament_fichas");

    // Formato, cupo, registro y notas no llevan aprobación ni aviso.
    if (baseline && sameCommercialTerms(baseline, terms)) {
      const { error } = await table()
        .update({ ...details, updated_at: now })
        .in("id", [current?.id, upcoming?.id].filter(Boolean));
      if (error) failDb(error);
      // Volver a los valores vigentes retira la propuesta que estaba por aprobarse.
      if (pending) {
        const { error: de } = await table().delete().eq("id", pending.id);
        if (de) failDb(de);
      }
      return { status: "details" as const, effective_date: null };
    }

    const row = {
      store_id: data.store_id,
      game_id: data.game_id,
      season_id: season.id,
      ...terms,
      ...details,
      submitted_by: player.id,
      updated_at: now,
    };

    if (player.role === "organizer") {
      const { error } = pending
        ? await table().update(row).eq("id", pending.id)
        : await table().insert({ ...row, status: "pending" });
      if (error) failDb(error);
      await logAction(admin, player, "FICHA_SUBMITTED", "store", data.store_id, season.name, {
        game_id: data.game_id,
      });
      if (!pending) await notifyStaffOfFicha(admin, data.store_id, data.game_id);
      return { status: "pending" as const, effective_date: null };
    }

    const effective = baseline ? addDays(today, MIN_NOTICE_DAYS) : today;
    if (pending) {
      const { error: de } = await table().delete().eq("id", pending.id);
      if (de) failDb(de);
    }
    const { error } = await table().insert({
      ...row,
      status: "approved",
      effective_date: effective,
      reviewed_by: player.id,
      reviewed_at: now,
    });
    if (error) failDb(error);
    await logAction(admin, player, "FICHA_APPROVED", "store", data.store_id, season.name, {
      game_id: data.game_id,
      effective_date: effective,
    });
    if (baseline) await notifyPlayersOfChange(admin, data.store_id, effective);
    return { status: "approved" as const, effective_date: effective };
  });

export const listPendingFichas = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    if (gameIds.length === 0) return [];
    const { data, error } = await (admin as any)
      .from("tournament_fichas")
      .select("*, stores(name, zone, subzone, city), games(name)")
      .eq("status", "pending")
      .in("game_id", gameIds)
      .order("updated_at");
    if (error) failDb(error);
    const pending = (data ?? []) as any[];
    if (pending.length === 0) return [];
    const { data: approved, error: ae } = await (admin as any)
      .from("tournament_fichas")
      .select("*")
      .eq("status", "approved")
      .in("store_id", [...new Set(pending.map((f) => f.store_id))]);
    if (ae) failDb(ae);
    const key = (f: any) => `${f.store_id}_${f.game_id}_${f.season_id}`;
    const approvedByKey = new Map<string, any[]>();
    for (const row of (approved ?? []) as any[]) {
      approvedByKey.set(key(row), [...(approvedByKey.get(key(row)) ?? []), row]);
    }
    const today = todayInMexicoStr();
    // Contra lo que verán los jugadores: el cambio ya programado o lo vigente.
    return pending.map((f) => {
      const { current, upcoming } = pickFichaVersions(approvedByKey.get(key(f)) ?? [], today);
      const baseline = upcoming ?? current;
      return {
        ...f,
        baseline: baseline && {
          entry_fee_mxn: baseline.entry_fee_mxn as number,
          prizes: baseline.prizes as Prize[],
          pool_percent: baseline.pool_percent as number | null,
        },
      };
    });
  });

export const reviewFicha = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { id: string; updated_at: string; approve: boolean; reason?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        updated_at: z.string(),
        approve: z.boolean(),
        reason: z.string().trim().min(3).max(300).optional(),
      })
      .refine((v) => v.approve || v.reason, "Escribe el motivo del rechazo")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: ficha, error: fe } = await (admin as any)
      .from("tournament_fichas")
      .select("game_id, store_id, season_id, stores(name)")
      .eq("id", data.id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!ficha) throw new Error("Estos datos ya no existen");
    await assertManagerOwnsGame(admin, player, ficha.game_id);

    const today = todayInMexicoStr();
    const versions = await loadVersions(admin, ficha.store_id, ficha.game_id, ficha.season_id);
    const { current, upcoming } = pickFichaVersions(versions, today);
    const isChange = Boolean(current ?? upcoming);
    const effective = !data.approve ? null : isChange ? addDays(today, MIN_NOTICE_DAYS) : today;

    // updated_at evita aprobar una versión distinta de la que se revisó.
    const { data: updated, error } = await (admin as any)
      .from("tournament_fichas")
      .update({
        status: data.approve ? "approved" : "rejected",
        effective_date: effective,
        rejection_reason: data.approve ? null : data.reason,
        reviewed_by: player.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .eq("updated_at", data.updated_at)
      .select("id");
    if (error) failDb(error);
    if (!updated?.length) throw new Error("Los datos cambiaron; recarga antes de revisarlos");

    await logAction(
      admin,
      player,
      data.approve ? "FICHA_APPROVED" : "FICHA_REJECTED",
      "store",
      ficha.store_id,
      ficha.stores?.name ?? "",
      { ficha_id: data.id, reason: data.reason ?? null, effective_date: effective },
    );
    if (effective && isChange) await notifyPlayersOfChange(admin, ficha.store_id, effective);

    const { data: organizers } = await admin
      .from("players")
      .select("id")
      .eq("role", "organizer")
      .eq("home_store_id", ficha.store_id);
    if (organizers?.length) {
      const { error: ne } = await admin.from("notifications").insert(
        organizers.map((o) => ({
          player_id: o.id,
          type: "ficha_review",
          title: data.approve ? "Datos de torneo aprobados" : "Datos de torneo rechazados",
          body: data.approve ? `Aplican a partir del ${effective}.` : `Motivo: ${data.reason}`,
          url: "/organizer/calendar",
        })),
      );
      if (ne) console.error("ficha notify:", ne.message);
    }
    return { effective_date: effective };
  });

/** Datos públicos de la temporada activa. Costo y premios solo si están aprobados. */
export const getStoreFichas = createServerFn({ method: "POST" })
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();
    const season = await getActiveSeason(admin);
    if (!season) return { season_name: null, items: [] };
    const { data: rows, error } = await (admin as any)
      .from("tournament_fichas")
      .select("*, games(name)")
      .eq("store_id", data.store_id)
      .eq("season_id", season.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false });
    if (error) failDb(error);

    const byGame = new Map<string, any[]>();
    for (const row of (rows ?? []) as any[]) {
      byGame.set(row.game_id, [...(byGame.get(row.game_id) ?? []), row]);
    }
    const today = todayInMexicoStr();
    const terms = (v: any) =>
      v && {
        entry_fee_mxn: v.entry_fee_mxn as number,
        prizes: v.prizes as Prize[],
        pool_percent: v.pool_percent as number | null,
        effective_date: v.effective_date as string,
      };
    const items = Array.from(byGame.values(), (versions) => {
      const { current, upcoming } = pickFichaVersions(versions, today);
      const source = current ?? upcoming ?? versions[0];
      return {
        game_id: source.game_id as string,
        game_name: source.games?.name ?? "—",
        current: terms(current),
        upcoming: terms(upcoming),
        format: source.format as string | null,
        capacity: source.capacity as number | null,
        registration_time: (source.registration_time?.slice(0, 5) ?? null) as string | null,
        notes: source.notes as string | null,
      };
    });
    return { season_name: season.name, items };
  });

export const countPendingFichas = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    if (gameIds.length === 0) return { count: 0 };
    const { count, error } = await (admin as any)
      .from("tournament_fichas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .in("game_id", gameIds);
    if (error) failDb(error);
    return { count: count ?? 0 };
  });

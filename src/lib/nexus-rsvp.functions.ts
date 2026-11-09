// Server functions para RSVP ("Voy a ir") en torneos futuros.
//
// SQL requerido en Nexus (correr una sola vez):
//
//   CREATE TABLE IF NOT EXISTS public.tournament_rsvps (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
//     player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
//     status text NOT NULL DEFAULT 'attending' CHECK (status IN ('attending','cancelled')),
//     created_at timestamptz NOT NULL DEFAULT now(),
//     updated_at timestamptz NOT NULL DEFAULT now(),
//     UNIQUE (tournament_id, player_id)
//   );
//   CREATE INDEX IF NOT EXISTS idx_rsvps_tournament ON public.tournament_rsvps(tournament_id) WHERE status = 'attending';
//   CREATE INDEX IF NOT EXISTS idx_rsvps_player ON public.tournament_rsvps(player_id) WHERE status = 'attending';
//   GRANT SELECT ON public.tournament_rsvps TO anon, authenticated;
//   GRANT ALL ON public.tournament_rsvps TO service_role;
//   ALTER TABLE public.tournament_rsvps ENABLE ROW LEVEL SECURITY;
//   -- (todas las escrituras van vía service role en server functions con auth)

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { requireNexusOrganizer, requireNexusUser } from "./nexus-auth.middleware";
import { assertManagerOwnsGame } from "./nexus-manager-shared";
import { RSVP_WINDOW_DAYS, slotRsvpState } from "./rsvp-rules";
import { nowInMexicoTimeStr, todayInMexicoStr } from "./utils";

const tournamentIdSchema = z.object({ tournament_id: z.string().uuid() });

// ---------- Público: contador de asistentes ----------
export const getTournamentRsvpCount = createServerFn({ method: "POST" })
  .inputValidator((d: { tournament_id: string }) => tournamentIdSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();
    const { count, error } = await (admin as any)
      .from("tournament_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", data.tournament_id)
      .eq("status", "attending");
    if (error) failDb(error);
    return { count: count ?? 0 };
  });

// ---------- Autenticado: estado del jugador actual ----------
export const getPlayerRsvpStatus = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { tournament_id: string }) => tournamentIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: row, error } = await (admin as any)
      .from("tournament_rsvps")
      .select("status")
      .eq("tournament_id", data.tournament_id)
      .eq("player_id", player.id)
      .maybeSingle();
    if (error) failDb(error);
    return { attending: (row as any)?.status === "attending" };
  });

// ---------- Autenticado: confirmar asistencia ----------
export const createRsvp = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { tournament_id: string }) => tournamentIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Validar torneo existente y futuro (por fecha, no por status)
    const { data: t, error: te } = await (admin as any)
      .from("tournaments")
      .select("id, status, tournament_date")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) failDb(te);
    if (!t) throw new Error("Torneo no encontrado");
    if (todayInMexicoStr() > String((t as any).tournament_date)) {
      throw new Error("Este torneo ya fue jugado");
    }

    const { data: row, error } = await (admin as any)
      .from("tournament_rsvps")
      .upsert(
        {
          tournament_id: data.tournament_id,
          player_id: player.id,
          status: "attending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tournament_id,player_id" },
      )
      .select("id, status")
      .single();
    if (error) failDb(error);
    return { ok: true, rsvp: row };
  });

// ---------- Autenticado: cancelar asistencia (soft delete) ----------
export const cancelRsvp = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { tournament_id: string }) => tournamentIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await (admin as any)
      .from("tournament_rsvps")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("tournament_id", data.tournament_id)
      .eq("player_id", player.id);
    if (error) failDb(error);
    return { ok: true };
  });

// ---------- Preferencia en horarios semanales ----------
// Un horario se identifica por tienda + juego + fecha (ver la migración).
const slotSchema = z.object({
  store_id: z.string().uuid(),
  game_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
type Slot = z.infer<typeof slotSchema>;

const slotRows = (admin: ReturnType<typeof getNexusAdmin>, slot: Slot) =>
  admin
    .from("schedule_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("store_id", slot.store_id)
    .eq("game_id", slot.game_id)
    .eq("occurrence_date", slot.date);

// Público: solo el total. Los nombres son para el staff.
export const getSlotRsvpCount = createServerFn({ method: "POST" })
  .inputValidator((d: Slot) => slotSchema.parse(d))
  .handler(async ({ data }) => {
    const { count, error } = await slotRows(getNexusAdmin(), data);
    if (error) failDb(error);
    return { count: count ?? 0 };
  });

export const getMySlotRsvps = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const { data, error } = await admin
      .from("schedule_rsvps")
      .select("store_id, game_id, occurrence_date")
      .eq("player_id", player.id)
      .gte("occurrence_date", todayInMexicoStr());
    if (error) failDb(error);
    return { slots: data ?? [] };
  });

export const createSlotRsvp = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: Slot) => slotSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: schedule, error: se } = await admin
      .from("store_schedules")
      .select("id, start_time")
      .eq("store_id", data.store_id)
      .eq("game_id", data.game_id)
      .eq("day_of_week", new Date(data.date + "T12:00:00").getDay())
      .maybeSingle();
    if (se) failDb(se);
    if (!schedule) throw new Error("Este horario ya no está disponible");

    const { data: override, error: oe } = await admin
      .from("store_schedule_overrides")
      .select("start_time")
      .eq("national_schedule_id", schedule.id)
      .eq("occurrence_date", data.date)
      .maybeSingle();
    if (oe) failDb(oe);

    const { data: cancelled, error: ce } = await (admin as any)
      .from("schedule_cancellations")
      .select("id")
      .eq("store_id", data.store_id)
      .eq("game_id", data.game_id)
      .is("league_id", null)
      .eq("occurrence_date", data.date)
      .maybeSingle();
    if (ce) failDb(ce);
    if (cancelled) throw new Error("Este torneo fue cancelado");

    const state = slotRsvpState({
      date: data.date,
      startTime: override?.start_time || schedule.start_time,
      today: todayInMexicoStr(),
      nowTime: nowInMexicoTimeStr(),
    });
    if (state === "started") throw new Error("Este torneo ya empezó");
    if (state === "early") {
      throw new Error(`Podrás marcar tu interés ${RSVP_WINDOW_DAYS} días antes del torneo`);
    }

    // ignoreDuplicates: repetir la petición no debe mover al jugador de lugar.
    const { error } = await admin.from("schedule_rsvps").upsert(
      {
        store_id: data.store_id,
        game_id: data.game_id,
        occurrence_date: data.date,
        player_id: player.id,
      },
      { onConflict: "store_id,game_id,occurrence_date,player_id", ignoreDuplicates: true },
    );
    if (error) failDb(error);
    return { ok: true };
  });

export const cancelSlotRsvp = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: Slot) => slotSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin
      .from("schedule_rsvps")
      .delete()
      .eq("store_id", data.store_id)
      .eq("game_id", data.game_id)
      .eq("occurrence_date", data.date)
      .eq("player_id", player.id);
    if (error) failDb(error);
    return { ok: true };
  });

// Staff: organizador de esa tienda, manager de ese TCG o admin. Incluye el ID de
// jugador para que puedan cruzar la lista con la app de Bandai.
export const getSlotRsvpList = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: Slot) => slotSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.role === "organizer") {
      if (player.home_store_id !== data.store_id) throw new Error("No autorizado");
    } else {
      await assertManagerOwnsGame(admin, player, data.game_id);
    }

    const { data: rows, error } = await admin
      .from("schedule_rsvps")
      .select("id, created_at, players!inner(geek_tag, player_tcg_ids(game_id, tcg_user_id))")
      .eq("store_id", data.store_id)
      .eq("game_id", data.game_id)
      .eq("occurrence_date", data.date)
      .order("created_at")
      .order("id");
    if (error) failDb(error);

    return {
      players: (rows ?? []).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        geek_tag: r.players.geek_tag,
        tcg_user_id:
          r.players.player_tcg_ids.find((t) => t.game_id === data.game_id)?.tcg_user_id ?? null,
      })),
    };
  });

// Horarios ya empezados donde el jugador pidió preferencia y aún no registra nada.
// Mis Partidas los ofrece para abrir Nueva Partida ya llena, con los datos exactos
// que el auto-enlace compara contra el torneo publicado.
const SLOT_LOG_WINDOW_DAYS = 7;

export const getMySlotsToLog = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const today = todayInMexicoStr();
    const since = new Date(`${today}T00:00:00Z`);
    since.setUTCDate(since.getUTCDate() - SLOT_LOG_WINDOW_DAYS);
    const from = since.toISOString().slice(0, 10);

    const { data: rsvps, error } = await admin
      .from("schedule_rsvps")
      .select("store_id, game_id, occurrence_date, stores!inner(name, city, zone)")
      .eq("player_id", player.id)
      .gte("occurrence_date", from)
      .lte("occurrence_date", today)
      .order("occurrence_date", { ascending: false });
    if (error) failDb(error);
    if (!rsvps?.length) return { slots: [] };

    const [schedules, sessions, results] = await Promise.all([
      admin
        .from("store_schedules")
        .select("id, store_id, game_id, day_of_week, start_time")
        .in("store_id", [...new Set(rsvps.map((r) => r.store_id))]),
      admin
        .from("standalone_sessions")
        .select("store_id, game_id, session_date")
        .eq("player_id", player.id)
        .eq("session_type", "competitive")
        .gte("session_date", from),
      admin
        .from("tournament_results")
        .select("tournaments!inner(store_id, game_id, tournament_date)")
        .eq("player_id", player.id)
        .gte("tournaments.tournament_date", from),
    ]);
    if (schedules.error) failDb(schedules.error);
    if (sessions.error) failDb(sessions.error);
    if (results.error) failDb(results.error);

    const { data: overrides, error: oe } = await admin
      .from("store_schedule_overrides")
      .select("national_schedule_id, occurrence_date, start_time")
      .in(
        "national_schedule_id",
        (schedules.data ?? []).map((s) => s.id),
      )
      .gte("occurrence_date", from);
    if (oe) failDb(oe);

    const key = (store: string | null, game: string, date: string | null) =>
      `${store}_${game}_${date}`;
    const { data: cancelled, error: ce } = await (admin as any)
      .from("schedule_cancellations")
      .select("store_id, game_id, occurrence_date")
      .is("league_id", null)
      .in("store_id", [...new Set(rsvps.map((r) => r.store_id))])
      .gte("occurrence_date", from);
    if (ce) failDb(ce);
    const logged = new Set([
      ...(cancelled ?? []).map((c: any) => key(c.store_id, c.game_id, c.occurrence_date)),
      ...(sessions.data ?? []).map((s) => key(s.store_id, s.game_id, s.session_date)),
      ...(results.data ?? []).map((r) =>
        key(r.tournaments.store_id, r.tournaments.game_id, r.tournaments.tournament_date),
      ),
    ]);
    const nowTime = nowInMexicoTimeStr();

    const slots = rsvps.flatMap((r) => {
      if (logged.has(key(r.store_id, r.game_id, r.occurrence_date))) return [];
      const schedule = schedules.data?.find(
        (s) =>
          s.store_id === r.store_id &&
          s.game_id === r.game_id &&
          s.day_of_week === new Date(r.occurrence_date + "T12:00:00").getDay(),
      );
      const override = overrides?.find(
        (o) => o.national_schedule_id === schedule?.id && o.occurrence_date === r.occurrence_date,
      );
      const startTime = override?.start_time || schedule?.start_time || null;
      const state = slotRsvpState({ date: r.occurrence_date, startTime, today, nowTime });
      if (state !== "started") return [];
      return [
        {
          store_id: r.store_id,
          game_id: r.game_id,
          date: r.occurrence_date,
          time: startTime?.slice(0, 5) ?? "",
          store_name: r.stores.name,
          store_city: r.stores.city,
          store_zone: r.stores.zone,
        },
      ];
    });
    return { slots };
  });

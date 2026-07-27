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
import { requireNexusUser } from "./nexus-auth.middleware";

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

    // Validar torneo existente y futuro
    const { data: t, error: te } = await (admin as any)
      .from("tournaments")
      .select("id, status, tournament_date")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) failDb(te);
    if (!t) throw new Error("Torneo no encontrado");
    if ((t as any).status === "PUBLISHED") {
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

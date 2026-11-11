import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusUser } from "./nexus-auth.middleware";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { TAG_RE, TAG_RULE_MESSAGE } from "./nexus-tag";

// ── Leer perfil actual del usuario ────────────────────────────────
export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const { data: profile } = await admin
      .from("players")
      .select("id, geek_tag, display_name, email, role, is_profile_public, preferred_zone, home_store_id")
      .eq("id", player.id)
      .maybeSingle();

    const { data: tcgIds } = await admin
      .from("player_tcg_ids")
      .select("id, game_id, tcg_user_id, created_at, games(name)")
      .eq("player_id", player.id)
      .order("created_at", { ascending: true });

    const { data: allGames } = await admin
      .from("games")
      .select("id, name")
      .eq("is_active", true)
      // Temporada 1: solo One Piece.
      .eq("slug", "one-piece")
      .order("name");

    const { data: stores } = await admin
      .from("stores")
      .select("id, name, city, zone")
      .eq("is_active", true)
      .order("name");
    const zones = Array.from(new Set((stores ?? []).map((s) => s.zone).filter(Boolean))).sort();

    return {
      profile: profile ?? null,
      tcg_ids: (tcgIds ?? []).map((t: any) => ({
        id: t.id,
        game_id: t.game_id,
        game_name: t.games?.name ?? "—",
        tcg_user_id: t.tcg_user_id,
        created_at: t.created_at,
      })),
      all_games: allGames ?? [],
      zones: zones as string[],
      stores: (stores ?? []).map((s) => ({ id: s.id, name: s.name, city: s.city })),
    };
  });

// ── Actualizar Nexus Tag y nombre completo ─────────────────────────
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { geek_tag?: string; display_name?: string }) =>
    z
      .object({
        geek_tag: z.string().regex(TAG_RE, TAG_RULE_MESSAGE).optional(),
        display_name: z.string().min(1).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    if (data.geek_tag) {
      const { data: existing } = await admin
        .from("players")
        .select("id")
        .eq("geek_tag", data.geek_tag)
        .neq("id", player.id)
        .maybeSingle();
      if (existing) throw new Error("Este Nexus Tag ya está en uso por otro jugador");
    }

    const { error } = await admin
      .from("players")
      .update({
        ...(data.geek_tag && { geek_tag: data.geek_tag }),
        ...(data.display_name !== undefined && { display_name: data.display_name }),
      })
      .eq("id", player.id);
    if (error) failDb(error);
    return { ok: true };
  });

// ── Tienda principal ───────────────────────────────────────────────
export const setMyHomeStore = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { store_id: string | null }) =>
    z.object({ store_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    // En un organizador esta columna define a qué tienda tiene acceso: nunca por sí mismo.
    if (player.role !== "player") throw new Error("No autorizado");
    if (data.store_id) {
      const { data: store, error } = await admin
        .from("stores")
        .select("id")
        .eq("id", data.store_id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) failDb(error);
      if (!store) throw new Error("Esa tienda no está disponible.");
    }
    const { error } = await admin
      .from("players")
      .update({ home_store_id: data.store_id })
      .eq("id", player.id);
    if (error) failDb(error);
    return { ok: true };
  });

// ── Agregar nuevo TCG ID (solo INSERT, nunca UPDATE) ──────────────
export const addMyTcgId = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { game_id: string; tcg_user_id: string }) =>
    z
      .object({
        game_id: z.string().uuid(),
        tcg_user_id: z.string().min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: existing } = await admin
      .from("player_tcg_ids")
      .select("id")
      .eq("player_id", player.id)
      .eq("game_id", data.game_id)
      .maybeSingle();
    if (existing)
      throw new Error(
        "Ya tienes un ID registrado para este TCG. No se puede modificar una vez dado de alta.",
      );

    // Guarda el ID y, si lo tenía un placeholder, le pasa sus torneos (atómico).
    const { error } = await admin.rpc("assign_tcg_id" as any, {
      p_player_id: player.id,
      p_game_id: data.game_id,
      p_tcg_user_id: data.tcg_user_id,
    });
    if (error?.message === "TCG_ID_TAKEN")
      throw new Error("Ese ID ya está registrado en otra cuenta.");
    if (error) failDb(error);
    return { ok: true };
  });

// ── Cambiar email (Supabase Auth) ─────────────────────────────────
export const updateMyEmail = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { new_email: string }) =>
    z.object({ new_email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin.auth.updateUser({ email: data.new_email });
    if (error) failDb(error);
    return { ok: true, message: "Te enviamos un correo de confirmación a tu nuevo email." };
  });

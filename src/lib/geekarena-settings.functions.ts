import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireGeekarenaUser } from "./geekarena-auth.middleware";
import { getGeekarenaAdmin, failDb } from "./geekarena-admin.server";

// ── Leer perfil actual del usuario ────────────────────────────────
export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const { data: profile } = await admin
      .from("players")
      .select("id, geek_tag, display_name, email, role")
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
      .order("name");

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
    };
  });

// ── Actualizar Geek Tag y nombre completo ─────────────────────────
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { geek_tag?: string; display_name?: string }) =>
    z
      .object({
        geek_tag: z
          .string()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9_|. ]+$/, "Solo letras, números, _, |, . y espacios")
          .optional(),
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
      if (existing) throw new Error("Este Geek Tag ya está en uso por otro jugador");
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

// ── Agregar nuevo TCG ID (solo INSERT, nunca UPDATE) ──────────────
export const addMyTcgId = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
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

    const normalized = data.tcg_user_id.replace(/^0+/, "") || data.tcg_user_id;
    const { error } = await admin.from("player_tcg_ids").insert({
      player_id: player.id,
      game_id: data.game_id,
      tcg_user_id: data.tcg_user_id,
      tcg_user_id_normalized: normalized,
    });
    if (error) failDb(error);
    return { ok: true };
  });

// ── Cambiar email (Supabase Auth) ─────────────────────────────────
export const updateMyEmail = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { new_email: string }) =>
    z.object({ new_email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin.auth.updateUser({ email: data.new_email });
    if (error) failDb(error);
    return { ok: true, message: "Te enviamos un correo de confirmación a tu nuevo email." };
  });

// ── Cambiar contraseña (Supabase Auth) ────────────────────────────
export const updateMyPassword = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { new_password: string }) =>
    z.object({ new_password: z.string().min(8, "Mínimo 8 caracteres") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin.auth.updateUser({ password: data.new_password });
    if (error) failDb(error);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

export const signupPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: {
    email: string;
    password: string;
    geek_tag: string;
    game_ids: string[];
  }) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        geek_tag: z.string().min(3).max(30).regex(/^[A-Za-z0-9_]+$/),
        game_ids: z.array(z.string().uuid()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getGeekarenaAdmin();

    // 1. Crear usuario de auth
    const { data: authUser, error: authErr } =
      await admin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: false,
        user_metadata: {
          geek_tag: data.geek_tag,
          game_ids: data.game_ids,
        },
      });
    if (authErr || !authUser?.user) {
      throw new Error(authErr?.message ?? "No se pudo crear el usuario");
    }
    const newAuthUserId = authUser.user.id;

    // 2. Buscar player existente: puede haber sido creado por trigger
    //    (handle_new_auth_user) usando auth_user_id, o auto-creado desde CSV
    //    con el mismo geek_tag y sin auth_user_id.
    const { data: byAuth } = await admin
      .from("players")
      .select("id")
      .eq("auth_user_id", newAuthUserId)
      .maybeSingle();

    const { data: byTag } = byAuth
      ? { data: null as { id: string } | null }
      : await admin
          .from("players")
          .select("id")
          .eq("geek_tag", data.geek_tag)
          .is("auth_user_id", null)
          .maybeSingle();

    const existing = byAuth ?? byTag;

    let playerId: string;

    if (existing) {
      // Reclamar / completar el registro existente
      const { error: updateErr } = await admin
        .from("players")
        .update({
          geek_tag: data.geek_tag,
          auth_user_id: newAuthUserId,
          email: data.email,
          is_active: false,
        })
        .eq("id", existing.id);
      if (updateErr) throw new Error(updateErr.message);
      playerId = existing.id;
    } else {
      // Crear player nuevo
      const { data: created, error: insertErr } = await admin
        .from("players")
        .insert({
          geek_tag: data.geek_tag,
          email: data.email,
          auth_user_id: newAuthUserId,
          is_active: false,
          role: "player",
        })
        .select("id")
        .single();
      if (insertErr) throw new Error(insertErr.message);
      playerId = created.id;
    }


    // 3. Insertar juegos seleccionados en player_games
    if (data.game_ids.length > 0) {
      const { error: pgErr } = await admin.from("player_games").insert(
        data.game_ids.map((game_id) => ({
          player_id: playerId,
          game_id,
        })),
      );
      // Ignorar duplicados silenciosamente
      if (pgErr && !/duplicate/i.test(pgErr.message)) {
        throw new Error(pgErr.message);
      }
    }

    return { ok: true as const, email: data.email };
  });

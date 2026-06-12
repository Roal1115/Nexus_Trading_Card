import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

export const signupPlayer = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      email: string;
      password: string;
      geek_tag: string;
      game_ids: string[];
      tcg_ids: Record<string, string>;
      gender: "hombre" | "mujer" | "no_especificado";
      birth_date: string;
    }) =>
      z
        .object({
          email: z.string().email(),
          password: z.string().min(8),
          geek_tag: z
            .string()
            .min(3)
            .max(30)
            .regex(/^[A-Za-z0-9_]+$/),
          game_ids: z.array(z.string().uuid()).min(1),
          tcg_ids: z.record(z.string().uuid(), z.string().min(1).max(120)),
          gender: z.enum(["hombre", "mujer", "no_especificado"]),
          birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getGeekarenaAdmin();

    // Validar que cada juego seleccionado tenga su ID
    for (const gameId of data.game_ids) {
      if (!data.tcg_ids[gameId] || data.tcg_ids[gameId].trim().length === 0) {
        throw new Error("Falta el ID de jugador para uno de los juegos seleccionados");
      }
    }

    // 1. Crear usuario de auth
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
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

    // 2. Buscar player existente
    const { data: byAuth } = await admin.from("players").select("id").eq("auth_user_id", newAuthUserId).maybeSingle();

    const { data: byTag } = byAuth
      ? { data: null as { id: string } | null }
      : await admin.from("players").select("id").eq("geek_tag", data.geek_tag).is("auth_user_id", null).maybeSingle();

    const existing = byAuth ?? byTag;

    let playerId: string;

    if (existing) {
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

    // 3. Guardar datos demográficos
    const { error: demoErr } = await admin
      .from("players")
      .update({
        gender: data.gender,
        birth_date: data.birth_date,
      })
      .eq("id", playerId);
    if (demoErr) throw new Error(demoErr.message);

    // 4. Insertar juegos seleccionados en player_games
    if (data.game_ids.length > 0) {
      const { error: pgErr } = await admin.from("player_games").insert(
        data.game_ids.map((game_id) => ({
          player_id: playerId,
          game_id,
        })),
      );
      if (pgErr && !/duplicate/i.test(pgErr.message)) {
        throw new Error(pgErr.message);
      }
    }

    // 5. Guardar IDs de TCG (upsert por player_id+game_id)
    const tcgEntries = Object.entries(data.tcg_ids).filter(
      ([gameId, val]) => data.game_ids.includes(gameId) && val.trim().length > 0,
    );
    if (tcgEntries.length > 0) {
      const tcgRows = tcgEntries.map(([game_id, tcg_user_id]) => ({
        player_id: playerId,
        game_id,
        tcg_user_id: tcg_user_id.trim(),
      }));
      const { error: tcgErr } = await admin.from("player_tcg_ids").upsert(tcgRows, { onConflict: "player_id,game_id" });
      if (tcgErr) throw new Error(tcgErr.message);
    }

    return { ok: true as const, email: data.email };
  });

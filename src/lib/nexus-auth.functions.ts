import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { normalizeTcgId } from "./utils";

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
    const admin = getNexusAdmin();

    // Validar que cada juego seleccionado tenga su ID
    for (const gameId of data.game_ids) {
      if (!data.tcg_ids[gameId] || data.tcg_ids[gameId].trim().length === 0) {
        throw new Error("Falta el ID de jugador para uno de los juegos seleccionados");
      }
    }

    // Identidad = TCG ID. Validar antes de crear el usuario de auth:
    // - un ID que ya tiene otra cuenta real no se puede registrar;
    // - el placeholder con este geek_tag solo se adopta si sus IDs son los mismos.
    const wanted = new Map(data.game_ids.map((g) => [g, normalizeTcgId(data.tcg_ids[g])]));
    for (const [gameId, norm] of wanted) {
      const { data: holder, error } = await admin
        .from("player_tcg_ids")
        .select("players!inner(auth_user_id)")
        .eq("game_id", gameId)
        .eq("tcg_user_id_normalized", norm)
        .maybeSingle();
      if (error) failDb(error);
      if ((holder?.players as { auth_user_id: string | null } | undefined)?.auth_user_id) {
        throw new Error("Uno de tus IDs de jugador ya está registrado en otra cuenta.");
      }
    }
    const { data: tagOwner, error: tagErr } = await admin
      .from("players")
      .select("auth_user_id, player_tcg_ids(game_id, tcg_user_id_normalized)")
      .eq("geek_tag", data.geek_tag)
      .maybeSingle();
    if (tagErr) failDb(tagErr);
    if (
      tagOwner &&
      (tagOwner.auth_user_id ||
        tagOwner.player_tcg_ids.some((t) => wanted.get(t.game_id) !== t.tcg_user_id_normalized))
    ) {
      throw new Error("Ese Geek Tag ya está en uso.");
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
      const { error: updateErr } = await admin
        .from("players")
        .update({
          geek_tag: data.geek_tag,
          auth_user_id: newAuthUserId,
          email: data.email,
          is_active: false,
        })
        .eq("id", existing.id);
      if (updateErr) failDb(updateErr);
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
      if (insertErr) failDb(insertErr);
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
    if (demoErr) failDb(demoErr);

    // 4. Insertar juegos seleccionados en player_games
    if (data.game_ids.length > 0) {
      const { error: pgErr } = await admin.from("player_games").insert(
        data.game_ids.map((game_id) => ({
          player_id: playerId,
          game_id,
        })),
      );
      if (pgErr && !/duplicate/i.test(pgErr.message)) {
        failDb(pgErr);
      }
    }

    // 5. Guardar IDs de TCG (upsert por player_id+game_id)
    const tcgEntries = Object.entries(data.tcg_ids).filter(
      ([gameId, val]) => data.game_ids.includes(gameId) && val.trim().length > 0,
    );
    // Guarda cada ID y enlaza torneos subidos antes bajo otro nombre (placeholder con el mismo ID).
    for (const [game_id, tcg_user_id] of tcgEntries) {
      const { error: tcgErr } = await admin.rpc("assign_tcg_id" as any, {
        p_player_id: playerId,
        p_game_id: game_id,
        p_tcg_user_id: tcg_user_id,
      });
      if (tcgErr?.message === "TCG_ID_TAKEN") {
        throw new Error("Uno de tus IDs de jugador ya está registrado en otra cuenta.");
      }
      if (tcgErr) failDb(tcgErr);
    }

    return { ok: true as const, email: data.email };
  });

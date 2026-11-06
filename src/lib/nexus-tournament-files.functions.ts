import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb } from "./nexus-admin.server";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { assertManagerOwnsGame } from "./nexus-manager-shared";
import { tournamentFilePath, tournamentIdOfFile } from "./tournament-file";

// Traen Bandai IDs y nombres: el enlace dura lo justo para abrirlo y solo lo pide el staff
// de ese torneo. Nunca se guarda un enlace que siga sirviendo después.
const LINK_SECONDS = 300;

export const getTournamentFileUrl = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { file: string }) => z.object({ file: z.string().max(2048) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const path = tournamentFilePath(data.file);
    const tournamentId = path && tournamentIdOfFile(path);
    if (!path || !tournamentId) throw new Error("Archivo no encontrado");

    const { data: tournament, error } = await admin
      .from("tournaments")
      .select("store_id, game_id, csv_url")
      .eq("id", tournamentId)
      .maybeSingle();
    if (error) failDb(error);
    if (!tournament || tournamentFilePath(tournament.csv_url) !== path) {
      throw new Error("Archivo no encontrado");
    }

    if (player.role === "organizer" && tournament.store_id !== player.home_store_id) {
      throw new Error("No autorizado");
    }
    if (player.role === "tcg_manager") {
      await assertManagerOwnsGame(admin, player, tournament.game_id);
    }

    const { data: signed, error: signError } = await admin.storage
      .from("tournament-files")
      .createSignedUrl(path, LINK_SECONDS);
    if (signError || !signed) throw new Error("No se pudo abrir el archivo");
    return { url: signed.signedUrl };
  });

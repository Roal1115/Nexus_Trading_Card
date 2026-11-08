import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb } from "./nexus-admin.server";
import { logAction } from "./nexus-admin-shared";
import { requireNexusManager } from "./nexus-auth.middleware";

const nameSchema = z.string().trim().min(2).max(60);

export const listZones = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { data, error } = await context.admin
      .from("zones")
      .select("name, description, subzones(name, description)")
      .order("name");
    if (error) failDb(error);
    return {
      zones: (data ?? []).map((z) => ({
        ...z,
        subzones: [...z.subzones].sort((a, b) => a.name.localeCompare(b.name)),
      })),
    };
  });

/** Sin `original` crea la zona. Renombrar se propaga a tiendas y solicitudes por llave foránea. */
export const saveZone = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { original?: string; name: string; description: string }) =>
    z
      .object({
        original: nameSchema.optional(),
        name: nameSchema,
        description: z.string().trim().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { original, name, description } = data;
    const { error } = original
      ? await admin.from("zones").update({ name, description }).eq("name", original)
      : await admin.from("zones").insert({ name, description });
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe una zona con ese nombre.");
      failDb(error);
    }
    if (original && original !== name) {
      // Preferencia del jugador: es texto libre, sin llave foránea que la actualice.
      const { error: prefError } = await admin
        .from("players")
        .update({ preferred_zone: name })
        .eq("preferred_zone", original);
      if (prefError) failDb(prefError);
    }
    await logAction(admin, player, original ? "ZONE_UPDATED" : "ZONE_CREATED", "zone", null, name, {
      original: original ?? null,
    });
    return { ok: true };
  });

export const deleteZone = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { name: string }) => z.object({ name: nameSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin.from("zones").delete().eq("name", data.name);
    if (error) {
      if (error.code === "23503") {
        throw new Error("Esta zona tiene tiendas. Muévelas a otra zona antes de borrarla.");
      }
      failDb(error);
    }
    await logAction(admin, player, "ZONE_DELETED", "zone", null, data.name);
    return { ok: true };
  });

/** Sin `original` crea la subzona. Renombrar se propaga a las tiendas por llave foránea. */
export const saveSubzone = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { zone: string; original?: string; name: string; description: string }) =>
    z
      .object({
        zone: nameSchema,
        original: nameSchema.optional(),
        name: nameSchema,
        description: z.string().trim().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { zone, original, name, description } = data;
    const { error } = original
      ? await admin
          .from("subzones")
          .update({ name, description })
          .eq("zone", zone)
          .eq("name", original)
      : await admin.from("subzones").insert({ zone, name, description });
    if (error) {
      if (error.code === "23505") throw new Error("Esa zona ya tiene una subzona con ese nombre.");
      failDb(error);
    }
    await logAction(
      admin,
      player,
      original ? "SUBZONE_UPDATED" : "SUBZONE_CREATED",
      "subzone",
      null,
      `${zone} · ${name}`,
      { original: original ?? null },
    );
    return { ok: true };
  });

export const deleteSubzone = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { zone: string; name: string }) =>
    z.object({ zone: nameSchema, name: nameSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin
      .from("subzones")
      .delete()
      .eq("zone", data.zone)
      .eq("name", data.name);
    if (error) {
      if (error.code === "23503") {
        throw new Error("Esta subzona tiene tiendas. Muévelas antes de borrarla.");
      }
      failDb(error);
    }
    await logAction(
      admin,
      player,
      "SUBZONE_DELETED",
      "subzone",
      null,
      `${data.zone} · ${data.name}`,
    );
    return { ok: true };
  });

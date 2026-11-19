import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { assertManagerOwnsStore } from "./nexus-manager-shared";
import { getNexusAdmin, failDb } from "./nexus-admin.server";

const storeIdSchema = z.object({ store_id: z.string().uuid() });

// Lectura pública (página de tienda): sin middleware, como nexus-public.functions.
export const getTcgCatalog = createServerFn({ method: "POST" }).handler(async () => {
  const { data, error } = await getNexusAdmin()
    .from("tcg_catalog")
    .select("id, name")
    .order("sort_order")
    .order("name");
  if (error) failDb(error);
  return (data ?? []) as { id: string; name: string }[];
});

export const getStoreTcgs = createServerFn({ method: "POST" })
  .inputValidator((d: { store_id: string }) => storeIdSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await getNexusAdmin()
      .from("store_tcgs")
      .select("tcg_id")
      .eq("store_id", data.store_id);
    if (error) failDb(error);
    return { tcg_ids: (rows ?? []).map((r) => r.tcg_id) };
  });

export const setStoreTcgs = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id?: string; tcg_ids: string[] }) =>
    z
      .object({
        store_id: z.string().uuid().optional(),
        tcg_ids: z.array(z.string().uuid()).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    // Organizador: siempre su tienda; admin y Manager deben indicarla.
    const store_id = player.role === "organizer" ? player.home_store_id : data.store_id;
    if (!store_id) throw new Error("Falta la tienda");
    if (player.role === "tcg_manager") await assertManagerOwnsStore(admin, player, store_id);
    const tcg_ids = [...new Set(data.tcg_ids)];

    if (tcg_ids.length) {
      const { data: found, error } = await admin.from("tcg_catalog").select("id").in("id", tcg_ids);
      if (error) failDb(error);
      if ((found ?? []).length !== tcg_ids.length) throw new Error("Juego fuera del catálogo");
    }

    // ponytail: non-atomic replace; move to an RPC if partial writes appear
    const { error: de } = await admin.from("store_tcgs").delete().eq("store_id", store_id);
    if (de) failDb(de);
    if (tcg_ids.length) {
      const { error: ie } = await admin
        .from("store_tcgs")
        .insert(tcg_ids.map((tcg_id) => ({ store_id, tcg_id })));
      if (ie) failDb(ie);
    }
    return { ok: true as const };
  });

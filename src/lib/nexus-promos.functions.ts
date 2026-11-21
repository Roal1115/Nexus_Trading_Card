import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb } from "./nexus-admin.server";
import { logAction } from "./nexus-admin-core";
import { requireNexusManager, requireNexusOrganizer } from "./nexus-auth.middleware";

// Promo de tienda: la crea el organizer de la tienda y la aprueban Admin o Manager antes de
// mostrarse en /stores/$slug (ver getStorePromo en nexus-public.functions).

const PROMO_BUCKET = "promo-assets";
const STORE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// {store_id}/{archivo}.webp|png|jpg|jpeg — la carpeta es la tienda, ver policy promo_assets_write_insert.
const IMAGE_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,100}\.(webp|png|jpe?g)$/i;

export const getMyStorePromos = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    if (!player.home_store_id) return { promos: [] };
    const { data, error } = await admin
      .from("store_promos")
      .select("id, title, image_url, link_url, status, rejection_reason, is_active, created_at")
      .eq("store_id", player.home_store_id)
      .order("created_at", { ascending: false });
    if (error) failDb(error);
    return { promos: data ?? [] };
  });

export const submitStorePromo = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { title: string; image_path: string; link_url?: string }) =>
    z
      .object({
        title: z.string().trim().min(2).max(120),
        image_path: z.string().regex(IMAGE_PATH),
        link_url: z
          .string()
          .trim()
          .url()
          .max(500)
          .refine((u) => u.startsWith("https://"), "El link debe empezar con https://")
          .optional()
          .or(z.literal("").transform(() => undefined)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const storeId = player.home_store_id;
    if (!storeId || !STORE_ID.test(storeId)) throw new Error("No tienes una tienda asignada");
    // La imagen debe estar en la carpeta de su tienda: el URL público lo construimos aquí.
    if (data.image_path.split("/")[0] !== storeId) throw new Error("Imagen no válida");

    const { count, error: countError } = await admin
      .from("store_promos")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "pending");
    if (countError) failDb(countError);
    if ((count ?? 0) > 0) throw new Error("Ya tienes una promo en revisión");

    const { data: pub } = admin.storage.from(PROMO_BUCKET).getPublicUrl(data.image_path);
    const { error } = await admin.from("store_promos").insert({
      store_id: storeId,
      title: data.title,
      image_url: pub.publicUrl,
      link_url: data.link_url ?? null,
    });
    if (error) failDb(error);
    return { success: true };
  });

// Aprobada = se retira (is_active=false) para conservar sus métricas; pendiente o rechazada = se borra.
// ponytail: no borra el archivo del bucket; limpiar huérfanos si el espacio importa.
export const removeStorePromo = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (!player.home_store_id) throw new Error("No tienes una tienda asignada");
    const { data: promo, error } = await admin
      .from("store_promos")
      .select("id, status")
      .eq("id", data.id)
      .eq("store_id", player.home_store_id)
      .maybeSingle();
    if (error) failDb(error);
    if (!promo) throw new Error("Promo no encontrada");

    const { error: writeError } =
      promo.status === "approved"
        ? await admin.from("store_promos").update({ is_active: false }).eq("id", promo.id)
        : await admin.from("store_promos").delete().eq("id", promo.id);
    if (writeError) failDb(writeError);
    return { success: true };
  });

// Cola de revisión (Admin y Manager): pendientes primero.
export const listPromosForReview = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { data, error } = await context.admin
      .from("store_promos")
      .select(
        "id, title, image_url, link_url, status, rejection_reason, is_active, created_at, stores(name)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) failDb(error);
    const promos = (data ?? []).map((p) => {
      const store = Array.isArray(p.stores) ? p.stores[0] : p.stores;
      const { stores: _stores, ...rest } = p;
      return { ...rest, store_name: store?.name ?? "—" };
    });
    // pending primero; el resto conserva el orden por fecha
    promos.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
    return { promos };
  });

export const reviewStorePromo = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { id: string; decision: "approve" | "reject"; reason?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(300).optional(),
      })
      .refine((v) => v.decision === "approve" || (v.reason?.length ?? 0) >= 3, {
        message: "Indica el motivo del rechazo",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const approved = data.decision === "approve";
    const { data: promo, error } = await admin
      .from("store_promos")
      .update({
        status: approved ? "approved" : "rejected",
        reviewed_at: new Date().toISOString(),
        rejection_reason: approved ? null : (data.reason ?? null),
      })
      .eq("id", data.id)
      .select("title, stores(name)")
      .maybeSingle();
    if (error) failDb(error);
    if (!promo) throw new Error("Promo no encontrada");

    const store = Array.isArray(promo.stores) ? promo.stores[0] : promo.stores;
    await logAction(
      admin,
      player,
      approved ? "PROMO_APPROVED" : "PROMO_REJECTED",
      "store_promo",
      data.id,
      `${promo.title} — ${store?.name ?? "tienda"}`,
      approved ? null : { reason: data.reason ?? null },
    );
    return { success: true };
  });

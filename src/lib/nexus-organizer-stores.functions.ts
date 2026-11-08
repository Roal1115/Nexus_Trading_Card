import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { failDb } from "./nexus-admin.server";
import { todayInMexicoStr, mondayOfWeek, toLocalDateStr } from "./utils";
import type { TablesInsert } from "./database.types";
import type { TournamentStatus } from "./nexus-admin-shared";
import { httpUrlSchema, logAction } from "./nexus-admin-shared";

const STORE_FIELD_LABELS = {
  name: "Nombre",
  city: "Ciudad",
  state: "Estado",
  address: "Dirección",
  phone: "Teléfono",
  google_maps_url: "Google Maps",
  description: "Descripción",
  opening_hours: "Horario",
  instagram: "Instagram",
  website: "Página web",
  twitter: "X / Twitter",
  twitch: "Twitch",
} as const;

export const getOrganizerOverview = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const [storesRes, gamesRes, homeStoreRes] = await Promise.all([
      admin
        .from("stores")
        .select("id, slug, name, city, state, country, is_active")
        .eq("is_active", true)
        .order("city", { ascending: true })
        .order("name", { ascending: true }),
      admin
        .from("games")
        .select("id, slug, name, publisher, logo_url, is_active")
        .eq("is_active", true)
        .order("name"),
      player.home_store_id
        ? admin
            .from("stores")
            .select(
              "id, slug, name, city, state, country, is_active, address, phone, google_maps_url, description, opening_hours, instagram, website, twitter, twitch",
            )
            .eq("id", player.home_store_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    if (storesRes.error) failDb(storesRes.error);
    if (gamesRes.error) failDb(gamesRes.error);
    if (homeStoreRes.error) failDb(homeStoreRes.error);

    return {
      player,
      stores: storesRes.data ?? [],
      games: gamesRes.data ?? [],
      homeStore: homeStoreRes.data ?? null,
    };
  });

// El rol organizer solo lo asigna un admin (upsertStaffMember +
// assignOrganizerToStore en nexus-admin-*.functions.ts). No hay registro
// público de organizers: un store_id es público y no sirve como credencial.

export const updateHomeStore = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.role !== "admin") {
      throw new Error(
        "Tu tienda es asignada por el administrador. Contacta a soporte para cambios.",
      );
    }
    const { error } = await admin
      .from("players")
      .update({ home_store_id: data.store_id })
      .eq("id", player.id);
    if (error) failDb(error);
    return { ok: true };
  });

export const updateStoreInfo = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: {
      store_id: string;
      name: string;
      city?: string;
      state?: string;
      address?: string;
      phone?: string;
      google_maps_url?: string;
      description?: string;
      opening_hours?: string;
      instagram?: string;
      website?: string;
      twitter?: string;
      twitch?: string;
    }) =>
      z
        .object({
          store_id: z.string().uuid(),
          name: z.string().min(1).max(120),
          city: z.string().max(120).optional(),
          state: z.string().max(120).optional(),
          address: z.string().max(300).optional(),
          phone: z.string().max(20).optional(),
          google_maps_url: httpUrlSchema,
          description: z.string().max(500).optional(),
          opening_hours: z.string().max(200).optional(),
          instagram: z.string().max(100).optional(),
          website: httpUrlSchema,
          twitter: z.string().max(100).optional(),
          twitch: z.string().max(100).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.home_store_id !== data.store_id && player.role !== "admin") {
      throw new Error("Solo puedes editar tu tienda asignada");
    }
    const { store_id, ...fields } = data;
    const { data: before, error: readError } = await admin
      .from("stores")
      .select(`slug, ${Object.keys(STORE_FIELD_LABELS).join(", ")}`)
      .eq("id", store_id)
      .single();
    if (readError) failDb(readError);
    const previous = before as unknown as Record<string, string | null> | null;
    const changed = (Object.keys(STORE_FIELD_LABELS) as (keyof typeof STORE_FIELD_LABELS)[]).filter(
      (key) => (fields[key] ?? "") !== (previous?.[key] ?? ""),
    );

    const { error } = await admin
      .from("stores")
      .update({
        name: fields.name,
        city: fields.city || null,
        state: fields.state || null,
        address: fields.address || null,
        phone: fields.phone || null,
        google_maps_url: fields.google_maps_url || null,
        description: fields.description || null,
        opening_hours: fields.opening_hours || null,
        instagram: fields.instagram || null,
        website: fields.website || null,
        twitter: fields.twitter || null,
        twitch: fields.twitch || null,
      })
      .eq("id", store_id);
    if (error) failDb(error);

    // Solo el dueño avisa: lo que edita Admin o Manager ya lo hizo el staff.
    if (player.role === "organizer" && changed.length > 0) {
      const labels = changed.map((key) => STORE_FIELD_LABELS[key]);
      await logAction(admin, player, "STORE_UPDATED_BY_OWNER", "store", store_id, fields.name, {
        fields: labels,
      });
      // ponytail: avisa a todo Manager; filtrar por TCG cuando haya más de un juego activo.
      const { data: staff, error: staffError } = await admin
        .from("players")
        .select("id")
        .in("role", ["admin", "tcg_manager"]);
      // Un aviso fallido no debe deshacer un guardado que ya ocurrió.
      if (staffError) console.error("store change notify:", staffError.message);
      else if (staff?.length) {
        const { error: notifyError } = await admin.from("notifications").insert(
          staff.map((s) => ({
            player_id: s.id,
            type: "store_changed",
            title: `${fields.name} actualizó sus datos`,
            body: `Cambió: ${labels.join(", ")}.`,
            url: `/stores/${previous?.slug}`,
          })),
        );
        if (notifyError) console.error("store change notify:", notifyError.message);
      }
    }
    return { ok: true };
  });

// ---------- Mis Torneos ----------

export const listActiveStores = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .handler(async ({ context }) => {
    const { admin } = context;
    const { data, error } = await admin
      .from("stores")
      .select("id, name, city")
      .eq("is_active", true)
      .order("city", { ascending: true })
      .order("name", { ascending: true });
    if (error) failDb(error);
    return { stores: data ?? [] };
  });

// ---------- Check existing player tags (for preview) ----------
export const lookupPlayerTags = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { tags: string[] }) =>
    z.object({ tags: z.array(z.string().min(1).max(120)).min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: rows, error } = await admin
      .from("players")
      .select("geek_tag")
      .in("geek_tag", data.tags);
    if (error) failDb(error);
    return { existing: (rows ?? []).map((r) => r.geek_tag) };
  });

// ---------- Badge counts ----------
export const getOrganizerBadgeCounts = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    if (!player.home_store_id) return { pending: 0, approved: 0, appeals: 0 };

    const [pending, approved, appealsRes] = await Promise.all([
      admin
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .eq("store_id", player.home_store_id as string)
        .eq("status", "DRAFT"),
      admin
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .eq("store_id", player.home_store_id as string)
        .eq("status", "APPROVED"),
      admin
        .from("round_appeals")
        .select("*", { count: "exact", head: true })
        .eq("store_id", player.home_store_id as string)
        .eq("status", "pending"),
    ]);

    return {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      appeals: appealsRes.count ?? 0,
    };
  });

// ---------- Organizer read-only calendar (scoped to home_store) ----------

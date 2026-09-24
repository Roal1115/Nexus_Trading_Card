import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { todayInMexicoStr, mondayOfWeek, toLocalDateStr } from "./utils";
import type { TablesInsert } from "./database.types";
import type { TournamentStatus } from "./nexus-admin-shared";
import { httpUrlSchema } from "./nexus-admin-shared";

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

// Signup de organizador de tienda vía link privado (compartido directamente
// con la tienda, no enlazado en ninguna navegación pública). El store_id
// funciona como token: si no coincide con una tienda activa, se rechaza.
export const signupStoreOrganizer = createServerFn({ method: "POST" })
  .inputValidator((d: { store_id: string; email: string; password: string; geek_tag: string }) =>
    z
      .object({
        store_id: z.string().uuid(),
        email: z.string().email(),
        password: z.string().min(8),
        geek_tag: z
          .string()
          .min(3)
          .max(30)
          .regex(/^[A-Za-z0-9_]+$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();

    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select("id, name, is_active")
      .eq("id", data.store_id)
      .maybeSingle();
    if (storeErr) failDb(storeErr);
    if (!store || !store.is_active) {
      throw new Error("Este link de registro no es válido o la tienda ya no está activa.");
    }

    const { data: existing } = await admin
      .from("players")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing) {
      throw new Error("Ya existe una cuenta con ese correo. Inicia sesión en su lugar.");
    }

    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { geek_tag: data.geek_tag },
    });
    if (authErr || !authUser?.user) {
      throw new Error(authErr?.message ?? "No se pudo crear el usuario");
    }

    const { error: insertErr } = await admin.from("players").insert({
      geek_tag: data.geek_tag,
      email: data.email,
      auth_user_id: authUser.user.id,
      role: "organizer",
      home_store_id: data.store_id,
      is_active: true,
    });
    if (insertErr) failDb(insertErr);

    return { ok: true as const, store_name: store.name };
  });

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

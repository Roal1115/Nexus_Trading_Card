import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb, getNexusAdmin } from "./nexus-admin.server";
import { SYSTEM_ACTOR } from "./nexus-admin-core";
import { logAction } from "./nexus-admin-shared";
import { slugify } from "./nexus-admin-stores.functions";
import { requireNexusManager } from "./nexus-auth.middleware";
import { assertManagerOwnsGame, getManagerGameIds } from "./nexus-manager-shared";
import { checkRateLimit, getClientIp } from "./rate-limit.server";
import {
  AFFILIATION_PLANS,
  decryptInviteToken,
  encryptInviteToken,
  hashInviteToken,
  INVITE_DAYS,
  isGoogleMapsUrl,
  newInviteToken,
  storeTagBase,
  subzoneIsValid,
} from "./store-invite-rules";
import { formatWeekHours, isValidWeek, TIME_OPTIONS, type WeekHours } from "./store-hours";
import locations from "@/data/mx-locations.json";

const INVALID_LINK = "Este enlace no es válido o ya venció.";
// Hasta aprobarse la cuenta no puede iniciar sesión. Cien años: Supabase no tiene "indefinido".
const BAN_UNTIL_APPROVED = "876000h";
const NO_GAME = "00000000-0000-0000-0000-000000000000";

type Admin = ReturnType<typeof getNexusAdmin>;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

async function emailHasAccount(admin: Admin, email: string): Promise<boolean> {
  const { data, error } = await admin
    .from("players")
    .select("id")
    .ilike("email", escapeLike(email))
    .limit(1);
  if (error) failDb(error);
  return (data ?? []).length > 0;
}

// Incluye a los jugadores fantasma: si el tag coincide, el trigger de Auth adoptaría
// esa cuenta y la tienda heredaría el historial de otra persona.
async function unusedStoreTag(admin: Admin, storeName: string): Promise<string> {
  const base = storeTagBase(storeName);
  for (let i = 0; i < 6; i++) {
    const tag = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const { data, error } = await admin
      .from("players")
      .select("id")
      .ilike("geek_tag", tag)
      .limit(1);
    if (error) failDb(error);
    if ((data ?? []).length === 0) return tag;
  }
  throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");
}

async function unusedStoreSlug(admin: Admin, storeName: string): Promise<string> {
  const base = slugify(storeName) || "tienda";
  for (let i = 1; i <= 20; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const { data, error } = await admin.from("stores").select("id").eq("slug", slug).limit(1);
    if (error) failDb(error);
    if ((data ?? []).length === 0) return slug;
  }
  throw new Error("Ya hay demasiadas tiendas con ese nombre.");
}

async function authUserIdOf(admin: Admin, playerId: string | null): Promise<string> {
  const { data, error } = playerId
    ? await admin.from("players").select("auth_user_id").eq("id", playerId).maybeSingle()
    : { data: null, error: null };
  if (error) failDb(error);
  if (!data?.auth_user_id) throw new Error("La cuenta de esta solicitud ya no existe.");
  return data.auth_user_id;
}

async function zoneList(admin: Admin) {
  const { data, error } = await admin
    .from("zones")
    .select("name, description, subzones(name, description)")
    .order("name");
  if (error) failDb(error);
  return (data ?? []).map((z) => ({
    ...z,
    subzones: [...z.subzones].sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

// ── Panel de Admin y Manager ───────────────────────────────────────
const HISTORY_DAYS = 30;

export const getStoreSignupPanel = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    const scope = gameIds.length ? gameIds : [NO_GAME];
    const now = new Date().toISOString();
    const historySince = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();

    const [invites, requests, games, zones, reviewed, lapsed] = await Promise.all([
      admin
        .from("store_signup_invites")
        .select("id, email, expires_at, created_at, token_encrypted, games(name)")
        .in("game_id", scope)
        .is("used_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      admin
        .from("store_signup_requests")
        .select(
          "id, email, store_name, city, state, phone, manager_name, manager_phone, affiliation_plan, zone, subzone, address, google_maps_url, opening_hours, instagram, twitter, twitch, website, created_at, games(name)",
        )
        .in("game_id", scope)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      admin.from("games").select("id, name").in("id", scope).order("name"),
      zoneList(admin),
      admin
        .from("store_signup_requests")
        .select("id, store_name, city, state, status, rejection_reason, reviewed_at, games(name)")
        .in("game_id", scope)
        .neq("status", "pending")
        .gte("reviewed_at", historySince)
        .order("reviewed_at", { ascending: false }),
      // Enlaces que nunca se usaron: la tienda no llegó a registrarse.
      admin
        .from("store_signup_invites")
        .select("id, email, expires_at, revoked_at, games(name)")
        .in("game_id", scope)
        .is("used_at", null)
        .or(
          `revoked_at.gte.${historySince},and(revoked_at.is.null,expires_at.lte.${now},expires_at.gte.${historySince})`,
        ),
    ]);
    if (invites.error) failDb(invites.error);
    if (requests.error) failDb(requests.error);
    if (games.error) failDb(games.error);
    if (reviewed.error) failDb(reviewed.error);
    if (lapsed.error) failDb(lapsed.error);

    const history = [
      ...(reviewed.data ?? []).map((r) => ({
        id: r.id,
        title: r.store_name,
        detail: `${r.city}, ${r.state} · ${r.games?.name ?? "TCG"}`,
        outcome: r.status as "approved" | "rejected",
        note: r.rejection_reason,
        at: r.reviewed_at as string,
      })),
      ...(lapsed.data ?? []).map((i) => ({
        id: i.id,
        title: i.email,
        detail: i.games?.name ?? "TCG",
        outcome: (i.revoked_at ? "revoked" : "expired") as "revoked" | "expired",
        note: null,
        at: i.revoked_at ?? i.expires_at,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    return {
      // El valor cifrado no sale del servidor: la pantalla solo necesita saber si existe.
      invites: (invites.data ?? []).map(({ token_encrypted, ...invite }) => ({
        ...invite,
        can_copy: Boolean(token_encrypted),
      })),
      requests: requests.data ?? [],
      games: games.data ?? [],
      zones,
      history,
    };
  });

export const createStoreInvite = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { email: string; game_id: string }) =>
    z.object({ email: z.string().email().max(200), game_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    await assertManagerOwnsGame(admin, player, data.game_id);
    const email = data.email.trim().toLowerCase();
    if (await emailHasAccount(admin, email)) {
      throw new Error("Ese correo ya tiene una cuenta. Asígnala a la tienda desde Admin.");
    }

    const token = newInviteToken();
    const secret = process.env.STORE_INVITE_TOKEN_KEY;
    // Sin la clave el enlace funciona igual; solo no se podrá volver a copiar.
    if (!secret) console.error("STORE_INVITE_TOKEN_KEY no está configurada");
    const { data: invite, error } = await admin
      .from("store_signup_invites")
      .insert({
        token_hash: await hashInviteToken(token),
        token_encrypted: secret ? await encryptInviteToken(token, secret) : null,
        email,
        game_id: data.game_id,
        created_by: player.id,
        expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) failDb(error);

    await logAction(admin, player, "STORE_INVITE_CREATED", "store_invite", invite.id, email, {
      game_id: data.game_id,
    });
    return { token, can_copy_later: Boolean(secret) };
  });

export const getStoreInviteLink = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { invite_id: string }) => z.object({ invite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: invite, error } = await admin
      .from("store_signup_invites")
      .select("email, game_id, token_encrypted")
      .eq("id", data.invite_id)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) failDb(error);
    if (!invite) throw new Error("Este enlace ya no está activo.");
    await assertManagerOwnsGame(admin, player, invite.game_id);

    const secret = process.env.STORE_INVITE_TOKEN_KEY;
    if (!invite.token_encrypted || !secret) {
      throw new Error("Este enlace no se puede recuperar. Revócalo y genera uno nuevo.");
    }
    let token: string;
    try {
      token = await decryptInviteToken(invite.token_encrypted, secret);
    } catch {
      // Pasa si la clave cambió después de crear el enlace.
      throw new Error("Este enlace no se puede recuperar. Revócalo y genera uno nuevo.");
    }
    await logAction(
      admin,
      player,
      "STORE_INVITE_LINK_COPIED",
      "store_invite",
      data.invite_id,
      invite.email,
    );
    return { token };
  });

export const revokeStoreInvite = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { invite_id: string }) => z.object({ invite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: invite, error: readError } = await admin
      .from("store_signup_invites")
      .select("email, game_id")
      .eq("id", data.invite_id)
      .maybeSingle();
    if (readError) failDb(readError);
    if (!invite) throw new Error("Invitación no encontrada.");
    await assertManagerOwnsGame(admin, player, invite.game_id);

    const { error } = await admin
      .from("store_signup_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.invite_id)
      .is("used_at", null);
    if (error) failDb(error);
    await logAction(
      admin,
      player,
      "STORE_INVITE_REVOKED",
      "store_invite",
      data.invite_id,
      invite.email,
    );
    return { ok: true };
  });

export const approveStoreSignup = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { request_id: string; zone: string; subzone: string | null }) =>
    z
      .object({
        request_id: z.string().uuid(),
        zone: z.string().trim().min(2).max(60),
        subzone: z.string().trim().min(2).max(60).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: request, error } = await admin
      .from("store_signup_requests")
      .select("store_name, game_id, player_id, status, manager_phone")
      .eq("id", data.request_id)
      .maybeSingle();
    if (error) failDb(error);
    if (!request) throw new Error("Solicitud no encontrada.");
    await assertManagerOwnsGame(admin, player, request.game_id);
    if (request.status !== "pending") throw new Error("Esta solicitud ya fue revisada.");

    const authUserId = await authUserIdOf(admin, request.player_id);
    const slug = await unusedStoreSlug(admin, request.store_name);

    const { data: storeId, error: approveError } = await admin.rpc("approve_store_signup" as any, {
      p_request_id: data.request_id,
      p_reviewer_id: player.id,
      p_slug: slug,
      p_zone: data.zone,
      p_subzone: data.subzone,
    });
    if (approveError) {
      if (approveError.message === "SUBZONE_REQUIRED") {
        throw new Error("Elige la subzona de esta tienda.");
      }
      if (approveError.message === "REQUEST_NOT_PENDING") {
        throw new Error("Esta solicitud ya fue revisada.");
      }
      failDb(approveError);
    }

    await logAction(
      admin,
      player,
      "STORE_SIGNUP_APPROVED",
      "store",
      storeId as unknown as string,
      request.store_name,
      {
        request_id: data.request_id,
        game_id: request.game_id,
        zone: data.zone,
        subzone: data.subzone,
      },
    );

    // El teléfono del encargado pasa a su "Contacto principal" de Staff, que es el WhatsApp
    // que usa el calendario para pedirle que suba torneos. No pisa uno ya capturado, y si
    // falla la tienda ya quedó aprobada: se captura a mano en Staff.
    if (request.manager_phone && request.player_id) {
      const { error: contactError } = await admin
        .from("players")
        .update({ contact_primary: request.manager_phone })
        .eq("id", request.player_id)
        .is("contact_primary", null);
      if (contactError) console.error("contact_primary al aprobar tienda:", contactError);
    }

    // Al final a propósito: si esto falla, la cuenta sigue bloqueada en vez de quedar abierta.
    // ponytail: sin reintento en pantalla; un Admin la desbloquea en Supabase si llega a pasar.
    const { error: unbanError } = await admin.auth.admin.updateUserById(authUserId, {
      ban_duration: "none",
    });
    if (unbanError) {
      throw new Error("La tienda se aprobó, pero su acceso sigue bloqueado. Avísale a un Admin.");
    }
    return { ok: true };
  });

export const rejectStoreSignup = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { request_id: string; reason: string }) =>
    z.object({ request_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: request, error } = await admin
      .from("store_signup_requests")
      .select("store_name, game_id, player_id, status")
      .eq("id", data.request_id)
      .maybeSingle();
    if (error) failDb(error);
    if (!request) throw new Error("Solicitud no encontrada.");
    await assertManagerOwnsGame(admin, player, request.game_id);
    if (request.status !== "pending") throw new Error("Esta solicitud ya fue revisada.");

    const authUserId = await authUserIdOf(admin, request.player_id);

    // Primero se reclama: de dos revisiones simultáneas solo una puede continuar.
    const { data: claimed, error: claimError } = await admin
      .from("store_signup_requests")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_by: player.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.request_id)
      .eq("status", "pending")
      .select("id");
    if (claimError) failDb(claimError);
    if ((claimed ?? []).length === 0) throw new Error("Esta solicitud ya fue revisada.");

    // La solicitud queda como registro; la cuenta se borra para poder invitar de nuevo.
    const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId);
    if (deleteError) {
      await admin
        .from("store_signup_requests")
        .update({ status: "pending", rejection_reason: null, reviewed_by: null, reviewed_at: null })
        .eq("id", data.request_id);
      failDb(deleteError);
    }

    await logAction(
      admin,
      player,
      "STORE_SIGNUP_REJECTED",
      "store_signup_request",
      data.request_id,
      request.store_name,
      { reason: data.reason, game_id: request.game_id },
    );
    return { ok: true };
  });

// ── Formulario público: sin sesión, el token es la credencial ──────
const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

async function activeInviteOf(admin: Admin, token: string) {
  const { data, error } = await admin
    .from("store_signup_invites")
    .select("id, email, games(name)")
    .eq("token_hash", await hashInviteToken(token))
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) failDb(error);
  return data;
}

export const getStoreInvite = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().max(100) }).parse(d))
  .handler(async ({ data }) => {
    if (!checkRateLimit(`store_invite_${getClientIp()}`, 30, 600_000))
      return { valid: false as const };
    if (!tokenSchema.safeParse(data.token).success) return { valid: false as const };

    const admin = getNexusAdmin();
    const invite = await activeInviteOf(admin, data.token);
    if (!invite) return { valid: false as const };

    return {
      valid: true as const,
      email: invite.email,
      game_name: (invite.games as { name: string } | null)?.name ?? "TCG",
      zones: await zoneList(admin),
    };
  });

const catalog = locations as Record<string, string[]>;
const handleSchema = z.string().trim().max(100);
const timeSchema = z.string().refine((t) => TIME_OPTIONS.includes(t));

const storeSignupSchema = z
  .object({
    token: tokenSchema,
    password: z.string().min(8).max(200).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
    store_name: z.string().trim().min(2).max(120),
    state: z.string(),
    city: z.string(),
    phone: z.string().trim().min(7).max(20),
    manager_name: z.string().trim().min(2).max(120),
    manager_phone: z.string().trim().min(7).max(20),
    affiliation_plan: z.enum(AFFILIATION_PLANS),
    address: z.string().trim().min(5).max(300),
    google_maps_url: z.string().trim().max(500).refine(isGoogleMapsUrl),
    week: z
      .array(z.object({ open: timeSchema, close: timeSchema }).nullable())
      .refine((week) => isValidWeek(week as WeekHours)),
    // null = "No sé": Admin o Manager la definen al aprobar.
    zone: z.string().trim().min(2).max(60).nullable(),
    subzone: z.string().trim().min(2).max(60).nullable(),
    instagram: handleSchema,
    twitter: handleSchema,
    twitch: handleSchema,
    website: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .url()
        .max(300)
        .regex(/^https?:\/\//i),
    ]),
  })
  .refine((d) => catalog[d.state]?.includes(d.city), { message: "Ciudad o estado no válidos" })
  .refine((d) => d.instagram || d.twitter || d.twitch || d.website, {
    message: "Agrega al menos una red social o tu página web",
  });

export type StoreSignupInput = z.infer<typeof storeSignupSchema>;

export const submitStoreSignup = createServerFn({ method: "POST" })
  .inputValidator((d: StoreSignupInput) => storeSignupSchema.parse(d))
  .handler(async ({ data }) => {
    if (!checkRateLimit(`store_signup_${getClientIp()}`, 10, 600_000)) {
      throw new Error("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
    }
    const admin = getNexusAdmin();

    // Antes de reclamar el enlace: una zona inválida no debe gastarlo.
    const zones = await zoneList(admin);
    if (
      (data.zone && !zones.some((z) => z.name === data.zone)) ||
      !subzoneIsValid(zones, data.zone, data.subzone)
    ) {
      throw new Error("Esa zona ya no existe. Recarga la página y elige otra.");
    }

    // Un solo UPDATE reclama el enlace: dos envíos simultáneos no pueden usarlo ambos.
    const { data: claimed, error: claimError } = await admin
      .from("store_signup_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", await hashInviteToken(data.token))
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id, email, game_id");
    if (claimError) failDb(claimError);
    const invite = claimed?.[0];
    if (!invite) throw new Error(INVALID_LINK);

    const release = () =>
      admin.from("store_signup_invites").update({ used_at: null }).eq("id", invite.id);

    let authUserId: string | null = null;
    try {
      if (await emailHasAccount(admin, invite.email)) {
        throw new Error("Ese correo ya tiene una cuenta. Contacta a quien te envió el enlace.");
      }
      const tag = await unusedStoreTag(admin, data.store_name);

      const { data: created, error: authError } = await admin.auth.admin.createUser({
        email: invite.email,
        password: data.password,
        email_confirm: true,
        ban_duration: BAN_UNTIL_APPROVED,
        user_metadata: { geek_tag: tag },
      });
      if (authError || !created?.user) {
        throw new Error(authError?.message ?? "No se pudo crear la cuenta.");
      }
      authUserId = created.user.id;

      const { data: account, error: accountError } = await admin
        .from("players")
        .select("id")
        .eq("auth_user_id", authUserId)
        .single();
      if (accountError) failDb(accountError);

      const { error: requestError } = await admin.from("store_signup_requests").insert({
        invite_id: invite.id,
        game_id: invite.game_id,
        player_id: account.id,
        email: invite.email,
        store_name: data.store_name,
        city: data.city,
        state: data.state,
        phone: data.phone,
        manager_name: data.manager_name,
        manager_phone: data.manager_phone,
        affiliation_plan: data.affiliation_plan,
        zone: data.zone,
        subzone: data.subzone,
        address: data.address,
        google_maps_url: data.google_maps_url,
        opening_hours: formatWeekHours(data.week as WeekHours),
        instagram: data.instagram || null,
        twitter: data.twitter || null,
        twitch: data.twitch || null,
        website: data.website || null,
      });
      if (requestError) failDb(requestError);
    } catch (e) {
      // Sin esto, un fallo dejaría una cuenta huérfana y el enlace gastado.
      if (authUserId) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(authUserId);
        if (cleanupError) {
          await logAction(
            admin,
            SYSTEM_ACTOR,
            "STORE_SIGNUP_ORPHAN_ACCOUNT",
            "auth_user",
            authUserId,
            invite.email,
            { error: cleanupError.message },
          );
        }
      }
      await release();
      throw e;
    }

    await logAction(
      admin,
      SYSTEM_ACTOR,
      "STORE_SIGNUP_SUBMITTED",
      "store_invite",
      invite.id,
      `${data.store_name} — ${data.city}`,
      { zone: data.zone, subzone: data.subzone },
    );
    return { ok: true as const };
  });

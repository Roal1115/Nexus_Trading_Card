// Flujos de auth por Geek Tag resueltos 100% server-side.
// El email real del jugador NUNCA se devuelve al navegador de un
// usuario no autenticado (antes resolveEmailByGeekTag permitía
// enumerar emails públicamente — ver AUDIT.md 1.2).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getNexusAdmin } from "./nexus-admin.server";
import { checkRateLimit, getClientIp } from "./rate-limit.server";
import { NEXUS_URL, NEXUS_PUBLISHABLE_KEY } from "@/integrations/nexus/client";

// Cliente anónimo efímero para operaciones de auth server-side.
function getAuthClient() {
  return createClient(NEXUS_URL, NEXUS_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Escapa metacaracteres de LIKE para evitar wildcard injection.
function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, "\\$&");
}

// Resuelve identifier (email o geek_tag) → email. Solo en servidor.
async function resolveEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return identifier;
  const admin = getNexusAdmin();
  const { data: player } = await admin
    .from("players")
    .select("email")
    .ilike("geek_tag", escapeLike(identifier))
    .maybeSingle();
  return (player as any)?.email ?? null;
}

// "jugador@gmail.com" → "j******@gmail.com" — para mostrar en UI sin exponer el email.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

const identifierSchema = z.string().min(1).max(120);

// ─── Login con Geek Tag o email ──────────────────────────────────────────
export const loginWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((d: { identifier: string; password: string }) =>
    z.object({ identifier: identifierSchema, password: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    // 5 intentos de login por IP por minuto
    if (!checkRateLimit(`login_${getClientIp()}`, 5, 60_000)) {
      return { ok: false as const, code: "error" as const, message: "Too many attempts" };
    }

    const email = await resolveEmail(data.identifier.trim());
    if (!email) {
      return { ok: false as const, code: "not_found" as const };
    }

    const auth = getAuthClient();
    const { data: signIn, error } = await auth.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (error) {
      if (/not confirmed/i.test(error.message)) {
        return { ok: false as const, code: "unconfirmed" as const, masked_email: maskEmail(email) };
      }
      return { ok: false as const, code: "error" as const, message: error.message };
    }

    if (!signIn.user?.email_confirmed_at) {
      return { ok: false as const, code: "unconfirmed" as const, masked_email: maskEmail(email) };
    }

    const admin = getNexusAdmin();
    const { data: player } = await admin
      .from("players")
      .select("role")
      .ilike("email", escapeLike(email.toLowerCase()))
      .maybeSingle();

    return {
      ok: true as const,
      session: {
        access_token: signIn.session!.access_token,
        refresh_token: signIn.session!.refresh_token,
      },
      role: ((player as any)?.role ?? "player") as string,
    };
  });

// ─── Reenviar correo de verificación ─────────────────────────────────────
export const resendConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: { identifier: string }) =>
    z.object({ identifier: identifierSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    // 3 reenvíos por IP por minuto — misma respuesta ok para no dar señal
    if (!checkRateLimit(`resend_${getClientIp()}`, 3, 60_000)) {
      return { ok: true as const };
    }
    const email = await resolveEmail(data.identifier.trim());
    // Respuesta idéntica exista o no la cuenta — sin señal de enumeración.
    if (!email) return { ok: true as const };
    const auth = getAuthClient();
    await auth.auth.resend({ type: "signup", email }).catch(() => {});
    return { ok: true as const };
  });

// ─── Enviar enlace de reset de contraseña ────────────────────────────────
export const sendPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: { identifier: string; redirect_to: string }) =>
    z
      .object({
        identifier: identifierSchema,
        redirect_to: z.string().url().max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // 3 resets por IP por minuto — misma respuesta ok para no dar señal
    if (!checkRateLimit(`reset_${getClientIp()}`, 3, 60_000)) {
      return { ok: true as const };
    }
    const email = await resolveEmail(data.identifier.trim());
    // Respuesta idéntica exista o no la cuenta.
    if (!email) return { ok: true as const };
    const auth = getAuthClient();
    await auth.auth
      .resetPasswordForEmail(email, { redirectTo: data.redirect_to })
      .catch(() => {});
    return { ok: true as const };
  });

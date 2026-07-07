// Server-only middleware that authenticates server functions against the
// Nexus Supabase project's JWT (NOT Lovable Cloud's auth).
// The browser attaches the nexus access token via `attachNexusAuth`.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getNexusAdmin, failDb } from "./nexus-admin.server";

type AppRole = "player" | "organizer" | "tcg_manager" | "admin";

type PlayerCtx = {
  id: string;
  geek_tag: string;
  email: string;
  role: AppRole;
  home_store_id: string | null;
};

async function resolveCaller(): Promise<{
  admin: ReturnType<typeof getNexusAdmin>;
  player: PlayerCtx;
}> {
  const request = getRequest();
  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new Error("Unauthorized: Bearer token required");
  }
  const token = authHeader.slice(7).trim();
  if (!token) throw new Error("Unauthorized: Empty token");

  const admin = getNexusAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.email) {
    throw new Error("Unauthorized: Invalid token");
  }
  const email = data.user.email.toLowerCase();
  // Escapar metacaracteres de LIKE — sin esto, un email con "%" o "_"
  // (válido para Supabase Auth) podría hacer match con el row de otro jugador.
  const emailPattern = email.replace(/[\\%_]/g, "\\$&");

  const { data: player, error: pe } = await admin
    .from("players")
    .select("id, geek_tag, email, role, home_store_id")
    .ilike("email", emailPattern)
    .maybeSingle();
  if (pe) failDb(pe);
  if (!player) throw new Error("No autorizado: jugador no encontrado");

  return { admin, player: player as PlayerCtx };
}

export const requireNexusAdmin = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { admin, player } = await resolveCaller();
    if (player.role !== "admin") throw new Error("No autorizado");
    return next({ context: { admin, player } });
  },
);

export const requireNexusManager = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { admin, player } = await resolveCaller();
    if (player.role !== "tcg_manager" && player.role !== "admin") {
      throw new Error("No autorizado");
    }
    return next({ context: { admin, player } });
  },
);

export const requireNexusOrganizer = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { admin, player } = await resolveCaller();
    if (
      player.role !== "organizer" &&
      player.role !== "tcg_manager" &&
      player.role !== "admin"
    ) {
      throw new Error("No autorizado");
    }
    return next({ context: { admin, player } });
  },
);

export const requireNexusUser = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { admin, player } = await resolveCaller();
    return next({ context: { admin, player } });
  },
);

// Server-only middleware that authenticates server functions against the
// GeekArena Supabase project's JWT (NOT Lovable Cloud's auth).
// The browser attaches the geekarena access token via `attachGeekarenaAuth`.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

type AppRole = "player" | "organizer" | "admin";

type PlayerCtx = {
  id: string;
  geek_tag: string;
  email: string;
  role: AppRole;
  home_store_id: string | null;
};

async function resolveCaller(): Promise<{
  admin: ReturnType<typeof getGeekarenaAdmin>;
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

  const admin = getGeekarenaAdmin();
  // Validates the JWT against the GeekArena Auth server.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.email) {
    throw new Error("Unauthorized: Invalid token");
  }
  const email = data.user.email.toLowerCase();

  const { data: player, error: pe } = await admin
    .from("players")
    .select("id, geek_tag, email, role, home_store_id")
    .ilike("email", email)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!player) throw new Error("No autorizado: jugador no encontrado");

  return { admin, player: player as PlayerCtx };
}

export const requireGeekarenaAdmin = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { admin, player } = await resolveCaller();
    if (player.role !== "admin") throw new Error("No autorizado");
    return next({ context: { admin, player } });
  },
);

export const requireGeekarenaOrganizer = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { admin, player } = await resolveCaller();
    if (player.role !== "organizer" && player.role !== "admin") {
      throw new Error("No autorizado");
    }
    return next({ context: { admin, player } });
  },
);

export const requireGeekarenaUser = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { admin, player } = await resolveCaller();
    return next({ context: { admin, player } });
  },
);

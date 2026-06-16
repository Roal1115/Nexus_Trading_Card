// Client-side middleware that attaches the GeekArena access token to every
// server function call. Server middleware (requireGeekarenaAdmin/Organizer)
// then validates and authorizes the caller based on the verified JWT.
import { createMiddleware } from "@tanstack/react-start";
import { geekarena } from "@/integrations/geekarena/client";

export const attachGeekarenaAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data, error } = await geekarena.auth.getSession();
      if (error) {
        // Stale/invalid refresh token — clear local session so the user is
        // redirected to /login on next interaction instead of looping 401s.
        if (typeof window !== "undefined") {
          await geekarena.auth.signOut().catch(() => {});
        }
      }
      token = data.session?.access_token;
    } catch {
      token = undefined;
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);

// Client-side middleware that attaches the Nexus access token to every
// server function call. Server middleware (requireNexusAdmin/Organizer)
// then validates and authorizes the caller based on the verified JWT.
import { createMiddleware } from "@tanstack/react-start";
import { nexus } from "@/integrations/nexus/client";

export const attachNexusAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data, error } = await nexus.auth.getSession();
      if (error) {
        // Stale/invalid refresh token — clear local session so the user is
        // redirected to /login on next interaction instead of looping 401s.
        if (typeof window !== "undefined") {
          await nexus.auth.signOut().catch(() => {});
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

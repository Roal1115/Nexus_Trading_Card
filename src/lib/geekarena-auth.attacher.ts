// Client-side middleware that attaches the GeekArena access token to every
// server function call. Server middleware (requireGeekarenaAdmin/Organizer)
// then validates and authorizes the caller based on the verified JWT.
import { createMiddleware } from "@tanstack/react-start";
import { geekarena } from "@/integrations/geekarena/client";

export const attachGeekarenaAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await geekarena.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);

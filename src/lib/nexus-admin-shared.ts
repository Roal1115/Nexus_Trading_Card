import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { requireNexusUser } from "./nexus-auth.middleware";
import type { Database, Json } from "./database.types";

export type TournamentStatus = Database["public"]["Enums"]["tournament_status"];

// Store URLs (website, google_maps_url) get rendered as <a href> on public
// pages. Without a protocol allowlist, a manager/organizer could persist
// "javascript:..." and turn the link into stored XSS for any visitor. Reject
// everything but http(s) instead of relying on z.string().url(), which
// happily accepts "javascript:alert(1)" as a well-formed URL.
export const httpUrlSchema = z
  .string()
  .max(500)
  .trim()
  .optional()
  .or(z.literal(""))
  // Managers routinely type "www.mitienda.com" with no scheme. Auto-prepend
  // https:// instead of rejecting the save, so legacy-style input still works.
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => !v || /^https?:\/\//i.test(v), {
    message: "La URL debe iniciar con http:// o https://",
  });

export { logAction, getActiveSeason, tfMonth, recomputeSnapshot } from "./nexus-admin-core";
import { getActiveSeason } from "./nexus-admin-core";

export const fetchActiveSeason = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .handler(async ({ context }) => {
    return getActiveSeason(context.admin);
  });

// ---------- Torneos pendientes / aprobados ----------

export const PAGE_SIZE = 25;

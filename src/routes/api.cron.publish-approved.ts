// Disparador HTTP de la publicación programada (domingo 00:00 America/Mexico_City).
// Lo llama pg_cron vía pg_net con el header x-cron-secret. Apagado por
// default: sin PUBLISH_CRON_ENABLED=true responde 404, así que desplegar el
// código no activa nada. La lógica vive en runScheduledPublication().
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { getNexusAdmin } from "@/lib/nexus-admin.server";
import { runScheduledPublication } from "@/lib/nexus-publication.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/cron/publish-approved")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.PUBLISH_CRON_ENABLED !== "true") return json({ error: "Not found" }, 404);
        const secret = process.env.PUBLISH_CRON_SECRET;
        if (!secret) return json({ error: "Scheduler not configured" }, 503);
        if (!secretMatches(request.headers.get("x-cron-secret"), secret)) {
          return json({ error: "Unauthorized" }, 401);
        }

        let body: { dry_run?: boolean; now?: string } = {};
        try {
          body = (await request.json()) ?? {};
        } catch {
          body = {};
        }
        const dryRun = body.dry_run === true;
        // Un `now` falso solo se acepta en pruebas en seco o en entornos de prueba
        // explícitos: una corrida real nunca puede adelantarse al domingo.
        const allowTimeOverride = dryRun || process.env.ALLOW_TIME_OVERRIDE === "true";
        const now = body.now && allowTimeOverride ? new Date(body.now) : new Date();
        if (Number.isNaN(now.getTime())) return json({ error: "Invalid now" }, 400);

        try {
          const result = await runScheduledPublication(getNexusAdmin(), { now, dryRun });
          return json(result);
        } catch (e) {
          console.error("[cron] scheduled publication failed:", e);
          return json({ error: "Scheduled publication failed" }, 500);
        }
      },
    },
  },
});

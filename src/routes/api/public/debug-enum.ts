import { createFileRoute } from "@tanstack/react-router";
import { getGeekarenaAdmin } from "@/lib/geekarena-admin.server";

export const Route = createFileRoute("/api/public/debug-enum")({
  server: {
    handlers: {
      GET: async () => {
        const admin = getGeekarenaAdmin();
        const sample = await admin
          .from("leaderboard_snapshots")
          .select("timeframe_type, timeframe_value")
          .limit(20);
        return Response.json({ sample });
      },
    },
  },
});

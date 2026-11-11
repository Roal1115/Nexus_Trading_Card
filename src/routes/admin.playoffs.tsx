import { createFileRoute } from "@tanstack/react-router";
import { PlayoffsPanel } from "@/components/playoffs/PlayoffsPanel";

export const Route = createFileRoute("/admin/playoffs")({
  head: () => ({ meta: [{ title: "Playoffs — Admin" }] }),
  component: () => (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PlayoffsPanel />
    </div>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { StoreZonesPanel } from "@/components/stores/StoreZonesPanel";

export const Route = createFileRoute("/admin/zonas")({
  head: () => ({ meta: [{ title: "Zonas — Nexus" }] }),
  component: StoreZonesPanel,
});

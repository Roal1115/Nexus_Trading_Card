import { createFileRoute } from "@tanstack/react-router";
import { StoreZonesPanel } from "@/components/stores/StoreZonesPanel";

export const Route = createFileRoute("/tcg-manager/zonas")({
  head: () => ({ meta: [{ title: "Zonas — TCG Manager" }] }),
  component: StoreZonesPanel,
});

import { createFileRoute } from "@tanstack/react-router";
import { StoreAltasPanel } from "@/components/stores/StoreInvitesPanel";

export const Route = createFileRoute("/admin/stores_/altas")({
  head: () => ({ meta: [{ title: "Altas de tiendas — Nexus" }] }),
  component: StoreAltasPanel,
});

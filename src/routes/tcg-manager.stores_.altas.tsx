import { createFileRoute } from "@tanstack/react-router";
import { StoreAltasPanel } from "@/components/stores/StoreInvitesPanel";

export const Route = createFileRoute("/tcg-manager/stores_/altas")({
  head: () => ({ meta: [{ title: "Altas de tiendas — TCG Manager" }] }),
  component: StoreAltasPanel,
});

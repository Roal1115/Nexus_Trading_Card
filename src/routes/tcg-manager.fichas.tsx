import { createFileRoute } from "@tanstack/react-router";
import { FichaReviewPage } from "@/components/calendar/occurrence-panel";

export const Route = createFileRoute("/tcg-manager/fichas")({
  head: () => ({ meta: [{ title: "Fichas de tienda — Nexus" }] }),
  component: FichaReviewPage,
});

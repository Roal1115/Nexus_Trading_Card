import { createFileRoute } from "@tanstack/react-router";
import { FichaReviewPage } from "@/components/calendar/occurrence-panel";

export const Route = createFileRoute("/admin/fichas")({
  head: () => ({ meta: [{ title: "Fichas de tienda — Nexus" }] }),
  component: FichaReviewPage,
});

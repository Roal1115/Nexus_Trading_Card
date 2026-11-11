import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseReviewSearch } from "@/components/manager/ManagerReviewHistory";

// Ruta histórica: "Mi Historial" ahora es la pestaña "Revisados por mí" de Torneos.
// Conserva los filtros del bookmark.
export const Route = createFileRoute("/tcg-manager/my-history")({
  validateSearch: parseReviewSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/tcg-manager/tournaments",
      search: { ...search, tab: "mine" },
      replace: true,
    });
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseHistorySearch } from "@/components/admin/TournamentHistory";

// Ruta histórica: el Historial ahora es la pestaña "Todos" de Torneos.
// Conserva los filtros del bookmark.
export const Route = createFileRoute("/admin/history")({
  validateSearch: parseHistorySearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/admin/tournaments", search: { ...search, tab: "all" }, replace: true });
  },
});

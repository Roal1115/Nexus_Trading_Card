import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta histórica: se conserva solo para no romper bookmarks y enlaces viejos.
export const Route = createFileRoute("/admin/approved")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/tournaments", search: { tab: "approved" }, replace: true });
  },
});

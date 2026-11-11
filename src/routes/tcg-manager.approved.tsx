import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta histórica: se conserva solo para no romper bookmarks y enlaces viejos.
export const Route = createFileRoute("/tcg-manager/approved")({
  beforeLoad: () => {
    throw redirect({ to: "/tcg-manager/tournaments", search: { tab: "approved" }, replace: true });
  },
});

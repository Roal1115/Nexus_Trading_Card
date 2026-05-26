import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Store, Upload, ListChecks } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { PanelSidebar } from "@/components/layout/PanelSidebar";

export const Route = createFileRoute("/organizer")({
  head: () => ({ meta: [{ title: "Panel del Organizador — Geek Arena" }] }),
  component: OrganizerLayout,
});

function OrganizerLayout() {
  const { role, player, loading } = useGeekarenaRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role !== "organizer" && role !== "admin") {
      navigate({ to: "/login" });
    }
  }, [loading, role, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (role !== "organizer" && role !== "admin") return null;

  return (
    <div className="flex min-h-screen">
      <PanelSidebar
        title="Organizador"
        subtitle="Panel"
        userLabel={player?.geek_tag ?? "Organizador"}
        items={[
          { to: "/organizer", label: "Mi Tienda", icon: <Store size={16} />, exact: true },
          { to: "/organizer/tournaments", label: "Mis Torneos", icon: <ListChecks size={16} /> },
          { to: "/organizer/new", label: "Subir Torneo", icon: <Upload size={16} /> },
          { to: "/", label: "Ranking Global", icon: <Trophy size={16} />, external: true },
        ]}
      />
      <main className="min-w-0 flex-1 p-6 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}

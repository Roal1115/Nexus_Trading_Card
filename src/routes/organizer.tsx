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
        ]}
      />
      <main className="min-w-0 flex-1 p-6 sm:p-8">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : role !== "organizer" && role !== "admin" ? null : (
          <Outlet />
        )}
      </main>
    </div>
  );
}

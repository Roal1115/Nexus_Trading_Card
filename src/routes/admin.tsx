import { useEffect } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Store,
  Users,
  Upload,
} from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { PanelSidebar } from "@/components/layout/PanelSidebar";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Panel Administrador — Geek Arena" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { role, player, loading } = useGeekarenaRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role !== "admin") {
      navigate({ to: "/login" });
    }
  }, [loading, role, navigate]);

  return (
    <div className="flex min-h-screen">
      <PanelSidebar
        title="Administración"
        subtitle="Panel"
        userLabel={player?.geek_tag ?? "Admin"}
        items={[
          { to: "/admin", label: "Torneos Pendientes", icon: <ShieldCheck size={16} />, exact: true },
          { to: "/admin/approved", label: "Torneos Aprobados", icon: <CheckCircle2 size={16} /> },
          { to: "/admin/stores", label: "Tiendas y Organizadores", icon: <Store size={16} /> },
          { to: "/admin/players", label: "Jugadores", icon: <Users size={16} /> },
          { to: "/admin/publish", label: "Publicar Manualmente", icon: <Upload size={16} /> },
        ]}
      />
      <main className="min-w-0 flex-1 p-6 sm:p-8">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : role !== "admin" ? null : (
          <Outlet />
        )}
      </main>
    </div>
  );
}

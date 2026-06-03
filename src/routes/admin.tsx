import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  Menu,
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
  const [menuOpen, setMenuOpen] = useState(false);

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
        mobileOpen={menuOpen}
        onMobileClose={() => setMenuOpen(false)}
        sections={[
          {
            title: "Administración",
            items: [
              { to: "/admin", label: "Torneos Pendientes", icon: <ShieldCheck size={16} />, exact: true },
              { to: "/admin/approved", label: "Torneos Aprobados", icon: <CheckCircle2 size={16} /> },
              { to: "/admin/stores", label: "Tiendas y Organizadores", icon: <Store size={16} /> },
              { to: "/admin/players", label: "Jugadores", icon: <Users size={16} /> },
            ],
          },
          {
            title: "Circuito",
            items: [
              { to: "/admin/upload", label: "Subir Torneo", icon: <Upload size={16} /> },
            ],
          },
        ]}
      />
      <main className="min-w-0 flex-1">
        {/* Header mobile con hamburger */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
          <div className="text-sm font-semibold text-white">Panel Admin</div>
          <button
            className="p-1 text-gray-400 transition hover:text-white"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : role !== "admin" ? null : (
            <Outlet />
          )}
        </div>
      </main>
    </div>
  );
}

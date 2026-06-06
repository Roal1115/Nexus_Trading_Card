import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Calendar,
  CheckCircle2,
  History,
  Loader2,
  Menu,
  ShieldCheck,
  Store,
  Users,
  Upload,
} from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { PanelSidebar } from "@/components/layout/PanelSidebar";
import { useBadgeCounts, useActivityLastSeen } from "@/hooks/use-badge-counts";
import { getAdminBadgeCounts } from "@/lib/geekarena-admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Panel Administrador — Geek Arena" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { role, player, loading } = useGeekarenaRole();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { get: getLastSeen } = useActivityLastSeen();
  const fetchCounts = useServerFn(getAdminBadgeCounts);
  const { counts } = useBadgeCounts(fetchCounts, () => ({
    activity_last_seen: getLastSeen(),
  }));

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
              { to: "/admin", label: "Torneos Pendientes", icon: <ShieldCheck size={16} />, exact: true, badge: counts?.pending ?? 0 },
              { to: "/admin/approved", label: "Torneos Aprobados", icon: <CheckCircle2 size={16} />, badge: counts?.approvedActive ?? 0 },
              { to: "/admin/stores", label: "Tiendas y Organizadores", icon: <Store size={16} /> },
              { to: "/admin/players", label: "Jugadores", icon: <Users size={16} /> },
              { to: "/admin/seasons", label: "Temporadas", icon: <Calendar size={16} /> },
              { to: "/admin/activity", label: "Activity Center", icon: <Activity size={16} />, badge: counts?.activity ?? 0 },
            ],
          },
          {
            title: "Circuito",
            items: [
              { to: "/admin/publish", label: "Publicar Manualmente", icon: <Upload size={16} />, badge: counts?.readyToPublish ?? 0 },
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

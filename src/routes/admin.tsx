import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  CalendarRange,
  LayoutDashboard,
  Loader2,
  Megaphone,
  ScrollText,
  Store,
  Trophy,
  Upload,
  Users,
} from "lucide-react";

import { useNexusRole } from "@/hooks/use-nexus-role";
import { PanelSidebar } from "@/components/layout/PanelSidebar";
import { PanelBottomNav } from "@/components/layout/PanelBottomNav";
import { useBadgeCounts, useActivityLastSeen } from "@/hooks/use-badge-counts";
import { getAdminBadgeCounts } from "@/lib/nexus-admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Panel Administrador — Nexus" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { role, player, loading } = useNexusRole();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { get: getLastSeen } = useActivityLastSeen();
  const fetchCounts = useServerFn(getAdminBadgeCounts);
  const { counts } = useBadgeCounts(fetchCounts, () => ({
    activity_last_seen: getLastSeen(),
  }));
  const tournamentsBadge = (counts?.pending ?? 0) + (counts?.approvedActive ?? 0);

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
        action={{ to: "/admin/upload", label: "Subir torneo", icon: <Upload size={16} /> }}
        sections={[
          {
            title: "Operación",
            items: [
              { to: "/admin", label: "Inicio", icon: <LayoutDashboard size={16} />, exact: true },
              {
                to: "/admin/tournaments",
                label: "Torneos",
                icon: <Trophy size={16} />,
                badge: tournamentsBadge,
              },
              { to: "/admin/calendar", label: "Calendario", icon: <Calendar size={16} /> },
            ],
          },
          {
            title: "Red",
            items: [
              { to: "/admin/stores", label: "Tiendas", icon: <Store size={16} /> },
              { to: "/admin/players", label: "Usuarios", icon: <Users size={16} /> },
            ],
          },
          {
            title: "Configuración",
            items: [
              { to: "/admin/seasons", label: "Temporadas", icon: <CalendarRange size={16} /> },
              { to: "/admin/ads", label: "Sponsors", icon: <Megaphone size={16} /> },
            ],
          },
          {
            title: "Auditoría",
            items: [
              {
                to: "/admin/activity",
                label: "Registro",
                icon: <ScrollText size={16} />,
                badge: counts?.activity ?? 0,
              },
            ],
          },
        ]}
      />
      <main className="min-w-0 flex-1">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white lg:hidden">
          Panel Admin
        </div>

        <div className="p-6 sm:p-8">
          {loading && !player ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>
      <PanelBottomNav
        moreOpen={menuOpen}
        onMore={() => setMenuOpen((o) => !o)}
        items={[
          { to: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
          { to: "/admin/tournaments", label: "Torneos", icon: Trophy, badge: tournamentsBadge },
          { to: "/admin/upload", label: "Subir torneo", icon: Upload, primary: true },
          { to: "/admin/calendar", label: "Calendario", icon: Calendar },
        ]}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  History,
  LayoutDashboard,
  Loader2,
  Medal,
  Scale,
  Store,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { PanelSidebar } from "@/components/layout/PanelSidebar";
import { PanelBottomNav } from "@/components/layout/PanelBottomNav";
import { useBadgeCounts } from "@/hooks/use-badge-counts";
import { getOrganizerBadgeCounts } from "@/lib/nexus-organizer.functions";

export const Route = createFileRoute("/organizer")({
  head: () => ({ meta: [{ title: "Panel del Organizador — Nexus" }] }),
  component: OrganizerLayout,
});

function OrganizerLayout() {
  const { role, player, loading } = useNexusRole();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchCounts = useServerFn(getOrganizerBadgeCounts);
  const { counts } = useBadgeCounts(fetchCounts);

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
        mobileOpen={menuOpen}
        onMobileClose={() => setMenuOpen(false)}
        action={{ to: "/organizer/new", label: "Subir torneo", icon: <Upload size={16} /> }}
        sections={[
          {
            title: "Mi tienda",
            items: [
              // ponytail: hoy Inicio muestra las estadísticas; en la Fase 5 pasan a /organizer/analytics.
              {
                to: "/organizer",
                label: "Inicio",
                icon: <LayoutDashboard size={16} />,
                exact: true,
              },
              {
                to: "/organizer/tournaments",
                label: "Torneos",
                icon: <Trophy size={16} />,
                badge: counts?.pending ?? 0,
              },
              // ponytail: se une a Torneos → Todos en la Fase 5.
              { to: "/organizer/history", label: "Historial", icon: <History size={16} /> },
              {
                to: "/organizer/appeals",
                label: "Apelaciones",
                icon: <Scale size={16} />,
                badge: counts?.appeals ?? 0,
              },
              { to: "/organizer/calendar", label: "Calendario", icon: <Calendar size={16} /> },
              { to: "/organizer/leagues", label: "Ligas", icon: <Medal size={16} /> },
            ],
          },
          {
            title: "Información",
            items: [
              { to: "/organizer/players", label: "Jugadores", icon: <Users size={16} /> },
              { to: "/organizer/store", label: "Datos de la tienda", icon: <Store size={16} /> },
            ],
          },
        ]}
      />
      <main className="min-w-0 flex-1">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white lg:hidden">
          Panel Organizador
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
          { to: "/organizer", label: "Inicio", icon: LayoutDashboard, exact: true },
          {
            to: "/organizer/tournaments",
            label: "Torneos",
            icon: Trophy,
            badge: counts?.pending ?? 0,
          },
          { to: "/organizer/new", label: "Subir torneo", icon: Upload, primary: true },
          { to: "/organizer/calendar", label: "Calendario", icon: Calendar },
        ]}
      />
    </div>
  );
}

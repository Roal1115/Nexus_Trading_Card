import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  History,
  LayoutDashboard,
  Loader2,
  Store as StoreIcon,
  Trophy,
  Upload,
} from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { PanelSidebar } from "@/components/layout/PanelSidebar";
import { PanelBottomNav } from "@/components/layout/PanelBottomNav";
import { useBadgeCounts } from "@/hooks/use-badge-counts";
import { getManagerBadgeCounts } from "@/lib/nexus-manager.functions";

export const Route = createFileRoute("/tcg-manager")({
  head: () => ({ meta: [{ title: "Panel TCG Manager — Nexus" }] }),
  component: TcgManagerLayout,
});

function TcgManagerLayout() {
  const { role, player, loading } = useNexusRole();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchCounts = useServerFn(getManagerBadgeCounts);
  const { counts } = useBadgeCounts(fetchCounts);
  const tournamentsBadge = (counts?.pending ?? 0) + (counts?.approved ?? 0);

  useEffect(() => {
    if (loading) return;
    if (role !== "tcg_manager" && role !== "admin") {
      navigate({ to: "/login" });
    }
  }, [loading, role, navigate]);

  return (
    <div className="flex min-h-screen">
      <PanelSidebar
        title="TCG Manager"
        subtitle="Panel"
        userLabel={player?.geek_tag ?? "Manager"}
        mobileOpen={menuOpen}
        onMobileClose={() => setMenuOpen(false)}
        action={{ to: "/tcg-manager/upload", label: "Subir torneo", icon: <Upload size={16} /> }}
        sections={[
          {
            title: "Moderación",
            items: [
              {
                to: "/tcg-manager",
                label: "Inicio",
                icon: <LayoutDashboard size={16} />,
                exact: true,
              },
              {
                to: "/tcg-manager/tournaments",
                label: "Torneos",
                icon: <Trophy size={16} />,
                badge: tournamentsBadge,
              },
              // ponytail: Historial y Revisados por mí se vuelven pestañas de Torneos en la Fase 4.
              { to: "/tcg-manager/history", label: "Historial", icon: <History size={16} /> },
              {
                to: "/tcg-manager/my-history",
                label: "Revisados por mí",
                icon: <ClipboardCheck size={16} />,
              },
              { to: "/tcg-manager/calendar", label: "Calendario", icon: <Calendar size={16} /> },
            ],
          },
          {
            title: "Red",
            items: [
              {
                to: "/tcg-manager/stores",
                label: "Tiendas a mi cargo",
                icon: <StoreIcon size={16} />,
              },
              {
                to: "/tcg-manager/analytics",
                label: "Estadísticas",
                icon: <BarChart3 size={16} />,
              },
            ],
          },
        ]}
      />
      <main className="min-w-0 flex-1">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white lg:hidden">
          Panel TCG Manager
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
          { to: "/tcg-manager", label: "Inicio", icon: LayoutDashboard, exact: true },
          {
            to: "/tcg-manager/tournaments",
            label: "Torneos",
            icon: Trophy,
            badge: tournamentsBadge,
          },
          { to: "/tcg-manager/upload", label: "Subir torneo", icon: Upload, primary: true },
          { to: "/tcg-manager/calendar", label: "Calendario", icon: Calendar },
        ]}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  History,
  Loader2,
  Menu,
  ShieldCheck,
  Store as StoreIcon,
  Upload,
} from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { PanelSidebar } from "@/components/layout/PanelSidebar";
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
        sections={[
          {
            title: "Moderación",
            items: [
              { to: "/tcg-manager/tournaments-panel", label: "Torneos", icon: <ShieldCheck size={16} />, badge: (counts?.pending ?? 0) + (counts?.approved ?? 0) },
              { to: "/tcg-manager/history", label: "Historial de Torneos", icon: <History size={16} /> },
              { to: "/tcg-manager/my-history", label: "Mi Historial", icon: <History size={16} /> },
            ],
          },
          {
            title: "Red",
            items: [
              { to: "/tcg-manager/stores", label: "Tiendas", icon: <StoreIcon size={16} /> },
            ],
          },
          {
            title: "Circuito",
            items: [
              { to: "/tcg-manager/analytics", label: "Analytics", icon: <BarChart3 size={16} /> },
              { to: "/tcg-manager/calendar", label: "Calendario", icon: <Calendar size={16} /> },
              { to: "/tcg-manager/upload", label: "Subir Torneo", icon: <Upload size={16} /> },
            ],
          },
        ]}
      />
      <main className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
          <button
            className="p-1 text-gray-400 transition hover:text-white"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <div className="text-sm font-semibold text-white">Panel Manager</div>
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
    </div>
  );
}

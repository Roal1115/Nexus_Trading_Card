import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Calendar, Loader2, Menu, Store, Trophy, Upload } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { PanelSidebar } from "@/components/layout/PanelSidebar";
import { useBadgeCounts } from "@/hooks/use-badge-counts";
import { getOrganizerBadgeCounts } from "@/lib/geekarena-organizer.functions";

export const Route = createFileRoute("/organizer")({
  head: () => ({ meta: [{ title: "Panel del Organizador — Geek Arena" }] }),
  component: OrganizerLayout,
});

function OrganizerLayout() {
  const { role, player, loading } = useGeekarenaRole();
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
        items={[
          { to: "/organizer", label: "Analytics", icon: <BarChart3 size={16} />, exact: true },
          { to: "/organizer/store", label: "Mi Tienda", icon: <Store size={16} /> },
          { to: "/organizer/tournaments", label: "Mis Torneos", icon: <Trophy size={16} />, badge: counts?.pending ?? 0 },
          { to: "/organizer/calendar", label: "Calendario", icon: <Calendar size={16} /> },
          { to: "/organizer/new", label: "Subir Torneo", icon: <Upload size={16} /> },
        ]}
      />
      <main className="min-w-0 flex-1">
        {/* Header mobile con hamburger */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
          <button
            className="p-1 text-gray-400 transition hover:text-white"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <div className="text-sm font-semibold text-white">Panel Organizador</div>
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

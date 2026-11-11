import { useQuery } from "@tanstack/react-query";
import { PanelSidebar } from "@/components/layout/PanelSidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { playerNavSections } from "@/components/layout/player-nav";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { myDashboardQuery } from "@/lib/dashboard-queries";

// Sidebar de navegación para jugadores logueados, solo desktop (lg+).
// En mobile la navegación sigue siendo BottomNav + ProfileDrawer.
//
// Se monta en cuanto `probablyAuthed` es true (lectura síncrona de
// localStorage, disponible antes que el fetch de red del perfil) para que
// el layout reserve su ancho desde el primer render y no empuje el
// contenido cuando el perfil termina de cargar. Las secciones de nav se
// rellenan cuando `player` llega; mientras tanto queda vacío (visible por
// una fracción de segundo, nunca un salto de layout).
export function PlayerSidebar() {
  const { player, probablyAuthed } = useNexusRole();
  // Rango para la fila de identidad del pie. Reusa la caché del dashboard
  // (misma queryKey), así que en /dashboard no hace un fetch extra.
  // ponytail: fuera del dashboard trae el dashboard completo para un número;
  // si pesa, crear un getMyRank ligero.
  const dashboardQ = useQuery({
    ...myDashboardQuery(),
    enabled: !!player && player.role === "player",
  });
  if (!probablyAuthed) return null;

  const tcg = (dashboardQ.data as any)?.tcgStats?.[0];
  const season = (dashboardQ.data as any)?.semesterLabel as string | undefined;
  const userMeta =
    tcg?.rank_position > 0 ? `#${tcg.rank_position}${season ? ` · ${season}` : ""}` : undefined;

  return (
    <div className="hidden shrink-0 md:block">
      <PanelSidebar
        collapsible
        title="Nexus"
        subtitle="Jugador"
        sections={player ? playerNavSections(player.role, player.geek_tag) : []}
        userLabel={player?.geek_tag ?? ""}
        userHref={player?.geek_tag ? `/players/${player.geek_tag}` : undefined}
        userMeta={userMeta}
        topSlot={(collapsed) => (
          <div className="mb-4 space-y-3">
            <NotificationBell variant="sidebar" collapsed={collapsed} />
          </div>
        )}
      />
    </div>
  );
}

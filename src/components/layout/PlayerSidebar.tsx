import { PanelSidebar } from "@/components/layout/PanelSidebar";
import { TcgSwitcher } from "@/components/layout/TcgSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { playerNavSections } from "@/components/layout/player-nav";
import { useNexusRole } from "@/hooks/use-nexus-role";

// Sidebar de navegación para jugadores logueados, solo desktop (lg+).
// En mobile la navegación sigue siendo BottomNav + ProfileDrawer.
export function PlayerSidebar() {
  const { player, loading } = useNexusRole();
  if (loading || !player) return null;

  return (
    <div className="hidden shrink-0 lg:block">
      <PanelSidebar
        collapsible
        title="Nexus"
        subtitle="Jugador"
        sections={playerNavSections(player.role, player.geek_tag)}
        userLabel={player.geek_tag}
        topSlot={(collapsed) => (
          <div className="mb-4 space-y-3 px-2">
            <TcgSwitcher collapsed={collapsed} />
            <div className={collapsed ? "flex justify-center" : "flex justify-end"}>
              <NotificationBell />
            </div>
          </div>
        )}
      />
    </div>
  );
}

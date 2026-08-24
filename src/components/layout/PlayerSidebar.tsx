import { PanelSidebar } from "@/components/layout/PanelSidebar";
import { TcgSwitcher } from "@/components/layout/TcgSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { playerNavSections } from "@/components/layout/player-nav";
import { useNexusRole } from "@/hooks/use-nexus-role";

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
  if (!probablyAuthed) return null;

  return (
    <div className="hidden shrink-0 lg:block">
      <PanelSidebar
        collapsible
        title="Nexus"
        subtitle="Jugador"
        sections={player ? playerNavSections(player.role, player.geek_tag) : []}
        userLabel={player?.geek_tag ?? ""}
        topSlot={(collapsed) => (
          <div className="mb-4 space-y-3 px-2">
            <TcgSwitcher collapsed={collapsed} />
            <NotificationBell variant="sidebar" collapsed={collapsed} />
          </div>
        )}
      />
    </div>
  );
}

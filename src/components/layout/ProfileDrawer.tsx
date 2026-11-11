import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import { nexus } from "@/integrations/nexus/client";
import { playerNavSections } from "@/components/layout/player-nav";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ConfirmLogout } from "@/components/layout/ConfirmLogout";
import { useQuery } from "@tanstack/react-query";
import { myDashboardQuery } from "@/lib/dashboard-queries";

// 1. El prop player ya tiene role — confirma que el tipo lo incluye:
type ProfileDrawerProps = {
  open: boolean;
  onClose: () => void;
  player: {
    id: string;
    geek_tag: string;
    avatar_url: string | null;
    role: string; // "player" | "organizer" | "tcg_manager" | "admin"
  };
};

// Construido sobre Sheet (Radix Dialog): a diferencia del drawer anterior
// (hand-rolled con AnimatePresence + posicionamiento manual), esto da gratis
// bloqueo de scroll del body, cierre con Escape y focus trap/restore — las
// tres cosas que el drawer anterior no tenía pese a declarar aria-modal.
export function ProfileDrawer({ open, onClose, player }: ProfileDrawerProps) {
  const initials = player.geek_tag?.slice(0, 2).toUpperCase() ?? "GA";
  // Misma línea de identidad que el pie del sidebar de escritorio.
  const dashboardQ = useQuery({ ...myDashboardQuery(), enabled: player.role === "player" });
  const tcg = (dashboardQ.data as any)?.tcgStats?.[0];
  const season = (dashboardQ.data as any)?.semesterLabel as string | undefined;
  const rankLine =
    tcg?.rank_position > 0 ? `#${tcg.rank_position}${season ? ` · ${season}` : ""}` : null;

  // Cierre explícito al navegar: confiar solo en el onClick del <Link> de
  // cada item no era confiable — al combinarse con la navegación de router
  // en el mismo click, el drawer a veces se quedaba abierto (data-state
  // nunca pasaba a "closed", detectado con Playwright). Cerrar por cambio
  // de ruta es la señal correcta y no depende de ese timing.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    if (openRef.current) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    await nexus.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        id="profile-drawer"
        side="right"
        className="flex w-[86%] max-w-sm flex-col gap-0 border-border bg-card p-0"
      >
        <SheetTitle className="sr-only">Menú de perfil</SheetTitle>
        <SheetDescription className="sr-only">
          Navegación y ajustes de tu cuenta en Nexus.
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border p-5">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-secondary">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={player.geek_tag}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-foreground">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{player.geek_tag}</p>
            {rankLine && <p className="truncate text-xs text-foreground-subtle">{rankLine}</p>}
          </div>
        </div>

        {/* Nav sections — misma fuente de verdad que PlayerSidebar */}
        <div className="flex-1 overflow-y-auto p-4">
          {playerNavSections(player.role, player.geek_tag).map((sec) => (
            <Section key={sec.title} title={sec.title}>
              {sec.items.map((item) => (
                <DrawerLink key={item.to} to={item.to} onClose={onClose}>
                  <span className="flex items-center gap-2.5 text-foreground-subtle">
                    {item.icon}
                  </span>
                  {item.label}
                </DrawerLink>
              ))}
            </Section>
          ))}
        </div>

        {/* Logout */}
        <div className="border-t border-border p-4">
          <ConfirmLogout
            onConfirm={handleLogout}
            trigger={
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground-secondary transition hover:bg-white/5 hover:text-foreground"
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 px-3 text-xs font-medium text-foreground-subtle">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function DrawerLink({
  to,
  onClose,
  children,
}: {
  to: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClose}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white transition hover:bg-white/5"
    >
      {children}
    </Link>
  );
}

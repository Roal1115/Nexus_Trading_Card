import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import { nexus } from "@/integrations/nexus/client";
import { playerNavSections } from "@/components/layout/player-nav";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

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
        side="left"
        className="flex w-[86%] max-w-sm flex-col gap-0 border-white/10 bg-[#0B1220]/95 p-0 backdrop-blur-xl"
      >
        <SheetTitle className="sr-only">Menú de perfil</SheetTitle>
        <SheetDescription className="sr-only">
          Navegación y ajustes de tu cuenta en Nexus.
        </SheetDescription>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 p-5">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border bg-card">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={player.geek_tag}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-primary">{initials}</span>
            )}
          </div>
          <div>
            <p className="font-mono-stat text-base font-bold text-white">{player.geek_tag}</p>
            <Link
              to="/players/$playerTag"
              params={{ playerTag: player.geek_tag }}
              onClick={onClose}
              className="text-xs text-primary hover:underline"
            >
              Ver perfil público →
            </Link>
          </div>
        </div>

        {/* Nav sections — misma fuente de verdad que PlayerSidebar */}
        <div className="flex-1 overflow-y-auto p-4">
          {playerNavSections(player.role, player.geek_tag).map((sec) => (
            <Section key={sec.title} title={sec.title}>
              {sec.items.map((item) => (
                <DrawerLink key={item.to} to={item.to} onClose={onClose}>
                  <span className="flex items-center gap-2.5 text-gray-400">{item.icon}</span>
                  {item.label}
                </DrawerLink>
              ))}
            </Section>
          ))}
        </div>

        {/* Logout */}
        <div className="border-t border-white/10 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {title}
      </p>
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

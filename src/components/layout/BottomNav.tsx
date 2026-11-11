import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  CalendarDays,
  Layers,
  LayoutDashboard,
  ListOrdered,
  LogIn,
  Store,
  TrendingUp,
  User,
} from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { ProfileDrawer } from "@/components/layout/ProfileDrawer";

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
};

const GUEST_ITEMS: NavItem[] = [
  { to: "/", label: "Ranking", icon: ListOrdered },
  { to: "/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/meta", label: "Meta", icon: TrendingUp },
  { to: "/stores", label: "Tiendas", icon: Store },
  { to: "/login", label: "Entrar", icon: LogIn },
];

const PLAYER_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/sessions", label: "Partidas", icon: Layers },
  { to: "/", label: "Ranking", icon: ListOrdered },
  { to: "/calendar", label: "Calendario", icon: CalendarDays },
  { to: "__profile__", label: "Menú", icon: User },
];

// Rutas que solo se alcanzan desde el drawer de perfil (no tienen tab propio)
const DRAWER_ONLY_ROUTES = ["/settings", "/stores", "/my-stats", "/meta", "/players"];

const PILL_TRANSITION = { type: "spring" as const, stiffness: 500, damping: 34 };

function NavPill() {
  return (
    <motion.span
      layoutId="bottom-nav-pill"
      transition={PILL_TRANSITION}
      className="absolute inset-x-1 inset-y-0.5 rounded-xl bg-primary/15"
    />
  );
}

function NavIcon({ isActive, children }: { isActive: boolean; children: React.ReactNode }) {
  return (
    <motion.span
      animate={{ scale: isActive ? 1.08 : 1 }}
      whileTap={{ scale: 0.82 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
      className={`relative z-10 flex items-center justify-center transition-colors ${
        isActive ? "text-primary" : "text-foreground-subtle"
      }`}
    >
      {children}
    </motion.span>
  );
}

function NavLabel({ isActive, children }: { isActive: boolean; children: React.ReactNode }) {
  // Siempre visible: los iconos solos no dicen a dónde lleva cada pestaña.
  return (
    <span
      className={`relative z-10 text-xs font-medium leading-none transition-colors duration-150 ${
        isActive ? "text-primary" : "text-foreground-subtle"
      }`}
    >
      {children}
    </span>
  );
}

function NavTab({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={isActive ? "page" : undefined}
      className="relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <AnimatePresence>{isActive && <NavPill />}</AnimatePresence>
      <NavIcon isActive={isActive}>
        <Icon size={22} />
      </NavIcon>
      <NavLabel isActive={isActive}>{item.label}</NavLabel>
    </Link>
  );
}

export function BottomNav() {
  const { player, probablyAuthed } = useNexusRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isStaffRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/organizer") ||
    pathname.startsWith("/tcg-manager");

  // Decide con probablyAuthed (síncrono) en vez de `loading` (espera el
  // fetch del perfil): evita que la nav aparezca de golpe tras el round-trip.
  if (isStaffRoute) return null;

  const items = probablyAuthed ? PLAYER_ITEMS : GUEST_ITEMS;
  const isProfileActive = drawerOpen || DRAWER_ONLY_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-border bg-card md:hidden" />
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2 md:hidden"
      >
        {items.map((item) => {
          if (item.to === "__profile__") {
            const initials = player?.geek_tag?.slice(0, 2).toUpperCase() ?? "NX";
            return (
              <button
                key="__profile__"
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={drawerOpen}
                aria-controls="profile-drawer"
                aria-current={isProfileActive ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <AnimatePresence>{isProfileActive && <NavPill />}</AnimatePresence>
                <NavIcon isActive={isProfileActive}>
                  {(player as any)?.avatar_url ? (
                    <motion.img
                      animate={{
                        boxShadow: isProfileActive
                          ? "0 0 0 2px rgba(50,217,255,0.7)"
                          : "0 0 0 1px rgba(42,58,87,1)",
                      }}
                      src={(player as any).avatar_url}
                      alt={player?.geek_tag ?? "avatar"}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <motion.span
                      animate={{
                        boxShadow: isProfileActive
                          ? "0 0 0 2px rgba(50,217,255,0.7)"
                          : "0 0 0 1px rgba(42,58,87,1)",
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary"
                    >
                      <span className="text-xs font-bold text-foreground">{initials}</span>
                    </motion.span>
                  )}
                </NavIcon>
                <NavLabel isActive={isProfileActive}>{item.label}</NavLabel>
              </button>
            );
          }
          const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return <NavTab key={item.to} item={item} isActive={isActive} />;
        })}
      </nav>
      {player && (
        <ProfileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          player={player as any}
        />
      )}
    </>
  );
}

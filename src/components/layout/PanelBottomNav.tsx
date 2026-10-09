import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";

export type PanelNavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  /** Acción principal (Subir): botón circular al centro. */
  primary?: boolean;
  badge?: number;
};

const isActivePath = (pathname: string, item: PanelNavItem) =>
  item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black";

// Navegación inferior de los paneles de staff por debajo de lg (1024px).
// La monta cada layout de panel con sus propios destinos, así que depende de
// la sección en la que estás y no del rol. "Más" abre el menú completo
// (el mismo PanelSidebar en modo cajón).
export function PanelBottomNav({
  items,
  moreOpen,
  onMore,
}: {
  items: PanelNavItem[];
  moreOpen: boolean;
  onMore: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // "Más" se marca activo cuando estás en una página que solo vive en el menú.
  const inMore = moreOpen || !items.some((i) => isActivePath(pathname, i));

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-white/10 bg-black/95 backdrop-blur-xl lg:hidden" />
      <nav
        aria-label="Navegación del panel"
        className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 lg:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item);
          const label = item.badge ? `${item.label}, ${item.badge} pendientes` : item.label;
          if (item.primary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={`relative -top-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95 ${focusRing}`}
              >
                <Icon size={20} aria-hidden />
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: !!item.exact, includeSearch: false }}
              aria-label={label}
              className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition active:scale-95 ${focusRing} ${
                active ? "text-primary" : "text-gray-400"
              }`}
            >
              <span className="relative">
                <Icon size={20} aria-hidden />
                {!!item.badge && (
                  <span
                    aria-hidden
                    className="absolute -right-2 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
              {active && (
                <span
                  aria-hidden
                  className="absolute bottom-0.5 h-0.5 w-6 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-label="Más opciones del menú"
          aria-expanded={moreOpen}
          className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition active:scale-95 ${focusRing} ${
            inMore ? "text-primary" : "text-gray-400"
          }`}
        >
          <Menu size={20} aria-hidden />
          <span>Más</span>
          {inMore && (
            <span aria-hidden className="absolute bottom-0.5 h-0.5 w-6 rounded-full bg-primary" />
          )}
        </button>
      </nav>
    </>
  );
}

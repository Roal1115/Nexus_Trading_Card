import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronsLeft, ChevronsRight, LogOut, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { nexus } from "@/integrations/nexus/client";
import { toast } from "sonner";
import { NotificationBadge } from "@/components/ui/NotificationBadge";

export type SidebarItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  external?: boolean;
  badge?: number;
};

export type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

export function PanelSidebar({
  title,
  subtitle,
  items,
  sections,
  userLabel,
  mobileOpen = false,
  onMobileClose,
  collapsible = false,
  topSlot,
}: {
  title: string;
  subtitle: string;
  items?: SidebarItem[];
  sections?: SidebarSection[];
  userLabel: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsible?: boolean;
  topSlot?: (collapsed: boolean) => React.ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  // localStorage solo en cliente (SSR-safe)
  useEffect(() => {
    if (collapsible) setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, [collapsible]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  };

  const closeMobile = () => {
    onMobileClose?.();
  };

  const logout = async () => {
    closeMobile();
    await nexus.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/login" });
  };

  const renderItem = (item: SidebarItem) => {
    const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
    const cls = `flex items-center gap-2.5 overflow-hidden rounded-md px-3 py-2 text-sm transition ${
      active ? "bg-primary/15 text-primary" : "text-gray-300 hover:bg-white/5 hover:text-white"
    }`;
    const title = collapsed ? item.label : undefined;
    const content = (
      <>
        <span className="shrink-0">{item.icon}</span>
        <span
          className={`whitespace-nowrap transition-opacity duration-200 ${
            collapsed ? "w-0 opacity-0" : "flex-1 opacity-100"
          }`}
        >
          {item.label}
        </span>
        {!collapsed && <NotificationBadge count={item.badge ?? 0} />}
      </>
    );
    if (item.external) {
      return (
        <a key={item.to} href={item.to} className={cls} title={title} onClick={closeMobile}>
          {content}
        </a>
      );
    }
    return (
      <Link key={item.to} to={item.to} className={cls} title={title} onClick={closeMobile}>
        {content}
      </Link>
    );
  };

  const resolvedSections: SidebarSection[] = sections ?? (items ? [{ title, items }] : []);

  return (
    <>
      {/* Overlay en mobile */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={closeMobile} aria-hidden />}

      {/* Espaciador: reserva el ancho del sidebar en el layout del padre
          SOLO mientras el <aside> está en position:fixed durante un
          scroll-lock de Radix (ver styles.css, body[data-scroll-locked]) —
          ahí el aside sale del flujo normal y sin esto su contenedor
          colapsaría (bug real, reportado por el usuario, medido con
          Playwright). Ancho 0 en cualquier otro momento — el propio
          <aside> (position:sticky fuera de un lock) ya reserva su espacio
          en el flujo normal, así que un espaciador con ancho fijo aquí
          duplicaría ese espacio. Esa duplicación es justo el segundo bug
          real que este comentario reemplaza: en un padre `flex` (paneles
          de staff, a diferencia del padre `block` de PlayerSidebar) los
          dos hermanos se acomodaban lado a lado en vez de superponerse,
          empujando el sidebar completo ~256px a la derecha — el ancho de
          un espaciador width:0 nunca puede duplicar nada, sin importar si
          el padre es flex o block. Ver .panel-sidebar-spacer en
          styles.css. */}
      <div
        aria-hidden
        className="panel-sidebar-spacer hidden md:block shrink-0"
        style={{ "--panel-sidebar-w": collapsed ? "4.5rem" : "16rem" } as React.CSSProperties}
      />

      <aside
        className={`panel-sidebar glass fixed inset-y-0 left-0 z-50 flex ${collapsed ? "w-[4.5rem]" : "w-64"} shrink-0 flex-col rounded-none border-r border-white/10 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] transition-[width,transform] duration-200 ease-in-out sm:pb-4 md:sticky md:top-0 md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ height: "100dvh" }}
      >
        {/* Botón cerrar en mobile */}
        <button
          onClick={closeMobile}
          className="absolute right-3 top-3 text-gray-400 transition hover:text-white md:hidden"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>

        <Link to="/" className="mb-6 flex h-9 items-center gap-2 overflow-hidden px-2" onClick={closeMobile}>
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary">
            <Trophy size={16} />
          </span>
          <div
            className={`whitespace-nowrap transition-opacity duration-200 ${
              collapsed ? "w-0 opacity-0" : "opacity-100"
            }`}
          >
            <div className="text-sm font-bold text-white">Nexus</div>
            <div className="text-[10px] uppercase tracking-widest text-primary">{subtitle}</div>
          </div>
        </Link>

        {collapsible && (
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className="absolute -right-3 top-7 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#0B1220] text-gray-400 transition hover:border-primary/40 hover:text-primary md:flex"
          >
            {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        )}

        {topSlot?.(collapsed)}

        <nav className="flex flex-col gap-4 flex-1 overflow-y-auto min-h-0 py-1">
          {resolvedSections.map((sec) => (
            <div key={sec.title}>
              <div
                className={`mb-2 overflow-hidden whitespace-nowrap px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 transition-opacity duration-200 ${
                  collapsed ? "opacity-0" : "opacity-100"
                }`}
              >
                {sec.title}
              </div>
              <div className="flex flex-col gap-1">{sec.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>

        <div className="flex-shrink-0 space-y-2 border-t border-white/10 pt-4 mt-2">
          <div
            className={`overflow-hidden whitespace-nowrap px-2 text-xs text-gray-400 transition-opacity duration-200 ${
              collapsed ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="text-[10px] uppercase tracking-widest text-gray-500">Sesión</div>
            <div className="truncate text-white">{userLabel}</div>
          </div>
          <button
            onClick={logout}
            title={collapsed ? "Cerrar sesión" : undefined}
            className="flex w-full items-center gap-2 overflow-hidden rounded-md border border-white/10 px-3 py-2 text-xs text-gray-300 transition hover:border-primary/40 hover:text-primary"
          >
            <span className="shrink-0">
              <LogOut size={12} />
            </span>
            <span
              className={`whitespace-nowrap transition-opacity duration-200 ${
                collapsed ? "w-0 opacity-0" : "opacity-100"
              }`}
            >
              Cerrar sesión
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

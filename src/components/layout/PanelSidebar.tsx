import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Trophy, X } from "lucide-react";
import { geekarena } from "@/integrations/geekarena/client";
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
}: {
  title: string;
  subtitle: string;
  items?: SidebarItem[];
  sections?: SidebarSection[];
  userLabel: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const closeMobile = () => {
    onMobileClose?.();
  };

  const logout = async () => {
    closeMobile();
    await geekarena.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/login" });
  };

  const renderItem = (item: SidebarItem) => {
    const active = item.exact
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(item.to + "/");
    const cls = `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
      active
        ? "bg-primary/15 text-primary"
        : "text-gray-300 hover:bg-white/5 hover:text-white"
    }`;
    if (item.external) {
      return (
        <a key={item.to} href={item.to} className={cls} onClick={closeMobile}>
          {item.icon}
          <span className="flex-1">{item.label}</span>
          <NotificationBadge count={item.badge ?? 0} />
        </a>
      );
    }
    return (
      <Link key={item.to} to={item.to} className={cls} onClick={closeMobile}>
        {item.icon}
        <span className="flex-1">{item.label}</span>
        <NotificationBadge count={item.badge ?? 0} />
      </Link>
    );
  };

  const resolvedSections: SidebarSection[] =
    sections ?? (items ? [{ title, items }] : []);

  return (
    <>
      {/* Overlay en mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      <aside
        className={`glass fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col rounded-none border-r border-white/10 p-4 transition-transform duration-200 ease-in-out md:sticky md:top-0 md:z-auto md:translate-x-0 ${
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

        <Link
          to="/"
          className="mb-6 flex items-center gap-2 px-2"
          onClick={closeMobile}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/20 text-primary">
            <Trophy size={16} />
          </span>
          <div>
            <div className="text-sm font-bold text-white">Geek Arena</div>
            <div className="text-[10px] uppercase tracking-widest text-primary">
              {subtitle}
            </div>
          </div>
        </Link>

        <nav className="flex flex-col gap-4 flex-1 overflow-y-auto min-h-0 py-1">
          {resolvedSections.map((sec) => (
            <div key={sec.title}>
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                {sec.title}
              </div>
              <div className="flex flex-col gap-1">{sec.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>

        <div className="flex-shrink-0 space-y-2 border-t border-white/10 pt-4 mt-2">
          <div className="px-2 text-xs text-gray-400">
            <div className="text-[10px] uppercase tracking-widest text-gray-500">
              Sesión
            </div>
            <div className="truncate text-white">{userLabel}</div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-gray-300 transition hover:border-primary/40 hover:text-primary"
          >
            <LogOut size={12} /> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

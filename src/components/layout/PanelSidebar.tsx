import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Trophy } from "lucide-react";
import { geekarena } from "@/integrations/geekarena/client";
import { toast } from "sonner";

export type SidebarItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  external?: boolean;
};

export function PanelSidebar({
  title,
  subtitle,
  items,
  userLabel,
}: {
  title: string;
  subtitle: string;
  items: SidebarItem[];
  userLabel: string;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const logout = async () => {
    await geekarena.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/login" });
  };

  return (
    <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col rounded-none border-r border-white/10 p-4 md:flex">
      <Link to="/" className="mb-6 flex items-center gap-2 px-2">
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

      <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
        {title}
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
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
              <a key={item.to} href={item.to} className={cls}>
                {item.icon} {item.label}
              </a>
            );
          }
          return (
            <Link key={item.to} to={item.to} className={cls}>
              {item.icon} {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
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
  );
}

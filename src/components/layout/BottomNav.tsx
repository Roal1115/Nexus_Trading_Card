import { Link, useRouterState } from "@tanstack/react-router";
import { useRef, useEffect, useState } from "react";
import { Trophy, LayoutDashboard, TrendingUp, CalendarDays, User, LogIn } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { ProfileDrawer } from "@/components/layout/ProfileDrawer";

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  isCta?: boolean;
};

const GUEST_ITEMS: NavItem[] = [
  { to: "/", label: "Ranking", icon: Trophy },
  { to: "/login", label: "Entrar", icon: LogIn },
];

const PLAYER_ITEMS: NavItem[] = [
  { to: "/", label: "Ranking", icon: Trophy },
  { to: "/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard, isCta: true },
  { to: "/meta", label: "Meta", icon: TrendingUp },
  { to: "__profile__", label: "Menú", icon: User },
];

function NavTab({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [lineWidth, setLineWidth] = useState(0);
  const Icon = item.icon;

  useEffect(() => {
    if (isActive && textRef.current) {
      setLineWidth(textRef.current.offsetWidth);
    } else {
      setLineWidth(0);
    }
  }, [isActive]);

  if (item.isCta) {
    return (
      <Link
        to={item.to}
        className="flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95"
      >
        <span className="mr-1.5">
          <Icon size={16} />
        </span>
        <span ref={textRef}>{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      to={item.to}
      className="relative flex flex-1 flex-col items-center justify-center px-1 py-2.5 text-xs font-medium transition-all active:scale-95 active:bg-white/5 rounded-lg"
    >
      <span className={isActive ? "text-primary" : "text-gray-400"}>
        <Icon size={20} />
      </span>
      <span ref={textRef} className={isActive ? "text-primary" : "text-gray-400"}>
        {item.label}
      </span>
      {isActive && (
        <span
          className="absolute bottom-1 h-0.5 rounded-full bg-primary transition-all"
          style={{ width: lineWidth }}
        />
      )}
    </Link>
  );
}

export function BottomNav() {
  const { player, loading } = useGeekarenaRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isStaffRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/organizer") ||
    pathname.startsWith("/tcg-manager");

  if (isStaffRoute || loading) return null;

  const items = player ? PLAYER_ITEMS : GUEST_ITEMS;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 h-[calc(4rem+env(safe-area-inset-bottom))] bg-black/90 backdrop-blur-xl border-t border-white/10 lg:hidden" />
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
        {items.map((item) => {
          if (item.to === "__profile__") {
            const initials = player?.geek_tag?.slice(0, 2).toUpperCase() ?? "GA";
            return (
              <button
                key="__profile__"
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-xs font-medium transition-all active:scale-95 rounded-lg"
              >
                {(player as any)?.avatar_url ? (
                  <img
                    src={(player as any).avatar_url}
                    alt={player?.geek_tag ?? "avatar"}
                    className="h-6 w-6 rounded-full border border-[#2A3A57] object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#2A3A57] bg-[#111A2E]">
                    <span className="text-[9px] font-bold text-[#32D9FF]">{initials}</span>
                  </span>
                )}
                <span className="text-gray-400">{item.label}</span>
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

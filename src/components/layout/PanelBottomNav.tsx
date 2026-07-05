import { Link, useRouterState } from "@tanstack/react-router";
import { useRef, useEffect, useState } from "react";
import { BarChart3, Trophy, Upload, CalendarDays, Store, Users } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  isUpload?: boolean;
};

const ORGANIZER_ITEMS: NavItem[] = [
  { to: "/organizer/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/organizer/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/organizer/upload", label: "Subir", icon: Upload, isUpload: true },
  { to: "/organizer/appeals", label: "Apelar", icon: Trophy },
  { to: "/organizer/store", label: "Mi Tienda", icon: Store },
];

const MANAGER_ITEMS: NavItem[] = [
  { to: "/tcg-manager/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/tcg-manager/tournaments", label: "Torneos", icon: Trophy },
  { to: "/tcg-manager/upload", label: "Subir", icon: Upload, isUpload: true },
  { to: "/tcg-manager/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/tcg-manager/stores", label: "Tiendas", icon: Store },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: "/admin/activity", label: "Analytics", icon: BarChart3 },
  { to: "/admin/approved", label: "Torneos", icon: Trophy },
  { to: "/admin/publish", label: "Subir", icon: Upload, isUpload: true },
  { to: "/admin/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/admin/stores", label: "Tiendas", icon: Users },
];

function NavTab({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const textRef = useRef(null);
  const [lineWidth, setLineWidth] = useState(0);
  const Icon = item.icon;

  useEffect(() => {
    if (isActive && textRef.current) {
      setLineWidth(textRef.current.offsetWidth);
    } else {
      setLineWidth(0);
    }
  }, [isActive]);

  if (item.isUpload) {
    return (
      <Link
        to={item.to}
        className="relative -top-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95"
      >
        <span className="mr-1.5">
          <Icon size={18} />
        </span>
        <span ref={textRef}>
          {item.label}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to={item.to}
      className="relative flex flex-col items-center justify-center px-2 py-2 text-[10px] font-medium transition-colors"
    >
      <span className={isActive ? "text-primary" : "text-gray-400"}>
        <Icon size={18} />
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

export function PanelBottomNav() {
  const { role } = useGeekarenaRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items =
    role === "admin" ? ADMIN_ITEMS
    : role === "tcg_manager" ? MANAGER_ITEMS
    : role === "organizer" ? ORGANIZER_ITEMS
    : null;

  if (!items) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 h-[calc(4rem+env(safe-area-inset-bottom))] bg-black/95 backdrop-blur-xl border-t border-white/10 sm:hidden" />
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around pb-[env(safe-area-inset-bottom)] pt-2 sm:hidden">
        {items.map((item) => {
          const isActive = pathname === item.to || pathname.startsWith(item.to + "/");
          return <NavTab key={item.to} item={item} isActive={isActive} />;
        })}
      </nav>
    </>
  );
}

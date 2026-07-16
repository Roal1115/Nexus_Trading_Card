import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Settings,
  Shield,
  Store,
  Swords,
  TrendingUp,
  Trophy,
  UserCircle,
} from "lucide-react";
import type { SidebarSection } from "@/components/layout/PanelSidebar";

// Única fuente de verdad de la navegación del jugador.
// La consumen PlayerSidebar (desktop) y ProfileDrawer (mobile).
export function playerNavSections(role: string, geekTag?: string): SidebarSection[] {
  const sections: SidebarSection[] = [];

  if (["organizer", "tcg_manager", "admin"].includes(role)) {
    const staff =
      role === "admin"
        ? { to: "/admin", label: "Panel Admin" }
        : role === "tcg_manager"
          ? { to: "/tcg-manager", label: "Panel Manager" }
          : { to: "/organizer", label: "Panel Organizador" };
    sections.push({
      title: "Administración",
      items: [{ ...staff, icon: <Shield size={16} /> }],
    });
  }

  sections.push(
    {
      title: "Explorar",
      items: [
        { to: "/", label: "Ranking", icon: <Trophy size={16} />, exact: true },
        { to: "/calendar", label: "Calendario", icon: <CalendarDays size={16} /> },
        { to: "/meta", label: "Meta", icon: <TrendingUp size={16} /> },
        { to: "/stores", label: "Tiendas", icon: <Store size={16} /> },
      ],
    },
    {
      title: "Mi Carrera",
      items: [
        { to: "/dashboard", label: "Mi Panel", icon: <LayoutDashboard size={16} /> },
        { to: "/my-stats", label: "Mis Stats", icon: <BarChart3 size={16} /> },
        { to: "/sessions", label: "Sesiones", icon: <Swords size={16} /> },
      ],
    },
    {
      title: "Cuenta",
      items: [
        ...(geekTag
          ? [{ to: `/players/${geekTag}`, label: "Mi Perfil", icon: <UserCircle size={16} /> }]
          : []),
        { to: "/settings", label: "Configuración", icon: <Settings size={16} /> },
      ],
    },
  );

  return sections;
}

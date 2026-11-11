import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  Layers,
  LayoutDashboard,
  ListOrdered,
  Medal,
  Settings,
  Shield,
  Store,
  TrendingUp,
  UserCircle,
} from "lucide-react";
import type { SidebarSection } from "@/components/layout/PanelSidebar";

// Única fuente de verdad de la navegación del jugador.
// La consumen PlayerSidebar (desktop) y ProfileDrawer (mobile).
// Orden: primero lo del jugador, luego el circuito, al final cuenta/ayuda.
// Cada destino tiene un ícono único (el trofeo es la marca, no Ranking).
export function playerNavSections(role: string, nexusTag?: string): SidebarSection[] {
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
      title: "Mi carrera",
      items: [
        { to: "/dashboard", label: "Inicio", icon: <LayoutDashboard size={16} /> },
        { to: "/sessions", label: "Mis partidas", icon: <Layers size={16} /> },
        { to: "/my-stats", label: "Mis stats", icon: <BarChart3 size={16} /> },
        ...(nexusTag
          ? [{ to: `/players/${nexusTag}`, label: "Mi perfil", icon: <UserCircle size={16} /> }]
          : []),
      ],
    },
    {
      title: "Circuito",
      items: [
        { to: "/", label: "Ranking", icon: <ListOrdered size={16} />, exact: true },
        { to: "/calendar", label: "Calendario", icon: <CalendarDays size={16} /> },
        { to: "/playoffs", label: "Playoffs", icon: <Medal size={16} /> },
        { to: "/stores", label: "Tiendas", icon: <Store size={16} /> },
        { to: "/meta", label: "Meta", icon: <TrendingUp size={16} /> },
      ],
    },
    {
      title: "Cuenta",
      items: [
        { to: "/settings", label: "Configuración", icon: <Settings size={16} /> },
        { to: "/faq", label: "Ayuda", icon: <CircleHelp size={16} /> },
      ],
    },
  );

  return sections;
}

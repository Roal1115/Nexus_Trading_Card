import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Shield, Trophy, Upload, User } from "lucide-react";
import { useGeekarenaRole, homeRouteForRole } from "@/hooks/use-geekarena-role";
import { geekarena } from "@/integrations/geekarena/client";

export function AppHeader() {
  const navigate = useNavigate();
  const { role: effectiveRole, player } = useGeekarenaRole();

  const panelRoute = homeRouteForRole(effectiveRole) || "/dashboard";
  const geekTag = player?.geek_tag ?? null;

  const handleLogout = async () => {
    await geekarena.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/20 text-primary">
            <Trophy size={16} />
          </span>
          <span className="text-white">Geek</span>
          <span className="text-primary">Collector</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          <NavItem to="/" icon={<Trophy size={14} />} label="Ranking" />
          {player && effectiveRole && (
            <NavItem to={panelRoute} icon={<User size={14} />} label="Mi Panel" />
          )}
          {effectiveRole === "organizer" && <NavItem to="/organizer/new" icon={<Upload size={14} />} label="Subir Resultados" />}
          {effectiveRole === "admin" && <NavItem to="/admin" icon={<Shield size={14} />} label="Moderación" />}
        </nav>

        <div className="flex items-center gap-3">
          {player ? (
            <>
              <div className="hidden text-right sm:block">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Geek Tag</div>
                <div className="font-mono-stat text-sm text-primary">{geekTag}</div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:border-primary/50 hover:text-primary"
              >
                <LogOut size={12} /> Cerrar Sesión
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:brightness-110"
            >
              Iniciar Sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "text-primary bg-primary/10" }}
      inactiveProps={{ className: "text-gray-400 hover:text-white" }}
      activeOptions={{ exact: true }}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium uppercase tracking-wider transition"
    >
      {icon} {label}
    </Link>
  );
}

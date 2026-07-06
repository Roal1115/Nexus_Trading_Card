import { Link, useNavigate } from "@tanstack/react-router";
import { Layers, LogOut, Menu, Shield, Store, Trophy, User, X } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { geekarena } from "@/integrations/geekarena/client";
import { Settings } from "lucide-react";

export function AppHeader() {
  const navigate = useNavigate();
  const { role, player } = useGeekarenaRole();
  const geekTag = player?.geek_tag ?? null;
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await geekarena.auth.signOut();
    navigate({ to: "/login" });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const header = document.querySelector("header");
      if (header && !header.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl relative">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <button
          className="lg:hidden text-gray-400 hover:text-white transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-xl font-bold tracking-tight"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/20 text-primary">
            <Trophy size={16} />
          </span>
          <span className="text-white">Trading Card</span>
          <span className="text-primary">Nexus</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm lg:flex">
          <NavItem to="/" icon={<Trophy size={14} />} label="Ranking" />
          <NavItem to="/stores" icon={<Store size={14} />} label="Tiendas" />
          {role === "player" && (
            <NavItem to="/dashboard" icon={<User size={14} />} label="Mi Panel" />
          )}
          {player && <NavItem to="/meta" icon={<Layers size={14} />} label="Meta" />}
          {role === "organizer" && (
            <NavItem to="/organizer" icon={<Shield size={14} />} label="Moderación" />
          )}
          {role === "tcg_manager" && (
            <NavItem to="/tcg-manager" icon={<Shield size={14} />} label="Moderación" />
          )}
          {role === "admin" && (
            <NavItem to="/admin" icon={<Shield size={14} />} label="Moderación" />
          )}
          {player && <NavItem to="/settings" icon={<Settings size={14} />} label="Configuración" />}
        </nav>

        <div className="flex items-center gap-3">
          {player ? (
            <>
              <div className="hidden text-right lg:block">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Geek Tag
                </div>
                <div className="font-mono-stat text-sm text-primary">{geekTag}</div>
              </div>
              <button
                onClick={handleLogout}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:border-primary/50 hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <LogOut size={12} /> Cerrar Sesión
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="hidden lg:flex rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:brightness-110"
            >
              Iniciar Sesión
            </Link>
          )}
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="lg:hidden absolute top-16 left-0 right-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-xl"
          >
            <nav className="flex flex-col px-4 py-3 gap-1">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                activeProps={{
                  className:
                    "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-primary bg-primary/10 transition",
                }}
                inactiveProps={{
                  className:
                    "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition",
                }}
                activeOptions={{ exact: true }}
              >
                <Trophy size={16} />
                Ranking
              </Link>

              {role === "player" && (
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  activeProps={{
                    className:
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-primary bg-primary/10 transition",
                  }}
                  inactiveProps={{
                    className:
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition",
                  }}
                  activeOptions={{ exact: true }}
                >
                  <User size={16} />
                  Mi Panel
                </Link>
              )}

              {player && (
                <Link
                  to="/meta"
                  onClick={() => setMenuOpen(false)}
                  activeProps={{
                    className:
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-primary bg-primary/10 transition",
                  }}
                  inactiveProps={{
                    className:
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition",
                  }}
                  activeOptions={{ exact: true }}
                >
                  <Layers size={16} />
                  Sesiones
                </Link>
              )}

              <Link
                to="/stores"
                onClick={() => setMenuOpen(false)}
                activeProps={{
                  className:
                    "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-primary bg-primary/10 transition",
                }}
                inactiveProps={{
                  className:
                    "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition",
                }}
              >
                <Store size={16} />
                Tiendas
              </Link>

              {player && (
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  activeProps={{
                    className:
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-primary bg-primary/10 transition",
                  }}
                  inactiveProps={{
                    className:
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition",
                  }}
                  activeOptions={{ exact: true }}
                >
                  <Settings size={16} />
                  Configuración
                </Link>
              )}

              {(role === "organizer" || role === "admin" || role === "tcg_manager") && (
                <Link
                  to={
                    role === "admin"
                      ? "/admin"
                      : role === "tcg_manager"
                        ? "/tcg-manager"
                        : "/organizer"
                  }
                  onClick={() => setMenuOpen(false)}
                  activeProps={{
                    className:
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-primary bg-primary/10 transition",
                  }}
                  inactiveProps={{
                    className:
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition",
                  }}
                >
                  <Shield size={16} />
                  Moderación
                </Link>
              )}

              <div className="border-t border-white/10 my-1" />

              {player ? (
                <>
                  <div className="px-3 py-2">
                    <p className="text-xs uppercase tracking-widest text-gray-500">Geek Tag</p>
                    <p className="text-sm font-bold text-primary mt-0.5">{geekTag}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-white/5 transition w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                  >
                    <LogOut size={16} />
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium text-primary hover:bg-white/5 transition whitespace-nowrap"
                >
                  Iniciar Sesión
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
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
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {icon} {label}
    </Link>
  );
}

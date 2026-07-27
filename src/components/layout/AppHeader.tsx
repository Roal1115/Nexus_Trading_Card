import { Link, useRouterState } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { useTCG } from "@/context/tcg.context";
import { nexus } from "@/integrations/nexus/client";
import { ProfileDrawer } from "@/components/layout/ProfileDrawer";
import { TcgSwitcher } from "@/components/layout/TcgSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";

export function AppHeader() {
  const { player, loading } = useNexusRole();
  const { setTcgs } = useTCG();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isStaffRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/organizer") ||
    pathname.startsWith("/tcg-manager");

  useEffect(() => {
    nexus
      .from("games")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data?.length) setTcgs(data as { id: string; name: string; slug: string }[]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isStaffRoute) return null;

  return (
    <>
      {/* En lg+ el jugador logueado navega por el sidebar: el header desaparece completo */}
      <header
        className={`sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl ${
          player ? "lg:hidden" : ""
        }`}
      >
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-3 items-center px-4 sm:px-6">
          {/* LEFT — Logo */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/20 text-primary">
                <Trophy size={16} />
              </span>
              <span className="hidden sm:inline text-white">Trading Card</span>
              <span className="hidden sm:inline text-primary">Nexus</span>
            </Link>
          </div>

          {/* CENTER — TCG Switcher */}
          <div className="flex justify-center">
            <TcgSwitcher />
          </div>

          {/* RIGHT — Avatar / Login */}
          <div className="flex items-center justify-end">
            {!loading && player ? (
              <AvatarButton player={player} onClick={() => setDrawerOpen(true)} />
            ) : !loading ? (
              <Link
                to="/login"
                className="hidden sm:inline-flex rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:brightness-110"
              >
                Iniciar sesión
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {player && (
        <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} player={player as any} />
      )}
    </>
  );
}

function AvatarButton({
  player,
  onClick,
}: {
  player: {
    id: string;
    geek_tag: string;
    avatar_url?: string | null;
    role: string;
  };
  onClick: () => void;
}) {
  const initials = player.geek_tag?.slice(0, 2).toUpperCase() ?? "GA";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir menú de perfil"
      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#2A3A57] bg-[#111A2E] transition hover:border-[#32D9FF]/40"
    >
      {player.avatar_url ? (
        <img src={player.avatar_url} alt={player.geek_tag} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-bold text-[#32D9FF]">{initials}</span>
      )}
    </button>
  );
}

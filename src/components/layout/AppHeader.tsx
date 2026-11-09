import { Link, useRouterState } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { useTCG } from "@/context/tcg.context";
import { nexus } from "@/integrations/nexus/client";
import { ProfileDrawer } from "@/components/layout/ProfileDrawer";
import { NotificationBell } from "@/components/layout/NotificationBell";

const GUEST_LINKS = [
  { to: "/", label: "Ranking" },
  { to: "/calendar", label: "Calendario" },
  { to: "/playoffs", label: "Playoffs" },
  { to: "/meta", label: "Meta" },
  { to: "/stores", label: "Tiendas" },
  { to: "/faq", label: "FAQ" },
];

export function AppHeader() {
  const { player, loading, probablyAuthed } = useNexusRole();
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
      // Temporada 1: solo One Piece. Calendario y Meta siguen a este juego.
      .eq("slug", "one-piece")
      .order("name")
      .then(({ data }) => {
        if (data?.length) setTcgs(data as { id: string; name: string; slug: string }[]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isStaffRoute) return null;

  return (
    <>
      {/* En lg+ el jugador logueado navega por el sidebar: el header desaparece completo.
          Se decide con probablyAuthed (no con `player`) para no mostrar el header de invitado
          en desktop una fracción de segundo antes de que el sidebar aparezca. */}
      <header
        className={`sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl ${
          probablyAuthed ? "md:hidden" : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* LEFT — Logo y, sin sesión, las secciones públicas */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 whitespace-nowrap font-display text-lg font-bold tracking-tight"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/20 text-primary">
                <Trophy size={16} />
              </span>
              <span className="hidden sm:inline text-white">Trading Card</span>
              <span className="hidden sm:inline text-primary">Nexus</span>
            </Link>
            {!probablyAuthed && (
              <nav aria-label="Secciones" className="hidden items-center gap-4 md:flex">
                {GUEST_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    activeOptions={{ exact: l.to === "/" }}
                    activeProps={{ className: "text-white" }}
                    inactiveProps={{ className: "text-gray-400" }}
                    className="text-sm font-medium transition hover:text-white"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* RIGHT — Avatar / Login */}
          <div className="flex items-center justify-end gap-2">
            {!loading && player ? (
              <>
                <NotificationBell />
                <AvatarButton player={player} onClick={() => setDrawerOpen(true)} />
              </>
            ) : !loading && !probablyAuthed ? (
              <>
                <Link
                  to="/login"
                  className="hidden px-2 py-2 text-xs font-semibold uppercase tracking-wider text-gray-300 transition hover:text-white sm:inline-flex"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:brightness-110"
                >
                  Crear cuenta
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

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
      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-card transition hover:border-primary/40"
    >
      {player.avatar_url ? (
        <img src={player.avatar_url} alt={player.geek_tag} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-bold text-primary">{initials}</span>
      )}
    </button>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { useTCG } from "@/context/tcg.context";
import { geekarena } from "@/integrations/geekarena/client";
import { ProfileDrawer } from "@/components/layout/ProfileDrawer";

export function AppHeader() {
  const { player, loading } = useGeekarenaRole();
  const { activeTcg, setActiveTcg, tcgs, setTcgs } = useTCG();
  const [tcgOpen, setTcgOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tcgRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isStaffRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/organizer") ||
    pathname.startsWith("/tcg-manager");

  useEffect(() => {
    geekarena
      .from("games")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data?.length) setTcgs(data as { id: string; name: string; slug: string }[]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tcgOpen) return;
    const handler = (e: MouseEvent) => {
      if (tcgRef.current && !tcgRef.current.contains(e.target as Node)) {
        setTcgOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tcgOpen]);

  if (isStaffRoute) return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl">
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
            {tcgs.length > 0 && (
              <div className="relative" ref={tcgRef}>
                <button
                  type="button"
                  onClick={() => setTcgOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#2A3A57] bg-[#111A2E] px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#32D9FF]/40"
                >
                  {activeTcg?.name ?? "TCG"}
                  <ChevronDown
                    size={14}
                    className={tcgOpen ? "rotate-180 transition" : "transition"}
                  />
                </button>

                {tcgOpen && (
                  <div className="absolute left-1/2 top-full mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#0B1220]/95 shadow-2xl backdrop-blur-xl z-50">
                    {tcgs.map((tcg) => (
                      <button
                        key={tcg.id}
                        type="button"
                        onClick={() => {
                          setActiveTcg(tcg);
                          setTcgOpen(false);
                        }}
                        className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition hover:bg-white/5 ${
                          activeTcg?.id === tcg.id ? "text-[#32D9FF] font-semibold" : "text-white"
                        }`}
                      >
                        {tcg.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
        <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} player={player} />
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

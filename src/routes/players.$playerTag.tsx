import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Lock, Trophy } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { getPublicProfile } from "@/lib/geekarena-player.functions";

export const Route = createFileRoute("/players/$playerTag")({
  head: () => ({ meta: [{ title: "Perfil de Jugador — Geek Arena" }] }),
  component: PublicProfilePage,
});

type ProfileData = Awaited<ReturnType<typeof getPublicProfile>>;

function PublicProfilePage() {
  const { playerTag } = Route.useParams();
  const { player: viewer, loading: authLoading } = useGeekarenaRole();
  const fetchProfile = useServerFn(getPublicProfile);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!viewer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    fetchProfile({ data: { player_tag: playerTag } })
      .then((p) => setProfile(p))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerTag, viewer?.id, authLoading]);

  if (!authLoading && !viewer) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <Lock className="mb-4 text-primary" size={40} />
        <h2 className="text-2xl font-bold text-white">Contenido restringido</h2>
        <p className="mt-2 text-sm text-gray-400">
          Si deseas ver esta información, debes iniciar sesión o crear una cuenta.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/signup"
            className="rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white"
          >
            Crear cuenta
          </Link>
        </div>
      </main>
    );
  }

  if (loading || authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-gray-500">
        Cargando perfil…
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Jugador no encontrado</h2>
        <p className="mt-2 text-sm text-gray-400">
          No existe un jugador con ese Player Tag.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white"
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (profile.is_private) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <Lock className="mb-4 text-gray-500" size={40} />
        <h2 className="text-2xl font-bold text-white">Perfil privado</h2>
        <p className="mt-2 text-sm text-gray-400">
          El perfil de{" "}
          <span className="font-semibold text-primary">@{profile.geek_tag}</span>{" "}
          es privado.
        </p>
        <Link
          to="/"
          className="mt-6 rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white"
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
      {/* Hero */}
      <section className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/60 via-primary/10 to-black/40 p-6 sm:p-10">
        <div className="absolute -right-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.geek_tag}
              className="h-20 w-20 flex-shrink-0 rounded-full border-2 border-primary/40 object-cover sm:h-24 sm:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-black/40 text-3xl font-bold text-primary sm:h-24 sm:w-24">
              {profile.geek_tag.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Player Tag
            </p>
            <h1 className="mt-1 break-all text-4xl font-bold text-white sm:text-5xl">
              {profile.geek_tag}
            </h1>
            {profile.store_city && (
              <p className="mt-1 text-sm text-gray-400">{profile.store_city}</p>
            )}
            {profile.member_since && (
              <p className="mt-2 text-xs text-gray-500">
                Miembro desde{" "}
                {new Date(profile.member_since).toLocaleDateString("es-MX", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Rankings */}
      {profile.rankings.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-white">Rankings actuales</h2>
          <div className="flex flex-wrap gap-4">
            {profile.rankings.map((r: any) => (
              <div
                key={r.game_id}
                className="glass flex w-full flex-col gap-3 rounded-2xl border border-white/10 p-5 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
              >
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white">
                  <Crown size={14} className="text-primary" /> {r.game_name}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-500">
                      <Crown size={10} /> Rank
                    </p>
                    <p className="mt-1 font-mono-stat text-3xl font-bold text-white">
                      {r.rank_position > 0 ? `#${r.rank_position}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">
                      Puntos
                    </p>
                    <p className="mt-1 font-mono-stat text-3xl font-bold text-white">
                      {Number(r.total_points).toFixed(0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{r.tournaments_played} jugados</span>
                  <span>·</span>
                  <span>{r.tournaments_won} ganados</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Torneos recientes */}
      {profile.recent_tournaments.length > 0 && (
        <section className="glass mt-6 overflow-hidden rounded-2xl">
          <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <Trophy className="text-primary" size={18} />
            <h2 className="text-lg font-semibold text-white">Torneos recientes</h2>
          </header>
          <div className="divide-y divide-white/5">
            {profile.recent_tournaments.map((t: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`font-mono-stat text-sm font-semibold ${
                      t.rank <= 3 ? "text-primary" : "text-white"
                    }`}
                  >
                    #{t.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.game_name}</p>
                    <p className="text-xs text-gray-500">
                      {t.date
                        ? new Date(t.date + "T12:00:00").toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
                <span className="font-mono-stat text-sm font-semibold text-white">
                  +{Number(t.points).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

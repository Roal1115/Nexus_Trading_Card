import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Lock, Share2, Target, TrendingUp } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { getPublicProfile } from "@/lib/geekarena-player.functions";
import { getActiveSponsor, registerAdView } from "@/lib/geekarena-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";

export const Route = createFileRoute("/players/$playerTag")({
  head: ({ params }) => ({
    meta: [{ title: `Perfil de ${params.playerTag} — Geek Arena` }],
    links: [
      { rel: "canonical", href: `https://mxntcg.lovable.app/players/${params.playerTag}` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          mainEntity: {
            "@type": "Person",
            identifier: params.playerTag,
            alternateName: params.playerTag,
            url: `https://mxntcg.lovable.app/players/${params.playerTag}`,
          },
        }),
      },
    ],
  }),
  component: PublicProfilePage,
});

type ProfileData = Awaited<ReturnType<typeof getPublicProfile>>;

function PublicProfilePage() {
  const { playerTag } = Route.useParams();
  const { player: viewer, loading: authLoading } = useGeekarenaRole();
  const fetchProfile = useServerFn(getPublicProfile);
  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const registerView = useServerFn(registerAdView);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sponsor, setSponsor] = useState<any>(null);
  const [copied, setCopied] = useState(false);


  const [historyTcg, setHistoryTcg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    registerView()
      .then(setSponsor)
      .catch(() => {
        fetchActiveSponsor().then(setSponsor).catch(() => {});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const tournaments: any[] =
    profile && !profile.is_private ? (profile as any).tournaments ?? [] : [];

  const uniqueGames = useMemo(
    () =>
      Array.from(
        new Map(
          tournaments
            .filter((t: any) => t.game_id)
            .map((t: any) => [t.game_id, { id: t.game_id, name: t.tcg }]),
        ).values(),
      ),
    [tournaments],
  );

  const filteredTournaments = historyTcg
    ? tournaments.filter((t: any) => t.game_id === historyTcg)
    : tournaments;
  const paginatedTournaments = filteredTournaments.slice(0, page * PAGE_SIZE);
  const hasMoreTournaments = filteredTournaments.length > page * PAGE_SIZE;

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
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>

      <main className="min-w-0 pb-20">
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
                      <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-500">
                        <Target size={10} className="text-primary" /> Puntos
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

        {/* Ad horizontal mobile */}
        <AdHorizontal sponsor={sponsor} />

        {/* Historial de torneos */}
        <section className="glass mt-6 overflow-hidden rounded-2xl">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-primary" size={18} />
              <h2 className="text-lg font-semibold text-white">Historial de torneos</h2>
            </div>
            <span className="text-xs uppercase tracking-wider text-gray-500">
              {filteredTournaments.length} torneos
            </span>
          </header>

          {uniqueGames.length > 1 && (
            <div className="flex overflow-x-auto border-b border-white/10 px-2">
              <button
                onClick={() => {
                  setHistoryTcg(null);
                  setPage(1);
                }}
                className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition flex-shrink-0 ${
                  historyTcg === null
                    ? "border-primary text-white"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                Todos ({tournaments.length})
              </button>
              {uniqueGames.map((g: any) => {
                const count = tournaments.filter((t: any) => t.game_id === g.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setHistoryTcg(g.id);
                      setPage(1);
                    }}
                    className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition flex-shrink-0 ${
                      historyTcg === g.id
                        ? "border-primary text-white"
                        : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {g.name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Desktop */}
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead className="bg-black/30 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">TCG</th>
                  <th className="px-4 py-2 text-left">Tienda</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap">V / D</th>
                  <th className="px-4 py-2 text-right">Posición</th>
                  <th className="px-4 py-2 text-right">Pts Arena</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTournaments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      Sin torneos registrados.
                    </td>
                  </tr>
                ) : (
                  paginatedTournaments.map((t: any) => (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-gray-400 font-mono-stat text-xs">
                        {t.date !== "—"
                          ? new Date(t.date + "T12:00:00").toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{t.tcg}</td>
                      <td className="px-4 py-3 text-white">
                        {t.store}{" "}
                        <span className="text-xs text-gray-500">· {t.city}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono-stat text-xs text-gray-300 whitespace-nowrap">
                        {t.wins != null && t.losses != null
                          ? `${t.wins} / ${t.losses}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono-stat text-sm font-semibold ${
                            t.placement <= 3 ? "text-primary" : "text-white"
                          }`}
                        >
                          #{t.placement}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-stat font-semibold text-white">
                        +{t.pointsEarned}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden">
            {paginatedTournaments.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                Sin torneos registrados.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {paginatedTournaments.map((t: any) => (
                  <div key={t.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono-stat text-sm font-semibold ${
                              t.placement <= 3 ? "text-primary" : "text-white"
                            }`}
                          >
                            #{t.placement}
                          </span>
                          <span className="text-xs text-gray-400">{t.tcg}</span>
                          <span className="text-xs text-gray-600">—</span>
                          <span className="text-sm font-semibold text-white truncate">
                            {t.store}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          <span>{t.city}</span>
                          <span>·</span>
                          <span>
                            {t.date !== "—"
                              ? new Date(t.date + "T12:00:00").toLocaleDateString(
                                  "es-MX",
                                  { day: "numeric", month: "short" },
                                )
                              : "—"}
                          </span>
                          {t.wins != null && t.losses != null && (
                            <>
                              <span>·</span>
                              <span className="whitespace-nowrap">
                                {t.wins}V/{t.losses}D
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-xs font-mono-stat font-semibold text-white">
                          +{t.pointsEarned}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasMoreTournaments && (
            <div className="px-4 py-4 text-center border-t border-white/5">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="text-xs text-primary hover:underline"
              >
                Ver más torneos
              </button>
            </div>
          )}
        </section>

        {/* CTA */}
        {!profile.is_owner && (
          <section className="glass mt-6 rounded-2xl border border-primary/20 p-6 text-center">
            <h3 className="text-lg font-bold text-white">
              ¿Quieres ver tu propio ranking?
            </h3>
            <p className="mt-2 text-sm text-gray-400">
              Regístrate y accede a tu historial completo, rankings por TCG y
              estadísticas detalladas.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/signup"
                className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
              >
                Crear cuenta gratis
              </Link>
              <Link
                to="/login"
                className="rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white"
              >
                Iniciar sesión
              </Link>
            </div>
          </section>
        )}
      </main>

      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}

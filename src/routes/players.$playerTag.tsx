import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Lock } from "lucide-react";
import { playerProfileQuery, playerAchievementsQuery } from "@/lib/player-profile-queries";
import { PlayerCardShare } from "@/components/player/PlayerCardShare";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { setEquippedNameplate } from "@/lib/nexus-player.functions";
import { isNameplateReward } from "@/lib/achievement-rewards";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { NameplateBanner } from "@/components/player/NameplateBanner";
import { PODIUM_TEXT } from "@/components/ranking/RankingBand";
import { useHidesOthersDecks } from "@/hooks/use-nexus-role";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/players/$playerTag")({
  // defaultPreload: "intent" (router.tsx) dispara este loader al hover de
  // cualquier <Link> a este perfil (p. ej. una fila del leaderboard) — para
  // cuando el usuario suelta el click, el query ya está resuelto en caché.
  //
  // Best effort a propósito: si falla (p. ej. "Jugador no encontrado"), NO
  // se relanza. Un error de loader sin errorComponent tumba toda la ruta
  // con un 500 genérico — pero "no encontrado" es un estado válido de la
  // app, no una falla de servidor. El componente ya lo maneja con gracia
  // vía useQuery().isError sobre la misma query key.
  loader: async ({ context, params }) => {
    try {
      const profile = await context.queryClient.ensureQueryData(playerProfileQuery(params.playerTag));
      // Precargamos achievements junto con el perfil para que el teaser no
      // aparezca tarde y empuje el layout — mismo patrón que el resto de la
      // página. Best effort: si falla, el useQuery del componente reintenta.
      if (profile && !(profile as any).is_private) {
        context.queryClient.ensureQueryData(playerAchievementsQuery(params.playerTag)).catch(() => {});
      }
      return profile;
    } catch {
      return undefined;
    }
  },
  head: ({ params }) => ({
    meta: [{ title: `Perfil de ${params.playerTag} — Nexus` }],
    links: [{ rel: "canonical", href: `https://mxntcg.lovable.app/players/${params.playerTag}` }],
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

const BTN_OUTLINE =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground-secondary transition hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:min-h-9";

/** "2026-11-05" -> "5 nov" (con año solo si no es el actual). */
function fmtDate(d: string | null | undefined): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "—";
  const date = new Date(`${d.slice(0, 10)}T12:00:00`);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "29.00" -> "29", "12.50" -> "12.5" (sin ceros sobrantes). */
function fmtPts(v: unknown): string {
  return Number(Number(v ?? 0).toFixed(2)).toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Filtro de una sola opción activa; botones de 44px en móvil con estado accesible. */
function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ key: string | null; label: string }>;
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex overflow-x-auto border-b border-border px-2">
      {options.map((o) => (
        <button
          key={o.key ?? "all"}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={`-mb-px min-h-11 flex-shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:min-h-9 ${
            value === o.key
              ? "border-primary text-foreground"
              : "border-transparent text-foreground-secondary hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LeagueChip({ t }: { t: any }) {
  if (!t.league_name || !t.store_slug) return null;
  return (
    <Link
      to="/stores/$slug"
      params={{ slug: t.store_slug }}
      hash="liga-interna"
      className="relative z-10 rounded-md border border-border px-1.5 py-0.5 text-xs font-medium text-foreground-secondary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <span className="sr-only">Liga: </span>
      {t.league_name}
    </Link>
  );
}

/**
 * Una fila del historial. El enlace al torneo vive en el nombre de la tienda y se
 * estira sobre toda la fila (after:inset-0), así la fila se abre con teclado y clic
 * medio, y el chip de liga puede seguir siendo su propio enlace encima.
 */
function HistoryRow({ t, showTcg }: { t: any; showTcg: boolean }) {
  const place = t.placement <= 3 ? "text-primary" : "text-foreground";
  const wl = t.wins != null && t.losses != null ? { w: t.wins, l: t.losses } : null;
  const stretched =
    "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary";
  const storeLink = (cls: string) => (
    <Link to="/tournaments/$id" params={{ id: t.id }} className={`${cls} ${stretched}`}>
      {t.store}
    </Link>
  );
  return (
    <>
      {/* Escritorio */}
      <div className="relative hidden grid-cols-[96px_minmax(0,1fr)_72px_64px_80px] items-center gap-3 px-4 py-3 transition hover:bg-white/5 sm:grid">
        <span className="font-mono-stat text-xs text-foreground-secondary">{fmtDate(t.date)}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {storeLink("min-w-0 truncate font-medium text-foreground")}
          <span className="truncate text-xs text-foreground-subtle">
            {[t.city, showTcg ? t.tcg : null].filter(Boolean).join(" · ")}
          </span>
          <LeagueChip t={t} />
        </div>
        <span className="whitespace-nowrap text-center font-mono-stat text-xs text-foreground-secondary">
          {wl ? `${wl.w} / ${wl.l}` : "—"}
        </span>
        <span className={`text-right font-mono-stat text-sm font-semibold ${place}`}>#{t.placement}</span>
        <span className="text-right font-mono-stat font-semibold text-foreground">+{fmtPts(t.pointsEarned)}</span>
      </div>

      {/* Móvil: lugar, tienda con su contexto en una línea, y puntos */}
      <div className="relative flex items-center gap-3 px-4 py-3 transition active:bg-white/5 sm:hidden">
        <span className={`min-w-10 flex-shrink-0 font-mono-stat text-base font-bold ${place}`}>#{t.placement}</span>
        <div className="min-w-0 flex-1">
          {storeLink("block truncate font-semibold text-foreground")}
          <p className="mt-0.5 truncate text-xs text-foreground-secondary">
            {[t.city, fmtDate(t.date), wl ? `${wl.w}V/${wl.l}D` : null, showTcg ? t.tcg : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {t.league_name && t.store_slug && (
            <div className="mt-1">
              <LeagueChip t={t} />
            </div>
          )}
        </div>
        <span className="flex-shrink-0 font-mono-stat text-base font-semibold text-foreground">
          +{fmtPts(t.pointsEarned)}
        </span>
      </div>
    </>
  );
}

function EmptyHistory() {
  return (
    <div className="px-4 py-14 text-center">
      <p className="text-sm font-semibold text-foreground">Aún sin torneos registrados</p>
      <p className="mt-1 text-xs text-foreground-subtle">
        Participa en un torneo en tu tienda local para aparecer en el circuito.
      </p>
      <Link
        to="/stores"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9"
      >
        Encontrar una tienda
      </Link>
    </div>
  );
}

function PublicProfilePage() {
  const { playerTag } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const registerView = useServerFn(registerAdView);

  const [sponsor, setSponsor] = useState<any>(null);
  const [avatarError, setAvatarError] = useState(false);
  const hidesOthersDecks = useHidesOthersDecks();

  const [historyTcg, setHistoryTcg] = useState<string | null>(null);
  const NATIONAL_LEAGUE = "__national__";
  const [historyLeague, setHistoryLeague] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    registerView()
      .then(setSponsor)
      .catch(() => {
        fetchActiveSponsor()
          .then(setSponsor)
          .catch(() => {});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initialData del loader: si el usuario llegó por hover/intent (preload)
  // o por SSR, el primer render ya tiene datos — sin ese "Cargando perfil…"
  // ni siquiera en la primera visita. Revalida en background según staleTime.
  const profileQuery = useQuery({
    ...playerProfileQuery(playerTag),
    initialData: loaderData,
  });
  const profile = profileQuery.data ?? null;
  const loading = profileQuery.isPending;
  const notFound = profileQuery.isError;

  const achievementsQuery = useQuery({
    ...playerAchievementsQuery(playerTag),
    enabled: !!profile && !profile.is_private,
  });
  const achievements = achievementsQuery.data ?? null;

  // Nameplates desbloqueados: reusa la misma data ya cargada para el
  // Standing (Fase 2) — cero requests nuevos para armar el switcher del
  // Hero, solo se aplana y filtra por reward_type en cliente.
  const queryClient = useQueryClient();
  const equipNameplateFn = useServerFn(setEquippedNameplate);
  const unlockedNameplates = useMemo(
    () =>
      (achievements?.roads.flatMap((r: any) => r.items) ?? [])
        .filter((item: any) => item.unlocked && isNameplateReward(item))
        .map((item: any) => ({
          key: item.key,
          name: item.name,
          tier: item.tier,
          requirement_text: item.requirement_text,
          base_lp: item.base_lp,
          reward_detail: item.reward_detail,
        })),
    [achievements],
  );
  const handleEquipNameplate = async (achievement_key: string | null) => {
    try {
      await equipNameplateFn({ data: { achievement_key } });
      queryClient.invalidateQueries({ queryKey: ["player-profile", playerTag] });
      queryClient.invalidateQueries({ queryKey: ["player-achievements", playerTag] });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar el nameplate");
    }
  };

  const tournaments: any[] = profile && !profile.is_private ? ((profile as any).tournaments ?? []) : [];

  // Win-rate y forma reciente: calculados en cliente a partir de
  // profile.tournaments (ya viene ordenado por fecha desc) — no hace falta
  // tocar el backend, el dato agregado ya está en cada fila.
  const record = useMemo(() => {
    let wins = 0;
    let losses = 0;
    for (const t of tournaments) {
      if (t.wins != null) wins += t.wins;
      if (t.losses != null) losses += t.losses;
    }
    const total = wins + losses;
    return { wins, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : null };
  }, [tournaments]);

  // slice + reverse: los más recientes primero en `tournaments` (orden del
  // server), pero una tira de "forma" se lee cronológicamente izq→der.
  const recentForm = useMemo(() => tournaments.slice(0, 5).reverse(), [tournaments]);

  const uniqueGames = useMemo(
    () =>
      Array.from(
        new Map(
          tournaments.filter((t: any) => t.game_id).map((t: any) => [t.game_id, { id: t.game_id, name: t.tcg }]),
        ).values(),
      ),
    [tournaments],
  );

  const uniqueLeagues = useMemo(
    () =>
      Array.from(
        new Map(
          tournaments
            .filter((t: any) => t.league_id)
            .map((t: any) => [t.league_id, { id: t.league_id, name: t.league_name }]),
        ).values(),
      ),
    [tournaments],
  );

  const filteredTournaments = tournaments
    .filter((t: any) => !historyTcg || t.game_id === historyTcg)
    .filter((t: any) => {
      if (!historyLeague) return true;
      if (historyLeague === NATIONAL_LEAGUE) return !t.league_id;
      return t.league_id === historyLeague;
    });
  const paginatedTournaments = filteredTournaments.slice(0, page * PAGE_SIZE);
  const hasMoreTournaments = filteredTournaments.length > page * PAGE_SIZE;

  if (loading) {
    return (
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
        <aside className="hidden xl:block" />
        <main className="min-w-0 pb-20" aria-busy="true">
          {/* Hero — misma forma que el estado real (identidad, lugar y fila de
              stats) para que no haya salto de tamaño al resolver la query. */}
          <div className="@container my-6 overflow-hidden rounded-2xl border border-border bg-card sm:my-8">
            <div className="grid gap-6 p-5 sm:p-8 @4xl:grid-cols-[minmax(0,1fr)_auto] @4xl:items-center @4xl:gap-10">
              <div className="flex items-start gap-4 sm:gap-5">
                <SkeletonBlock className="h-16 w-16 flex-shrink-0 rounded-full sm:h-20 sm:w-20" />
                <div className="min-w-0 flex-1 space-y-3">
                  <SkeletonLine width="w-48" height="h-9" />
                  <SkeletonBlock className="h-7 w-28 rounded-md" />
                  <SkeletonLine width="w-40" height="h-3" />
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <SkeletonBlock className="h-14 w-10 flex-shrink-0 rounded-md sm:h-28 sm:w-20" />
                <div className="space-y-3">
                  <SkeletonLine width="w-36" height="h-3" />
                  <SkeletonLine width="w-28" height="h-14" />
                </div>
              </div>
            </div>
            <div className="flex gap-8 border-t border-border px-5 py-4 sm:px-8">
              <SkeletonLine width="w-16" height="h-8" />
              <SkeletonLine width="w-20" height="h-8" />
              <SkeletonLine width="w-24" height="h-8" />
            </div>
          </div>

          {/* Más rankings y logros */}
          <SkeletonBlock className="h-16 w-full rounded-xl" />

          {/* Historial de torneos */}
          <SkeletonBlock className="mt-6 h-14 w-full rounded-t-xl" />
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-14 w-full last:rounded-b-xl" />
            ))}
          </div>
        </main>
        <aside className="hidden xl:block" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-foreground">Jugador no encontrado</h2>
        <p className="mt-2 text-sm text-foreground-secondary">No existe un jugador con ese Nexus Tag.</p>
        <Link to="/" className={`${BTN_OUTLINE} mt-6 px-6`}>
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (profile.is_private) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <Lock className="mb-4 text-foreground-subtle" size={40} aria-hidden="true" />
        <h2 className="text-2xl font-bold text-foreground">Perfil privado</h2>
        <p className="mt-2 text-sm text-foreground-secondary">
          El perfil de <span className="font-semibold text-foreground">@{profile.geek_tag}</span> es privado.
        </p>
        <Link to="/" className={`${BTN_OUTLINE} mt-6 px-6`}>
          Volver al inicio
        </Link>
      </main>
    );
  }

  // El lugar del héroe es el del primer TCG en el que el jugador ya tiene posición.
  const primaryRanking = profile.rankings.find((r: any) => r.rank_position > 0) ?? profile.rankings[0] ?? null;
  const otherRankings = profile.rankings.filter((r: any) => r !== primaryRanking);
  const primaryTier =
    primaryRanking && primaryRanking.rank_position >= 1 && primaryRanking.rank_position <= 3
      ? PODIUM_TEXT[primaryRanking.rank_position - 1]
      : "text-foreground";
  // Con perfil privado no se ve el deck de otros jugadores (el propio sí).
  const mainLeader = hidesOthersDecks && !profile.is_owner ? null : (profile.main_leader ?? null);
  const leaderImage: string | null = mainLeader?.image ?? null;
  const showStats = record.total > 0 || !!mainLeader || recentForm.length > 0 || !!profile.total_tournaments_won;
  const metaLine = [
    profile.store_city,
    profile.member_since
      ? `Miembro desde ${new Date(profile.member_since).toLocaleDateString("es-MX", {
          month: "long",
          year: "numeric",
        })}`
      : null,
  ].filter(Boolean);
  const achievementsPct =
    achievements && achievements.total_count > 0
      ? Math.round((achievements.unlocked_count / achievements.total_count) * 100)
      : 0;

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>

      <main className="min-w-0 pb-20">
        {/* Hero: identidad a la izquierda; a la derecha, lo que el visitante viene a
            buscar — el lugar del jugador y su leader. */}
        <section className="@container my-6 overflow-hidden rounded-2xl border border-border bg-card sm:my-8">
          <div className="grid gap-6 p-5 sm:p-8 @4xl:grid-cols-[minmax(0,1fr)_auto] @4xl:items-center @4xl:gap-10">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              {profile.avatar_url && !avatarError ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  onError={() => setAvatarError(true)}
                  className="h-16 w-16 flex-shrink-0 rounded-full border border-border object-cover sm:h-20 sm:w-20"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-foreground sm:h-20 sm:w-20 sm:text-3xl"
                >
                  {profile.geek_tag.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-4xl">
                  {profile.geek_tag}
                </h1>
                <NameplateBanner
                  equipped={profile.equipped_nameplate}
                  isOwner={!!profile.is_owner}
                  unlockedNameplates={unlockedNameplates}
                  onEquip={handleEquipNameplate}
                />
                {(profile.equipped_title || profile.equipped_badge) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {[profile.equipped_title, profile.equipped_badge].filter(Boolean).map((label) => (
                      <span
                        key={label}
                        className="rounded-md border border-border bg-secondary px-2.5 py-1 text-sm font-medium text-foreground"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {metaLine.length > 0 && (
                  <p className="mt-2 text-sm text-foreground-secondary">{metaLine.join(" · ")}</p>
                )}
              </div>
            </div>

            {(primaryRanking || leaderImage) && (
              <div className="flex items-center gap-4 sm:gap-6 @4xl:justify-end">
                {leaderImage && (
                  <img
                    src={leaderImage}
                    alt={`Leader ${mainLeader?.name ?? ""}`.trim()}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-10 flex-shrink-0 rounded-md border border-border object-cover sm:h-28 sm:w-20"
                  />
                )}
                {primaryRanking && (
                  <div className="min-w-0">
                    <p className="text-sm text-foreground-secondary">Ranking Nacional · {primaryRanking.game_name}</p>
                    <p
                      className={`mt-1 font-mono-stat text-6xl font-bold leading-none sm:text-7xl @4xl:text-8xl ${primaryTier}`}
                    >
                      {primaryRanking.rank_position > 0 ? `#${primaryRanking.rank_position}` : "—"}
                    </p>
                    <p className="mt-2 text-balance font-mono-stat text-sm text-foreground-secondary">
                      {fmtPts(primaryRanking.total_points)} pts ·{" "}
                      {plural(primaryRanking.tournaments_played, "torneo", "torneos")} ·{" "}
                      {plural(primaryRanking.tournaments_won, "ganado", "ganados")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 sm:px-8">
            {showStats ? (
              <dl className="flex flex-wrap items-start gap-x-8 gap-y-3">
                {!!profile.total_tournaments_won && (
                  <div>
                    <dt className="text-xs text-foreground-subtle">Torneos ganados</dt>
                    <dd className="font-mono-stat text-lg font-semibold text-foreground">
                      {profile.total_tournaments_won}
                    </dd>
                  </div>
                )}
                {record.winRate != null && (
                  <div>
                    <dt className="text-xs text-foreground-subtle">Win rate</dt>
                    <dd className="font-mono-stat text-lg font-semibold text-foreground">
                      {record.winRate}%{" "}
                      <span className="text-xs font-normal text-foreground-subtle">
                        ({record.wins}V-{record.losses}D)
                      </span>
                    </dd>
                  </div>
                )}
                {mainLeader && (
                  <div>
                    <dt className="text-xs text-foreground-subtle">Leader principal</dt>
                    <dd className="max-w-[16rem] truncate text-lg font-semibold text-foreground">{mainLeader.name}</dd>
                  </div>
                )}
                {recentForm.length > 0 && (
                  <div>
                    <dt className="text-xs text-foreground-subtle">Últimos {recentForm.length} torneos (lugar)</dt>
                    <dd>
                      <ol className="mt-1.5 flex items-center gap-1">
                        {recentForm.map((t: any, i: number) => (
                          <li
                            key={t.id ?? i}
                            className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-mono-stat text-xs font-bold ${
                              t.placement <= 3 ? "bg-primary/15 text-primary" : "bg-white/10 text-foreground-secondary"
                            }`}
                          >
                            <span className="sr-only">Lugar </span>
                            {t.placement}
                          </li>
                        ))}
                      </ol>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <span />
            )}

            <PlayerCardShare
              url={`https://mxntcg.lovable.app/players/${profile.geek_tag}`}
              title={`${profile.geek_tag} — TCG League`}
              text={`Mira el ranking de ${profile.geek_tag} en TCG League 🏆`}
              className={BTN_OUTLINE}
              cardData={{
                nexusTag: profile.geek_tag,
                subtitle: profile.store_city ?? null,
                badge: profile.equipped_title ?? null,
                rankLabel:
                  primaryRanking && primaryRanking.rank_position > 0 ? `#${primaryRanking.rank_position}` : null,
                rankCaption: primaryRanking?.game_name ?? null,
                stats: [
                  {
                    label: "Win rate",
                    value: record.winRate != null ? `${record.winRate}%` : "—",
                  },
                  { label: "Torneos", value: String(tournaments.length) },
                  { label: "Ganados", value: String(profile.total_tournaments_won ?? 0) },
                ],
                leaderName: mainLeader?.name ?? null,
                recentPlacements: recentForm.map((t: any) => t.placement),
              }}
            />
          </div>
        </section>

        {/* Más rankings (otros TCG) y logros, en una sola superficie separada por líneas.
            El teaser de logros se muestra siempre, incluso en 0: a un jugador nuevo hay
            que mostrarle que el sistema existe. Mientras resuelve (query aparte) va un
            skeleton del mismo alto para que el layout no salte. */}
        {(otherRankings.length > 0 || achievements || achievementsQuery.isPending) && (
          <section
            aria-label="Otros rankings y logros"
            className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
          >
            {otherRankings.map((r: any) => (
              <div key={r.game_id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.game_name}</p>
                  <p className="text-xs text-foreground-secondary">
                    {fmtPts(r.total_points)} pts · {plural(r.tournaments_played, "torneo", "torneos")} esta temporada ·{" "}
                    {plural(r.tournaments_won, "ganado", "ganados")}
                  </p>
                </div>
                <span className="font-mono-stat text-2xl font-bold text-foreground">
                  {r.rank_position > 0 ? `#${r.rank_position}` : "—"}
                </span>
              </div>
            ))}

            {achievementsQuery.isPending ? (
              <SkeletonBlock className="h-[68px] w-full rounded-none" />
            ) : (
              achievements && (
                <Link
                  to="/players/$playerTag/achievements"
                  params={{ playerTag }}
                  className="flex min-h-[68px] items-center justify-between gap-4 px-4 py-3 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">Logros</p>
                    <p className="text-xs text-foreground-secondary">
                      {achievements.unlocked_count > 0
                        ? `${achievements.total_lp} Legacy Points`
                        : "Empieza a competir para desbloquear logros"}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono-stat text-2xl font-bold text-foreground">
                        {achievements.unlocked_count}
                        <span className="font-sans text-base font-normal text-foreground-subtle">
                          {" "}
                          / {achievements.total_count}
                        </span>
                      </p>
                      <p className="font-mono-stat text-xs text-foreground-subtle">{achievementsPct}% completado</p>
                    </div>
                    <span className="hidden items-center gap-0.5 text-sm font-medium text-primary sm:inline-flex">
                      Ver todos
                      <ChevronRight size={16} aria-hidden="true" />
                    </span>
                    <ChevronRight size={16} aria-hidden="true" className="text-foreground-subtle sm:hidden" />
                  </div>
                </Link>
              )
            )}
          </section>
        )}

        {/* Ad horizontal mobile */}
        <AdHorizontal sponsor={sponsor} />

        {/* Historial de torneos */}
        <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold text-foreground">Historial de torneos</h2>
            <span className="font-mono-stat text-xs text-foreground-subtle">
              {plural(filteredTournaments.length, "torneo", "torneos")}
            </span>
          </header>

          {uniqueGames.length > 1 && (
            <FilterGroup
              label="Filtrar por juego"
              value={historyTcg}
              onChange={(k) => {
                setHistoryTcg(k);
                setPage(1);
              }}
              options={[
                { key: null, label: `Todos (${tournaments.length})` },
                ...uniqueGames.flatMap((g: any) => {
                  const count = tournaments.filter((t: any) => t.game_id === g.id).length;
                  return count === 0 ? [] : [{ key: g.id as string, label: `${g.name} (${count})` }];
                }),
              ]}
            />
          )}

          {uniqueLeagues.length > 0 && (
            <FilterGroup
              label="Filtrar por liga"
              value={historyLeague}
              onChange={(k) => {
                setHistoryLeague(k);
                setPage(1);
              }}
              options={[
                { key: null, label: "Todas las ligas" },
                { key: NATIONAL_LEAGUE, label: "Circuito Nacional" },
                ...uniqueLeagues.map((l: any) => ({
                  key: l.id as string,
                  label: l.name as string,
                })),
              ]}
            />
          )}

          {paginatedTournaments.length === 0 ? (
            <EmptyHistory />
          ) : (
            <>
              <div className="hidden grid-cols-[96px_minmax(0,1fr)_72px_64px_80px] gap-3 overflow-hidden border-b border-border bg-background/60 px-4 py-2 text-xs font-semibold text-foreground-subtle sm:grid">
                <span>Fecha</span>
                <span>Tienda</span>
                <span className="text-center">V / D</span>
                <span className="text-right">Lugar</span>
                <span className="text-right">Puntos</span>
              </div>
              <div className="divide-y divide-border">
                {paginatedTournaments.map((t: any) => (
                  <HistoryRow key={t.id} t={t} showTcg={uniqueGames.length > 1} />
                ))}
              </div>
            </>
          )}

          {hasMoreTournaments && (
            <div className="border-t border-border px-4 py-3 text-center">
              <button type="button" onClick={() => setPage((p) => p + 1)} className={BTN_OUTLINE}>
                Ver {Math.min(PAGE_SIZE, filteredTournaments.length - page * PAGE_SIZE)} más
              </button>
            </div>
          )}
          {/* getPublicProfile trae como máximo 100 torneos — si el jugador
              tiene más, avisamos en vez de cortar en silencio. */}
          {!hasMoreTournaments && tournaments.length === 100 && (
            <p className="border-t border-border px-4 py-3 text-center text-xs text-foreground-subtle">
              Mostrando los 100 torneos más recientes.
            </p>
          )}
        </section>

        {/* CTA
        {!profile.is_owner && (
          <section className="glass mt-6 rounded-2xl border border-primary/20 p-6 text-center">
            <h3 className="text-lg font-bold text-foreground">¿Quieres ver tu propio ranking?</h3>
            <p className="mt-2 text-sm text-foreground-secondary">
              Regístrate y accede a tu historial completo, rankings por TCG y estadísticas
              detalladas.
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
                className="rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-foreground"
              >
                Iniciar sesión
              </Link>
            </div>
          </section>
        )} */}
      </main>

      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}

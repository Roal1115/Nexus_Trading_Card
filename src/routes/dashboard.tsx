import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NewPlayerSteps } from "@/components/player/NewPlayerSteps";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  ChevronRight,
  Globe,
  HelpCircle,
  Layers,
  Lock,
  Share2,
  ShieldQuestion,
  X,
} from "lucide-react";

// Medallero: #1 oro, #2 plata, #3 bronce — mismo tratamiento en Rank Global
// del Hero, la columna Posición del historial, y la tabla del modal de
// detalle. null = fuera del podio, se queda con el estilo neutro existente.
type RankTier = "gold" | "silver" | "bronze" | null;
function rankTier(rank: number | null | undefined): RankTier {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
}
const RANK_TIER_TEXT: Record<Exclude<RankTier, null>, string> = {
  gold: "text-yellow-400",
  silver: "text-slate-200",
  bronze: "text-amber-600",
};
/** "2026-11-05" -> "5 nov" (con año solo si no es el actual). */
function fmtDate(d: string | null | undefined): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return d ?? "—";
  const date = new Date(`${d.slice(0, 10)}T12:00:00`);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
/** 12 -> "+12", 12.5 -> "+12.5" (antes "+12.00"). */
const fmtPts = (n: unknown) => `+${Number(Number(n ?? 0).toFixed(2))}`;

const POINTS_HELP = `¿Cómo se calculan tus puntos?

Puntos: Cada torneo normaliza tus puntos con la fórmula:
(tus match points ÷ match points del 1er lugar) × 100

Regla top 2 por semana: Si juegas más de 2 torneos en la misma semana (lunes a domingo), solo tus 2 mejores resultados cuentan para el ranking.

Ranking mensual: Suma de tus puntos en el mes actual.
Ranking Nacional: Suma acumulada durante la temporada completa.`;

import { toast } from "sonner";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { dismissOnboarding, toggleProfilePrivacy } from "@/lib/nexus-player.functions";
import { myDashboardQuery, tournamentDetailQuery, tournamentRoundsQuery } from "@/lib/dashboard-queries";
import { playerAchievementsQuery } from "@/lib/player-profile-queries";
import { PlayerCardShare } from "@/components/player/PlayerCardShare";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { PerformanceTrackerModal } from "@/components/tournament-tracker/PerformanceTrackerModal";
import { RoundsAccordionReadOnly } from "@/components/tournament-tracker/RoundsAccordionReadOnly";
import { motion, AnimatePresence } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  PerformanceTrackerSkeleton,
  TournamentRowSkeleton,
  SkeletonLine,
  SkeletonBlock,
} from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/dashboard")({
  // NO se espera esta promesa a propósito: getMyDashboard es una query
  // pesada (rankings + torneos + stats), y un loader que hace `await` acá
  // bloquea la transición de ruta entera hasta que termine — justo el caso
  // real de "login -> navigate('/dashboard')", donde antes se quedaban
  // varios segundos parados en /login. El componente ya tiene su propio
  // useQuery + skeleton (ver dashboardQuery.isPending más abajo), así que
  // esto queda como prefetch en background: si termina antes de montar el
  // componente, initialData ya está tibio; si no, el propio useQuery lo
  // recoge (misma queryKey, sin duplicar el fetch).
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(myDashboardQuery()).catch(() => {});
    return undefined;
  },
  head: () => ({ meta: [{ title: "Inicio — Nexus" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { player: gaPlayer, loading: authLoading, updatePlayer } = useNexusRole();
  const navigate = useNavigate();
  const loaderData = Route.useLoaderData();

  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const registerView = useServerFn(registerAdView);
  const [selectedTcg, setSelectedTcg] = useState<string | null>(null);
  const [sponsor, setSponsor] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [historyTcg, setHistoryTcg] = useState<string | null>(null);
  const PAGE_SIZE = 10;
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [trackerTournament, setTrackerTournament] = useState<{
    id: string;
    game_id: string;
  } | null>(null);
  // Editar el tracker DENTRO del modal de detalle — antes la única forma de
  // registrar rondas era cerrar este panel de solo-lectura y abrir el
  // Performance Tracker como otro modal completamente aparte, perdiendo el
  // contexto del torneo. PerformanceTrackerModal ya tenía un modo
  // `embedded` (sin overlay/X propios) para esto, simplemente nunca se usaba.
  const [editingTrackerInModal, setEditingTrackerInModal] = useState(false);
  // Se incrementa cada vez que se sale del modo edición — fuerza a
  // RoundsAccordionReadOnly a re-montar y volver a pedir las rondas
  // (su fetch solo corre en mount/cambio de tournamentId).
  const [roundsReloadKey, setRoundsReloadKey] = useState(0);
  const exitTrackerEditMode = () => {
    setEditingTrackerInModal(false);
    queryClient.removeQueries({ queryKey: ["tournament-rounds"] });
    setRoundsReloadKey((k) => k + 1);
  };

  const togglePrivacyFn = useServerFn(toggleProfilePrivacy);
  const dismissOnboardingFn = useServerFn(dismissOnboarding);
  const queryClient = useQueryClient();
  const [isPublic, setIsPublic] = useState(true);

  const [statsTcg, setStatsTcg] = useState<string | null>(null);

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

  // enabled: !!gaPlayer — sin sesión, ni siquiera intenta (antes el efecto
  // hacía el mismo chequeo a mano). initialData del loader: solo tiene
  // valor real en navegación SPA con hover previo (SSR normalmente no
  // tiene el token del usuario — ver comentario del loader arriba).
  const dashboardQuery = useQuery({
    ...myDashboardQuery(),
    enabled: !!gaPlayer,
    initialData: loaderData,
  });
  const data = dashboardQuery.data ?? null;
  const loading = !!gaPlayer && dashboardQuery.isPending;

  const achievementsQuery = useQuery({
    ...playerAchievementsQuery(gaPlayer?.geek_tag ?? ""),
    enabled: !!gaPlayer?.geek_tag,
  });
  const achievements = achievementsQuery.data ?? null;
  const achievementsLoading = !!gaPlayer?.geek_tag && achievementsQuery.isPending;

  useEffect(() => {
    if (data && typeof (data as any).is_profile_public === "boolean") {
      setIsPublic((data as any).is_profile_public);
    }
  }, [data]);

  const handleTogglePrivacy = async () => {
    const next = !isPublic;
    setIsPublic(next);
    try {
      await togglePrivacyFn({ data: { is_public: next } });
      updatePlayer({ is_profile_public: next });
      toast.success(next ? "Perfil ahora es público" : "Perfil ahora es privado");
    } catch {
      setIsPublic(!next);
      toast.error("Error al cambiar la privacidad");
    }
  };

  const handleSkipSteps = async () => {
    const setShown = (show_onboarding: boolean) =>
      queryClient.setQueryData(myDashboardQuery().queryKey, (old: any) => (old ? { ...old, show_onboarding } : old));
    setShown(false);
    try {
      await dismissOnboardingFn();
    } catch {
      setShown(true);
      toast.error("No se pudo guardar. Intenta de nuevo.");
    }
  };

  // Reabrir el mismo torneo (misma tournamentId) pinta desde caché — sin
  // loadingDetail manual ni riesgo de mostrar el detalle de un torneo
  // anterior mientras carga el nuevo (enabled solo corre con id presente).
  const tournamentDetailQ = useQuery({
    ...tournamentDetailQuery(selectedTournamentId ?? ""),
    enabled: !!selectedTournamentId,
  });
  const tournamentDetail = tournamentDetailQ.data ?? null;
  const loadingDetail = !!selectedTournamentId && tournamentDetailQ.isPending;

  const openTournament = (tournament_id: string) => {
    setEditingTrackerInModal(false);
    setSelectedTournamentId(tournament_id);
    void queryClient.prefetchQuery(tournamentRoundsQuery(tournament_id));
  };

  const closeModal = () => {
    setSelectedTournamentId(null);
    setEditingTrackerInModal(false);
  };

  useEffect(() => {
    if (data?.tcgStats?.length && !selectedTcg) {
      setSelectedTcg(data.tcgStats[0].game_id);
    }
  }, [data, selectedTcg]);

  // Sin esto, recargar con sesión mostraba "Debes iniciar sesión" antes de resolverla.
  if (!gaPlayer && authLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <SkeletonBlock className="h-64 w-full rounded-2xl" />
      </main>
    );
  }

  if (!gaPlayer) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-foreground">Debes iniciar sesión</h2>
        <p className="mt-2 text-sm text-foreground-secondary">Tu dashboard muestra tu historial competitivo.</p>
        <Link
          to="/login"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const tag = gaPlayer.geek_tag;

  const tcgStats = data?.tcgStats ?? [];

  const top3DecksByGame = (data as any)?.top3DecksByGame ?? {};
  const globalRecord = (data as any)?.globalRecord ?? { wins: 0, losses: 0, total: 0 };
  const winRate = globalRecord.total > 0 ? Math.round((globalRecord.wins / globalRecord.total) * 100) : null;

  // Inicializar statsTcg al primer TCG disponible
  const statsGameIds = Object.keys(top3DecksByGame);
  const activeStatsTcg = statsTcg ?? statsGameIds[0] ?? null;
  const top3Decks = activeStatsTcg ? (top3DecksByGame[activeStatsTcg] ?? []) : [];

  const activeTcg = tcgStats.find((t) => t.game_id === selectedTcg) ?? tcgStats[0];
  const hasHistory = (data?.totalTournamentsAttended ?? 0) > 0;
  const showSteps = !!(data as any)?.show_onboarding;
  const hideEmptySections = showSteps && !hasHistory;

  const storeCity = data?.storeCity ?? null;
  const semesterLabel = data?.semesterLabel ?? "";
  const events = data?.events ?? [];
  const filteredEvents = historyTcg ? events.filter((e: any) => e.game_id === historyTcg) : events;
  const paginatedEvents = filteredEvents.slice(0, page * PAGE_SIZE);
  const hasMore = filteredEvents.length > page * PAGE_SIZE;

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
      <main className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-20">
        {/* Hero — cuenta la historia del rango: dónde estás, qué cambió desde tu
            último torneo y cuánto falta para el siguiente lugar. */}
        <section className="mt-6 mb-8 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-col flex-wrap items-start gap-8 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-10">
            <div className="w-full min-w-0 sm:w-auto">
              <h1 className="text-4xl font-bold text-foreground [overflow-wrap:anywhere] sm:text-6xl">{tag}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                {storeCity && <span className="text-foreground-secondary">{storeCity}</span>}
                <Link
                  to="/players/$playerTag"
                  params={{ playerTag: tag }}
                  className="font-medium text-foreground-secondary underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground"
                >
                  Ver perfil público
                </Link>
                <button
                  onClick={handleTogglePrivacy}
                  aria-label={isPublic ? "Perfil público. Cambiar a privado" : "Perfil privado. Cambiar a público"}
                  title="El staff de las tiendas y TCGs donde jugaste siempre puede ver esos resultados."
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground-subtle transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  {isPublic ? <Globe size={12} /> : <Lock size={12} />}
                  {isPublic ? "Público" : "Privado"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-start gap-4 sm:items-end">
                <div className="h-[118px] w-[200px] animate-pulse rounded-md bg-white/[0.06]" />
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[38px] w-[64px] animate-pulse rounded bg-white/[0.06]" />
                  ))}
                </div>
              </div>
            ) : !hasHistory ? (
              !showSteps && (
                // Saltó los pasos sin torneos: queda un solo CTA en vez de 4 cards con "—".
                <div className="flex max-w-xs flex-col items-start gap-3">
                  <p className="text-sm text-foreground-secondary">
                    Aún no has jugado ningún torneo. Busca uno cerca de ti y empieza tu ranking.
                  </p>
                  <Link
                    to="/calendar"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Ver calendario de torneos →
                  </Link>
                </div>
              )
            ) : (
              <div className="flex flex-col items-start gap-5 sm:items-end">
                <RankStory tcg={activeTcg} semesterLabel={semesterLabel} />

                {/* Secundarios: una fila de datos. "Torneos" ya vive en el encabezado
                    de Torneos recientes, así que no se repite aquí. */}
                <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm sm:justify-end">
                  <div>
                    <dt className="text-xs text-foreground-subtle">Mensual</dt>
                    <dd className="font-mono-stat font-semibold text-foreground">
                      {activeTcg?.monthly_rank_position > 0 ? `#${activeTcg.monthly_rank_position}` : "—"}
                    </dd>
                  </div>
                  {/* Con un solo TCG, "Mis Rankings" de abajo sería un duplicado del
                      rango de arriba: sus datos únicos (Puntos/Ganados) se pliegan aquí. */}
                  {tcgStats.length === 1 && activeTcg && (
                    <>
                      <div>
                        <dt className="text-xs text-foreground-subtle">Puntos</dt>
                        <dd className="font-mono-stat font-semibold text-foreground">
                          {Number(activeTcg.total_points ?? 0).toFixed(0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-foreground-subtle">Ganados</dt>
                        <dd className="font-mono-stat font-semibold text-foreground">
                          {activeTcg.tournaments_won ?? 0}
                        </dd>
                      </div>
                    </>
                  )}
                  <div className="min-w-0 max-w-[12rem]">
                    <dt className="text-xs text-foreground-subtle">Tienda favorita</dt>
                    <dd className="truncate font-semibold text-foreground">{data?.mostVisitedStore?.name ?? "—"}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {/* Una sola franja inferior: récord a la izquierda, acciones a la derecha.
              Antes eran dos franjas (stats + links) compitiendo por atención. */}
          {(loading || hasHistory) && (
            <div className="flex flex-col gap-4 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10">
              {loading ? (
                <div className="h-8 w-48 animate-pulse rounded bg-white/[0.06]" />
              ) : globalRecord.total > 0 ? (
                <div className="flex flex-wrap items-center gap-4">
                  {statsGameIds.length > 1 && (
                    <div className="flex gap-1">
                      {statsGameIds.map((gid) => {
                        const tcgName = tcgStats.find((t) => t.game_id === gid)?.game_name ?? gid;
                        return (
                          <button
                            key={gid}
                            onClick={() => setStatsTcg(gid)}
                            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                              activeStatsTcg === gid
                                ? "bg-primary/15 text-primary"
                                : "text-foreground-subtle hover:text-foreground-secondary"
                            }`}
                          >
                            {tcgName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                    <span className="font-mono-stat text-2xl font-bold text-success">{globalRecord.wins}V</span>
                    <span className="font-mono-stat text-lg text-foreground-subtle">·</span>
                    <span className="font-mono-stat text-2xl font-bold text-danger">{globalRecord.losses}D</span>
                    <span className="ml-1 whitespace-nowrap text-xs text-foreground-subtle">
                      {globalRecord.total} partidas
                    </span>
                    {winRate != null && (
                      <span className="whitespace-nowrap sm:ml-2 font-mono-stat text-sm font-semibold text-foreground-secondary">
                        {winRate}% victorias
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-foreground-subtle">Sin partidas con resultados registrados aún.</div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <PlayerCardShare
                  url={`https://mxntcg.lovable.app/players/${tag}`}
                  title={`${tag} — Nexus`}
                  text="Mira mi ranking en el circuito Nexus de TCG en México"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                  cardData={{
                    nexusTag: tag,
                    subtitle: storeCity ?? null,
                    rankLabel: activeTcg?.rank_position > 0 ? `#${activeTcg.rank_position}` : null,
                    rankCaption: activeTcg?.game_name ?? null,
                    stats: [
                      { label: "% victorias", value: winRate != null ? `${winRate}%` : "—" },
                      { label: "Torneos", value: String(data?.totalTournamentsAttended ?? 0) },
                      { label: "Ganados", value: String(activeTcg?.tournaments_won ?? 0) },
                    ],
                  }}
                />
                {loading ? (
                  <div className="h-9 w-36 animate-pulse rounded-md bg-white/[0.06]" />
                ) : (
                  <Link
                    to="/my-stats"
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <BarChart3 size={15} className="flex-shrink-0" />
                    Ver mis stats
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>

        {showSteps && <NewPlayerSteps zone={gaPlayer.preferred_zone} onSkip={handleSkipSteps} />}

        {!loading && hasHistory && events[0] && (
          <LastTournament
            event={events[0]}
            onOpen={() => openTournament(events[0].id)}
            onTrack={() => setTrackerTournament({ id: events[0].id, game_id: events[0].game_id })}
          />
        )}

        {/* Achievements + Performance Tracker — antes eran dos cards de
            ancho completo apiladas (cada una con su propio header), ahora
            son tiles de igual altura en una sola fila. Mismo contenido,
            mitad del alto vertical antes de llegar a Torneos Recientes. */}
        {(!showSteps || achievementsLoading || (achievements && achievements.unlocked_count > 0)) && (
          <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {achievementsLoading ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
                </div>
              </div>
            ) : (
              achievements &&
              achievements.unlocked_count > 0 && (
                <Link
                  to="/players/$playerTag/achievements"
                  params={{ playerTag: tag }}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border font-mono-stat text-xs font-bold text-foreground">
                      {achievements.total_count > 0
                        ? Math.round((achievements.unlocked_count / achievements.total_count) * 100)
                        : 0}
                      %
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {achievements.unlocked_count}
                        <span className="text-foreground-subtle"> / {achievements.total_count} logros</span>
                      </p>
                      <p className="truncate text-xs text-foreground-subtle">{achievements.total_lp} Legacy Points</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="flex-shrink-0 text-foreground-subtle transition-colors group-hover:text-foreground"
                  />
                </Link>
              )
            )}

            {!showSteps && (
              <Link
                to="/sessions"
                className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border text-foreground-secondary">
                    <Layers size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">Mis Partidas</p>
                    <p className="truncate text-xs text-foreground-subtle">
                      Registra tus partidas en torneos y prácticas
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="flex-shrink-0 text-foreground-subtle transition-colors group-hover:text-foreground"
                />
              </Link>
            )}
          </section>
        )}

        {/* Mis Rankings — con exactamente 1 TCG, sus datos ya se plegaron
            en la franja de stats del Hero (ver arriba); repetir la sección
            sería mostrar el mismo Rank Global dos veces con otro estilo.
            No se sabe cuántos TCGs tiene el jugador hasta que `data` llega,
            así que la sección entera espera a que termine de cargar en vez
            de mostrar un skeleton de 2 cards que después puede desaparecer
            (el caso más común, 1 solo TCG) — ese "fantasma" era justo el
            layout viejo que quedaba pegado en la carga. */}
        {!loading && tcgStats.length > 1 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Mis Rankings
                <TooltipInfo text={POINTS_HELP} />
              </h2>
            </div>
            {tcgStats.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-foreground-subtle">
                Aún no tienes rankings en esta temporada.
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {tcgStats.map((tcg) => (
                  <TcgRankCard
                    key={tcg.game_id}
                    tcg={tcg}
                    semesterLabel={semesterLabel}
                    monthLabel={data?.monthLabel ?? "Este mes"}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Top Decks — usa el mismo selector de TCG que la franja W/L del
            Hero (statsTcg/setStatsTcg): antes ese selector no tenía efecto
            visible porque top3Decks se calculaba pero nunca se pintaba. */}
        {top3Decks.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Mis Decks Top</h2>
              {statsGameIds.length > 1 && (
                <div className="flex gap-1 rounded-lg bg-secondary p-1">
                  {statsGameIds.map((gid) => {
                    const tcgName = tcgStats.find((t) => t.game_id === gid)?.game_name ?? gid;
                    return (
                      <button
                        key={gid}
                        onClick={() => setStatsTcg(gid)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                          activeStatsTcg === gid
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground-secondary hover:text-foreground"
                        }`}
                      >
                        {tcgName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {top3Decks.map((deck: any, i: number) => (
                <div key={deck.id} className="flex items-center gap-3 p-4">
                  <div className="relative flex-shrink-0">
                    {deck.image ? (
                      <img
                        src={deck.image}
                        alt={deck.name}
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-11 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-11 items-center justify-center rounded-md border border-border">
                        <ShieldQuestion size={16} className="text-foreground-subtle" />
                      </div>
                    )}
                    <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card font-mono-stat text-xs font-bold text-foreground">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{deck.name}</p>
                    <p className="text-xs text-foreground-subtle">
                      {/* El código distingue líderes con el mismo nombre (Luffy ST14 vs ST29). */}
                      {deck.set && <span className="font-mono-stat">{deck.set} · </span>}
                      {deck.count} torneo{deck.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent */}
        <section
          className={`mt-6 overflow-hidden rounded-xl border border-border bg-card ${hideEmptySections ? "hidden" : ""}`}
        >
          <header className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">Torneos recientes</h2>
            {!loading && (
              <span className="whitespace-nowrap text-xs text-foreground-subtle">
                {filteredEvents.length} {historyTcg ? "torneos" : "torneos jugados"}
              </span>
            )}
          </header>
          {tcgStats.length > 1 && (
            <div className="flex overflow-x-auto border-b border-border px-2">
              <button
                onClick={() => {
                  setHistoryTcg(null);
                  setPage(1);
                }}
                className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition flex-shrink-0 ${
                  historyTcg === null
                    ? "border-primary text-foreground"
                    : "border-transparent text-foreground-secondary hover:text-foreground-secondary"
                }`}
              >
                Todos ({events.length})
              </button>
              {tcgStats.map((tcg) => {
                const count = events.filter((e: any) => e.game_id === tcg.game_id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={tcg.game_id}
                    onClick={() => {
                      setHistoryTcg(tcg.game_id);
                      setPage(1);
                    }}
                    className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition flex-shrink-0 ${
                      historyTcg === tcg.game_id
                        ? "border-primary text-foreground"
                        : "border-transparent text-foreground-secondary hover:text-foreground-secondary"
                    }`}
                  >
                    {tcg.game_name} ({count})
                  </button>
                );
              })}
            </div>
          )}
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-foreground-subtle">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Tienda</th>
                  <th className="px-4 py-2 text-left">TCG</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap">V / D</th>
                  <th className="px-4 py-2 text-right">Posición</th>
                  <th className="px-4 py-2 text-right">Puntos</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TournamentRowSkeleton key={i} actionClassName="h-[30px] w-[110px]" />
                    ))}
                  </>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-foreground-subtle">
                      Aún no has participado en ningún torneo.
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedEvents.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => openTournament(t.id)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openTournament(t.id);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Ver detalle del torneo en ${t.store}, ${fmtDate(t.date)}`}
                        className="border-b border-border/60 hover:bg-white/[0.03] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono-stat text-xs text-foreground-secondary">
                          {fmtDate(t.date)}
                        </td>
                        {/* max-w-0 + w-full: la columna toma el espacio sobrante y trunca,
                            así un nombre largo no aprieta la fecha ni las demás columnas. */}
                        <td className="w-full max-w-0 px-4 py-3 text-foreground">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate" title={`${t.store} · ${t.city}`}>
                              {t.store} <span className="text-xs text-foreground-subtle">· {t.city}</span>
                            </span>
                            {t.tournament_status === "APPROVED" && (
                              <span className="flex-shrink-0 rounded bg-yellow-500/15 px-1.5 py-0.5 text-xs font-medium text-yellow-300">
                                Pendiente de conteo oficial
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-foreground-secondary">{t.tcg}</td>
                        <td className="px-4 py-3 text-center font-mono-stat text-xs text-foreground-secondary whitespace-nowrap">
                          {t.wins != null && t.losses != null ? `${t.wins} / ${t.losses}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end leading-none">
                            <span
                              className={`font-mono-stat text-sm font-semibold ${
                                rankTier(t.placement)
                                  ? RANK_TIER_TEXT[rankTier(t.placement)!]
                                  : "text-foreground-secondary"
                              }`}
                            >
                              #{t.placement}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono-stat font-semibold text-foreground">
                          {fmtPts(t.pointsEarned)}
                        </td>
                        <td className="px-2 py-3 text-foreground-subtle">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrackerTournament({ id: t.id, game_id: t.game_id });
                              }}
                              title="Mis Partidas"
                              aria-label="Mis partidas de este torneo"
                              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                            >
                              <BarChart3 size={13} className="flex-shrink-0" />
                              <span className="hidden sm:inline">Partidas</span>
                            </button>
                            <ChevronRight size={14} />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {hasMore && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 text-center">
                          <button
                            onClick={() => setPage((p) => p + 1)}
                            className="text-xs text-primary hover:underline"
                          >
                            Ver más torneos
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden">
            {loading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex-1 space-y-2">
                      <SkeletonLine width="w-40" height="h-4" />
                      <SkeletonLine width="w-28" height="h-3" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <SkeletonBlock className="h-[30px] w-16 rounded-md" />
                      <SkeletonLine width="w-10" height="h-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="px-4 py-12 text-center text-foreground-subtle">
                Aún no has participado en ningún torneo.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {paginatedEvents.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => openTournament(t.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openTournament(t.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Ver detalle del torneo en ${t.store}, ${fmtDate(t.date)}`}
                    role="button"
                    className="cursor-pointer px-4 py-3 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {t.store}
                          {t.tournament_status === "APPROVED" && (
                            <span className="ml-2 inline-block rounded bg-yellow-500/15 px-1.5 py-0.5 text-xs font-medium text-yellow-300 align-middle">
                              Pendiente
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-foreground-subtle flex-wrap">
                          <span>{t.city}</span>
                          <span>·</span>
                          <span className="whitespace-nowrap">{fmtDate(t.date)}</span>
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
                        <div className="flex items-center justify-end gap-1 mb-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTrackerTournament({ id: t.id, game_id: t.game_id });
                            }}
                            title="Mis Partidas"
                            aria-label="Mis partidas de este torneo"
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                          >
                            <BarChart3 size={13} className="flex-shrink-0" />
                            <span className="hidden sm:inline">Partidas</span>
                          </button>
                          <div className="flex flex-col items-end leading-none">
                            <span
                              className={`font-mono-stat text-sm font-semibold ${
                                rankTier(t.placement)
                                  ? RANK_TIER_TEXT[rankTier(t.placement)!]
                                  : "text-foreground-secondary"
                              }`}
                            >
                              #{t.placement}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs font-mono-stat font-semibold text-foreground">{fmtPts(t.pointsEarned)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <div className="px-4 py-4 text-center">
                    <button onClick={() => setPage((p) => p + 1)} className="text-xs text-primary hover:underline">
                      Ver más torneos
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <DialogPrimitive.Root open={!!selectedTournamentId} onOpenChange={(o) => !o && closeModal()}>
          <AnimatePresence>
            {selectedTournamentId && (
              <DialogPrimitive.Portal forceMount>
                <DialogPrimitive.Overlay asChild forceMount>
                  <motion.div
                    key="tournament-modal-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 sm:p-6"
                  >
                    <DialogPrimitive.Content
                      asChild
                      forceMount
                      onClick={(e) => e.stopPropagation()}
                      aria-describedby={undefined}
                    >
                      <motion.div
                        key="tournament-modal-content"
                        initial={{ opacity: 0, y: 24, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.98 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="relative w-full max-w-6xl max-h-[calc(100vh-4rem-env(safe-area-inset-bottom))] lg:max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-4 border-b border-border pb-4 px-6 pt-6 sm:px-8 sm:pt-8 flex-shrink-0">
                          <div>
                            <DialogPrimitive.Title asChild>
                              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                                {loadingDetail ? "Cargando…" : (tournamentDetail?.game?.name ?? "—")}
                              </h2>
                            </DialogPrimitive.Title>
                          </div>
                          <button
                            onClick={closeModal}
                            className="rounded-md p-1.5 text-foreground-secondary hover:bg-white/10 hover:text-foreground"
                            aria-label="Cerrar"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="overflow-y-auto [scrollbar-gutter:stable] flex-1 min-h-0 px-6 pb-16 sm:pb-8 sm:px-8">
                          {loadingDetail ? (
                            <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                              {/* Columna principal */}
                              <div className="space-y-6 lg:col-span-2">
                                {/* Metadata grid */}
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                  {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="space-y-2">
                                      <SkeletonLine width="w-16" height="h-2" />
                                      <SkeletonLine width="w-24" height="h-4" />
                                      <SkeletonLine width="w-16" height="h-3" />
                                    </div>
                                  ))}
                                </div>

                                {/* Tabla de resultados */}
                                <div className="space-y-3">
                                  <SkeletonLine width="w-40" height="h-4" />
                                  <div className="overflow-hidden rounded-xl border border-border">
                                    <div className="border-b border-border px-3 py-2">
                                      <div className="grid grid-cols-5 gap-3">
                                        {["w-4", "w-24", "w-12", "w-12", "w-16"].map((w, i) => (
                                          <SkeletonLine key={i} width={w} height="h-2" />
                                        ))}
                                      </div>
                                    </div>
                                    <div className="divide-y divide-border">
                                      {Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="px-3 py-2.5 grid grid-cols-5 gap-3 items-center">
                                          <SkeletonLine width="w-6" height="h-3" />
                                          <SkeletonLine width="w-28" height="h-3" />
                                          <SkeletonLine width="w-10" height="h-3" />
                                          <SkeletonLine width="w-10" height="h-3" />
                                          <div className="flex justify-end">
                                            <SkeletonLine width="w-14" height="h-3" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Columna Performance Tracker */}
                              <div className="border-t border-border pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                                <SkeletonLine width="w-40" height="h-4" className="mb-4" />
                                <PerformanceTrackerSkeleton />
                              </div>
                            </div>
                          ) : tournamentDetail ? (
                            <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                              <div className="space-y-6 lg:sticky lg:top-0 lg:col-span-2">
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                  <div>
                                    <p className="text-xs text-foreground-subtle">Tienda</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                      {tournamentDetail.store.name}
                                    </p>
                                    <p className="text-xs text-foreground-subtle">
                                      {tournamentDetail.store.city}, {tournamentDetail.store.state}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-foreground-subtle">Fecha</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                      {new Date(tournamentDetail.date + "T12:00:00").toLocaleDateString("es-MX", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      })}
                                    </p>
                                    <p className="text-xs text-foreground-subtle">
                                      S{tournamentDetail.semester} {tournamentDetail.year}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-foreground-subtle">Participantes</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                      {tournamentDetail.total_participants}
                                    </p>
                                    {tournamentDetail.my_rank && (
                                      <p className="text-xs text-primary">Tu posición: #{tournamentDetail.my_rank}</p>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <h3 className="mb-3 text-sm font-semibold text-foreground">Resultados del torneo</h3>
                                  <div className="overflow-x-auto rounded-xl border border-border">
                                    <table className="w-full text-sm">
                                      <thead className="border-b border-border text-xs uppercase tracking-wider text-foreground-subtle">
                                        <tr>
                                          <th className="px-3 py-2 text-left">#</th>
                                          <th className="px-3 py-2 text-left">Nexus Tag</th>
                                          <th className="px-3 py-2 text-center whitespace-nowrap">V / D</th>
                                          <th className="px-3 py-2 text-right">OMW%</th>
                                          <th className="px-3 py-2 text-right">Puntos</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {tournamentDetail.rankings.map((r) => (
                                          <tr
                                            key={r.player_id}
                                            onClick={() => {
                                              if (!r.is_me) {
                                                closeModal();
                                                navigate({
                                                  to: "/players/$playerTag",
                                                  params: { playerTag: r.geek_tag },
                                                });
                                              }
                                            }}
                                            className={`border-t border-white/5 transition ${
                                              r.is_me ? "bg-primary/15" : "cursor-pointer hover:bg-white/5"
                                            }`}
                                          >
                                            <td className="px-3 py-2">
                                              <span
                                                className={`font-mono-stat text-sm font-semibold ${
                                                  rankTier(r.rank)
                                                    ? RANK_TIER_TEXT[rankTier(r.rank)!]
                                                    : "text-foreground"
                                                }`}
                                              >
                                                {String(r.rank).padStart(2, "0")}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-foreground">
                                              {r.is_me ? (
                                                <span className="font-semibold text-primary">
                                                  {r.geek_tag}
                                                  <span className="ml-2 rounded bg-primary/30 px-1.5 py-0.5 text-xs uppercase tracking-wider text-primary">
                                                    Tú
                                                  </span>
                                                </span>
                                              ) : (
                                                <span className="font-semibold text-foreground">{r.geek_tag}</span>
                                              )}
                                            </td>

                                            <td className="px-3 py-2 text-center font-mono-stat text-xs text-foreground-secondary whitespace-nowrap">
                                              {r.wins != null && r.losses != null ? `${r.wins} / ${r.losses}` : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono-stat text-xs text-foreground-secondary">
                                              {r.omw_percentage != null
                                                ? `${Number(r.omw_percentage).toFixed(1)}%`
                                                : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono-stat font-semibold text-foreground">
                                              {r.points_earned}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                              <div className="min-w-0 self-start border-t border-border pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                                <div className="mb-4 flex items-center justify-between">
                                  <h3 className="text-sm font-semibold text-foreground">Mis Partidas</h3>
                                  {editingTrackerInModal && (
                                    <button
                                      type="button"
                                      onClick={exitTrackerEditMode}
                                      className="text-xs font-semibold text-foreground-secondary hover:text-foreground"
                                    >
                                      Listo
                                    </button>
                                  )}
                                </div>
                                {editingTrackerInModal ? (
                                  <PerformanceTrackerModal
                                    embedded
                                    tournamentId={tournamentDetail.tournament_id}
                                    gameId={tournamentDetail.game_id}
                                    onClose={exitTrackerEditMode}
                                  />
                                ) : (
                                  <RoundsAccordionReadOnly
                                    key={roundsReloadKey}
                                    tournamentId={tournamentDetail.tournament_id}
                                    gameId={tournamentDetail.game_id}
                                    onAddTracker={() => setEditingTrackerInModal(true)}
                                  />
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="py-16 text-center text-sm text-foreground-subtle">
                              No se pudo cargar el torneo. Cierra esta ventana y vuelve a abrirlo; si sigue fallando,
                              revisa tu conexión.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </DialogPrimitive.Content>
                  </motion.div>
                </DialogPrimitive.Overlay>
              </DialogPrimitive.Portal>
            )}
          </AnimatePresence>
        </DialogPrimitive.Root>

        <AnimatePresence>
          {trackerTournament && (
            <motion.div
              key="tracker-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <PerformanceTrackerModal
                tournamentId={trackerTournament.id}
                gameId={trackerTournament.game_id}
                onClose={() => {
                  queryClient.removeQueries({ queryKey: ["tournament-rounds"] });
                  setTrackerTournament(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}

function TooltipInfo({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const id = React.useId();

  const open = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const width = Math.min(window.innerWidth - 32, 448);
      const left = Math.min(Math.max(rect.left, 16), window.innerWidth - width - 16);
      setPos({ top: rect.bottom + 8, left, width });
    }
    setShow(true);
  };

  useEffect(() => {
    if (!show) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setShow(false);
    const hide = () => setShow(false);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", hide, true);
    };
  }, [show]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="-m-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-subtle transition-colors hover:text-foreground"
        onMouseEnter={open}
        onMouseLeave={() => setShow(false)}
        onFocus={open}
        onBlur={() => setShow(false)}
        onClick={open}
        aria-label="Cómo se calculan los puntos"
        aria-expanded={show}
        aria-describedby={show ? id : undefined}
      >
        <HelpCircle size={14} />
      </button>
      {show &&
        ReactDOM.createPortal(
          <div
            id={id}
            role="tooltip"
            className="fixed z-[99999] rounded-xl border border-border bg-popover p-5 text-left text-sm leading-6 text-foreground-secondary shadow-2xl whitespace-pre-line"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

function TcgRankCard({ tcg, semesterLabel, monthLabel }: { tcg: any; semesterLabel: string; monthLabel: string }) {
  const [tab, setTab] = useState<"global" | "monthly">("global");
  const rankValue =
    tab === "global"
      ? tcg.rank_position > 0
        ? `#${tcg.rank_position}`
        : "—"
      : tcg.monthly_rank_position > 0
        ? `#${tcg.monthly_rank_position}`
        : "—";
  const points = tab === "global" ? tcg.total_points : tcg.monthly_total_points;
  const tier = rankTier(tab === "global" ? tcg.rank_position : tcg.monthly_rank_position);

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]">
      <div className="text-sm font-semibold text-foreground">{tcg.game_name}</div>

      <div className="flex gap-1 rounded-lg bg-secondary p-1">
        {(["global", "monthly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              tab === t ? "bg-primary text-primary-foreground" : "text-foreground-secondary hover:text-foreground"
            }`}
          >
            {t === "global" ? "Global" : "Mensual"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-foreground-subtle">{tab === "global" ? "Temporada" : "Mensual"}</div>
          <p className={`mt-1 font-mono-stat text-3xl font-bold ${tier ? RANK_TIER_TEXT[tier] : "text-foreground"}`}>
            {rankValue}
          </p>
          <p className="text-xs text-foreground-subtle">{tab === "global" ? semesterLabel : monthLabel}</p>
        </div>

        <div>
          <div className="text-xs text-foreground-subtle">Puntos</div>
          <p className="mt-1 font-mono-stat text-3xl font-bold text-foreground">{Number(points ?? 0).toFixed(0)}</p>
          <p className="text-xs text-foreground-subtle">{tab === "global" ? "De temporada" : "Del mes"}</p>
        </div>

        {tab === "global" && (
          <>
            <div>
              <div className="text-xs text-foreground-subtle">Jugados</div>
              <p className="mt-1 font-mono-stat text-2xl font-bold text-foreground">{tcg.tournaments_played}</p>
            </div>
            <div>
              <div className="text-xs text-foreground-subtle">Ganados</div>
              <p className="mt-1 font-mono-stat text-2xl font-bold text-foreground">{tcg.tournaments_won}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Rango de temporada con lo que cambió: subida/bajada desde el último torneo
 *  y puntos que faltan para alcanzar el lugar de arriba. */
function RankStory({ tcg, semesterLabel }: { tcg: any; semesterLabel: string }) {
  const rank: number = tcg?.rank_position ?? 0;
  const prev: number = tcg?.previous_rank_position ?? 0;
  const tier = rankTier(rank);
  const delta = rank > 0 && prev > 0 ? prev - rank : null;
  const lastDate = tcg?.last_tournament_date
    ? new Date(`${tcg.last_tournament_date}T12:00:00`).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
      })
    : null;
  const toNext: number | null = tcg?.points_to_next ?? null;

  let change: React.ReactNode = null;
  if (rank > 0 && prev === 0) {
    change = <span className="text-foreground-secondary">Nuevo en la tabla</span>;
  } else if (delta != null && delta > 0) {
    change = (
      <span className="inline-flex items-center gap-1 font-semibold text-success">
        <ArrowUp size={14} aria-hidden /> Subiste {delta} {delta === 1 ? "lugar" : "lugares"}
      </span>
    );
  } else if (delta != null && delta < 0) {
    change = (
      <span className="inline-flex items-center gap-1 font-semibold text-danger">
        <ArrowDown size={14} aria-hidden /> Bajaste {-delta} {delta === -1 ? "lugar" : "lugares"}
      </span>
    );
  } else if (delta === 0) {
    change = <span className="text-foreground-secondary">Mismo lugar</span>;
  }
  const showNext = toNext != null && rank > 1;

  return (
    <div className="sm:text-right">
      <div className="flex items-center gap-1 text-sm text-foreground-secondary sm:justify-end">
        Ranking Nacional · {semesterLabel}
        <TooltipInfo text={POINTS_HELP} />
      </div>
      <div
        className={`mt-1 font-mono-stat text-7xl font-bold leading-none tracking-tight sm:text-8xl ${
          tier ? RANK_TIER_TEXT[tier] : "text-foreground"
        }`}
      >
        {rank > 0 ? `#${rank}` : "—"}
      </div>
      {(change || showNext) && (
        <div className="mt-3 flex flex-col gap-1 text-sm sm:items-end">
          {change && (
            <p className="flex flex-wrap items-center gap-x-1.5">
              {change}
              {lastDate && <span className="text-foreground-subtle">desde tu torneo del {lastDate}</span>}
            </p>
          )}
          {showNext &&
            (toNext === 0 ? (
              <p className="text-foreground-secondary">Empatado en puntos con el #{rank - 1}</p>
            ) : (
              <p className="text-foreground-secondary">
                A{" "}
                <span className="font-mono-stat font-semibold text-foreground">
                  {Number(toNext.toFixed(1))} {toNext === 1 ? "pt" : "pts"}
                </span>{" "}
                del #{rank - 1}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

/** "Tu último torneo": resumen en la página del evento más reciente, con la tira
 *  de rondas (resultado + líder rival). El detalle completo sigue en el modal. */
function LastTournament({ event, onOpen, onTrack }: { event: any; onOpen: () => void; onTrack: () => void }) {
  const roundsQ = useQuery(tournamentRoundsQuery(event.id));
  const rounds: any[] = roundsQ.data?.rounds ?? [];
  const summary: any = roundsQ.data?.summary ?? null;
  const tagOf = new Map<string, string>(((roundsQ.data?.opponents ?? []) as any[]).map((o) => [o.id, o.geek_tag]));
  const tier = rankTier(event.placement);
  const hasRounds = rounds.length > 0;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Tu último torneo</h2>
          <p className="mt-0.5 min-w-0 text-sm text-foreground-secondary">
            <span className="block truncate sm:inline">{event.store}</span>
            <span className="text-foreground-subtle">
              <span className="hidden sm:inline"> · </span>
              {event.city}
            </span>
            <span className="whitespace-nowrap text-foreground-subtle">
              {" · "}
              {fmtDate(event.date)}
            </span>
          </p>
          {event.tournament_status === "APPROVED" && (
            <span className="mt-2 inline-block rounded bg-yellow-500/15 px-1.5 py-0.5 text-xs font-medium text-yellow-300">
              Pendiente de conteo oficial
            </span>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div
            className={`font-mono-stat text-4xl font-bold leading-none ${
              tier ? RANK_TIER_TEXT[tier] : "text-foreground"
            }`}
          >
            #{event.placement}
          </div>
          <div className="mt-1 whitespace-nowrap text-xs text-foreground-subtle">
            <span className="font-mono-stat">{fmtPts(event.pointsEarned)}</span> pts
            {event.wins != null && event.losses != null && (
              <>
                {" · "}
                <span className="font-mono-stat">
                  {event.wins}V–{event.losses}D
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {roundsQ.isLoading ? (
        <div className="flex gap-3 px-5 py-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[92px] flex-1 animate-pulse rounded-md bg-white/[0.06]" />
          ))}
        </div>
      ) : roundsQ.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-foreground-secondary">
          No se pudieron cargar tus rondas.
          <button
            onClick={() => roundsQ.refetch()}
            className="inline-flex min-h-8 items-center rounded-md border border-border px-3 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-white/5 hover:text-foreground"
          >
            Reintentar
          </button>
        </div>
      ) : !hasRounds ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-foreground-secondary">
            Aún no registras las rondas de este torneo. Anota contra qué líder jugaste cada una para ver tus matchups.
          </p>
          <button
            onClick={onTrack}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
          >
            Registrar rondas
          </button>
        </div>
      ) : (
        <ol className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0 sm:overflow-x-auto">
          {rounds.map((r) => {
            const leader = r.opponent_leader;
            const result = r.won_match === true ? "V" : r.won_match === false ? "D" : "—";
            const resultClass =
              r.won_match === true ? "text-success" : r.won_match === false ? "text-danger" : "text-foreground-subtle";
            return (
              <li
                key={r.id}
                className="flex min-w-0 items-center gap-3 px-5 py-3 sm:min-w-[9.5rem] sm:flex-1 sm:flex-col sm:items-start sm:gap-2"
              >
                <div className="flex w-12 flex-shrink-0 items-baseline gap-2 sm:w-auto">
                  <span className="font-mono-stat text-xs text-foreground-subtle">R{r.round_number}</span>
                  <span
                    className={`font-mono-stat text-lg font-bold ${resultClass}`}
                    aria-label={result === "V" ? "Victoria" : result === "D" ? "Derrota" : "Sin resultado"}
                  >
                    {result}
                  </span>
                </div>
                {r.is_bye ? (
                  <p className="text-sm text-foreground-secondary">Bye</p>
                ) : (
                  <div className="flex min-w-0 items-center gap-2.5">
                    {leader?.card_image ? (
                      <img
                        src={leader.card_image}
                        alt={leader.base_name ?? "Líder rival"}
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-10 flex-shrink-0 rounded border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded border border-border">
                        <ShieldQuestion size={14} className="text-foreground-subtle" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {leader?.base_name ?? "Líder sin registrar"}
                      </p>
                      {r.opponent_player_id && tagOf.get(r.opponent_player_id) && (
                        <p className="truncate text-xs text-foreground-subtle">vs {tagOf.get(r.opponent_player_id)}</p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
        <p className="text-xs text-foreground-subtle">
          {summary?.toughest_opponent_tag ? (
            <>
              Rival más difícil:{" "}
              <span className="font-medium text-foreground-secondary">{summary.toughest_opponent_tag}</span>
              {summary.toughest_opponent_rank != null && (
                <span className="font-mono-stat"> (#{summary.toughest_opponent_rank})</span>
              )}
            </>
          ) : (
            " "
          )}
        </p>
        <div className="flex items-center gap-2">
          {hasRounds && (
            <button
              onClick={onTrack}
              className="inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-white/5 hover:text-foreground"
            >
              Editar rondas
            </button>
          )}
          <button
            onClick={onOpen}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-white/5 hover:text-foreground"
          >
            Ver detalle <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      </footer>
    </section>
  );
}

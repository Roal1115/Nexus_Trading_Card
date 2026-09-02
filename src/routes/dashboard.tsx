import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BarChart3,
  Check,
  ChevronRight,
  Crown,
  Globe,
  HelpCircle,
  Layers,
  Lock,
  Share2,
  Store as StoreIcon,
  Swords,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

import { toast } from "sonner";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { toggleProfilePrivacy } from "@/lib/nexus-player.functions";
import { myDashboardQuery, tournamentDetailQuery } from "@/lib/dashboard-queries";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { PerformanceTrackerModal } from "@/components/tournament-tracker/PerformanceTrackerModal";
import { RoundsAccordionReadOnly } from "@/components/tournament-tracker/RoundsAccordionReadOnly";
import { motion, AnimatePresence } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  TcgRankCardSkeleton,
  TournamentRowSkeleton,
  SkeletonLine,
  SkeletonBlock,
} from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/dashboard")({
  // Best effort (no relanza). En SSR (carga fresca) casi siempre falla: el
  // token del usuario vive en localStorage del navegador, inaccesible en el
  // request del servidor — esta app no usa auth por cookie. El valor real
  // de este loader es el hover/intent en SPA (nav ya logueada en cliente,
  // donde attachNexusAuth sí puede adjuntar el token), igual que Player
  // Profile y Meta.
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(myDashboardQuery());
    } catch {
      return undefined;
    }
  },
  head: () => ({ meta: [{ title: "Mi Panel — Nexus" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { player: gaPlayer } = useNexusRole();
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

  const togglePrivacyFn = useServerFn(toggleProfilePrivacy);
  const [isPublic, setIsPublic] = useState(true);
  const [copiedProfile, setCopiedProfile] = useState(false);

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
      toast.success(next ? "Perfil ahora es público" : "Perfil ahora es privado");
    } catch {
      setIsPublic(!next);
      toast.error("Error al cambiar la privacidad");
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
    setSelectedTournamentId(tournament_id);
  };

  const closeModal = () => {
    setSelectedTournamentId(null);
  };

  useEffect(() => {
    if (data?.tcgStats?.length && !selectedTcg) {
      setSelectedTcg(data.tcgStats[0].game_id);
    }
  }, [data, selectedTcg]);

  if (!gaPlayer) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Debes iniciar sesión</h2>
        <p className="mt-2 text-sm text-gray-400">Tu dashboard muestra tu historial competitivo.</p>
        <Link
          to="/login"
          className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const tag = gaPlayer.geek_tag;
  const handleShareProfile = async () => {
    const url = `https://mxntcg.lovable.app/players/${tag}`;
    const shareData = {
      title: `${tag} — Nexus`,
      text: `Mira mi ranking competitivo en Nexus 🏆`,
      url,
    };

    // Web Share API disponible en mobile (Android/iOS) y algunos desktop
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err: any) {
        // Usuario canceló — no es un error real
        if (err?.name !== "AbortError") {
          // Fallback a clipboard si falla
          navigator.clipboard.writeText(url);
          setCopiedProfile(true);
          setTimeout(() => setCopiedProfile(false), 2000);
        }
      }
    } else {
      // Fallback para desktop donde Web Share API no está disponible
      navigator.clipboard.writeText(url);
      setCopiedProfile(true);
      setTimeout(() => setCopiedProfile(false), 2000);
    }
  };

  const tcgStats = data?.tcgStats ?? [];

  const top3DecksByGame = (data as any)?.top3DecksByGame ?? {};
  const globalRecord = (data as any)?.globalRecord ?? { wins: 0, losses: 0, total: 0 };

  // Inicializar statsTcg al primer TCG disponible
  const statsGameIds = Object.keys(top3DecksByGame);
  const activeStatsTcg = statsTcg ?? statsGameIds[0] ?? null;
  const top3Decks = activeStatsTcg ? (top3DecksByGame[activeStatsTcg] ?? []) : [];

  const activeTcg = tcgStats.find((t) => t.game_id === selectedTcg) ?? tcgStats[0];
  const hasHistory = (data?.totalTournamentsAttended ?? 0) > 0;

  const storeCity = data?.storeCity ?? null;
  const semesterLabel = data?.semesterLabel ?? "";
  const events = data?.events ?? [];
  const filteredEvents = historyTcg ? events.filter((e: any) => e.game_id === historyTcg) : events;
  const paginatedEvents = filteredEvents.slice(0, page * PAGE_SIZE);
  const hasMore = filteredEvents.length > page * PAGE_SIZE;

  // Calcular placement delta torneo vs torneo anterior
  // events está ordenado por fecha DESC — index 0 es el más reciente
  const getPlacementDelta = (index: number): number | null => {
    // El más reciente (index 0) no tiene anterior
    const current = filteredEvents[index];
    const previous = filteredEvents[index + 1];
    if (!previous) return null;
    // Delta positivo = mejoró (bajó de número de posición)
    return previous.placement - current.placement;
  };

  function PlacementDelta({ delta }: { delta: number | null }) {
    if (delta === null) return null; // primer torneo, sin tag
    if (delta === 0) return <span className="text-[8px] text-gray-600">—</span>;
    if (delta > 0) return <span className="text-[8px] font-bold text-emerald-400">▲{delta}</span>;
    return <span className="text-[8px] font-bold text-red-400">▼{Math.abs(delta)}</span>;
  }

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
      <main className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-20">
        {/* Toggle de privacidad */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="uppercase tracking-widest">Visibilidad del perfil:</span>
            <span
              className={`inline-flex items-center gap-1 font-semibold ${isPublic ? "text-emerald-400" : "text-gray-300"}`}
            >
              {isPublic ? (
                <>
                  <Globe size={12} /> Público
                </>
              ) : (
                <>
                  <Lock size={12} /> Privado
                </>
              )}
            </span>
          </div>
          <button
            onClick={handleTogglePrivacy}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition"
          >
            {isPublic ? "Hacer privado" : "Hacer público"}
          </button>
        </div>
        {/* Hero */}
        <section className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/60 via-primary/10 to-black/40">
          <div className="absolute -right-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />

          {/* Fila superior — Geek Tag + Ranks */}
          <div className="relative flex flex-col flex-wrap items-start gap-6 p-8 sm:flex-row sm:items-end sm:justify-between sm:p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Tu Geek Tag
              </p>
              <h1 className="mt-2 break-words text-5xl font-bold text-white sm:text-7xl">{tag}</h1>
              <p className="mt-2 text-sm text-gray-400">{storeCity ?? "—"}</p>
            </div>
            {loading ? (
              <div className="flex gap-3 flex-wrap">
                <div className="h-24 w-32 animate-pulse rounded-xl bg-white/[0.06]" />
                <div className="h-24 w-32 animate-pulse rounded-xl bg-white/[0.06]" />
              </div>
            ) : !hasHistory ? (
              // Sin historial: un solo CTA en vez de 4 cards mostrando "—" —
              // le dice al jugador qué hacer, no solo que no hay datos.
              <div className="flex max-w-xs flex-col items-start gap-3 rounded-xl border border-primary/30 bg-black/40 px-5 py-4">
                <p className="text-sm text-gray-300">
                  Aún no has jugado ningún torneo. Busca uno cerca de ti y empieza tu ranking.
                </p>
                <Link
                  to="/calendar"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
                >
                  Ver calendario de torneos →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                {/* Rank global — el número que más le importa al jugador al entrar, así que es el foco visual */}
                <div className="rounded-xl border border-primary/30 bg-black/40 px-6 py-5 text-center min-w-[140px]">
                  <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-primary mb-1">
                    <Crown size={10} /> Rank Global
                  </div>
                  <div className="font-mono text-5xl font-bold text-white">
                    {activeTcg?.rank_position > 0 ? `#${activeTcg.rank_position}` : "—"}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{semesterLabel}</p>
                </div>

                {/* Secundarios — mismo dato pero con menor peso visual */}
                <div className="flex gap-2 flex-wrap">
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3.5 py-2.5 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">
                      <Crown size={9} /> Mensual
                    </div>
                    <div className="font-mono text-lg font-bold text-white">
                      {activeTcg?.monthly_rank_position > 0 ? `#${activeTcg.monthly_rank_position}` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3.5 py-2.5 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">
                      <StoreIcon size={9} /> Tienda favorita
                    </div>
                    <div className="text-xs font-bold text-white leading-tight">
                      {data?.mostVisitedStore?.name ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3.5 py-2.5 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">
                      <Swords size={9} /> Torneos
                    </div>
                    <div className="font-mono text-lg font-bold text-white">
                      {data?.totalTournamentsAttended ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Franja inferior — Stats (oculta si aún no hay historial: el CTA
              de arriba ya cubre ese caso, no hace falta repetirlo) */}
          {(loading || hasHistory) && (
            <div className="relative border-t border-white/10 px-8 py-4 sm:px-12">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Izquierda — Tabs TCG + W-L */}
                {loading ? (
                  <div className="flex items-center gap-4">
                    <div className="h-6 w-16 rounded bg-white/[0.06] animate-pulse" />
                    <div className="h-8 w-32 rounded bg-white/[0.06] animate-pulse" />
                  </div>
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
                              className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                                activeStatsTcg === gid
                                  ? "bg-primary/20 text-primary"
                                  : "text-gray-500 hover:text-gray-300"
                              }`}
                            >
                              {tcgName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl font-bold text-emerald-400">
                        {globalRecord.wins}W
                      </span>
                      <span className="font-mono text-lg text-gray-600">·</span>
                      <span className="font-mono text-2xl font-bold text-red-400">
                        {globalRecord.losses}L
                      </span>
                      <span className="ml-1 text-[10px] text-gray-600">
                        {globalRecord.total} partidas
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600">Sin partidas con resultados registrados aún.</div>
                )}

                {/* Derecha — CTA Ver mis stats */}
                {loading ? (
                  <div className="h-10 w-36 rounded-xl bg-white/[0.06] animate-pulse" />
                ) : (
                  <Link
                    to="/my-stats"
                    className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_rgba(232,106,34,0.4)]"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                    <BarChart3
                      size={15}
                      className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                    />
                    <span className="relative">Ver mis stats</span>
                    <span className="relative text-[10px] font-normal opacity-60 group-hover:opacity-100 transition-opacity">
                      →
                    </span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Links — Ver perfil + Compartir */}
          <div className="relative flex flex-wrap items-center gap-3 border-t border-white/5 px-8 py-3 sm:px-12">
            <Link
              to="/players/$playerTag"
              params={{ playerTag: tag }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver mi perfil público →
            </Link>
            <button
              onClick={handleShareProfile}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
            >
              {copiedProfile ? (
                <>
                  <Check size={12} /> ¡Link copiado!
                </>
              ) : (
                <>
                  <Share2 size={12} /> Compartir mi perfil
                </>
              )}
            </button>
          </div>
        </section>

        {gaPlayer && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Mis Sesiones</h2>
              <Link to="/sessions" className="text-xs font-medium text-primary hover:underline">
                Ver todas →
              </Link>
            </div>
            <Link
              to="/sessions"
              className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-primary/30 hover:bg-black/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-105">
                <Layers size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Performance Tracker</p>
                <p className="text-xs text-gray-400">
                  Registra tus partidas durante torneos y prácticas
                </p>
              </div>
              <ChevronRight
                size={18}
                className="ml-auto text-gray-500 transition group-hover:text-primary"
              />
            </Link>
          </section>
        )}

        {/* Mis Rankings */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Mis Rankings
              <TooltipInfo
                text={`¿Cómo se calculan tus puntos?

Puntos Arena: Cada torneo normaliza tus puntos con la fórmula:
(tus match points ÷ match points del 1er lugar) × 100

Regla top 2 por semana: Si juegas más de 2 torneos del mismo TCG en la misma semana (lunes a domingo), solo tus 2 mejores resultados cuentan para el leaderboard.

Leaderboard mensual: Suma de tus Pts Arena en el mes actual.
Leaderboard de temporada: Suma acumulada durante la temporada completa.`}
              />
            </h2>
          </div>
          {loading ? (
            <div className="flex flex-wrap gap-4">
              {[1, 2].map((i) => (
                <TcgRankCardSkeleton key={i} />
              ))}
            </div>
          ) : tcgStats.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-gray-500">
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

        {/* Recent */}
        <section className="glass mt-6 overflow-hidden rounded-2xl">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-primary" size={18} />
              <h2 className="text-lg font-semibold text-white">Torneos Recientes</h2>
            </div>
            <span className="text-xs uppercase tracking-wider text-gray-500">
              {filteredEvents.length} {historyTcg ? "torneos" : "torneos jugados"}
            </span>
          </header>
          {tcgStats.length > 1 && (
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
                        ? "border-primary text-white"
                        : "border-transparent text-gray-400 hover:text-gray-200"
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
              <thead className="bg-black/30 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Tienda</th>
                  <th className="px-4 py-2 text-left">TCG</th>
                  <th className="px-4 py-2 text-center whitespace-nowrap">V / D</th>
                  <th className="px-4 py-2 text-right">Posición</th>
                  <th className="px-4 py-2 text-right">Pts Arena</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TournamentRowSkeleton key={i} />
                    ))}
                  </>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      Aún no has participado en ningún torneo.
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedEvents.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => openTournament(t.id)}
                        className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 text-gray-400 font-mono-stat text-xs">{t.date}</td>
                        <td className="px-4 py-3 text-white">
                          {t.store} <span className="text-xs text-gray-500">· {t.city}</span>
                          {t.tournament_status === "APPROVED" && (
                            <span className="ml-2 inline-block rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-medium text-yellow-300 align-middle">
                              Pendiente de conteo oficial
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{t.tcg}</td>
                        <td className="px-4 py-3 text-center font-mono-stat text-xs text-gray-300 whitespace-nowrap">
                          {t.wins != null && t.losses != null ? `${t.wins} / ${t.losses}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end leading-none">
                            <span
                              className={`font-mono-stat text-sm font-semibold ${
                                t.placement <= 3 ? "text-primary" : "text-white"
                              }`}
                            >
                              #{t.placement}
                            </span>
                            <PlacementDelta delta={getPlacementDelta(paginatedEvents.indexOf(t))} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono-stat font-semibold text-white">
                          +{Number(t.pointsEarned).toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-gray-500">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrackerTournament({ id: t.id, game_id: t.game_id });
                              }}
                              title="Performance Tracker"
                              className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_16px_rgba(232,106,34,0.35)]"
                            >
                              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                              <BarChart3
                                size={13}
                                className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                              />
                              <span className="relative hidden sm:inline">Tracker</span>
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
              <div className="divide-y divide-white/5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-40 rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-2 w-24 rounded bg-white/[0.06] animate-pulse" />
                    </div>
                    <div className="h-3 w-10 rounded bg-white/[0.06] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                Aún no has participado en ningún torneo.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {paginatedEvents.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => openTournament(t.id)}
                    className="cursor-pointer px-4 py-3 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {t.store}
                          {t.tournament_status === "APPROVED" && (
                            <span className="ml-2 inline-block rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-medium text-yellow-300 align-middle">
                              Pendiente
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          <span>{t.city}</span>
                          <span>·</span>
                          <span>{t.date}</span>
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
                            title="Performance Tracker"
                            className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_16px_rgba(232,106,34,0.35)]"
                          >
                            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                            <BarChart3
                              size={13}
                              className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                            />
                            <span className="relative hidden sm:inline">Tracker</span>
                          </button>
                          <div className="flex flex-col items-end leading-none">
                            <span
                              className={`font-mono-stat text-sm font-semibold ${t.placement <= 3 ? "text-primary" : "text-white"}`}
                            >
                              #{t.placement}
                            </span>
                            <PlacementDelta delta={getPlacementDelta(paginatedEvents.indexOf(t))} />
                          </div>
                        </div>
                        <p className="text-xs font-mono-stat font-semibold text-white">
                          +{Number(t.pointsEarned).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <div className="px-4 py-4 text-center">
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="text-xs text-primary hover:underline"
                    >
                      Ver más torneos
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <DialogPrimitive.Root
          open={!!selectedTournamentId}
          onOpenChange={(o) => !o && closeModal()}
        >
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
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6"
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
                        className="glass relative w-full max-w-6xl max-h-[calc(100vh-4rem-env(safe-area-inset-bottom))] lg:max-h-[90vh] rounded-2xl border border-white/10 bg-black/80 flex flex-col"
                      >
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4 px-6 pt-6 sm:px-8 sm:pt-8 flex-shrink-0">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                      Detalle del Torneo
                    </p>
                    <DialogPrimitive.Title asChild>
                      <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                        {loadingDetail ? "Cargando…" : (tournamentDetail?.game?.name ?? "—")}
                      </h2>
                    </DialogPrimitive.Title>
                  </div>
                  <button
                    onClick={closeModal}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                    aria-label="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-16 sm:pb-8 sm:px-8">
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
                          <div className="overflow-hidden rounded-xl border border-white/10">
                            <div className="bg-black/40 px-3 py-2">
                              <div className="grid grid-cols-5 gap-3">
                                {["w-4", "w-24", "w-12", "w-12", "w-16"].map((w, i) => (
                                  <SkeletonLine key={i} width={w} height="h-2" />
                                ))}
                              </div>
                            </div>
                            <div className="divide-y divide-white/5">
                              {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="px-3 py-2.5 grid grid-cols-5 gap-3 items-center"
                                >
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
                      <div className="border-t border-white/10 pt-6 lg:col-span-1 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                        <SkeletonLine width="w-40" height="h-4" className="mb-4" />
                        {/* Summary card skeleton */}
                        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                          <SkeletonLine width="w-32" height="h-4" />
                          <SkeletonLine width="w-20" height="h-3" />
                          <div className="flex items-center gap-3 mt-3">
                            <SkeletonBlock className="h-14 w-10 rounded-md flex-shrink-0" />
                            <div className="space-y-2">
                              <SkeletonLine width="w-16" height="h-2" />
                              <SkeletonLine width="w-24" height="h-4" />
                            </div>
                          </div>
                          <div className="text-center space-y-1 mt-3">
                            <SkeletonLine width="w-16" height="h-2" className="mx-auto" />
                            <SkeletonLine width="w-24" height="h-8" className="mx-auto" />
                          </div>
                        </div>
                        {/* Rondas skeleton */}
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="mb-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <SkeletonBlock className="h-6 w-6 rounded-md" />
                              <SkeletonLine width="w-28" height="h-3" />
                            </div>
                            <SkeletonLine width="w-14" height="h-5" className="rounded-md" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : tournamentDetail ? (
                    <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                      <div className="space-y-6 lg:col-span-2">
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500">
                              Tienda
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {tournamentDetail.store.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {tournamentDetail.store.city}, {tournamentDetail.store.state}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500">
                              Fecha
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {new Date(tournamentDetail.date + "T12:00:00").toLocaleDateString(
                                "es-MX",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                },
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              S{tournamentDetail.semester} {tournamentDetail.year}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500">
                              Editorial
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {tournamentDetail.game.publisher}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500">
                              Participantes
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {tournamentDetail.total_participants}
                            </p>
                            {tournamentDetail.my_rank && (
                              <p className="text-xs text-primary">
                                Tu posición: #{tournamentDetail.my_rank}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                            Resultados del torneo
                          </h3>
                          <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full text-sm">
                              <thead className="bg-black/40 text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                  <th className="px-3 py-2 text-left">#</th>
                                  <th className="px-3 py-2 text-left">Geek Tag</th>
                                  <th className="px-3 py-2 text-center whitespace-nowrap">V / D</th>
                                  <th className="px-3 py-2 text-right">OMW%</th>
                                  <th className="px-3 py-2 text-right">Pts Arena</th>
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
                                        className={`font-mono-stat text-sm font-semibold ${r.rank <= 3 ? "text-primary" : "text-white"}`}
                                      >
                                        {String(r.rank).padStart(2, "0")}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-white">
                                      {r.is_me ? (
                                        <span className="font-semibold text-primary">
                                          {r.geek_tag}
                                          <span className="ml-2 rounded bg-primary/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                                            Tú
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="font-semibold text-white">
                                          {r.geek_tag}
                                        </span>
                                      )}
                                    </td>

                                    <td className="px-3 py-2 text-center font-mono-stat text-xs text-gray-300 whitespace-nowrap">
                                      {r.wins != null && r.losses != null
                                        ? `${r.wins} / ${r.losses}`
                                        : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono-stat text-xs text-gray-400">
                                      {r.omw_percentage != null
                                        ? `${Number(r.omw_percentage).toFixed(1)}%`
                                        : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono-stat font-semibold text-white">
                                      {r.points_earned}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      <div className="min-h-0 min-w-0 max-h-[50vh] overflow-y-auto border-t border-white/10 pt-6 lg:col-span-1 lg:max-h-[calc(90vh-80px)] lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0 lg:sticky lg:top-0">
                        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">
                          Performance Tracker
                        </h3>
                        <RoundsAccordionReadOnly
                          tournamentId={tournamentDetail.tournament_id}
                          gameId={tournamentDetail.game_id}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-sm text-gray-500">
                      No se pudo cargar el torneo.
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
                onClose={() => setTrackerTournament(null)}
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const onEnter = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const tooltipWidth = Math.min(window.innerWidth * 0.5, 600);
      const leftPos = Math.min(rect.left + window.scrollX, window.innerWidth - tooltipWidth - 16);
      setPos({ top: rect.bottom + window.scrollY + 8, left: Math.max(leftPos, 16) });
    }
    setShow(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="text-gray-600 hover:text-primary transition"
        onMouseEnter={onEnter}
        onMouseLeave={() => setShow(false)}
        aria-label="Más información"
      >
        <HelpCircle size={12} />
      </button>
      {show &&
        ReactDOM.createPortal(
          <div
            className="fixed z-[99999]"
            style={{ top: pos.top, left: pos.left, width: `min(50vw, 600px)` }}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
          >
            <div className="animate-in fade-in-0 zoom-in-95 duration-150 rounded-xl border border-primary/40 bg-[#0f1117] p-5 text-sm text-gray-200 leading-7 shadow-2xl whitespace-pre-line">
              {text}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function TcgRankCard({
  tcg,
  semesterLabel,
  monthLabel,
}: {
  tcg: any;
  semesterLabel: string;
  monthLabel: string;
}) {
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

  return (
    <div className="glass flex w-full flex-col gap-3 rounded-2xl border border-white/10 p-5 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white">
        <Crown size={14} className="text-primary" /> {tcg.game_name}
      </div>

      <div className="flex gap-1 rounded-lg bg-black/40 p-1">
        {(["global", "monthly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              tab === t ? "bg-primary text-primary-foreground" : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "global" ? "Global" : "Mensual"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-500">
            <Crown size={10} /> {tab === "global" ? "Rank Global" : "Rank Mes"}
          </div>
          <p className="mt-1 font-mono-stat text-3xl font-bold text-white">{rankValue}</p>
          <p className="text-[10px] text-gray-500">
            {tab === "global" ? semesterLabel : monthLabel}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-500">
            <Target size={10} className="text-primary" /> Puntos
          </div>
          <p className="mt-1 font-mono-stat text-3xl font-bold text-white">
            {Number(points ?? 0).toFixed(0)}
          </p>
          <p className="text-[10px] text-gray-500">Arena pts</p>
        </div>

        {tab === "global" && (
          <>
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-500">
                <Swords size={10} className="text-primary" /> Jugados
              </div>
              <p className="mt-1 font-mono-stat text-2xl font-bold text-white">
                {tcg.tournaments_played}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-500">
                <Award size={10} className="text-primary" /> Ganados
              </div>
              <p className="mt-1 font-mono-stat text-2xl font-bold text-white">
                {tcg.tournaments_won}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

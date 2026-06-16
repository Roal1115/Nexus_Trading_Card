import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Award, BarChart3, ChevronRight, Crown, Globe, HelpCircle, Lock, Swords, Target, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { getMyDashboard, getTournamentDetail, toggleProfilePrivacy } from "@/lib/geekarena-player.functions";
import { getActiveSponsor, registerAdView } from "@/lib/geekarena-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { PerformanceTrackerModal } from "@/components/tournament-tracker/PerformanceTrackerModal";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Mi Panel — Geek Arena" }] }),
  component: DashboardPage,
});

type DashboardData = Awaited<ReturnType<typeof getMyDashboard>>;
type TournamentDetail = Awaited<ReturnType<typeof getTournamentDetail>>;

function DashboardPage() {
  const { player: gaPlayer } = useGeekarenaRole();
  const fetchDashboard = useServerFn(getMyDashboard);
  const fetchTournamentDetail = useServerFn(getTournamentDetail);
  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const registerView = useServerFn(registerAdView);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTcg, setSelectedTcg] = useState<string | null>(null);
  const [sponsor, setSponsor] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [historyTcg, setHistoryTcg] = useState<string | null>(null);
  const PAGE_SIZE = 10;
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [trackerTournament, setTrackerTournament] = useState<{ id: string; game_id: string } | null>(null);
  const [tournamentDetail, setTournamentDetail] = useState<TournamentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const togglePrivacyFn = useServerFn(toggleProfilePrivacy);
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    registerView().then(setSponsor).catch(() => {
      fetchActiveSponsor().then(setSponsor).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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


  const openTournament = async (tournament_id: string) => {
    setSelectedTournamentId(tournament_id);
    setLoadingDetail(true);
    setTournamentDetail(null);
    try {
      const detail = await fetchTournamentDetail({ data: { tournament_id } });
      setTournamentDetail(detail);
    } catch {
      setTournamentDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedTournamentId(null);
    setTournamentDetail(null);
  };

  useEffect(() => {
    if (!gaPlayer) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchDashboard()
      .then((d) => {
        if (mounted) setData(d);
      })
      .catch(() => {
        if (mounted) setData(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaPlayer?.id]);

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
  const tcgStats = data?.tcgStats ?? [];
  const activeTcg = tcgStats.find((t) => t.game_id === selectedTcg) ?? tcgStats[0];
  
  const storeCity = data?.storeCity ?? null;
  const semesterLabel = data?.semesterLabel ?? "";
  const events = data?.events ?? [];
  const filteredEvents = historyTcg
    ? events.filter((e: any) => e.game_id === historyTcg)
    : events;
  const paginatedEvents = filteredEvents.slice(0, page * PAGE_SIZE);
  const hasMore = filteredEvents.length > page * PAGE_SIZE;

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
      <main className="min-w-0 pb-20">
      {/* Hero */}
      <section className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/60 via-primary/10 to-black/40 p-8 sm:p-12">
        <div className="absolute -right-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Tu Geek Tag</p>
            <h1 className="mt-2 break-all text-5xl font-bold text-white sm:text-7xl">{tag}</h1>
            <p className="mt-2 text-sm text-gray-400">{storeCity ?? "—"}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* Rank Global */}
            <div className="rounded-xl border border-primary/30 bg-black/40 px-5 py-4 text-center min-w-[120px]">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-primary mb-1">
                <Crown size={10} /> Global
              </div>
              <div className="font-mono text-4xl font-bold text-white">
                {loading ? "…" : activeTcg?.rank_position > 0 ? `#${activeTcg.rank_position}` : "—"}
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{semesterLabel}</p>
            </div>
            {/* Rank Mensual */}
            <div className="rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-center min-w-[120px]">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                <Crown size={10} /> Mensual
              </div>
              <div className="font-mono text-4xl font-bold text-white">
                {loading ? "…" : activeTcg?.monthly_rank_position > 0 ? `#${activeTcg.monthly_rank_position}` : "—"}
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{data?.monthLabel ?? "Este mes"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Toggle de privacidad */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="uppercase tracking-widest">Visibilidad del perfil:</span>
          <span className={`inline-flex items-center gap-1 font-semibold ${isPublic ? "text-emerald-400" : "text-gray-300"}`}>
            {isPublic ? <><Globe size={12} /> Público</> : <><Lock size={12} /> Privado</>}
          </span>
        </div>
        <button
          onClick={handleTogglePrivacy}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition"
        >
          {isPublic ? "Hacer privado" : "Hacer público"}
        </button>
      </div>

      {/* Mis Rankings */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Mis Rankings</h2>
          <TooltipInfo
            text={`¿Cómo se calculan tus puntos?

Puntos Arena: Cada torneo normaliza tus puntos con la fórmula:
(tus match points ÷ match points del 1er lugar) × 100

Regla top 2 por semana: Si juegas más de 2 torneos del mismo TCG en la misma semana (lunes a domingo), solo tus 2 mejores resultados cuentan para el leaderboard.

Leaderboard mensual: Suma de tus Pts Arena en el mes actual.
Leaderboard de temporada: Suma acumulada durante la temporada completa.`}
          />
        </div>
        {loading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-gray-500">Cargando…</div>
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
              onClick={() => { setHistoryTcg(null); setPage(1); }}
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
                  onClick={() => { setHistoryTcg(tcg.game_id); setPage(1); }}
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
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    Cargando…
                  </td>
                </tr>
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
                        <span
                          className={`font-mono-stat text-sm font-semibold ${
                            t.placement <= 3 ? "text-primary" : "text-white"
                          }`}
                        >
                          #{t.placement}
                        </span>
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
                            className="rounded-md p-1.5 text-gray-500 hover:bg-primary/15 hover:text-primary transition"
                          >
                            <BarChart3 size={16} />
                          </button>
                          <ChevronRight size={14} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {hasMore && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-center">
                        <button onClick={() => setPage((p) => p + 1)} className="text-xs text-primary hover:underline">
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
            <div className="px-4 py-12 text-center text-gray-500">Cargando…</div>
          ) : events.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">Aún no has participado en ningún torneo.</div>
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
                            <span className="whitespace-nowrap">{t.wins}V/{t.losses}D</span>
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
                          className="rounded-md p-1.5 text-gray-500 hover:bg-primary/15 hover:text-primary transition"
                        >
                          <BarChart3 size={16} />
                        </button>
                        <span className={`font-mono-stat text-sm font-semibold ${t.placement <= 3 ? "text-primary" : "text-white"}`}>
                          #{t.placement}
                        </span>
                      </div>
                      <p className="text-xs font-mono-stat font-semibold text-white">+{Number(t.pointsEarned).toFixed(2)}</p>
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

      {selectedTournamentId && (
        <div
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/80 p-6 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Detalle del Torneo</p>
                <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                  {loadingDetail ? "Cargando…" : (tournamentDetail?.game?.name ?? "—")}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-16 text-center text-sm text-gray-500">Cargando detalles…</div>
            ) : tournamentDetail ? (
              <div className="mt-5 space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Tienda</p>
                    <p className="mt-1 text-sm font-semibold text-white">{tournamentDetail.store.name}</p>
                    <p className="text-xs text-gray-500">
                      {tournamentDetail.store.city}, {tournamentDetail.store.state}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Fecha</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {new Date(tournamentDetail.date + "T12:00:00").toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-gray-500">
                      S{tournamentDetail.semester} {tournamentDetail.year}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Editorial</p>
                    <p className="mt-1 text-sm font-semibold text-white">{tournamentDetail.game.publisher}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Participantes</p>
                    <p className="mt-1 text-sm font-semibold text-white">{tournamentDetail.total_participants}</p>
                    {tournamentDetail.my_rank && (
                      <p className="text-xs text-primary">Tu posición: #{tournamentDetail.my_rank}</p>
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
                          <th className="px-3 py-2 text-center">V / D</th>
                          <th className="px-3 py-2 text-right">OMW%</th>
                          <th className="px-3 py-2 text-right">Pts Arena</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tournamentDetail.rankings.map((r) => (
                          <tr key={r.player_id} className={`border-t border-white/5 ${r.is_me ? "bg-primary/15" : ""}`}>
                            <td className="px-3 py-2">
                              <span
                                className={`font-mono-stat text-sm font-semibold ${
                                  r.rank <= 3 ? "text-primary" : "text-white"
                                }`}
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
                                <Link
                                  to="/players/$playerTag"
                                  params={{ playerTag: r.geek_tag }}
                                  onClick={closeModal}
                                  className="font-semibold text-white hover:text-primary transition hover:underline underline-offset-2"
                                >
                                  {r.geek_tag}
                                </Link>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-mono-stat text-xs text-gray-300">
                              {r.wins != null && r.losses != null ? `${r.wins} / ${r.losses}` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono-stat text-xs text-gray-400">
                              {r.omw_percentage != null ? `${Number(r.omw_percentage).toFixed(1)}%` : "—"}
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
            ) : (
              <div className="py-16 text-center text-sm text-gray-500">No se pudo cargar el torneo.</div>
            )}
          </div>
        </div>
      )}

      {trackerTournament && (
        <PerformanceTrackerModal
          tournamentId={trackerTournament.id}
          gameId={trackerTournament.game_id}
          onClose={() => setTrackerTournament(null)}
        />
      )}
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
            <div className="rounded-xl border border-primary/40 bg-[#0f1117] p-5 text-sm text-gray-200 leading-7 shadow-2xl whitespace-pre-line">
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
  const points =
    tab === "global" ? tcg.total_points : tcg.monthly_total_points;

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
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-gray-400 hover:text-white"
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

import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Award, ChevronRight, Crown, HelpCircle, Swords, Target, TrendingUp, X } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { getMyDashboard, getTournamentDetail } from "@/lib/geekarena-player.functions";
import { getActiveSponsor, registerAdView } from "@/lib/geekarena-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";


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
  const [tournamentDetail, setTournamentDetail] = useState<TournamentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    registerView().then(setSponsor).catch(() => {
      fetchActiveSponsor().then(setSponsor).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
  const totalPoints = activeTcg?.total_points ?? 0;
  const tournamentsPlayed = activeTcg?.tournaments_played ?? 0;
  const tournamentsWon = activeTcg?.tournaments_won ?? 0;
  const rank = activeTcg?.rank_position ?? 0;
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
          <div className="rounded-xl border border-primary/30 bg-black/40 px-6 py-4 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-primary">
              <Crown size={12} />
              {activeTcg ? `Rank · ${activeTcg.game_name}` : "Rank Nacional"}
            </div>
            <div className="font-mono-stat text-5xl font-bold text-white">
              {loading ? "…" : rank > 0 ? `#${rank}` : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* TCG selector */}
      {tcgStats.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tcgStats.map((tcg) => (
            <button
              key={tcg.game_id}
              onClick={() => setSelectedTcg(tcg.game_id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                selectedTcg === tcg.game_id ? "bg-primary text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {tcg.game_name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Target className="text-primary" size={18} />}
          label="Puntos Totales"
          value={Number(totalPoints).toFixed(2)}
          sub={semesterLabel || "—"}
          tooltip={`¿Cómo se calculan tus puntos?

Puntos Arena: Cada torneo normaliza tus puntos con la fórmula:
(tus match points ÷ match points del 1er lugar) × 100

Ejemplo: Si el 1er lugar tuvo 12 pts y tú tuviste 9 pts → (9÷12)×100 = 75.00 Pts Arena

Regla top 2 por semana: Si juegas más de 2 torneos del mismo TCG en la misma semana (lunes a domingo), solo tus 2 mejores resultados cuentan para el leaderboard. Los torneos extra se descartan.

Leaderboard mensual: Suma de tus Pts Arena en el mes actual.

Leaderboard de temporada: Suma acumulada de todos tus torneos durante la temporada completa, aplicando siempre la regla del top 2 por semana.

Desempate: Si tienes los mismos puntos que otro jugador, se desempata por torneos ganados, luego por torneos jugados, y finalmente por OMW% promedio.`}
        />
        <StatCard
          icon={<Swords className="text-primary" size={18} />}
          label="Torneos Jugados"
          value={String(tournamentsPlayed)}
          sub="Esta temporada"
        />
        <StatCard
          icon={<Award className="text-primary" size={18} />}
          label="Torneos Ganados"
          value={String(tournamentsWon)}
          sub="1er lugar"
        />
      </section>

      {/* Recent */}
      <section className="glass mt-6 overflow-hidden rounded-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary" size={18} />
            <h2 className="text-lg font-semibold text-white">Torneos Recientes</h2>
          </div>
          <span className="text-xs uppercase tracking-wider text-gray-500">{events.length} torneos jugados</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Tienda</th>
                <th className="px-4 py-2 text-left">TCG</th>
                <th className="px-4 py-2 text-center">V / D</th>
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
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{t.tcg}</td>
                      <td className="px-4 py-3 text-center font-mono-stat text-xs text-gray-300">
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
                        <ChevronRight size={14} />
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
      </section>

      {selectedTournamentId && (
        <div
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/80 p-6 sm:p-8"
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
                              {r.geek_tag}
                              {r.is_me && (
                                <span className="ml-2 rounded bg-primary/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                                  Tú
                                </span>
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
    </main>
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}


function StatCard({
  icon,
  label,
  value,
  sub,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const tooltipWidth = Math.min(window.innerWidth * 0.5, 600);
      const leftPos = Math.min(rect.left + window.scrollX, window.innerWidth - tooltipWidth - 16);
      setTooltipPos({
        top: rect.bottom + window.scrollY + 8,
        left: Math.max(leftPos, 16),
      });
    }
    setShowTooltip(true);
  };

  return (
    <div className="glass rounded-2xl p-6 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
          {icon} {label}
        </div>
        {tooltip && (
          <>
            <button
              ref={btnRef}
              className="text-gray-600 hover:text-primary transition"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={() => setShowTooltip(false)}
              aria-label="Más información"
            >
              <HelpCircle size={14} />
            </button>
            {showTooltip &&
              ReactDOM.createPortal(
                <div
                  className="fixed z-[99999]"
                  style={{
                    top: tooltipPos.top,
                    left: tooltipPos.left,
                    width: `min(50vw, 600px)`,
                  }}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <div className="rounded-xl border border-primary/40 bg-[#0f1117] p-5 text-sm text-gray-200 leading-7 shadow-2xl whitespace-pre-line">
                    {tooltip}
                  </div>
                </div>,
                document.body,
              )}
          </>
        )}
      </div>
      <div className="mt-3 font-mono-stat text-4xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{sub}</div>
    </div>
  );
}

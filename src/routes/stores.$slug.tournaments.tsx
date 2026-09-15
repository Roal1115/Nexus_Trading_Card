import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Medal, Gift, Clock, Trophy } from "lucide-react";
import {
  useWeekNav,
  useCalendarGrid,
  WeeklyGrid,
  dotColorForGame,
} from "@/components/calendar/weekly-grid";
import { getStoreActiveLeagues, logStorePageView } from "@/lib/nexus-public.functions";
import { storeProfileQuery, storeTournamentHistoryQuery } from "@/lib/stores-queries";
import { publicCalendarQuery } from "@/lib/calendar-queries";
import { SkeletonLine } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/stores/$slug/tournaments")({
  head: () => ({ meta: [{ title: "Torneos y Liga — Nexus" }] }),
  component: StoreTournamentsPage,
});

function StoreTournamentsPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  // Misma query key que la capa padre (stores.$slug.tsx) — ya está en caché,
  // así que esto no dispara una segunda request de red.
  const { data: profileData } = useQuery({ ...storeProfileQuery(slug), retry: false });
  const store = profileData?.store;

  const { weekDates, weekStartStr, goToPrevWeek, goToNextWeek, goToToday, weekLabel } =
    useWeekNav();
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const { data: calendarData, isLoading: calLoading } = useQuery({
    ...publicCalendarQuery({
      game_id: null,
      zone: null,
      store_id: store?.id ?? null,
      store_ids: null,
      week_start: weekStartStr,
    }),
    enabled: !!store?.id,
  });
  const events = calendarData?.events ?? [];

  const { data: historyData, isLoading: historyLoading } = useQuery({
    ...storeTournamentHistoryQuery(slug),
    enabled: !!slug,
  });
  const tournamentHistory = historyData?.tournaments ?? [];
  const uniqueHistoryGames = Array.from(
    new Map(
      tournamentHistory
        .filter((t) => t.game_id)
        .map((t) => [t.game_id, { id: t.game_id, name: t.game_name }]),
    ).values(),
  );
  const [historyGameFilter, setHistoryGameFilter] = useState<string | null>(null);
  const filteredHistory = historyGameFilter
    ? tournamentHistory.filter((t) => t.game_id === historyGameFilter)
    : tournamentHistory;
  const HISTORY_PAGE_SIZE = 10;
  const [historyPage, setHistoryPage] = useState(1);
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE,
  );

  const fetchActiveLeagues = useServerFn(getStoreActiveLeagues);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [leagueLoading, setLeagueLoading] = useState(true);

  useEffect(() => {
    if (!store?.slug) return;
    setLeagueLoading(true);
    fetchActiveLeagues({ data: { slug: store.slug } })
      .then((res: any) => setLeagues(res.leagues ?? []))
      .catch(() => setLeagues([]))
      .finally(() => setLeagueLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.slug]);

  // Ahora que "calendario" y "liga interna" viven en su propia página (en vez
  // de secciones observadas por IntersectionObserver dentro de un solo
  // scroll), registrar la visita al montar cubre el mismo caso de uso: el
  // visitante llegó a la actividad competitiva de la tienda.
  const logView = useServerFn(logStorePageView);
  const loggedRef = useRef(false);
  useEffect(() => {
    if (!store?.id || loggedRef.current) return;
    loggedRef.current = true;
    logView({ data: { store_id: store.id, section: "calendario" } }).catch(() => {});
    logView({ data: { store_id: store.id, section: "liga_interna" } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  const calendarGrid = useCalendarGrid(events, weekDates);
  const gamesInSchedule = Array.from(
    new Map(events.map((e) => [e.game_slug, e.game_name])).entries(),
  );

  if (!store) return null;

  return (
    <div className="space-y-6">
      <section className="glass space-y-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Calendario de torneos</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevWeek}
              className="rounded-lg border border-border p-2 text-secondary-foreground hover:text-white transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-white">
              {weekLabel}
            </span>
            <button
              onClick={goToNextWeek}
              className="rounded-lg border border-border p-2 text-secondary-foreground hover:text-white transition"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={goToToday}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:text-white transition"
            >
              Hoy
            </button>
          </div>
        </div>

        {gamesInSchedule.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {gamesInSchedule.map(([slugKey, name]) => (
              <div key={slugKey} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className={`h-2 w-2 rounded-full ${dotColorForGame(slugKey)}`} />
                {name}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
          <WeeklyGrid
            weekDates={weekDates}
            calendarGrid={calendarGrid}
            attendedIds={new Set()}
            loading={calLoading}
            onSelectEntry={setSelectedEntry}
          />
        </div>
      </section>

      {leagueLoading ? (
        <section className="glass space-y-4 rounded-2xl p-6">
          <div>
            <SkeletonLine width="w-24" height="h-3" />
            <div className="mt-2">
              <SkeletonLine width="w-48" height="h-5" />
            </div>
            <div className="mt-2">
              <SkeletonLine width="w-32" height="h-3" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SkeletonLine width="w-24" height="h-4" />
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/80 text-left text-[10px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                  <th className="px-3 py-2 text-right">Trn</th>
                  <th className="px-3 py-2 text-right">W</th>
                  <th className="px-3 py-2 text-right">OMW%</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2.5">
                      <SkeletonLine width="w-4" height="h-3" />
                    </td>
                    <td className="px-3 py-2.5">
                      <SkeletonLine width="w-24" height="h-3" />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end">
                        <SkeletonLine width="w-10" height="h-3" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end">
                        <SkeletonLine width="w-6" height="h-3" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end">
                        <SkeletonLine width="w-6" height="h-3" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end">
                        <SkeletonLine width="w-10" height="h-3" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!leagueLoading && leagues.length > 0 && (
        <div className="space-y-4">
          {/* Una sección por Liga Interna activa — una tienda puede correr
            una liga por TCG en paralelo (One Piece, Riftbound, etc.), así
            que ya no asumimos que hay una sola. */}
          {leagues.map((league: any) => (
            <section key={league.id} className="glass space-y-4 rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                      Liga Interna
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">
                      {league.game_name}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-white">{league.name}</h2>
                  <p className="text-xs text-gray-500">
                    {league.start_date} — {league.end_date}
                  </p>
                </div>
                {(() => {
                  const daysLeft = Math.ceil(
                    (new Date(league.end_date + "T23:59:59").getTime() - Date.now()) / 86_400_000,
                  );
                  if (daysLeft < 0) return null;
                  return (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {daysLeft === 0 ? "Último día" : `${daysLeft} días restantes`}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Medal size={16} className="text-primary" />
                Leaderboard
              </div>
              {league.standings.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Aún no hay resultados registrados en esta liga.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-black/80 text-left text-[10px] uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Tag</th>
                        <th className="px-3 py-2 text-right">Pts</th>
                        <th className="px-3 py-2 text-right" title="Torneos jugados">
                          Trn
                        </th>
                        <th className="px-3 py-2 text-right" title="Victorias">
                          W
                        </th>
                        <th className="px-3 py-2 text-right" title="Opponent Match Win %">
                          OMW%
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {league.standings.map((s: any, i: number) => {
                        const medalColor =
                          i === 0
                            ? "text-amber-400"
                            : i === 1
                              ? "text-slate-300"
                              : i === 2
                                ? "text-orange-400"
                                : "";
                        return (
                          <tr
                            key={s.player_id}
                            className={`border-t border-white/5 transition hover:bg-white/5 ${i < 3 ? "bg-primary/[0.03]" : ""}`}
                          >
                            <td className="px-3 py-2">
                              {i < 3 ? (
                                <Trophy size={14} className={medalColor} />
                              ) : (
                                <span className="font-mono text-xs text-gray-400">{i + 1}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Link
                                to="/players/$playerTag"
                                params={{ playerTag: s.geek_tag }}
                                className={`font-medium hover:text-primary hover:underline ${i < 3 ? "font-semibold text-white" : "text-white"}`}
                              >
                                {s.geek_tag}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-white">
                              {s.total_points}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                              {s.tournaments_played}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                              {s.tournaments_won}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                              {s.omw_percentage}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {league.prizes.length > 0 && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Gift size={16} className="text-primary" />
                    Premios y Recompensas
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {league.prizes.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                      >
                        {p.image_url && (
                          <img src={p.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                        )}
                        <p className="text-sm text-gray-300">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <section className="glass space-y-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-white">Historial de torneos</h2>
          {uniqueHistoryGames.length === 1 && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {uniqueHistoryGames[0].name}
            </span>
          )}
        </div>

        {uniqueHistoryGames.length > 1 && (
          <div className="flex overflow-x-auto border-b border-white/10">
            <button
              onClick={() => {
                setHistoryGameFilter(null);
                setHistoryPage(1);
              }}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition flex-shrink-0 ${
                historyGameFilter === null
                  ? "border-primary text-white"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              Todos ({tournamentHistory.length})
            </button>
            {uniqueHistoryGames.map((g) => {
              const count = tournamentHistory.filter((t) => t.game_id === g.id).length;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setHistoryGameFilter(g.id);
                    setHistoryPage(1);
                  }}
                  className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition flex-shrink-0 ${
                    historyGameFilter === g.id
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

        {historyLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLine key={i} width="w-full" height="h-9" />
            ))}
          </div>
        ) : filteredHistory.length === 0 ? (
          <p className="text-sm text-gray-500">
            {tournamentHistory.length === 0
              ? "Esta tienda aún no tiene torneos registrados en el circuito."
              : "Sin torneos para este TCG."}
          </p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-white/10 sm:block">
              <table className="w-full text-sm">
                <thead className="bg-black/30 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    {uniqueHistoryGames.length > 1 && <th className="px-4 py-2 text-left">TCG</th>}
                    <th className="px-4 py-2 text-left">Liga</th>
                    <th className="px-4 py-2 text-right">Jugadores</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate({ to: "/tournaments/$id", params: { id: t.id } })}
                      className="cursor-pointer border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3 text-gray-400 font-mono-stat text-xs">
                        {new Date(t.date + "T12:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      {uniqueHistoryGames.length > 1 && (
                        <td className="px-4 py-3 text-white">{t.game_name}</td>
                      )}
                      <td className="px-4 py-3">
                        {t.league_name ? (
                          <span className="inline-block rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fuchsia-300">
                            {t.league_name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-stat text-xs text-gray-300">
                        {t.participants}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="divide-y divide-white/5 sm:hidden">
              {paginatedHistory.map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate({ to: "/tournaments/$id", params: { id: t.id } })}
                  className="cursor-pointer px-1 py-3 active:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono-stat text-xs text-gray-400">
                        {new Date(t.date + "T12:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {uniqueHistoryGames.length > 1 && (
                          <span className="text-sm font-semibold text-white">{t.game_name}</span>
                        )}
                        {t.league_name && (
                          <span className="inline-block rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fuchsia-300">
                            {t.league_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono-stat text-xs text-gray-300 whitespace-nowrap">
                      {t.participants} jug.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {historyTotalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div className="text-xs text-gray-400">
              Página {historyPage} de {historyTotalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryPage((p) => p - 1)}
                disabled={historyPage <= 1}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-30"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setHistoryPage((p) => p + 1)}
                disabled={historyPage >= historyTotalPages}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-30"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </section>

      {selectedEntry && (
        <div
          className="animate-in fade-in-0 duration-200 fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="animate-in fade-in-0 zoom-in-95 duration-200 glass w-full max-w-sm rounded-2xl border border-border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="inline-block rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary mb-3">
              {selectedEntry.game_name}
            </span>
            {selectedEntry.league_name && (
              <span className="ml-2 inline-block rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300 mb-3">
                {selectedEntry.league_name}
              </span>
            )}
            <h3 className="text-lg font-bold text-white">{selectedEntry.store_name}</h3>
            <div className="mt-3 space-y-2 text-sm text-secondary-foreground">
              {selectedEntry.time && (
                <p className="flex items-center gap-2">
                  <Clock size={14} className="flex-shrink-0 text-muted-foreground" />
                  {selectedEntry.time.slice(0, 5)} hrs
                </p>
              )}
              <p className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                  {selectedEntry.zone}
                </span>
              </p>
            </div>
            <button
              onClick={() => setSelectedEntry(null)}
              className="mt-5 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-secondary-foreground hover:text-white transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

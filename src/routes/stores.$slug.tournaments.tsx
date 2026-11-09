import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Medal, Gift, Trophy } from "lucide-react";
import { getStoreActiveLeagues, logStorePageView } from "@/lib/nexus-public.functions";
import {
  storeFichasQuery,
  storeProfileQuery,
  storeTournamentHistoryQuery,
} from "@/lib/stores-queries";
import { useStoreUpcoming } from "@/components/stores/store-hero";
import { fullDate } from "@/components/calendar/tournament-detail-dialog";
import { SkeletonLine } from "@/components/ui/skeleton-loader";
import { TournamentDetailDialog } from "@/components/calendar/tournament-detail-dialog";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { describeFichaChanges, prizeText, type Prize } from "@/lib/ficha";

export const Route = createFileRoute("/stores/$slug/tournaments")({
  head: () => ({ meta: [{ title: "Torneos y Liga — Nexus" }] }),
  component: StoreTournamentsPage,
});

function StoreTournamentsPage() {
  const { slug } = Route.useParams();
  const { player } = useNexusRole();

  // Misma query key que la capa padre (stores.$slug.tsx) — ya está en caché,
  // así que esto no dispara una segunda request de red.
  const { data: profileData } = useQuery({ ...storeProfileQuery(slug), retry: false });
  const store = profileData?.store;

  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const { upcoming, loading: upcomingLoading } = useStoreUpcoming(store?.id);

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
  const hasAnyLeague = tournamentHistory.some((t) => t.league_name);
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

  if (!store) return null;

  return (
    <div className="space-y-6">
      {store?.id && <TournamentDataSection storeId={store.id} />}

      <UpcomingDates
        dates={upcoming.slice(0, 4)}
        loading={upcomingLoading}
        onSelect={setSelectedEntry}
      />

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
              <thead className="bg-black/80 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-3 py-2 text-right">Puntos</th>
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
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                      {league.game_name}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-white">{league.name}</h2>
                  <p className="text-xs text-gray-400">
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
                    <thead className="bg-black/80 text-left text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Tag</th>
                        <th className="px-3 py-2 text-right">Puntos</th>
                        <th className="hidden px-3 py-2 text-right sm:table-cell">Torneos</th>
                        <th className="hidden px-3 py-2 text-right sm:table-cell">Victorias</th>
                        <th className="px-3 py-2 text-right">
                          <abbr title="Porcentaje de victorias de los oponentes">OMW%</abbr>
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
                                <>
                                  <Trophy size={14} className={medalColor} aria-hidden="true" />
                                  <span className="sr-only">{i + 1}</span>
                                </>
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
                            <td className="hidden px-3 py-2 text-right font-mono text-xs text-gray-400 sm:table-cell">
                              {s.tournaments_played}
                            </td>
                            <td className="hidden px-3 py-2 text-right font-mono text-xs text-gray-400 sm:table-cell">
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
                          <img
                            src={p.image_url}
                            alt=""
                            className="h-12 w-12 rounded object-cover"
                          />
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
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
              {uniqueHistoryGames[0].name}
            </span>
          )}
        </div>

        {uniqueHistoryGames.length > 1 && (
          <div className="flex overflow-x-auto border-b border-white/10">
            <button
              aria-pressed={historyGameFilter === null}
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
                  aria-pressed={historyGameFilter === g.id}
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
          <p className="text-sm text-gray-400">
            {tournamentHistory.length === 0
              ? "Esta tienda aún no tiene torneos registrados en el circuito."
              : "Sin torneos para este TCG."}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
              {paginatedHistory.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/tournaments/$id"
                    params={{ id: t.id }}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-400">
                        {new Date(t.date + "T12:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">{t.game_name}</span>
                        {t.league_name && (
                          <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs font-semibold text-fuchsia-300">
                            {t.league_name}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-sm text-gray-300">
                      {t.participants} jugadores
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
        <TournamentDetailDialog
          entry={selectedEntry}
          playerId={player?.id}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}

type FichaTerms = {
  entry_fee_mxn: number;
  prizes: Prize[];
  pool_percent: number | null;
  effective_date: string;
};

function FichaTermsList({ terms }: { terms: FichaTerms }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-2xl font-bold text-white">
        {terms.entry_fee_mxn === 0 ? "Gratis" : `$${terms.entry_fee_mxn} MXN`}
      </p>
      {terms.prizes.length === 0 ? (
        <p className="text-secondary-foreground">Sin premios</p>
      ) : (
        <ul className="space-y-1 text-white">
          {terms.prizes.map((p, i) => (
            <li key={i}>
              <strong>{p.place}:</strong> {prizeText(p)}
            </li>
          ))}
        </ul>
      )}
      {terms.pool_percent && (
        <p className="text-xs text-secondary-foreground">
          El pool es el {terms.pool_percent}% de las inscripciones.
        </p>
      )}
    </div>
  );
}

function TournamentDataSection({ storeId }: { storeId: string }) {
  const { data } = useQuery(storeFichasQuery(storeId));
  if (!data) return null;
  const longDate = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

  return (
    <section className="glass space-y-4 rounded-2xl p-6">
      <div>
        <h2 className="text-lg font-bold text-white">Datos del torneo</h2>
        {data.season_name && (
          <p className="text-xs text-secondary-foreground">
            Costo y premios para toda la {data.season_name}
          </p>
        )}
      </div>
      {data.items.length === 0 && (
        <p className="text-sm text-secondary-foreground">
          Esta tienda todavía no publica sus datos.
        </p>
      )}
      {data.items.map((item) => (
        <div key={item.game_name} className="space-y-3">
          {data.items.length > 1 && (
            <h3 className="text-sm font-semibold text-primary">{item.game_name}</h3>
          )}
          {item.current ? (
            <FichaTermsList terms={item.current} />
          ) : (
            <p className="text-sm text-secondary-foreground">Costo y premios por confirmar.</p>
          )}
          {(item.format || item.capacity || item.registration_time) && (
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {item.format && (
                <div>
                  <dt className="text-xs text-secondary-foreground">Formato</dt>
                  <dd className="font-semibold text-white">{item.format}</dd>
                </div>
              )}
              {item.capacity && (
                <div>
                  <dt className="text-xs text-secondary-foreground">Cupo</dt>
                  <dd className="font-semibold text-white">{item.capacity} jugadores</dd>
                </div>
              )}
              {item.registration_time && (
                <div>
                  <dt className="text-xs text-secondary-foreground">Registro desde</dt>
                  <dd className="font-semibold text-white">{item.registration_time}</dd>
                </div>
              )}
            </dl>
          )}
          {item.notes && <p className="text-sm text-secondary-foreground">{item.notes}</p>}
          {item.upcoming && item.current && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
              <p className="font-semibold text-white">
                Cambios desde el {longDate(item.upcoming.effective_date)}
              </p>
              <ul className="mt-1 space-y-0.5 text-gray-200">
                {describeFichaChanges(item.current, item.upcoming).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function UpcomingDates({
  dates,
  loading,
  onSelect,
}: {
  dates: any[];
  loading: boolean;
  onSelect: (entry: any) => void;
}) {
  return (
    <section className="glass space-y-3 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-white">Próximas fechas</h2>
      {loading ? (
        <SkeletonLine width="w-full" height="h-12" />
      ) : dates.length === 0 ? (
        <p className="text-sm text-secondary-foreground">
          Esta tienda no tiene torneos programados por ahora.
        </p>
      ) : (
        <ul className="space-y-2">
          {dates.map((entry) => (
            <li key={entry.id}>
              <button
                onClick={() => onSelect(entry)}
                className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span
                  className={`font-semibold text-white ${entry.cancellation_reason ? "line-through opacity-60" : ""}`}
                >
                  {fullDate(entry.date)}
                  {entry.time ? ` · ${entry.time.slice(0, 5)} hrs` : ""}
                </span>
                {entry.cancellation_reason ? (
                  <span className="text-sm text-red-300">
                    Cancelado: {entry.cancellation_reason}
                  </span>
                ) : (
                  <span className="text-sm text-secondary-foreground">
                    {entry.league_name ?? entry.game_name}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

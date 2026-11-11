import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { logStorePageView } from "@/lib/nexus-public.functions";
import {
  storeFichasQuery,
  storeLeaguesQuery,
  storeProfileQuery,
  storeTournamentHistoryQuery,
} from "@/lib/stores-queries";
import { useStoreUpcoming } from "@/components/stores/store-hero";
import {
  BTN_OUTLINE,
  ChipGroup,
  FOCUS_RING,
  InlineError,
  SECTION,
} from "@/components/stores/store-ui";
import { fullDate, TournamentDetailDialog } from "@/components/calendar/tournament-detail-dialog";
import { SkeletonLine } from "@/components/ui/skeleton-loader";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { describeFichaChanges, prizeText, type Prize } from "@/lib/ficha";

type TournamentsSearch = { game?: string; page?: number };

export const Route = createFileRoute("/stores/$slug/tournaments")({
  // El juego filtrado y la página del historial viven en la URL: compartibles y sobreviven a
  // recargar o a volver desde un torneo.
  validateSearch: (s: Record<string, unknown>): TournamentsSearch => {
    const page = Number(s.page);
    return {
      game: typeof s.game === "string" && s.game ? s.game : undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Torneos y Liga — Nexus" }] }),
  component: StoreTournamentsPage,
});

const HISTORY_PAGE_SIZE = 10;

const shortDate = (iso: string, withYear = false) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });

function StoreTournamentsPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { player } = useNexusRole();

  // Misma query key que la capa padre (stores.$slug.tsx) — ya está en caché,
  // así que esto no dispara una segunda request de red.
  const { data: profileData } = useQuery({ ...storeProfileQuery(slug), retry: false });
  const store = profileData?.store;

  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const {
    upcoming,
    loading: upcomingLoading,
    error: upcomingError,
    retry: retryUpcoming,
  } = useStoreUpcoming(store?.id);

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useQuery({
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
  // Un `game` de la URL que ya no existe en el historial se ignora en vez de vaciar la lista.
  const gameFilter = uniqueHistoryGames.some((g) => g.id === search.game)
    ? (search.game ?? null)
    : null;
  const filteredHistory = gameFilter
    ? tournamentHistory.filter((t) => t.game_id === gameFilter)
    : tournamentHistory;
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const historyPage = Math.min(search.page ?? 1, historyTotalPages);
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE,
  );

  const {
    data: leaguesData,
    isLoading: leagueLoading,
    isError: leagueError,
    refetch: refetchLeagues,
  } = useQuery(storeLeaguesQuery(store?.slug));
  const leagues: any[] = leaguesData?.leagues ?? [];

  const setGame = (game: string | null) =>
    navigate({
      search: (prev) => ({ ...prev, game: game ?? undefined, page: undefined }),
      replace: true,
    });
  const setPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, page: page > 1 ? page : undefined }) });

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
    <div className="space-y-4">
      {store?.id && <TournamentDataSection storeId={store.id} />}

      <UpcomingDates
        dates={upcoming.slice(0, 4)}
        loading={upcomingLoading}
        error={upcomingError}
        onRetry={retryUpcoming}
        onSelect={setSelectedEntry}
      />

      {leagueLoading && (
        <section className={`${SECTION} space-y-3`} aria-busy="true">
          <SkeletonLine width="w-48" height="h-5" />
          <SkeletonLine width="w-32" height="h-3" />
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLine key={i} width="w-full" height="h-9" />
          ))}
        </section>
      )}

      {leagueError && (
        <section className={`${SECTION} space-y-3`}>
          <h2 className="text-lg font-bold text-foreground">Liga interna</h2>
          <InlineError onRetry={() => refetchLeagues()}>
            No pudimos cargar la liga de esta tienda.
          </InlineError>
        </section>
      )}

      {/* Una sección por Liga Interna activa — una tienda puede correr una liga por TCG en
          paralelo (One Piece, Riftbound, etc.), así que no asumimos que hay una sola. */}
      {leagues.map((league: any) => (
        <LeagueSection key={league.id} league={league} />
      ))}

      <section className={`${SECTION} space-y-4`}>
        <div>
          <h2 className="text-lg font-bold text-foreground">Historial de torneos</h2>
          {uniqueHistoryGames.length === 1 && (
            <p className="text-sm text-foreground-secondary">{uniqueHistoryGames[0].name}</p>
          )}
        </div>

        {uniqueHistoryGames.length > 1 && (
          <ChipGroup
            label="Filtrar por juego"
            value={gameFilter}
            onChange={setGame}
            options={[
              { key: null, label: `Todos (${tournamentHistory.length})` },
              ...uniqueHistoryGames.map((g) => ({
                key: g.id,
                label: `${g.name} (${tournamentHistory.filter((t) => t.game_id === g.id).length})`,
              })),
            ]}
          />
        )}

        {historyLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLine key={i} width="w-full" height="h-11" />
            ))}
          </div>
        ) : historyError ? (
          <InlineError onRetry={() => refetchHistory()}>
            No pudimos cargar el historial de torneos.
          </InlineError>
        ) : filteredHistory.length === 0 ? (
          <p className="text-sm text-foreground-secondary">
            {tournamentHistory.length === 0
              ? "Esta tienda aún no tiene torneos registrados en el circuito."
              : "Sin torneos para este TCG."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {paginatedHistory.map((t) => (
              <li key={t.id}>
                <Link
                  to="/tournaments/$id"
                  params={{ id: t.id }}
                  className={`-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-2.5 transition hover:bg-white/5 ${FOCUS_RING}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground-secondary">
                      {shortDate(t.date, true)}
                    </span>
                    <span className="block text-foreground">
                      <span className="font-semibold">{t.game_name}</span>
                      {t.league_name && (
                        <span className="text-sm text-foreground-secondary">
                          {" "}
                          · {t.league_name}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-sm text-foreground-secondary">
                    <span className="font-mono-stat">{t.participants}</span> jugadores
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {historyTotalPages > 1 && (
          <nav
            aria-label="Páginas del historial"
            className="flex items-center justify-between gap-3 border-t border-border pt-3"
          >
            <p className="text-sm text-foreground-secondary" role="status">
              Página {historyPage} de {historyTotalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(historyPage - 1)}
                disabled={historyPage <= 1}
                className={BTN_OUTLINE}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage(historyPage + 1)}
                disabled={historyPage >= historyTotalPages}
                className={BTN_OUTLINE}
              >
                Siguiente
              </button>
            </div>
          </nav>
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

function LeagueSection({ league }: { league: any }) {
  const daysLeft = Math.ceil(
    (new Date(league.end_date + "T23:59:59").getTime() - Date.now()) / 86_400_000,
  );
  const remaining =
    daysLeft < 0 ? null : daysLeft === 0 ? "Último día" : `${daysLeft} días restantes`;
  const meta = [
    `Liga interna · ${league.game_name}`,
    `${shortDate(league.start_date)} — ${shortDate(league.end_date, true)}`,
    remaining,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className={`${SECTION} space-y-4`}>
      <div>
        <h2 className="text-lg font-bold text-foreground">{league.name}</h2>
        <p className="text-sm text-foreground-secondary">{meta}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Posiciones</h3>
        {league.standings.length === 0 ? (
          <p className="text-sm text-foreground-secondary">
            Aún no hay resultados registrados en esta liga.
          </p>
        ) : (
          <>
            {/* Las columnas secundarias pasan a una segunda línea bajo el jugador cuando el
                contenedor es angosto, así en el celular no hay scroll horizontal ni datos que
                desaparezcan. */}
            <table className="w-full text-sm">
              <caption className="sr-only">Posiciones de {league.name}</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-foreground-subtle">
                  <th scope="col" className="w-10 py-2 pr-2 font-medium">
                    #
                  </th>
                  <th scope="col" className="py-2 pr-2 font-medium">
                    Jugador
                  </th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium">
                    Puntos
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2 pl-4 text-right font-medium @lg:table-cell"
                  >
                    Torneos
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2 pl-4 text-right font-medium @lg:table-cell"
                  >
                    Ganados
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2 pl-4 text-right font-medium @lg:table-cell"
                  >
                    OMW %
                  </th>
                </tr>
              </thead>
              <tbody>
                {league.standings.map((s: any, i: number) => (
                  <tr key={s.player_id} className="border-b border-border last:border-0">
                    <td
                      className={`py-1 pr-2 align-top font-mono-stat ${i < 3 ? "font-bold text-foreground" : "text-foreground-subtle"}`}
                    >
                      <span className="inline-flex min-h-9 items-center">{i + 1}</span>
                    </td>
                    <td className="min-w-0 py-1 pr-2">
                      <Link
                        to="/players/$playerTag"
                        params={{ playerTag: s.geek_tag }}
                        className={`inline-flex min-h-9 items-center break-all font-medium text-foreground hover:text-primary hover:underline ${FOCUS_RING}`}
                      >
                        {s.geek_tag}
                      </Link>
                      <p className="pb-1 text-xs text-foreground-subtle @lg:hidden">
                        <span className="font-mono-stat">{s.tournaments_played}</span> torneos ·{" "}
                        <span className="font-mono-stat">{s.tournaments_won}</span> ganados · OMW{" "}
                        <span className="font-mono-stat">{s.omw_percentage}%</span>
                      </p>
                    </td>
                    <td className="py-1 pl-2 text-right align-top font-mono-stat font-semibold text-foreground">
                      <span className="inline-flex min-h-9 items-center">{s.total_points}</span>
                    </td>
                    <td className="hidden py-1 pl-4 text-right font-mono-stat text-foreground-secondary @lg:table-cell">
                      {s.tournaments_played}
                    </td>
                    <td className="hidden py-1 pl-4 text-right font-mono-stat text-foreground-secondary @lg:table-cell">
                      {s.tournaments_won}
                    </td>
                    <td className="hidden py-1 pl-4 text-right font-mono-stat text-foreground-secondary @lg:table-cell">
                      {s.omw_percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="text-sm text-foreground-secondary">
              <summary
                className={`flex min-h-11 cursor-pointer items-center font-medium hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
              >
                Cómo leer la tabla
              </summary>
              <dl className="grid gap-x-8 gap-y-3 pb-1 pt-1 @lg:grid-cols-2">
                <div>
                  <dt className="font-semibold text-foreground">Puntos</dt>
                  <dd>Los que sumó cada jugador en los torneos de esta liga.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Torneos y ganados</dt>
                  <dd>Torneos jugados y torneos ganados dentro de la liga.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">OMW %</dt>
                  <dd>
                    Porcentaje de victorias de sus rivales (Opponent Match Win). Si dos jugadores
                    empatan en puntos, va arriba el de mayor OMW.
                  </dd>
                </div>
              </dl>
            </details>
          </>
        )}
      </div>

      {league.prizes.length > 0 && (
        <div className="space-y-1 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Premios y recompensas</h3>
          <ul className="divide-y divide-border">
            {league.prizes.map((p: any) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded object-cover"
                  />
                )}
                <p className="text-sm text-foreground-secondary">{p.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
      <p className="text-2xl font-bold text-foreground">
        {terms.entry_fee_mxn === 0 ? "Gratis" : `$${terms.entry_fee_mxn} MXN`}
      </p>
      {terms.prizes.length === 0 ? (
        <p className="text-foreground-secondary">Sin premios</p>
      ) : (
        <ul className="space-y-1 text-foreground">
          {terms.prizes.map((p, i) => (
            <li key={i}>
              <strong>{p.place}:</strong> {prizeText(p)}
            </li>
          ))}
        </ul>
      )}
      {terms.pool_percent && (
        <p className="text-xs text-foreground-secondary">
          El pool es el {terms.pool_percent}% de las inscripciones.
        </p>
      )}
    </div>
  );
}

function TournamentDataSection({ storeId }: { storeId: string }) {
  const { data, isError, refetch } = useQuery(storeFichasQuery(storeId));
  if (isError) {
    return (
      <section className={`${SECTION} space-y-3`}>
        <h2 className="text-lg font-bold text-foreground">Datos del torneo</h2>
        <InlineError onRetry={() => refetch()}>No pudimos cargar los datos del torneo.</InlineError>
      </section>
    );
  }
  if (!data) return null;
  const longDate = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

  return (
    <section className={`${SECTION} space-y-4`}>
      <div>
        <h2 className="text-lg font-bold text-foreground">Datos del torneo</h2>
        {data.season_name && (
          <p className="text-sm text-foreground-secondary">
            Costo y premios para toda la {data.season_name}
          </p>
        )}
      </div>
      {data.items.length === 0 && (
        <p className="text-sm text-foreground-secondary">
          Esta tienda todavía no publica sus datos.
        </p>
      )}
      <div className="divide-y divide-border">
        {data.items.map((item) => (
          <div key={item.game_name} className="space-y-3 py-4 first:pt-0 last:pb-0">
            {data.items.length > 1 && (
              <h3 className="text-sm font-semibold text-foreground">{item.game_name}</h3>
            )}
            {item.current ? (
              <FichaTermsList terms={item.current} />
            ) : (
              <p className="text-sm text-foreground-secondary">Costo y premios por confirmar.</p>
            )}
            {(item.format || item.capacity || item.registration_time) && (
              <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {item.format && (
                  <div>
                    <dt className="text-xs text-foreground-subtle">Formato</dt>
                    <dd className="font-semibold text-foreground">{item.format}</dd>
                  </div>
                )}
                {item.capacity && (
                  <div>
                    <dt className="text-xs text-foreground-subtle">Cupo</dt>
                    <dd className="font-semibold text-foreground">{item.capacity} jugadores</dd>
                  </div>
                )}
                {item.registration_time && (
                  <div>
                    <dt className="text-xs text-foreground-subtle">Registro desde</dt>
                    <dd className="font-semibold text-foreground">{item.registration_time}</dd>
                  </div>
                )}
              </dl>
            )}
            {item.notes && <p className="text-sm text-foreground-secondary">{item.notes}</p>}
            {item.upcoming && item.current && (
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  Cambios desde el {longDate(item.upcoming.effective_date)}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground-secondary">
                  {describeFichaChanges(item.current, item.upcoming).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function UpcomingDates({
  dates,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  dates: any[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onSelect: (entry: any) => void;
}) {
  return (
    <section className={`${SECTION} space-y-3`}>
      <h2 className="text-lg font-bold text-foreground">Próximas fechas</h2>
      {loading ? (
        <SkeletonLine width="w-full" height="h-12" />
      ) : dates.length === 0 ? (
        error ? (
          <InlineError onRetry={onRetry}>No pudimos cargar las próximas fechas.</InlineError>
        ) : (
          <p className="text-sm text-foreground-secondary">
            Esta tienda no tiene torneos programados por ahora.
          </p>
        )
      ) : (
        <ul className="divide-y divide-border">
          {dates.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className={`-mx-2 flex min-h-11 w-[calc(100%+1rem)] cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md px-2 py-2.5 text-left transition hover:bg-white/5 ${FOCUS_RING}`}
              >
                <span
                  className={`font-semibold text-foreground ${entry.cancellation_reason ? "line-through opacity-60" : ""}`}
                >
                  {fullDate(entry.date)}
                  {entry.time ? ` · ${entry.time.slice(0, 5)} hrs` : ""}
                </span>
                {entry.cancellation_reason ? (
                  <span className="text-sm text-destructive">
                    Cancelado: {entry.cancellation_reason}
                  </span>
                ) : (
                  <span className="text-sm text-foreground-secondary">
                    {entry.league_name ?? entry.game_name}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && error && dates.length > 0 && (
        <InlineError onRetry={onRetry}>Algunas fechas no se pudieron cargar.</InlineError>
      )}
    </section>
  );
}

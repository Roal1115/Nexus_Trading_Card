import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Navigation, Clock, Instagram, Globe, Twitter, Twitch, ArrowLeft, Phone, ChevronLeft, ChevronRight, Medal, Gift, Star, Trophy } from "lucide-react";
import { useWeekNav, useCalendarGrid, WeeklyGrid, dotColorForGame } from "@/components/calendar/weekly-grid";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { getStoreActiveLeagues, logStorePageView } from "@/lib/nexus-public.functions";
import { getMyFavoriteStores, toggleFavoriteStore } from "@/lib/nexus-player.functions";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { storeProfileQuery } from "@/lib/stores-queries";
import { publicCalendarQuery } from "@/lib/calendar-queries";
import { SkeletonLine } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/stores/$slug")({
  head: () => ({ meta: [{ title: "Tienda — Nexus" }] }),
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(storeProfileQuery(params.slug));
    } catch {
      return undefined;
    }
  },
  component: StoreProfilePage,
});

function StoreProfilePage() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();

  const { data: profileData, isLoading: loading } = useQuery({
    ...storeProfileQuery(slug),
    initialData: loaderData,
    retry: false,
  });
  const store = profileData?.store ?? null;
  const notFound = !loading && !store;

  const { weekDates, weekStartStr, goToPrevWeek, goToNextWeek, goToToday, weekLabel } = useWeekNav();
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const { player } = useNexusRole();

  const fetchFavorites = useServerFn(getMyFavoriteStores);
  const toggleFavorite = useServerFn(toggleFavoriteStore);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  useEffect(() => {
    if (!player?.id || !store?.id) {
      setIsFavorite(false);
      return;
    }
    fetchFavorites()
      .then((res: any) => setIsFavorite((res.store_ids ?? []).includes(store.id)))
      .catch(() => setIsFavorite(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, store?.id]);

  async function handleToggleFavorite() {
    if (!store?.id || favoriteBusy) return;
    setFavoriteBusy(true);
    setIsFavorite((v) => !v);
    try {
      const res: any = await toggleFavorite({ data: { store_id: store.id } });
      setIsFavorite(res.is_favorite);
    } catch {
      setIsFavorite((v) => !v);
    } finally {
      setFavoriteBusy(false);
    }
  }

  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const registerView = useServerFn(registerAdView);
  const [sponsor, setSponsor] = useState<any>(null);

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

  const { data: calendarData, isLoading: calLoading } = useQuery({
    ...publicCalendarQuery({ game_id: null, zone: null, store_id: store?.id ?? null, store_ids: null, week_start: weekStartStr }),
    enabled: !!store?.id,
  });
  const events = calendarData?.events ?? [];

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

  // Visitas a la página: registra "profile" al entrar, y "calendario" /
  // "liga_interna" cuando esas secciones realmente entran a la vista —
  // la página es un solo scroll con anchors, no rutas separadas, así que
  // IntersectionObserver es la única forma honesta de saber qué se mira.
  const logView = useServerFn(logStorePageView);
  const loggedSectionsRef = useRef(new Set<string>());
  const calendarioSectionRef = useRef<HTMLElement | null>(null);
  const ligaSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!store?.id) return;
    const key = `${store.id}:profile`;
    if (loggedSectionsRef.current.has(key)) return;
    loggedSectionsRef.current.add(key);
    logView({ data: { store_id: store.id, section: "profile" } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  useEffect(() => {
    if (!store?.id) return;
    const targets: Array<{ el: HTMLElement | null; section: "calendario" | "liga_interna" }> = [
      { el: calendarioSectionRef.current, section: "calendario" },
      { el: ligaSectionRef.current, section: "liga_interna" },
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const match = targets.find((t) => t.el === entry.target);
          const key = `${store.id}:${match?.section}`;
          if (!match || loggedSectionsRef.current.has(key)) continue;
          loggedSectionsRef.current.add(key);
          logView({ data: { store_id: store.id!, section: match.section } }).catch(() => {});
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.4 },
    );
    for (const t of targets) {
      if (t.el) observer.observe(t.el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, leagues, leagueLoading]);

  const calendarGrid = useCalendarGrid(events, weekDates);
  const gamesInSchedule = Array.from(
    new Map(events.map((e) => [e.game_slug, e.game_name])).entries(),
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-gray-400">No encontramos esta tienda.</p>
        <Link to="/stores" className="text-sm font-semibold text-primary hover:underline">
          ← Volver al directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>

      <main className="min-w-0 max-w-4xl space-y-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/stores" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-primary">
          <ArrowLeft size={12} /> Volver al directorio
        </Link>
        {leagues.length > 0 && (
          <a
            href="#liga-interna"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/20"
          >
            <Medal size={12} /> Ver Liga Interna
          </a>
        )}
      </div>

      {/* Ad horizontal mobile */}
      <AdHorizontal sponsor={sponsor} />

      <header className="glass space-y-4 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{store.zone ?? "—"}</p>
            <h1 className="text-3xl font-bold text-white">{store.name}</h1>
          </div>
          {player && (
            <button
              onClick={handleToggleFavorite}
              disabled={favoriteBusy}
              aria-pressed={isFavorite}
              title={isFavorite ? "Quitar de favoritas" : "Agregar a favoritas"}
              className={`flex-shrink-0 rounded-full border p-2.5 transition ${
                isFavorite
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-white/10 text-gray-400 hover:border-primary/40 hover:text-primary"
              }`}
            >
              <Star size={18} className={isFavorite ? "fill-primary" : ""} />
            </button>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-sm text-gray-400">
          <MapPin size={14} /> {[store.address, store.city, store.state].filter(Boolean).join(", ") || "—"}
        </p>

        {store.description && <p className="text-sm text-gray-300">{store.description}</p>}

        {store.games.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {store.games.map((g: any) => (
              <span
                key={g.id}
                className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {store.opening_hours && (
            <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock size={12} /> {store.opening_hours}
              </p>
            </div>
          )}
          {store.phone && (
            <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <Phone size={12} /> {store.phone}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {store.google_maps_url && (
            <a
              href={store.google_maps_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
            >
              <Navigation size={12} /> Cómo llegar
            </a>
          )}
          {store.instagram && (
            <a href={`https://instagram.com/${store.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary">
              <Instagram size={18} />
            </a>
          )}
          {store.website && (
            <a href={store.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary">
              <Globe size={18} />
            </a>
          )}
          {store.twitter && (
            <a href={`https://x.com/${store.twitter.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary">
              <Twitter size={18} />
            </a>
          )}
          {store.twitch && (
            <a href={`https://twitch.tv/${store.twitch.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary">
              <Twitch size={18} />
            </a>
          )}
        </div>

        {(store.address || store.city) && (
          <iframe
            title={`Mapa de ${store.name}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(
              [store.name, store.address, store.city, store.state].filter(Boolean).join(", "),
            )}&output=embed`}
            className="h-64 w-full rounded-xl border border-white/10"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </header>

      <section
        id="calendario"
        ref={calendarioSectionRef}
        className="glass space-y-4 scroll-mt-20 rounded-2xl p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Calendario de torneos</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevWeek}
              className="rounded-lg border border-border p-2 text-secondary-foreground hover:text-white transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-white">{weekLabel}</span>
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
            {gamesInSchedule.map(([slug, name]) => (
              <div key={slug} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className={`h-2 w-2 rounded-full ${dotColorForGame(slug)}`} />
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
        <section id="liga-interna" ref={ligaSectionRef} className="scroll-mt-20 space-y-4">
          {/* Una sección por Liga Interna activa — una tienda puede correr
              una liga por TCG en paralelo (One Piece, Riftbound, etc.), así
              que ya no asumimos que hay una sola. */}
          {leagues.map((league: any) => (
            <section key={league.id} className="glass space-y-4 rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Liga Interna</p>
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
                <p className="text-sm text-gray-400">Aún no hay resultados registrados en esta liga.</p>
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
                          i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "";
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
                            <td className="px-3 py-2 text-right font-mono font-semibold text-white">{s.total_points}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.tournaments_played}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.tournaments_won}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.omw_percentage}%</td>
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
        </section>
      )}

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
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{selectedEntry.zone}</span>
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
      </main>

      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}

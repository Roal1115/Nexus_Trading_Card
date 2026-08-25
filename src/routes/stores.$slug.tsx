import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, MapPin, Navigation, Clock, Instagram, Globe, Twitter, Twitch, ArrowLeft, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { useWeekNav, useCalendarGrid, WeeklyGrid, dotColorForGame } from "@/components/calendar/weekly-grid";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { storeProfileQuery } from "@/lib/stores-queries";
import { publicCalendarQuery } from "@/lib/calendar-queries";

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
      <Link to="/stores" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-primary">
        <ArrowLeft size={12} /> Volver al directorio
      </Link>

      {/* Ad horizontal mobile */}
      <AdHorizontal sponsor={sponsor} />

      <header className="glass space-y-4 rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{store.zone ?? "—"}</p>
        <h1 className="text-3xl font-bold text-white">{store.name}</h1>
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
      </header>

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

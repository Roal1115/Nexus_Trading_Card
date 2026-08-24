import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Instagram,
  MapPin,
  Navigation,
  Phone,
  Twitch,
  Twitter,
} from "lucide-react";
import { buildIcs, icsDataUri, icsFileName } from "@/lib/ics";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { getPublicCalendar } from "@/lib/nexus-public.functions";
import { getMyAttendedTournamentIds } from "@/lib/nexus-standalone.functions";
import { getMyFavoriteStores } from "@/lib/nexus-player.functions";
import { Star } from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { useTCG } from "@/context/tcg.context";
import { useWeekNav, useCalendarGrid, WeeklyGrid } from "@/components/calendar/weekly-grid";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendario — Nexus" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const fetchCalendar = useServerFn(getPublicCalendar);
  const fetchAttended = useServerFn(getMyAttendedTournamentIds);
  const fetchFavorites = useServerFn(getMyFavoriteStores);
  const { player } = useNexusRole();
  const { activeTcg } = useTCG();

  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const registerView = useServerFn(registerAdView);
  const [sponsor, setSponsor] = useState<any>(null);

  const { weekDates, weekStartStr, goToPrevWeek, goToNextWeek, goToToday, weekLabel } = useWeekNav();
  const [events, setEvents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [filterZone, setFilterZone] = useState<string | null>(null);
  const [filterStore, setFilterStore] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const hasFavorites = favoriteIds.length > 0;
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    setLoading(true);
    fetchCalendar({
      data: {
        game_id: activeTcg?.id ?? null,
        zone: filterZone,
        store_id: onlyFavorites ? null : filterStore,
        store_ids: onlyFavorites && favoriteIds.length > 0 ? favoriteIds : null,
        week_start: weekStartStr,
      },
    } as any)
      .then((res: any) => {
        setEvents(res.events ?? []);
        setStores(res.stores ?? []);
        setZones(res.zones ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [weekStartStr, activeTcg?.id, filterZone, filterStore, onlyFavorites, favoriteIds]);

  useEffect(() => {
    const realTournamentIds = events.filter((e) => !e.is_scheduled).map((e) => e.id);
    if (!player?.id || realTournamentIds.length === 0) {
      setAttendedIds(new Set());
      return;
    }
    fetchAttended({ data: { tournament_ids: realTournamentIds } } as any).then((d: any) => {
      setAttendedIds(new Set(d.tournament_ids ?? []));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, events]);

  useEffect(() => {
    if (!player?.id) {
      setFavoriteIds([]);
      setOnlyFavorites(false);
      return;
    }
    fetchFavorites()
      .then((res: any) => setFavoriteIds(res.store_ids ?? []))
      .catch(() => setFavoriteIds([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  useEffect(() => {
    if (!hasFavorites) return;
    const saved = window.localStorage.getItem("calendar:only-favorites");
    if (saved === "1") setOnlyFavorites(true);
  }, [hasFavorites]);

  const toggleOnlyFavorites = () => {
    const next = !onlyFavorites;
    setOnlyFavorites(next);
    if (next) {
      setFilterStore(null);
      window.localStorage.setItem("calendar:only-favorites", "1");
    } else {
      window.localStorage.removeItem("calendar:only-favorites");
    }
  };


  const calendarGrid = useCalendarGrid(events, weekDates);

  const buildEventIcs = (entry: any) => {
    const isProjected = Boolean(entry.is_scheduled);
    const title = isProjected
      ? `${entry.game_name} — ${entry.store_name} (por confirmar)`
      : `${entry.game_name} — ${entry.store_name}`;
    const description = isProjected
      ? "Horario regular de la tienda, sujeto a cambios. Trading Card Nexus."
      : "Torneo publicado en Trading Card Nexus.";
    const location = [entry.store_name, entry.store_city, entry.store_state]
      .filter(Boolean)
      .join(", ");
    return buildIcs({
      title,
      description,
      location,
      date: entry.date,
      time: entry.time,
      durationHours: 4,
      uid: `${entry.id}-${entry.date}`,
    });
  };

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>

      <main className="min-w-0 max-w-6xl py-8 pb-24">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Torneos</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Calendario</h1>
        <p className="mt-1 text-sm text-gray-400">
          Torneos programados — {activeTcg?.name ?? "Todos los TCGs"}
        </p>
      </div>

      {/* Ad horizontal mobile */}
      <AdHorizontal sponsor={sponsor} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="rounded-lg border border-border p-2 text-secondary-foreground hover:text-white transition"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[200px] text-center text-sm font-semibold text-white">{weekLabel}</span>
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

        <div className="flex items-center gap-2 flex-wrap">
          {hasFavorites && (
            <button
              type="button"
              onClick={toggleOnlyFavorites}
              aria-pressed={onlyFavorites}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                onlyFavorites
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card text-secondary-foreground hover:text-white"
              }`}
            >
              <Star
                size={13}
                className={onlyFavorites ? "fill-primary text-primary" : ""}
              />
              Mis favoritas
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  onlyFavorites ? "bg-primary/20 text-primary" : "bg-white/10 text-secondary-foreground"
                }`}
              >
                {favoriteIds.length}
              </span>
            </button>
          )}

          <select
            value={filterZone ?? ""}
            onChange={(e) => setFilterZone(e.target.value || null)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-white outline-none focus:border-primary"
          >
            <option value="">Todas las zonas</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>

          <select
            value={filterStore ?? ""}
            onChange={(e) => setFilterStore(e.target.value || null)}
            disabled={onlyFavorites}
            className={`rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-white outline-none focus:border-primary ${
              onlyFavorites ? "opacity-40 cursor-not-allowed" : ""
            }`}
          >
            <option value="">Todas las tiendas</option>
            {stores.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {player && attendedIds.size > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1">
              <CheckCircle2 size={11} className="text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-400">
                {attendedIds.size} torneos asistidos
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <WeeklyGrid
          weekDates={weekDates}
          calendarGrid={calendarGrid}
          attendedIds={attendedIds}
          loading={loading}
          onSelectEntry={setSelectedEntry}
        />
      </div>

      {onlyFavorites && !loading && events.length === 0 && (
        <p className="mt-3 text-center text-xs text-secondary-foreground">
          Estás filtrando por tus tiendas favoritas. Desactiva el filtro para ver todos los torneos.
        </p>
      )}



      <DialogPrimitive.Root
        open={!!selectedEntry}
        onOpenChange={(o) => !o && setSelectedEntry(null)}
      >
        {selectedEntry && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <div className="animate-in fade-in-0 duration-200 fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pb-24 lg:items-center lg:pb-4">
                <DialogPrimitive.Content
                  asChild
                  forceMount
                  onClick={(e) => e.stopPropagation()}
                  aria-describedby={undefined}
                >
                  <div className="animate-in fade-in-0 zoom-in-95 duration-200 glass my-auto w-full max-w-sm rounded-2xl border border-border p-6">
            <span className="inline-block rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary mb-3">
              {selectedEntry.game_name}
            </span>

            {selectedEntry.is_scheduled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 mb-2 ml-2">
                Torneo programado · Pendiente de confirmar
              </span>
            )}

            <DialogPrimitive.Title asChild>
              <h3 className="text-lg font-bold text-white">{selectedEntry.store_name}</h3>
            </DialogPrimitive.Title>

            <div className="mt-3 space-y-2 text-sm text-secondary-foreground">
              <p className="flex items-center gap-2">
                <MapPin size={14} className="flex-shrink-0 text-muted-foreground" />
                {[selectedEntry.store_address, selectedEntry.store_city, selectedEntry.store_state]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
              {selectedEntry.time && (
                <p className="flex items-center gap-2">
                  <Clock size={14} className="flex-shrink-0 text-muted-foreground" />
                  {selectedEntry.time.slice(0, 5)} hrs
                </p>
              )}
              {selectedEntry.store_phone && (
                <p className="flex items-center gap-2">
                  <Phone size={14} className="flex-shrink-0 text-muted-foreground" />
                  {selectedEntry.store_phone}
                </p>
              )}
              <p className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{selectedEntry.zone}</span>
              </p>
            </div>

            {selectedEntry.store_description && (
              <p className="mt-3 text-sm text-gray-300">{selectedEntry.store_description}</p>
            )}

            {player && !selectedEntry.is_scheduled && attendedIds.has(selectedEntry.id) && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Asististe a este torneo</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {selectedEntry.store_google_maps_url && (
                <a
                  href={selectedEntry.store_google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
                >
                  <Navigation size={12} /> Cómo llegar
                </a>
              )}
              {selectedEntry.store_instagram && (
                <a
                  href={`https://instagram.com/${selectedEntry.store_instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-primary"
                >
                  <Instagram size={18} />
                </a>
              )}
              {selectedEntry.store_website && (
                <a href={selectedEntry.store_website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary">
                  <Globe size={18} />
                </a>
              )}
              {selectedEntry.store_twitter && (
                <a
                  href={`https://x.com/${selectedEntry.store_twitter.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-primary"
                >
                  <Twitter size={18} />
                </a>
              )}
              {selectedEntry.store_twitch && (
                <a
                  href={`https://twitch.tv/${selectedEntry.store_twitch.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-primary"
                >
                  <Twitch size={18} />
                </a>
              )}
            </div>

            {selectedEntry.store_slug && (
              <Link
                to="/stores/$slug"
                params={{ slug: selectedEntry.store_slug }}
                className="mt-3 block text-center text-xs font-semibold text-primary hover:underline"
              >
                Ver perfil de la tienda →
              </Link>
            )}

            <a
              href={icsDataUri(buildEventIcs(selectedEntry))}
              download={icsFileName(`${selectedEntry.game_name}-${selectedEntry.store_name}-${selectedEntry.date}`)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20"
            >
              <CalendarPlus size={15} />
              Agregar a mi calendario
            </a>

            <button
              onClick={() => setSelectedEntry(null)}
              className="mt-5 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-secondary-foreground hover:text-white transition"
            >
              Cerrar
            </button>
                  </div>
                </DialogPrimitive.Content>
              </div>
            </DialogPrimitive.Overlay>
          </DialogPrimitive.Portal>
        )}
      </DialogPrimitive.Root>
      </main>

      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
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
import { getMyAttendedTournamentIds } from "@/lib/nexus-standalone.functions";
import { getMyFavoriteStores } from "@/lib/nexus-player.functions";
import { Star } from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { PageHeader } from "@/components/ui/page-header";
import { useIsMobile } from "@/hooks/use-mobile";
import { todayInMexicoStr } from "@/lib/utils";
import { useTCG } from "@/context/tcg.context";
import { useWeekNav, useCalendarGrid, WeeklyGrid } from "@/components/calendar/weekly-grid";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { publicCalendarQuery } from "@/lib/calendar-queries";
import { CalendarPreferencesPrompt } from "@/components/calendar/preferences-prompt";
import { acceptsSlotRsvp, SlotRsvpPanel, useMySlotRsvps } from "@/components/calendar/slot-rsvp";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendario — Nexus" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const fetchAttended = useServerFn(getMyAttendedTournamentIds);
  const fetchFavorites = useServerFn(getMyFavoriteStores);
  const { player } = useNexusRole();
  const { activeTcg, setActiveTcg, tcgs } = useTCG();

  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const registerView = useServerFn(registerAdView);
  const [sponsor, setSponsor] = useState<any>(null);

  const { weekDates, weekStartStr, goToPrevWeek, goToNextWeek, goToToday, weekLabel } =
    useWeekNav();
  const [filterZone, setFilterZone] = useState<string | null>(null);
  const [filterStore, setFilterStore] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const hasFavorites = favoriteIds.length > 0;
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const isMobile = useIsMobile();
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());

  const { data: calendarData, isLoading: loading } = useQuery(
    publicCalendarQuery({
      game_id: activeTcg?.id ?? null,
      zone: filterZone,
      store_id: onlyFavorites ? null : filterStore,
      store_ids: onlyFavorites && favoriteIds.length > 0 ? favoriteIds : null,
      week_start: weekStartStr,
    }),
  );
  // useMemo, no `?? []` inline: calendarData es undefined mientras carga,
  // y un literal `[]` nuevo en cada render rompía el useEffect de attendedIds
  // de abajo (depende de `events` por referencia) — bucle infinito de renders.
  const events = useMemo(() => calendarData?.events ?? [], [calendarData]);
  const stores = calendarData?.stores ?? [];
  const zones = calendarData?.zones ?? [];

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

  // Seed de zona/TCG desde la preferencia guardada en la cuenta — solo una
  // vez al cargar el player, y solo si el usuario no había tocado el filtro
  // ya (evita pisar una elección manual hecha antes de que llegue el player).
  const zoneSeededRef = useRef(false);
  useEffect(() => {
    if (!player || zoneSeededRef.current) return;
    zoneSeededRef.current = true;
    if (player.preferred_zone && filterZone === null) setFilterZone(player.preferred_zone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const tcgSeededRef = useRef(false);
  useEffect(() => {
    if (!player || tcgSeededRef.current || tcgs.length === 0) return;
    tcgSeededRef.current = true;
    // Solo si este dispositivo nunca eligió un TCG — no pisamos una elección
    // ya guardada en este navegador (nexus.activeTcg vive fuera de la cuenta).
    const hasDeviceChoice =
      typeof window !== "undefined" && !!window.localStorage.getItem("nexus.activeTcg");
    if (!hasDeviceChoice && player.preferred_game_id) {
      const match = tcgs.find((t) => t.id === player.preferred_game_id);
      if (match) setActiveTcg(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, tcgs]);

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

  const mySlots = useMySlotRsvps(player?.id);
  const markedEvents = useMemo(
    () => events.map((e) => (acceptsSlotRsvp(e) && mySlots.has(e) ? { ...e, my_rsvp: true } : e)),
    [events, mySlots],
  );
  const calendarGrid = useCalendarGrid(markedEvents, weekDates);

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px]">
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>

      <main className="min-w-0 max-w-6xl py-8 pb-24">
        <PageHeader
          eyebrow="Torneos"
          title="Calendario"
          description={`Torneos programados${activeTcg ? ` — ${activeTcg.name}` : ""}`}
        />

        <CalendarPreferencesPrompt
          tcgs={tcgs}
          zones={zones}
          onSave={(gameId, zone) => {
            if (gameId) {
              const match = tcgs.find((t) => t.id === gameId);
              if (match) setActiveTcg(match);
            }
            if (zone) setFilterZone(zone);
          }}
        />

        {/* Ad horizontal mobile */}
        <AdHorizontal sponsor={sponsor} />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevWeek}
              className="rounded-lg border border-border p-2 text-secondary-foreground hover:text-foreground transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[200px] text-center text-sm font-semibold text-foreground">
              {weekLabel}
            </span>
            <button
              onClick={goToNextWeek}
              className="rounded-lg border border-border p-2 text-secondary-foreground hover:text-foreground transition"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={goToToday}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:text-foreground transition"
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
                    : "border-border bg-card text-secondary-foreground hover:text-foreground"
                }`}
              >
                <Star size={13} className={onlyFavorites ? "fill-primary text-primary" : ""} />
                Mis favoritas
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    onlyFavorites
                      ? "bg-primary/20 text-primary"
                      : "bg-white/10 text-secondary-foreground"
                  }`}
                >
                  {favoriteIds.length}
                </span>
              </button>
            )}

            <select
              value={filterZone ?? ""}
              onChange={(e) => setFilterZone(e.target.value || null)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
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
              className={`rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary ${
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
                <span className="text-xs font-semibold text-emerald-400">
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
            Estás filtrando por tus tiendas favoritas. Desactiva el filtro para ver todos los
            torneos.
          </p>
        )}

        {selectedEntry &&
          (isMobile ? (
            <Drawer open onOpenChange={(o) => !o && setSelectedEntry(null)}>
              <DrawerContent className="z-[90] max-h-[90dvh]">
                <div className="overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
                  <TournamentDetail
                    entry={selectedEntry}
                    playerId={player?.id}
                    attended={attendedIds.has(selectedEntry.id)}
                    Title={DrawerTitle}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <DialogPrimitive.Root open onOpenChange={(o) => !o && setSelectedEntry(null)}>
              <DialogPrimitive.Portal forceMount>
                <DialogPrimitive.Overlay asChild forceMount>
                  <div className="animate-in fade-in-0 duration-200 fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
                    <DialogPrimitive.Content
                      asChild
                      forceMount
                      onClick={(e) => e.stopPropagation()}
                      aria-describedby={undefined}
                    >
                      <div className="animate-in fade-in-0 zoom-in-95 duration-200 glass relative my-auto w-full max-w-md rounded-2xl p-6">
                        <DialogPrimitive.Close
                          aria-label="Cerrar"
                          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-foreground-secondary transition hover:bg-white/10 hover:text-foreground"
                        >
                          <X size={18} />
                        </DialogPrimitive.Close>
                        <TournamentDetail
                          entry={selectedEntry}
                          playerId={player?.id}
                          attended={attendedIds.has(selectedEntry.id)}
                          Title={DialogPrimitive.Title}
                        />
                      </div>
                    </DialogPrimitive.Content>
                  </div>
                </DialogPrimitive.Overlay>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          ))}
      </main>

      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}

function buildEventIcs(entry: any) {
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
}

function fullDate(date: string): string {
  const text = new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const secondaryAction =
  "flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition hover:bg-white/5";

function TournamentDetail({
  entry,
  playerId,
  attended,
  Title,
}: {
  entry: any;
  playerId: string | undefined;
  attended: boolean;
  /** El título accesible depende del contenedor: diálogo o panel inferior. */
  Title: React.ElementType;
}) {
  const isPast = entry.date < todayInMexicoStr();
  const location = [entry.store_address, entry.store_city, entry.store_state]
    .filter(Boolean)
    .join(", ");
  const networks = [
    entry.store_instagram && {
      label: "Instagram",
      href: `https://instagram.com/${entry.store_instagram.replace("@", "")}`,
      icon: <Instagram size={14} />,
    },
    entry.store_twitter && {
      label: "X",
      href: `https://x.com/${entry.store_twitter.replace("@", "")}`,
      icon: <Twitter size={14} />,
    },
    entry.store_twitch && {
      label: "Twitch",
      href: `https://twitch.tv/${entry.store_twitch.replace("@", "")}`,
      icon: <Twitch size={14} />,
    },
    entry.store_website && {
      label: "Sitio web",
      href: entry.store_website,
      icon: <Globe size={14} />,
    },
  ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode }[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 pr-10">
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
          {entry.game_name}
        </span>
        {entry.league_name && (
          <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-semibold text-fuchsia-300">
            {entry.league_name}
          </span>
        )}
      </div>

      <div>
        <Title asChild>
          <h3 className="text-xl font-bold text-foreground">
            {fullDate(entry.date)}
            {entry.time ? ` · ${entry.time.slice(0, 5)}` : ""}
          </h3>
        </Title>
        <p className="mt-0.5 text-base font-medium text-foreground-secondary">{entry.store_name}</p>
      </div>

      <div className="flex items-start justify-between gap-3 text-sm text-foreground-secondary">
        <p className="flex min-w-0 items-start gap-2">
          <MapPin size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {location || entry.zone}
            {location && <span className="block text-xs">{entry.zone}</span>}
          </span>
        </p>
        {entry.store_google_maps_url && (
          <a
            href={entry.store_google_maps_url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
          >
            <Navigation size={13} /> Cómo llegar
          </a>
        )}
      </div>

      {playerId && !entry.is_scheduled && attended && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">Asististe a este torneo</span>
        </div>
      )}

      {acceptsSlotRsvp(entry) && !isPast && <SlotRsvpPanel entry={entry} playerId={playerId} />}

      <div className="grid gap-2 sm:grid-cols-2">
        {!entry.is_scheduled && (
          <Link to="/tournaments/$id" params={{ id: entry.id }} className={secondaryAction}>
            Ver resultados
          </Link>
        )}
        {!isPast && (
          <a
            href={icsDataUri(buildEventIcs(entry))}
            download={icsFileName(`${entry.game_name}-${entry.store_name}-${entry.date}`)}
            className={secondaryAction}
          >
            <CalendarPlus size={15} /> Agregar a mi calendario
          </a>
        )}
        {entry.store_slug && (
          <Link to="/stores/$slug" params={{ slug: entry.store_slug }} className={secondaryAction}>
            Ver tienda
          </Link>
        )}
      </div>

      {(entry.store_phone || networks.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider pt-3 text-xs text-foreground-secondary">
          {entry.store_phone && (
            <a
              href={`tel:${entry.store_phone}`}
              className="flex items-center gap-1.5 hover:text-primary"
            >
              <Phone size={14} /> {entry.store_phone}
            </a>
          )}
          {networks.map((n) => (
            <a
              key={n.label}
              href={n.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-primary"
            >
              {n.icon} {n.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

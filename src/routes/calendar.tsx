import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { getMyAttendedTournamentIds } from "@/lib/nexus-standalone.functions";
import { getMyFavoriteStores } from "@/lib/nexus-player.functions";
import { Star } from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { PageHeader } from "@/components/ui/page-header";
import { TournamentDetailDialog } from "@/components/calendar/tournament-detail-dialog";
import { useTCG } from "@/context/tcg.context";
import { useWeekNav, useCalendarGrid, WeeklyGrid } from "@/components/calendar/weekly-grid";
import { getActiveSponsor, registerAdView } from "@/lib/nexus-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { publicCalendarQuery } from "@/lib/calendar-queries";
import { CalendarPreferencesPrompt } from "@/components/calendar/preferences-prompt";
import { acceptsSlotRsvp, useMySlotRsvps } from "@/components/calendar/slot-rsvp";

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

        {selectedEntry && (
          <TournamentDetailDialog
            entry={selectedEntry}
            playerId={player?.id}
            attended={attendedIds.has(selectedEntry.id)}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </main>

      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
    </div>
  );
}

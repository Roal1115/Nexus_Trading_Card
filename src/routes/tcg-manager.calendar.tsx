import { toLocalDateStr } from "@/lib/utils";
import { BlockSelect } from "@/components/ui/block-select";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Phone,
  Store,
  X,
} from "lucide-react";
import { getManagerCalendar } from "@/lib/nexus-manager.functions";
import { CANCELLED_TILE_CLASS, ZONE_COLORS } from "@/lib/game-colors";
import {
  StatusBadge,
  TournamentContacts,
  TournamentDetailsTable,
} from "@/components/calendar/tournament-details";
import { NationalScheduleEditSection } from "@/components/calendar/national-schedule-edit-section";
import { CancelOccurrenceSection, FichaSection } from "@/components/calendar/occurrence-panel";
import { SlotRsvpList } from "@/components/calendar/slot-rsvp";
import { MoreEntriesPopover } from "@/components/calendar/more-entries-popover";

export const Route = createFileRoute("/tcg-manager/calendar")({
  head: () => ({ meta: [{ title: "Calendario de Torneos — Nexus" }] }),
  component: ManagerCalendarPage,
});

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = [17, 18, 19, 20, 21, 22, 23];

type CalEntry = {
  id: string;
  store_id: string;
  store_name: string;
  city: string;
  zone: string;
  phone: string | null;
  instagram: string | null;
  game_id: string;
  game_name: string;
  day_of_week: number;
  date: string;
  start_time: string;
  is_past: boolean;
  is_today: boolean;
  is_future: boolean;
  is_ongoing: boolean;
  has_ended: boolean;
  report_status: "submitted" | "overdue" | "pending" | "upcoming" | "cancelled";
  cancellation_reason: string | null;
  tournament_id: string | null;
  tournament_status: string | null;
  organizer_tag: string | null;
  organizer_phone: string | null;
  national_schedule_id: string;
  override_label: string | null;
  is_override: boolean;
};
type CalData = {
  week_start: string;
  week_end: string;
  entries: CalEntry[];
  stats: {
    total_overdue: number;
    uploaded_so_far: number;
    days_elapsed: number;
    total_expected: number;
    today_expected: number;
    today_submitted: number;
  };
};

function ManagerCalendarPage() {
  const fetchCalendar = useServerFn(getManagerCalendar);

  const [calData, setCalData] = useState<CalData | null>(null);
  const [, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<string>("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<CalEntry | null>(null);
  // El detalle es un modal propio: Escape lo cierra, como los diálogos de shadcn.
  useEffect(() => {
    if (!selectedEntry) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedEntry(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEntry]);

  const reload = () => {
    setLoading(true);
    fetchCalendar({
      data: { ...(weekStart ? { week_start: weekStart } : {}) },
    } as any)
      .then((d: any) => {
        setCalData(d);
        if (!weekStart) setWeekStart(d.week_start);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const navigateWeek = (dir: -1 | 1) => {
    if (!weekStart) return;
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(toLocalDateStr(d));
  };

  const filteredEntries = useMemo<CalEntry[]>(() => {
    if (!calData?.entries) return [];
    return calData.entries.filter((e) => {
      if (zoneFilter !== "all" && e.zone !== zoneFilter) return false;
      if (storeFilter !== "all" && e.store_id !== storeFilter) return false;
      if (gameFilter !== "all" && e.game_id !== gameFilter) return false;
      return true;
    });
  }, [calData, zoneFilter, storeFilter, gameFilter]);

  const calendarGrid = useMemo(() => {
    const grid: Record<number, Record<number, CalEntry[]>> = {};
    for (let d = 0; d <= 6; d++) {
      grid[d] = {};
      for (const h of HOURS) grid[d][h] = [];
    }
    filteredEntries.forEach((e) => {
      const hour = parseInt(String(e.start_time).split(":")[0], 10);
      const colIndex = e.day_of_week === 0 ? 6 : e.day_of_week - 1;
      if (grid[colIndex] && grid[colIndex][hour] !== undefined) {
        grid[colIndex][hour].push(e);
      }
    });
    return grid;
  }, [filteredEntries]);

  const weekDates = useMemo(() => {
    if (!weekStart) return [] as Date[];
    const monday = new Date(weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const uniqueZones = Array.from(new Set((calData?.entries ?? []).map((e) => e.zone)));
  // Cascade: stores filtered by zone
  const uniqueStores = useMemo(() => {
    const src = (calData?.entries ?? []).filter(
      (e) => zoneFilter === "all" || e.zone === zoneFilter,
    );
    return src
      .map((e) => ({ id: e.store_id, name: e.store_name }))
      .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
  }, [calData, zoneFilter]);
  // Cascade: games filtered by zone + store
  const uniqueGames = useMemo(() => {
    const src = (calData?.entries ?? []).filter(
      (e) =>
        (zoneFilter === "all" || e.zone === zoneFilter) &&
        (storeFilter === "all" || e.store_id === storeFilter),
    );
    return Array.from(
      new Map(src.map((e) => [e.game_id, { id: e.game_id, name: e.game_name }])).values(),
    );
  }, [calData, zoneFilter, storeFilter]);

  const stats = calData?.stats;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-primary">TCG Manager</div>
        <h1 className="text-2xl font-bold text-white mt-1">Calendario de Torneos</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`rounded-xl border bg-black/30 p-5 ${
            (stats?.total_overdue ?? 0) > 0 ? "border-red-500/30" : "border-white/10"
          }`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <AlertTriangle
              size={14}
              className={(stats?.total_overdue ?? 0) > 0 ? "text-red-400" : "text-gray-500"}
            />
            Torneos Overdue
          </div>
          <div
            className={`text-3xl font-bold mt-2 ${
              (stats?.total_overdue ?? 0) > 0 ? "text-red-400" : "text-white"
            }`}
          >
            {stats?.total_overdue ?? 0}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {(stats?.total_overdue ?? 0) > 0
              ? `${stats?.total_overdue} tienda${(stats?.total_overdue ?? 0) > 1 ? "s" : ""} no subió resultados`
              : "Sin torneos pendientes vencidos"}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <CheckCircle2 size={14} className="text-green-400" />
            Subidos esta semana
          </div>
          <div className="text-3xl font-bold mt-2 text-white">
            {stats?.uploaded_so_far ?? 0}
            <span className="text-gray-500 text-lg"> / {stats?.days_elapsed ?? 0}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">De los torneos que ya debieron jugarse</div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-green-400 transition-all"
              style={{
                width: `${
                  (stats?.days_elapsed ?? 0) > 0
                    ? ((stats?.uploaded_so_far ?? 0) / (stats?.days_elapsed ?? 1)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <CalendarIcon size={14} className="text-primary" />
            Total semanal
          </div>
          <div className="text-3xl font-bold mt-2 text-white">{filteredEntries.length}</div>
          <div className="text-xs text-gray-400 mt-1">
            Torneos programados en el circuito esta semana
          </div>
        </div>
      </div>

      {/* Filters + week nav */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
          <button
            aria-label="Semana anterior"
            onClick={() => navigateWeek(-1)}
            className="text-gray-400 hover:text-white transition"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm text-white text-center sm:min-w-[180px]">
            {weekDates[0]?.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
            })}{" "}
            —{" "}
            {weekDates[6]?.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <button
            aria-label="Semana siguiente"
            onClick={() => navigateWeek(1)}
            className="text-gray-400 hover:text-white transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="w-40">
          <BlockSelect
            value={zoneFilter === "all" ? null : zoneFilter}
            onChange={(v) => {
              setZoneFilter(v ?? "all");
              setStoreFilter("all");
              setGameFilter("all");
            }}
            placeholder="Todas las zonas"
            options={uniqueZones.map((z) => ({ value: z, label: z }))}
          />
        </div>

        <div className="w-44">
          <BlockSelect
            value={storeFilter === "all" ? null : storeFilter}
            onChange={(v) => {
              setStoreFilter(v ?? "all");
              setGameFilter("all");
            }}
            placeholder="Todas las tiendas"
            options={uniqueStores.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>

        <div className="w-44">
          <BlockSelect
            value={gameFilter === "all" ? null : gameFilter}
            onChange={(v) => setGameFilter(v ?? "all")}
            placeholder="Todos los TCGs"
            options={uniqueGames.map((g) => ({ value: g.id, label: g.name }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {Object.entries(ZONE_COLORS).map(([zone, colors]) => (
            <div key={zone} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              {zone.replace("Zona ", "")}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: "600px", width: "100%" }}>
            {/* Header row */}
            <div
              style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)" }}
              className="border-b border-white/10"
            >
              <div className="border-r border-white/5" />
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={`p-2 text-center border-l border-white/10 ${
                      isToday ? "bg-primary/10" : ""
                    }`}
                    style={{ minWidth: 0 }}
                  >
                    <div className="text-[10px] uppercase text-gray-400">
                      {DAY_NAMES[d.getDay()]}
                    </div>
                    <div
                      className={`text-sm font-semibold ${isToday ? "text-primary" : "text-white"}`}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hour rows */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)" }}
                className="border-b border-white/5"
              >
                <div className="p-2 text-[10px] text-gray-500 text-right border-r border-white/5 flex items-start justify-end pt-2">
                  {hour}:00
                </div>
                {[0, 1, 2, 3, 4, 5, 6].map((colIdx) => {
                  const cellEntries = calendarGrid[colIdx]?.[hour] ?? [];
                  const isToday = weekDates[colIdx]?.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={colIdx}
                      className={`min-h-[60px] p-1 border-l border-white/10 ${
                        isToday ? "bg-primary/5" : ""
                      }`}
                      style={{ minWidth: 0, overflow: "hidden" }}
                    >
                      {cellEntries.length === 0 ? null : cellEntries.length === 1 ? (
                        <CalendarEntry
                          entry={cellEntries[0]}
                          onClick={() => setSelectedEntry(cellEntries[0])}
                        />
                      ) : (
                        <div className="space-y-0.5">
                          {cellEntries.slice(0, 2).map((e) => (
                            <CalendarEntry
                              key={e.id}
                              entry={e}
                              compact
                              onClick={() => setSelectedEntry(e)}
                            />
                          ))}
                          {cellEntries.length > 2 && (
                            <MoreEntriesPopover
                              hiddenCount={cellEntries.length - 2}
                              title={`${DAY_NAMES[weekDates[colIdx].getDay()]} ${weekDates[colIdx].getDate()} · ${hour}:00`}
                            >
                              {(close) =>
                                cellEntries.map((e) => (
                                  <CalendarEntry
                                    key={e.id}
                                    entry={e}
                                    onClick={() => {
                                      close();
                                      setSelectedEntry(e);
                                    }}
                                  />
                                ))
                              }
                            </MoreEntriesPopover>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <TournamentDetailsTable entries={filteredEntries} />

      {/* Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center sm:p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-[#0e0e10] border-white/10 w-full h-dvh overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-5 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-2xl sm:border sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={selectedEntry.store_name}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <Store size={12} />
                  {selectedEntry.zone}
                </div>
                <h2 className="text-xl font-bold text-white">{selectedEntry.store_name}</h2>
                <div className="text-sm text-gray-400">{selectedEntry.city}</div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-500 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-[10px] uppercase text-gray-500">Estado del torneo</div>
                <div className="flex items-center gap-2 mt-1 text-sm text-white">
                  {selectedEntry.is_ongoing ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      En curso
                    </>
                  ) : selectedEntry.is_future ? (
                    <>
                      <Clock size={14} className="text-gray-400" />
                      Próximo
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} className="text-gray-400" />
                      Finalizado
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-[10px] uppercase text-gray-500">Reporte</div>
                <div className="mt-1">
                  <StatusBadge status={selectedEntry.report_status} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-gray-500">TCG</div>
              <div className="mt-1 text-sm text-white">
                {selectedEntry.game_name}
                {selectedEntry.override_label && (
                  <span className="ml-2 text-xs text-amber-400">
                    "{selectedEntry.override_label}"
                  </span>
                )}
              </div>
            </div>

            <CancelOccurrenceSection
              entry={selectedEntry}
              onSaved={() => {
                reload();
                setSelectedEntry(null);
              }}
            />

            <FichaSection entry={selectedEntry} />

            <NationalScheduleEditSection
              entry={selectedEntry}
              onSaved={() => {
                reload();
                setSelectedEntry(null);
              }}
            />

            <SlotRsvpList slot={selectedEntry} />

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-gray-500">Horario</div>
              <div className="flex items-center gap-2 mt-1 text-sm text-white">
                <Clock size={14} className="text-gray-400" />
                {DAY_NAMES[selectedEntry.day_of_week]}s · {selectedEntry.start_time.slice(0, 5)} hrs
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Este torneo:{" "}
                {new Date(selectedEntry.date + "T12:00:00").toLocaleDateString("es-MX", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
            </div>

            <TournamentContacts entry={selectedEntry} />
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarEntry({
  entry,
  compact,
  onClick,
}: {
  entry: CalEntry;
  compact?: boolean;
  onClick: () => void;
}) {
  const colors = ZONE_COLORS[entry.zone] ?? ZONE_COLORS["Zona Extendida"];
  const isOverdue = entry.report_status === "overdue";
  const isCancelled = entry.report_status === "cancelled";
  return (
    <button
      onClick={onClick}
      title={isCancelled ? `Cancelado: ${entry.cancellation_reason ?? ""}` : undefined}
      aria-label={isCancelled ? `${entry.store_name}, cancelado` : undefined}
      className={`w-full text-left rounded px-1.5 py-1 ${isCancelled ? CANCELLED_TILE_CLASS : `${colors.bg} ${colors.border}`} border hover:brightness-125 transition`}
    >
      <div className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
        {isCancelled && <Ban size={10} className="shrink-0 text-red-300" aria-hidden="true" />}
        <span
          className={`text-[10px] truncate ${isCancelled ? "text-red-200 line-through" : colors.text}`}
        >
          {entry.store_name}
        </span>
      </div>
      {!compact && entry.game_name && (
        <div className="text-[9px] text-gray-400 truncate mt-0.5">
          {entry.override_label ?? entry.game_name}
          {entry.is_override && <span className="ml-1 text-amber-400">· editado</span>}
        </div>
      )}

      {!compact && (
        <div className="flex items-center gap-1 mt-0.5">
          {isOverdue && <span className="text-[9px] text-red-400 font-semibold">OVERDUE</span>}
          {isCancelled && (
            <span className="text-[9px] font-bold uppercase text-red-300">Cancelado</span>
          )}
          {entry.report_status === "submitted" && (
            <span className="text-[9px] text-green-400">✓</span>
          )}
        </div>
      )}
    </button>
  );
}

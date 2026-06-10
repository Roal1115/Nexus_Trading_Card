import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
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
import {
  getManagerCalendar,
} from "@/lib/geekarena-manager.functions";


export const Route = createFileRoute("/tcg-manager/calendar")({
  head: () => ({ meta: [{ title: "Calendario de Torneos — Geek Arena" }] }),
  component: ManagerCalendarPage,
});

type ZoneColor = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

const ZONE_COLORS: Record<string, ZoneColor> = {
  "Zona Monterrey": {
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    border: "border-orange-500/30",
    dot: "bg-orange-400",
  },
  "Zona Guadalajara": {
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    border: "border-blue-500/30",
    dot: "bg-blue-400",
  },
  "Zona Centro": {
    bg: "bg-green-500/15",
    text: "text-green-300",
    border: "border-green-500/30",
    dot: "bg-green-400",
  },
  "Zona Extendida": {
    bg: "bg-gray-500/15",
    text: "text-gray-300",
    border: "border-gray-500/30",
    dot: "bg-gray-400",
  },
};

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
  report_status: "submitted" | "overdue" | "pending" | "upcoming";
  tournament_id: string | null;
  tournament_status: string | null;
  organizer_tag: string | null;
  organizer_phone: string | null;
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

  useEffect(() => {
    setLoading(true);
    fetchCalendar({
      data: { ...(weekStart ? { week_start: weekStart } : {}) },
    } as any)
      .then((d: any) => {
        setCalData(d);
        if (!weekStart) setWeekStart(d.week_start);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const navigateWeek = (dir: -1 | 1) => {
    if (!weekStart) return;
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d.toISOString().split("T")[0]);
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

  const uniqueZones = Array.from(
    new Set((calData?.entries ?? []).map((e) => e.zone)),
  );
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
        <div className="text-xs uppercase tracking-wider text-primary">
          TCG Manager
        </div>
        <h1 className="text-2xl font-bold text-white mt-1">
          Calendario de Torneos
        </h1>
      </div>



      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`rounded-xl border bg-black/30 p-5 ${
            (stats?.total_overdue ?? 0) > 0
              ? "border-red-500/30"
              : "border-white/10"
          }`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <AlertTriangle
              size={14}
              className={
                (stats?.total_overdue ?? 0) > 0
                  ? "text-red-400"
                  : "text-gray-500"
              }
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
            <span className="text-gray-500 text-lg">
              {" "}
              / {stats?.days_elapsed ?? 0}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            De los torneos que ya debieron jugarse
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-green-400 transition-all"
              style={{
                width: `${
                  (stats?.days_elapsed ?? 0) > 0
                    ? ((stats?.uploaded_so_far ?? 0) /
                        (stats?.days_elapsed ?? 1)) *
                      100
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
          <div className="text-3xl font-bold mt-2 text-white">
            {filteredEntries.length}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Torneos programados en el circuito esta semana
          </div>
        </div>
      </div>

      {/* Filters + week nav */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="text-gray-400 hover:text-white transition"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm text-white min-w-[180px] text-center">
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
            onClick={() => navigateWeek(1)}
            className="text-gray-400 hover:text-white transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="all">Todas las zonas</option>
          {uniqueZones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>

        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="all">Todas las tiendas</option>
          {uniqueStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="all">Todos los TCGs</option>
          {uniqueGames.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>



        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {Object.entries(ZONE_COLORS).map(([zone, colors]) => (
            <div
              key={zone}
              className="flex items-center gap-1.5 text-xs text-gray-400"
            >
              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              {zone.replace("Zona ", "")}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: "760px", width: "100%" }}>
            {/* Header row */}
            <div
              style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)" }}
              className="border-b border-white/10"
            >
              <div className="border-r border-white/5" />
              {weekDates.map((d, i) => {
                const isToday =
                  d.toDateString() === new Date().toDateString();
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
                      className={`text-sm font-semibold ${
                        isToday ? "text-primary" : "text-white"
                      }`}
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
                  const isToday =
                    weekDates[colIdx]?.toDateString() ===
                    new Date().toDateString();
                  return (
                    <div
                      key={colIdx}
                      className={`min-h-[60px] p-1 border-l border-white/10 ${
                        isToday ? "bg-primary/5" : ""
                      }`}
                      style={{ minWidth: 0, overflow: "hidden" }}
                    >
                      {cellEntries.length === 0 ? null : cellEntries.length ===
                        1 ? (
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
                            <button
                              onClick={() => setSelectedEntry(cellEntries[2])}
                              className="text-[9px] text-gray-500 hover:text-white text-left px-1"
                            >
                              +{cellEntries.length - 2} más
                            </button>
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

      {/* Detail table */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">
            Detalle de torneos
          </h2>
        </div>

        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-xs uppercase text-gray-400">
              <tr>
                <th className="text-left px-4 py-2">Tienda</th>
                <th className="text-left px-4 py-2">Zona</th>
                <th className="text-left px-4 py-2">Día / Hora</th>
                <th className="text-left px-4 py-2">Estado</th>
                <th className="text-left px-4 py-2">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e) => {
                const zoneColor =
                  ZONE_COLORS[e.zone] ?? ZONE_COLORS["Zona Extendida"];
                const waLink = e.phone
                  ? `https://wa.me/${e.phone.replace(/\D/g, "")}`
                  : null;
                return (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">
                        {e.store_name}
                      </div>
                      <div className="text-xs text-gray-400">{e.city}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${zoneColor.bg} ${zoneColor.text} border ${zoneColor.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${zoneColor.dot}`} />
                        {e.zone.replace("Zona ", "")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {DAY_NAMES[e.day_of_week]} · {e.start_time.slice(0, 5)}
                      <div className="text-xs text-gray-500">{e.date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.report_status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {e.organizer_tag && (
                          <span className="text-xs text-gray-300">
                            {e.organizer_tag}
                          </span>
                        )}
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                          >
                            <MessageCircle size={12} />
                            WhatsApp
                          </a>
                        )}
                        {e.phone && (
                          <span className="text-xs text-gray-500">
                            {e.phone}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-white/5">
          {filteredEntries.map((e) => {
            const zoneColor =
              ZONE_COLORS[e.zone] ?? ZONE_COLORS["Zona Extendida"];
            const waLink = e.phone
              ? `https://wa.me/${e.phone.replace(/\D/g, "")}`
              : null;
            return (
              <div key={e.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-white">
                    {e.store_name}
                  </div>
                  <StatusBadge status={e.report_status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${zoneColor.bg} ${zoneColor.text}`}
                  >
                    {e.zone.replace("Zona ", "")}
                  </span>
                  <span>·</span>
                  <span>
                    {DAY_NAMES[e.day_of_week]} {e.start_time.slice(0, 5)}
                  </span>
                  <span>·</span>
                  <span>{e.city}</span>
                </div>
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-400"
                  >
                    <MessageCircle size={12} /> WhatsApp · {e.phone}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-[#0e0e10] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <Store size={12} />
                  {selectedEntry.zone}
                </div>
                <h2 className="text-xl font-bold text-white">
                  {selectedEntry.store_name}
                </h2>
                <div className="text-sm text-gray-400">
                  {selectedEntry.city}
                </div>
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
                <div className="text-[10px] uppercase text-gray-500">
                  Estado del torneo
                </div>
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
                <div className="text-[10px] uppercase text-gray-500">
                  Reporte
                </div>
                <div className="mt-1">
                  <StatusBadge status={selectedEntry.report_status} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-gray-500">TCG</div>
              <div className="mt-1 text-sm text-white">
                {selectedEntry.game_name}
              </div>
            </div>



            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-gray-500">Horario</div>
              <div className="flex items-center gap-2 mt-1 text-sm text-white">
                <Clock size={14} className="text-gray-400" />
                {DAY_NAMES[selectedEntry.day_of_week]}s ·{" "}
                {selectedEntry.start_time.slice(0, 5)} hrs
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Este torneo:{" "}
                {new Date(
                  selectedEntry.date + "T12:00:00",
                ).toLocaleDateString("es-MX", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-gray-500">
                Organizador
              </div>
              {selectedEntry.organizer_tag ? (
                <div className="space-y-2 mt-1">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <Store size={14} className="text-gray-400" />
                    {selectedEntry.organizer_tag}
                  </div>
                  {selectedEntry.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Phone size={14} className="text-gray-400" />
                      <span>{selectedEntry.phone}</span>
                      <a
                        href={`https://wa.me/${selectedEntry.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-400/20 rounded px-2 py-1 transition"
                      >
                        <MessageCircle size={12} /> WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-1">
                  Sin organizador asignado
                </div>
              )}
            </div>
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
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded px-1.5 py-1 ${colors.bg} ${colors.border} border hover:brightness-125 transition`}
    >
      <div className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
        <span className={`text-[10px] truncate ${colors.text}`}>
          {entry.store_name}
        </span>
      </div>
      {!compact && entry.game_name && (
        <div className="text-[9px] text-gray-400 truncate mt-0.5">
          {entry.game_name}
        </div>
      )}

      {!compact && (
        <div className="flex items-center gap-1 mt-0.5">
          {isOverdue && (
            <span className="text-[9px] text-red-400 font-semibold">
              OVERDUE
            </span>
          )}
          {entry.report_status === "submitted" && (
            <span className="text-[9px] text-green-400">✓</span>
          )}
        </div>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    submitted: {
      label: "Enviado",
      className: "bg-green-500/20 text-green-400",
    },
    overdue: { label: "Overdue", className: "bg-red-500/20 text-red-400" },
    pending: {
      label: "Pendiente",
      className: "bg-yellow-500/20 text-yellow-400",
    },
    upcoming: { label: "Próximo", className: "bg-gray-500/20 text-gray-400" },
  };
  const s = map[status] ?? map.upcoming;
  return (
    <span
      className={`inline-block text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${s.className}`}
    >
      {s.label}
    </span>
  );
}

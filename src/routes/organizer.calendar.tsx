import { toLocalDateStr } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getOrganizerCalendar } from "@/lib/nexus-organizer.functions";

export const Route = createFileRoute("/organizer/calendar")({
  head: () => ({ meta: [{ title: "Calendario — Nexus" }] }),
  component: OrganizerCalendarPage,
});

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = [17, 18, 19, 20, 21, 22, 23];

type CalEntry = {
  id: string;
  store_id: string;
  store_name: string;
  city: string;
  zone: string;
  game_id: string;
  game_name: string;
  day_of_week: number;
  date: string;
  start_time: string;
  is_today: boolean;
  is_future: boolean;
  report_status: "submitted" | "overdue" | "pending" | "upcoming";
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
  };
};

function OrganizerCalendarPage() {
  const fetchCalendar = useServerFn(getOrganizerCalendar);
  const [calData, setCalData] = useState<CalData | null>(null);
  const [weekStart, setWeekStart] = useState<string>("");
  const [gameFilter, setGameFilter] = useState<string>("all");

  useEffect(() => {
    fetchCalendar({ data: { ...(weekStart ? { week_start: weekStart } : {}) } } as any)
      .then((d: any) => {
        setCalData(d);
        if (!weekStart) setWeekStart(d.week_start);
      })
      .catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const navigateWeek = (dir: -1 | 1) => {
    if (!weekStart) return;
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(toLocalDateStr(d));
  };

  const weekDates = useMemo(() => {
    if (!weekStart) return [] as Date[];
    const monday = new Date(weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const filteredEntries = useMemo<CalEntry[]>(() => {
    if (!calData?.entries) return [];
    return calData.entries.filter(
      (e) => gameFilter === "all" || e.game_id === gameFilter,
    );
  }, [calData, gameFilter]);

  const uniqueGames = useMemo(
    () =>
      Array.from(
        new Map(
          (calData?.entries ?? []).map((e) => [
            e.game_id,
            { id: e.game_id, name: e.game_name },
          ]),
        ).values(),
      ),
    [calData],
  );

  const calendarGrid = useMemo(() => {
    const grid: Record<number, Record<number, CalEntry[]>> = {};
    for (let d = 0; d <= 6; d++) {
      grid[d] = {};
      for (const h of HOURS) grid[d][h] = [];
    }
    filteredEntries.forEach((e) => {
      const hour = parseInt(String(e.start_time).split(":")[0], 10);
      const colIndex = e.day_of_week === 0 ? 6 : e.day_of_week - 1;
      if (grid[colIndex]?.[hour] !== undefined) grid[colIndex][hour].push(e);
    });
    return grid;
  }, [filteredEntries]);

  const stats = calData?.stats;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-primary">
          Organizador
        </div>
        <h1 className="text-2xl font-bold text-white mt-1">
          Calendario de mi tienda
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Vista de solo lectura de los torneos programados en tu tienda.
        </p>
      </div>

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
            Overdue
          </div>
          <div
            className={`text-3xl font-bold mt-2 ${
              (stats?.total_overdue ?? 0) > 0 ? "text-red-400" : "text-white"
            }`}
          >
            {stats?.total_overdue ?? 0}
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
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <CalendarIcon size={14} className="text-primary" />
            Total semanal
          </div>
          <div className="text-3xl font-bold mt-2 text-white">{filteredEntries.length}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
          <button onClick={() => navigateWeek(-1)} className="text-gray-400 hover:text-white">
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm text-white min-w-[180px] text-center">
            {weekDates[0]?.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} —{" "}
            {weekDates[6]?.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <button onClick={() => navigateWeek(1)} className="text-gray-400 hover:text-white">
            <ChevronRight size={18} />
          </button>
        </div>
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
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: "760px", width: "100%" }}>
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
                  return (
                    <div
                      key={colIdx}
                      className="min-h-[60px] p-1 border-l border-white/10"
                      style={{ minWidth: 0, overflow: "hidden" }}
                    >
                      {cellEntries.map((e) => (
                        <div
                          key={e.id}
                          className="w-full text-left rounded px-1.5 py-1 mb-0.5 bg-primary/10 border border-primary/30"
                        >
                          <div className="text-[10px] text-primary truncate">
                            {e.game_name}
                          </div>
                          <div className="text-[9px] text-gray-400 truncate">
                            {e.start_time}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";

export const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const HOURS = Array.from({ length: 10 }, (_, i) => i + 14); // 2pm a 10pm

export const GAME_COLORS: Record<string, string> = {
  "one-piece": "bg-orange-500/20 border-orange-500/40 text-orange-300",
  "magic-the-gathering": "bg-blue-500/20 border-blue-500/40 text-blue-300",
  pokemon: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
};
export const GAME_DOT_COLORS: Record<string, string> = {
  "one-piece": "bg-orange-400",
  "magic-the-gathering": "bg-blue-400",
  pokemon: "bg-yellow-400",
};
export const DEFAULT_COLOR_CLASS = "bg-[#32D9FF]/20 border-[#32D9FF]/40 text-[#32D9FF]";
export const DEFAULT_DOT_COLOR = "bg-[#32D9FF]";

export function colorClassForGame(slug: string) {
  return GAME_COLORS[slug] ?? DEFAULT_COLOR_CLASS;
}
export function dotColorForGame(slug: string) {
  return GAME_DOT_COLORS[slug] ?? DEFAULT_DOT_COLOR;
}

export function useWeekNav() {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // domingo de la semana actual
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekStartStr = weekStart.toISOString().split("T")[0];

  const goToPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const goToNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const goToToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
  };

  const weekLabel = `${weekDates[0].getDate()} ${weekDates[0].toLocaleString("es-MX", { month: "short" })} — ${weekDates[6].getDate()} ${weekDates[6].toLocaleString("es-MX", { month: "short", year: "numeric" })}`;

  return { weekStart, weekDates, weekStartStr, goToPrevWeek, goToNextWeek, goToToday, weekLabel };
}

export function useCalendarGrid(events: any[], weekDates: Date[]) {
  return useMemo(() => {
    const grid = new Map<number, Map<number, any[]>>();
    for (let i = 0; i < 7; i++) grid.set(i, new Map());
    for (const e of events) {
      const eDate = new Date(e.date + "T12:00:00");
      const colIdx = weekDates.findIndex((d) => d.toDateString() === eDate.toDateString());
      if (colIdx === -1) continue;
      const hour = e.time ? parseInt(e.time.split(":")[0]) : 10;
      const col = grid.get(colIdx)!;
      if (!col.has(hour)) col.set(hour, []);
      col.get(hour)!.push(e);
    }
    return grid;
  }, [events, weekDates]);
}

export function CalendarEntry({
  entry,
  compact,
  attended,
  onClick,
}: {
  entry: any;
  compact?: boolean;
  attended: boolean;
  onClick: () => void;
}) {
  const colorClass = colorClassForGame(entry.game_slug);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded border px-1.5 py-1 transition hover:brightness-110 ${colorClass} ${compact ? "py-0.5" : ""}`}
    >
      <p className={`font-semibold truncate ${compact ? "text-[9px]" : "text-[10px]"}`}>
        {entry.store_name}
        {attended && <CheckCircle2 size={8} className="inline text-emerald-400 ml-1" />}
      </p>
      {!compact && <p className="text-[9px] opacity-70 truncate">{entry.game_name}</p>}
    </button>
  );
}

export function WeeklyGrid({
  weekDates,
  calendarGrid,
  attendedIds,
  loading,
  onSelectEntry,
}: {
  weekDates: Date[];
  calendarGrid: Map<number, Map<number, any[]>>;
  attendedIds: Set<string>;
  loading: boolean;
  onSelectEntry: (entry: any) => void;
}) {
  if (loading) {
    return (
      <div className="p-4">
        <SkeletonBlock className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  return (
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
                className={`p-2 text-center border-l border-white/10 ${isToday ? "bg-primary/10" : ""}`}
                style={{ minWidth: 0 }}
              >
                <div className="text-[10px] uppercase text-gray-400">{DAY_NAMES[d.getDay()]}</div>
                <div className={`text-sm font-semibold ${isToday ? "text-primary" : "text-white"}`}>
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
              const cellEntries = calendarGrid.get(colIdx)?.get(hour) ?? [];
              const isToday = weekDates[colIdx]?.toDateString() === new Date().toDateString();
              return (
                <div
                  key={colIdx}
                  className={`min-h-[60px] p-1 border-l border-white/10 ${isToday ? "bg-primary/5" : ""}`}
                  style={{ minWidth: 0, overflow: "hidden" }}
                >
                  {cellEntries.length === 0 ? null : cellEntries.length === 1 ? (
                    <CalendarEntry
                      entry={cellEntries[0]}
                      attended={attendedIds.has(cellEntries[0].id)}
                      onClick={() => onSelectEntry(cellEntries[0])}
                    />
                  ) : (
                    <div className="space-y-0.5">
                      {cellEntries.slice(0, 2).map((e) => (
                        <CalendarEntry
                          key={e.id}
                          entry={e}
                          compact
                          attended={attendedIds.has(e.id)}
                          onClick={() => onSelectEntry(e)}
                        />
                      ))}
                      {cellEntries.length > 2 && (
                        <button
                          onClick={() => onSelectEntry(cellEntries[2])}
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
  );
}

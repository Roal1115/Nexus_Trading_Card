import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Heart } from "lucide-react";
import { Ban } from "lucide-react";
import { CANCELLED_TILE_CLASS } from "@/lib/game-colors";
import { EmptyState } from "@/components/ui/empty-state";
import { MoreEntriesPopover } from "@/components/calendar/more-entries-popover";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";
import { toLocalDateStr, mondayOfWeek } from "@/lib/utils";

import {
  GAME_COLORS,
  GAME_DOT_COLORS,
  DEFAULT_COLOR_CLASS,
  DEFAULT_DOT_COLOR,
  colorClassForGame,
  dotColorForGame,
  leagueAccentClass,
} from "@/lib/game-colors";
export {
  GAME_COLORS,
  GAME_DOT_COLORS,
  DEFAULT_COLOR_CLASS,
  DEFAULT_DOT_COLOR,
  colorClassForGame,
  dotColorForGame,
  leagueAccentClass,
};

export const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const HOURS = Array.from({ length: 11 }, (_, i) => i + 13); // 1pm a 11pm

export function useWeekNav() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOfWeek(new Date()));

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekStartStr = toLocalDateStr(weekStart);

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
  const goToToday = () => setWeekStart(mondayOfWeek(new Date()));

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
  plain,
  attended,
  onClick,
}: {
  entry: any;
  compact?: boolean;
  // Calendario público: sin color por juego (DESIGN.md, superficie sobria).
  plain?: boolean;
  attended: boolean;
  onClick: () => void;
}) {
  const colorClass = colorClassForGame(entry.game_slug);
  const accentClass = leagueAccentClass(entry.league_id);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border transition hover:brightness-110 ${compact ? "px-2 py-1" : "min-h-11 px-3 py-2"} ${entry.cancellation_reason ? CANCELLED_TILE_CLASS : plain ? "border-border bg-card text-foreground hover:border-primary/60" : `${colorClass} ${accentClass}`}`}
    >
      {entry.cancellation_reason && (
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-red-300">
          <Ban size={12} aria-hidden="true" /> Cancelado
        </p>
      )}
      <p
        className={`font-semibold truncate ${compact ? "text-xs" : "text-sm"} ${entry.cancellation_reason ? "line-through" : ""}`}
      >
        {entry.store_name}
        {attended && <CheckCircle2 size={12} className="inline text-emerald-400 ml-1" />}
        {entry.my_rsvp && (
          <Heart size={12} className="inline fill-current ml-1" aria-label="Te interesa ir" />
        )}
      </p>
      {!compact && (
        <p className="text-xs text-foreground-secondary truncate">
          {[entry.time?.slice(0, 5), !plain && entry.game_name].filter(Boolean).join(" · ")}
        </p>
      )}
      {!compact && entry.is_scheduled && (
        <p className="text-xs text-foreground-secondary truncate">
          Horario habitual · Por confirmar
        </p>
      )}
      {!compact && entry.league_name && (
        <p className="text-xs font-semibold text-foreground-secondary truncate">
          {entry.league_name}
        </p>
      )}
    </button>
  );
}

export function WeeklyGrid({
  weekDates,
  calendarGrid,
  attendedIds,
  loading,
  onSelectEntry,
  hideStoresLink = false,
}: {
  weekDates: Date[];
  calendarGrid: Map<number, Map<number, any[]>>;
  attendedIds: Set<string>;
  loading: boolean;
  onSelectEntry: (entry: any) => void;
  /** Dentro de la página de una tienda no tiene sentido mandar al directorio. */
  hideStoresLink?: boolean;
}) {
  if (loading) {
    return (
      <div className="p-4">
        <SkeletonBlock className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  const totalEntries = Array.from(calendarGrid.values()).reduce(
    (sum, col) => sum + Array.from(col.values()).reduce((s, arr) => s + arr.length, 0),
    0,
  );

  if (totalEntries === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={20} />}
        title="Sin torneos esta semana"
        description={
          hideStoresLink
            ? "Prueba con otra semana."
            : "Prueba con otra semana, quita los filtros o mira qué tiendas hay cerca."
        }
        action={
          hideStoresLink ? undefined : (
            <Link to="/stores" className="text-sm font-semibold text-primary hover:underline">
              Ver tiendas
            </Link>
          )
        }
      />
    );
  }

  return (
    <>
      <MobileWeeklyList
        weekDates={weekDates}
        calendarGrid={calendarGrid}
        attendedIds={attendedIds}
        onSelectEntry={onSelectEntry}
      />
      <div className="hidden overflow-x-auto sm:block">
        <div style={{ minWidth: "600px", width: "100%" }}>
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
                  <div className="text-[10px] uppercase text-foreground-secondary">
                    {DAY_NAMES[d.getDay()]}
                  </div>
                  <div
                    className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}
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
              <div className="p-2 text-[10px] text-foreground-subtle text-right border-r border-white/5 flex items-start justify-end pt-2">
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
                        plain
                        entry={cellEntries[0]}
                        attended={attendedIds.has(cellEntries[0].id)}
                        onClick={() => onSelectEntry(cellEntries[0])}
                      />
                    ) : (
                      <div className="space-y-0.5">
                        {cellEntries.slice(0, 2).map((e) => (
                          <CalendarEntry
                            plain
                            key={e.id}
                            entry={e}
                            compact
                            attended={attendedIds.has(e.id)}
                            onClick={() => onSelectEntry(e)}
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
                                  plain
                                  key={e.id}
                                  entry={e}
                                  attended={attendedIds.has(e.id)}
                                  onClick={() => {
                                    close();
                                    onSelectEntry(e);
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
    </>
  );
}

function MobileWeeklyList({
  weekDates,
  calendarGrid,
  attendedIds,
  onSelectEntry,
}: {
  weekDates: Date[];
  calendarGrid: Map<number, Map<number, any[]>>;
  attendedIds: Set<string>;
  onSelectEntry: (entry: any) => void;
}) {
  return (
    <div className="divide-y divide-white/5 sm:hidden">
      {weekDates.map((d, colIdx) => {
        const dayEntries = Array.from(calendarGrid.get(colIdx)?.entries() ?? [])
          .sort(([hourA], [hourB]) => hourA - hourB)
          .flatMap(([, entries]) => entries);
        const isToday = d.toDateString() === new Date().toDateString();

        return (
          <div key={colIdx} className="p-3">
            <p
              className={`mb-2 text-xs font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-foreground-secondary"}`}
            >
              {DAY_NAMES[d.getDay()]} {d.getDate()}
            </p>
            {dayEntries.length === 0 ? (
              <p className="text-xs text-foreground-subtle">
                {d < new Date() && !isToday ? "—" : "Sin torneos"}
              </p>
            ) : (
              <div className="space-y-1.5">
                {dayEntries.map((entry) => (
                  <CalendarEntry
                    plain
                    key={entry.id}
                    entry={entry}
                    attended={attendedIds.has(entry.id)}
                    onClick={() => onSelectEntry(entry)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

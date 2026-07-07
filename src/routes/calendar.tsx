import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, MapPin } from "lucide-react";
import { getPublicCalendar } from "@/lib/geekarena-public.functions";
import { useTCG } from "@/context/tcg.context";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendario — Geek Arena" }] }),
  component: CalendarPage,
});

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const GAME_COLORS: Record<string, string> = {
  "one piece": "#f97316",
  magic: "#3b82f6",
  pokemon: "#eab308",
  pokémon: "#eab308",
};
const DEFAULT_COLOR = "#32D9FF";

function colorForGame(name: string) {
  const n = (name ?? "").toLowerCase();
  for (const k of Object.keys(GAME_COLORS)) if (n.includes(k)) return GAME_COLORS[k];
  return DEFAULT_COLOR;
}

type Event = {
  id: string;
  date: string;
  start_time: string | null;
  store_id: string;
  store_name: string;
  city: string;
  state: string;
  zone: string;
  game_id: string;
  game_name: string;
};

function CalendarPage() {
  const fetchCal = useServerFn(getPublicCalendar);
  const { activeTcg } = useTCG();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [filterZone, setFilterZone] = useState<string>("");
  const [filterStore, setFilterStore] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    setLoading(true);
    fetchCal({
      data: {
        game_id: activeTcg?.id ?? null,
        zone: filterZone || null,
        store_id: filterStore || null,
        year,
        month: month + 1,
      },
    } as any)
      .then((d: any) => {
        setEvents(d.events ?? []);
        setStores(d.stores ?? []);
        setZones(d.zones ?? []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, activeTcg?.id, filterZone, filterStore]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, Event[]>();
    for (const e of events) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [events]);

  const gridCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startPad = firstDay.getDay(); // 0=Dom
    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ date: null, key: `p${i}` });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), key: `d${d}` });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, key: `t${cells.length}` });
    return cells;
  }, [year, month]);

  const navigateMonth = (dir: -1 | 1) => {
    setCurrentDate(new Date(year, month + dir, 1));
  };

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const dayEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-primary">Público</div>
        <h1 className="text-2xl font-bold text-white mt-1">Calendario de torneos</h1>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
            style={{
              color: activeTcg ? colorForGame(activeTcg.name) : DEFAULT_COLOR,
              borderColor: (activeTcg ? colorForGame(activeTcg.name) : DEFAULT_COLOR) + "55",
              backgroundColor: (activeTcg ? colorForGame(activeTcg.name) : DEFAULT_COLOR) + "1a",
            }}
          >
            {activeTcg?.name ?? "Todos los TCGs"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
          <button onClick={() => navigateMonth(-1)} className="text-gray-400 hover:text-white">
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm text-white min-w-[160px] text-center capitalize">
            {currentDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
          </div>
          <button onClick={() => navigateMonth(1)} className="text-gray-400 hover:text-white">
            <ChevronRight size={18} />
          </button>
        </div>
        <select
          value={filterZone}
          onChange={(e) => {
            setFilterZone(e.target.value);
            setFilterStore("");
          }}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="">Todas las zonas</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="">Todas las tiendas</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/10">
          {DAY_NAMES.map((d) => (
            <div key={d} className="p-2 text-center text-[10px] uppercase text-gray-400">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="p-4">
            <SkeletonBlock className="h-64 w-full rounded-lg" />
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-white font-medium">Sin torneos este mes.</p>
            <p className="text-xs text-gray-400 mt-1">
              Prueba con otro mes o cambia los filtros.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {gridCells.map((cell) => {
              if (!cell.date) {
                return <div key={cell.key} className="min-h-[72px] border-t border-l border-white/5" />;
              }
              const iso = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, "0")}-${String(cell.date.getDate()).padStart(2, "0")}`;
              const dayEvts = eventsByDay.get(iso) ?? [];
              const isToday = cell.date.toDateString() === new Date().toDateString();
              const hasEvents = dayEvts.length > 0;
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={!hasEvents}
                  onClick={() => hasEvents && setSelectedDay(iso)}
                  className={`min-h-[72px] border-t border-l border-white/5 p-1.5 text-left transition ${
                    isToday ? "bg-primary/10" : ""
                  } ${hasEvents ? "hover:bg-white/5 cursor-pointer" : "cursor-default"}`}
                >
                  <div
                    className={`text-xs font-semibold ${
                      isToday ? "text-primary" : "text-white"
                    }`}
                  >
                    {cell.date.getDate()}
                  </div>
                  {hasEvents && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dayEvts.slice(0, 4).map((e) => (
                        <span
                          key={e.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: colorForGame(e.game_name) }}
                        />
                      ))}
                      {dayEvts.length > 4 && (
                        <span className="text-[9px] text-gray-400">+{dayEvts.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0B1220]/95 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400">
                  Torneos
                </p>
                <p className="text-sm font-semibold text-white capitalize">
                  {fmtDate(selectedDay)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {dayEvents.map((e) => {
                const color = colorForGame(e.game_name);
                return (
                  <div
                    key={e.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
                        style={{
                          color,
                          borderColor: color + "55",
                          backgroundColor: color + "1a",
                        }}
                      >
                        {e.game_name}
                      </span>
                      {e.zone && (
                        <span className="text-[10px] rounded-full bg-white/10 px-2 py-0.5 text-gray-300">
                          {e.zone}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-semibold text-white">{e.store_name}</p>
                    <p className="text-xs text-gray-400">
                      {[e.city, e.state].filter(Boolean).join(", ")}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                      <MapPin size={12} />
                      {e.city || "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

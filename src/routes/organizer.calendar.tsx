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
import { toast } from "sonner";
import {
  getOrganizerCalendar,
  upsertLeagueScheduleOverride,
  deleteLeagueScheduleOverride,
} from "@/lib/nexus-organizer.functions";
import { BlockSelect } from "@/components/ui/block-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/organizer/calendar")({
  head: () => ({ meta: [{ title: "Calendario — Nexus" }] }),
  component: OrganizerCalendarPage,
});

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

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
  league_id: string | null;
  league_name: string | null;
  league_schedule_id: string | null;
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
  };
};

function OrganizerCalendarPage() {
  const fetchCalendar = useServerFn(getOrganizerCalendar);
  const upsertOverrideFn = useServerFn(upsertLeagueScheduleOverride);
  const deleteOverrideFn = useServerFn(deleteLeagueScheduleOverride);
  const [calData, setCalData] = useState<CalData | null>(null);
  const [weekStart, setWeekStart] = useState<string>("");
  const [gameFilter, setGameFilter] = useState<string>("all");

  const [editingEntry, setEditingEntry] = useState<CalEntry | null>(null);
  const [editForm, setEditForm] = useState({ label: "", start_time: "" });
  const [savingOverride, setSavingOverride] = useState(false);

  const reload = () => {
    fetchCalendar({ data: { ...(weekStart ? { week_start: weekStart } : {}) } } as any)
      .then((d: any) => {
        setCalData(d);
        if (!weekStart) setWeekStart(d.week_start);
      })
      .catch(() => void 0);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  function openEdit(entry: CalEntry) {
    setEditingEntry(entry);
    setEditForm({ label: entry.override_label ?? "", start_time: entry.start_time });
  }

  async function handleSaveOverride() {
    if (!editingEntry?.league_schedule_id) return;
    setSavingOverride(true);
    try {
      await upsertOverrideFn({
        data: {
          league_schedule_id: editingEntry.league_schedule_id,
          occurrence_date: editingEntry.date,
          start_time: editForm.start_time || null,
          label: editForm.label.trim() || null,
        },
      });
      toast.success("Ocurrencia actualizada.");
      setEditingEntry(null);
      reload();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSavingOverride(false);
    }
  }

  async function handleResetOverride() {
    if (!editingEntry?.league_schedule_id) return;
    setSavingOverride(true);
    try {
      await deleteOverrideFn({
        data: { league_schedule_id: editingEntry.league_schedule_id, occurrence_date: editingEntry.date },
      });
      toast.success("Restablecido al horario normal.");
      setEditingEntry(null);
      reload();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSavingOverride(false);
    }
  }

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
          Vista de los torneos programados en tu tienda. Los eventos de ligas internas (en ámbar) se pueden editar por fecha.
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
        <div className="w-44">
          <BlockSelect
            value={gameFilter === "all" ? null : gameFilter}
            onChange={(v) => setGameFilter(v ?? "all")}
            placeholder="Todos los TCGs"
            options={uniqueGames.map((g) => ({ value: g.id, label: g.name }))}
          />
        </div>
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
                      {cellEntries.map((e) => {
                        const isEditableLeague = Boolean(e.league_schedule_id);
                        return (
                          <div
                            key={e.id}
                            onClick={isEditableLeague ? () => openEdit(e) : undefined}
                            className={`w-full text-left rounded px-1.5 py-1 mb-0.5 border ${
                              e.league_id
                                ? "bg-amber-500/10 border-amber-500/30"
                                : "bg-primary/10 border-primary/30"
                            } ${isEditableLeague ? "cursor-pointer transition hover:brightness-125" : ""}`}
                          >
                            <div className={`text-[10px] truncate ${e.league_id ? "text-amber-300" : "text-primary"}`}>
                              {e.override_label || e.game_name}
                            </div>
                            <div className="text-[9px] text-gray-400 truncate">
                              {e.start_time}
                              {e.is_override && " · editado"}
                            </div>
                            {e.league_name && (
                              <div className="text-[9px] text-amber-400/80 truncate">{e.league_name}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editar una sola ocurrencia de un horario de liga interna */}
      <Dialog open={editingEntry !== null} onOpenChange={(o) => !o && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry?.league_name} — {editingEntry && DAY_NAMES[new Date(editingEntry.date + "T12:00:00").getDay()]}{" "}
              {editingEntry?.date}
            </DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                Este cambio aplica solo a esta fecha. El horario recurrente ({editingEntry.game_name}, todos los{" "}
                {DAY_NAMES[editingEntry.day_of_week]}) no se modifica.
              </p>
              <div className="space-y-2">
                <Label>Nombre especial (opcional)</Label>
                <Input
                  value={editForm.label}
                  placeholder={editingEntry.game_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            {editingEntry?.is_override ? (
              <button
                onClick={handleResetOverride}
                disabled={savingOverride}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 hover:text-red-200"
              >
                <Trash2 size={12} />
                Restablecer al horario normal
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditingEntry(null)} disabled={savingOverride}>
                Cancelar
              </Button>
              <Button onClick={handleSaveOverride} disabled={savingOverride} className="gap-2">
                {savingOverride ? <Loader2 className="animate-spin" size={16} /> : <Pencil size={16} />}
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Game = { id: string; name: string };
type Schedule = {
  id: string;
  store_id: string;
  game_id: string;
  day_of_week: number;
  start_time: string;
  is_active: boolean | null;
  games?: { id: string; name: string } | null;
};

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export type ScheduleFns = {
  fetch: (args: { data: { store_id: string } }) => Promise<{
    schedules: Schedule[];
    games: Game[];
  }>;
  upsert: (args: {
    data: {
      store_id: string;
      game_id: string;
      day_of_week: number;
      start_time: string;
      id?: string;
    };
  }) => Promise<{ success: boolean }>;
  remove: (args: { data: { schedule_id: string } }) => Promise<{ success: boolean }>;
};

export function StoreSchedulesDialog({
  store,
  onClose,
  fns,
}: {
  store: { id: string; name: string } | null;
  onClose: () => void;
  fns: ScheduleFns;
}) {
  const open = !!store;
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [form, setForm] = useState<{
    game_id: string;
    day_of_week: string;
    start_time: string;
  }>({ game_id: "", day_of_week: "", start_time: "" });
  const [saving, setSaving] = useState(false);

  const refresh = async (storeId: string) => {
    setLoading(true);
    try {
      const res = await fns.fetch({ data: { store_id: storeId } });
      setSchedules(res.schedules ?? []);
      setGames(res.games ?? []);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (store) {
      setForm({ game_id: "", day_of_week: "", start_time: "" });
      void refresh(store.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  const handleAdd = async () => {
    if (!store) return;
    if (!form.game_id || form.day_of_week === "" || !form.start_time) {
      toast.error("Completa todos los campos");
      return;
    }
    setSaving(true);
    try {
      await fns.upsert({
        data: {
          store_id: store.id,
          game_id: form.game_id,
          day_of_week: Number(form.day_of_week),
          start_time: form.start_time,
        },
      });
      toast.success("Horario agregado");
      setForm({ game_id: "", day_of_week: "", start_time: "" });
      await refresh(store.id);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!store) return;
    try {
      await fns.remove({ data: { schedule_id: id } });
      toast.success("Horario eliminado");
      await refresh(store.id);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  // Group by game
  const grouped = schedules.reduce<Record<string, Schedule[]>>((acc, s) => {
    (acc[s.game_id] ||= []).push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar Torneos — {store?.name}</DialogTitle>
          <DialogDescription>
            Define los días y horarios en los que esta tienda celebra torneos por TCG.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Add form */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Nuevo horario
              </h4>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs text-gray-400">TCG</Label>
                  <Select
                    value={form.game_id}
                    onValueChange={(v) => setForm({ ...form, game_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona TCG" />
                    </SelectTrigger>
                    <SelectContent>
                      {games.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Día</Label>
                  <Select
                    value={form.day_of_week}
                    onValueChange={(v) => setForm({ ...form, day_of_week: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Día" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Hora</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={handleAdd} disabled={saving}>
                  {saving ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <Plus size={14} className="mr-1" />
                  )}
                  Agregar
                </Button>
              </div>
            </div>

            {/* Existing schedules grouped by game */}
            <div className="space-y-4">
              {Object.keys(grouped).length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-gray-400">
                  No hay horarios configurados.
                </div>
              ) : (
                Object.entries(grouped).map(([gameId, items]) => {
                  const gameName =
                    items[0]?.games?.name ??
                    games.find((g) => g.id === gameId)?.name ??
                    "TCG";
                  const sorted = [...items].sort(
                    (a, b) => a.day_of_week - b.day_of_week,
                  );
                  return (
                    <div
                      key={gameId}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                    >
                      <h5 className="mb-2 text-sm font-semibold text-white">
                        {gameName}
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {sorted.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-1 text-xs text-gray-200"
                          >
                            {DAYS[s.day_of_week]} —{" "}
                            {String(s.start_time).slice(0, 5)}
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-red-300 transition hover:bg-red-500/20"
                              aria-label="Eliminar"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

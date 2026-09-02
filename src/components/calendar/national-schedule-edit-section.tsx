import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { upsertScheduleOverride, deleteScheduleOverride } from "@/lib/nexus-manager.functions";

type EditableEntry = {
  national_schedule_id: string;
  date: string;
  game_name: string;
  start_time: string;
  override_label?: string | null;
  is_override?: boolean;
};

// Edición de UNA ocurrencia del schedule nacional (Circuito Nacional) — para
// admin/tcg_manager, embebida dentro del modal de detalle que ya existe en
// /admin/calendar y /tcg-manager/calendar. No toca la regla recurrente en
// store_schedules; solo agrega/borra una excepción para esta fecha.
export function NationalScheduleEditSection({
  entry,
  onSaved,
}: {
  entry: EditableEntry;
  onSaved: () => void;
}) {
  const upsertFn = useServerFn(upsertScheduleOverride);
  const deleteFn = useServerFn(deleteScheduleOverride);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(entry.override_label ?? "");
  const [startTime, setStartTime] = useState(entry.start_time);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertFn({
        data: {
          national_schedule_id: entry.national_schedule_id,
          occurrence_date: entry.date,
          start_time: startTime || null,
          label: label.trim() || null,
        },
      });
      toast.success("Ocurrencia actualizada.");
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await deleteFn({
        data: { national_schedule_id: entry.national_schedule_id, occurrence_date: entry.date },
      });
      toast.success("Restablecido al horario normal.");
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3">
        <div className="text-xs text-gray-400">
          Editar solo esta fecha del Circuito Nacional (la regla recurrente no cambia).
        </div>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
        >
          <Pencil size={12} />
          Editar esta fecha
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-black/30 p-3">
      <div className="space-y-2">
        <label className="text-[10px] uppercase text-gray-500">Nombre especial (opcional)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={entry.game_name}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-primary"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] uppercase text-gray-500">Hora</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-primary"
        />
      </div>
      <div className="flex items-center justify-between pt-1">
        {entry.is_override ? (
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 hover:text-red-200"
          >
            <Trash2 size={12} />
            Restablecer
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

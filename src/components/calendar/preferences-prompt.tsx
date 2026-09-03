import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { setPlayerPreferences } from "@/lib/nexus-player.functions";
import type { TCG } from "@/context/tcg.context";

// Inline, descartable — nunca un modal bloqueante (ver spec: forzar el paso
// en el primer login castiga el abandono). Se pregunta una sola vez por
// cuenta (preferences_prompted_at), no por dispositivo.
export function CalendarPreferencesPrompt({
  tcgs,
  zones,
  onSave,
}: {
  tcgs: TCG[];
  zones: string[];
  onSave: (gameId: string | null, zone: string | null) => void;
}) {
  const { player, updatePlayer } = useNexusRole();
  const savePrefsFn = useServerFn(setPlayerPreferences);
  const [gameId, setGameId] = useState<string>("");
  const [zone, setZone] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [dismissedLocally, setDismissedLocally] = useState(false);

  if (!player || player.preferences_prompted_at || dismissedLocally) return null;

  async function persist(g: string | null, z: string | null) {
    setSaving(true);
    try {
      await savePrefsFn({ data: { game_id: g, zone: z } });
      updatePlayer({ preferred_game_id: g, preferred_zone: z, preferences_prompted_at: new Date().toISOString() });
      if (g || z) onSave(g, z);
    } catch {
      // Silencioso: no vale la pena bloquear el calendario por esto.
      setDismissedLocally(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-semibold text-white">¿Qué buscas?</p>
      <p className="mt-0.5 text-xs text-gray-400">
        Elige tu TCG y zona favoritos para ver justo lo que te interesa.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-white outline-none focus:border-primary sm:flex-1"
        >
          <option value="">TCG</option>
          {tcgs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-white outline-none focus:border-primary sm:flex-1"
        >
          <option value="">Zona</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3 sm:flex-shrink-0">
          <button
            onClick={() => persist(gameId || null, zone || null)}
            disabled={saving || (!gameId && !zone)}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40 sm:flex-none"
          >
            Guardar
          </button>
          <button
            onClick={() => persist(null, null)}
            disabled={saving}
            className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
          >
            <X size={12} /> Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}

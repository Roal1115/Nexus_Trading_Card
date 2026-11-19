import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getStoreTcgs, getTcgCatalog, setStoreTcgs } from "@/lib/nexus-store-tcgs.functions";

/** "Juegos que se juegan aquí": guarda con su propio botón. Organizador, Admin y Manager. */
export function StoreTcgsField({ storeId }: { storeId: string }) {
  const fetchCatalog = useServerFn(getTcgCatalog);
  const fetchStoreTcgs = useServerFn(getStoreTcgs);
  const save = useServerFn(setStoreTcgs);
  const [catalog, setCatalog] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchCatalog(), fetchStoreTcgs({ data: { store_id: storeId } })])
      .then(([c, s]) => {
        setCatalog(c);
        setSelected(s.tcg_ids);
      })
      .catch(() => toast.error("No se pudieron cargar los juegos"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));

  const submit = async () => {
    setSaving(true);
    try {
      await save({ data: { store_id: storeId, tcg_ids: selected } });
      toast.success("Juegos actualizados");
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  if (!catalog) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
          Juegos que se juegan aquí
        </h3>
        {catalog.length > 0 && (
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </Button>
        )}
      </div>
      {catalog.length === 0 ? (
        <p className="text-sm text-gray-400">El catálogo de juegos aún no está disponible.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm text-white">
              <Checkbox
                checked={selected.includes(t.id)}
                onCheckedChange={(v) => toggle(t.id, v === true)}
              />
              {t.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

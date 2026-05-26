import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Store, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  getOrganizerOverview,
  updateHomeStore,
  updateStoreInfo,
} from "@/lib/geekarena-organizer.functions";
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

export const Route = createFileRoute("/organizer/")({
  component: OrganizerHome,
});

type StoreRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

function OrganizerHome() {
  const { player, loading: roleLoading } = useGeekarenaRole();
  const email = player?.email ?? null;

  const fetchOverview = useServerFn(getOrganizerOverview);
  const saveHomeStore = useServerFn(updateHomeStore);
  const saveStoreInfo = useServerFn(updateStoreInfo);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [homeStore, setHomeStore] = useState<StoreRow | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [form, setForm] = useState({ name: "", city: "", state: "" });

  const refresh = async (em: string) => {
    setLoading(true);
    try {
      const res = await fetchOverview();
      setStores(res.stores);
      setHomeStore(res.homeStore);
      setSelectedStoreId(res.player.home_store_id ?? "");
      if (res.homeStore) {
        setForm({
          name: res.homeStore.name ?? "",
          city: res.homeStore.city ?? "",
          state: res.homeStore.state ?? "",
        });
      }
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!email) return;
    refresh(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleAssignStore = async () => {
    if (!email || !selectedStoreId) return;
    setSaving(true);
    try {
      await saveHomeStore({ data: { store_id: selectedStoreId } });
      toast.success("Tienda asignada");
      await refresh(email);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!email || !homeStore) return;
    setSaving(true);
    try {
      await saveStoreInfo({
        data: { store_id: homeStore.id,
          name: form.name,
          city: form.city,
          state: form.state,
        },
      });
      toast.success("Datos de la tienda actualizados");
      await refresh(email);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const storeOptions = useMemo(() => stores, [stores]);

  if (roleLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Mi Tienda
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Información de tu tienda
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Selecciona o edita la tienda que organizas.
        </p>
      </header>

      <section className="glass space-y-4 rounded-2xl p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Store size={16} className="text-primary" />
          Tienda asignada
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">
              Elige una tienda existente
            </Label>
            <Select
              value={selectedStoreId}
              onValueChange={setSelectedStoreId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una tienda" />
              </SelectTrigger>
              <SelectContent>
                {storeOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.city ? ` — ${s.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAssignStore}
            disabled={
              !selectedStoreId ||
              saving ||
              selectedStoreId === homeStore?.id
            }
          >
            {saving ? "Guardando..." : "Asignar"}
          </Button>
        </div>
      </section>

      {homeStore ? (
        <section className="glass space-y-4 rounded-2xl p-6">
          <div className="text-sm font-semibold text-white">
            Datos de tu tienda
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs text-gray-400">Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Ciudad</Label>
              <Input
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Estado</Label>
              <Input
                value={form.state}
                onChange={(e) =>
                  setForm((f) => ({ ...f, state: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveInfo} disabled={saving}>
              <Save size={14} className="mr-1" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="glass rounded-2xl p-6 text-sm text-gray-400">
          Aún no tienes una tienda asignada. Selecciona una arriba para
          empezar a subir torneos.
        </section>
      )}
    </div>
  );
}

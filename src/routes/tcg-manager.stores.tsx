import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Search,
  Store as StoreIcon,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  listManagerStores,
  getStoreSchedulesForManager,
  upsertStoreScheduleManager,
  deleteStoreScheduleManager,
} from "@/lib/geekarena-manager.functions";
import { StoreSchedulesDialog } from "@/components/admin/StoreSchedulesDialog";

export const Route = createFileRoute("/tcg-manager/stores")({
  head: () => ({ meta: [{ title: "Tiendas — TCG Manager" }] }),
  component: ManagerStoresPage,
});

type Store = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean | null;
};

function ManagerStoresPage() {
  const fetchStores = useServerFn(listManagerStores);
  const fetchSchedulesFn = useServerFn(getStoreSchedulesForManager);
  const upsertScheduleFn = useServerFn(upsertStoreScheduleManager);
  const deleteScheduleFn = useServerFn(deleteStoreScheduleManager);

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");
  const [schedStore, setSchedStore] = useState<Store | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetchStores();
      setStores((res.stores ?? []) as Store[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (!s.is_active) return false;
      if (!search) return true;
      const hay = `${s.name} ${s.city ?? ""} ${s.state ?? ""}`.toLowerCase();
      return hay.includes(search);
    });
  }, [stores, search]);

  if (loading) {
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
          Red
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Tiendas</h1>
        <p className="mt-1 text-sm text-gray-400">
          Configura los días y horarios de torneos de tus TCGs en cada tienda.
        </p>
      </header>

      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <Input
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Buscar por nombre, ciudad o estado..."
            className="pl-9"
          />
        </div>
      </div>

      <section className="glass overflow-hidden rounded-2xl">
        {filtered.length === 0 ? (
          <div className="p-8 text-sm text-gray-400">
            No hay tiendas que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3">Tienda</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <StoreIcon size={14} className="text-gray-500" />
                        {s.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{s.city ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{s.state ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSchedStore(s)}
                      >
                        <CalendarDays size={13} className="mr-1.5" />
                        Configurar Torneos
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StoreSchedulesDialog
        store={schedStore ? { id: schedStore.id, name: schedStore.name } : null}
        onClose={() => setSchedStore(null)}
        fns={{
          fetch: fetchSchedulesFn as any,
          upsert: upsertScheduleFn as any,
          remove: deleteScheduleFn as any,
        }}
      />
    </div>
  );
}

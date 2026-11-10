import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Map as MapIcon, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { StoreCardSkeleton } from "@/components/ui/skeleton-loader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { TablePager } from "@/components/ui/table-pager";
import { openRowProps } from "@/components/ui/detail-dialog";
import { StoreDetailDialog } from "@/components/stores/StoreDetailDialog";
import { usePagination } from "@/hooks/use-pagination";
import {
  getManagerResponsibleStores,
  getStoreSchedulesForManager,
  upsertStoreScheduleManager,
  deleteStoreScheduleManager,
} from "@/lib/nexus-manager.functions";
import { StoreSchedulesDialog } from "@/components/admin/StoreSchedulesDialog";
import { StoreEditDialog } from "@/components/stores/StoreEditDialog";
import { updateStoreData } from "@/lib/nexus-manager.functions";
import { safeHref } from "@/lib/utils";

export const Route = createFileRoute("/tcg-manager/stores")({
  head: () => ({ meta: [{ title: "Tiendas a mi cargo — TCG Manager" }] }),
  component: ManagerStoresPage,
});

type Store = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country?: string | null;
  is_active: boolean | null;
  address?: string | null;
  phone?: string | null;
  google_maps_url?: string | null;
  description?: string | null;
  opening_hours?: string | null;
  instagram?: string | null;
  website?: string | null;
  twitter?: string | null;
  twitch?: string | null;
  zone?: string | null;
  subzone?: string | null;
  available_game_ids: string[];
};

type Game = { id: string; name: string };

const zoneLabel = (s: Store) => (s.zone ? `${s.zone}${s.subzone ? ` · ${s.subzone}` : ""}` : "—");

function StoreActions({
  store,
  onEdit,
  onSchedules,
}: {
  store: Store;
  onEdit: () => void;
  onSchedules: () => void;
}) {
  const mapsUrl = safeHref(store.google_maps_url);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          aria-label={`Opciones de ${store.name}`}
        >
          <MoreHorizontal size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil size={14} /> Editar datos
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSchedules}>
          <CalendarDays size={14} /> Torneos
        </DropdownMenuItem>
        {mapsUrl && (
          <DropdownMenuItem asChild>
            <a href={mapsUrl} target="_blank" rel="noreferrer">
              <MapIcon size={14} /> Ver mapa
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ManagerStoresPage() {
  const fetchStores = useServerFn(getManagerResponsibleStores);
  const fetchSchedulesFn = useServerFn(getStoreSchedulesForManager);
  const upsertScheduleFn = useServerFn(upsertStoreScheduleManager);
  const deleteScheduleFn = useServerFn(deleteStoreScheduleManager);
  const saveStore = useServerFn(updateStoreData);

  const [stores, setStores] = useState<Store[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");
  const [schedStore, setSchedStore] = useState<Store | null>(null);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [viewStore, setViewStore] = useState<Store | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res: any = await fetchStores();
      setStores((res.stores ?? []) as Store[]);
      setGames((res.games ?? []) as Game[]);
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

  const filtered = useMemo(
    () =>
      stores.filter(
        (s) =>
          !search || `${s.name} ${s.city ?? ""} ${s.state ?? ""}`.toLowerCase().includes(search),
      ),
    [stores, search],
  );
  const pager = usePagination(filtered);

  const gameChips = (s: Store) => (
    <div className="flex flex-wrap gap-1">
      {s.available_game_ids.map((gid) => (
        <span
          key={gid}
          className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary"
        >
          {games.find((g) => g.id === gid)?.name ?? "—"}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Red"
        title="Tiendas a mi cargo"
        description="Tiendas donde se juegan los TCGs que moderas. Cada tienda la administra su organizador; aquí mantienes al día sus datos de contacto y los horarios de tus TCGs."
      />

      <section className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <SearchInput
          value={searchRaw}
          onChange={setSearchRaw}
          placeholder="Buscar tienda, ciudad o estado"
        />
      </section>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <StoreCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <section className="glass overflow-hidden rounded-2xl">
            {filtered.length === 0 ? (
              <EmptyState
                title={search ? "No hay tiendas que coincidan" : "Aún no tienes tiendas a tu cargo"}
                description={
                  search
                    ? "Prueba con otro nombre o ciudad."
                    : "Aparecerán aquí cuando una tienda juegue alguno de tus TCGs."
                }
              />
            ) : (
              <>
                {/* Escritorio */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                      <tr>
                        <th scope="col" className="px-4 py-3">
                          Tienda
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Ciudad
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Zona
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Tus TCGs
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Teléfono
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pager.pageItems.map((s) => (
                        <tr
                          key={s.id}
                          {...openRowProps(() => setViewStore(s))}
                          className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{s.name}</div>
                            {s.address && <div className="text-xs text-gray-500">{s.address}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{zoneLabel(s)}</td>
                          <td className="px-4 py-3">{gameChips(s)}</td>
                          <td className="px-4 py-3 text-gray-300">{s.phone || "—"}</td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <StoreActions
                              store={s}
                              onEdit={() => setEditStore(s)}
                              onSchedules={() => setSchedStore(s)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Celular */}
                <div className="space-y-3 p-3 md:hidden">
                  {pager.pageItems.map((s) => (
                    <div
                      key={s.id}
                      {...openRowProps(() => setViewStore(s))}
                      className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.02] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-white">{s.name}</div>
                          <div className="text-xs text-gray-400">
                            {[s.city, s.state].filter(Boolean).join(", ") || "—"} · {zoneLabel(s)}
                          </div>
                          {s.phone && <div className="text-xs text-gray-400">{s.phone}</div>}
                        </div>
                        <span onClick={(e) => e.stopPropagation()}>
                          <StoreActions
                            store={s}
                            onEdit={() => setEditStore(s)}
                            onSchedules={() => setSchedStore(s)}
                          />
                        </span>
                      </div>
                      <div className="mt-2">{gameChips(s)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <TablePager
            page={pager.page}
            totalPages={pager.totalPages}
            onPageChange={pager.setPage}
            total={pager.total}
            pageSize={pager.pageSize}
          />
        </>
      )}

      <StoreDetailDialog
        store={viewStore}
        onClose={() => setViewStore(null)}
        extra={
          viewStore ? [{ label: "Tus TCGs aquí", value: gameChips(viewStore), wide: true }] : []
        }
      />

      <StoreSchedulesDialog
        store={schedStore ? { id: schedStore.id, name: schedStore.name } : null}
        onClose={() => setSchedStore(null)}
        fns={{
          fetch: fetchSchedulesFn as any,
          upsert: upsertScheduleFn as any,
          remove: deleteScheduleFn as any,
        }}
      />

      <StoreEditDialog
        store={editStore}
        onClose={() => setEditStore(null)}
        onSubmit={async (payload) => {
          try {
            await saveStore({ data: payload });
            toast.success("Tienda actualizada correctamente");
            setEditStore(null);
            await refresh();
          } catch (e) {
            toast.error(String((e as Error).message ?? e));
          }
        }}
      />
    </div>
  );
}

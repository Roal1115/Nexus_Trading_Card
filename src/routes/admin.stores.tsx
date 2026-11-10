import { createFileRoute } from "@tanstack/react-router";
import { usePagination } from "@/hooks/use-pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TablePager } from "@/components/ui/table-pager";
import { openRowProps } from "@/components/ui/detail-dialog";
import { StoreDetailDialog } from "@/components/stores/StoreDetailDialog";
import { StoreEditDialog } from "@/components/stores/StoreEditDialog";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Search,
  Store as StoreIcon,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  MoreHorizontal,
  Pencil,
  UserPlus,
  Power,
  PowerOff,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  SkeletonLine,
  SkeletonBlock,
  TournamentRowSkeleton,
} from "@/components/ui/skeleton-loader";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  listStoresWithOrganizers,
  createStore,
  setStoreActive,
  updateStore,
  assignOrganizerToStore,
  listStaffMembers,
  upsertStaffMember,
  getManagerAssignedGames,
  deactivateStaffMember,
  updateStaffOperationalFields,
  getStoreSchedules,
  upsertStoreSchedule,
  deleteStoreSchedule,
} from "@/lib/nexus-admin.functions";
import { assignManagerGames } from "@/lib/nexus-manager.functions";
import { StoreSchedulesDialog } from "@/components/admin/StoreSchedulesDialog";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { LocationSelects, OpeningHoursField } from "@/components/stores/StoreFormFields";
import { listZones } from "@/lib/nexus-zones.functions";

export const Route = createFileRoute("/admin/stores")({
  head: () => ({ meta: [{ title: "Tiendas — Nexus" }] }),
  component: AdminStoresPage,
});

type Store = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean | null;
  address: string | null;
  phone: string | null;
  google_maps_url: string | null;
  description: string | null;
  opening_hours: string | null;
  instagram: string | null;
  website: string | null;
  twitter: string | null;
  twitch: string | null;
  zone: string | null;
  subzone: string | null;
};
type Organizer = {
  id: string;
  geek_tag: string;
  email: string | null;
  role: string;
  home_store_id: string | null;
};

function AdminStoresPage() {
  const { player } = useNexusRole();
  const email = player?.email ?? null;
  const fetchAll = useServerFn(listStoresWithOrganizers);
  const create = useServerFn(createStore);
  const toggleActive = useServerFn(setStoreActive);
  const updateStoreFn = useServerFn(updateStore);
  const assignFn = useServerFn(assignOrganizerToStore);

  const [stores, setStores] = useState<Store[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    city: "",
    state: "",
    address: "",
    phone: "",
    zone: "",
  });
  const fetchZones = useServerFn(listZones);
  const [zones, setZones] = useState<string[]>([]);
  const [subzones, setSubzones] = useState<Record<string, string[]>>({});
  useEffect(() => {
    fetchZones()
      .then((res) => {
        setZones(res.zones.map((z) => z.name));
        setSubzones(
          Object.fromEntries(res.zones.map((z) => [z.name, z.subzones.map((s) => s.name)])),
        );
      })
      .catch(() => toast.error("No se pudieron cargar las zonas"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search & filters
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [orgFilter, setOrgFilter] = useState<"all" | "with" | "without">("all");
  const [zoneFilter, setZoneFilter] = useState("all");

  // Action modals
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [viewStore, setViewStore] = useState<Store | null>(null);
  const [assignStore, setAssignStore] = useState<Store | null>(null);
  const [toggleStore, setToggleStore] = useState<Store | null>(null);
  const [schedStore, setSchedStore] = useState<Store | null>(null);

  const fetchSchedulesFn = useServerFn(getStoreSchedules);
  const upsertScheduleFn = useServerFn(upsertStoreSchedule);
  const deleteScheduleFn = useServerFn(deleteStoreSchedule);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetchAll();
      setStores(res.stores as Store[]);
      setOrganizers(res.organizers as Organizer[]);
    } catch {
      toast.error("Error al cargar las tiendas. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!email) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const orgsByStore = useMemo(
    () =>
      organizers.reduce<Record<string, Organizer[]>>((acc, o) => {
        if (!o.home_store_id) return acc;
        (acc[o.home_store_id] ||= []).push(o);
        return acc;
      }, {}),
    [organizers],
  );

  const unassignedOrganizers = useMemo(
    () => organizers.filter((o) => o.role === "organizer" && !o.home_store_id),
    [organizers],
  );

  const stats = useMemo(() => {
    const total = stores.length;
    const active = stores.filter((s) => s.is_active).length;
    const withoutOrg = stores.filter((s) => (orgsByStore[s.id] ?? []).length === 0).length;
    const cities = new Set(stores.map((s) => s.city).filter(Boolean)).size;
    return { total, active, withoutOrg, cities };
  }, [stores, orgsByStore]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (statusFilter === "active" && !s.is_active) return false;
      if (statusFilter === "inactive" && s.is_active) return false;
      if (zoneFilter !== "all" && s.zone !== zoneFilter) return false;
      const hasOrg = (orgsByStore[s.id] ?? []).length > 0;
      if (orgFilter === "with" && !hasOrg) return false;
      if (orgFilter === "without" && hasOrg) return false;
      if (search) {
        const hay = `${s.name} ${s.city ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [stores, statusFilter, orgFilter, zoneFilter, search, orgsByStore]);
  const pager = usePagination(filtered);

  const submitCreate = async () => {
    if (!createForm.name) return toast.error("El nombre es obligatorio");
    if (!createForm.zone) return toast.error("La zona es obligatoria");
    try {
      await create({
        data: {
          name: createForm.name,
          zone: createForm.zone,
          city: createForm.city,
          state: createForm.state,
          address: createForm.address || undefined,
          phone: createForm.phone || undefined,
        },
      });
      toast.success("Tienda creada");
      setCreateOpen(false);
      setCreateForm({ name: "", city: "", state: "", address: "", phone: "", zone: "" });

      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  const handleToggleConfirm = async () => {
    if (!toggleStore) return;
    const next = !toggleStore.is_active;
    try {
      await toggleActive({ data: { store_id: toggleStore.id, is_active: next } });
      setStores((prev) =>
        prev.map((it) => (it.id === toggleStore.id ? { ...it, is_active: next } : it)),
      );
      toast.success(next ? "Tienda activada" : "Tienda desactivada");
      setToggleStore(null);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <SkeletonLine width="w-24" height="h-3" />
          <SkeletonLine width="w-64" height="h-8" />
        </div>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-20 rounded-2xl" />
          ))}
        </section>
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TournamentRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Red</p>
        <h1 className="text-3xl font-bold text-white">Tiendas</h1>
        <p className="text-sm text-gray-400">
          Las tiendas del circuito: sus datos, su organizador y sus torneos.
        </p>
      </header>
      {/* Stats */}
      <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <StatCard icon={<StoreIcon size={16} />} label="Total tiendas" value={stats.total} />
        <StatCard icon={<CheckCircle2 size={16} />} label="Activas" value={stats.active} />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="Sin organizador"
          value={stats.withoutOrg}
        />
        <StatCard icon={<MapPin size={16} />} label="Ciudades" value={stats.cities} />
      </section>
      {/* Filters bar */}
      <section className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <SearchInput
          value={searchRaw}
          onChange={setSearchRaw}
          placeholder="Buscar tienda o ciudad"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={orgFilter} onValueChange={(v) => setOrgFilter(v as typeof orgFilter)}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Organizador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="with">Con organizador</SelectItem>
            <SelectItem value="without">Sin organizador</SelectItem>
          </SelectContent>
        </Select>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar por zona">
            <SelectValue placeholder="Zona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las zonas</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus size={14} className="mr-1" /> Nueva tienda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear tienda</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Nombre</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LocationSelects
                  state={createForm.state}
                  city={createForm.city}
                  onChange={(next) => setCreateForm({ ...createForm, ...next })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Zona</Label>
                <select
                  aria-label="Zona"
                  value={createForm.zone}
                  onChange={(e) => setCreateForm({ ...createForm, zone: e.target.value })}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  <option value="">Elige la zona</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Dirección</Label>
                <Input
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="Calle, número, colonia"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Teléfono</Label>
                <Input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="+52..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submitCreate}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
      {/* Table (desktop) / Cards (mobile) */}
      <section className="glass overflow-hidden rounded-2xl">
        {filtered.length === 0 ? (
          <div className="p-8 text-sm text-gray-400">
            No hay tiendas que coincidan con los filtros.
          </div>
        ) : (
          <>
            {/* Desktop table */}
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
                      Organizador
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Activa
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((s) => {
                    const orgs = orgsByStore[s.id] ?? [];
                    return (
                      <tr
                        key={s.id}
                        {...openRowProps(() => setViewStore(s))}
                        className="cursor-pointer border-t border-white/5 transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{s.name}</div>
                          {s.address && <div className="text-xs text-gray-500">{s.address}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {s.zone ? `${s.zone}${s.subzone ? ` · ${s.subzone}` : ""}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {orgs.length === 0 ? (
                            <div className="flex items-center gap-2">
                              <Badge className="border-orange-400/40 bg-orange-500/20 text-orange-200">
                                Sin asignar
                              </Badge>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignStore(s);
                                }}
                                className="text-xs font-semibold text-primary hover:underline"
                              >
                                + Asignar
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {orgs.map((o) => (
                                <span
                                  key={o.id}
                                  className="flex items-center gap-1.5 text-sm text-gray-200"
                                >
                                  {o.geek_tag}
                                  <Badge variant="secondary" className="text-[10px] uppercase">
                                    {o.role}
                                  </Badge>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            aria-label={`Activar ${s.name}`}
                            checked={!!s.is_active}
                            onCheckedChange={() => setToggleStore(s)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <RowActions
                            store={s}
                            onEdit={() => setEditStore(s)}
                            onAssign={() => setAssignStore(s)}
                            onToggle={() => setToggleStore(s)}
                            onSchedules={() => setSchedStore(s)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 p-3 md:hidden">
              {pager.pageItems.map((s) => {
                const orgs = orgsByStore[s.id] ?? [];
                return (
                  <div
                    key={s.id}
                    {...openRowProps(() => setViewStore(s))}
                    className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-white">{s.name}</div>
                        {s.address && <div className="text-xs text-gray-500">{s.address}</div>}
                        <div className="mt-1 text-xs text-gray-400">
                          {[s.city, s.state].filter(Boolean).join(", ") || "Sin ubicación"}
                        </div>
                      </div>
                      <RowActions
                        store={s}
                        onEdit={() => setEditStore(s)}
                        onAssign={() => setAssignStore(s)}
                        onToggle={() => setToggleStore(s)}
                        onSchedules={() => setSchedStore(s)}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                      <div className="text-xs text-gray-400">
                        {orgs.length === 0 ? (
                          <Badge className="border-orange-400/40 bg-orange-500/20 text-orange-200">
                            Sin organizador
                          </Badge>
                        ) : (
                          orgs.map((o) => o.geek_tag).join(", ")
                        )}
                      </div>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Switch
                          aria-label={`Activar ${s.name}`}
                          checked={!!s.is_active}
                          onCheckedChange={() => setToggleStore(s)}
                        />
                      </span>
                    </div>
                  </div>
                );
              })}
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
      <StoreDetailDialog
        store={viewStore}
        onClose={() => setViewStore(null)}
        extra={[
          {
            label: "Organizador",
            value: viewStore
              ? (orgsByStore[viewStore.id] ?? []).map((o) => o.geek_tag).join(", ") || "Sin asignar"
              : null,
          },
        ]}
      />
      {/* Edit modal */}
      <StoreEditDialog
        showCountry
        store={editStore}
        onClose={() => setEditStore(null)}
        onSubmit={async (payload) => {
          try {
            await updateStoreFn({ data: payload });
            toast.success("Tienda actualizada correctamente");
            setEditStore(null);
            await refresh();
          } catch (e) {
            toast.error(String((e as Error).message ?? e));
          }
        }}
      />
      {/* Assign organizer modal */}
      <AssignOrganizerDialog
        store={assignStore}
        currentOrganizers={assignStore ? (orgsByStore[assignStore.id] ?? []) : []}
        candidates={unassignedOrganizers}
        onClose={() => setAssignStore(null)}
        onSubmit={async (player_id) => {
          if (!assignStore) return;
          try {
            await assignFn({ data: { store_id: assignStore.id, player_id } });
            toast.success("Organizador asignado correctamente");
            setAssignStore(null);
            await refresh();
          } catch (e) {
            toast.error(String((e as Error).message ?? e));
          }
        }}
      />
      {/* Toggle active confirmation */}
      <Dialog open={!!toggleStore} onOpenChange={(o) => !o && setToggleStore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleStore?.is_active ? "Desactivar tienda" : "Activar tienda"}
            </DialogTitle>
            <DialogDescription>
              {toggleStore?.is_active
                ? `¿Desactivar ${toggleStore?.name}? Los torneos existentes no se verán afectados.`
                : `¿Activar ${toggleStore?.name}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToggleStore(null)}>
              Cancelar
            </Button>
            <Button onClick={handleToggleConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Store schedules modal */}
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass flex items-center justify-between gap-2 rounded-xl px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2 text-xs text-gray-400">
        {icon} <span className="leading-tight">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function RowActions({
  store,
  onEdit,
  onAssign,
  onToggle,
  onSchedules,
}: {
  store: Store;
  onEdit: () => void;
  onAssign: () => void;
  onToggle: () => void;
  onSchedules: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-gray-300 transition hover:bg-white/5"
          aria-label="Acciones"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil size={14} className="mr-2" /> Editar tienda
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAssign}>
          <UserPlus size={14} className="mr-2" /> Asignar organizador
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSchedules}>
          <CalendarDays size={14} className="mr-2" /> Configurar Torneos
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggle}>
          {store.is_active ? (
            <>
              <PowerOff size={14} className="mr-2 text-red-400" />
              <span className="text-red-300">Desactivar</span>
            </>
          ) : (
            <>
              <Power size={14} className="mr-2 text-emerald-400" />
              <span className="text-emerald-300">Activar</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssignOrganizerDialog({
  store,
  currentOrganizers,
  candidates,
  onClose,
  onSubmit,
}: {
  store: Store | null;
  currentOrganizers: Organizer[];
  candidates: Organizer[];
  onClose: () => void;
  onSubmit: (player_id: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected("");
  }, [store]);

  const submit = async () => {
    if (!selected) return toast.error("Selecciona un organizador");
    setSaving(true);
    try {
      await onSubmit(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!store} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar organizador</DialogTitle>
          <DialogDescription>
            {store ? `Asignar organizador a ${store.name}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {currentOrganizers.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <div className="text-xs uppercase tracking-wider text-gray-500">
                Organizador actual
              </div>
              <div className="mt-1 text-gray-200">
                {currentOrganizers.map((o) => o.geek_tag).join(", ")}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Al asignar uno nuevo, el actual será removido de esta tienda.
              </div>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Organizador disponible</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un organizador..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-gray-400">
                    No hay organizadores sin tienda asignada.
                  </div>
                ) : (
                  candidates.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.geek_tag}
                      {o.email ? ` · ${o.email}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !selected}>
            {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

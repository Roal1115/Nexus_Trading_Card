import { createFileRoute } from "@tanstack/react-router";
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
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
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
} from "@/lib/geekarena-admin.functions";
import { assignManagerGames } from "@/lib/geekarena-manager.functions";
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

export const Route = createFileRoute("/admin/stores")({
  head: () => ({ meta: [{ title: "Tiendas y Staff — Geek Arena" }] }),
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
};
type Organizer = {
  id: string;
  geek_tag: string;
  email: string | null;
  role: string;
  home_store_id: string | null;
};


function AdminStoresPage() {
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;
  const [activeTab, setActiveTab] = useState<"stores" | "staff">("stores");
  const fetchAll = useServerFn(listStoresWithOrganizers);
  const create = useServerFn(createStore);
  const toggleActive = useServerFn(setStoreActive);
  const updateStoreFn = useServerFn(updateStore);
  const assignFn = useServerFn(assignOrganizerToStore);

  const [stores, setStores] = useState<Store[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", city: "", state: "", address: "", phone: "" });


  // Search & filters
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [orgFilter, setOrgFilter] = useState<"all" | "with" | "without">("all");

  // Action modals
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [assignStore, setAssignStore] = useState<Store | null>(null);
  const [toggleStore, setToggleStore] = useState<Store | null>(null);

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
      const hasOrg = (orgsByStore[s.id] ?? []).length > 0;
      if (orgFilter === "with" && !hasOrg) return false;
      if (orgFilter === "without" && hasOrg) return false;
      if (search) {
        const hay = `${s.name} ${s.city ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [stores, statusFilter, orgFilter, search, orgsByStore]);

  const submitCreate = async () => {
    if (!createForm.name) return toast.error("El nombre es obligatorio");
    try {
      await create({ data: { name: createForm.name, city: createForm.city, state: createForm.state, address: createForm.address || undefined, phone: createForm.phone || undefined } });
      toast.success("Tienda creada");
      setCreateOpen(false);
      setCreateForm({ name: "", city: "", state: "", address: "", phone: "" });

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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Red
        </p>
        <h1 className="text-3xl font-bold text-white">Tiendas y Staff</h1>
        <p className="text-sm text-gray-400">
          Administra las tiendas del circuito y el staff asignado.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("stores")}
          className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === "stores"
              ? "border-primary text-white"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Tiendas
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === "staff"
              ? "border-primary text-white"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Staff
        </button>
      </div>

      {activeTab === "staff" && <StaffTab />}

      {activeTab === "stores" && (<>


      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<StoreIcon size={16} />} label="Total tiendas" value={stats.total} />
        <StatCard icon={<CheckCircle2 size={16} />} label="Activas" value={stats.active} />
        <StatCard icon={<AlertTriangle size={16} />} label="Sin organizador" value={stats.withoutOrg} />
        <StatCard icon={<MapPin size={16} />} label="Ciudades" value={stats.cities} />
      </section>

      {/* Filters bar */}
      <section className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Buscar por nombre o ciudad..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
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
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Ciudad</Label>
                  <Input
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Estado</Label>
                  <Input
                    value={createForm.state}
                    onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                  />
                </div>
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
                    <th className="px-4 py-3">Tienda</th>
                    <th className="px-4 py-3">Ciudad</th>
                    <th className="px-4 py-3">Estado (MX)</th>
                    <th className="px-4 py-3">Organizador</th>
                    <th className="px-4 py-3">Activa</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const orgs = orgsByStore[s.id] ?? [];
                    return (
                      <tr key={s.id} className="cursor-pointer border-t border-white/5 transition hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{s.name}</div>
                          {s.address && <div className="text-xs text-gray-500">{s.address}</div>}

                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{s.state || "—"}</td>
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
                                <span key={o.id} className="flex items-center gap-1.5 text-sm text-gray-200">
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
              {filtered.map((s) => {
                const orgs = orgsByStore[s.id] ?? [];
                return (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
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
                      <Switch
                        checked={!!s.is_active}
                        onCheckedChange={() => setToggleStore(s)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Edit modal */}
      <EditStoreDialog
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
        currentOrganizers={assignStore ? orgsByStore[assignStore.id] ?? [] : []}
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
      </>)}
    </div>

  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function RowActions({
  store,
  onEdit,
  onAssign,
  onToggle,
}: {
  store: Store;
  onEdit: () => void;
  onAssign: () => void;
  onToggle: () => void;
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

type EditStorePayload = {
  store_id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  address?: string;
  phone?: string;
  google_maps_url?: string;
  description?: string;
  opening_hours?: string;
  instagram?: string;
  website?: string;
  twitter?: string;
  twitch?: string;
};

function EditStoreDialog({
  store,
  onClose,
  onSubmit,
}: {
  store: Store | null;
  onClose: () => void;
  onSubmit: (data: EditStorePayload) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    city: "",
    state: "",
    country: "MX",
    address: "",
    phone: "",
    google_maps_url: "",
    description: "",
    opening_hours: "",
    instagram: "",
    website: "",
    twitter: "",
    twitch: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setForm({
        name: store.name,
        city: store.city ?? "",
        state: store.state ?? "",
        country: "MX",
        address: store.address ?? "",
        phone: store.phone ?? "",
        google_maps_url: store.google_maps_url ?? "",
        description: store.description ?? "",
        opening_hours: store.opening_hours ?? "",
        instagram: store.instagram ?? "",
        website: store.website ?? "",
        twitter: store.twitter ?? "",
        twitch: store.twitch ?? "",
      });
    }
  }, [store]);

  const submit = async () => {
    if (!store) return;
    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    if (!form.city.trim()) return toast.error("La ciudad es obligatoria");
    if (!form.state.trim()) return toast.error("El estado es obligatorio");
    setSaving(true);
    try {
      await onSubmit({
        store_id: store.id,
        name: form.name.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: (form.country || "MX").trim().toUpperCase(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        google_maps_url: form.google_maps_url.trim() || undefined,
        description: form.description.trim() || undefined,
        opening_hours: form.opening_hours.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        website: form.website.trim() || undefined,
        twitter: form.twitter.trim() || undefined,
        twitch: form.twitch.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={!!store} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar tienda</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {/* Información esencial */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Información esencial
            </h3>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Nombre *</Label>
              <Input value={form.name} onChange={set("name")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Ciudad *</Label>
                <Input value={form.city} onChange={set("city")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Estado *</Label>
                <Input value={form.state} onChange={set("state")} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">País</Label>
              <Input
                value={form.country}
                maxLength={2}
                onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Dirección</Label>
              <Input value={form.address} onChange={set("address")} placeholder="Calle, número, colonia" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Teléfono</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="+52..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Google Maps URL</Label>
              <Input value={form.google_maps_url} onChange={set("google_maps_url")} placeholder="https://maps.google.com/..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Horario</Label>
              <Input value={form.opening_hours} onChange={set("opening_hours")} placeholder="Lun-Vie 11:00-21:00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Descripción</Label>
              <textarea
                value={form.description}
                onChange={set("description")}
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                placeholder="Breve descripción de la tienda"
              />
            </div>
          </div>

          {/* Presencia digital */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Presencia digital
              <span className="ml-2 text-gray-600 normal-case tracking-normal font-normal">— Opcional</span>
            </h3>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Página web</Label>
              <Input value={form.website} onChange={set("website")} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Instagram</Label>
              <div className="flex items-center rounded-md border border-white/10 bg-black/30">
                <span className="px-2 text-gray-500 text-sm">@</span>
                <input
                  value={form.instagram}
                  onChange={set("instagram")}
                  placeholder="usuario"
                  className="flex-1 bg-transparent py-2 pr-3 text-sm text-white outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Twitter / X</Label>
              <div className="flex items-center rounded-md border border-white/10 bg-black/30">
                <span className="px-2 text-gray-500 text-sm">@</span>
                <input
                  value={form.twitter}
                  onChange={set("twitter")}
                  placeholder="usuario"
                  className="flex-1 bg-transparent py-2 pr-3 text-sm text-white outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-400">Twitch</Label>
              <div className="flex items-center rounded-md border border-white/10 bg-black/30">
                <span className="px-2 text-gray-500 text-sm">twitch.tv/</span>
                <input
                  value={form.twitch}
                  onChange={set("twitch")}
                  placeholder="usuario"
                  className="flex-1 bg-transparent py-2 pr-3 text-sm text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// ────────────────────────────────────────────────────────────
// Staff tab
// ────────────────────────────────────────────────────────────
type StaffRow = {
  id: string;
  geek_tag: string;
  email: string | null;
  role: "tcg_manager" | "organizer" | "admin";
  is_active: boolean;
  home_store: { id: string; name: string; city: string | null } | null;
  manager_games: { game_id: string; games?: { id: string; name: string } | null }[];
  work_schedule?: string | null;
  contact_primary?: string | null;
  contact_backup?: string | null;
};

function StaffTab() {
  const fetchStaff = useServerFn(listStaffMembers);
  const upsertStaff = useServerFn(upsertStaffMember);
  const fetchAllStores = useServerFn(listStoresWithOrganizers);
  const fetchManagerGames = useServerFn(getManagerAssignedGames);
  const saveManagerGamesFn = useServerFn(assignManagerGames);
  const assignOrganizerFn = useServerFn(assignOrganizerToStore);
  const deactivateStaffFn = useServerFn(deactivateStaffMember);
  const updateOpFieldsFn = useServerFn(updateStaffOperationalFields);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleTab, setRoleTab] = useState<"all" | "tcg_manager" | "organizer" | "admin">("all");

  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{
    email: string;
    geek_tag: string;
    role: "tcg_manager" | "organizer";
    work_schedule: string;
    contact_primary: string;
    contact_backup: string;
  }>({ email: "", geek_tag: "", role: "organizer", work_schedule: "", contact_primary: "", contact_backup: "" });
  const [addLoading, setAddLoading] = useState(false);

  const [assignModal, setAssignModal] = useState<{
    player_id: string;
    geek_tag: string;
    role: StaffRow["role"];
  } | null>(null);

  const [allGames, setAllGames] = useState<{ id: string; name: string }[]>([]);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [allStores, setAllStores] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [opFields, setOpFields] = useState<{
    work_schedule: string;
    contact_primary: string;
    contact_backup: string;
  }>({ work_schedule: "", contact_primary: "", contact_backup: "" });

  const [confirmAction, setConfirmAction] = useState<{
    player: StaffRow;
    action: "deactivate" | "delete";
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const filteredStaff = useMemo(
    () => (roleTab === "all" ? staff : staff.filter((p) => p.role === roleTab)),
    [staff, roleTab],
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const data = (await fetchStaff()) as StaffRow[];
      setStaff(data);
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAssignmentFor = async (
    player_id: string,
    geek_tag: string,
    role: StaffRow["role"],
    currentStoreId?: string,
  ) => {
    setAssignModal({ player_id, geek_tag, role });
    const current = staff.find((s) => s.id === player_id);
    setOpFields({
      work_schedule: current?.work_schedule ?? "",
      contact_primary: current?.contact_primary ?? "",
      contact_backup: current?.contact_backup ?? "",
    });
    if (role === "tcg_manager") {
      const gRes: any = await fetchManagerGames({ data: { player_id } });
      setAllGames(gRes.all_games ?? []);
      setSelectedGames(new Set(gRes.assigned_game_ids ?? []));
    } else {
      const sRes: any = await fetchAllStores();
      setAllStores((sRes.stores ?? []) as any[]);
      setSelectedStore(currentStoreId ?? "");
    }
  };

  const handleAddStaff = async () => {
    if (!addForm.email || !addForm.geek_tag) return;
    setAddLoading(true);
    try {
      const res: any = await upsertStaff({ data: addForm });
      toast.success(
        res.was_existing
          ? `Usuario existente actualizado al rol ${addForm.role}`
          : "Staff creado correctamente",
      );
      const playerId = res.player_id as string | null;
      const role = addForm.role;
      const geekTag = addForm.geek_tag;
      setAddModal(false);
      setAddForm({ email: "", geek_tag: "", role: "organizer", work_schedule: "", contact_primary: "", contact_backup: "" });
      await refresh();
      if (playerId) {
        await openAssignmentFor(playerId, geekTag, role);
      }
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setAddLoading(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!assignModal) return;
    setAssignLoading(true);
    try {
      if (assignModal.role === "tcg_manager") {
        await saveManagerGamesFn({
          data: {
            player_id: assignModal.player_id,
            game_ids: Array.from(selectedGames),
          },
        });
        toast.success("TCGs asignados correctamente");
      } else {
        if (!selectedStore) {
          toast.error("Selecciona una tienda");
          setAssignLoading(false);
          return;
        }
        await assignOrganizerFn({
          data: {
            player_id: assignModal.player_id,
            store_id: selectedStore,
          },
        });
        toast.success("Tienda asignada correctamente");
      }
      await updateOpFieldsFn({
        data: {
          player_id: assignModal.player_id,
          work_schedule: opFields.work_schedule.trim() || null,
          contact_primary: opFields.contact_primary.trim() || null,
          contact_backup: opFields.contact_backup.trim() || null,
        },
      });
      setAssignModal(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Staff del circuito</h2>
          <p className="text-xs text-gray-400">
            Managers y Organizadores activos en la plataforma
          </p>
        </div>
        <Button onClick={() => setAddModal(true)}>
          <UserPlus size={14} className="mr-2" />
          Agregar Staff
        </Button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {([
          { k: "all", label: "Todos" },
          { k: "admin", label: "Admins" },
          { k: "tcg_manager", label: "Managers" },
          { k: "organizer", label: "Organizadores" },
        ] as const).map((t) => {
          const count = t.k === "all" ? staff.length : staff.filter((s) => s.role === t.k).length;
          return (
            <button
              key={t.k}
              onClick={() => setRoleTab(t.k)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                roleTab === t.k
                  ? "border-primary text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {t.label} <span className="ml-1 text-xs text-gray-500">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-2">Geek Tag</th>
                    <th className="text-left px-4 py-2">Email</th>
                    <th className="text-left px-4 py-2">Rol</th>
                    <th className="text-left px-4 py-2">Asignación</th>
                    <th className="text-left px-4 py-2">Estado</th>
                    <th className="text-left px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Sin staff registrado.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((p) => (
                      <tr key={p.id} className="border-t border-white/5">
                        <td className="px-4 py-3 text-white font-medium">
                          {p.geek_tag}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {p.email ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              p.role === "admin"
                                ? "bg-red-500/20 text-red-400"
                                : p.role === "tcg_manager"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-orange-500/20 text-orange-400"
                            }
                          >
                            {p.role === "admin" ? "Admin" : p.role === "tcg_manager" ? "TCG Manager" : "Organizador"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {p.role === "tcg_manager" && p.manager_games?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {p.manager_games.map((mg) => (
                                <span
                                  key={mg.game_id}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300"
                                >
                                  {mg.games?.name}
                                </span>
                              ))}
                            </div>
                          ) : p.role === "organizer" && p.home_store ? (
                            <span className="text-xs text-gray-300">
                              {p.home_store.name}
                              {p.home_store.city ? ` · ${p.home_store.city}` : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Sin asignar</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.is_active ? "default" : "secondary"}>
                            {p.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded hover:bg-white/10 text-gray-300">
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  openAssignmentFor(p.id, p.geek_tag, p.role, p.home_store?.id)
                                }
                              >
                                <Info size={14} className="mr-2" />
                                Info
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  openAssignmentFor(p.id, p.geek_tag, p.role, p.home_store?.id)
                                }
                              >
                                <UserPlus size={14} className="mr-2" />
                                {p.role === "tcg_manager" ? "Asignar TCGs" : "Asignar tienda"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {p.is_active ? (
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ player: p, action: "deactivate" })}
                                  className="text-amber-400 focus:text-amber-300"
                                >
                                  <PowerOff size={14} className="mr-2" />
                                  Desactivar
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({ player: p, action: "delete" })}
                                className="text-red-400 focus:text-red-300"
                              >
                                <Power size={14} className="mr-2" />
                                Quitar del staff
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-white/5">
              {filteredStaff.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Sin staff registrado.
                </div>
              ) : (
                filteredStaff.map((p) => (
                  <div key={p.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-medium">{p.geek_tag}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            p.role === "admin"
                              ? "bg-red-500/20 text-red-400"
                              : p.role === "tcg_manager"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-orange-500/20 text-orange-400"
                          }
                        >
                          {p.role === "admin" ? "Admin" : p.role === "tcg_manager" ? "Manager" : "Org"}
                        </Badge>
                        <Badge variant={p.is_active ? "default" : "secondary"}>
                          {p.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{p.email ?? "—"}</div>
                    {p.role === "tcg_manager" && p.manager_games?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.manager_games.map((mg) => (
                          <span
                            key={mg.game_id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300"
                          >
                            {mg.games?.name}
                          </span>
                        ))}
                      </div>
                    ) : p.role === "organizer" && p.home_store ? (
                      <div className="text-xs text-gray-300">
                        {p.home_store.name}
                        {p.home_store.city ? ` · ${p.home_store.city}` : ""}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() =>
                          openAssignmentFor(p.id, p.geek_tag, p.role, p.home_store?.id)
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        Info
                      </button>
                      <button
                        onClick={() =>
                          openAssignmentFor(p.id, p.geek_tag, p.role, p.home_store?.id)
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        {p.role === "tcg_manager" ? "Asignar TCGs" : "Asignar tienda"}
                      </button>
                      {p.is_active ? (
                        <button
                          onClick={() => setConfirmAction({ player: p, action: "deactivate" })}
                          className="text-xs text-amber-400 hover:underline"
                        >
                          Desactivar
                        </button>
                      ) : null}
                      <button
                        onClick={() => setConfirmAction({ player: p, action: "delete" })}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Staff modal */}
      <Dialog open={addModal} onOpenChange={(o) => !o && setAddModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Staff</DialogTitle>
            <DialogDescription>
              Si el correo ya existe en la plataforma, el sistema actualizará su
              rol automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Correo electrónico *</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Nombre / Geek Tag *</Label>
              <Input
                value={addForm.geek_tag}
                onChange={(e) => setAddForm((f) => ({ ...f, geek_tag: e.target.value }))}
                placeholder="GeekTag123"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Rol *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["organizer", "tcg_manager"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, role: r }))}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                      addForm.role === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {r === "organizer" ? "Organizador" : "TCG Manager"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-gray-400">Horario de trabajo</Label>
                <Input
                  value={addForm.work_schedule}
                  onChange={(e) => setAddForm((f) => ({ ...f, work_schedule: e.target.value }))}
                  placeholder="Lun-Vie 10:00-19:00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Contacto principal</Label>
                <Input
                  value={addForm.contact_primary}
                  onChange={(e) => setAddForm((f) => ({ ...f, contact_primary: e.target.value }))}
                  placeholder="+52 55 1234 5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Contacto secundario</Label>
                <Input
                  value={addForm.contact_backup}
                  onChange={(e) => setAddForm((f) => ({ ...f, contact_backup: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddStaff} disabled={addLoading}>
              {addLoading ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : null}
              {addLoading ? "Procesando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment modal */}
      <Dialog open={!!assignModal} onOpenChange={(o) => !o && setAssignModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignModal?.role === "tcg_manager"
                ? "Asignar TCGs"
                : "Asignar tienda"}
            </DialogTitle>
            <DialogDescription>
              {assignModal?.role === "tcg_manager"
                ? `Selecciona los juegos que ${assignModal?.geek_tag ?? ""} tendrá bajo su responsabilidad.`
                : `Selecciona la tienda que ${assignModal?.geek_tag ?? ""} administrará.`}
            </DialogDescription>
          </DialogHeader>

          {assignModal?.role === "tcg_manager" ? (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {allGames.map((g) => {
                const isSelected = selectedGames.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setSelectedGames((prev) => {
                        const next = new Set(prev);
                        if (next.has(g.id)) next.delete(g.id);
                        else next.add(g.id);
                        return next;
                      })
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
                      isSelected
                        ? "border-primary bg-primary/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isSelected
                          ? "bg-primary border-primary text-white"
                          : "border-white/20"
                      }`}
                    >
                      {isSelected ? <Check size={12} /> : null}
                    </span>
                    {g.name}
                  </button>
                );
              })}
            </div>
          ) : assignModal ? (
            <div className="space-y-2">
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="— Seleccionar tienda —" />
                </SelectTrigger>
                <SelectContent>
                  {allStores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.city ? ` · ${s.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {assignModal ? (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                Información operativa
              </h4>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Horario / Disponibilidad
                </label>
                <input
                  value={opFields.work_schedule}
                  onChange={(e) =>
                    setOpFields((f) => ({ ...f, work_schedule: e.target.value }))
                  }
                  placeholder="Lun-Vie 18:00-22:00"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Contacto principal
                  </label>
                  <input
                    value={opFields.contact_primary}
                    onChange={(e) =>
                      setOpFields((f) => ({ ...f, contact_primary: e.target.value }))
                    }
                    placeholder="+52 81 1234 5678"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Contacto de respaldo
                  </label>
                  <input
                    value={opFields.contact_backup}
                    onChange={(e) =>
                      setOpFields((f) => ({ ...f, contact_backup: e.target.value }))
                    }
                    placeholder="+52 81 9876 5432"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          ) : null}


          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignModal(null)}>
              Omitir
            </Button>
            <Button onClick={handleSaveAssignment} disabled={assignLoading}>
              {assignLoading ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : null}
              {assignLoading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate / delete */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "deactivate" ? "Desactivar staff" : "Quitar del staff"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "deactivate"
                ? `Se desactivará la cuenta de ${confirmAction?.player.geek_tag}. Podrá ser reactivada después.`
                : `Se removerá a ${confirmAction?.player.geek_tag} del staff. Su rol pasará a usuario regular y se eliminarán sus asignaciones de TCGs.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirmAction?.action === "delete" ? "destructive" : "default"}
              disabled={confirmLoading}
              onClick={async () => {
                if (!confirmAction) return;
                setConfirmLoading(true);
                try {
                  await deactivateStaffFn({
                    data: {
                      player_id: confirmAction.player.id,
                      action: confirmAction.action,
                    },
                  });
                  toast.success(
                    confirmAction.action === "deactivate"
                      ? "Staff desactivado"
                      : "Staff removido",
                  );
                  setConfirmAction(null);
                  await refresh();
                } catch (e: any) {
                  toast.error(e?.message ?? String(e));
                } finally {
                  setConfirmLoading(false);
                }
              }}
            >
              {confirmLoading ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

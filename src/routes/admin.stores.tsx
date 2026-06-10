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
  X,
  Check,
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
        <h1 className="text-3xl font-bold text-white">Tiendas y Organizadores</h1>
        <p className="text-sm text-gray-400">
          Administra las tiendas del circuito y sus organizadores asignados.
        </p>
      </header>

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

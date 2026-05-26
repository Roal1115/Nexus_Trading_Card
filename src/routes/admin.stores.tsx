import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  listStoresWithOrganizers,
  createStore,
  setStoreActive,
} from "@/lib/geekarena-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/stores")({
  component: AdminStoresPage,
});

type Store = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean | null;
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

  const [stores, setStores] = useState<Store[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", state: "" });
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  const submit = async () => {
    if (!email) return;
    if (!form.name) return toast.error("El nombre es obligatorio");
    try {
      await create({ data: { name: form.name, city: form.city, state: form.state } });
      toast.success("Tienda creada");
      setOpen(false);
      setForm({ name: "", city: "", state: "" });
      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  const handleToggle = async (s: Store, next: boolean) => {
    setTogglingId(s.id);
    try {
      await toggleActive({ data: { store_id: s.id, is_active: next } });
      setStores((prev) =>
        prev.map((it) => (it.id === s.id ? { ...it, is_active: next } : it)),
      );
      toast.success(next ? "Tienda activada" : "Tienda desactivada");
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const orgsByStore = organizers.reduce<Record<string, Organizer[]>>((acc, o) => {
    if (!o.home_store_id) return acc;
    (acc[o.home_store_id] ||= []).push(o);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Red
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Tiendas y Organizadores
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Tiendas registradas en el circuito y sus organizadores asignados.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
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
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Ciudad</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Estado</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submit}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {stores.map((s) => (
          <div key={s.id} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">{s.name}</h3>
                <p className="text-xs text-gray-400">
                  {[s.city, s.state].filter(Boolean).join(", ") || "Sin ubicación"}
                  {" · "}
                  <span className="text-gray-500">{s.slug}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-widest ${s.is_active ? "text-primary" : "text-gray-500"}`}>
                  {s.is_active ? "Activa" : "Inactiva"}
                </span>
                <Switch
                  checked={!!s.is_active}
                  disabled={togglingId === s.id}
                  onCheckedChange={(v) => handleToggle(s, v)}
                />
              </div>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                Organizadores
              </p>
              {(orgsByStore[s.id] ?? []).length === 0 ? (
                <p className="mt-1 text-xs text-gray-500">Sin organizadores</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {(orgsByStore[s.id] ?? []).map((o) => (
                    <li key={o.id} className="text-sm text-gray-300">
                      {o.geek_tag}{" "}
                      <span className="text-xs text-gray-500">
                        · {o.email} · {o.role}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

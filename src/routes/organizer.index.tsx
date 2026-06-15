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
  getStoreAnalytics,
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

type FormState = {
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  google_maps_url: string;
  description: string;
  opening_hours: string;
  instagram: string;
  website: string;
  twitter: string;
  twitch: string;
};

const emptyForm: FormState = {
  name: "",
  city: "",
  state: "",
  address: "",
  phone: "",
  google_maps_url: "",
  description: "",
  opening_hours: "",
  instagram: "",
  website: "",
  twitter: "",
  twitch: "",
};

function OrganizerHome() {
  const { player, loading: roleLoading } = useGeekarenaRole();
  const email = player?.email ?? null;

  const fetchOverview = useServerFn(getOrganizerOverview);
  const saveHomeStore = useServerFn(updateHomeStore);
  const saveStoreInfo = useServerFn(updateStoreInfo);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [homeStore, setHomeStore] = useState<StoreRow | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchAnalytics = useServerFn(getStoreAnalytics);
  const [analyticsResult, setAnalyticsResult] = useState<string | null>(null);

  const handleTestAnalytics = async () => {
    try {
      const res = await fetchAnalytics({ data: {} });
      setAnalyticsResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setAnalyticsResult("ERROR: " + String((e as Error).message ?? e));
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res: any = await fetchOverview();
      setStores(res.stores);
      setHomeStore(res.homeStore);
      setSelectedStoreId(res.player.home_store_id ?? "");
      if (res.homeStore) {
        setForm({
          name:            res.homeStore.name ?? "",
          city:            res.homeStore.city ?? "",
          state:           res.homeStore.state ?? "",
          address:         res.homeStore.address ?? "",
          phone:           res.homeStore.phone ?? "",
          google_maps_url: res.homeStore.google_maps_url ?? "",
          description:     res.homeStore.description ?? "",
          opening_hours:   res.homeStore.opening_hours ?? "",
          instagram:       res.homeStore.instagram ?? "",
          website:         res.homeStore.website ?? "",
          twitter:         res.homeStore.twitter ?? "",
          twitch:          res.homeStore.twitch ?? "",
        });
      } else {
        setForm(emptyForm);
      }
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!email) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleAssignStore = async () => {
    if (!email || !selectedStoreId) return;
    setSaving(true);
    try {
      await saveHomeStore({ data: { store_id: selectedStoreId } });
      toast.success("Tienda asignada");
      await refresh();
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
        data: {
          store_id:        homeStore.id,
          name:            form.name,
          city:            form.city,
          state:           form.state,
          address:         form.address,
          phone:           form.phone,
          google_maps_url: form.google_maps_url,
          description:     form.description,
          opening_hours:   form.opening_hours,
          instagram:       form.instagram,
          website:         form.website,
          twitter:         form.twitter,
          twitch:          form.twitch,
        },
      });
      toast.success("Datos de la tienda actualizados");
      await refresh();
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
        <section className="glass space-y-6 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">
              Información de mi tienda
            </h2>
            <Button onClick={handleSaveInfo} disabled={saving}>
              {saving ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <Save size={14} className="mr-1" />
              )}
              Guardar cambios
            </Button>
          </div>

          {/* SECCIÓN 1 — Información esencial */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Información esencial
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-gray-400">Nombre de la tienda *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Ciudad</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Estado</Label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-gray-400">Dirección física</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Calle, número, colonia"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-gray-400">Enlace Google Maps</Label>
                <Input
                  value={form.google_maps_url}
                  onChange={(e) => setForm((f) => ({ ...f, google_maps_url: e.target.value }))}
                  placeholder="https://maps.google.com/..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Teléfono de contacto</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+52 81 1234 5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Horarios de atención</Label>
                <Input
                  value={form.opening_hours}
                  onChange={(e) => setForm((f) => ({ ...f, opening_hours: e.target.value }))}
                  placeholder="Lun-Vie 12:00-21:00"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-gray-400">Descripción</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Breve descripción de la tienda..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2 — Presencia digital */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Presencia digital
              <span className="ml-2 text-gray-600 normal-case tracking-normal font-normal">
                — Opcional
              </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-gray-400">Página web</Label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Instagram</Label>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-sm">@</span>
                  <Input
                    value={form.instagram}
                    onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                    placeholder="usuario"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">X / Twitter</Label>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-sm">@</span>
                  <Input
                    value={form.twitter}
                    onChange={(e) => setForm((f) => ({ ...f, twitter: e.target.value }))}
                    placeholder="usuario"
                  />
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-gray-400">Twitch</Label>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-sm">twitch.tv/</span>
                  <Input
                    value={form.twitch}
                    onChange={(e) => setForm((f) => ({ ...f, twitch: e.target.value }))}
                    placeholder="canal"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="glass rounded-2xl p-6 text-sm text-gray-400">
          Aún no tienes una tienda asignada. Selecciona una arriba para
          empezar a subir torneos.
        </section>
      )}

      {/* Temporal: botón de prueba para analytics */}
      <div className="glass rounded-2xl p-6 space-y-3">
        <button
          onClick={handleTestAnalytics}
          className="inline-flex items-center gap-2 rounded-md border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
        >
          Probar Analytics (temporal)
        </button>
        {analyticsResult && (
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-black/40 p-4 text-xs text-green-300">
            {analyticsResult}
          </pre>
        )}
      </div>
    </div>
  );
}

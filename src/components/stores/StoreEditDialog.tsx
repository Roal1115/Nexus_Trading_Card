import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationSelects, OpeningHoursField } from "@/components/stores/StoreFormFields";
import { listZones } from "@/lib/nexus-zones.functions";

/** Lo que Admin y Manager saben de una tienda al editarla. */
export type EditableStore = {
  id: string;
  name: string | null;
  city?: string | null;
  state?: string | null;
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
};

/** Vacío = borrar el dato; `zone` ausente = no cambiar la zona. Igual en Admin y Manager. */
export type StoreEditPayload = {
  store_id: string;
  name: string;
  zone?: string;
  subzone?: string | null;
  city: string;
  state: string;
  country?: string;
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

type Zone = { name: string; subzones: { name: string }[] };

const NO_SUBZONE = "__none__";

const emptyForm = (s: EditableStore | null) => ({
  name: s?.name ?? "",
  city: s?.city ?? "",
  state: s?.state ?? "",
  country: "MX",
  zone: s?.zone ?? "",
  subzone: s?.subzone ?? "",
  address: s?.address ?? "",
  phone: s?.phone ?? "",
  google_maps_url: s?.google_maps_url ?? "",
  description: s?.description ?? "",
  opening_hours: s?.opening_hours ?? "",
  instagram: s?.instagram ?? "",
  website: s?.website ?? "",
  twitter: s?.twitter ?? "",
  twitch: s?.twitch ?? "",
});

function PrefixedInput({
  id,
  prefix,
  value,
  onChange,
}: {
  id: string;
  prefix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring">
      <span className="pl-3 text-sm text-muted-foreground">{prefix}</span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="usuario"
        className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none"
      />
    </div>
  );
}

/**
 * Formulario único para editar una tienda. Cada panel guarda con su propia función del
 * servidor (`onSubmit`), que es donde viven los permisos.
 */
export function StoreEditDialog({
  store,
  onClose,
  onSubmit,
  showCountry = false,
}: {
  store: EditableStore | null;
  onClose: () => void;
  onSubmit: (payload: StoreEditPayload) => Promise<void>;
  showCountry?: boolean;
}) {
  const fetchZones = useServerFn(listZones);
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState(() => emptyForm(store));
  const [hoursValid, setHoursValid] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchZones()
      .then((res) => setZones(res.zones))
      .catch(() => toast.error("No se pudieron cargar las zonas"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (store) {
      setForm(emptyForm(store));
      setHoursValid(true);
    }
  }, [store]);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const subzoneOptions = zones.find((z) => z.name === form.zone)?.subzones ?? [];

  const submit = async () => {
    if (!store) return;
    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    // Solo impide borrar un dato; una tienda vieja sin estado puede guardarse igual.
    if (store.city && !form.city.trim()) return toast.error("La ciudad es obligatoria");
    if (store.state && !form.state.trim()) return toast.error("El estado es obligatorio");
    if (!hoursValid) return toast.error("Revisa el horario de la tienda");
    const opt = (v: string) => v.trim() || undefined;
    setSaving(true);
    try {
      await onSubmit({
        store_id: store.id,
        name: form.name.trim(),
        zone: opt(form.zone),
        subzone: form.subzone || null,
        city: form.city.trim(),
        state: form.state.trim(),
        ...(showCountry ? { country: (form.country || "MX").trim().toUpperCase() } : {}),
        address: opt(form.address),
        phone: opt(form.phone),
        google_maps_url: opt(form.google_maps_url),
        description: opt(form.description),
        opening_hours: opt(form.opening_hours),
        instagram: opt(form.instagram),
        website: opt(form.website),
        twitter: opt(form.twitter),
        twitch: opt(form.twitch),
      });
    } finally {
      setSaving(false);
    }
  };

  const sectionTitle =
    "border-b border-white/10 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <Dialog open={!!store} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar {store?.name ?? "tienda"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className={sectionTitle}>Información esencial</h3>
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Nombre *</Label>
              <Input
                id="store-name"
                value={form.name}
                maxLength={120}
                onChange={(e) => set("name")(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <LocationSelects
                state={form.state}
                city={form.city}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="store-zone">Zona del circuito</Label>
                <Select
                  value={form.zone}
                  onValueChange={(zone) => setForm((f) => ({ ...f, zone, subzone: "" }))}
                >
                  <SelectTrigger id="store-zone">
                    <SelectValue placeholder="Sin zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.name} value={z.name}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {subzoneOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="store-subzone">Subzona</Label>
                  <Select
                    value={form.subzone || NO_SUBZONE}
                    onValueChange={(v) => set("subzone")(v === NO_SUBZONE ? "" : v)}
                  >
                    <SelectTrigger id="store-subzone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUBZONE}>Sin subzona</SelectItem>
                      {subzoneOptions.map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {showCountry && (
              <div className="space-y-1.5">
                <Label htmlFor="store-country">País</Label>
                <Input
                  id="store-country"
                  value={form.country}
                  maxLength={2}
                  onChange={(e) => set("country")(e.target.value.toUpperCase())}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="store-address">Dirección</Label>
              <Input
                id="store-address"
                value={form.address}
                maxLength={300}
                onChange={(e) => set("address")(e.target.value)}
                placeholder="Calle, número, colonia"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="store-phone">Teléfono de la tienda</Label>
                <Input
                  id="store-phone"
                  type="tel"
                  value={form.phone}
                  maxLength={20}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="81 1234 5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-maps">Enlace de Google Maps</Label>
                <Input
                  id="store-maps"
                  value={form.google_maps_url}
                  onChange={(e) => set("google_maps_url")(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Horario</span>
              <OpeningHoursField
                key={store?.id}
                value={store?.opening_hours ?? ""}
                onChange={(opening_hours, valid) => {
                  setForm((f) => ({ ...f, opening_hours }));
                  setHoursValid(valid);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-description">Descripción</Label>
              <textarea
                id="store-description"
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Breve descripción de la tienda"
                className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className={sectionTitle}>
              Presencia digital
              <span className="ml-2 font-normal normal-case tracking-normal">— Opcional</span>
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="store-website">Página web</Label>
              <Input
                id="store-website"
                value={form.website}
                onChange={(e) => set("website")(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="store-instagram">Instagram</Label>
                <PrefixedInput
                  id="store-instagram"
                  prefix="@"
                  value={form.instagram}
                  onChange={set("instagram")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-twitter">X / Twitter</Label>
                <PrefixedInput
                  id="store-twitter"
                  prefix="@"
                  value={form.twitter}
                  onChange={set("twitter")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-twitch">Twitch</Label>
                <PrefixedInput
                  id="store-twitch"
                  prefix="twitch.tv/"
                  value={form.twitch}
                  onChange={set("twitch")}
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

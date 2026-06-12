import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { updateStoreData } from "@/lib/geekarena-manager.functions";

type StoreLike = {
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
};

const FIELDS: { key: keyof Omit<StoreLike, "id" | "description">; label: string }[] = [
  { key: "name", label: "Nombre *" },
  { key: "city", label: "Ciudad" },
  { key: "state", label: "Estado" },
  { key: "address", label: "Dirección" },
  { key: "phone", label: "Teléfono" },
  { key: "google_maps_url", label: "Google Maps URL" },
  { key: "opening_hours", label: "Horario" },
  { key: "instagram", label: "Instagram (@usuario)" },
  { key: "website", label: "Sitio web" },
  { key: "twitter", label: "X / Twitter (@usuario)" },
  { key: "twitch", label: "Twitch (canal)" },
];

export function StoreEditModal({
  store,
  onClose,
  onSaved,
}: {
  store: StoreLike;
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveStore = useServerFn(updateStoreData);
  const [form, setForm] = useState({
    name: store.name ?? "",
    city: store.city ?? "",
    state: store.state ?? "",
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await saveStore({ data: { store_id: store.id, ...form } });
      toast.success("Tienda actualizada correctamente");
      setConfirmOpen(false);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="glass rounded-2xl w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-lg">Editar {store.name}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-gray-400">{label}</label>
                <input
                  value={(form as any)[key] ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                />
              </div>
            ))}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-gray-400">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-white/10">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!form.name.trim()}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="glass rounded-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-lg">Confirmar cambios</h3>
            <p className="text-sm text-gray-400">
              ¿Confirmas que deseas guardar los cambios al perfil de{" "}
              <span className="text-white font-semibold">{store.name}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

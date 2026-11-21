import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { nexus } from "@/integrations/nexus/client";
import { getMyStorePromos, removeStorePromo, submitStorePromo } from "@/lib/nexus-promos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Promo = Awaited<ReturnType<typeof getMyStorePromos>>["promos"][number];

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};
const MAX_BYTES = 1_048_576;

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En revisión", cls: "border border-warning/50 text-warning" },
  approved: { label: "Aprobada", cls: "border border-border text-foreground" },
  rejected: { label: "Rechazada", cls: "border border-destructive/50 text-destructive" },
};

/** Promo de la tienda (banner en su página pública). Admin o Manager la aprueban antes de mostrarse. */
export function StorePromoManager({ storeId }: { storeId: string }) {
  const fetchPromos = useServerFn(getMyStorePromos);
  const submit = useServerFn(submitStorePromo);
  const remove = useServerFn(removeStorePromo);
  const fileRef = useRef<HTMLInputElement>(null);

  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetchPromos()
      .then((res) => setPromos(res.promos))
      .catch((e: Error) => toast.error(e.message || "No se pudieron cargar tus promos"));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPending = promos?.some((p) => p.status === "pending") ?? false;

  const pick = (f: File | undefined) => {
    if (!f) return setFile(null);
    if (!EXT[f.type]) {
      toast.error("La imagen debe ser WebP, PNG o JPG");
      return setFile(null);
    }
    if (f.size > MAX_BYTES) {
      toast.error("La imagen pesa más de 1 MB");
      return setFile(null);
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      const path = `${storeId}/${crypto.randomUUID()}.${EXT[file.type]}`;
      const { error } = await nexus.storage
        .from("promo-assets")
        .upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      await submit({ data: { title, image_path: path, link_url: link } });
      toast.success("Promo enviada a revisión");
      setTitle("");
      setLink("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      toast.error((err as Error).message || "No se pudo enviar la promo");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (p: Promo) => {
    const verb = p.status === "approved" ? "Retirar" : "Eliminar";
    if (!confirm(`¿${verb} la promo "${p.title}"?`)) return;
    try {
      await remove({ data: { id: p.id } });
      await load();
    } catch (err) {
      toast.error((err as Error).message || "No se pudo completar la acción");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Megaphone size={16} className="text-primary" />
        Promoción de tu tienda
      </div>
      <p className="text-xs text-foreground-secondary">
        Un banner que se muestra en la página pública de tu tienda. Lo revisa el equipo de Nexus
        antes de publicarse.
      </p>

      {promos && promos.length > 0 && (
        <ul className="space-y-3">
          {promos.map((p) => {
            const st = STATUS[p.status] ?? STATUS.pending;
            const retired = p.status === "approved" && !p.is_active;
            return (
              <li key={p.id} className="overflow-hidden rounded-xl border border-border">
                <img
                  src={p.image_url}
                  alt={p.title}
                  loading="lazy"
                  className="aspect-[16/5] w-full bg-black/40 object-cover"
                />
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{p.title}</span>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                      {retired ? "Retirada" : st.label}
                    </span>
                  </div>
                  {p.status === "rejected" && p.rejection_reason && (
                    <p className="text-xs text-foreground-secondary">
                      Motivo del rechazo: {p.rejection_reason}
                    </p>
                  )}
                  {!retired && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemove(p)}
                      >
                        {p.status === "approved" ? "Retirar" : "Eliminar"}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasPending ? (
        <p className="text-xs text-foreground-secondary">
          Tienes una promo en revisión. Podrás enviar otra cuando la revisen.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="promo-title" className="text-xs text-foreground-secondary">
              Título *
            </Label>
            <Input
              id="promo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-image" className="text-xs text-foreground-secondary">
              Imagen * (WebP, PNG o JPG · 1280 × 400 px recomendado · máx 1 MB)
            </Label>
            <Input
              id="promo-image"
              ref={fileRef}
              type="file"
              accept="image/webp,image/png,image/jpeg"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-link" className="text-xs text-foreground-secondary">
              Link (opcional)
            </Label>
            <Input
              id="promo-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <Button type="submit" disabled={saving || !file || title.trim().length < 2}>
            {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
            Enviar a revisión
          </Button>
        </form>
      )}
    </div>
  );
}

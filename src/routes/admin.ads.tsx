import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useRef } from "react";
import { Loader2, Plus, Pencil, RotateCcw, Image as ImageIcon, X, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { geekarena } from "@/integrations/geekarena/client";
import {
  listSponsors,
  createSponsor,
  updateSponsor,
  updateSponsorImages,
  resetSponsorViews,
  deleteSponsor,
} from "@/lib/geekarena-ads.functions";

export const Route = createFileRoute("/admin/ads")({
  head: () => ({ meta: [{ title: "Sponsors & Ads — Panel Admin" }] }),
  component: AdminAdsPage,
});

type Sponsor = {
  id: string;
  name: string;
  priority_rank: number;
  view_limit: number;
  views_count: number;
  cycles_count: number;
  is_active: boolean;
  logo_url: string | null;
  vertical_url: string | null;
  horizontal_url: string | null;
};

type Metrics = {
  total_sponsors: number;
  total_views: number;
  total_cycles: number;
  total_view_limit_per_cycle: number;
  current_sponsor_id: string | null;
  avg_daily_views: number;
};

const IMAGE_SPECS = {
  logo: { label: "Logo Carrusel", dims: "320 × 160 px", max: 150_000, maxLabel: "150 KB" },
  vertical: { label: "Banner Vertical (Desktop)", dims: "160 × 600 px", max: 300_000, maxLabel: "300 KB" },
  horizontal: { label: "Banner Horizontal (Mobile)", dims: "640 × 100 px", max: 200_000, maxLabel: "200 KB" },
} as const;

type ImageType = keyof typeof IMAGE_SPECS;

function AdminAdsPage() {
  const fetchList = useServerFn(listSponsors);
  const callCreate = useServerFn(createSponsor);
  const callUpdate = useServerFn(updateSponsor);
  const callReset = useServerFn(resetSponsorViews);
  const callUpdateImages = useServerFn(updateSponsorImages);
  const callDelete = useServerFn(deleteSponsor);

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editSponsor, setEditSponsor] = useState<Sponsor | null>(null);
  const [imagesSponsor, setImagesSponsor] = useState<Sponsor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchList();
      setSponsors(res.sponsors as Sponsor[]);
      setMetrics(res.metrics);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cargar sponsors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleActive = async (s: Sponsor) => {
    try {
      await callUpdate({ data: { sponsor_id: s.id, is_active: !s.is_active } });
      toast.success(s.is_active ? "Sponsor desactivado" : "Sponsor activado");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  const handleReset = async (s: Sponsor) => {
    if (!confirm(`¿Resetear el contador de vistas de ${s.name}?`)) return;
    try {
      await callReset({ data: { sponsor_id: s.id } });
      toast.success("Vistas reseteadas");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callDelete({ data: { sponsor_id: deleteTarget.id } });
      toast.success(`Sponsor "${deleteTarget.name}" eliminado correctamente`);
      setDeleteTarget(null);
      setDeleteInput("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Error al eliminar el sponsor");
    } finally {
      setDeleting(false);
    }
  };

  const isConfirmed = deleteInput.trim().toLowerCase() === "eliminar";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Sponsors & Ads</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} /> Nuevo sponsor
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Sponsors" value={metrics?.total_sponsors ?? 0} />
        <MetricCard label="Vistas / ciclo" value={metrics?.total_view_limit_per_cycle ?? 0} />
        <MetricCard label="Total vistas" value={(metrics?.total_views ?? 0).toLocaleString()} />
        <MetricCard label="Ciclos completos" value={metrics?.total_cycles ?? 0} />
        <MetricCard label="Promedio diario" value={`${metrics?.avg_daily_views ?? 0}/día`} />
      </div>

      {/* Sponsors table */}
      <div className="glass overflow-hidden rounded-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : sponsors.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            No hay sponsors aún. Crea el primero con "Nuevo sponsor".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/40 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Rank</th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-right">Límite</th>
                  <th className="px-3 py-2 text-right">Vistas</th>
                  <th className="px-3 py-2 text-left">Progreso</th>
                  <th className="px-3 py-2 text-right">Ciclos</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((s) => {
                  const pct = s.view_limit > 0 ? Math.min(100, (s.views_count / s.view_limit) * 100) : 0;
                  const isCurrent = metrics?.current_sponsor_id === s.id;
                  return (
                    <tr key={s.id} className="border-t border-white/5">
                      <td className="px-3 py-3 font-mono text-xs text-gray-400">#{s.priority_rank}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{s.name}</span>
                          {isCurrent && (
                            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                              Activo ahora
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-gray-400">{s.view_limit.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-white">{s.views_count.toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-gray-400">{s.cycles_count}</td>
                      <td className="px-3 py-3">
                        {s.is_active ? (
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                            Activo
                          </span>
                        ) : (
                          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn label="Subir imágenes" onClick={() => setImagesSponsor(s)}>
                            <ImageIcon size={14} />
                          </IconBtn>
                          <IconBtn label="Editar" onClick={() => setEditSponsor(s)}>
                            <Pencil size={14} />
                          </IconBtn>
                          <IconBtn label="Resetear vistas" onClick={() => handleReset(s)}>
                            <RotateCcw size={14} />
                          </IconBtn>
                          <IconBtn label={s.is_active ? "Desactivar" : "Activar"} onClick={() => handleToggleActive(s)}>
                            <Power size={14} />
                          </IconBtn>
                          <button
                            onClick={() => {
                              setDeleteTarget({ id: s.id, name: s.name });
                              setDeleteInput("");
                            }}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 rounded px-2 py-1 transition"
                          >
                            <Trash2 size={12} />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <SponsorFormModal
          title="Nuevo sponsor"
          onClose={() => setShowCreate(false)}
          onSubmit={async (vals) => {
            await callCreate({ data: vals });
            toast.success("Sponsor creado");
            setShowCreate(false);
            load();
          }}
        />
      )}

      {editSponsor && (
        <SponsorFormModal
          title={`Editar — ${editSponsor.name}`}
          initial={{
            name: editSponsor.name,
            priority_rank: editSponsor.priority_rank,
            view_limit: editSponsor.view_limit,
          }}
          onClose={() => setEditSponsor(null)}
          onSubmit={async (vals) => {
            await callUpdate({ data: { sponsor_id: editSponsor.id, ...vals } });
            toast.success("Sponsor actualizado");
            setEditSponsor(null);
            load();
          }}
        />
      )}

      {imagesSponsor && (
        <ImagesModal
          sponsor={imagesSponsor}
          onClose={() => setImagesSponsor(null)}
          onUpload={async (type, file) => {
            const spec = IMAGE_SPECS[type];
            if (file.type !== "image/webp") {
              throw new Error("Solo se aceptan imágenes en formato WebP");
            }
            if (file.size > spec.max) {
              throw new Error(`El archivo excede el tamaño máximo permitido (${spec.maxLabel})`);
            }
            const path = `sponsors/${imagesSponsor.id}/${type}.webp`;
            const { error } = await geekarena.storage
              .from("sponsor-assets")
              .upload(path, file, { upsert: true, contentType: "image/webp" });
            if (error) throw new Error(error.message);
            const { data } = geekarena.storage.from("sponsor-assets").getPublicUrl(path);
            const url = `${data.publicUrl}?v=${Date.now()}`;
            const updateField =
              type === "logo" ? { logo_url: url } : type === "vertical" ? { vertical_url: url } : { horizontal_url: url };
            await callUpdateImages({ data: { sponsor_id: imagesSponsor.id, ...updateField } });
            toast.success(`${spec.label} actualizada`);
            load();
            const fresh = sponsors.find((x) => x.id === imagesSponsor.id);
            if (fresh) setImagesSponsor({ ...fresh, ...updateField } as Sponsor);
          }}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

function SponsorFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: { name: string; priority_rank: number; view_limit: number };
  onClose: () => void;
  onSubmit: (vals: { name: string; priority_rank: number; view_limit: number }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rank, setRank] = useState(initial?.priority_rank ?? 1);
  const [limit, setLimit] = useState(initial?.view_limit ?? 500);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ name, priority_rank: rank, view_limit: limit });
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
          />
        </Field>
        <Field label="Ranking de prioridad">
          <input
            type="number"
            min={1}
            value={rank}
            onChange={(e) => setRank(Number(e.target.value))}
            required
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
          />
        </Field>
        <Field label="Límite de vistas por ciclo">
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            required
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImagesModal({
  sponsor,
  onClose,
  onUpload,
}: {
  sponsor: Sponsor;
  onClose: () => void;
  onUpload: (type: ImageType, file: File) => Promise<void>;
}) {
  return (
    <Modal title={`Imágenes de campaña — ${sponsor.name}`} onClose={onClose}>
      <div className="space-y-4">
        {(Object.keys(IMAGE_SPECS) as ImageType[]).map((type) => {
          const spec = IMAGE_SPECS[type];
          const currentUrl =
            type === "logo" ? sponsor.logo_url : type === "vertical" ? sponsor.vertical_url : sponsor.horizontal_url;
          return (
            <ImageUploadRow
              key={type}
              type={type}
              label={spec.label}
              spec={`WebP · ${spec.dims} · máx ${spec.maxLabel}`}
              currentUrl={currentUrl}
              onUpload={(file) => onUpload(type, file)}
            />
          );
        })}
      </div>
    </Modal>
  );
}

function ImageUploadRow({
  type,
  label,
  spec,
  currentUrl,
  onUpload,
}: {
  type: ImageType;
  label: string;
  spec: string;
  currentUrl: string | null;
  onUpload: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handle = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al subir imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="mt-0.5 text-xs text-gray-500">{spec}</div>
      <div className="mt-3 flex items-center gap-3">
        {currentUrl && (
          <img
            src={currentUrl}
            alt={label}
            className="h-12 w-auto rounded border border-white/10 bg-black/40"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
          }}
          className="hidden"
          id={`upload-${type}`}
        />
        <label
          htmlFor={`upload-${type}`}
          className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {uploading ? "Subiendo…" : currentUrl ? "Reemplazar" : "Subir imagen"}
        </label>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

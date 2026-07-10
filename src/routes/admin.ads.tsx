import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useRef } from "react";
import { Plus, Pencil, RotateCcw, Image as ImageIcon, X, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SkeletonLine } from "@/components/ui/skeleton-loader";
import { nexus } from "@/integrations/nexus/client";
import {
  listSponsors,
  createSponsor,
  updateSponsor,
  updateSponsorFull,
  updateSponsorImages,
  resetSponsorViews,
  deleteSponsor,
  getSponsorMetrics,
} from "@/lib/nexus-ads.functions";

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
  carousel_url: string | null;
  display_order: number;
};

type SponsorMetric = {
  id: string;
  name: string;
  views_this_month: number;
  view_limit: number;
  pct_consumed: number;
  cycles_count: number;
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
  vertical: {
    label: "Banner Vertical (Desktop)",
    dims: "160 × 600 px",
    max: 300_000,
    maxLabel: "300 KB",
  },
  horizontal: {
    label: "Banner Horizontal (Mobile)",
    dims: "640 × 100 px",
    max: 200_000,
    maxLabel: "200 KB",
  },
} as const;

type ImageType = keyof typeof IMAGE_SPECS;

function AdminAdsPage() {
  const fetchList = useServerFn(listSponsors);
  const callCreate = useServerFn(createSponsor);
  const callUpdate = useServerFn(updateSponsor);
  const callUpdateFull = useServerFn(updateSponsorFull);
  const callReset = useServerFn(resetSponsorViews);
  const callUpdateImages = useServerFn(updateSponsorImages);
  const callDelete = useServerFn(deleteSponsor);
  const callGetMetrics = useServerFn(getSponsorMetrics);

  const [tab, setTab] = useState<"sponsors" | "metrics">("sponsors");
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<SponsorMetric[]>([]);
  const [secondsAgo, setSecondsAgo] = useState(0);
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

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await callGetMetrics();
        setLiveMetrics(res.metrics as SponsorMetric[]);
        setSecondsAgo(0);
      } catch {
        // silent — metrics panel is non-critical
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(tick);
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
        {tab === "sponsors" && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} /> Nuevo sponsor
          </button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg bg-black/40 p-1 max-w-xs">
        {(["sponsors", "metrics"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              tab === t ? "bg-primary text-primary-foreground" : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "sponsors" ? "Sponsors" : "Métricas"}
          </button>
        ))}
      </div>

      {tab === "sponsors" && (
        <>
          {/* Sponsors table */}
          <div className="glass overflow-hidden rounded-2xl">
            {loading ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/40 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Rank</th>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      <th className="px-3 py-2 text-right">Límite</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="px-3 py-3">
                          <SkeletonLine width="w-6" height="h-3" />
                        </td>
                        <td className="px-3 py-3">
                          <SkeletonLine width="w-32" height="h-3" />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end">
                            <SkeletonLine width="w-12" height="h-3" />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <SkeletonLine width="w-16" height="h-5" className="rounded-md" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <SkeletonLine width="w-20" height="h-6" className="rounded-md" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sponsors.map((s) => {
                      const isCurrent = metrics?.current_sponsor_id === s.id;
                      return (
                        <tr key={s.id} className="border-t border-white/5">
                          <td className="px-3 py-3 font-mono text-xs text-gray-400">
                            #{s.priority_rank}
                          </td>
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
                          <td className="px-3 py-3 text-right font-mono text-xs text-gray-400">
                            {s.view_limit.toLocaleString()}
                          </td>
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
                              <IconBtn
                                label={s.is_active ? "Desactivar" : "Activar"}
                                onClick={() => handleToggleActive(s)}
                              >
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
        </>
      )}

      {tab === "metrics" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard label="Sponsors" value={liveMetrics.length} />
            <MetricCard
              label="Vistas / ciclo"
              value={liveMetrics.reduce((sum, m) => sum + (m.view_limit ?? 0), 0).toLocaleString()}
            />
            <MetricCard
              label="Total vistas (mes)"
              value={liveMetrics
                .reduce((sum, m) => sum + (m.views_this_month ?? 0), 0)
                .toLocaleString()}
            />
            <MetricCard
              label="Ciclos completos"
              value={liveMetrics.reduce((sum, m) => sum + (m.cycles_count ?? 0), 0)}
            />
            <MetricCard
              label="Promedio diario"
              value={`${
                new Date().getDate() > 0
                  ? Math.round(
                      liveMetrics.reduce((sum, m) => sum + (m.views_this_month ?? 0), 0) /
                        new Date().getDate(),
                    )
                  : 0
              }/día`}
            />
          </div>

          <div className="glass overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
              <h2 className="text-sm font-semibold text-white">
                Métricas en tiempo real · Este mes
              </h2>
              <span className="text-[11px] text-gray-500">Actualizado hace {secondsAgo}s</span>
            </div>
            {liveMetrics.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                Sin datos de métricas aún.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/40 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Sponsor</th>
                      <th className="px-3 py-2 text-right">Vistas este mes</th>
                      <th className="px-3 py-2 text-right">Límite</th>
                      <th className="px-3 py-2 text-left">Consumido</th>
                      <th className="px-3 py-2 text-left">Ciclos</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveMetrics.map((m) => {
                      const pct = Math.min(Number(m.pct_consumed), 100);
                      const barColor =
                        Number(m.pct_consumed) < 70
                          ? "bg-emerald-500"
                          : Number(m.pct_consumed) < 90
                            ? "bg-amber-500"
                            : "bg-red-500";
                      return (
                        <tr key={m.id} className="border-t border-white/5">
                          <td className="px-3 py-3 font-medium text-white">{m.name}</td>
                          <td className="px-3 py-3 text-right font-mono text-xs text-white">
                            {m.views_this_month.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs text-gray-400">
                            {m.view_limit.toLocaleString()}
                          </td>
                          <td className="px-3 py-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-white/5">
                              <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500">
                              {m.views_this_month} / {m.view_limit} vistas
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {m.cycles_count > 0 ? (
                              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                {m.cycles_count} ciclos
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {m.cycles_count > 0 ? (
                              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                                En ciclo {m.cycles_count}
                              </span>
                            ) : Number(m.pct_consumed) >= 90 ? (
                              <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                                Casi al límite
                              </span>
                            ) : (
                              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                                Activo
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

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
            horizontal_url: editSponsor.horizontal_url ?? "",
            carousel_url: editSponsor.carousel_url ?? "",
            is_active: editSponsor.is_active,
            display_order: editSponsor.display_order ?? 0,
          }}
          onClose={() => setEditSponsor(null)}
          onSubmit={async (vals) => {
            await callUpdateFull({
              data: {
                id: editSponsor.id,
                name: vals.name,
                view_limit: vals.view_limit,
                horizontal_url: vals.horizontal_url || null,
                carousel_url: vals.carousel_url || null,
                is_active: vals.is_active,
                display_order: vals.display_order,
              },
            });
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
            const { error } = await nexus.storage
              .from("sponsor-assets")
              .upload(path, file, { upsert: true, contentType: "image/webp" });
            if (error) throw new Error(error.message);
            const { data } = nexus.storage.from("sponsor-assets").getPublicUrl(path);
            const url = `${data.publicUrl}?v=${Date.now()}`;
            const updateField =
              type === "logo"
                ? { carousel_url: url }
                : type === "vertical"
                  ? { vertical_url: url }
                  : { horizontal_url: url };
            await callUpdateImages({ data: { sponsor_id: imagesSponsor.id, ...updateField } });
            toast.success(`${spec.label} actualizada`);
            load();
            const fresh = sponsors.find((x) => x.id === imagesSponsor.id);
            if (fresh) setImagesSponsor({ ...fresh, ...updateField } as Sponsor);
          }}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => {
            setDeleteTarget(null);
            setDeleteInput("");
          }}
        >
          <div
            className="glass rounded-2xl w-full max-w-md p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Eliminar Sponsor</h3>
                <p className="text-gray-400 text-xs">Esta acción no se puede deshacer</p>
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-sm text-gray-300">
                Estás a punto de eliminar permanentemente al sponsor{" "}
                <span className="font-bold text-white">"{deleteTarget.name}"</span>. Todas sus
                imágenes y métricas serán eliminadas. Si era el sponsor activo, los anuncios se
                detendrán hasta que se asigne uno nuevo.
              </p>
            </div>

            {/* Text confirmation */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400">
                Para confirmar, escribe{" "}
                <span className="font-mono font-bold text-red-400">ELIMINAR</span> en el campo de
                abajo:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Escribe ELIMINAR para confirmar"
                className={`w-full rounded-lg border px-4 py-3 text-sm bg-black/30 text-white placeholder-gray-600 outline-none transition
                  ${
                    isConfirmed
                      ? "border-red-500/60 focus:border-red-500"
                      : "border-white/10 focus:border-white/30"
                  }`}
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteInput("");
                }}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={!isConfirmed || deleting}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition
                  ${
                    isConfirmed && !deleting
                      ? "bg-red-500 hover:bg-red-600 text-white cursor-pointer"
                      : "bg-red-500/20 text-red-500/40 cursor-not-allowed"
                  }`}
              >
                {deleting ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
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

type SponsorFormExtra = {
  horizontal_url: string;
  carousel_url: string;
  is_active: boolean;
  display_order: number;
};

function SponsorFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: { name: string; priority_rank: number; view_limit: number } & Partial<SponsorFormExtra>;
  onClose: () => void;
  onSubmit: (
    vals: { name: string; priority_rank: number; view_limit: number } & SponsorFormExtra,
  ) => Promise<void>;
}) {
  const isEdit = initial != null && "is_active" in initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [rank, setRank] = useState(initial?.priority_rank ?? 1);
  const [limit, setLimit] = useState(initial?.view_limit ?? 500);
  const [horizontalUrl, setHorizontalUrl] = useState(initial?.horizontal_url ?? "");
  const [carouselUrl, setCarouselUrl] = useState(initial?.carousel_url ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [displayOrder, setDisplayOrder] = useState(initial?.display_order ?? 0);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name,
        priority_rank: rank,
        view_limit: limit,
        horizontal_url: horizontalUrl,
        carousel_url: carouselUrl,
        is_active: isActive,
        display_order: displayOrder,
      });
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
        {isEdit && (
          <>
            <Field label="Banner Horizontal URL">
              <input
                value={horizontalUrl}
                onChange={(e) => setHorizontalUrl(e.target.value)}
                placeholder="https://... (640×100px .webp)"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
              />
            </Field>
            <Field label="Logo Carrusel URL">
              <input
                value={carouselUrl}
                onChange={(e) => setCarouselUrl(e.target.value)}
                placeholder="https://... (320×160px .webp)"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
              />
            </Field>
            <Field label="Orden de prioridad">
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
              />
            </Field>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-primary"
              />
              <span className="text-sm text-gray-300">Activo</span>
            </label>
          </>
        )}
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
            type === "logo"
              ? sponsor.carousel_url
              : type === "vertical"
                ? sponsor.vertical_url
                : sponsor.horizontal_url;
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
  const shouldClose = useRef(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onPointerDown={(e) => {
        // Only allow closing if the interaction STARTS on the backdrop.
        shouldClose.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        // Only close if it also ENDS on the backdrop.
        if (shouldClose.current && e.target === e.currentTarget) {
          onClose();
        }

        shouldClose.current = false;
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

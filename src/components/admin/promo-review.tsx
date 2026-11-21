import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPromosForReview, reviewStorePromo } from "@/lib/nexus-promos.functions";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";

type Promo = Awaited<ReturnType<typeof listPromosForReview>>["promos"][number];

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-400" },
  approved: { label: "Aprobada", cls: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "Rechazada", cls: "bg-red-500/15 text-red-400" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

/** Cola de revisión de promos de tienda (pestaña de Admin y Manager). */
export function PromoReview() {
  const fetchList = useServerFn(listPromosForReview);
  const review = useServerFn(reviewStorePromo);
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    fetchList()
      .then((res) => {
        setError(null);
        setPromos(res.promos);
      })
      .catch((e: Error) => setError(e.message || "No se pudieron cargar las promos."));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (p: Promo, decision: "approve" | "reject") => {
    setBusy(p.id);
    try {
      await review({
        data: { id: p.id, decision, reason: decision === "reject" ? reason : undefined },
      });
      toast.success(decision === "approve" ? "Promo aprobada" : "Promo rechazada");
      setRejecting(null);
      setReason("");
      await load();
    } catch (e) {
      toast.error((e as Error).message || "No se pudo guardar la decisión");
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div role="alert" className="glass flex items-center gap-3 rounded-2xl p-4 text-sm">
        <p className="text-red-400">{error}</p>
        <button
          onClick={load}
          className="rounded-md border border-white/10 px-3 py-1.5 text-gray-300 hover:bg-white/5"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (promos === null) return <SkeletonBlock className="h-40 rounded-2xl" />;
  if (promos.length === 0) {
    return (
      <div className="glass rounded-2xl py-16 text-center text-sm text-gray-500">
        Ninguna tienda ha enviado una promo todavía.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {promos.map((p) => {
        const st = STATUS[p.status] ?? STATUS.pending;
        return (
          <li key={p.id} className="glass overflow-hidden rounded-2xl">
            <img
              src={p.image_url}
              alt={p.title}
              loading="lazy"
              className="aspect-[16/5] w-full border-b border-white/5 bg-black/40 object-cover"
            />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">{p.title}</h3>
                  <p className="text-xs text-gray-400">
                    {p.store_name} · enviada el {fmt(p.created_at)}
                    {!p.is_active && p.status === "approved" ? " · retirada por la tienda" : ""}
                  </p>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                  {st.label}
                </span>
              </div>

              {p.link_url && (
                <p className="break-all text-xs text-gray-400">
                  Link:{" "}
                  <a
                    href={p.link_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-primary underline underline-offset-2"
                  >
                    {p.link_url}
                  </a>
                </p>
              )}
              {p.status === "rejected" && p.rejection_reason && (
                <p className="text-xs text-gray-400">Motivo: {p.rejection_reason}</p>
              )}

              {rejecting === p.id ? (
                <div className="space-y-2">
                  <label className="block text-xs text-gray-400" htmlFor={`reason-${p.id}`}>
                    Motivo del rechazo (lo verá la tienda)
                  </label>
                  <textarea
                    id={`reason-${p.id}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={300}
                    autoFocus
                    className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setRejecting(null);
                        setReason("");
                      }}
                      className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => decide(p, "reject")}
                      disabled={busy === p.id || reason.trim().length < 3}
                      className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  {p.status !== "rejected" && (
                    <button
                      onClick={() => {
                        setRejecting(p.id);
                        setReason("");
                      }}
                      className="rounded-md border border-red-400/30 px-3 py-1.5 text-sm text-red-400 hover:border-red-400/50"
                    >
                      {p.status === "approved" ? "Quitar" : "Rechazar"}
                    </button>
                  )}
                  {p.status !== "approved" && (
                    <button
                      onClick={() => decide(p, "approve")}
                      disabled={busy === p.id}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

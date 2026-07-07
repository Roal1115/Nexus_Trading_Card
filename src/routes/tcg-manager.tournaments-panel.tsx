import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Eye, ArrowRight, XCircle, FileX } from "lucide-react";
import { FileLink } from "@/components/ui/FileLink";
import { toast } from "sonner";
import { TournamentRowSkeleton } from "@/components/ui/skeleton-loader";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  getManagerPendingTournaments,
  getManagerApprovedTournaments,
  getManagerPublishedTournaments,
  managerUndoApproval,
  unapproveManagerTournament,
  unpublishManagerTournament,
} from "@/lib/nexus-manager.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnapproveTournamentDialog } from "@/components/admin/UnapproveTournamentDialog";

export const Route = createFileRoute("/tcg-manager/tournaments-panel")({
  component: ManagerTournamentsPanel,
});

type Row = {
  id: string;
  tournament_date: string;
  status: string;
  created_at?: string;
  approved_at?: string | null;
  undo_deadline?: string | null;
  published_at?: string | null;
  csv_url: string | null;
  store_id: string;
  game_id: string;
  stores: { name: string; city: string | null; state: string | null } | null;
  games: { name: string } | null;
};

function formatCountdown(target: string | null | undefined): { text: string; expired: boolean } {
  if (!target) return { text: "—", expired: true };
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { text: "expirada", expired: true };
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { text: `${hours}h ${minutes}m`, expired: false };
}

function ManagerTournamentsPanel() {
  const navigate = useNavigate();
  const { player } = useNexusRole();
  const email = player?.email ?? null;

  const fetchPending = useServerFn(getManagerPendingTournaments);
  const fetchApproved = useServerFn(getManagerApprovedTournaments);
  const fetchPublished = useServerFn(getManagerPublishedTournaments);
  const undoFn = useServerFn(managerUndoApproval);
  const unapproveFn = useServerFn(unapproveManagerTournament);
  const unpublishFn = useServerFn(unpublishManagerTournament);

  const [pendingRows, setPendingRows] = useState<Row[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [approvedRows, setApprovedRows] = useState<Row[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedLoaded, setApprovedLoaded] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [unapproveTarget, setUnapproveTarget] = useState<Row | null>(null);

  const [publishedRows, setPublishedRows] = useState<Row[]>([]);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedLoaded, setPublishedLoaded] = useState(false);
  const [unpublishTarget, setUnpublishTarget] = useState<Row | null>(null);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const refreshPending = async () => {
    setPendingLoading(true);
    try {
      const res = await fetchPending();
      setPendingRows(res as unknown as Row[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setPendingLoading(false);
    }
  };

  const refreshApproved = async () => {
    setApprovedLoading(true);
    try {
      const res = await fetchApproved();
      setApprovedRows(res as unknown as Row[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setApprovedLoading(false);
      setApprovedLoaded(true);
    }
  };

  const refreshPublished = async () => {
    setPublishedLoading(true);
    try {
      const res = await fetchPublished();
      setPublishedRows(res as unknown as Row[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setPublishedLoading(false);
      setPublishedLoaded(true);
    }
  };

  useEffect(() => {
    if (!email) return;
    void refreshPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const onTabChange = (v: string) => {
    if (v === "approved" && !approvedLoaded) void refreshApproved();
    if (v === "published" && !publishedLoaded) void refreshPublished();
  };

  const onUndo = async (id: string) => {
    setActingId(id);
    try {
      await undoFn({ data: { tournament_id: id } });
      toast.success("Aprobación deshecha");
      await refreshApproved();
      await refreshPending();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Moderación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Torneos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Revisa, aprueba y administra los torneos de tus TCGs.
        </p>
      </header>

      <Tabs defaultValue="pending" onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="pending">
            Pendientes {pendingRows.length > 0 ? `(${pendingRows.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Aprobados {approvedLoaded && approvedRows.length > 0 ? `(${approvedRows.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="published">
            Publicados {publishedLoaded && publishedRows.length > 0 ? `(${publishedRows.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* PENDIENTES */}
        <TabsContent value="pending" className="mt-4">
          {pendingLoading ? (
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TournamentRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : pendingRows.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-sm text-gray-400">
              No hay torneos pendientes en tus TCGs.
            </div>
          ) : (
            <div className="glass overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Tienda</th>
                      <th className="px-4 py-3">Juego</th>
                      <th className="px-4 py-3">Subido el</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">CSV</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRows.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() =>
                          navigate({
                            to: "/tcg-manager/tournaments/$id",
                            params: { id: r.id },
                          })
                        }
                        className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                      >
                        <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {r.stores?.name ?? "—"}
                          {r.stores?.city ? (
                            <span className="block text-xs text-gray-500">
                              {r.stores.city}
                              {r.stores.state ? `, ${r.stores.state}` : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{r.games?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString("es-MX")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{r.status}</Badge>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <FileLink url={r.csv_url} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({
                                to: "/tcg-manager/tournaments/$id",
                                params: { id: r.id },
                              });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                          >
                            <Eye size={13} />
                            Revisar
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* APROBADOS */}
        <TabsContent value="approved" className="mt-4">
          {approvedLoading ? (
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TournamentRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : approvedRows.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-sm text-gray-400">
              No hay torneos aprobados en tus TCGs.
            </div>
          ) : (
            <div className="glass overflow-hidden rounded-2xl">
              <p className="px-4 pt-4 text-xs text-gray-400">
                Tienes 48 horas para deshacer una aprobación si fue un error.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Tienda</th>
                      <th className="px-4 py-3">Juego</th>
                      <th className="px-4 py-3">Ventana corrección</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">CSV</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedRows.map((r) => {
                      const cd = formatCountdown(r.undo_deadline);
                      return (
                        <tr
                          key={r.id}
                          className="border-t border-white/5 transition hover:bg-white/5"
                        >
                          <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                          <td className="px-4 py-3 text-gray-300">
                            {r.stores?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{r.games?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-xs">
                            {cd.expired ? (
                              <span className="text-gray-500">Expirada</span>
                            ) : (
                              <span className="text-yellow-300">{cd.text} restantes</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge>{r.status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <FileLink url={r.csv_url} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              {!cd.expired && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={actingId === r.id}
                                  onClick={() => onUndo(r.id)}
                                >
                                  {actingId === r.id ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    "Deshacer"
                                  )}
                                </Button>
                              )}
                              <button
                                onClick={() => setUnapproveTarget(r)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-red-400/60 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                              >
                                <XCircle size={13} />
                                Des-aprobar
                              </button>
                              <button
                                onClick={() =>
                                  navigate({
                                    to: "/tcg-manager/tournaments/$id",
                                    params: { id: r.id },
                                  })
                                }
                                className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                              >
                                <Eye size={13} />
                                Ver
                                <ArrowRight size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* PUBLICADOS */}
        <TabsContent value="published" className="mt-4">
          {publishedLoading ? (
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TournamentRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : publishedRows.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-sm text-gray-400">
              No hay torneos publicados en tus TCGs.
            </div>
          ) : (
            <div className="glass overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Tienda</th>
                      <th className="px-4 py-3">Juego</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">CSV</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishedRows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-white/5 transition hover:bg-white/5"
                      >
                        <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {r.stores?.name ?? "—"}
                          {r.stores?.city ? (
                            <span className="block text-xs text-gray-500">
                              {r.stores.city}
                              {r.stores.state ? `, ${r.stores.state}` : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{r.games?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge>{r.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <FileLink url={r.csv_url} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setUnpublishTarget(r)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-400/60 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                          >
                            <FileX size={13} />
                            Despublicar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <UnapproveTournamentDialog
        tournament={
          unapproveTarget
            ? {
                id: unapproveTarget.id,
                label: `${unapproveTarget.games?.name ?? "Torneo"} — ${unapproveTarget.stores?.name ?? ""} (${unapproveTarget.tournament_date})`,
              }
            : null
        }
        onClose={() => setUnapproveTarget(null)}
        onConfirm={async (reason) => {
          if (!unapproveTarget) return;
          await unapproveFn({
            data: { tournament_id: unapproveTarget.id, reason },
          });
          toast.success("Torneo des-aprobado");
          await refreshApproved();
          await refreshPending();
        }}
      />

      <UnapproveTournamentDialog
        tournament={
          unpublishTarget
            ? {
                id: unpublishTarget.id,
                label: `${unpublishTarget.games?.name ?? "Torneo"} — ${unpublishTarget.stores?.name ?? ""} (${unpublishTarget.tournament_date})`,
              }
            : null
        }
        onClose={() => setUnpublishTarget(null)}
        title="Despublicar torneo"
        description="Este torneo saldrá del leaderboard y los rankings se recalcularán."
        confirmLabel="Despublicar"
        icon={<FileX size={18} className="text-red-400" />}
        onConfirm={async (reason) => {
          if (!unpublishTarget) return;
          await unpublishFn({
            data: { tournament_id: unpublishTarget.id, reason },
          });
          toast.success("Torneo despublicado. Los rankings se recalcularán.");
          setPublishedLoaded(false);
          await refreshPublished();
        }}
      />
    </div>
  );
}

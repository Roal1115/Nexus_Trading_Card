import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Loader2,
  Eye,
  ArrowRight,
  XCircle,
  Upload,
  FileX,
} from "lucide-react";
import { FileLink } from "@/components/ui/FileLink";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  listTournamentsByStatus,
  publishTournaments,
  unapproveAdminTournament,
  unpublishTournament,
  getAdminTournamentHistory,
} from "@/lib/geekarena-admin.functions";
import { UnapproveTournamentDialog } from "@/components/admin/UnapproveTournamentDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/tournaments-panel")({
  component: TournamentsPanel,
});

type PendingRow = {
  id: string;
  tournament_date: string;
  game_name: string;
  status: string;
  csv_url: string | null;
  store: { name: string; city: string | null; state: string | null };
};

type ApprovedRow = PendingRow & {
  qualifying_month: number;
  qualifying_year: number;
};

type PublishedRow = {
  id: string;
  tournament_date: string;
  game_name: string;
  store_name: string;
  store_city: string;
  csv_url: string | null;
  qualifying_month?: number;
  qualifying_year?: number;
};

function TournamentsPanel() {
  const navigate = useNavigate();
  const { player } = useGeekarenaRole();
  const email = player?.email ?? null;

  const fetchList = useServerFn(listTournamentsByStatus);
  const fetchHistory = useServerFn(getAdminTournamentHistory);
  const publishFn = useServerFn(publishTournaments);
  const unapproveFn = useServerFn(unapproveAdminTournament);
  const unpublishFn = useServerFn(unpublishTournament);

  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [approvedRows, setApprovedRows] = useState<ApprovedRow[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedLoaded, setApprovedLoaded] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [publishing, setPublishing] = useState(false);
  const [unapproveTarget, setUnapproveTarget] = useState<ApprovedRow | null>(null);

  const [publishedRows, setPublishedRows] = useState<PublishedRow[]>([]);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedLoaded, setPublishedLoaded] = useState(false);
  const [unpublishTarget, setUnpublishTarget] = useState<PublishedRow | null>(null);

  const refreshPending = async () => {
    setPendingLoading(true);
    try {
      const res = await fetchList({ data: { statuses: ["DRAFT"] } });
      setPendingRows(res.tournaments as PendingRow[]);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setPendingLoading(false);
    }
  };

  const refreshApproved = async () => {
    setApprovedLoading(true);
    try {
      const res = await fetchList({ data: { statuses: ["APPROVED"] } });
      setApprovedRows(res.tournaments as ApprovedRow[]);
      setSelected({});
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
      const res = await fetchHistory({ data: { status: "PUBLISHED", page: 1 } });
      setPublishedRows(res.tournaments as unknown as PublishedRow[]);
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

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);

  const onPublish = async () => {
    if (selectedIds.length === 0) return;
    setPublishing(true);
    try {
      const res = await publishFn({ data: { tournament_ids: selectedIds } });
      toast.success(`${res.published} torneos publicados — leaderboard actualizado`);
      await refreshApproved();
      setPublishedLoaded(false);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setPublishing(false);
    }
  };

  const allChecked = approvedRows.length > 0 && approvedRows.every((r) => selected[r.id]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Moderación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Torneos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Revisa, aprueba, publica y administra el ciclo de vida de los torneos.
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

        {/* TAB: PENDIENTES */}
        <TabsContent value="pending" className="mt-4">
          {pendingLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : pendingRows.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-sm text-gray-400">
              No hay torneos pendientes.
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
                    {pendingRows.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() =>
                          navigate({ to: "/admin/tournaments/$id", params: { id: r.id } })
                        }
                        className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                      >
                        <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {r.store.name}
                          {r.store.city ? (
                            <span className="block text-xs text-gray-500">
                              {r.store.city}
                              {r.store.state ? `, ${r.store.state}` : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{r.game_name}</td>
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
                              navigate({ to: "/admin/tournaments/$id", params: { id: r.id } });
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

        {/* TAB: APROBADOS */}
        <TabsContent value="approved" className="mt-4">
          {approvedLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
                <p className="text-sm text-gray-400">
                  Selecciona los torneos a publicar. El leaderboard se recalculará al publicar.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={selectedIds.length === 0 || publishing}>
                      <Upload size={14} className="mr-1" />
                      Publicar seleccionados ({selectedIds.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Confirmas que deseas publicar {selectedIds.length} torneos?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción actualizará el leaderboard global.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onPublish}>Publicar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {approvedRows.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-sm text-gray-400">
                  No hay torneos aprobados pendientes de publicación.
                </div>
              ) : (
                <div className="glass overflow-hidden rounded-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                        <tr>
                          <th className="px-4 py-3">
                            <Checkbox
                              checked={allChecked}
                              onCheckedChange={(v) => {
                                if (v) {
                                  const all: Record<string, boolean> = {};
                                  approvedRows.forEach((r) => (all[r.id] = true));
                                  setSelected(all);
                                } else setSelected({});
                              }}
                            />
                          </th>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Tienda</th>
                          <th className="px-4 py-3">Juego</th>
                          <th className="px-4 py-3">Periodo</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">CSV</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedRows.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() =>
                              navigate({ to: "/admin/tournaments/$id", params: { id: r.id } })
                            }
                            className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={!!selected[r.id]}
                                onCheckedChange={(v) =>
                                  setSelected((s) => ({ ...s, [r.id]: !!v }))
                                }
                              />
                            </td>
                            <td className="px-4 py-3 text-white">{r.tournament_date}</td>
                            <td className="px-4 py-3 text-gray-300">{r.store.name}</td>
                            <td className="px-4 py-3 text-gray-300">{r.game_name}</td>
                            <td className="px-4 py-3 text-gray-400">
                              {r.qualifying_year}-{String(r.qualifying_month).padStart(2, "0")}
                            </td>
                            <td className="px-4 py-3">
                              <Badge>{r.status}</Badge>
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <FileLink url={r.csv_url} />
                            </td>
                            <td
                              className="px-4 py-3 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center gap-2">
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
                                      to: "/admin/tournaments/$id",
                                      params: { id: r.id },
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                                >
                                  <Eye size={13} />
                                  Revisar
                                  <ArrowRight size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* TAB: PUBLICADOS */}
        <TabsContent value="published" className="mt-4">
          {publishedLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : publishedRows.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-sm text-gray-400">
              No hay torneos publicados.
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
                      <th className="px-4 py-3">Periodo</th>
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
                          {r.store_name}
                          {r.store_city && r.store_city !== "—" ? (
                            <span className="block text-xs text-gray-500">{r.store_city}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{r.game_name}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {r.qualifying_year && r.qualifying_month
                            ? `${r.qualifying_year}-${String(r.qualifying_month).padStart(2, "0")}`
                            : "—"}
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
                label: `${unapproveTarget.game_name} — ${unapproveTarget.store.name} (${unapproveTarget.tournament_date})`,
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
                label: `${unpublishTarget.game_name} — ${unpublishTarget.store_name} (${unpublishTarget.tournament_date})`,
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

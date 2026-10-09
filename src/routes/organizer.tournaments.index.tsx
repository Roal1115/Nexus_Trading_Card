import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FileLink } from "@/components/ui/FileLink";
import { toast } from "sonner";
import { TournamentRowSkeleton } from "@/components/ui/skeleton-loader";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  deleteDraftTournament,
  getMyTournaments,
  getOrganizerFilterOptions,
  getOrganizerTournamentHistory,
} from "@/lib/nexus-organizer.functions";
import { Button } from "@/components/ui/button";
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
import { TournamentStatusBadge } from "@/components/admin/TournamentStatusBadge";
import {
  TournamentHistory,
  parseHistorySearch,
  type HistorySearch,
} from "@/components/admin/TournamentHistory";
import { tournamentsByTab, type OrganizerTab } from "@/components/organizer/organizer-home";

const TOURNAMENT_TABS = ["pending", "rejected", "approved", "published", "all"] as const;
type TournamentsTab = (typeof TOURNAMENT_TABS)[number];
type TournamentsSearch = HistorySearch & { tab?: TournamentsTab };

// Ruta índice (antes organizer.tournaments.tsx, que al ser padre de
// tournaments.$id sin <Outlet/> tapaba el detalle). La pestaña vive en ?tab=;
// los filtros de "Todos" también. Cambiar de pestaña los limpia.
export const Route = createFileRoute("/organizer/tournaments/")({
  validateSearch: (s: Record<string, unknown>): TournamentsSearch => ({
    ...parseHistorySearch(s),
    tab: TOURNAMENT_TABS.includes(s.tab as TournamentsTab) ? (s.tab as TournamentsTab) : undefined,
  }),
  head: () => ({ meta: [{ title: "Torneos — Organizador" }] }),
  component: TournamentsPage,
});

type Row = {
  id: string;
  game_id: string;
  game_name: string;
  tournament_date: string;
  status: string;
  csv_url: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  approved_by_tag?: string | null;
  participants?: number;
};

const EMPTY: Record<OrganizerTab, string> = {
  pending: "No tienes torneos en revisión.",
  rejected: "No tienes torneos rechazados.",
  approved: "No tienes torneos aprobados esperando publicación.",
  published: "Aún no tienes torneos publicados.",
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TournamentsPage() {
  const { player } = useNexusRole();
  const { tab: tabParam, ...search } = Route.useSearch();
  const tab = tabParam ?? "pending";
  const navigate = useNavigate();
  const setTab = (v: string) =>
    navigate({
      to: "/organizer/tournaments",
      search: v === "pending" ? {} : { tab: v as TournamentsTab },
    });

  const fetchList = useServerFn(getMyTournaments);
  const removeDraft = useServerFn(deleteDraftTournament);
  const fetchHistory = useServerFn(getOrganizerTournamentHistory);
  const fetchFilterOptions = useServerFn(getOrganizerFilterOptions);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchList({ data: {} });
      setRows(res.tournaments as Row[]);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    if (player) void load();
  }, [player?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const byTab = useMemo(() => tournamentsByTab(rows), [rows]);

  const handleDelete = async (id: string) => {
    try {
      await removeDraft({ data: { tournament_id: id } });
      toast.success("Torneo eliminado");
      await load();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  const count = (t: OrganizerTab) => (loading ? "" : ` (${byTab[t].length})`);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Mi tienda</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Torneos</h1>
          <p className="mt-1 text-sm text-gray-400">
            Los torneos que subiste y en qué punto de la revisión está cada uno.
          </p>
        </div>
        <Button asChild>
          <Link to="/organizer/new">
            <Plus size={14} className="mr-1" aria-hidden />
            Subir torneo
          </Link>
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="pending">En revisión{count("pending")}</TabsTrigger>
          <TabsTrigger value="rejected">Rechazados{count("rejected")}</TabsTrigger>
          <TabsTrigger value="approved">Aprobados{count("approved")}</TabsTrigger>
          <TabsTrigger value="published">Publicados{count("published")}</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        {(["pending", "rejected", "approved", "published"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            {loading ? (
              <div className="glass overflow-hidden rounded-2xl" aria-busy="true">
                <table className="w-full text-sm">
                  <tbody>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <TournamentRowSkeleton key={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="glass flex flex-wrap items-center gap-3 rounded-2xl p-6 text-sm text-red-200"
              >
                <AlertTriangle size={14} aria-hidden /> No se pudieron cargar tus torneos: {error}
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  <RefreshCw size={13} className="mr-1" aria-hidden /> Reintentar
                </Button>
              </div>
            ) : byTab[t].length === 0 ? (
              <div className="glass rounded-2xl p-8 text-sm text-gray-400">{EMPTY[t]}</div>
            ) : t === "rejected" ? (
              <RejectedList rows={byTab[t]} onDelete={handleDelete} />
            ) : (
              <TournamentRows rows={byTab[t]} onDelete={handleDelete} />
            )}
          </TabsContent>
        ))}

        {/* TODOS (antes /organizer/history) */}
        <TabsContent value="all" className="mt-4">
          <TournamentHistory
            search={search}
            onSearch={(next) =>
              navigate({ to: "/organizer/tournaments", search: { ...next, tab: "all" } })
            }
            fetchHistory={(filters) => fetchHistory({ data: filters })}
            fetchOptions={() => fetchFilterOptions()}
            detailTo="/organizer/tournaments/$id"
            audience="uploader"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DeleteButton({
  id,
  onDelete,
  label,
}: {
  id: string;
  onDelete: (id: string) => void;
  label?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Eliminar torneo">
          <Trash2 size={14} className={`text-red-400 ${label ? "mr-1" : ""}`} aria-hidden />
          {label && "Eliminar"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este torneo?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Solo puedes eliminar torneos en revisión o rechazados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(id)}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Rechazados: el motivo y la única salida real (eliminar y volver a subir). */
function RejectedList({ rows, onDelete }: { rows: Row[]; onDelete: (id: string) => void }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="glass space-y-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link
              to="/organizer/tournaments/$id"
              params={{ id: r.id }}
              className="rounded text-sm font-semibold text-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {r.game_name} · {r.tournament_date}
            </Link>
            <TournamentStatusBadge
              status={r.status}
              rejectionReason={r.rejection_reason}
              size="sm"
              audience="uploader"
            />
          </div>
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
              Motivo del rechazo
            </p>
            <p className="mt-1">{r.rejection_reason}</p>
          </div>
          <p className="text-sm text-gray-300">
            Elimina este torneo y vuelve a subir el archivo corregido.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <DeleteButton id={r.id} onDelete={onDelete} label />
            <Button asChild size="sm">
              <Link to="/organizer/new">
                <Plus size={14} className="mr-1" aria-hidden />
                Subir torneo
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TournamentRows({ rows, onDelete }: { rows: Row[]; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  const open = (id: string) => navigate({ to: "/organizer/tournaments/$id", params: { id } });
  return (
    <>
      {/* Desktop table */}
      <div className="glass hidden overflow-hidden rounded-2xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">TCG</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Aprobado por</th>
                <th className="px-4 py-3">Fecha aprobación</th>
                <th className="px-4 py-3">Participantes</th>
                <th className="px-4 py-3">CSV</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => open(r.id)}
                  className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-white">
                    <Link
                      to="/organizer/tournaments/$id"
                      params={{ id: r.id }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {r.tournament_date}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.game_name}</td>
                  <td className="px-4 py-3">
                    <TournamentStatusBadge
                      status={r.status}
                      rejectionReason={r.rejection_reason}
                      size="sm"
                      audience="uploader"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.approved_by_tag ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                    {fmtDate(r.approved_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.participants ?? 0}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <FileLink url={r.csv_url} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {r.status === "DRAFT" ? (
                      <DeleteButton id={r.id} onDelete={onDelete} />
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="glass space-y-2 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <Link
                to="/organizer/tournaments/$id"
                params={{ id: r.id }}
                className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="block text-sm font-semibold text-white">{r.game_name}</span>
                <span className="block text-xs text-gray-400">{r.tournament_date}</span>
              </Link>
              <TournamentStatusBadge
                status={r.status}
                rejectionReason={r.rejection_reason}
                size="sm"
                audience="uploader"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-500">Aprobado por</div>
                <div className="text-gray-200">{r.approved_by_tag ?? "—"}</div>
              </div>
              <div>
                <div className="text-gray-500">Aprobación</div>
                <div className="text-gray-200">{fmtDate(r.approved_at)}</div>
              </div>
              <div>
                <div className="text-gray-500">Participantes</div>
                <div className="text-gray-200">{r.participants ?? 0}</div>
              </div>
              <div>
                <div className="text-gray-500">Archivo</div>
                <FileLink url={r.csv_url} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-2">
              <Link
                to="/organizer/tournaments/$id"
                params={{ id: r.id }}
                className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Ver detalle
              </Link>
              {r.status === "DRAFT" && <DeleteButton id={r.id} onDelete={onDelete} label />}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

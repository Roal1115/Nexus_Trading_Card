import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, ExternalLink, Info, Filter } from "lucide-react";
import { FileLink } from "@/components/ui/FileLink";
import { toast } from "sonner";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import {
  getMyTournaments,
  deleteDraftTournament,
} from "@/lib/geekarena-organizer.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export const Route = createFileRoute("/organizer/tournaments")({
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
  published_at?: string | null;
  rejection_reason?: string | null;
  approved_by_tag?: string | null;
  participants?: number;
};

type Filters = {
  status: string;
  game_id: string;
  date_from: string;
  date_to: string;
};

const INITIAL: Filters = { status: "", game_id: "", date_from: "", date_to: "" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  APPROVED: "default",
  PUBLISHED: "default",
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status, reason }: { status: string; reason?: string | null }) {
  if (status === "DRAFT" && reason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-200">
              Rechazado <Info size={12} />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs font-semibold">Motivo del rechazo:</p>
            <p className="mt-1 text-xs">{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function TournamentsPage() {
  const { player, loading: roleLoading } = useGeekarenaRole();
  const fetchList = useServerFn(getMyTournaments);
  const removeDraft = useServerFn(deleteDraftTournament);

  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const load = async (f: Filters = filters) => {
    setLoading(true);
    try {
      const res = await fetchList({
        data: {
          ...(f.status && { status: f.status }),
          ...(f.game_id && { game_id: f.game_id }),
          ...(f.date_from && { date_from: f.date_from }),
          ...(f.date_to && { date_to: f.date_to }),
        },
      });
      setRows(res.tournaments as Row[]);
      setStats(res.stats ?? {});
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!player) return;
    load(INITIAL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  // Distinct games derived from current rows for the filter dropdown
  const gameOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.game_id, r.game_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const handleDelete = async (id: string) => {
    try {
      await removeDraft({ data: { tournament_id: id } });
      toast.success("Torneo eliminado");
      await load();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    }
  };

  const updateFilter = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    load(next);
  };

  const activeFiltersCount = [
    filters.status,
    filters.game_id,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  if (roleLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const draftCount = stats.DRAFT ?? 0;
  const approvedCount = stats.APPROVED ?? 0;
  const publishedCount = stats.PUBLISHED ?? 0;
  const rejectedCount = stats.REJECTED ?? 0;
  const totalCount = draftCount + approvedCount + publishedCount + rejectedCount;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Mis Torneos
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Torneos de tu tienda</h1>
          <p className="mt-1 text-sm text-gray-400">
            Borradores y torneos enviados a revisión.
          </p>
        </div>
        <Button asChild>
          <Link to="/organizer/new">
            <Plus size={14} className="mr-1" />
            Subir torneo
          </Link>
        </Button>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: "Total", value: totalCount, color: "text-white" },
          { label: "Borradores", value: draftCount, color: "text-gray-300" },
          { label: "Aprobados", value: approvedCount, color: "text-green-400" },
          { label: "Publicados", value: publishedCount, color: "text-primary" },
          { label: "Rechazados", value: rejectedCount, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-3 sm:p-4">
            <div className="text-xs text-gray-400">{s.label}</div>
            <div className={`mt-1 text-xl sm:text-2xl font-bold ${s.color}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-300">
          <Filter size={14} />
          <span>Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="text-xs text-primary">
              {activeFiltersCount} activo{activeFiltersCount > 1 ? "s" : ""}
            </span>
          )}
          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                setFilters(INITIAL);
                load(INITIAL);
              }}
              className="ml-auto text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg px-2 py-1"
            >
              Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value })}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="APPROVED">Aprobado</option>
            <option value="PUBLISHED">Publicado</option>
          </select>
          <select
            value={filters.game_id}
            onChange={(e) => updateFilter({ game_id: e.target.value })}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todos los TCG</option>
            {gameOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => updateFilter({ date_from: e.target.value })}
            placeholder="Desde"
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => updateFilter({ date_to: e.target.value })}
            placeholder="Hasta"
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-sm text-gray-400">
          {activeFiltersCount > 0
            ? "No hay torneos que coincidan con los filtros."
            : "Aún no has registrado torneos. Pulsa Subir torneo para empezar."}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="glass hidden md:block overflow-hidden rounded-2xl">
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
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="px-4 py-3 text-white whitespace-nowrap">
                        {r.tournament_date}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{r.game_name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} reason={r.rejection_reason} />
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {r.approved_by_tag ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {fmtDate(r.approved_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{r.participants ?? 0}</td>
                      <td className="px-4 py-3">
                        <FileLink url={r.csv_url} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === "DRAFT" ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 size={14} className="text-red-400" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar este torneo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Solo puedes eliminar
                                  torneos en estado Borrador.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(r.id)}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="glass rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm text-white font-semibold">{r.game_name}</div>
                    <div className="text-xs text-gray-400">{r.tournament_date}</div>
                  </div>
                  <StatusBadge status={r.status} reason={r.rejection_reason} />
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
                    <div className="text-gray-500">CSV</div>
                    <div>
                      {r.csv_url ? (
                        <a
                          href={r.csv_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary"
                        >
                          Ver <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </div>
                  </div>
                </div>
                {r.status === "DRAFT" && (
                  <div className="pt-2 border-t border-white/5 flex justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 size={14} className="text-red-400 mr-1" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este torneo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(r.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

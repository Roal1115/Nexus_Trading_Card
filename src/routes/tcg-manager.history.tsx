import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Filter, History, Info, Eye } from "lucide-react";
import { FileLink } from "@/components/ui/FileLink";
import { BlockSelect } from "@/components/ui/block-select";
import {
  getManagerTournamentHistory,
  getManagerFilterOptions,
} from "@/lib/nexus-manager.functions";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HistorySearch = {
  status?: string;
  game_id?: string;
  store_id?: string;
  season_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/tcg-manager/history")({
  validateSearch: (s: Record<string, unknown>): HistorySearch => ({
    status: str(s.status),
    game_id: str(s.game_id),
    store_id: str(s.store_id),
    season_id: str(s.season_id),
    date_from: str(s.date_from),
    date_to: str(s.date_to),
    page: typeof s.page === "number" && s.page > 1 ? s.page : undefined,
  }),
  head: () => ({ meta: [{ title: "Historial de Torneos — TCG Manager" }] }),
  component: ManagerHistoryPage,
});

type Row = {
  id: string;
  tournament_date: string;
  status: string;
  csv_url: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  rejection_reason?: string | null;
  game_name: string;
  store_name: string;
  store_city: string;
  approved_by_tag: string | null;
  approved_by_role: string | null;
  participants: number;
};

type Filters = {
  status: string;
  game_id: string;
  store_id: string;
  season_id: string;
  date_from: string;
  date_to: string;
  page: number;
};

const INITIAL: Filters = {
  status: "",
  game_id: "",
  store_id: "",
  season_id: "",
  date_from: "",
  date_to: "",
  page: 1,
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-white/5 text-gray-300 border-white/10",
  APPROVED: "bg-green-500/15 text-green-300 border-green-400/30",
  PUBLISHED: "bg-primary/15 text-primary border-primary/30",
};
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  tcg_manager: "TCG Manager",
  organizer: "Organizador",
  player: "Jugador",
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ManagerHistoryPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const urlSearch = Route.useSearch();
  const filters: Filters = useMemo(
    () => ({
      status: urlSearch.status ?? "",
      game_id: urlSearch.game_id ?? "",
      store_id: urlSearch.store_id ?? "",
      season_id: urlSearch.season_id ?? "",
      date_from: urlSearch.date_from ?? "",
      date_to: urlSearch.date_to ?? "",
      page: urlSearch.page ?? 1,
    }),
    [urlSearch],
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<{
    games: { id: string; name: string }[];
    stores: { id: string; name: string; city: string | null }[];
    seasons: { id: string; name: string; status: string }[];
  }>({ games: [], stores: [], seasons: [] });

  const fetchHist = useServerFn(getManagerTournamentHistory);
  const fetchOpts = useServerFn(getManagerFilterOptions);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetchHist({
        data: {
          ...(filters.status && { status: filters.status }),
          ...(filters.game_id && { game_id: filters.game_id }),
          ...(filters.store_id && { store_id: filters.store_id }),
          ...(filters.season_id && { season_id: filters.season_id }),
          ...(filters.date_from && { date_from: filters.date_from }),
          ...(filters.date_to && { date_to: filters.date_to }),
          page: filters.page,
        },
      });
      setRows(res.tournaments as Row[]);
      setTotal(res.total);
      setStats(res.stats ?? {});
    } finally {
      setLoading(false);
    }
  };

  const load = (overrides: Partial<Filters> = {}) =>
    navigate({
      search: (prev) => {
        const next: HistorySearch = { ...prev, ...overrides };
        for (const k of Object.keys(next) as (keyof HistorySearch)[]) {
          if (!next[k]) delete next[k];
        }
        return next;
      },
    });

  useEffect(() => {
    fetchOpts().then(setOpts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const totalPages = Math.max(1, Math.ceil(total / 25));
  const activeFilters = [
    filters.status,
    filters.game_id,
    filters.store_id,
    filters.season_id,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  const grandTotal =
    (stats.DRAFT ?? 0) + (stats.APPROVED ?? 0) + (stats.PUBLISHED ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">TCG Manager</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Historial de Torneos</h1>
        <p className="mt-1 text-sm text-gray-400">
          Torneos de los TCGs que administras.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Total", value: grandTotal, color: "text-white" },
          { label: "Borradores", value: stats.DRAFT ?? 0, color: "text-gray-300" },
          { label: "Aprobados", value: stats.APPROVED ?? 0, color: "text-green-400" },
          { label: "Publicados", value: stats.PUBLISHED ?? 0, color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-3 sm:p-4">
            <div className="text-xs text-gray-400">{s.label}</div>
            <div className={`mt-1 text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-300">
          <Filter size={14} />
          <span>Filtros</span>
          {activeFilters > 0 && (
            <span className="text-xs text-primary">{activeFilters} activo{activeFilters > 1 ? "s" : ""}</span>
          )}
          {activeFilters > 0 && (
            <button
              onClick={() => load({ ...INITIAL })}
              className="ml-auto text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg px-2 py-1"
            >Limpiar</button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <BlockSelect
            value={filters.status || null}
            onChange={(v) => load({ status: v ?? "", page: 1 })}
            placeholder="Todos los estados"
            options={[
              { value: "DRAFT", label: "DRAFT" },
              { value: "APPROVED", label: "APPROVED" },
              { value: "PUBLISHED", label: "PUBLISHED" },
            ]}
          />
          <BlockSelect
            value={filters.game_id || null}
            onChange={(v) => load({ game_id: v ?? "", page: 1 })}
            placeholder="Todos los TCG"
            options={opts.games.map((g) => ({ value: g.id, label: g.name }))}
          />
          <BlockSelect
            value={filters.store_id || null}
            onChange={(v) => load({ store_id: v ?? "", page: 1 })}
            placeholder="Todas las tiendas"
            options={opts.stores.map((s) => ({
              value: s.id,
              label: s.name + (s.city ? ` — ${s.city}` : ""),
            }))}
          />
          <BlockSelect
            value={filters.season_id || null}
            onChange={(v) => load({ season_id: v ?? "", page: 1 })}
            placeholder="Todas las temporadas"
            options={opts.seasons.map((s) => ({ value: s.id, label: s.name }))}
          />
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => load({ date_from: e.target.value, page: 1 })}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => load({ date_to: e.target.value, page: 1 })}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-white">Torneos</h2>
          </div>
          <div className="text-xs text-gray-400">
            {loading ? "Cargando..." : `${total.toLocaleString("es-MX")} registros`}
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/5 uppercase tracking-wider text-gray-400">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Fecha torneo</th>
                <th className="text-left px-3 py-2 font-medium">TCG</th>
                <th className="text-left px-3 py-2 font-medium">Tienda</th>
                <th className="text-left px-3 py-2 font-medium">Ciudad</th>
                <th className="text-left px-3 py-2 font-medium">Part.</th>
                <th className="text-left px-3 py-2 font-medium">Estado</th>
                <th className="text-left px-3 py-2 font-medium">Subido</th>
                <th className="text-left px-3 py-2 font-medium">Aprobado por</th>
                <th className="text-left px-3 py-2 font-medium">Aprobado</th>
                <th className="text-left px-3 py-2 font-medium">Publicado</th>
                <th className="text-left px-3 py-2 font-medium">CSV</th>
                <th className="text-left px-3 py-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400">Sin registros.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white whitespace-nowrap">{r.tournament_date}</td>
                  <td className="px-3 py-2 text-gray-300">{r.game_name}</td>
                  <td className="px-3 py-2 text-gray-300">{r.store_name}</td>
                  <td className="px-3 py-2 text-gray-400">{r.store_city}</td>
                  <td className="px-3 py-2 text-gray-300">{r.participants}</td>
                  <td className="px-3 py-2">
                    {r.status === "DRAFT" && r.rejection_reason ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 font-semibold text-red-200">
                              Rechazado <Info size={10} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs font-semibold">Motivo:</p>
                            <p className="mt-1 text-xs">{r.rejection_reason}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full border ${STATUS_COLOR[r.status] ?? STATUS_COLOR.DRAFT}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2 text-gray-300">
                    {r.approved_by_tag ? (
                      <span className="inline-flex items-center gap-1">
                        {r.approved_by_tag}
                        {r.approved_by_role && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {ROLE_LABEL[r.approved_by_role] ?? r.approved_by_role}
                          </Badge>
                        )}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmtDate(r.approved_at)}</td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmtDate(r.published_at)}</td>
                  <td className="px-3 py-2">
                    <FileLink url={r.csv_url} />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to="/tcg-manager/tournaments/$id"
                      params={{ id: r.id }}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Eye size={12} /> Detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile + tablet cards */}
        <div className="lg:hidden divide-y divide-white/5">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Cargando...</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Sin registros.</p>
          ) : rows.map((r) => (
            <div key={r.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{r.game_name}</span>
                {r.status === "DRAFT" && r.rejection_reason ? (
                  <span className="text-xs inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 font-semibold text-red-200">
                    Rechazado
                  </span>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[r.status] ?? STATUS_COLOR.DRAFT}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-400">
                {r.store_name} · {r.store_city} · {new Date(r.tournament_date + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-gray-500">Participantes:</span> <span className="text-gray-200">{r.participants}</span></div>
                <div><span className="text-gray-500">Subido:</span> <span className="text-gray-200">{new Date(r.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></div>
                {r.approved_at && (
                  <div><span className="text-gray-500">Aprobado:</span> <span className="text-gray-200">{new Date(r.approved_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></div>
                )}
                {r.approved_by_tag && (
                  <div className="col-span-2"><span className="text-gray-500">Por:</span> <span className="text-gray-200">{r.approved_by_tag}</span> {r.approved_by_role && (<span className="text-[10px] text-gray-400">({r.approved_by_role === "admin" ? "Admin" : "Manager"})</span>)}</div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <FileLink url={r.csv_url} />
                <button onClick={() => navigate({ to: "/tcg-manager/tournaments/$id", params: { id: r.id } })} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Eye size={12} /> Ver detalle
                </button>
              </div>

              {r.rejection_reason && (
                <div className="text-xs text-red-400/80 bg-red-500/10 rounded-lg px-2 py-1">
                  Motivo: "{r.rejection_reason}"
                </div>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 sm:px-5 py-3">
            <div className="text-xs text-gray-400">
              Página {filters.page} de {totalPages} · {total.toLocaleString("es-MX")} registros
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load({ page: filters.page - 1 })}
                disabled={filters.page <= 1 || loading}
                className="text-xs px-3 py-1.5 border border-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
              >← Anterior</button>
              <button
                onClick={() => load({ page: filters.page + 1 })}
                disabled={filters.page >= totalPages || loading}
                className="text-xs px-3 py-1.5 border border-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
              >Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

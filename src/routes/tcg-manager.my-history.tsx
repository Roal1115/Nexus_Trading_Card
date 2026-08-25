import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Filter, History, Loader2 } from "lucide-react";
import { getManagerHistory } from "@/lib/nexus-manager.functions";

type HistorySearch = {
  action_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/tcg-manager/my-history")({
  validateSearch: (s: Record<string, unknown>): HistorySearch => ({
    action_type: str(s.action_type),
    date_from: str(s.date_from),
    date_to: str(s.date_to),
    page: typeof s.page === "number" && s.page > 1 ? s.page : undefined,
  }),
  head: () => ({ meta: [{ title: "Mi Historial — TCG Manager" }] }),
  component: HistoryPage,
});

type Entry = {
  id: string;
  action: string;
  created_at: string;
  reason: string | null;
  tournament_id: string | null;
  tournament_date: string | null;
  game_name: string;
  store_name: string;
  store_city: string;
  tournament_status: string | null;
};

type Filters = {
  action_type: string;
  date_from: string;
  date_to: string;
  page: number;
};

const INITIAL: Filters = { action_type: "", date_from: "", date_to: "", page: 1 };

const ACTION_INFO: Record<string, { label: string; icon: string; color: string }> = {
  TOURNAMENT_APPROVED: { label: "Aprobado", icon: "✅", color: "text-green-400" },
  TOURNAMENT_REJECTED: { label: "Rechazado", icon: "❌", color: "text-red-400" },
  APPROVAL_UNDONE: { label: "Aprobación deshecha", icon: "↩️", color: "text-yellow-400" },
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

function fmtDateTime(s: string) {
  return new Date(s).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const urlSearch = Route.useSearch();
  const filters: Filters = useMemo(
    () => ({
      action_type: urlSearch.action_type ?? "",
      date_from: urlSearch.date_from ?? "",
      date_to: urlSearch.date_to ?? "",
      page: urlSearch.page ?? 1,
    }),
    [urlSearch],
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const fetchHist = useServerFn(getManagerHistory);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetchHist({
        data: {
          ...(filters.action_type && { action_type: filters.action_type }),
          ...(filters.date_from && { date_from: filters.date_from }),
          ...(filters.date_to && { date_to: filters.date_to }),
          page: filters.page,
        },
      });
      setEntries(res.entries as Entry[]);
      setTotal(res.total);
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
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const totalPages = Math.max(1, Math.ceil(total / 25));
  const activeFilters = [filters.action_type, filters.date_from, filters.date_to].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">TCG Manager</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Mi Historial</h1>
        <p className="mt-1 text-sm text-gray-400">
          Torneos que has aprobado, rechazado o procesado.
        </p>
      </header>

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
            >
              Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={filters.action_type}
            onChange={(e) => load({ action_type: e.target.value, page: 1 })}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todas las acciones</option>
            <option value="approved">Aprobados</option>
            <option value="rejected">Rechazados</option>
          </select>
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
            <h2 className="text-sm font-semibold text-white">Tus acciones</h2>
          </div>
          <div className="text-xs text-gray-400">
            {loading ? "Cargando..." : `${total.toLocaleString("es-MX")} registros`}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Fecha acción</th>
                <th className="text-left px-4 py-2 font-medium">Acción</th>
                <th className="text-left px-4 py-2 font-medium">TCG</th>
                <th className="text-left px-4 py-2 font-medium">Tienda</th>
                <th className="text-left px-4 py-2 font-medium">Fecha torneo</th>
                <th className="text-left px-4 py-2 font-medium">Estado actual</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin registros.</td></tr>
              ) : entries.map((e) => {
                const info = ACTION_INFO[e.action] ?? { label: e.action, icon: "•", color: "text-gray-400" };
                return (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtDateTime(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className={info.color}>{info.icon} {info.label}</div>
                      {e.action === "TOURNAMENT_REJECTED" && e.reason && (
                        <div className="text-xs text-red-400/80 mt-0.5">"{e.reason}"</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{e.game_name}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {e.store_name}
                      <span className="text-gray-500"> · {e.store_city}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{e.tournament_date ?? "—"}</td>
                    <td className="px-4 py-3">
                      {e.tournament_status ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[e.tournament_status] ?? STATUS_COLOR.DRAFT}`}>
                          {STATUS_LABEL[e.tournament_status] ?? e.tournament_status}
                        </span>
                      ) : <span className="text-gray-500">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-white/5">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Cargando...</p>
          ) : entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Sin registros.</p>
          ) : entries.map((e) => {
            const info = ACTION_INFO[e.action] ?? { label: e.action, icon: "•", color: "text-gray-400" };
            return (
              <div key={e.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${info.color}`}>{info.icon} {info.label}</span>
                  <span className="text-xs text-gray-500">{fmtDateTime(e.created_at)}</span>
                </div>
                {e.action === "TOURNAMENT_REJECTED" && e.reason && (
                  <div className="text-xs text-red-400/80">"{e.reason}"</div>
                )}
                <div className="text-sm text-white">{e.game_name}</div>
                <div className="text-xs text-gray-400">
                  {e.store_name} · {e.store_city}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Fecha torneo: {e.tournament_date ?? "—"}</span>
                  {e.tournament_status && (
                    <span className={`px-2 py-0.5 rounded-full border ${STATUS_COLOR[e.tournament_status] ?? STATUS_COLOR.DRAFT}`}>
                      {STATUS_LABEL[e.tournament_status] ?? e.tournament_status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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

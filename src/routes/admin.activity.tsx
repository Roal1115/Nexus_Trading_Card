import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Filter } from "lucide-react";
import { listAuditLog, type AuditLogRow } from "@/lib/geekarena-admin.functions";
import { useActivityLastSeen } from "@/hooks/use-badge-counts";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({ meta: [{ title: "Activity Center — Geek Arena" }] }),
  component: ActivityPage,
});

type ActionInfo = { label: string; icon: string; color: string };

const ACTION_LABELS: Record<string, ActionInfo> = {
  TOURNAMENT_APPROVED: { label: "Torneo aprobado", icon: "✅", color: "text-green-400" },
  TOURNAMENT_REJECTED: { label: "Torneo rechazado", icon: "❌", color: "text-red-400" },
  TOURNAMENT_PUBLISHED: { label: "Torneo publicado", icon: "🚀", color: "text-primary" },
  APPROVAL_UNDONE: { label: "Aprobación deshecha", icon: "↩️", color: "text-yellow-400" },
  ROLE_CHANGED: { label: "Rol modificado", icon: "👤", color: "text-blue-400" },
  ORGANIZER_ASSIGNED: { label: "Organizador asignado", icon: "🏪", color: "text-teal-400" },
  STORE_CREATED: { label: "Tienda creada", icon: "🏪", color: "text-teal-400" },
  STORE_UPDATED: { label: "Tienda editada", icon: "✏️", color: "text-gray-400" },
  SEASON_CREATED: { label: "Temporada creada", icon: "📅", color: "text-purple-400" },
  SEASON_ACTIVATED: { label: "Temporada activada", icon: "▶️", color: "text-green-400" },
  SEASON_CLOSED: { label: "Temporada cerrada", icon: "🔒", color: "text-gray-400" },
  SPONSOR_DELETED: { label: "Sponsor eliminado", icon: "🗑️", color: "text-red-400" },
  PLAYER_DETAIL_UPDATED: { label: "Perfil de jugador editado", icon: "✏️", color: "text-blue-400" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  tcg_manager: "TCG Manager",
  organizer: "Organizador",
  player: "Jugador",
};

type Filters = {
  action: string;
  actor_role: string;
  target_type: string;
  date_from: string;
  date_to: string;
  page: number;
};

const INITIAL: Filters = {
  action: "",
  actor_role: "",
  target_type: "",
  date_from: "",
  date_to: "",
  page: 1,
};

function ActivityPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const fetchLogs = useServerFn(listAuditLog);
  const { markSeen } = useActivityLastSeen();

  useEffect(() => {
    markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (overrides: Partial<Filters> = {}) => {
    const f = { ...filters, ...overrides };
    setFilters(f);
    setLoading(true);
    try {
      const res = await fetchLogs({
        data: {
          ...(f.action && { action: f.action }),
          ...(f.actor_role && { actor_role: f.actor_role }),
          ...(f.target_type && { target_type: f.target_type }),
          ...(f.date_from && { date_from: f.date_from }),
          ...(f.date_to && { date_to: f.date_to }),
          page: f.page,
        },
      });
      setLogs(res.logs);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / 50));
  const activeFilters = [
    filters.action,
    filters.actor_role,
    filters.target_type,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Activity Center</h1>
        <p className="mt-1 text-sm text-gray-400">
          Registro de todas las acciones realizadas en la plataforma.
        </p>
      </header>

      {/* Filters */}
      <div className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-300">
          <Filter size={14} />
          <span>Filtros</span>
          {activeFilters > 0 && (
            <span className="text-xs text-primary">
              {activeFilters} activo{activeFilters > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select
            value={filters.action}
            onChange={(e) => load({ action: e.target.value, page: 1 })}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.icon} {v.label}
              </option>
            ))}
          </select>
          <select
            value={filters.actor_role}
            onChange={(e) => load({ actor_role: e.target.value, page: 1 })}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="tcg_manager">TCG Manager</option>
            <option value="organizer">Organizador</option>
          </select>
          <select
            value={filters.target_type}
            onChange={(e) => load({ target_type: e.target.value, page: 1 })}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todos los tipos</option>
            <option value="tournament">Torneo</option>
            <option value="player">Jugador</option>
            <option value="store">Tienda</option>
            <option value="season">Temporada</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => load({ date_from: e.target.value, page: 1 })}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-0"
            />
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => load({ date_to: e.target.value, page: 1 })}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-0"
            />
            {activeFilters > 0 && (
              <button
                onClick={() => load({ ...INITIAL })}
                className="text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg px-2 whitespace-nowrap"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-white">
              Registro de actividad
            </h2>
          </div>
          <div className="text-xs text-gray-400">
            {loading
              ? "Cargando..."
              : `${total.toLocaleString("es-MX")} registros`}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Fecha</th>
                <th className="text-left px-4 py-2 font-medium">Actor</th>
                <th className="text-left px-4 py-2 font-medium">Rol</th>
                <th className="text-left px-4 py-2 font-medium">Acción</th>
                <th className="text-left px-4 py-2 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Sin registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const info =
                    ACTION_LABELS[log.action] ?? {
                      label: log.action,
                      icon: "•",
                      color: "text-gray-400",
                    };
                  const meta = log.metadata ?? {};
                  return (
                    <tr key={log.id} className="border-t border-white/5">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        {log.actor_tag}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                          {ROLE_LABELS[log.actor_role] ?? log.actor_role}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${info.color}`}>
                        {info.icon} {info.label}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        <span>{log.target_label}</span>
                        {typeof meta.reason === "string" && (
                          <span className="text-gray-500"> · "{meta.reason}"</span>
                        )}
                        {typeof meta.new_role === "string" && (
                          <span className="text-gray-500">
                            {" "}
                            → {ROLE_LABELS[meta.new_role] ?? meta.new_role}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-white/5">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              Cargando...
            </p>
          ) : logs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              Sin registros.
            </p>
          ) : (
            logs.map((log) => {
              const info =
                ACTION_LABELS[log.action] ?? {
                  label: log.action,
                  icon: "•",
                  color: "text-gray-400",
                };
              return (
                <div key={log.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${info.color}`}>
                      {info.icon} {info.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className="text-white">{log.actor_tag}</span>
                    <span> · </span>
                    <span>{ROLE_LABELS[log.actor_role] ?? log.actor_role}</span>
                  </div>
                  <p className="text-sm text-gray-300 break-words">
                    {log.target_label}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 sm:px-5 py-3">
            <div className="text-xs text-gray-400">
              Mostrando {(filters.page - 1) * 50 + 1}–
              {Math.min(filters.page * 50, total)} de{" "}
              {total.toLocaleString("es-MX")}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load({ page: filters.page - 1 })}
                disabled={filters.page <= 1 || loading}
                className="text-xs px-3 py-1.5 border border-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="text-xs text-gray-400">
                {filters.page} / {totalPages}
              </span>
              <button
                onClick={() => load({ page: filters.page + 1 })}
                disabled={filters.page >= totalPages || loading}
                className="text-xs px-3 py-1.5 border border-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import {
  Users,
  Store,
  MapPin,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

import {
  getManagerGames,
  getManagerAnalyticsOverview,
  getManagerAnalyticsTrend,
} from "@/lib/nexus-manager.functions";

export const Route = createFileRoute("/tcg-manager/analytics")({
  head: () => ({ meta: [{ title: "Analytics — TCG Manager" }] }),
  component: ManagerAnalyticsPage,
});

const ZONES = ["Zona Monterrey", "Zona Guadalajara", "Zona Centro", "Zona Extendida"];

type Game = { id: string; name: string; slug: string };

type Overview = {
  total_players: number;
  zone_breakdown: Array<{ zone: string; store_count: number; players: number }>;
  store_ranking: Array<{
    store_id: string;
    store_name: string;
    city: string;
    zone: string;
    players: number;
  }>;
  stores_offering_count: number;
};

type TrendData = {
  monthly_trend: Array<{
    month: string;
    players: number;
    new_players: number;
    returning_players: number;
  }>;
  player_classification: Array<{
    player_id: string;
    last_visit: string;
    total_tournaments: number;
  }>;
  peak_days: Array<{ date: string; players: number; type: "peak" | "valley" }>;
};

function ManagerAnalyticsPage() {
  const fetchGames = useServerFn(getManagerGames);
  const [games, setGames] = useState<Game[]>([]);
  const [activeGameId, setActiveGameId] = useState("");
  const [loadingGames, setLoadingGames] = useState(true);

  useEffect(() => {
    fetchGames()
      .then((res: any) => {
        setGames(res ?? []);
        if (res?.length > 0) setActiveGameId(res[0].id);
      })
      .catch(() => setGames([]))
      .finally(() => setLoadingGames(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingGames) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <SkeletonLine width="w-24" height="h-6" />
          <SkeletonLine width="w-16" height="h-3" />
        </div>
        <SkeletonBlock className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center">
        <p className="text-sm text-gray-400">No tienes TCGs asignados.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">TCG Manager</h1>
        <p className="text-sm text-gray-400">Analytics</p>
        <p className="text-xs text-gray-500">Salud nacional de tu TCG por zona y tienda.</p>
      </div>

      <div className="relative flex gap-0 border-b border-white/10">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveGameId(g.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition ${
              activeGameId === g.id ? "text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {g.name}
            {activeGameId === g.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        ))}
      </div>

      {activeGameId && <GameAnalyticsTab gameId={activeGameId} />}
    </div>
  );
}

function GameAnalyticsTab({ gameId }: { gameId: string }) {
  const fetchOverview = useServerFn(getManagerAnalyticsOverview);
  const fetchTrend = useServerFn(getManagerAnalyticsTrend);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [zone, setZone] = useState("");
  const [storeId, setStoreId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [atRiskDays, setAtRiskDays] = useState(21);
  const [inactiveDays, setInactiveDays] = useState(45);

  const load = () => {
    setLoading(true);
    const params = {
      game_id: gameId,
      zone: zone || undefined,
      store_id: storeId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    };
    Promise.all([fetchOverview({ data: params }), fetchTrend({ data: params })])
      .then(([ov, tr]: any[]) => {
        setOverview(ov);
        setTrendData(tr);
      })
      .catch(() => {
        setOverview(null);
        setTrendData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, zone, storeId, dateFrom, dateTo]);

  const categorySummary = useMemo(() => {
    if (!trendData?.player_classification) return null;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const summary = { recurrente: 0, ocasional: 0, una_vez: 0, en_riesgo: 0, inactivo: 0 };
    for (const p of trendData.player_classification) {
      const lastVisit = new Date(p.last_visit + "T12:00:00");
      const daysSince = Math.floor((today.getTime() - lastVisit.getTime()) / 86_400_000);
      if (daysSince > inactiveDays) {
        summary.inactivo++;
        continue;
      }
      if (daysSince > atRiskDays) {
        summary.en_riesgo++;
        continue;
      }
      if (p.total_tournaments === 1) summary.una_vez++;
      else if (p.total_tournaments >= 4) summary.recurrente++;
      else summary.ocasional++;
    }
    return summary;
  }, [trendData, atRiskDays, inactiveDays]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <select
          value={zone}
          onChange={(e) => {
            setZone(e.target.value);
            setStoreId("");
          }}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
        >
          <option value="">Todas las zonas</option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        {overview && overview.store_ranking.length > 0 && (
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
          >
            <option value="">Todas las tiendas</option>
            {overview.store_ranking.map((s) => (
              <option key={s.store_id} value={s.store_id}>
                {s.store_name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
        />
        <span className="text-xs text-gray-400">a</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
        />
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass space-y-2 rounded-2xl p-5">
                <SkeletonLine width="w-24" height="h-3" />
                <SkeletonLine width="w-16" height="h-6" />
              </div>
            ))}
          </div>
          <SkeletonBlock className="h-40 w-full rounded-2xl" />
          <SkeletonBlock className="h-64 w-full rounded-2xl" />
        </div>
      ) : !overview ? (
        <p className="text-sm text-gray-400">No se pudo cargar la información.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              icon={<Users size={16} />}
              label="Jugadores únicos"
              value={overview.total_players}
            />
            <KpiCard
              icon={<Store size={16} />}
              label="Tiendas con torneo"
              value={overview.stores_offering_count}
            />
            <KpiCard
              icon={<TrendingUp size={16} />}
              label="Mejor tienda"
              value={overview.store_ranking[0]?.store_name ?? "—"}
            />
          </div>

          <div className="glass space-y-4 rounded-2xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Desglose por zona
            </h3>
            {overview.zone_breakdown.length === 0 ? (
              <p className="text-sm text-gray-400">Sin datos.</p>
            ) : (
              <div className="space-y-2">
                {overview.zone_breakdown.map((z) => (
                  <div
                    key={z.zone}
                    className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-primary" />
                      <span className="text-sm font-medium text-white">{z.zone}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400">{z.players} jugadores</span>
                      <span className="text-xs text-gray-500">{z.store_count} tienda(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass space-y-4 rounded-2xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Ranking de tiendas
            </h3>
            {overview.store_ranking.length === 0 ? (
              <p className="text-sm text-gray-400">Sin datos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Tienda</th>
                      <th className="pb-2 pr-4">Zona</th>
                      <th className="pb-2 text-right">Jugadores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {overview.store_ranking.map((s, idx) => (
                      <tr key={s.store_id}>
                        <td className="py-3 pr-4 text-gray-500">{idx + 1}</td>
                        <td className="py-3 pr-4 font-medium text-white">
                          {s.store_name} — {s.city}
                        </td>
                        <td className="py-3 pr-4 text-gray-400">{s.zone}</td>
                        <td className="py-3 text-right font-semibold text-primary">{s.players}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {trendData && trendData.monthly_trend.length > 0 && (
            <div className="glass space-y-4 rounded-2xl p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
                <TrendingUp size={14} /> Tendencia mensual de jugadores
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={trendData.monthly_trend}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E86A22" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#E86A22" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.15)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#9CA3AF", fontSize: 10 }}
                      tickFormatter={(v) => {
                        const [year, month] = v.split("-");
                        const names = [
                          "Ene",
                          "Feb",
                          "Mar",
                          "Abr",
                          "May",
                          "Jun",
                          "Jul",
                          "Ago",
                          "Sep",
                          "Oct",
                          "Nov",
                          "Dic",
                        ];
                        return `${names[parseInt(month, 10) - 1]} ${year}`;
                      }}
                    />
                    <YAxis
                      tick={{ fill: "#9CA3AF", fontSize: 10 }}
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                    />{" "}
                    <Tooltip
                      contentStyle={{
                        background: "#0F1117",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#fff" }}
                      labelFormatter={(v) => {
                        const [year, month] = v.split("-");
                        const names = [
                          "Enero",
                          "Febrero",
                          "Marzo",
                          "Abril",
                          "Mayo",
                          "Junio",
                          "Julio",
                          "Agosto",
                          "Septiembre",
                          "Octubre",
                          "Noviembre",
                          "Diciembre",
                        ];
                        return `${names[parseInt(month, 10) - 1]} ${year}`;
                      }}
                      itemStyle={{ color: "#E86A22" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="players"
                      stroke="#E86A22"
                      strokeWidth={2}
                      fill="url(#trendGradient)"
                      dot={{ r: 4, fill: "#E86A22", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      name="Jugadores únicos"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {trendData && trendData.monthly_trend.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
                <Users size={14} className="text-primary" /> Nuevos vs. recurrentes por mes
              </h3>
              <p className="mb-4 text-xs text-gray-500">
                Jugadores que aparecen por primera vez ese mes vs. jugadores que ya habían
                participado antes.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={trendData.monthly_trend}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  barCategoryGap="60%"
                  barSize={100}
                >
                  <CartesianGrid
                    strokeDasharray="2 6"
                    stroke="rgba(255,255,255,0.15)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#9CA3AF", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => {
                      const [year, month] = v.split("-");
                      const names = [
                        "Ene",
                        "Feb",
                        "Mar",
                        "Abr",
                        "May",
                        "Jun",
                        "Jul",
                        "Ago",
                        "Sep",
                        "Oct",
                        "Nov",
                        "Dic",
                      ];
                      return `${names[parseInt(month, 10) - 1]} ${year}`;
                    }}
                  />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "#0F1117",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "#fff" }}
                    labelFormatter={(v) => {
                      const [year, month] = v.split("-");
                      const names = [
                        "Enero",
                        "Febrero",
                        "Marzo",
                        "Abril",
                        "Mayo",
                        "Junio",
                        "Julio",
                        "Agosto",
                        "Septiembre",
                        "Octubre",
                        "Noviembre",
                        "Diciembre",
                      ];
                      return `${names[parseInt(month, 10) - 1]} ${year}`;
                    }}
                    formatter={(value, name) => [
                      value,
                      name === "new_players" ? "Jugadores nuevos" : "Jugadores recurrentes",
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                    formatter={(value, entry) => (
                      <span style={{ color: entry.color, fontWeight: 600 }}>
                        {value === "new_players" ? "Nuevos" : "Recurrentes"}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="new_players"
                    name="new_players"
                    stackId="a"
                    fill="#10B981"
                    fillOpacity={0.85}
                    radius={[0, 0, 6, 6]}
                  />
                  <Bar
                    dataKey="returning_players"
                    name="returning_players"
                    stackId="a"
                    fill="#E86A22"
                    fillOpacity={0.9}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {categorySummary && (
            <div className="glass space-y-4 rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
                  <Users size={14} /> Clasificación de jugadores
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <label className="flex items-center gap-1.5">
                    En riesgo si no juega en
                    <input
                      type="number"
                      min={1}
                      value={atRiskDays}
                      onChange={(e) => setAtRiskDays(Number(e.target.value))}
                      className="w-14 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-center text-white"
                    />
                    días
                  </label>
                  <label className="flex items-center gap-1.5">
                    Inactivo después de
                    <input
                      type="number"
                      min={1}
                      value={inactiveDays}
                      onChange={(e) => setInactiveDays(Number(e.target.value))}
                      className="w-14 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-center text-white"
                    />
                    días
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  {
                    label: "Recurrentes",
                    value: categorySummary.recurrente,
                    color: "text-emerald-400",
                  },
                  {
                    label: "Ocasionales",
                    value: categorySummary.ocasional,
                    color: "text-blue-400",
                  },
                  { label: "Una vez", value: categorySummary.una_vez, color: "text-gray-300" },
                  { label: "En riesgo", value: categorySummary.en_riesgo, color: "text-amber-400" },
                  { label: "Inactivos", value: categorySummary.inactivo, color: "text-red-400" },
                ].map((cat) => (
                  <div
                    key={cat.label}
                    className="rounded-md border border-white/10 bg-white/[0.02] p-4 text-center"
                  >
                    <p className={`text-2xl font-bold ${cat.color}`}>{cat.value}</p>
                    <p className="mt-1 text-xs text-gray-400">{cat.label}</p>
                  </div>
                ))}
              </div>

              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <AlertTriangle size={12} /> Los umbrales ajustan la vista en tiempo real sin
                modificar la configuración de cada tienda.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="glass space-y-2 rounded-2xl p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
        {icon} {label}
      </p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

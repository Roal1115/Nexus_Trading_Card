import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, Store, MapPin, TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getManagerGames, getManagerAnalyticsOverview, getManagerAnalyticsTrend } from "@/lib/geekarena-manager.functions";

export const Route = createFileRoute("/tcg-manager/analytics")({
  head: () => ({ meta: [{ title: "Analytics — TCG Manager" }] }),
  component: ManagerAnalyticsPage,
});

const ZONES = ["Zona Monterrey", "Zona Guadalajara", "Zona Centro", "Zona Extendida"];

type Game = { id: string; name: string; slug: string };

type Overview = {
  total_players: number;
  zone_breakdown: Array<{ zone: string; store_count: number; players: number }>;
  store_ranking: Array<{ store_id: string; store_name: string; city: string; zone: string; players: number }>;
  stores_offering_count: number;
};

type TrendData = {
  monthly_trend: Array<{ month: string; players: number }>;
  player_classification: Array<{ player_id: string; last_visit: string; total_tournaments: number }>;
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
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

      <div className="flex gap-0 border-b border-white/10">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveGameId(g.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              activeGameId === g.id
                ? "border-primary text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {g.name}
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
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : !overview ? (
        <p className="text-sm text-gray-400">No se pudo cargar la información.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard icon={<Users size={16} />} label="Jugadores únicos" value={overview.total_players} />
            <KpiCard icon={<Store size={16} />} label="Tiendas con torneo" value={overview.stores_offering_count} />
            <KpiCard
              icon={<TrendingUp size={16} />}
              label="Mejor tienda"
              value={overview.store_ranking[0]?.store_name ?? "—"}
            />
          </div>

          <div className="glass space-y-4 rounded-2xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Desglose por zona</h3>
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
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Ranking de tiendas</h3>
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
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="glass space-y-2 rounded-2xl p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
        {icon} {label}
      </p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

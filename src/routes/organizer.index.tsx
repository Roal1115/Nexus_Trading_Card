import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Loader2,
  Users,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts";
import { Link } from "@tanstack/react-router";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { usePagination } from "@/hooks/use-pagination";
import { getStoreAnalytics } from "@/lib/nexus-organizer.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TablePager } from "@/components/ui/table-pager";
import { ScopeFilters } from "@/components/organizer/scope-filters";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/organizer/")({
  head: () => ({ meta: [{ title: "Analytics — Nexus" }] }),
  component: OrganizerAnalytics,
});

type AnalyticsResult = Awaited<ReturnType<typeof getStoreAnalytics>>;

const CATEGORY_LABELS: Record<string, string> = {
  recurrente: "Recurrente",
  ocasional: "Ocasional",
  una_vez: "Una sola vez",
  inactivo: "Inactivo",
};

const CATEGORY_COLORS: Record<string, string> = {
  recurrente: "#22c55e",
  ocasional: "#eab308",
  una_vez: "#60a5fa",
  inactivo: "#6b7280",
};

function OrganizerAnalytics() {
  const { player, loading: roleLoading } = useNexusRole();
  const fetchAnalytics = useServerFn(getStoreAnalytics);

  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);

  const refresh = async (df?: string, dt?: string, gameId?: string | null, leagueId?: string | null) => {
    setLoading(true);
    try {
      const res = await fetchAnalytics({
        data: {
          date_from: df || undefined,
          date_to: dt || undefined,
          game_id: gameId || undefined,
          league_id: leagueId ?? null,
        },
      });
      setData(res);
      if (!df) setDateFrom(res.range.start);
      if (!dt) setDateTo(res.range.end);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!player) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const handleApplyRange = () => {
    void refresh(dateFrom, dateTo, selectedGameId, selectedLeagueId);
  };

  const handleGameChange = (gameId: string | null) => {
    setSelectedGameId(gameId);
    void refresh(dateFrom, dateTo, gameId, selectedLeagueId);
  };

  const handleLeagueScopeChange = (leagueId: string | null) => {
    setSelectedLeagueId(leagueId);
    void refresh(dateFrom, dateTo, selectedGameId, leagueId);
  };

  const topPlayersPage = usePagination(data?.top_players ?? []);
  const atRiskPage = usePagination(data?.at_risk ?? []);
  const classificationPage = usePagination(data?.classification ?? []);

  if (roleLoading || (loading && !data)) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        {/* Header + filtros */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-2">
            <SkeletonLine width="w-20" height="h-3" />
            <SkeletonLine width="w-64" height="h-8" />
            <SkeletonLine width="w-48" height="h-4" />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <SkeletonBlock className="h-9 w-32 rounded-md" />
            <SkeletonBlock className="h-9 w-32 rounded-md" />
            <SkeletonBlock className="h-9 w-20 rounded-md" />
          </div>
        </div>

        {/* Filtros: liga + tcg */}
        <div className="flex flex-wrap items-end gap-3">
          <SkeletonBlock className="h-16 w-full max-w-[220px] rounded-md" />
          <SkeletonBlock className="h-16 w-full max-w-[220px] rounded-md" />
        </div>

        {/* Jugadores totales + Asistencias totales + Clasificación */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <SkeletonBlock className="h-40 rounded-2xl" />
            <SkeletonBlock className="h-40 rounded-2xl" />
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <SkeletonLine width="w-40" height="h-4" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Tendencia de asistencia */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <SkeletonLine width="w-40" height="h-4" />
          <SkeletonBlock className="h-64 w-full rounded-lg" />
        </div>

        {/* Desglose por TCG + Top jugadores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <SkeletonLine width="w-32" height="h-4" />
            <SkeletonBlock className="h-52 w-full rounded-lg" />
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <SkeletonLine width="w-28" height="h-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonLine key={i} width="w-full" height="h-6" />
            ))}
          </div>
        </div>

        {/* Jugadores en riesgo */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <SkeletonLine width="w-48" height="h-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLine key={i} width="w-full" height="h-6" />
          ))}
        </div>

        {/* Detalle por jugador */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <SkeletonLine width="w-40" height="h-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLine key={i} width="w-full" height="h-6" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No se pudo cargar la información. Asegúrate de tener una tienda asignada con torneos.
      </div>
    );
  }


  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary font-semibold">
            Analytics
          </p>
          <h1 className="text-2xl md:text-3xl font-bold">
            Estadísticas de tu tienda
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualiza la actividad y retención de tus jugadores.
          </p>
          <Link
            to="/organizer/players"
            className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
          >
            Ver detalle completo de jugadores →
          </Link>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="date-from" className="text-xs">Desde</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="[color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="date-to" className="text-xs">Hasta</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="[color-scheme:dark]"
            />
          </div>
          <Button onClick={handleApplyRange} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
          </Button>
        </div>
      </div>

      {/* Liga (Circuito Nacional vs. ligas internas, nunca se mezclan) + TCG */}
      <ScopeFilters
        availableLeagues={data.available_leagues}
        selectedLeagueId={selectedLeagueId}
        onLeagueChange={handleLeagueScopeChange}
        games={data.game_breakdown}
        selectedGameId={selectedGameId}
        onGameChange={handleGameChange}
      />

      {/* Jugadores totales + Asistencias totales + Clasificación de Jugadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="glass flex flex-col items-center justify-center rounded-2xl p-6">
            <Users size={28} className="mb-2 text-primary" />
            <div className="text-4xl font-bold text-white">{data.total_players}</div>
            <p className="mt-1 text-xs uppercase tracking-wider text-gray-400">
              Jugadores únicos en el periodo
            </p>
          </div>
          <div className="glass flex flex-col items-center justify-center rounded-2xl p-6">
            <Trophy size={28} className="mb-2 text-primary" />
            <div className="text-4xl font-bold text-white">{data.total_attendance}</div>
            <p className="mt-1 text-xs uppercase tracking-wider text-gray-400">
              Asistencias totales (todas las inscripciones)
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Clasificación de Jugadores</h2>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground" aria-label="Cómo se calculan">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-xs space-y-2">
                <p className="font-semibold">¿Cómo se calculan las categorías?</p>
                <p><span className="font-semibold text-green-500">Recurrente:</span> vino al menos una vez por semana, sin faltar ninguna semana del periodo.</p>
                <p><span className="font-semibold text-yellow-500">Ocasional:</span> jugó 2+ veces, pero con semanas sin actividad.</p>
                <p><span className="font-semibold text-blue-400">Una sola vez:</span> solo asistió una vez en el periodo.</p>
                <p><span className="font-semibold text-gray-400">Inactivo:</span> no ha venido en más de {data.settings.inactive_threshold_days} días.</p>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["recurrente", "ocasional", "una_vez", "inactivo"] as const).map((key) => (
              <div
                key={key}
                className="flex flex-col items-center justify-center rounded-lg border bg-card p-4 text-center"
                style={{ borderColor: `${CATEGORY_COLORS[key]}30` }}
              >
                <div
                  className="mb-2 flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${CATEGORY_COLORS[key]}20` }}
                >
                  <Users size={18} style={{ color: CATEGORY_COLORS[key] }} />
                </div>
                <p className="text-3xl font-bold text-white">{data.category_summary[key]}</p>
                <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABELS[key]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tendencia de asistencia */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-1">Tendencia de Asistencia</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Total de jugadores únicos por semana — si hubo más de un torneo esa semana, suma los de ambos sin
          duplicar jugadores repetidos.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.attendance_trend}>
            <defs>
              <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
            <XAxis dataKey="week_start" stroke="#d1d5db" fontSize={11} tick={{ fill: "#d1d5db" }} />
            <YAxis stroke="#d1d5db" fontSize={11} allowDecimals={false} tick={{ fill: "#d1d5db" }} />
            <Tooltip
              contentStyle={{
                background: "#1f2937",
                border: "1px solid #4b5563",
                borderRadius: 8,
                fontSize: 12,
                color: "#f9fafb",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: "#e5e7eb" }}
              cursor={{ stroke: "#f97316", strokeWidth: 1, strokeOpacity: 0.35 }}
              animationDuration={150}
              animationEasing="ease-out"
              labelFormatter={(label, payload) => {
                const count = payload?.[0]?.payload?.tournament_count ?? 0;
                const suffix = count > 1 ? ` · ${count} torneos esa semana` : count === 1 ? " · 1 torneo" : "";
                return `${label}${suffix}`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="players"
              name="Jugadores únicos"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#attendanceGradient)"
              isAnimationActive
              animationDuration={1000}
              activeDot={{ r: 6, style: { transition: "cx 150ms ease-out, cy 150ms ease-out" } }}
            />
            <Area
              type="monotone"
              dataKey="total_entries"
              name="Asistencias totales"
              stroke="#60a5fa"
              strokeWidth={2}
              fill="none"
              isAnimationActive
              animationDuration={1000}
              activeDot={{ r: 6, style: { transition: "cx 150ms ease-out, cy 150ms ease-out" } }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Jugadores nuevos vs. recurrentes por semana */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-1">Nuevos vs. Recurrentes</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Nuevo = primera vez que juega en esta tienda. Bajas (en negativo) = jugadores que cruzan el umbral de
          inactivo ({data.settings.inactive_threshold_days} días sin venir) esa semana.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.attendance_trend} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
            <XAxis dataKey="week_start" stroke="#d1d5db" fontSize={11} tick={{ fill: "#d1d5db" }} />
            <YAxis stroke="#d1d5db" fontSize={11} allowDecimals={false} tick={{ fill: "#d1d5db" }} />
            <ReferenceLine y={0} stroke="#ffffff70" strokeWidth={1.5} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#1f2937",
                border: "1px solid #4b5563",
                borderRadius: 8,
                fontSize: 12,
                color: "#f9fafb",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: "#e5e7eb" }}
              formatter={(value, name) => {
                const label = name === "new_players" ? "Nuevos" : name === "returning_players" ? "Recurrentes" : "Bajas";
                return [name === "churned_players" ? Math.abs(Number(value)) : value, label];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) =>
                value === "new_players" ? "Nuevos" : value === "returning_players" ? "Recurrentes" : "Bajas"
              }
            />
            <Bar
              dataKey="new_players"
              name="new_players"
              stackId="a"
              fill="#10B981"
              stroke="#065f46"
              strokeWidth={1}
              radius={[0, 0, 4, 4]}
            />
            <Bar
              dataKey="returning_players"
              name="returning_players"
              stackId="a"
              fill="#f97316"
              stroke="#9a3412"
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="churned_players"
              name="churned_players"
              stackId="a"
              fill="#ef4444"
              stroke="#7f1d1d"
              strokeWidth={1}
              radius={[0, 0, 4, 4]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Desglose por TCG + Top jugadores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Desglose por TCG</h2>
          {data.game_breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta tienda no tiene TCGs configurados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.game_breakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                <XAxis dataKey="game_name" stroke="#d1d5db" fontSize={11} tick={{ fill: "#d1d5db" }} />
                <YAxis stroke="#d1d5db" fontSize={11} allowDecimals={false} tick={{ fill: "#d1d5db" }} />
                <Tooltip
                  contentStyle={{
                    background: "#1f2937",
                    border: "1px solid #4b5563",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#f9fafb",
                    padding: "8px 12px",
                  }}
                  labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#e5e7eb" }}
                  cursor={false}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="players"
                  name="Jugadores únicos"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={800}
                  activeBar={{ fill: "#fb923c", stroke: "#fb923c" }}
                >
                  {data.game_breakdown.map((_, i) => (
                    <Cell key={i} fill="#f97316" style={{ fill: "#f97316" }} />
                  ))}
                </Bar>
                <Bar
                  dataKey="total_entries"
                  name="Asistencias totales"
                  fill="#60a5fa"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top jugadores */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Top Jugadores</h2>
          </div>
          {data.top_players.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Geek Tag</th>
                      <th className="text-right py-2 px-2">Torneos</th>
                      <th className="text-right py-2 px-2">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPlayersPage.pageItems.map((p, i) => (
                      <tr key={p.player_id} className="border-b last:border-0">
                        <td className="py-2 px-2 font-semibold">{(topPlayersPage.page - 1) * topPlayersPage.pageSize + i + 1}</td>
                        <td className="py-2 px-2">{p.geek_tag}</td>
                        <td className="py-2 px-2 text-right">{p.tournaments}</td>
                        <td className="py-2 px-2 text-right">{p.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager page={topPlayersPage.page} totalPages={topPlayersPage.totalPages} onPageChange={topPlayersPage.setPage} />
            </>
          )}
        </div>
      </div>

      {/* Jugadores en riesgo */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <h2 className="text-sm font-semibold">Jugadores en Riesgo</h2>
          <span className="text-xs text-muted-foreground">
            (más de {data.settings.at_risk_threshold_days} días sin venir)
          </span>
        </div>
        {data.at_risk.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay jugadores en riesgo actualmente.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Geek Tag</th>
                    <th className="text-right py-2 px-2">Días sin venir</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskPage.pageItems.map((p) => (
                    <tr key={p.player_id} className="border-b last:border-0">
                      <td className="py-2 px-2">{p.geek_tag}</td>
                      <td className="py-2 px-2 text-right">{p.days_since} días</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePager page={atRiskPage.page} totalPages={atRiskPage.totalPages} onPageChange={atRiskPage.setPage} />
          </>
        )}
      </div>

      {/* Tabla de clasificación completa */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Detalle por Jugador</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 px-2">Geek Tag</th>
                <th className="text-right py-2 px-2">Torneos (rango)</th>
                <th className="text-left py-2 px-2">Categoría (rango)</th>
                <th className="text-left py-2 px-2">Categoría (actual)</th>
                <th className="text-left py-2 px-2">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {classificationPage.pageItems.map((c) => (
                <tr key={c.player_id} className="border-b last:border-0">
                  <td className="py-2 px-2">{c.geek_tag}</td>
                  <td className="py-2 px-2 text-right">{c.tournaments_in_range}</td>
                  <td className="py-2 px-2">
                    <Badge variant="outline" style={{ borderColor: CATEGORY_COLORS[c.category_range], color: CATEGORY_COLORS[c.category_range] }}>
                      {CATEGORY_LABELS[c.category_range]}
                    </Badge>
                  </td>
                  <td className="py-2 px-2">
                    <Badge variant="outline" style={{ borderColor: CATEGORY_COLORS[c.category_current], color: CATEGORY_COLORS[c.category_current] }}>
                      {CATEGORY_LABELS[c.category_current]}
                    </Badge>
                  </td>
                  <td className="py-2 px-2">
                    {c.trend === "down" && (
                      <span className="inline-flex items-center gap-1 text-red-500 text-xs">
                        <TrendingDown className="h-3 w-3" /> Bajó
                      </span>
                    )}
                    {c.trend === "up" && (
                      <span className="inline-flex items-center gap-1 text-green-500 text-xs">
                        <TrendingUp className="h-3 w-3" /> Mejoró
                      </span>
                    )}
                    {c.trend === "same" && <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePager page={classificationPage.page} totalPages={classificationPage.totalPages} onPageChange={classificationPage.setPage} />
      </div>
    </div>
  );
}

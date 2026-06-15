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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { getStoreAnalytics } from "@/lib/geekarena-organizer.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/organizer/")({
  head: () => ({ meta: [{ title: "Analytics — Geek Arena" }] }),
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
  const { player, loading: roleLoading } = useGeekarenaRole();
  const fetchAnalytics = useServerFn(getStoreAnalytics);

  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const refresh = async (df?: string, dt?: string, gameId?: string | null) => {
    setLoading(true);
    try {
      const res = await fetchAnalytics({
        data: {
          date_from: df || undefined,
          date_to: dt || undefined,
          game_id: gameId || undefined,
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
    void refresh(dateFrom, dateTo, selectedGameId);
  };

  const handleTabChange = (gameId: string) => {
    const gid = gameId === "all" ? null : gameId;
    setSelectedGameId(gid);
    void refresh(dateFrom, dateTo, gid);
  };

  if (roleLoading || (loading && !data)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          Cargando experiencia personalizada...
        </p>
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

  const donutData = Object.entries(data.category_summary).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] ?? key,
    value,
    key,
  }));

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

      {/* Filtro por TCG */}
      {data.game_breakdown.length > 0 && (
        <Tabs value={selectedGameId ?? "all"} onValueChange={handleTabChange}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all">Todos</TabsTrigger>
            {data.game_breakdown.map((g) => (
              <TabsTrigger key={g.game_id} value={g.game_id}>
                {g.game_name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Jugadores totales + Desglose por TCG */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-6 flex flex-col items-center justify-center text-center">
          <Users className="h-8 w-8 text-primary mb-2" />
          <p className="text-5xl font-bold">{data.total_players}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Jugadores totales en el periodo
          </p>
        </div>

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
                  contentStyle={{ background: "#1f2937", border: "1px solid #ffffff30", fontSize: 12, color: "#fff" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Bar dataKey="players" name="Jugadores" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800}>
                  {data.game_breakdown.map((_, i) => (
                    <Cell key={i} fill="#f97316" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tendencia de asistencia */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Tendencia de Asistencia</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.attendance_trend}>
            <defs>
              <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week_start" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Area
              type="monotone"
              dataKey="players"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorAttendance)"
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Donut + Top jugadores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {donutData.map((entry) => (
                  <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] ?? "#888"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Geek Tag</th>
                    <th className="text-right py-2 px-2">Torneos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_players.map((p, i) => (
                    <tr key={p.player_id} className="border-b last:border-0">
                      <td className="py-2 px-2 font-semibold">{i + 1}</td>
                      <td className="py-2 px-2">{p.geek_tag}</td>
                      <td className="py-2 px-2 text-right">{p.tournaments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2">Geek Tag</th>
                  <th className="text-right py-2 px-2">Días sin venir</th>
                </tr>
              </thead>
              <tbody>
                {data.at_risk.map((p) => (
                  <tr key={p.player_id} className="border-b last:border-0">
                    <td className="py-2 px-2">{p.geek_tag}</td>
                    <td className="py-2 px-2 text-right">{p.days_since} días</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              {data.classification.map((c) => (
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
      </div>
    </div>
  );
}

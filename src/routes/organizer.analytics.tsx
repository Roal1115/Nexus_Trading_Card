import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  PLAYER_STATUS_COLORS,
  PLAYER_STATUS_HELP,
  PLAYER_STATUS_LABELS,
  PLAYER_STATUSES,
} from "@/lib/player-status";
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
  Legend,
  ReferenceLine,
} from "recharts";
import { Link } from "@tanstack/react-router";
import { attendanceArea } from "@/components/organizer/attendance-area";
import { AXIS, CHART, TOOLTIP } from "@/components/organizer/chart-theme";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { getStoreAnalytics, getStorePageViewAnalytics } from "@/lib/nexus-organizer.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScopeFilters } from "@/components/organizer/scope-filters";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";
import { BTN_OUTLINE, FOCUS_RING, SECTION } from "@/components/stores/store-ui";

export const Route = createFileRoute("/organizer/analytics")({
  head: () => ({ meta: [{ title: "Estadísticas — Nexus" }] }),
  component: OrganizerAnalytics,
});

type AnalyticsResult = Awaited<ReturnType<typeof getStoreAnalytics>>;

type PageViewResult = Awaited<ReturnType<typeof getStorePageViewAnalytics>>;

// "3 sep"; con año solo si no es el actual.
const fmtDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
};

// Fila de dato secundario: label 12px sobre cifra mono (Stat Row, sin tiles ni íconos).
function Stat({ label, value, lead }: { label: string; value: number; lead?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-foreground-secondary">{label}</dt>
      <dd
        className={`mt-1 font-mono-stat font-bold ${lead ? "text-3xl text-warning @2xl:text-4xl" : "text-2xl text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StorePageViewsCard() {
  const fetchPageViews = useServerFn(getStorePageViewAnalytics);
  const [data, setData] = useState<PageViewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchPageViews({ data: { days: 30 } })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setError((e as Error)?.message || "No se pudieron cargar las visitas.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPageViews]);

  return (
    <section className={SECTION}>
      <h2 className="text-xl font-semibold">Marketing</h2>
      <p className="mt-1 text-xs text-foreground-subtle">
        Últimos {data?.days ?? 30} días en la página pública de tu tienda.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-muted-foreground">{error}</p>
      ) : data === null ? (
        <SkeletonBlock className="mt-4 h-40 rounded-md" />
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 @2xl:grid-cols-3">
            <Stat label="Visitas al perfil de tienda" value={data.profile_views} />
            <Stat label="Visualizaciones de marketing" value={data.promo_views} />
            <Stat label="Clics en tu promo" value={data.promo_clicks} />
          </dl>
          {data.promo_views === 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground-secondary">
              <p>Aún no hay visualizaciones de marketing. Publica una promo para tu tienda.</p>
              <Link to="/organizer/store" className={BTN_OUTLINE}>
                Ir a Mi tienda →
              </Link>
            </div>
          )}
          <p className="mt-6 text-sm font-medium text-foreground-secondary">
            Qué secciones visitan
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.by_section} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...AXIS} />
              <YAxis type="category" dataKey="label" width={150} {...AXIS} />
              <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar
                dataKey="views"
                name="Vistas"
                fill={CHART.primary}
                radius={[0, 4, 4, 0]}
                isAnimationActive
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  );
}

function OrganizerAnalytics() {
  const { player, loading: roleLoading } = useNexusRole();
  const fetchAnalytics = useServerFn(getStoreAnalytics);

  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);

  const refresh = async (
    df?: string,
    dt?: string,
    gameId?: string | null,
    leagueId?: string | null,
  ) => {
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

  if (roleLoading || (loading && !data)) {
    return (
      <div className="@container mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* Header + filtros */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-2">
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

        {/* Estado de jugadores + En el periodo */}
        {[0, 1].map((i) => (
          <div key={i} className={`${SECTION} space-y-4`}>
            <SkeletonLine width="w-56" height="h-6" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 @2xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <SkeletonBlock key={j} className="h-14 rounded-md" />
              ))}
            </div>
          </div>
        ))}

        {/* Gráficas: tendencia, nuevos y recurrentes, visitas, TCG */}
        {["h-64", "h-52", "h-40", "h-52"].map((h, i) => (
          <div key={i} className={`${SECTION} space-y-3`}>
            <SkeletonLine width="w-40" height="h-6" />
            <SkeletonBlock className={`${h} w-full rounded-md`} />
          </div>
        ))}
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
    <div className="@container mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Estadísticas de tu tienda</h1>
          <p className="text-sm text-muted-foreground">
            Visualiza la actividad y retención de tus jugadores.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="date-from" className="text-xs">
              Desde
            </Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="[color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="date-to" className="text-xs">
              Hasta
            </Label>
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

      {/* Estado de jugadores: lo accionable va primero ("Por recuperar") */}
      <section className={SECTION}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Estado de tus jugadores</h2>
            <p className="mt-1 text-sm text-foreground-secondary">
              A fecha de hoy; no cambia con el rango de fechas.
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground-subtle hover:text-foreground sm:h-9 sm:w-9 ${FOCUS_RING}`}
                aria-label="Cómo se calcula cada estado"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-xs space-y-2">
              <p className="font-semibold">¿Cómo se calcula cada estado?</p>
              {PLAYER_STATUSES.map((s) => (
                <p key={s}>
                  <span className="font-semibold" style={{ color: PLAYER_STATUS_COLORS[s] }}>
                    {PLAYER_STATUS_LABELS[s]}:
                  </span>{" "}
                  {PLAYER_STATUS_HELP[s]}
                </p>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 @2xl:grid-cols-4">
          <Stat
            lead
            label={PLAYER_STATUS_LABELS.por_recuperar}
            value={data.category_summary.por_recuperar}
          />
          {PLAYER_STATUSES.filter((s) => s !== "por_recuperar").map((s) => (
            <Stat key={s} label={PLAYER_STATUS_LABELS[s]} value={data.category_summary[s]} />
          ))}
        </dl>
        <Link to="/organizer/players" className={`${BTN_OUTLINE} mt-4`}>
          Ver mis jugadores →
        </Link>
      </section>

      {/* Cifras del periodo elegido arriba */}
      <section className={SECTION}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-xl font-semibold">En el periodo</h2>
          <p className="font-mono-stat text-sm text-foreground-subtle">
            {fmtDay(data.range.start)} – {fmtDay(data.range.end)}
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 @2xl:grid-cols-4">
          <Stat label="Jugadores únicos en el periodo" value={data.total_players} />
          <Stat
            label="Asistencias totales (todas las inscripciones)"
            value={data.total_attendance}
          />
          <Stat label="Jugadores por torneo (promedio)" value={data.avg_players_per_tournament} />
          <Stat label="Puntos por jugador (promedio)" value={data.avg_points_per_player} />
        </dl>
      </section>

      {/* Tendencia de asistencia */}
      <div className={SECTION}>
        <h2 className="text-xl font-semibold mb-1">Tendencia de Asistencia</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Total de jugadores únicos por semana — si hubo más de un torneo esa semana, suma los de
          ambos sin duplicar jugadores repetidos.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.attendance_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis dataKey="week_start" {...AXIS} />
            <YAxis allowDecimals={false} {...AXIS} />
            <Tooltip
              {...TOOLTIP}
              cursor={{ stroke: CHART.primary, strokeWidth: 1, strokeOpacity: 0.35 }}
              animationDuration={150}
              animationEasing="ease-out"
              labelFormatter={(label, payload) => {
                const count = payload?.[0]?.payload?.tournament_count ?? 0;
                const suffix =
                  count > 1 ? ` · ${count} torneos esa semana` : count === 1 ? " · 1 torneo" : "";
                return `${label}${suffix}`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {attendanceArea({
              name: "Jugadores únicos",
              isAnimationActive: true,
              animationDuration: 1000,
              activeDot: { r: 6, style: { transition: "cx 150ms ease-out, cy 150ms ease-out" } },
            })}
            <Area
              type="monotone"
              dataKey="total_entries"
              name="Asistencias totales"
              stroke={CHART.muted}
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="none"
              isAnimationActive
              animationDuration={1000}
              activeDot={{ r: 6, style: { transition: "cx 150ms ease-out, cy 150ms ease-out" } }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Jugadores nuevos vs. los que regresan por semana */}
      <div className={SECTION}>
        <h2 className="text-xl font-semibold mb-1">Nuevos y los que regresan</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Nuevo = primera vez que juega en esta tienda. Bajas (en negativo) = jugadores que esa
          semana cumplen 3 torneos de la tienda sin venir (pasan a "Por recuperar").
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.attendance_trend} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="week_start" {...AXIS} />
            <YAxis allowDecimals={false} {...AXIS} />
            <ReferenceLine y={0} stroke="var(--foreground-subtle)" strokeWidth={1.5} />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              formatter={(value, name) => {
                const label =
                  name === "new_players"
                    ? "Nuevos"
                    : name === "returning_players"
                      ? "Recurrentes"
                      : "Bajas";
                return [name === "churned_players" ? Math.abs(Number(value)) : value, label];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) =>
                value === "new_players"
                  ? "Nuevos"
                  : value === "returning_players"
                    ? "Recurrentes"
                    : "Bajas"
              }
            />
            <Bar
              dataKey="new_players"
              name="new_players"
              stackId="a"
              fill={CHART.primary}
              radius={[0, 0, 4, 4]}
            />
            <Bar
              dataKey="returning_players"
              name="returning_players"
              stackId="a"
              fill={CHART.muted}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="churned_players"
              name="churned_players"
              stackId="a"
              fill={CHART.warning}
              radius={[0, 0, 4, 4]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Visitas a la página pública de la tienda */}
      <StorePageViewsCard />

      {/* Desglose por TCG */}
      <div>
        <div className={SECTION}>
          <h2 className="text-xl font-semibold mb-3">Desglose por TCG</h2>
          {data.game_breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta tienda no tiene TCGs configurados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.game_breakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="game_name" {...AXIS} />
                <YAxis allowDecimals={false} {...AXIS} />
                <Tooltip {...TOOLTIP} cursor={false} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="players"
                  name="Jugadores únicos"
                  fill={CHART.primary}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={800}
                />
                <Bar
                  dataKey="total_entries"
                  name="Asistencias totales"
                  fill={CHART.muted}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

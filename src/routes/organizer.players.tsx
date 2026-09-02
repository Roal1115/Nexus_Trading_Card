import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Trophy, Users, Star } from "lucide-react";
import { toast } from "sonner";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { usePagination } from "@/hooks/use-pagination";
import { getStoreAnalytics } from "@/lib/nexus-organizer.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TablePager } from "@/components/ui/table-pager";
import { ScopeFilters } from "@/components/organizer/scope-filters";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/organizer/players")({
  head: () => ({ meta: [{ title: "Jugadores — Nexus" }] }),
  component: OrganizerPlayersPage,
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

function OrganizerPlayersPage() {
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
        <div className="space-y-2">
          <SkeletonLine width="w-20" height="h-3" />
          <SkeletonLine width="w-64" height="h-8" />
        </div>
        <SkeletonBlock className="h-64 w-full rounded-lg" />
        <SkeletonBlock className="h-64 w-full rounded-lg" />
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
          <p className="text-xs uppercase tracking-wider text-primary font-semibold">Jugadores</p>
          <h1 className="text-2xl md:text-3xl font-bold">Detalle de jugadores</h1>
          <p className="text-sm text-muted-foreground">
            Top jugadores, en riesgo y clasificación completa — misma info del dashboard, sin recorte.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="players-date-from" className="text-xs">Desde</Label>
            <Input
              id="players-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="[color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="players-date-to" className="text-xs">Hasta</Label>
            <Input
              id="players-date-to"
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

      {/* Promedios */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Users className="h-4 w-4 text-primary" />
            Jugadores promedio por torneo
          </div>
          <div className="mt-2 text-3xl font-bold">{data.avg_players_per_tournament}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Star className="h-4 w-4 text-primary" />
            Puntos por jugador en tienda
          </div>
          <div className="mt-2 text-3xl font-bold">{data.avg_points_per_player}</div>
        </div>
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

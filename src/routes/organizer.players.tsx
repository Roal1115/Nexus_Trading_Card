import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadError } from "@/components/panel/dashboard";
import { errMsg } from "@/components/panel/dashboard-format";
import { PlayersBrowser, PlayersSkeleton } from "@/components/panel/players";
import { ScopeFilters } from "@/components/organizer/scope-filters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { getStoreAnalytics } from "@/lib/nexus-organizer.functions";

export const Route = createFileRoute("/organizer/players")({
  head: () => ({ meta: [{ title: "Jugadores — Nexus" }] }),
  component: OrganizerPlayersPage,
});

type AnalyticsResult = Awaited<ReturnType<typeof getStoreAnalytics>>;

function OrganizerPlayersPage() {
  const { player, loading: roleLoading } = useNexusRole();
  const fetchAnalytics = useServerFn(getStoreAnalytics);

  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
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
      const message = errMsg(e);
      setLoadError(message);
      if (data) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!player) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const header = (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Mi tienda</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Jugadores</h1>
      <p className="mt-1 text-sm text-gray-400">
        Quién viene a tu tienda y a quién conviene recuperar.
      </p>
    </header>
  );

  if (loadError && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="glass rounded-2xl">
          <LoadError message={loadError} onRetry={() => void refresh()} />
        </div>
      </div>
    );
  }

  if (roleLoading || !data) return <PlayersSkeleton header={header} />;

  const changeDate = (which: "from" | "to", value: string) => {
    const from = which === "from" ? value : dateFrom;
    const to = which === "to" ? value : dateTo;
    setDateFrom(from);
    setDateTo(to);
    if (from && to) void refresh(from, to, selectedGameId, selectedLeagueId);
  };

  return (
    <div className="space-y-4">
      {header}
      <PlayersBrowser
        players={data.classification}
        summary={data.category_summary}
        busy={loading}
        linkTo="/organizer/players/$playerId"
        filters={
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="players-date-from" className="text-xs text-muted-foreground">
                  Desde
                </Label>
                <Input
                  id="players-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => changeDate("from", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="players-date-to" className="text-xs text-muted-foreground">
                  Hasta
                </Label>
                <Input
                  id="players-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => changeDate("to", e.target.value)}
                />
              </div>
            </div>
            {/* Liga (Circuito Nacional vs. ligas internas, nunca se mezclan) + TCG */}
            <ScopeFilters
              availableLeagues={data.available_leagues}
              selectedLeagueId={selectedLeagueId}
              onLeagueChange={(leagueId) => {
                setSelectedLeagueId(leagueId);
                void refresh(dateFrom, dateTo, selectedGameId, leagueId);
              }}
              games={data.game_breakdown}
              selectedGameId={selectedGameId}
              onGameChange={(gameId) => {
                setSelectedGameId(gameId);
                void refresh(dateFrom, dateTo, gameId, selectedLeagueId);
              }}
            />
            <p className="text-xs text-gray-500">
              Las fechas cambian los torneos y puntos que ves. El estado siempre es a fecha de hoy.
            </p>
          </>
        }
      />
    </div>
  );
}

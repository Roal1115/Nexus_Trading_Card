import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadError } from "@/components/panel/dashboard";
import { errMsg } from "@/components/panel/dashboard-format";
import { PlayersBrowser, PlayersSkeleton } from "@/components/panel/players";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getManagerPlayers } from "@/lib/nexus-manager.functions";

export const Route = createFileRoute("/tcg-manager/players")({
  head: () => ({ meta: [{ title: "Jugadores — TCG Manager" }] }),
  component: ManagerPlayersPage,
});

type Result = Awaited<ReturnType<typeof getManagerPlayers>>;

function ManagerPlayersPage() {
  const fetchPlayers = useServerFn(getManagerPlayers);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = async (gameId?: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await fetchPlayers({ data: { game_id: gameId } }));
    } catch (e) {
      const message = errMsg(e);
      setLoadError(message);
      if (data) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Red</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Jugadores</h1>
      <p className="mt-1 text-sm text-gray-400">
        Quién juega tus TCGs en todas las tiendas y a quién conviene recuperar.
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

  if (!data) return <PlayersSkeleton header={header} />;

  return (
    <div className="space-y-4">
      {header}
      <PlayersBrowser
        players={data.players}
        summary={data.summary}
        busy={loading}
        linkTo="/tcg-manager/players/$playerId"
        filters={
          <div className="max-w-xs space-y-1">
            <Label htmlFor="players-game" className="text-xs text-muted-foreground">
              TCG
            </Label>
            <Select value={data.game_id ?? undefined} onValueChange={(v) => void refresh(v)}>
              <SelectTrigger id="players-game">
                <SelectValue placeholder="Sin TCGs asignados" />
              </SelectTrigger>
              <SelectContent>
                {data.games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}

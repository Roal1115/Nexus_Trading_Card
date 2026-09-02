import { Label } from "@/components/ui/label";
import { BlockSelect } from "@/components/ui/block-select";

// Barra de filtros de alcance: Liga (Circuito Nacional vs. liga interna) y TCG.
// Antes eran dos <Tabs> apiladas con el mismo look — en desktop se leían como
// un solo control de dos filas. Ahora son dos selects lado a lado, cada uno
// con su label, así queda claro que son dos dimensiones de filtro distintas.
export function ScopeFilters({
  availableLeagues,
  selectedLeagueId,
  onLeagueChange,
  games,
  selectedGameId,
  onGameChange,
}: {
  availableLeagues: Array<{ id: string; name: string }>;
  selectedLeagueId: string | null;
  onLeagueChange: (leagueId: string | null) => void;
  games: Array<{ game_id: string; game_name: string }>;
  selectedGameId: string | null;
  onGameChange: (gameId: string | null) => void;
}) {
  if (availableLeagues.length === 0 && games.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-3">
      {availableLeagues.length > 0 && (
        <div className="w-full max-w-[220px] space-y-1">
          <Label className="text-xs text-muted-foreground">Liga</Label>
          <BlockSelect
            value={selectedLeagueId}
            onChange={onLeagueChange}
            placeholder="Circuito Nacional"
            options={availableLeagues.map((l) => ({ value: l.id, label: l.name }))}
          />
        </div>
      )}
      {games.length > 0 && (
        <div className="w-full max-w-[220px] space-y-1">
          <Label className="text-xs text-muted-foreground">TCG</Label>
          <BlockSelect
            value={selectedGameId}
            onChange={onGameChange}
            placeholder="Todos los TCG"
            options={games.map((g) => ({ value: g.game_id, label: g.game_name }))}
          />
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PlayerStaffView } from "@/components/panel/players";
import { getManagerPlayerDetail } from "@/lib/nexus-manager.functions";

export const Route = createFileRoute("/tcg-manager/players_/$playerId")({
  head: () => ({ meta: [{ title: "Jugador — Nexus" }] }),
  component: ManagerPlayerDetailPage,
});

function ManagerPlayerDetailPage() {
  const { playerId } = Route.useParams();
  const fetchDetail = useServerFn(getManagerPlayerDetail);
  return (
    <PlayerStaffView
      load={() => fetchDetail({ data: { player_id: playerId } })}
      reloadKey={playerId}
      backTo="/tcg-manager/players"
      tournamentTo="/tcg-manager/tournaments/$id"
      subtitle="Lo que ha jugado en tus TCGs."
    />
  );
}

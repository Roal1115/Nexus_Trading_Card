import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PlayerStaffView } from "@/components/panel/players";
import { getOrganizerPlayerDetail } from "@/lib/nexus-organizer.functions";

export const Route = createFileRoute("/organizer/players_/$playerId")({
  head: () => ({ meta: [{ title: "Jugador — Nexus" }] }),
  component: OrganizerPlayerDetailPage,
});

function OrganizerPlayerDetailPage() {
  const { playerId } = Route.useParams();
  const fetchDetail = useServerFn(getOrganizerPlayerDetail);
  return (
    <PlayerStaffView
      load={() => fetchDetail({ data: { player_id: playerId } })}
      reloadKey={playerId}
      backTo="/organizer/players"
      tournamentTo="/organizer/tournaments/$id"
      subtitle="Lo que ha jugado en tu tienda."
    />
  );
}

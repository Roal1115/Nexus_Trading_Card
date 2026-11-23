import { createFileRoute } from "@tanstack/react-router";
import { TournamentUploadForm } from "@/components/upload/TournamentUploadForm";

export const Route = createFileRoute("/organizer/new")({
  // Desde un torneo atrasado del inicio llegan el TCG y la fecha ya sabidos.
  validateSearch: (s: Record<string, unknown>): { game?: string; date?: string } => ({
    game: typeof s.game === "string" ? s.game : undefined,
    date: typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : undefined,
  }),
  head: () => ({ meta: [{ title: "Subir torneo — Organizador" }] }),
  component: NewTournament,
});

function NewTournament() {
  const { game, date } = Route.useSearch();
  return (
    <TournamentUploadForm
      cancelTo="/organizer/tournaments"
      successTo="/organizer/tournaments"
      successSearch={{ tab: "pending" }}
      initialGameId={game}
      initialDate={date}
    />
  );
}

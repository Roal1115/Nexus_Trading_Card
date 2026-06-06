import { createFileRoute } from "@tanstack/react-router";
import { TournamentUploadForm } from "@/components/upload/TournamentUploadForm";

export const Route = createFileRoute("/organizer/new")({
  component: () => (
    <TournamentUploadForm
      cancelTo="/organizer/tournaments"
      successTo="/organizer/tournaments"
    />
  ),
});

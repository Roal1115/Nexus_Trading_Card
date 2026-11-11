import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { TournamentUploadForm } from "@/components/upload/TournamentUploadForm";
import { getManagerGames } from "@/lib/nexus-manager.functions";
import { SettingsSectionSkeleton } from "@/components/ui/skeleton-loader";

type Game = { id: string; slug: string; name: string };

export const Route = createFileRoute("/tcg-manager/upload")({
  head: () => ({ meta: [{ title: "Subir Torneo — Nexus" }] }),
  component: TcgManagerUploadPage,
});

function TcgManagerUploadPage() {
  const { role, loading } = useNexusRole();
  const navigate = useNavigate();
  const fetchManagerGames = useServerFn(getManagerGames);
  const [managerGames, setManagerGames] = useState<Game[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (role !== "tcg_manager" && role !== "admin") {
      navigate({ to: "/login" });
    }
  }, [loading, role, navigate]);

  useEffect(() => {
    if (role !== "tcg_manager") return;
    fetchManagerGames({} as any)
      .then((res: any) => setManagerGames((res ?? []) as Game[]))
      .catch(() => setManagerGames([]));
  }, [role, fetchManagerGames]);

  if (loading) {
    return <SettingsSectionSkeleton />;
  }
  if (role !== "tcg_manager" && role !== "admin") return null;

  if (role === "tcg_manager" && managerGames === null) {
    return <SettingsSectionSkeleton />;
  }

  return (
    <TournamentUploadForm
      cancelTo="/tcg-manager"
      successTo="/tcg-manager"
      gamesOverride={role === "tcg_manager" ? managerGames ?? [] : undefined}
    />
  );
}

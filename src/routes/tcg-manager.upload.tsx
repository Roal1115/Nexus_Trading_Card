import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { TournamentUploadForm } from "@/components/upload/TournamentUploadForm";
import { getManagerGames } from "@/lib/geekarena-manager.functions";

type Game = { id: string; slug: string; name: string };

export const Route = createFileRoute("/tcg-manager/upload")({
  head: () => ({ meta: [{ title: "Subir Torneo — Geek Arena" }] }),
  component: TcgManagerUploadPage,
});

function TcgManagerUploadPage() {
  const { role, loading } = useGeekarenaRole();
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
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (role !== "tcg_manager" && role !== "admin") return null;

  if (role === "tcg_manager" && managerGames === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TournamentUploadForm
      cancelTo="/tcg-manager"
      successTo="/tcg-manager"
      gamesOverride={role === "tcg_manager" ? managerGames ?? [] : undefined}
    />
  );
}

import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { TournamentUploadForm } from "@/components/upload/TournamentUploadForm";

export const Route = createFileRoute("/tcg-manager/upload")({
  head: () => ({ meta: [{ title: "Subir Torneo — Geek Arena" }] }),
  component: TcgManagerUploadPage,
});

function TcgManagerUploadPage() {
  const { role, loading } = useGeekarenaRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role !== "tcg_manager" && role !== "admin") {
      navigate({ to: "/login" });
    }
  }, [loading, role, navigate]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (role !== "tcg_manager" && role !== "admin") return null;

  return <TournamentUploadForm cancelTo="/tcg-manager" successTo="/tcg-manager" />;
}

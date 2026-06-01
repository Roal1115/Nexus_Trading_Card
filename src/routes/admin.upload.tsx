import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { TournamentUploadForm } from "@/components/upload/TournamentUploadForm";

export const Route = createFileRoute("/admin/upload")({
  head: () => ({ meta: [{ title: "Subir Torneo — Geek Arena" }] }),
  component: AdminUploadPage,
});

function AdminUploadPage() {
  const { role, loading } = useGeekarenaRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role !== "admin") {
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
  if (role !== "admin") return null;

  return <TournamentUploadForm cancelTo="/admin" successTo="/admin" />;
}

import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { TournamentUploadForm } from "@/components/upload/TournamentUploadForm";
import { SettingsSectionSkeleton } from "@/components/ui/skeleton-loader";

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
    return <SettingsSectionSkeleton />;
  }
  if (role !== "admin") return null;

  return <TournamentUploadForm cancelTo="/admin" successTo="/admin" />;
}

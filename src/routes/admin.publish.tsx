import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/admin/publish")({
  component: PublishPage,
});

function PublishPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Publicación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Publicar Manualmente
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          La publicación de torneos aprobados se realiza desde la vista de
          Torneos Aprobados.
        </p>
      </header>
      <div className="glass flex items-center gap-3 rounded-2xl p-6 text-sm text-gray-300">
        <Upload className="text-primary" size={18} />
        <span>
          Ve a{" "}
          <Link to="/admin/approved" className="text-primary underline">
            Torneos Aprobados
          </Link>{" "}
          para seleccionar y publicar. El leaderboard se recalcula
          automáticamente al publicar.
        </span>
      </div>
    </div>
  );
}

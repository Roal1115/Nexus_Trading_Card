import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Moderación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Torneos Pendientes
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Aprueba o rechaza torneos enviados por los organizadores.
        </p>
      </header>

      <div className="glass flex items-center gap-3 rounded-2xl p-8 text-sm text-gray-400">
        <ShieldCheck className="text-primary" size={18} />
        Vista en construcción — se conectará en la Fase 3.
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";

export const Route = createFileRoute("/organizer/")({
  component: OrganizerHome,
});

function OrganizerHome() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Mi Tienda
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Información de tu tienda
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Aquí podrás editar el nombre, ciudad y estado de tu tienda.
        </p>
      </header>

      <div className="glass flex items-center gap-3 rounded-2xl p-8 text-sm text-gray-400">
        <Store className="text-primary" size={18} />
        Vista en construcción — se conectará en la Fase 2.
      </div>
    </div>
  );
}

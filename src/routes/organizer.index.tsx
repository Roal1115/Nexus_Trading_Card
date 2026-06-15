import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/organizer/")({
  component: OrganizerDashboard,
});

function OrganizerDashboard() {
  return (
    <div className="flex h-64 items-center justify-center text-gray-400 text-sm">
      <Loader2 className="animate-spin text-primary mr-2" />
      Cargando dashboard...
    </div>
  );
}

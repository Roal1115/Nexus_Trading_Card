import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type StateTone } from "@/lib/tournament-state";
import { statusPresentation, type StatusAudience } from "@/components/admin/status-presentation";

const TONE_CLASSES: Record<StateTone, string> = {
  warning: "bg-yellow-500/20 text-yellow-200 border-yellow-400/40",
  danger: "bg-red-500/20 text-red-200 border-red-400/40",
  info: "bg-sky-500/20 text-sky-200 border-sky-400/40",
  success: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  neutral: "bg-white/10 text-gray-200 border-white/20",
};

/**
 * Estado del torneo derivado del lifecycle (tournament-state.ts), igual en
 * listas y detalle. Si está rechazado, el motivo aparece en un tooltip.
 */
export function TournamentStatusBadge({
  status,
  rejectionReason,
  size = "md",
  audience = "reviewer",
}: {
  status: string | null;
  rejectionReason?: string | null;
  size?: "sm" | "md";
  /** "uploader" (organizador): "En revisión" / "Aprobado". Ver status-presentation.ts. */
  audience?: StatusAudience;
}) {
  const p = statusPresentation(status, rejectionReason, audience);
  const cls = `inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold ${
    size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
  } ${TONE_CLASSES[p.tone]}`;

  if (!rejectionReason || status !== "DRAFT") return <span className={cls}>{p.label}</span>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={`${cls} cursor-help`}>
            {p.label} <Info size={10} aria-hidden />
            <span className="sr-only">. Motivo: {rejectionReason}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-semibold">Motivo:</p>
          <p className="mt-1 text-xs">{rejectionReason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Presentación del estado de un torneo según quién lo mira. Solo cambia el
// texto: el estado sale siempre de deriveState (tournament-state.ts), sin
// estados nuevos. Quien revisa (admin, TCG manager) ve "Por revisar"; quien
// sube (organizador) ve "En revisión" y "Aprobado".
import {
  deriveState,
  STATE_PRESENTATION,
  type StateTone,
  type TournamentState,
} from "@/lib/tournament-state";

export type StatusAudience = "reviewer" | "uploader";

const UPLOADER_LABELS: Partial<Record<TournamentState, string>> = {
  review: "En revisión",
  approved: "Aprobado",
};

export function statusPresentation(
  status: string | null,
  rejectionReason: string | null | undefined,
  audience: StatusAudience = "reviewer",
): { state: TournamentState; label: string; tone: StateTone } {
  const state = deriveState({ status: status ?? "", rejection_reason: rejectionReason ?? null });
  const { label, tone } = STATE_PRESENTATION[state];
  return { state, tone, label: (audience === "uploader" && UPLOADER_LABELS[state]) || label };
}

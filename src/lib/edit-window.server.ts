import { failDb } from "./nexus-admin.server";
import { EDIT_WINDOW_CLOSED_MESSAGE, editWindow } from "./round-rules";

// Lanza si el plazo de 7 días para editar rondas de este torneo ya cerró.
export async function assertEditWindow(admin: any, tournamentId: string): Promise<void> {
  const { data, error } = await admin
    .from("tournaments")
    .select("approved_at, published_at")
    .eq("id", tournamentId)
    .single();
  if (error) failDb(error);
  if (!editWindow(data, new Date()).open) throw new Error(EDIT_WINDOW_CLOSED_MESSAGE);
}

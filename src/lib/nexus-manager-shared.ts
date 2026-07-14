// Helpers compartidos entre los sub-archivos de manager.
export async function getManagerGameIds(
  admin: any,
  player: { id: string; role: string },
): Promise<string[]> {
  if (player.role === "admin") {
    const { data } = await admin.from("games").select("id").eq("is_active", true);
    return (data ?? []).map((g: any) => g.id);
  }
  const { data } = await admin.from("manager_games").select("game_id").eq("player_id", player.id);
  return (data ?? []).map((d: any) => d.game_id);
}

export async function assertManagerOwnsGame(
  admin: any,
  player: { id: string; role: string },
  game_id: string,
) {
  if (player.role === "admin") return;
  const { data: mg } = await admin
    .from("manager_games")
    .select("id")
    .eq("player_id", player.id)
    .eq("game_id", game_id)
    .maybeSingle();
  if (!mg) throw new Error("No tienes permiso para este TCG");
}

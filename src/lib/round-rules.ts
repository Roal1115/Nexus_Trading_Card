// Reglas de rondas compartidas por el tracker y el vínculo de sesiones.
// El sistema de puntos es 3-1-0: cada victoria vale 3 match points.
export const maxWinsFor = (matchPoints: number | null | undefined) =>
  Math.floor((matchPoints ?? 0) / 3);

// Devuelve por qué una sesión no se puede vincular a un torneo, o null si se puede.
export function sessionLinkProblem({
  rounds,
  matchPoints,
  maxRounds,
  takenRounds,
}: {
  rounds: Array<{ round_number: number; won_match: boolean | null }>;
  matchPoints: number | null | undefined;
  maxRounds: number;
  // Lo ya registrado en ese torneo: los límites cuentan sesión + registrado.
  takenRounds: Array<{ round_number: number; won_match: boolean | null }>;
}): string | null {
  const taken = new Set(takenRounds.map((r) => r.round_number));
  const clashes = rounds.map((r) => r.round_number).filter((n) => taken.has(n));
  if (clashes.length > 0) {
    return `Ya hay resultados registrados para la ronda ${clashes.sort((a, b) => a - b).join(", ")} de este torneo. Elimina esas rondas de tu partida antes de vincular.`;
  }
  const wins = [...rounds, ...takenRounds].filter((r) => r.won_match === true).length;
  const maxWins = maxWinsFor(matchPoints);
  if (wins > maxWins) {
    return `Sumarías ${wins} victorias, pero en este torneo tuviste ${maxWins}. Corrige tus rondas antes de vincular.`;
  }
  const tooHigh = rounds.find((r) => r.round_number > maxRounds);
  if (maxRounds > 0 && tooHigh) {
    return `Este torneo tuvo ${maxRounds} rondas y tu partida llega a la ronda ${tooHigh.round_number}. Corrige tus rondas antes de vincular.`;
  }
  return null;
}

// Una ronda jugada (no Bye) necesita el leader propio y el del rival.
export function roundLeadersProblem(r: {
  is_bye: boolean;
  player_leader_id?: string | null;
  opponent_leader_id?: string | null;
}): string | null {
  if (r.is_bye) return null;
  if (!r.player_leader_id) return "Selecciona tu leader para guardar la ronda";
  if (!r.opponent_leader_id) return "Selecciona el leader del oponente para guardar la ronda";
  return null;
}

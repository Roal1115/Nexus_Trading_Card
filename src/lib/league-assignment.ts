// Circuito y ligas de un torneo. `league_id` null = cuenta para el circuito;
// las ligas viven en store_league_tournaments. Check: scripts/league-assignment.check.mts

export function assignLeagues(input: {
  counts_for_circuit: boolean;
  league_ids: string[];
}): { league_id: string | null; link_ids: string[] } | { error: string } {
  const link_ids = [...new Set(input.league_ids)];
  if (input.counts_for_circuit) return { league_id: null, link_ids };
  if (!link_ids.length) return { error: "Elige el Circuito Nacional o al menos una liga" };
  return { league_id: link_ids[0], link_ids };
}

// Liga principal tras quitar vínculos. Un torneo de solo ligas nunca queda en
// null: eso lo volvería de circuito sin revisión.
export function nextPrimaryLeague(
  current: string | null,
  remaining: string[],
): { league_id: string | null } | { blocked: true } {
  if (current === null || remaining.includes(current)) return { league_id: current };
  if (!remaining.length) return { blocked: true };
  return { league_id: remaining[0] };
}

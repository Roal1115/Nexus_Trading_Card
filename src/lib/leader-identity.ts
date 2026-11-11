export type LeaderIdentityRow = {
  id: string;
  card_set_id: string | null;
  card_image_id?: string | null;
  canonical_leader_id: string | null;
};

/** Todas las impresiones de una carta comparten identidad estadística. */
export function createLeaderIdentityResolver<T extends LeaderIdentityRow>(rows: T[]) {
  const leaderMap = new Map(rows.map((row) => [row.id, row]));
  const rowsByCardSet = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.card_set_id) continue;
    const group = rowsByCardSet.get(row.card_set_id) ?? [];
    group.push(row);
    rowsByCardSet.set(row.card_set_id, group);
  }

  const representativeByCardSet = new Map<string, string>();
  for (const [cardSetId, group] of rowsByCardSet) {
    const canonical = group
      .map((row) => row.canonical_leader_id)
      .filter((id): id is string => Boolean(id))
      .sort()[0];
    const representative = canonical ??
      [...group].sort((a, b) => {
        const priority = (row: T) =>
          row.canonical_leader_id ? 2 : row.card_image_id === row.card_set_id ? 0 : 1;
        return priority(a) - priority(b) || a.id.localeCompare(b.id);
      })[0].id;
    representativeByCardSet.set(cardSetId, representative);
  }

  const resolveId = (id: string) => {
    const row = leaderMap.get(id);
    if (!row) return id;
    if (row.card_set_id) return representativeByCardSet.get(row.card_set_id) ?? id;
    return row.canonical_leader_id ?? id;
  };

  return { leaderMap, resolveId };
}

type RegionStore = { city: string | null; zone: string | null; subzone: string | null };

/** Región de una tienda: su subzona; en zonas sin subzonas (Extendida), su ciudad. */
export function storeRegion(store: Pick<RegionStore, "city" | "subzone">): string | null {
  return store.subzone ?? store.city;
}

/** Opciones de región de una zona. Si tiene subzonas, solo esas; si no, sus ciudades. */
export function regionsForZone(stores: RegionStore[], zone: string | null): string[] {
  const inZone = stores.filter((s) => s.zone === zone);
  const values = inZone.some((s) => s.subzone)
    ? inZone.map((s) => s.subzone)
    : inZone.map((s) => s.city);
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) =>
    a.localeCompare(b, "es-MX"),
  );
}

/**
 * Subregión donde más ha jugado: más torneos; en empate, la de su tienda
 * principal y luego la más reciente. Sin torneos, la de su tienda principal.
 */
export function mostPlayedRegion(
  played: { store_id: string; date: string }[],
  stores: (RegionStore & { id: string })[],
  homeStoreId: string | null,
): { zone: string; region: string } | null {
  const byId = new Map(stores.map((s) => [s.id, s]));
  const placeOf = (id: string | null) => {
    const store = id ? byId.get(id) : undefined;
    const region = store && storeRegion(store);
    return store?.zone && region ? { zone: store.zone, region } : null;
  };
  const keyOf = (place: { zone: string; region: string }) => `${place.zone}|${place.region}`;
  const home = placeOf(homeStoreId);
  const homeKey = home && keyOf(home);

  const tally = new Map<
    string,
    { place: { zone: string; region: string }; count: number; last: string }
  >();
  for (const { store_id, date } of played) {
    const place = placeOf(store_id);
    if (!place) continue;
    const entry = tally.get(keyOf(place)) ?? { place, count: 0, last: "" };
    entry.count += 1;
    if (date > entry.last) entry.last = date;
    tally.set(keyOf(place), entry);
  }
  const [best] = Array.from(tally.entries()).sort(
    ([aKey, a], [bKey, b]) =>
      b.count - a.count ||
      Number(bKey === homeKey) - Number(aKey === homeKey) ||
      b.last.localeCompare(a.last) ||
      aKey.localeCompare(bKey),
  );
  return best?.[1].place ?? home;
}

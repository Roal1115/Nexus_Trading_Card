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

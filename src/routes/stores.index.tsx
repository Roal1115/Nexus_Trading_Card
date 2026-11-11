import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Star } from "lucide-react";
import { toast } from "sonner";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";
import { getMyFavoriteStores, toggleFavoriteStore } from "@/lib/nexus-player.functions";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { publicStoresQuery } from "@/lib/stores-queries";
import { regionsForZone, storeRegion } from "@/lib/store-regions";
import { BTN_OUTLINE, ChipGroup, plural } from "@/components/stores/store-ui";

type StoresSearch = { q?: string; zone?: string; region?: string };

export const Route = createFileRoute("/stores/")({
  // La URL es la fuente de verdad de la búsqueda, la zona y la región: compartible y sobrevive
  // atrás/adelante.
  validateSearch: (s: Record<string, unknown>): StoresSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    zone: typeof s.zone === "string" && s.zone ? s.zone : undefined,
    region: typeof s.region === "string" && s.region ? s.region : undefined,
  }),
  head: () => ({ meta: [{ title: "Tiendas — Nexus" }] }),
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(publicStoresQuery());
    } catch {
      return undefined;
    }
  },
  component: TiendasPage,
});

type StoreCard = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  zone: string | null;
  subzone: string | null;
  address: string | null;
  google_maps_url: string | null;
  opening_hours: string | null;
  instagram: string | null;
  website: string | null;
  twitter: string | null;
  twitch: string | null;
  games: Array<{ id: string; name: string }>;
};

const NO_ZONE = "Sin zona asignada";

/** Minúsculas y sin acentos, para que "monterrey" encuentre "Monterréy" y "cdmx" a "CDMX". */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function FavoriteStar({
  storeId,
  storeName,
  isFavorite,
  isToggling,
  onToggle,
}: {
  storeId: string;
  storeName: string;
  isFavorite: boolean;
  isToggling: boolean;
  onToggle: (id: string, name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(storeId, storeName)}
      disabled={isToggling}
      aria-label={
        isFavorite ? `Quitar ${storeName} de favoritas` : `Marcar ${storeName} como favorita`
      }
      aria-pressed={isFavorite}
      className={`relative z-10 -mr-1.5 -mt-1.5 flex min-h-11 min-w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 sm:min-h-9 sm:min-w-9 ${
        isFavorite
          ? "text-warning hover:bg-white/5"
          : "text-foreground-subtle hover:bg-white/5 hover:text-warning"
      }`}
    >
      <Star size={18} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

/**
 * Una tienda en dos líneas: nombre (con la estrella) y ciudad · juegos, más el horario y
 * "Cómo llegar". El enlace al detalle vive en el nombre y se estira sobre toda la tarjeta
 * (after:inset-0); la estrella y el mapa quedan por encima como sus propios controles, así
 * ya no hay botones dentro de un enlace.
 */
function StoreCardItem({
  store,
  favoriteSlot,
  showGames,
}: {
  store: StoreCard;
  favoriteSlot?: React.ReactNode;
  showGames: boolean;
}) {
  const subtitle = [
    store.city,
    store.subzone && store.subzone !== store.city ? store.subzone : null,
    showGames ? store.games.map((g) => g.name).join(", ") || null : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="relative flex h-full flex-col gap-1 rounded-xl border border-border bg-card p-4 transition hover:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground">
            <Link
              to="/stores/$slug"
              params={{ slug: store.slug }}
              className="after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
            >
              {store.name}
            </Link>
          </h3>
          {subtitle && <p className="truncate text-sm text-foreground-secondary">{subtitle}</p>}
        </div>
        {favoriteSlot}
      </div>

      {(store.opening_hours || store.google_maps_url) && (
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <p className="min-w-0 truncate text-xs text-foreground-subtle">
            {store.opening_hours ?? ""}
          </p>
          {store.google_maps_url && (
            <a
              href={store.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN_OUTLINE} relative z-10 flex-shrink-0`}
            >
              Cómo llegar
              <span className="sr-only"> a {store.name} (se abre en otra pestaña)</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const GRID = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]";

function TiendasPage() {
  const fetchFavorites = useServerFn(getMyFavoriteStores);
  const toggleFav = useServerFn(toggleFavoriteStore);
  const { player } = useNexusRole();
  const loaderData = Route.useLoaderData();
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: storesData, isLoading: loading } = useQuery({
    ...publicStoresQuery(),
    initialData: loaderData,
  });
  const stores: StoreCard[] = storesData?.stores ?? [];
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!player?.id) {
      setFavoriteIds(new Set());
      return;
    }
    // Guard contra respuestas fuera de orden — mismo fix que stores.$slug.tsx.
    let cancelled = false;
    fetchFavorites()
      .then((res: any) => {
        if (!cancelled) setFavoriteIds(new Set(res.store_ids ?? []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const handleToggleFavorite = async (storeId: string, storeName: string) => {
    const wasFavorite = favoriteIds.has(storeId);
    setTogglingId(storeId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
    try {
      await toggleFav({ data: { store_id: storeId } });
      toast.success(
        wasFavorite ? `${storeName} quitada de favoritas` : `${storeName} agregada a favoritas`,
      );
    } catch (e: any) {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(storeId);
        else next.delete(storeId);
        return next;
      });
      toast.error(e?.message ?? "No se pudo actualizar favoritas");
    } finally {
      setTogglingId(null);
    }
  };

  // Búsqueda, zona y región: AND entre ellas, y entre las palabras de la búsqueda ("monterrey sur").
  // Se busca en nombre, ciudad, estado, zona, subzona, dirección y juegos; ya es todo el listado
  // en memoria. La región es la subzona (o la ciudad si la zona no tiene subzonas).
  const q = urlSearch.q ?? "";
  const zones = useMemo(
    () =>
      Array.from(new Set(stores.map((s) => s.zone).filter((z): z is string => !!z))).sort((a, b) =>
        a.localeCompare(b, "es-MX"),
      ),
    [stores],
  );
  const zone = urlSearch.zone && zones.includes(urlSearch.zone) ? urlSearch.zone : null;
  const regions = useMemo(() => (zone ? regionsForZone(stores, zone) : []), [stores, zone]);
  const region = urlSearch.region && regions.includes(urlSearch.region) ? urlSearch.region : null;
  // El juego solo se nombra en la tarjeta si el circuito tiene más de uno; con uno solo es ruido.
  const showGames = useMemo(
    () => new Set(stores.flatMap((s) => s.games.map((g) => g.id))).size > 1,
    [stores],
  );

  const visibleStores = useMemo(() => {
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    return stores.filter((s) => {
      if (zone && s.zone !== zone) return false;
      if (region && storeRegion(s) !== region) return false;
      if (tokens.length === 0) return true;
      const haystack = norm(
        [s.name, s.city, s.state, s.zone, s.subzone, s.address, ...s.games.map((g) => g.name)]
          .filter(Boolean)
          .join(" "),
      );
      return tokens.every((t) => haystack.includes(t));
    });
  }, [stores, q, zone, region]);

  const favoriteStores = useMemo(
    () => visibleStores.filter((s) => favoriteIds.has(s.id)),
    [visibleStores, favoriteIds],
  );
  const zoneGroups = useMemo(() => {
    const groups = new Map<string, StoreCard[]>();
    for (const s of visibleStores) {
      if (favoriteIds.has(s.id)) continue;
      const key = s.zone ?? NO_ZONE;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "es-MX"));
  }, [visibleStores, favoriteIds]);

  const setQ = (v: string) =>
    navigate({ search: (prev) => ({ ...prev, q: v || undefined }), replace: true });
  // Cambiar de zona descarta la región: sus opciones dependen de la zona.
  const setZone = (z: string | null) =>
    navigate({ search: (prev) => ({ ...prev, zone: z ?? undefined, region: undefined }) });
  const setRegion = (r: string | null) =>
    navigate({ search: (prev) => ({ ...prev, region: r ?? undefined }) });
  const resetFilters = () => navigate({ search: () => ({}) });
  const canReset = !!q || !!zone || !!region;

  const renderStar = (s: StoreCard) =>
    player ? (
      <FavoriteStar
        storeId={s.id}
        storeName={s.name}
        isFavorite={favoriteIds.has(s.id)}
        isToggling={togglingId === s.id}
        onToggle={handleToggleFavorite}
      />
    ) : undefined;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6" aria-busy="true">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Tiendas del Circuito</h1>
        </header>
        <SkeletonBlock className="h-11 w-full max-w-md rounded-md" />
        <div className={GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[126px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Tiendas del Circuito</h1>
        <p className="max-w-2xl text-sm text-foreground-secondary">
          Encuentra dónde jugar: busca por nombre, ciudad, zona o dirección.
        </p>
      </header>

      {stores.length > 0 && (
        <section aria-label="Buscar y filtrar tiendas" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-md">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, ciudad, zona o dirección…"
                aria-label="Buscar tienda por nombre, ciudad, zona, dirección o juego"
                autoComplete="off"
                className="min-h-11 w-full rounded-md border border-border bg-transparent py-2 pl-9 pr-3 text-base text-foreground outline-none transition placeholder:text-foreground-subtle focus:border-primary focus:ring-1 focus:ring-primary sm:min-h-9 sm:text-sm"
              />
            </div>
            {canReset && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-11 cursor-pointer rounded-md px-2 text-sm font-medium text-foreground-secondary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:min-h-9"
              >
                Restablecer filtros
              </button>
            )}
          </div>

          {zones.length > 1 && (
            <ChipGroup
              label="Filtrar por zona"
              value={zone}
              onChange={setZone}
              options={[{ key: null, label: "Todas" }, ...zones.map((z) => ({ key: z, label: z }))]}
            />
          )}

          {regions.length > 1 && (
            <ChipGroup
              label={`Filtrar por región de ${zone}`}
              value={region}
              onChange={setRegion}
              options={[
                { key: null, label: "Toda la zona" },
                ...regions.map((r) => ({ key: r, label: r })),
              ]}
            />
          )}

          <p
            role="status"
            aria-live="polite"
            className="font-mono-stat text-sm text-foreground-subtle"
          >
            {canReset
              ? `${visibleStores.length} de ${plural(stores.length, "tienda", "tiendas")}`
              : plural(stores.length, "tienda", "tiendas")}
          </p>
        </section>
      )}

      {favoriteStores.length > 0 && (
        <section aria-label="Tus tiendas favoritas" className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-foreground">Tus favoritas</h2>
            <span className="font-mono-stat text-xs text-foreground-subtle">
              {favoriteStores.length}/5
            </span>
          </div>
          <div className={GRID}>
            {favoriteStores.map((s) => (
              <StoreCardItem
                key={s.id}
                store={s}
                favoriteSlot={renderStar(s)}
                showGames={showGames}
              />
            ))}
          </div>
        </section>
      )}

      {zoneGroups.map(([zoneName, zoneStores]) => (
        <section key={zoneName} aria-label={zoneName} className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-foreground">{zoneName}</h2>
            <span className="font-mono-stat text-xs text-foreground-subtle">
              {zoneStores.length}
            </span>
          </div>
          <div className={GRID}>
            {zoneStores.map((s) => (
              <StoreCardItem
                key={s.id}
                store={s}
                favoriteSlot={renderStar(s)}
                showGames={showGames}
              />
            ))}
          </div>
        </section>
      ))}

      {stores.length > 0 && visibleStores.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
          <p className="text-sm text-foreground">
            {q ? `Sin tiendas para “${q}”` : "Sin tiendas con estos filtros"}
          </p>
          <p className="mt-1 text-xs text-foreground-subtle">
            ¿No encuentras tu tienda? Las tiendas se suman al circuito por invitación.
          </p>
          <button type="button" onClick={resetFilters} className={`${BTN_OUTLINE} mt-4`}>
            Restablecer filtros
          </button>
        </div>
      )}

      {stores.length === 0 && (
        <p className="text-sm text-foreground-secondary">Aún no hay tiendas registradas.</p>
      )}
    </div>
  );
}

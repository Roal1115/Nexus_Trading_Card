import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, MapPin, Navigation, Clock, Instagram, Globe, Twitter, Twitch } from "lucide-react";
import { getPublicStores } from "@/lib/geekarena-public.functions";

export const Route = createFileRoute("/tiendas/")({
  head: () => ({ meta: [{ title: "Tiendas — Geek Arena" }] }),
  component: TiendasPage,
});

const ZONES = ["Zona Monterrey", "Zona Guadalajara", "Zona Centro", "Zona Extendida"];

type StoreCard = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  zone: string | null;
  google_maps_url: string | null;
  opening_hours: string | null;
  instagram: string | null;
  website: string | null;
  twitter: string | null;
  twitch: string | null;
  games: Array<{ id: string; name: string }>;
};

function StoreCardItem({ store }: { store: StoreCard }) {
  return (
    <Link
      to="/tiendas/$slug"
      params={{ slug: store.slug }}
      className="glass block rounded-2xl p-5 transition hover:border-primary/40 hover:bg-white/[0.04]"
    >
      <h3 className="text-lg font-bold text-white">{store.name}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
        <MapPin size={12} /> {store.city ?? "—"}
      </p>

      {store.games.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {store.games.map((g) => (
            <span
              key={g.id}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-300"
            >
              {g.name}
            </span>
          ))}
        </div>
      )}

      {store.opening_hours && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={12} /> {store.opening_hours}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <div className="flex items-center gap-3 text-gray-500">
          {store.instagram && <Instagram size={14} />}
          {store.website && <Globe size={14} />}
          {store.twitter && <Twitter size={14} />}
          {store.twitch && <Twitch size={14} />}
        </div>
        {store.google_maps_url && (
          <a
            href={store.google_maps_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            <Navigation size={12} /> Cómo llegar
          </a>
        )}
      </div>
    </Link>
  );
}

function TiendasPage() {
  const fetchStores = useServerFn(getPublicStores);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreCard[]>([]);

  useEffect(() => {
    fetchStores()
      .then((res: any) => setStores(res.stores ?? []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Geek Arena</p>
        <h1 className="text-4xl font-bold text-white">Tiendas del Circuito</h1>
        <p className="max-w-2xl text-sm text-gray-400">
          Encuentra dónde jugar en cada región.
        </p>
      </header>

      {ZONES.map((zone) => {
        const zoneStores = stores.filter((s) => s.zone === zone);
        if (zoneStores.length === 0) return null;
        return (
          <section key={zone} className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-white">{zone}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {zoneStores.map((s) => (
                <StoreCardItem key={s.id} store={s} />
              ))}
            </div>
          </section>
        );
      })}

      {stores.length === 0 && (
        <p className="text-sm text-gray-400">Aún no hay tiendas registradas.</p>
      )}
    </div>
  );
}

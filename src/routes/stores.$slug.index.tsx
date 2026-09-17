import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  MapPin,
  Navigation,
  Clock,
  Instagram,
  Globe,
  Twitter,
  Twitch,
  Phone,
  Medal,
  Star,
} from "lucide-react";
import { getMyFavoriteStores, toggleFavoriteStore } from "@/lib/nexus-player.functions";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { storeProfileQuery, storeTournamentHistoryQuery } from "@/lib/stores-queries";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";
import { safeHref } from "@/lib/utils";

export const Route = createFileRoute("/stores/$slug/")({
  component: StoreOverviewPage,
});

function StoreOverviewPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { player } = useNexusRole();

  // Misma query key que la capa padre (stores.$slug.tsx) — ya está en caché,
  // así que esto no dispara una segunda request de red.
  const { data: profileData } = useQuery({ ...storeProfileQuery(slug), retry: false });
  const store = profileData?.store;

  const fetchFavorites = useServerFn(getMyFavoriteStores);
  const toggleFavorite = useServerFn(toggleFavoriteStore);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    if (!player?.id || !store?.id) {
      setIsFavorite(false);
      return;
    }
    // Guard contra respuestas fuera de orden: si este efecto se re-dispara
    // (p.ej. el contexto de auth resuelve `player` en varios pasos) antes de
    // que la request anterior responda, esa respuesta vieja no debe pisar
    // el estado ya actualizado por la más reciente.
    let cancelled = false;
    fetchFavorites()
      .then((res: any) => {
        if (!cancelled) setIsFavorite((res.store_ids ?? []).includes(store.id));
      })
      .catch(() => {
        if (!cancelled) setIsFavorite(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, store?.id]);

  async function handleToggleFavorite() {
    if (!store?.id || favoriteBusy) return;
    setFavoriteBusy(true);
    setIsFavorite((v) => !v);
    try {
      const res: any = await toggleFavorite({ data: { store_id: store.id } });
      setIsFavorite(res.is_favorite);
    } catch {
      setIsFavorite((v) => !v);
    } finally {
      setFavoriteBusy(false);
    }
  }

  const { data: historyData, isLoading: historyLoading } = useQuery({
    ...storeTournamentHistoryQuery(slug),
    enabled: !!slug,
  });
  const tournamentHistory = historyData?.tournaments ?? [];

  if (!store) return null;

  return (
    <div className="space-y-6">
      <header className="glass space-y-4 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              {store.zone ?? "—"}
            </p>
            <h1 className="text-3xl font-bold text-white">{store.name}</h1>
          </div>
          {player && (
            <button
              onClick={handleToggleFavorite}
              disabled={favoriteBusy}
              aria-pressed={isFavorite}
              title={isFavorite ? "Quitar de favoritas" : "Agregar a favoritas"}
              className={`flex-shrink-0 rounded-full border p-2.5 transition ${
                isFavorite
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-white/10 text-gray-400 hover:border-primary/40 hover:text-primary"
              }`}
            >
              <Star size={18} className={isFavorite ? "fill-primary" : ""} />
            </button>
          )}
        </div>
        {store.description && <p className="text-sm text-gray-300">{store.description}</p>}

        {store.games.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {store.games.map((g: any) => (
              <span
                key={g.id}
                className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {safeHref(store.google_maps_url) && (
              <a
                href={safeHref(store.google_maps_url)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
              >
                <Navigation size={12} /> Cómo llegar
              </a>
            )}
            <Link
              to="/stores/$slug/tournaments"
              params={{ slug }}
              className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/20"
            >
              <Medal size={12} /> Ver Torneos y Liga
            </Link>
          </div>

          {/* Contacto/social: secundario respecto a las acciones primarias
              de arriba — icon-only, sin fondo, separado por un divisor. */}
          {(store.instagram || safeHref(store.website) || store.twitter || store.twitch) && (
            <div className="flex items-center gap-3 border-l border-white/10 pl-3">
              {store.instagram && (
                <a
                  href={`https://instagram.com/${store.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-500 hover:text-primary"
                >
                  <Instagram size={16} />
                </a>
              )}
              {safeHref(store.website) && (
                <a
                  href={safeHref(store.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-500 hover:text-primary"
                >
                  <Globe size={16} />
                </a>
              )}
              {store.twitter && (
                <a
                  href={`https://x.com/${store.twitter.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-500 hover:text-primary"
                >
                  <Twitter size={16} />
                </a>
              )}
              {store.twitch && (
                <a
                  href={`https://twitch.tv/${store.twitch.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-500 hover:text-primary"
                >
                  <Twitch size={16} />
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Ubicación y horario: dirección, horario, teléfono y mapa
            consolidados en una sola unidad — antes vivían repartidos como
            cuatro tratamientos visuales distintos dentro del hero. El mapa
            queda colapsado por default: "Cómo llegar" ya cubre la acción de
            navegar, el iframe completo es peso visual redundante. */}
        <section className="glass space-y-3 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white">Ubicación y horario</h2>
          {!(store.address || store.city || store.opening_hours || store.phone) ? (
            <p className="text-sm text-gray-500">
              La tienda sigue en proceso de configuración — pronto verás su dirección y horario
              aquí.
            </p>
          ) : (
            <>
              <div className="space-y-2 text-sm text-gray-300">
                {(store.address || store.city) && (
                  <p className="flex items-center gap-1.5">
                    <MapPin size={14} className="flex-shrink-0 text-gray-500" />
                    {[store.address, store.city, store.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {store.opening_hours && (
                  <p className="flex items-center gap-1.5">
                    <Clock size={14} className="flex-shrink-0 text-gray-500" />{" "}
                    {store.opening_hours}
                  </p>
                )}
                {store.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone size={14} className="flex-shrink-0 text-gray-500" /> {store.phone}
                  </p>
                )}
              </div>

              {(store.address || store.city) && (
                <button
                  onClick={() => setMapExpanded((v) => !v)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {mapExpanded ? "Ocultar mapa" : "Ver mapa"}
                </button>
              )}

              {mapExpanded && (store.address || store.city) && (
                <iframe
                  title={`Mapa de ${store.name}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    [store.name, store.address, store.city, store.state].filter(Boolean).join(", "),
                  )}&output=embed`}
                  className="h-64 w-full rounded-xl border border-white/10"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
            </>
          )}
        </section>

        {/* Actividad reciente: señal rápida de "esta tienda está activa"
            sin obligar a ir hasta el historial completo (que sigue
            existiendo, paginado, en la pestaña de Torneos y Liga). */}
        {historyLoading ? (
          <section className="glass space-y-3 rounded-2xl p-6">
            <SkeletonLine width="w-32" height="h-4" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
          </section>
        ) : tournamentHistory.length > 0 ? (
          <section className="glass space-y-3 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white">Actividad reciente</h2>
            <div className="space-y-2.5">
              {tournamentHistory.slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate({ to: "/tournaments/$id", params: { id: t.id } })}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs hover:bg-white/[0.05]"
                >
                  <span className="text-gray-300">
                    {new Date(t.date + "T12:00:00").toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                    })}
                    <span className="text-gray-500"> · {t.game_name}</span>
                  </span>
                  <span className="font-mono-stat text-gray-400">{t.participants} jug.</span>
                </button>
              ))}
            </div>
            <Link
              to="/stores/$slug/tournaments"
              params={{ slug }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver historial completo →
            </Link>
          </section>
        ) : (
          <section className="glass space-y-3 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white">Actividad reciente</h2>
            <p className="text-sm text-gray-500">
              Sin actividad reciente — todavía no hay torneos registrados en esta tienda.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

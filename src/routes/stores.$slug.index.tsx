import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Clock, Instagram, Globe, Twitter, Twitch, Phone } from "lucide-react";
import { storeProfileQuery, storeTournamentHistoryQuery } from "@/lib/stores-queries";
import { FOCUS_RING, BTN_OUTLINE, InlineError, SECTION } from "@/components/stores/store-ui";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";
import { safeHref } from "@/lib/utils";

export const Route = createFileRoute("/stores/$slug/")({
  component: StoreOverviewPage,
});

const ICON_LINK = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-foreground-secondary transition hover:bg-white/5 hover:text-foreground ${FOCUS_RING}`;

function StoreOverviewPage() {
  const { slug } = Route.useParams();
  const [mapExpanded, setMapExpanded] = useState(false);

  // Misma query key que la capa padre (stores.$slug.tsx) — ya está en caché,
  // así que esto no dispara una segunda request de red.
  const { data: profileData } = useQuery({ ...storeProfileQuery(slug), retry: false });
  const store = profileData?.store;

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useQuery({
    ...storeTournamentHistoryQuery(slug),
    enabled: !!slug,
  });
  const tournamentHistory = historyData?.tournaments ?? [];

  if (!store) return null;

  const hasPlace = Boolean(store.address || store.city);

  return (
    <div className="grid gap-4 @2xl:grid-cols-2 @2xl:items-start">
      {/* Ubicación y horario: dirección, horario, teléfono y mapa consolidados en una sola
          unidad. El mapa queda colapsado por default: "Cómo llegar" ya cubre la acción de
          navegar, el iframe completo es peso visual redundante. */}
      <section className={`${SECTION} space-y-3`}>
        <h2 className="text-lg font-bold text-foreground">Ubicación y contacto</h2>
        {store.description && (
          <p className="text-sm text-foreground-secondary">{store.description}</p>
        )}
        {!(hasPlace || store.opening_hours || store.phone) ? (
          <p className="text-sm text-foreground-secondary">
            La tienda sigue en proceso de configuración — pronto verás su dirección y horario aquí.
          </p>
        ) : (
          <>
            <div className="space-y-2 text-sm text-foreground-secondary">
              {hasPlace && (
                <p className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  {[store.address, store.city, store.state].filter(Boolean).join(", ")}
                </p>
              )}
              {store.opening_hours && (
                <p className="flex items-start gap-2">
                  <Clock size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  {store.opening_hours}
                </p>
              )}
              {store.phone && (
                <p className="flex items-start gap-2">
                  <Phone size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  {store.phone}
                </p>
              )}
            </div>

            {hasPlace && (
              <button
                type="button"
                onClick={() => setMapExpanded((v) => !v)}
                aria-expanded={mapExpanded}
                className={BTN_OUTLINE}
              >
                {mapExpanded ? "Ocultar mapa" : "Ver mapa"}
              </button>
            )}

            {mapExpanded && hasPlace && (
              <iframe
                title={`Mapa de ${store.name}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  [store.name, store.address, store.city, store.state].filter(Boolean).join(", "),
                )}&output=embed`}
                className="h-64 w-full rounded-lg border border-border"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </>
        )}
        {(store.instagram || safeHref(store.website) || store.twitter || store.twitch) && (
          <div className="-mx-2 flex flex-wrap items-center gap-1">
            {store.instagram && (
              <a
                href={`https://instagram.com/${store.instagram.replace("@", "")}`}
                aria-label={`Instagram de ${store.name} (se abre en otra pestaña)`}
                target="_blank"
                rel="noopener noreferrer"
                className={ICON_LINK}
              >
                <Instagram size={18} aria-hidden="true" />
              </a>
            )}
            {safeHref(store.website) && (
              <a
                href={safeHref(store.website)}
                aria-label={`Sitio web de ${store.name} (se abre en otra pestaña)`}
                target="_blank"
                rel="noopener noreferrer"
                className={ICON_LINK}
              >
                <Globe size={18} aria-hidden="true" />
              </a>
            )}
            {store.twitter && (
              <a
                href={`https://x.com/${store.twitter.replace("@", "")}`}
                aria-label={`X de ${store.name} (se abre en otra pestaña)`}
                target="_blank"
                rel="noopener noreferrer"
                className={ICON_LINK}
              >
                <Twitter size={18} aria-hidden="true" />
              </a>
            )}
            {store.twitch && (
              <a
                href={`https://twitch.tv/${store.twitch.replace("@", "")}`}
                aria-label={`Twitch de ${store.name} (se abre en otra pestaña)`}
                target="_blank"
                rel="noopener noreferrer"
                className={ICON_LINK}
              >
                <Twitch size={18} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </section>

      {/* Actividad reciente: señal rápida de "esta tienda está activa" sin obligar a ir hasta el
          historial completo (que sigue existiendo, paginado, en la pestaña de Torneos y Liga). */}
      <section className={`${SECTION} space-y-3`}>
        <h2 className="text-lg font-bold text-foreground">Actividad reciente</h2>
        {historyLoading ? (
          <div className="space-y-2" aria-busy="true">
            <SkeletonLine width="w-32" height="h-4" />
            <SkeletonBlock className="h-11 w-full rounded-lg" />
            <SkeletonBlock className="h-11 w-full rounded-lg" />
          </div>
        ) : historyError ? (
          <InlineError onRetry={() => refetchHistory()}>
            No pudimos cargar la actividad de la tienda.
          </InlineError>
        ) : tournamentHistory.length > 0 ? (
          <>
            <ul className="divide-y divide-border">
              {tournamentHistory.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <Link
                    to="/tournaments/$id"
                    params={{ id: t.id }}
                    className={`-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-white/5 ${FOCUS_RING}`}
                  >
                    <span className="min-w-0">
                      <span className="text-foreground">
                        {new Date(t.date + "T12:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span className="text-foreground-secondary"> · {t.game_name}</span>
                    </span>
                    <span className="flex-shrink-0 font-mono-stat text-foreground-secondary">
                      {t.participants} jug.
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/stores/$slug/tournaments" params={{ slug }} className={BTN_OUTLINE}>
              Ver historial completo
            </Link>
          </>
        ) : (
          <p className="text-sm text-foreground-secondary">
            Sin actividad reciente — todavía no hay torneos registrados en esta tienda.
          </p>
        )}
      </section>
    </div>
  );
}

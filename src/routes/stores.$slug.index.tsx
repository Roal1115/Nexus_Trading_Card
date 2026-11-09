import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Clock, Instagram, Globe, Twitter, Twitch, Phone } from "lucide-react";
import { storeProfileQuery, storeTournamentHistoryQuery } from "@/lib/stores-queries";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/skeleton-loader";
import { safeHref } from "@/lib/utils";

export const Route = createFileRoute("/stores/$slug/")({
  component: StoreOverviewPage,
});

function StoreOverviewPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [mapExpanded, setMapExpanded] = useState(false);

  // Misma query key que la capa padre (stores.$slug.tsx) — ya está en caché,
  // así que esto no dispara una segunda request de red.
  const { data: profileData } = useQuery({ ...storeProfileQuery(slug), retry: false });
  const store = profileData?.store;

  const { data: historyData, isLoading: historyLoading } = useQuery({
    ...storeTournamentHistoryQuery(slug),
    enabled: !!slug,
  });
  const tournamentHistory = historyData?.tournaments ?? [];

  if (!store) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Ubicación y horario: dirección, horario, teléfono y mapa
            consolidados en una sola unidad — antes vivían repartidos como
            cuatro tratamientos visuales distintos dentro del hero. El mapa
            queda colapsado por default: "Cómo llegar" ya cubre la acción de
            navegar, el iframe completo es peso visual redundante. */}
        <section className="glass space-y-3 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white">Ubicación y contacto</h2>
          {store.description && <p className="text-sm text-gray-300">{store.description}</p>}
          {!(store.address || store.city || store.opening_hours || store.phone) ? (
            <p className="text-sm text-gray-400">
              La tienda sigue en proceso de configuración — pronto verás su dirección y horario
              aquí.
            </p>
          ) : (
            <>
              <div className="space-y-2 text-sm text-gray-300">
                {(store.address || store.city) && (
                  <p className="flex items-center gap-1.5">
                    <MapPin size={14} className="flex-shrink-0 text-gray-400" />
                    {[store.address, store.city, store.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {store.opening_hours && (
                  <p className="flex items-center gap-1.5">
                    <Clock size={14} className="flex-shrink-0 text-gray-400" />{" "}
                    {store.opening_hours}
                  </p>
                )}
                {store.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone size={14} className="flex-shrink-0 text-gray-400" /> {store.phone}
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
          {(store.instagram || safeHref(store.website) || store.twitter || store.twitch) && (
            <div className="flex items-center gap-3 pt-1">
              {store.instagram && (
                <a
                  href={`https://instagram.com/${store.instagram.replace("@", "")}`}
                  aria-label="Instagram"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-gray-400 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Instagram size={16} />
                </a>
              )}
              {safeHref(store.website) && (
                <a
                  href={safeHref(store.website)}
                  aria-label="Sitio web"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-gray-400 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Globe size={16} />
                </a>
              )}
              {store.twitter && (
                <a
                  href={`https://x.com/${store.twitter.replace("@", "")}`}
                  aria-label="X"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-gray-400 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Twitter size={16} />
                </a>
              )}
              {store.twitch && (
                <a
                  href={`https://twitch.tv/${store.twitch.replace("@", "")}`}
                  aria-label="Twitch"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-gray-400 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Twitch size={16} />
                </a>
              )}
            </div>
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
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs hover:bg-white/[0.05]"
                >
                  <span className="text-gray-300">
                    {new Date(t.date + "T12:00:00").toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                    })}
                    <span className="text-gray-400"> · {t.game_name}</span>
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
            <p className="text-sm text-gray-400">
              Sin actividad reciente — todavía no hay torneos registrados en esta tienda.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

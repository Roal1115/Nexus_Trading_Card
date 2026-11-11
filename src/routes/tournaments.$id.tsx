import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPublicTournament } from "@/lib/nexus-public.functions";
import {
  getTournamentRsvpCount,
  getPlayerRsvpStatus,
  createRsvp,
  cancelRsvp,
} from "@/lib/nexus-rsvp.functions";
import { RSVP_NOTICE } from "@/lib/rsvp-rules";
import { useHidesOthersDecks, useNexusRole } from "@/hooks/use-nexus-role";
import { buildIcs, icsDataUri, icsFileName } from "@/lib/ics";
import { todayInMexicoStr } from "@/lib/utils";
import { BTN_OUTLINE, FOCUS_RING, InlineError, SECTION } from "@/components/stores/store-ui";
import { Trophy, MapPin, Clock, CalendarPlus, Share2, Check, Heart, ArrowLeft } from "lucide-react";
import { useState } from "react";

const BTN_PRIMARY = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} sm:min-h-9`;

export const Route = createFileRoute("/tournaments/$id")({
  loader: async ({ params }) => {
    try {
      return await getPublicTournament({ data: { tournament_id: params.id } });
    } catch (e: any) {
      // Solo "no existe / no publicado" es un 404; un fallo de red o de base de datos va al
      // errorComponent, que ofrece reintentar en vez de decir que el torneo no existe.
      if (/no encontrado/i.test(e?.message ?? "")) throw notFound();
      throw e;
    }
  },
  head: ({ loaderData, params }) => {
    const t = loaderData?.tournament;
    const title = t
      ? `${t.game_name} — ${t.store_name} · ${t.date}`
      : "Torneo — Trading Card Nexus";
    const desc = t
      ? `Resultados del torneo de ${t.game_name} en ${t.store_name}, ${t.store_city}. ${loaderData?.total_participants ?? 0} participantes.`
      : "Resultados de torneo en Trading Card Nexus";
    const url = `https://mxntcg.lovable.app/tournaments/${params.id}`;
    const image = `https://mxntcg.lovable.app/og/tournament-${params.id}.png`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: TournamentLoadError,
  notFoundComponent: TournamentNotFound,
  component: PublicTournamentPage,
});

function TournamentNotFound() {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16">
      <h1 className="text-xl font-bold text-foreground">Torneo no disponible</h1>
      <p className="text-sm text-foreground-secondary">
        Este torneo no existe o aún no ha sido publicado.
      </p>
      <Link to="/" className={BTN_OUTLINE}>
        Ver el ranking nacional
      </Link>
    </main>
  );
}

function TournamentLoadError() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16">
      <h1 className="text-xl font-bold text-foreground">No pudimos cargar el torneo</h1>
      <InlineError onRetry={() => router.invalidate()}>
        Revisa tu conexión e inténtalo de nuevo.
      </InlineError>
      <Link to="/" className={BTN_OUTLINE}>
        Ver el ranking nacional
      </Link>
    </main>
  );
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatLongDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()} de ${MESES[dt.getMonth()]} de ${dt.getFullYear()}`;
}

function PublicTournamentPage() {
  const data = Route.useLoaderData();
  const [copied, setCopied] = useState(false);
  const { player } = useNexusRole();
  const hidesOthersDecks = useHidesOthersDecks();
  // Con perfil privado no se ven los decks de los demás (solo el propio).
  const sees = (geekTag: string) => !hidesOthersDecks || geekTag === player?.geek_tag;
  const qc = useQueryClient();

  const t = data.tournament;
  const winner = data.standings[0];
  const myRow = player ? data.standings.find((s) => s.geek_tag === player.geek_tag) : undefined;
  const today = todayInMexicoStr();
  const isFuture = t.date >= today;

  const rsvpCountQuery = useQuery({
    queryKey: ["rsvp-count", t.id],
    queryFn: () => getTournamentRsvpCount({ data: { tournament_id: t.id } }),
  });
  const rsvpStatusQuery = useQuery({
    queryKey: ["rsvp-status", t.id, player?.id],
    queryFn: () => getPlayerRsvpStatus({ data: { tournament_id: t.id } }),
    enabled: !!player && isFuture,
  });
  const isRsvped = !!rsvpStatusQuery.data?.attending;

  const createFn = useServerFn(createRsvp);
  const cancelFn = useServerFn(cancelRsvp);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rsvp-count", t.id] });
    qc.invalidateQueries({ queryKey: ["rsvp-status", t.id, player?.id] });
  };
  const createMut = useMutation({
    mutationFn: () => createFn({ data: { tournament_id: t.id } }),
    onSuccess: () => {
      toast.success("Marcaste que te interesa ir");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar tu interés"),
  });
  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { tournament_id: t.id } }),
    onSuccess: () => {
      toast.success("Ya no aparece tu interés");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo cancelar"),
  });
  const rsvpBusy = createMut.isPending || cancelMut.isPending;

  const handleShare = async () => {
    const shareData = {
      title: `${t.game_name} — ${t.store_name}`,
      text: "Mira los resultados de este torneo",
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare(shareData))
      ) {
        await navigator.share(shareData);
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  const goToMyRow = () =>
    document.getElementById("mi-lugar")?.scrollIntoView({ block: "center", behavior: "smooth" });

  const place = [t.game_name, t.zone].filter(Boolean).join(" · ");

  return (
    <main className="@container mx-auto max-w-3xl space-y-4 px-4 py-6">
      {/* Destino fijo: con un enlace compartido el historial del navegador puede llevar a
          cualquier parte. */}
      {t.store_slug ? (
        <Link
          to="/stores/$slug"
          params={{ slug: t.store_slug }}
          className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground-secondary transition hover:text-foreground ${FOCUS_RING}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a {t.store_name}
        </Link>
      ) : (
        <Link
          to="/"
          className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground-secondary transition hover:text-foreground ${FOCUS_RING}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Ver el ranking nacional
        </Link>
      )}

      <header className={`${SECTION} space-y-4`}>
        <div className="space-y-1">
          <h1 className="text-balance break-words text-2xl font-bold text-foreground">
            {t.store_name}
          </h1>
          {place && <p className="text-sm text-foreground-secondary">{place}</p>}
        </div>

        <div className="space-y-1.5 text-sm text-foreground-secondary">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {t.store_city}, {t.store_state}
          </p>
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {formatLongDate(t.date)}
          </p>
          {isFuture && rsvpCountQuery.data && (
            <p>
              <span className="font-mono-stat">{rsvpCountQuery.data.count}</span> interesados
            </p>
          )}
        </div>

        {isFuture ? <p className="text-sm text-warning">{RSVP_NOTICE}</p> : null}

        <div className="flex flex-wrap gap-2">
          {isFuture && player ? (
            <button
              type="button"
              onClick={() => (isRsvped ? cancelMut.mutate() : createMut.mutate())}
              disabled={rsvpBusy || rsvpStatusQuery.isLoading}
              aria-pressed={isRsvped}
              className={isRsvped ? BTN_OUTLINE : BTN_PRIMARY}
            >
              <Heart className={`h-4 w-4 ${isRsvped ? "fill-current" : ""}`} aria-hidden="true" />
              {isRsvped ? "Te interesa ir · Quitar" : "Me interesa ir"}
            </button>
          ) : null}
          {isFuture ? (
            <a
              href={icsDataUri(
                buildIcs({
                  title: `${t.game_name} — ${t.store_name}`,
                  description: "Torneo publicado en Trading Card Nexus.",
                  location: `${t.store_name}, ${t.store_city}, ${t.store_state}`,
                  date: t.date,
                  time: t.time,
                  durationHours: 4,
                  uid: t.id,
                }),
              )}
              download={icsFileName(`${t.game_name}-${t.store_name}-${t.date}`)}
              className={BTN_OUTLINE}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Agregar a mi calendario
            </a>
          ) : null}
          <button type="button" onClick={handleShare} className={BTN_OUTLINE} aria-live="polite">
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" /> Enlace copiado
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" aria-hidden="true" /> Compartir
              </>
            )}
          </button>
        </div>

        {data.standings.length > 0 && (
          <dl className="grid grid-cols-3 gap-4 border-t border-border pt-4">
            <div>
              <dt className="text-xs text-foreground-subtle">Jugadores</dt>
              <dd className="font-mono-stat text-2xl font-bold text-foreground">
                {data.total_participants}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-subtle">Rondas</dt>
              <dd className="font-mono-stat text-2xl font-bold text-foreground">
                {t.rounds ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-subtle">Invictos</dt>
              <dd className="font-mono-stat text-2xl font-bold text-foreground">
                {data.undefeated_count}
              </dd>
            </div>
          </dl>
        )}
      </header>

      {winner ? (
        <section className={`${SECTION} flex items-center gap-4`}>
          {sees(winner.geek_tag) && winner.leader_image ? (
            <img
              src={winner.leader_image}
              alt={winner.leader_name ?? ""}
              loading="lazy"
              decoding="async"
              className="h-16 w-11 flex-shrink-0 rounded border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-11 flex-shrink-0 items-center justify-center rounded border border-border">
              <Trophy className="h-5 w-5 text-foreground-subtle" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-foreground-secondary">Campeón</h2>
            <p className="truncate text-lg font-bold text-foreground">{winner.geek_tag}</p>
            {sees(winner.geek_tag) && winner.leader_name ? (
              <p className="truncate text-sm text-foreground-secondary">{winner.leader_name}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {data.standings.length > 0 ? (
        <section className={`${SECTION} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">Posiciones</h2>
            {myRow && (
              <button type="button" onClick={goToMyRow} className={BTN_OUTLINE}>
                Ir a mi lugar (#{myRow.rank})
              </button>
            )}
          </div>

          <table className="w-full text-sm">
            <caption className="sr-only">
              Posiciones del torneo de {t.game_name} en {t.store_name}
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-foreground-subtle">
                <th scope="col" className="w-10 py-2 pr-2 font-medium">
                  #
                </th>
                <th scope="col" className="py-2 pr-2 font-medium">
                  Jugador
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-medium">
                  V/D/E
                </th>
                <th scope="col" className="hidden py-2 pl-4 text-right font-medium @lg:table-cell">
                  OMW %
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-medium">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((s: (typeof data.standings)[number]) => {
                const isTop3 = s.rank <= 3;
                const isMe = !!myRow && s.geek_tag === myRow.geek_tag;
                const vde = s.wins == null ? "—" : `${s.wins}/${s.losses ?? 0}/${s.draws ?? 0}`;
                const omw =
                  typeof s.omw_percentage === "number" ? `${s.omw_percentage.toFixed(1)} %` : "—";
                const pts = typeof s.points_earned === "number" ? s.points_earned.toFixed(2) : "—";
                const leader = sees(s.geek_tag) && s.leader_name ? s.leader_name : null;
                return (
                  <tr
                    key={`${s.rank}-${s.geek_tag}`}
                    id={isMe ? "mi-lugar" : undefined}
                    className={`border-b border-border last:border-0 ${isMe ? "bg-primary/10" : ""}`}
                  >
                    <td
                      className={`py-1 pr-2 align-top font-mono-stat ${isTop3 ? "font-bold text-foreground" : "text-foreground-subtle"}`}
                    >
                      <span className="inline-flex min-h-11 items-center sm:min-h-9">{s.rank}</span>
                    </td>
                    <td className="min-w-0 py-1 pr-2">
                      <div className="flex items-center gap-2">
                        {sees(s.geek_tag) && s.leader_image ? (
                          <img
                            src={s.leader_image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-9 w-6 flex-shrink-0 rounded border border-border object-cover"
                          />
                        ) : null}
                        <div className="min-w-0">
                          {s.is_profile_public ? (
                            <Link
                              to="/players/$playerTag"
                              params={{ playerTag: s.geek_tag }}
                              className={`inline-flex min-h-11 items-center break-all font-medium text-foreground hover:text-primary hover:underline sm:min-h-9 ${FOCUS_RING}`}
                            >
                              {s.geek_tag}
                            </Link>
                          ) : (
                            <span className="inline-flex min-h-11 items-center break-all font-medium text-foreground sm:min-h-9">
                              {s.geek_tag}
                            </span>
                          )}
                          {isMe && <span className="sr-only"> (tú)</span>}
                          {(leader || omw !== "—") && (
                            <p className="-mt-1 pb-1 text-xs text-foreground-subtle">
                              {leader}
                              {omw !== "—" && (
                                <span className="@lg:hidden">
                                  {leader ? " · " : ""}OMW{" "}
                                  <span className="font-mono-stat">{omw}</span>
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-1 pl-2 text-right align-top font-mono-stat text-foreground-secondary">
                      <span className="inline-flex min-h-11 items-center sm:min-h-9">{vde}</span>
                    </td>
                    <td className="hidden py-1 pl-4 text-right align-top font-mono-stat text-foreground-secondary @lg:table-cell">
                      <span className="inline-flex min-h-9 items-center">{omw}</span>
                    </td>
                    <td className="py-1 pl-4 text-right align-top font-mono-stat font-semibold text-foreground">
                      <span className="inline-flex min-h-11 items-center sm:min-h-9">{pts}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <details className="text-sm text-foreground-secondary">
            <summary
              className={`flex min-h-11 cursor-pointer items-center font-medium hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
            >
              Cómo leer la tabla
            </summary>
            <dl className="grid gap-x-8 gap-y-3 pb-1 pt-1 @lg:grid-cols-2">
              <div>
                <dt className="font-semibold text-foreground">Pts</dt>
                <dd>
                  Puntos que obtuvo cada jugador en este torneo; los lugares siguen ese orden.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">V/D/E</dt>
                <dd>Victorias, derrotas y empates.</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">OMW %</dt>
                <dd>
                  Porcentaje de victorias de sus rivales (Opponent Match Win), un criterio de
                  desempate.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Rondas e invictos</dt>
                <dd>
                  Las rondas son las partidas que jugó el primer lugar. Los invictos son quienes no
                  perdieron ninguna.
                </dd>
              </div>
            </dl>
          </details>
        </section>
      ) : (
        <section className={`${SECTION} text-sm text-foreground-secondary`}>
          {isFuture
            ? "Los resultados aparecerán aquí después del torneo."
            : "Este torneo no tiene resultados registrados."}
        </section>
      )}

      {!player && (
        <section className={`${SECTION} space-y-3`}>
          <h2 className="text-base font-semibold text-foreground">¿Compites en este circuito?</h2>
          <p className="text-sm text-foreground-secondary">
            Registra tus partidas, sigue tu ranking nacional y consulta el meta.
          </p>
          <Link to="/signup" className={BTN_PRIMARY}>
            Crear mi cuenta
          </Link>
        </section>
      )}
    </main>
  );
}

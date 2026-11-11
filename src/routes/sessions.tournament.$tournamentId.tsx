import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ShieldQuestion } from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { getTournamentSessionDetail } from "@/lib/nexus-standalone.functions";
import { cleanLeaderName, type DeckIdentifier } from "@/components/tournament-tracker/round-ui";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";
import { BTN_OUTLINE, FOCUS_RING, InlineError, SECTION } from "@/components/stores/store-ui";

export const Route = createFileRoute("/sessions/tournament/$tournamentId")({
  head: () => ({ meta: [{ title: "Torneo — Nexus" }] }),
  component: SessionDetailPage,
});

// ============================================================
// Types
// ============================================================
type SessionDetail = Awaited<ReturnType<typeof getTournamentSessionDetail>>;
type RoundData = SessionDetail["rounds"][number];

// ============================================================
// Helpers
// ============================================================
/** "5 nov"; el año solo si no es el actual. */
function formatShortDate(date: string | null): string {
  if (!date) return "Sin fecha";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

const PODIUM_TEXT: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-slate-200",
  3: "text-amber-600",
};

const formatPoints = (n: number) => Number(n.toFixed(1));

// ============================================================
// RoundRow — una ronda en la tira: resultado + líder rival + dado/turno + notas
// ============================================================
function RoundRow({ round }: { round: RoundData }) {
  const result = round.won_match === true ? "V" : round.won_match === false ? "D" : "—";
  const resultClass =
    round.won_match === true
      ? "text-success"
      : round.won_match === false
        ? "text-danger"
        : "text-foreground-subtle";
  const leader = round.opponent_leader as DeckIdentifier | null;
  const details = [
    round.won_die_roll === null ? null : round.won_die_roll ? "Gané dado" : "Perdí dado",
    round.turn_order === "first" ? "Primero" : round.turn_order === "second" ? "Segundo" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const opponentTag = round.opponent_tag && round.opponent_tag !== "—" ? round.opponent_tag : null;

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <div className="flex w-14 flex-shrink-0 items-baseline gap-2">
        <span className="font-mono-stat text-xs text-foreground-subtle">R{round.round_number}</span>
        <span
          className={`font-mono-stat text-lg font-bold ${resultClass}`}
          aria-label={result === "V" ? "Victoria" : result === "D" ? "Derrota" : "Sin resultado"}
        >
          {result}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {leader?.card_image ? (
          <img
            src={leader.card_image}
            alt={leader.base_name}
            loading="lazy"
            decoding="async"
            className="h-14 w-10 flex-shrink-0 rounded border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded border border-border">
            <ShieldQuestion size={14} aria-hidden="true" className="text-foreground-subtle" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {leader ? cleanLeaderName(leader.base_name) : "Líder sin registrar"}
          </p>
          {opponentTag && (
            <p className="truncate text-xs text-foreground-subtle">vs {opponentTag}</p>
          )}
          {details && <p className="text-xs text-foreground-secondary">{details}</p>}
          {round.notes && (
            <p className="mt-1 text-xs italic text-foreground-secondary">“{round.notes}”</p>
          )}
        </div>
      </div>
    </li>
  );
}

// ============================================================
// SessionDetailPage
// ============================================================
function SessionDetailPage() {
  const { tournamentId } = useParams({ from: "/sessions/tournament/$tournamentId" });
  const { player, loading: roleLoading } = useNexusRole();

  const fetchDetail = useServerFn(getTournamentSessionDetail);

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Un fallo de red no es "no existe": solo "Torneo no encontrado" del servidor es un 404.
  const [error, setError] = useState<"not-found" | "failed" | null>(null);

  const loadDetail = () => {
    setLoading(true);
    setError(null);
    setDetail(null);
    fetchDetail({ data: { tournament_id: tournamentId } })
      .then(setDetail)
      .catch((e: any) => setError(/no encontrado/i.test(e?.message ?? "") ? "not-found" : "failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (roleLoading || !player) return;
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, player, roleLoading]);

  if (!roleLoading && !player) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-foreground">Debes iniciar sesión</h1>
        <Link
          to="/login"
          className={`mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground ${FOCUS_RING}`}
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const session = detail?.session ?? null;
  const rounds = detail?.rounds ?? [];
  const result = detail?.result ?? null;
  const playersCount = detail?.players_count ?? null;
  const wins = rounds.filter((r) => r.won_match === true).length;
  const losses = rounds.filter((r) => r.won_match === false).length;
  const isPublished = session?.tournament_status === "PUBLISHED";

  return (
    <main className="@container mx-auto max-w-3xl px-4 py-8 pb-28 sm:px-6 sm:pb-10">
      {/* Volver: destino fijo, no el historial del navegador */}
      <Link
        to="/sessions"
        className={`mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-foreground-secondary transition hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a Mis partidas
      </Link>

      {/* Error de carga: distingue "no existe" de un fallo de red, y ofrece reintentar */}
      {!loading && error === "not-found" && (
        <section className={`${SECTION} space-y-2`}>
          <h1 className="text-xl font-bold text-foreground">Torneo no disponible</h1>
          <p className="text-sm text-foreground-secondary">
            Este torneo no existe o ya no está en tu historial.
          </p>
        </section>
      )}
      {!loading && error === "failed" && (
        <section className={`${SECTION} space-y-3`}>
          <h1 className="text-xl font-bold text-foreground">No pudimos cargar el torneo</h1>
          <InlineError onRetry={loadDetail}>Revisa tu conexión e inténtalo de nuevo.</InlineError>
        </section>
      )}

      {loading ? (
        <div className={`${SECTION} space-y-3`} aria-busy="true">
          <SkeletonBlock className="h-16 w-full" />
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
        </div>
      ) : session ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Resumen: tienda · ciudad · fecha a la izquierda, lugar final a la derecha */}
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-foreground">{session.name}</h1>
              <p className="mt-0.5 text-sm text-foreground-secondary">
                {[
                  session.store_city && session.store_city !== "—" ? session.store_city : null,
                  formatShortDate(session.session_date),
                  session.game_name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {session.tournament_status === "APPROVED" && (
                <p className="mt-2 text-xs text-warning">Pendiente de conteo oficial</p>
              )}
            </div>

            <div className="flex-shrink-0 text-right">
              {result ? (
                <>
                  <div
                    className={`font-mono-stat text-4xl font-bold leading-none ${
                      PODIUM_TEXT[result.rank] ?? "text-foreground"
                    }`}
                  >
                    #{result.rank}
                    {playersCount ? (
                      <span className="ml-1 text-sm font-normal text-foreground-subtle">
                        de {playersCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 whitespace-nowrap font-mono-stat text-xs text-foreground-subtle">
                    {formatPoints(result.points_earned)} pts
                    {rounds.length > 0 ? ` · ${wins}V–${losses}D` : ""}
                  </p>
                </>
              ) : rounds.length > 0 ? (
                <>
                  <div className="whitespace-nowrap font-mono-stat text-3xl font-bold leading-none">
                    <span className="text-success">{wins}V</span>
                    <span className="text-foreground-subtle">–</span>
                    <span className="text-danger">{losses}D</span>
                  </div>
                  <p className="mt-1 text-xs text-foreground-subtle">
                    {rounds.length} {rounds.length === 1 ? "ronda" : "rondas"}
                  </p>
                </>
              ) : null}
            </div>
          </header>

          {/* Tira de rondas (solo lectura) */}
          {rounds.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-secondary">
              Sin rondas registradas aún.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {rounds.map((r) => (
                <RoundRow key={r.id ?? `round-${r.round_number}`} round={r} />
              ))}
            </ol>
          )}

          {/* Salida al torneo completo (posiciones y campeón), solo cuando ya es público */}
          {isPublished && (
            <footer className="flex justify-end border-t border-border px-5 py-3">
              <Link to="/tournaments/$id" params={{ id: tournamentId }} className={BTN_OUTLINE}>
                Ver torneo completo
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </footer>
          )}
        </section>
      ) : null}
    </main>
  );
}

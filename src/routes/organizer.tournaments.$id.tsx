import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getOrganizerTournamentDetail } from "@/lib/nexus-organizer.functions";
import { TournamentStatusBadge } from "@/components/admin/TournamentStatusBadge";
import { errMsg } from "@/components/panel/dashboard-format";
import {
  TournamentDetailError,
  TournamentDetailHeader,
  TournamentDetailSkeleton,
  UploaderResults,
  UploaderSummary,
} from "@/components/panel/tournament-detail";
import { BTN_OUTLINE, SECTION } from "@/components/stores/store-ui";

export const Route = createFileRoute("/organizer/tournaments/$id")({
  head: () => ({ meta: [{ title: "Torneo — Organizador" }] }),
  component: OrganizerTournamentDetailPage,
});

type Detail = Awaited<ReturnType<typeof getOrganizerTournamentDetail>>;

function OrganizerTournamentDetailPage() {
  const { id } = Route.useParams();
  const fetchDetail = useServerFn(getOrganizerTournamentDetail);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetchDetail({ data: { tournament_id: id } });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setLoadError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  if (loadError && !data) {
    return (
      <TournamentDetailError
        backTo="/organizer/tournaments"
        message={loadError}
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  }

  if (loading || !data) return <TournamentDetailSkeleton />;

  const { tournament, store, game, uploaded_by, results, alerts } = data;

  return (
    <div className="space-y-6">
      <TournamentDetailHeader
        compact
        backTo="/organizer/tournaments"
        game={game.name}
        store={store.name}
        date={tournament.tournament_date}
        badge={
          <TournamentStatusBadge
            status={tournament.status}
            rejectionReason={tournament.rejection_reason}
            audience="uploader"
          />
        }
      >
        {tournament.status === "DRAFT" && tournament.rejection_reason && (
          <div className={`${SECTION} text-sm`}>
            <p className="font-medium text-foreground-secondary">Motivo del rechazo</p>
            <p className="mt-1 break-words text-foreground">{tournament.rejection_reason}</p>
            <p className="mt-3 text-foreground-secondary">
              Elimina este torneo y vuelve a subir el archivo corregido.
            </p>
            <Link
              to="/organizer/tournaments"
              search={{ tab: "rejected" }}
              className={`${BTN_OUTLINE} mt-3`}
            >
              Ir a Rechazados →
            </Link>
          </div>
        )}
      </TournamentDetailHeader>

      <UploaderSummary
        tournament={tournament}
        results={results}
        uploader={uploaded_by?.geek_tag ?? "—"}
        uploaderDetail={uploaded_by?.email ?? ""}
        csvUrl={(tournament as any).csv_url}
      />

      {/* Siempre visibles, en cualquier estado del torneo: un jugador duplicado o un torneo repetido
          siguen siendo ciertos aunque ya esté aprobado o publicado, y la tienda debe verlos. */}
      <section className={SECTION}>
        <h2 className="text-xl font-semibold text-foreground">Alertas del sistema</h2>
        {alerts.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground-secondary">
            <CheckCircle2 size={14} aria-hidden /> El sistema no detectó alertas en este torneo.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((a, i) => {
              const critical = a.level === "CRITICAL";
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle
                    size={14}
                    aria-hidden
                    className={`mt-0.5 shrink-0 ${critical ? "text-destructive" : "text-warning"}`}
                  />
                  <span className="text-foreground">
                    <span className={`font-semibold ${critical ? "text-destructive" : ""}`}>
                      {critical ? "Crítica: " : "Aviso: "}
                    </span>
                    {a.message}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <UploaderResults results={results} />
    </div>
  );
}

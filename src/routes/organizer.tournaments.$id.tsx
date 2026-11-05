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
  TournamentResults,
  TournamentSummary,
} from "@/components/panel/tournament-detail";

export const Route = createFileRoute("/organizer/tournaments/$id")({
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
    return () => { cancelled = true; };
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
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
              Motivo del rechazo
            </p>
            <p className="mt-1">{tournament.rejection_reason}</p>
            <p className="mt-2 text-gray-300">
              Elimina este torneo y vuelve a subir el archivo corregido.{" "}
              <Link
                to="/organizer/tournaments"
                search={{ tab: "rejected" }}
                className="text-primary hover:underline"
              >
                Ir a Rechazados
              </Link>
            </p>
          </div>
        )}
      </TournamentDetailHeader>

      <TournamentSummary
        tournament={tournament}
        store={store}
        game={game}
        results={results}
        uploader={uploaded_by?.geek_tag ?? "—"}
        uploaderDetail={uploaded_by?.email ?? ""}
        csvUrl={(tournament as any).csv_url}
      />

      {/* Alertas (solo lectura) */}
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <AlertTriangle size={16} className="text-primary" />
          Alertas del sistema
        </h2>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 size={14} /> Sin alertas — todo se ve bien
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                  a.level === "CRITICAL"
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                }`}
              >
                <span className="mt-0.5">{a.level === "CRITICAL" ? "🔴" : "🟡"}</span>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TournamentResults results={results} />
    </div>
  );
}

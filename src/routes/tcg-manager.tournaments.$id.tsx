import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { errMsg, formatDateTime } from "@/components/panel/dashboard-format";
import {
  TournamentDetailError,
  TournamentDetailHeader,
  TournamentDetailSkeleton,
  TournamentResults,
  TournamentSummary,
} from "@/components/panel/tournament-detail";
import {
  getManagerTournamentDetail,
  managerApproveTournament,
  managerRejectTournament,
  managerUndoApproval,
  managerRepublishTournament,
} from "@/lib/nexus-manager.functions";
import { Button } from "@/components/ui/button";
import { TournamentStatusBadge } from "@/components/admin/TournamentStatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/tcg-manager/tournaments/$id")({
  component: ManagerTournamentDetailPage,
});

type Detail = Awaited<ReturnType<typeof getManagerTournamentDetail>>;

function useCountdown(targetIso: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [targetIso]);
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return { expired: true, text: "expirada" };
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { expired: false, text: `${hours}h ${minutes}m restantes` };
}

function ManagerTournamentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchDetail = useServerFn(getManagerTournamentDetail);
  const approveFn = useServerFn(managerApproveTournament);
  const rejectFn = useServerFn(managerRejectTournament);
  const undoFn = useServerFn(managerUndoApproval);
  const republishFn = useServerFn(managerRepublishTournament);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchDetail({ data: { tournament_id: id } });
      setData(res);
    } catch (e) {
      const message = errMsg(e);
      setLoadError(message);
      if (data) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const countdown = useCountdown(data?.tournament.undo_deadline ?? null);

  const criticalCount = useMemo(
    () => (data?.alerts ?? []).filter((a) => a.level === "CRITICAL").length,
    [data],
  );

  if (loadError && !data) {
    return (
      <TournamentDetailError backTo="/tcg-manager/tournaments" message={loadError} onRetry={refresh} />
    );
  }

  if (loading || !data) return <TournamentDetailSkeleton className="space-y-6 pb-32" />;

  const { tournament, store, game, uploaded_by, results, alerts } = data;
  const isDraft = tournament.status === "DRAFT";
  const isApproved = tournament.status === "APPROVED";
  const isPublished = tournament.status === "PUBLISHED";
  const isUnpublished = tournament.status === "UNPUBLISHED";
  const undoExpired = countdown?.expired ?? true;

  const canApprove = isDraft && (criticalCount === 0 || acknowledged);

  const onApprove = async () => {
    setActing(true);
    try {
      await approveFn({ data: { tournament_id: id } });
      toast.success("Torneo aprobado");
      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActing(false);
    }
  };

  const onUndo = async () => {
    setActing(true);
    try {
      await undoFn({ data: { tournament_id: id } });
      toast.success("Aprobación deshecha");
      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActing(false);
    }
  };

  const onRepublish = async () => {
    setActing(true);
    try {
      await republishFn({ data: { tournament_id: id } });
      toast.success("Torneo re-enviado a aprobado. Estará en la próxima publicación.");
      await refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActing(false);
    }
  };

  const onConfirmReject = async () => {
    if (rejectReason.trim().length < 20) {
      toast.error("El motivo debe tener al menos 20 caracteres");
      return;
    }
    setActing(true);
    try {
      await rejectFn({ data: { tournament_id: id, reason: rejectReason.trim() } });
      toast.success("Torneo rechazado. El organizador será notificado.");
      navigate({ to: "/tcg-manager" });
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-6 pb-32">
      <TournamentDetailHeader
        backTo="/tcg-manager/tournaments"
        game={game.name}
        store={store.name}
        date={tournament.tournament_date}
        badge={
          <TournamentStatusBadge
            status={tournament.status}
            rejectionReason={tournament.rejection_reason}
          />
        }
      />

      <TournamentSummary
        tournament={tournament}
        store={store}
        game={game}
        results={results}
        uploader={uploaded_by?.geek_tag ?? "—"}
        uploaderDetail={uploaded_by?.email ?? ""}
        csvUrl={(tournament as any).csv_url}
      />

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
                className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                  a.level === "CRITICAL"
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{a.level === "CRITICAL" ? "🔴" : "🟡"}</span>
                  <span>{a.message}</span>
                </div>
                {a.link ? (
                  <a href={a.link.to} className="shrink-0 text-xs underline">
                    {a.link.label}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {isDraft && criticalCount > 0 ? (
          <label className="mt-4 flex items-start gap-2 rounded-xl bg-white/5 p-3 text-sm text-gray-200">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(!!v)}
              className="mt-0.5"
            />
            <span>Revisé las alertas críticas y confirmo que este torneo es válido</span>
          </label>
        ) : null}
      </section>

      <TournamentResults results={results} />

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-white/10 bg-background/95 p-4 backdrop-blur sm:relative sm:inset-auto sm:bottom-auto sm:z-auto sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {isDraft ? (
            <>
              <Button variant="ghost" onClick={() => setRejectOpen(true)} disabled={acting}>
                Rechazar
              </Button>
              <Button onClick={onApprove} disabled={!canApprove || acting}>
                {acting ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                Aprobar torneo ✓
              </Button>
            </>
          ) : null}

          {isApproved && !undoExpired ? (
            <>
              <span className="text-xs text-yellow-300">
                Ventana de corrección: {countdown?.text}
              </span>
              <Button variant="ghost" onClick={onUndo} disabled={acting}>
                Deshacer aprobación
              </Button>
              <Button disabled>Aprobar torneo ✓</Button>
            </>
          ) : null}

          {isApproved && undoExpired ? (
            <span className="text-xs text-gray-400">
              Este torneo está listo para publicarse el próximo domingo a las 8:00 PM
            </span>
          ) : null}

          {isPublished ? (
            <span className="text-xs text-emerald-300">
              Publicado el {tournament.published_at ? formatDateTime(tournament.published_at) : "—"}
            </span>
          ) : null}

          {isUnpublished ? (
            <>
              <span className="text-xs text-amber-300">
                Este torneo fue despublicado. Puedes volver a enviarlo a aprobación.
              </span>
              <Button onClick={onRepublish} disabled={acting}>
                {acting ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                Re-publicar torneo
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar torneo</DialogTitle>
            <DialogDescription>
              El organizador será notificado con el motivo del rechazo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="reject-reason" className="text-xs font-medium text-gray-300">
              Motivo del rechazo (mínimo 20 caracteres)
            </label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Describe por qué se rechaza este torneo…"
            />
            <p className="text-xs text-gray-500">{rejectReason.trim().length}/20</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={acting}>
              Cancelar
            </Button>
            <Button
              onClick={onConfirmReject}
              disabled={acting || rejectReason.trim().length < 20}
            >
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

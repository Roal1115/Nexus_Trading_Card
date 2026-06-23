import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Store as StoreIcon,
  Gamepad2,
  Calendar,
  User,
  Upload,
  Users,
  ChevronRight,
  FileDown,
  FileX,
} from "lucide-react";
import { FileLink } from "@/components/ui/FileLink";
import { toast } from "sonner";
import {
  getManagerTournamentDetail,
  managerApproveTournament,
  managerRejectTournament,
  managerUndoApproval,
  managerRepublishTournament,
} from "@/lib/geekarena-manager.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()} ${MESES[dt.getMonth()]} ${dt.getFullYear()}`;
}

function formatDateTime(iso: string) {
  const dt = new Date(iso);
  return `${dt.getDate()} ${MESES[dt.getMonth()]} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Borrador", cls: "bg-gray-500/20 text-gray-200 border-gray-400/30" },
    APPROVED: { label: "Aprobado", cls: "bg-yellow-500/20 text-yellow-200 border-yellow-400/40" },
    PUBLISHED: { label: "Publicado", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" },
    UNPUBLISHED: { label: "Despublicado", cls: "bg-amber-500/20 text-amber-200 border-amber-400/40" },
  };
  const v = map[status] ?? { label: status, cls: "bg-white/10 text-white border-white/20" };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${v.cls}`}>
      {v.label}
    </span>
  );
}

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
  const [acknowledged, setAcknowledged] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetchDetail({ data: { tournament_id: id } });
      setData(res);
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
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
  const newPlayersCount = useMemo(
    () => (data?.results ?? []).filter((r) => r.is_new_player).length,
    [data],
  );

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const { tournament, store, game, uploaded_by, results, alerts } = data;
  const isDraft = tournament.status === "DRAFT";
  const isApproved = tournament.status === "APPROVED";
  const isPublished = tournament.status === "PUBLISHED";
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
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link to="/tcg-manager/tournaments-panel" className="hover:text-primary">
            Torneos
          </Link>
          <ChevronRight size={12} />
          <span className="text-white">Detalle del Torneo</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tcg-manager/tournaments-panel">
              <ArrowLeft size={14} className="mr-1" /> Regresar
            </Link>
          </Button>
          {statusBadge(tournament.status)}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard icon={<StoreIcon size={16} />} title="Tienda" main={store.name} sub={[store.city, store.state].filter(Boolean).join(", ") || "—"} />
        <SummaryCard icon={<Gamepad2 size={16} />} title="Juego" main={game.name} sub="" />
        <SummaryCard
          icon={<Calendar size={16} />}
          title="Fecha"
          main={formatDate(tournament.tournament_date)}
          sub={`Semestre ${tournament.qualifying_semester} ${tournament.qualifying_year}`}
        />
        <SummaryCard
          icon={<User size={16} />}
          title="Subido por"
          main={uploaded_by?.geek_tag ?? "—"}
          sub={uploaded_by?.email ?? ""}
        />
        <SummaryCard
          icon={<Upload size={16} />}
          title="Fecha de carga"
          main={tournament.created_at ? formatDateTime(tournament.created_at) : "—"}
          sub=""
        />
        <SummaryCard
          icon={<Users size={16} />}
          title="Participantes"
          main={`${results.length} jugadores`}
          sub={newPlayersCount > 0 ? `${newPlayersCount} nuevos` : ""}
        />
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <Upload size={16} /> Archivo de resultados
          </div>
          <div className="mt-2">
            <FileLink url={(tournament as any).csv_url} label="Descargar archivo" size="md" />
          </div>
        </div>
      </section>

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

      <section className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Resultados del torneo</h2>
          <span className="text-xs text-gray-400">
            Total: {results.length} participantes
            {newPlayersCount > 0 ? ` · ${newPlayersCount} jugadores nuevos` : ""}
          </span>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Geek Tag</th>
                <th className="px-4 py-3 whitespace-nowrap">Match Pts</th>
                <th className="px-4 py-3 whitespace-nowrap">OMW%</th>
                <th className="px-4 py-3 whitespace-nowrap">Pts Arena</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={`${r.rank}-${r.geek_tag}`} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold text-white">{r.rank}</td>
                  <td className="px-4 py-3 text-gray-200">{r.geek_tag}</td>
                  <td className="px-4 py-3 text-gray-300">{r.match_points ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {typeof r.omw_percentage === "number" ? `${r.omw_percentage.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">{r.points_earned}</td>
                  <td className="px-4 py-3">
                    {r.is_new_player ? (
                      <Badge className="bg-orange-500/20 text-orange-200 border-orange-400/40">Nuevo</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40">Registrado</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/95 p-4 backdrop-blur sm:relative sm:inset-auto sm:border-0 sm:bg-transparent sm:p-0">
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
            <label className="text-xs font-medium text-gray-300">
              Motivo del rechazo (mínimo 20 caracteres)
            </label>
            <Textarea
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

function SummaryCard({
  icon,
  title,
  main,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  main: string;
  sub: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
        {icon} {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{main || "—"}</div>
      {sub ? <div className="text-xs text-gray-400">{sub}</div> : null}
    </div>
  );
}

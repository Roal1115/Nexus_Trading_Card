import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  RefreshCw,
  ScrollText,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  fetchActiveSeason,
  getAdminTournamentHistory,
  listAuditLog,
  listTournamentsByStatus,
  type AuditLogRow,
} from "@/lib/nexus-admin.functions";
import { getManagerApprovedTournaments } from "@/lib/nexus-manager.functions";
import { INELIGIBLE_LABELS } from "@/lib/tournament-state";
import { ACTION_LABELS } from "@/components/admin/audit-actions";
import { LoadError, Loading, Panel } from "@/components/panel/dashboard";
import {
  ago,
  errMsg,
  fmtDayTime,
  fmtTournamentDate,
  footerLink,
  reasonsText,
  rowLink,
  type Section,
} from "@/components/panel/dashboard-format";
import {
  publicationOutlook,
  schedulerStatus,
  type PublicationOutlook,
  type RunEvent,
  type SchedulerStatus,
} from "@/components/admin/admin-home";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Inicio — Admin" }] }),
  component: AdminHome,
});

// Igual que el detalle del torneo: la fecha automática solo se anuncia con el flag.
const SCHEDULED_PUBLISHING_ACTIVE = import.meta.env.VITE_SCHEDULED_PUBLISHING === "true";
const PENDING_SHOWN = 5;
const ACTIVITY_SHOWN = 6;

// ---------- Datos ----------
type PendingRow = {
  id: string;
  tournament_date: string;
  created_at: string;
  game_name: string;
  store: { name: string; city: string | null };
};
type ApprovedRow = {
  id: string;
  tournament_date: string;
  status: string;
  rejection_reason: string | null;
  game_name: string;
  store_name: string;
  participants: number;
};
type Upcoming = ApprovedRow & { outlook: PublicationOutlook };
type Season = { name: string; start_date: string; end_date: string } | null;

function AdminHome() {
  const { player } = useNexusRole();
  const email = player?.email ?? null;

  const fetchPending = useServerFn(listTournamentsByStatus);
  const fetchHistory = useServerFn(getAdminTournamentHistory);
  const fetchApprovedWindows = useServerFn(getManagerApprovedTournaments);
  const fetchSeason = useServerFn(fetchActiveSeason);
  const fetchAudit = useServerFn(listAuditLog);

  const [now, setNow] = useState(() => new Date());
  const [tournaments, setTournaments] = useState<
    Section<{ pending: PendingRow[]; upcoming: Upcoming[]; season: Season }>
  >({ state: "loading" });
  const [activity, setActivity] = useState<Section<AuditLogRow[]>>({ state: "loading" });
  const [system, setSystem] = useState<Section<SchedulerStatus>>({ state: "loading" });

  const load = useCallback(async () => {
    const at = new Date();
    setNow(at);
    setTournaments({ state: "loading" });
    setActivity({ state: "loading" });
    setSystem({ state: "loading" });

    const loadTournaments = async () => {
      // Aprobados con su número de resultados (getAdminTournamentHistory pagina de 25).
      const approved: ApprovedRow[] = [];
      for (let page = 1; ; page++) {
        const res = await fetchHistory({ data: { status: "APPROVED", page } });
        approved.push(...(res.tournaments as ApprovedRow[]));
        if (approved.length >= res.total || res.tournaments.length === 0) break;
      }
      const [pending, windows, season] = await Promise.all([
        fetchPending({ data: { statuses: ["DRAFT"] } }),
        // Única query existente que trae undo_deadline de los aprobados (admin ve todos los TCG activos).
        fetchApprovedWindows({ data: {} as never }),
        fetchSeason(),
      ]);
      const deadlines = new Map(
        (windows as { id: string; undo_deadline: string | null }[]).map((w) => [
          w.id,
          w.undo_deadline,
        ]),
      );
      const upcoming = approved
        .map((t) => ({
          ...t,
          outlook: publicationOutlook(
            {
              status: t.status,
              rejection_reason: t.rejection_reason,
              undo_deadline: deadlines.get(t.id) ?? null,
              tournament_date: t.tournament_date,
            },
            season ? { start_date: season.start_date, end_date: season.end_date } : null,
            t.participants,
            at,
          ),
        }))
        .sort((a, b) => a.tournament_date.localeCompare(b.tournament_date));
      return {
        pending: (pending.tournaments as PendingRow[]).sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        ),
        upcoming,
        season: (season as Season) ?? null,
      };
    };

    const loadSystem = async () => {
      const [started, finished] = await Promise.all([
        fetchAudit({ data: { action: "SCHEDULED_PUBLICATION_RUN_STARTED", page: 1 } }),
        fetchAudit({ data: { action: "SCHEDULED_PUBLICATION_RUN_FINISHED", page: 1 } }),
      ]);
      return schedulerStatus(
        (started.logs[0] as RunEvent | undefined) ?? null,
        (finished.logs[0] as RunEvent | undefined) ?? null,
        at,
      );
    };

    await Promise.all([
      loadTournaments().then(
        (data) => setTournaments({ state: "ok", data }),
        (e) => setTournaments({ state: "error", message: errMsg(e) }),
      ),
      fetchAudit({ data: { page: 1 } }).then(
        (res) => setActivity({ state: "ok", data: res.logs.slice(0, ACTIVITY_SHOWN) }),
        (e) => setActivity({ state: "error", message: errMsg(e) }),
      ),
      loadSystem().then(
        (data) => setSystem({ state: "ok", data }),
        (e) => setSystem({ state: "error", message: errMsg(e) }),
      ),
    ]);
  }, [fetchHistory, fetchPending, fetchApprovedWindows, fetchSeason, fetchAudit]);

  useEffect(() => {
    if (email) void load();
  }, [email, load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Operación</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Inicio</h1>
          <p className="mt-1 text-sm text-gray-400">Lo que necesita tu atención hoy.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} aria-label="Actualizar Inicio">
            <RefreshCw size={14} aria-hidden />
          </Button>
          <Button asChild>
            <Link to="/admin/upload">
              <Upload size={14} className="mr-1" aria-hidden />
              Subir torneo
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <AttentionSection tournaments={tournaments} system={system} now={now} onRetry={load} />
          <UpcomingSection tournaments={tournaments} onRetry={load} />
          <ActivitySection activity={activity} now={now} onRetry={load} />
        </div>
        <div className="min-w-0">
          <SystemSection system={system} tournaments={tournaments} onRetry={load} />
        </div>
      </div>
    </div>
  );
}

function AttentionSection({
  tournaments,
  system,
  now,
  onRetry,
}: {
  tournaments: Section<{ pending: PendingRow[]; upcoming: Upcoming[]; season: Season }>;
  system: Section<SchedulerStatus>;
  now: Date;
  onRetry: () => void;
}) {
  if (tournaments.state !== "ok") {
    return (
      <Panel id="attention" title="Necesita atención" busy={tournaments.state === "loading"}>
        {tournaments.state === "loading" ? (
          <Loading />
        ) : (
          <LoadError message={tournaments.message} onRetry={onRetry} />
        )}
      </Panel>
    );
  }
  const { pending, upcoming, season } = tournaments.data;
  const blocked = upcoming.filter((t) => t.outlook.blockers.length > 0);
  const schedulerProblem =
    system.state === "ok" && (system.data.tone === "danger" || system.data.tone === "warning");
  const total = pending.length + blocked.length + (season ? 0 : 1) + (schedulerProblem ? 1 : 0);

  return (
    <Panel
      id="attention"
      title="Necesita atención"
      count={total}
      footer={
        pending.length > PENDING_SHOWN ? (
          <Link to="/admin/tournaments" className={footerLink}>
            Ver los {pending.length} torneos por revisar <ArrowRight size={14} aria-hidden />
          </Link>
        ) : undefined
      }
    >
      {total === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-200">
          <CheckCircle2 size={16} aria-hidden /> Todo al día: no hay nada que requiera tu acción.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {!season && (
            <li>
              <Link to="/admin/seasons" className={rowLink}>
                <AlertTriangle size={16} className="shrink-0 text-red-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    No hay temporada activa
                  </span>
                  <span className="block text-xs text-gray-400">
                    Ningún torneo se puede publicar hasta activar una.
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Temporadas</span>
              </Link>
            </li>
          )}
          {schedulerProblem && system.state === "ok" && (
            <li>
              <Link to="/admin/activity" className={rowLink}>
                <AlertTriangle size={16} className="shrink-0 text-red-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">{system.data.title}</span>
                  {system.data.detail && (
                    <span className="block text-xs text-gray-400">{system.data.detail}</span>
                  )}
                </span>
                <span className="text-xs font-semibold text-primary">Registro</span>
              </Link>
            </li>
          )}
          {pending.slice(0, PENDING_SHOWN).map((t) => (
            <li key={t.id}>
              <Link to="/admin/tournaments/$id" params={{ id: t.id }} className={rowLink}>
                <Clock size={16} className="shrink-0 text-yellow-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    Revisar: {t.store.name} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-gray-400 sm:truncate">
                    {t.game_name} · subido {ago(t.created_at, now)}
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Revisar</span>
              </Link>
            </li>
          ))}
          {blocked.map((t) => (
            <li key={t.id}>
              <Link to="/admin/tournaments/$id" params={{ id: t.id }} className={rowLink}>
                <AlertTriangle size={16} className="shrink-0 text-orange-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    No se publicará: {t.store_name} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-gray-400 sm:truncate">
                    {reasonsText(t.outlook.blockers)}
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Ver</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function UpcomingSection({
  tournaments,
  onRetry,
}: {
  tournaments: Section<{ upcoming: Upcoming[] }>;
  onRetry: () => void;
}) {
  const footer = (
    <Link to="/admin/tournaments" search={{ tab: "approved" }} className={footerLink}>
      Ver aprobados en Torneos <ArrowRight size={14} aria-hidden />
    </Link>
  );
  if (tournaments.state !== "ok") {
    return (
      <Panel id="upcoming" title="Próximamente" busy={tournaments.state === "loading"}>
        {tournaments.state === "loading" ? (
          <Loading />
        ) : (
          <LoadError message={tournaments.message} onRetry={onRetry} />
        )}
      </Panel>
    );
  }
  // Los bloqueados ya están en "Necesita atención".
  const ready = tournaments.data.upcoming.filter((t) => t.outlook.blockers.length === 0);
  return (
    <Panel id="upcoming" title="Próximamente" count={ready.length} footer={footer}>
      {ready.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">
          No hay torneos aprobados esperando publicación.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {ready.map((t) => (
            <li key={t.id}>
              <Link
                to="/admin/tournaments/$id"
                params={{ id: t.id }}
                className={`${rowLink} flex-wrap sm:flex-nowrap`}
              >
                <CalendarClock size={16} className="shrink-0 text-sky-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    {t.store_name} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-gray-400 sm:truncate">
                    {t.game_name}
                    {t.outlook.windowOpenUntil &&
                      ` · ${INELIGIBLE_LABELS.correction_window} hasta ${fmtDayTime(t.outlook.windowOpenUntil)}`}
                  </span>
                </span>
                <span className="basis-full pl-7 text-xs font-semibold text-sky-200 sm:basis-auto sm:shrink-0 sm:pl-0 sm:text-right">
                  {SCHEDULED_PUBLISHING_ACTIVE && t.outlook.date
                    ? `Se publica ${fmtDayTime(t.outlook.date)}`
                    : "Pendiente de publicación"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ActivitySection({
  activity,
  now,
  onRetry,
}: {
  activity: Section<AuditLogRow[]>;
  now: Date;
  onRetry: () => void;
}) {
  const footer = (
    <Link to="/admin/activity" className={footerLink}>
      Ver registro completo <ArrowRight size={14} aria-hidden />
    </Link>
  );
  return (
    <Panel
      id="activity"
      title="Actividad reciente"
      footer={footer}
      busy={activity.state === "loading"}
    >
      {activity.state === "loading" ? (
        <Loading />
      ) : activity.state === "error" ? (
        <LoadError message={activity.message} onRetry={onRetry} />
      ) : activity.data.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">Todavía no hay actividad registrada.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {activity.data.map((log) => {
            const info = ACTION_LABELS[log.action] ?? {
              label: log.action,
              icon: "•",
              color: "text-gray-400",
            };
            const body = (
              <>
                <span aria-hidden className="w-5 shrink-0 text-center">
                  {info.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${info.color}`}>{info.label}</span>
                  <span className="block text-xs text-gray-400 sm:truncate">
                    {log.target_label} · {log.actor_tag}
                  </span>
                </span>
                <time dateTime={log.created_at} className="shrink-0 text-xs text-gray-500">
                  {ago(log.created_at, now)}
                </time>
              </>
            );
            return (
              <li key={log.id}>
                {log.target_type === "tournament" && log.target_id ? (
                  <Link
                    to="/admin/tournaments/$id"
                    params={{ id: log.target_id }}
                    className={rowLink}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-11 items-center gap-3 px-5 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const TONE: Record<SchedulerStatus["tone"], { cls: string; label: string }> = {
  success: { cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200", label: "OK" },
  info: { cls: "border-sky-400/40 bg-sky-500/15 text-sky-200", label: "Info" },
  warning: { cls: "border-yellow-400/40 bg-yellow-500/15 text-yellow-200", label: "Atención" },
  danger: { cls: "border-red-400/40 bg-red-500/15 text-red-200", label: "Falla" },
};

function SystemSection({
  system,
  tournaments,
  onRetry,
}: {
  system: Section<SchedulerStatus>;
  tournaments: Section<{ season: Season }>;
  onRetry: () => void;
}) {
  const season = tournaments.state === "ok" ? tournaments.data.season : undefined;
  return (
    <Panel
      id="system"
      title="Sistema"
      busy={system.state === "loading"}
      footer={
        <Link to="/admin/activity" className={footerLink}>
          <ScrollText size={14} aria-hidden /> Registro
        </Link>
      }
    >
      <div className="space-y-4 px-5 py-4 text-sm">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Publicación programada
          </h3>
          {system.state === "loading" ? (
            <Loading className="py-2" />
          ) : system.state === "error" ? (
            <LoadError message={system.message} onRetry={onRetry} className="py-2" />
          ) : (
            <div className="mt-2 space-y-1">
              <p className="flex items-start gap-2">
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[system.data.tone].cls}`}
                >
                  {TONE[system.data.tone].label}
                </span>
                <span className="font-medium text-white">{system.data.title}</span>
              </p>
              {system.data.detail && <p className="text-xs text-gray-400">{system.data.detail}</p>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1 text-xs">
                <dt className="text-gray-500">Última</dt>
                <dd className="text-gray-200">
                  {system.data.lastRunAt ? fmtDayTime(system.data.lastRunAt) : "—"}
                </dd>
                <dt className="text-gray-500">Próxima</dt>
                <dd className="text-gray-200">{fmtDayTime(system.data.nextRunAt)}</dd>
              </dl>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Temporada activa
          </h3>
          <p className="mt-1 text-gray-200">
            {season === undefined
              ? "…"
              : season
                ? `${season.name} · ${season.start_date} → ${season.end_date}`
                : "Ninguna"}
          </p>
        </div>
      </div>
    </Panel>
  );
}

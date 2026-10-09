import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { fetchActiveSeason } from "@/lib/nexus-admin.functions";
import {
  getManagerApprovedTournaments,
  getManagerCalendar,
  getManagerHistory,
  getManagerPendingTournaments,
  getManagerTournamentHistory,
} from "@/lib/nexus-manager.functions";
import { publicationOutlook, type PublicationOutlook } from "@/components/admin/admin-home";
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

export const Route = createFileRoute("/tcg-manager/")({
  head: () => ({ meta: [{ title: "Inicio — TCG Manager" }] }),
  component: ManagerHome,
});

// Igual que el detalle del torneo y el Inicio del admin.
const SCHEDULED_PUBLISHING_ACTIVE = import.meta.env.VITE_SCHEDULED_PUBLISHING === "true";
const PENDING_SHOWN = 5;
const WEEK_SHOWN = 6;
const MINE_SHOWN = 5;

type TournamentRef = {
  id: string;
  tournament_date: string;
  stores: { name: string; city: string | null } | null;
  games: { name: string } | null;
};
type PendingRow = TournamentRef & { created_at: string };
type ApprovedRow = TournamentRef & { status: string; undo_deadline: string | null };
type Upcoming = ApprovedRow & { outlook: PublicationOutlook };
type CalendarEntry = {
  date: string;
  start_time: string;
  store_name: string;
  game_name: string;
  report_status: "submitted" | "overdue" | "pending" | "upcoming";
  is_today: boolean;
};
type ReviewEntry = {
  id: string;
  action: string;
  created_at: string;
  tournament_id: string | null;
  tournament_date: string | null;
  store_name: string;
  game_name: string;
};

const REVIEW_LABELS: Record<string, { label: string; color: string }> = {
  TOURNAMENT_APPROVED: { label: "Aprobaste", color: "text-green-400" },
  TOURNAMENT_REJECTED: { label: "Rechazaste", color: "text-red-400" },
  APPROVAL_UNDONE: { label: "Deshiciste una aprobación", color: "text-yellow-400" },
};

const storeOf = (t: TournamentRef) => t.stores?.name ?? "—";
const gameOf = (t: TournamentRef) => t.games?.name ?? "—";
const byDateTime = (a: CalendarEntry, b: CalendarEntry) =>
  (a.date + a.start_time).localeCompare(b.date + b.start_time);

function ManagerHome() {
  const { player } = useNexusRole();
  const email = player?.email ?? null;

  const fetchPending = useServerFn(getManagerPendingTournaments);
  const fetchApproved = useServerFn(getManagerApprovedTournaments);
  const fetchHistory = useServerFn(getManagerTournamentHistory);
  const fetchSeason = useServerFn(fetchActiveSeason);
  const fetchCalendar = useServerFn(getManagerCalendar);
  const fetchReviews = useServerFn(getManagerHistory);

  const [now, setNow] = useState(() => new Date());
  const [tournaments, setTournaments] = useState<
    Section<{ pending: PendingRow[]; upcoming: Upcoming[] }>
  >({ state: "loading" });
  const [week, setWeek] = useState<Section<CalendarEntry[]>>({ state: "loading" });
  const [mine, setMine] = useState<Section<ReviewEntry[]>>({ state: "loading" });

  const load = useCallback(async () => {
    const at = new Date();
    setNow(at);
    setTournaments({ state: "loading" });
    setWeek({ state: "loading" });
    setMine({ state: "loading" });

    const loadTournaments = async () => {
      // Número de resultados de los aprobados (la query de historial pagina de 25).
      const participants = new Map<string, number>();
      for (let page = 1, seen = 0; ; page++) {
        const res = await fetchHistory({ data: { status: "APPROVED", page } });
        for (const t of res.tournaments as { id: string; participants: number }[])
          participants.set(t.id, t.participants);
        seen += res.tournaments.length;
        if (seen >= res.total || res.tournaments.length === 0) break;
      }
      const [pending, approved, season] = await Promise.all([
        fetchPending(),
        fetchApproved(),
        fetchSeason(),
      ]);
      const seasonRange = season
        ? { start_date: season.start_date, end_date: season.end_date }
        : null;
      return {
        pending: (pending as PendingRow[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
        upcoming: (approved as ApprovedRow[])
          .map((t) => ({
            ...t,
            outlook: publicationOutlook(
              {
                status: t.status,
                rejection_reason: null,
                undo_deadline: t.undo_deadline,
                tournament_date: t.tournament_date,
              },
              seasonRange,
              participants.get(t.id) ?? 0,
              at,
            ),
          }))
          .sort((a, b) => a.tournament_date.localeCompare(b.tournament_date)),
      };
    };

    await Promise.all([
      loadTournaments().then(
        (data) => setTournaments({ state: "ok", data }),
        (e) => setTournaments({ state: "error", message: errMsg(e) }),
      ),
      fetchCalendar({ data: {} }).then(
        (res) => setWeek({ state: "ok", data: (res.entries as CalendarEntry[]).sort(byDateTime) }),
        (e) => setWeek({ state: "error", message: errMsg(e) }),
      ),
      fetchReviews({ data: { page: 1 } }).then(
        (res) =>
          setMine({ state: "ok", data: (res.entries as ReviewEntry[]).slice(0, MINE_SHOWN) }),
        (e) => setMine({ state: "error", message: errMsg(e) }),
      ),
    ]);
  }, [fetchPending, fetchApproved, fetchHistory, fetchSeason, fetchCalendar, fetchReviews]);

  useEffect(() => {
    if (email) void load();
  }, [email, load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Moderación
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Inicio</h1>
          <p className="mt-1 text-sm text-gray-400">Lo que necesita tu revisión en tus TCGs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} aria-label="Actualizar Inicio">
            <RefreshCw size={14} aria-hidden />
          </Button>
          <Button asChild>
            <Link to="/tcg-manager/upload">
              <Upload size={14} className="mr-1" aria-hidden />
              Subir torneo
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <AttentionSection tournaments={tournaments} week={week} now={now} onRetry={load} />
          <UpcomingSection tournaments={tournaments} onRetry={load} />
        </div>
        <div className="min-w-0 space-y-6">
          <WeekSection week={week} onRetry={load} />
          <MineSection mine={mine} now={now} onRetry={load} />
        </div>
      </div>
    </div>
  );
}

function AttentionSection({
  tournaments,
  week,
  now,
  onRetry,
}: {
  tournaments: Section<{ pending: PendingRow[]; upcoming: Upcoming[] }>;
  week: Section<CalendarEntry[]>;
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
  const { pending, upcoming } = tournaments.data;
  const blocked = upcoming.filter((t) => t.outlook.blockers.length > 0);
  // Tiendas que ya jugaron esta semana y no han subido resultados.
  const overdue = week.state === "ok" ? week.data.filter((e) => e.report_status === "overdue") : [];
  const total = pending.length + blocked.length + overdue.length;

  return (
    <Panel
      id="attention"
      title="Necesita atención"
      count={total}
      footer={
        pending.length > PENDING_SHOWN ? (
          <Link to="/tcg-manager/tournaments" className={footerLink}>
            Ver los {pending.length} torneos por revisar <ArrowRight size={14} aria-hidden />
          </Link>
        ) : undefined
      }
    >
      {total === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-200">
          <CheckCircle2 size={16} aria-hidden /> Todo al día: no hay torneos que revisar.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {pending.slice(0, PENDING_SHOWN).map((t) => (
            <li key={t.id}>
              <Link to="/tcg-manager/tournaments/$id" params={{ id: t.id }} className={rowLink}>
                <Clock size={16} className="shrink-0 text-yellow-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    Revisar: {storeOf(t)} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-gray-400 sm:truncate">
                    {gameOf(t)} · subido {ago(t.created_at, now)}
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Revisar</span>
              </Link>
            </li>
          ))}
          {overdue.map((e) => (
            <li key={`${e.store_name}-${e.date}-${e.game_name}`}>
              <Link to="/tcg-manager/calendar" className={rowLink}>
                <AlertTriangle size={16} className="shrink-0 text-red-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    Sin resultados: {e.store_name} · {fmtTournamentDate(e.date)}
                  </span>
                  <span className="block text-xs text-gray-400 sm:truncate">
                    {e.game_name} · el torneo ya se jugó y la tienda no ha subido resultados
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Calendario</span>
              </Link>
            </li>
          ))}
          {blocked.map((t) => (
            <li key={t.id}>
              <Link to="/tcg-manager/tournaments/$id" params={{ id: t.id }} className={rowLink}>
                <AlertTriangle size={16} className="shrink-0 text-orange-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    No se publicará: {storeOf(t)} · {fmtTournamentDate(t.tournament_date)}
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
    <Link to="/tcg-manager/tournaments" search={{ tab: "approved" }} className={footerLink}>
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
                to="/tcg-manager/tournaments/$id"
                params={{ id: t.id }}
                className={`${rowLink} flex-wrap sm:flex-nowrap`}
              >
                <CalendarClock size={16} className="shrink-0 text-sky-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    {storeOf(t)} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-gray-400 sm:truncate">
                    {gameOf(t)}
                    {t.outlook.windowOpenUntil &&
                      ` · puedes deshacer hasta ${fmtDayTime(t.outlook.windowOpenUntil)}`}
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

function WeekSection({ week, onRetry }: { week: Section<CalendarEntry[]>; onRetry: () => void }) {
  const upcoming =
    week.state === "ok"
      ? week.data.filter((e) => e.report_status === "upcoming" || e.is_today).slice(0, WEEK_SHOWN)
      : [];
  return (
    <Panel
      id="week"
      title="Esta semana"
      busy={week.state === "loading"}
      footer={
        <Link to="/tcg-manager/calendar" className={footerLink}>
          Ver calendario <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      {week.state === "loading" ? (
        <Loading />
      ) : week.state === "error" ? (
        <LoadError message={week.message} onRetry={onRetry} />
      ) : upcoming.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">
          No hay más torneos programados esta semana en tus tiendas.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {upcoming.map((e) => (
            <li
              key={`${e.store_name}-${e.date}-${e.game_name}`}
              className="flex min-h-11 items-center gap-3 px-5 py-3"
            >
              <CalendarDays size={16} className="shrink-0 text-gray-400" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-white">{e.store_name}</span>
                <span className="block text-xs text-gray-400">{e.game_name}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-gray-300">
                {e.is_today ? "Hoy" : fmtTournamentDate(e.date)}
                <span className="block text-gray-500">{e.start_time}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MineSection({
  mine,
  now,
  onRetry,
}: {
  mine: Section<ReviewEntry[]>;
  now: Date;
  onRetry: () => void;
}) {
  return (
    <Panel
      id="mine"
      title="Mi actividad"
      busy={mine.state === "loading"}
      footer={
        <Link to="/tcg-manager/tournaments" search={{ tab: "mine" }} className={footerLink}>
          Ver revisados por mí <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      {mine.state === "loading" ? (
        <Loading />
      ) : mine.state === "error" ? (
        <LoadError message={mine.message} onRetry={onRetry} />
      ) : mine.data.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">Todavía no has revisado torneos.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {mine.data.map((e) => {
            const info = REVIEW_LABELS[e.action] ?? { label: e.action, color: "text-gray-300" };
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${info.color}`}>{info.label}</span>
                  <span className="block text-xs text-gray-400">
                    {e.store_name}
                    {e.tournament_date && ` · ${fmtTournamentDate(e.tournament_date)}`}
                  </span>
                </span>
                <time dateTime={e.created_at} className="shrink-0 text-xs text-gray-500">
                  {ago(e.created_at, now)}
                </time>
              </>
            );
            return (
              <li key={e.id}>
                {e.tournament_id ? (
                  <Link
                    to="/tcg-manager/tournaments/$id"
                    params={{ id: e.tournament_id }}
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

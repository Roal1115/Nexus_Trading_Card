import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
  Scale,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  getMyTournaments,
  getOrganizerBadgeCounts,
  getOrganizerCalendar,
} from "@/lib/nexus-organizer.functions";
import { TournamentStatusBadge } from "@/components/admin/TournamentStatusBadge";
import { LoadError, Loading, Panel } from "@/components/panel/dashboard";
import {
  errMsg,
  fmtTournamentDate,
  footerLink,
  rowLink,
  type Section,
} from "@/components/panel/dashboard-format";
import { tournamentsByTab, weekOutlook } from "@/components/organizer/organizer-home";

export const Route = createFileRoute("/organizer/")({
  head: () => ({ meta: [{ title: "Inicio — Organizador" }] }),
  component: OrganizerHome,
});

type TournamentRow = {
  id: string;
  tournament_date: string;
  status: string;
  rejection_reason?: string | null;
  game_name: string;
  participants?: number;
};
type CalendarEntry = {
  id: string;
  date: string;
  start_time: string;
  game_name: string;
  league_name: string | null;
  report_status: "submitted" | "overdue" | "pending" | "upcoming";
  is_today: boolean;
};
type HomeData = {
  storeName: string | null;
  rejected: TournamentRow[];
  sent: TournamentRow[];
};

function OrganizerHome() {
  const { player } = useNexusRole();

  const fetchTournaments = useServerFn(getMyTournaments);
  const fetchCalendar = useServerFn(getOrganizerCalendar);
  const fetchCounts = useServerFn(getOrganizerBadgeCounts);

  const [tournaments, setTournaments] = useState<Section<HomeData>>({ state: "loading" });
  const [week, setWeek] = useState<
    Section<{ overdue: CalendarEntry[]; upcoming: CalendarEntry[] }>
  >({
    state: "loading",
  });
  const [appeals, setAppeals] = useState<Section<number>>({ state: "loading" });

  const load = useCallback(async () => {
    setTournaments({ state: "loading" });
    setWeek({ state: "loading" });
    setAppeals({ state: "loading" });
    await Promise.all([
      fetchTournaments({ data: {} }).then(
        (res) => {
          const tabs = tournamentsByTab(res.tournaments as TournamentRow[]);
          setTournaments({
            state: "ok",
            data: {
              storeName: res.store_name,
              rejected: tabs.rejected,
              // En revisión primero, luego aprobados esperando publicación.
              sent: [...tabs.pending, ...tabs.approved],
            },
          });
        },
        (e) => setTournaments({ state: "error", message: errMsg(e) }),
      ),
      fetchCalendar({ data: {} }).then(
        (res) => setWeek({ state: "ok", data: weekOutlook(res.entries as CalendarEntry[]) }),
        (e) => setWeek({ state: "error", message: errMsg(e) }),
      ),
      fetchCounts().then(
        (res) => setAppeals({ state: "ok", data: res.appeals }),
        (e) => setAppeals({ state: "error", message: errMsg(e) }),
      ),
    ]);
  }, [fetchTournaments, fetchCalendar, fetchCounts]);

  useEffect(() => {
    if (player) void load();
  }, [player?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const storeName = tournaments.state === "ok" ? tournaments.data.storeName : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Mi tienda</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Inicio</h1>
          <p className="mt-1 text-sm text-gray-400">
            {storeName ? `${storeName}: ` : ""}lo que necesita tu acción y el estado de tus torneos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} aria-label="Actualizar Inicio">
            <RefreshCw size={14} aria-hidden />
          </Button>
          <Button asChild>
            <Link to="/organizer/new">
              <Upload size={14} className="mr-1" aria-hidden />
              Subir torneo
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <AttentionSection
            tournaments={tournaments}
            week={week}
            appeals={appeals}
            onRetry={load}
          />
          <SentSection tournaments={tournaments} onRetry={load} />
        </div>
        <div className="min-w-0">
          <WeekSection week={week} onRetry={load} />
        </div>
      </div>
    </div>
  );
}

function AttentionSection({
  tournaments,
  week,
  appeals,
  onRetry,
}: {
  tournaments: Section<HomeData>;
  week: Section<{ overdue: CalendarEntry[] }>;
  appeals: Section<number>;
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
  const { rejected } = tournaments.data;
  const overdue = week.state === "ok" ? week.data.overdue : [];
  const pendingAppeals = appeals.state === "ok" ? appeals.data : 0;
  const total = rejected.length + overdue.length + (pendingAppeals > 0 ? 1 : 0);

  return (
    <Panel id="attention" title="Necesita atención" count={total}>
      {total === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-200">
          <CheckCircle2 size={16} aria-hidden /> Todo al día: no hay nada que requiera tu acción.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {rejected.map((t) => (
            <li key={t.id}>
              <Link to="/organizer/tournaments/$id" params={{ id: t.id }} className={rowLink}>
                <XCircle size={16} className="shrink-0 text-red-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    Rechazado: {t.game_name} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-gray-400">
                    Motivo: {t.rejection_reason}. Elimínalo y vuelve a subir el archivo corregido.
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Ver</span>
              </Link>
            </li>
          ))}
          {overdue.map((e) => (
            <li key={e.id + e.date}>
              <Link to="/organizer/new" className={rowLink}>
                <AlertTriangle size={16} className="shrink-0 text-orange-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    Sube los resultados: {e.game_name} · {fmtTournamentDate(e.date)}
                  </span>
                  <span className="block text-xs text-gray-400">
                    El torneo de las {e.start_time} ya se jugó y aún no tiene resultados.
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Subir</span>
              </Link>
            </li>
          ))}
          {pendingAppeals > 0 && (
            <li>
              <Link to="/organizer/appeals" className={rowLink}>
                <Scale size={16} className="shrink-0 text-yellow-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    {pendingAppeals === 1
                      ? "1 apelación pendiente"
                      : `${pendingAppeals} apelaciones pendientes`}
                  </span>
                  <span className="block text-xs text-gray-400">
                    Jugadores que disputan un resultado de tu tienda.
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Resolver</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

function SentSection({
  tournaments,
  onRetry,
}: {
  tournaments: Section<HomeData>;
  onRetry: () => void;
}) {
  const footer = (
    <Link to="/organizer/tournaments" className={footerLink}>
      Ver todos tus torneos <ArrowRight size={14} aria-hidden />
    </Link>
  );
  return (
    <Panel
      id="sent"
      title="Tus torneos enviados"
      count={tournaments.state === "ok" ? tournaments.data.sent.length : undefined}
      busy={tournaments.state === "loading"}
      footer={footer}
    >
      {tournaments.state === "loading" ? (
        <Loading />
      ) : tournaments.state === "error" ? (
        <LoadError message={tournaments.message} onRetry={onRetry} />
      ) : tournaments.data.sent.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">
          No tienes torneos en revisión ni esperando publicación.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {tournaments.data.sent.map((t) => (
            <li key={t.id}>
              <Link
                to="/organizer/tournaments/$id"
                params={{ id: t.id }}
                className={`${rowLink} flex-wrap sm:flex-nowrap`}
              >
                <Clock size={16} className="shrink-0 text-sky-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    {t.game_name} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {t.status === "APPROVED"
                      ? "Aprobado; se hará público cuando se publique."
                      : "Esperando revisión de un administrador o TCG Manager."}
                  </span>
                </span>
                <span className="basis-full pl-7 sm:basis-auto sm:pl-0">
                  <TournamentStatusBadge
                    status={t.status}
                    rejectionReason={t.rejection_reason}
                    size="sm"
                    audience="uploader"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function WeekSection({
  week,
  onRetry,
}: {
  week: Section<{ upcoming: CalendarEntry[] }>;
  onRetry: () => void;
}) {
  return (
    <Panel
      id="week"
      title="Esta semana"
      busy={week.state === "loading"}
      footer={
        <Link to="/organizer/calendar" className={footerLink}>
          Ver calendario <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      {week.state === "loading" ? (
        <Loading />
      ) : week.state === "error" ? (
        <LoadError message={week.message} onRetry={onRetry} />
      ) : week.data.upcoming.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">
          No hay más torneos programados esta semana en tu tienda.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {week.data.upcoming.map((e) => (
            <li key={e.id + e.date} className="flex min-h-11 items-center gap-3 px-5 py-3">
              <CalendarDays size={16} className="shrink-0 text-gray-400" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-white">{e.game_name}</span>
                {e.league_name && (
                  <span className="block text-xs text-gray-400">{e.league_name}</span>
                )}
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

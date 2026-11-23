import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  Scale,
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
import { HomeInsights } from "@/components/organizer/HomeInsights";
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
  game_id: string;
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
      {/* "Subir torneo" vive en el sidebar y en la BottomNav: aquí no se repite (Scarce Cyan). */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-foreground">Inicio</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            {storeName ? `${storeName}: ` : ""}lo que necesita tu acción y el estado de tus torneos.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0 sm:size-9"
          onClick={() => void load()}
          aria-label="Actualizar Inicio"
        >
          <RefreshCw size={14} aria-hidden />
        </Button>
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
      <HomeInsights enabled={!!player} />
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
  // Cada apelación cuenta: el badge debe coincidir con "N apelaciones" y con el sidebar.
  const total = rejected.length + overdue.length + pendingAppeals;

  return (
    <Panel id="attention" title="Necesita atención" count={total}>
      {total === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-foreground-secondary">
          <CheckCircle2 size={16} className="text-success" aria-hidden /> Todo al día: no hay nada
          que requiera tu acción.
        </p>
      ) : (
        // Por gravedad: resultados atrasados, rechazados y apelaciones.
        <ul className="divide-y divide-border">
          {overdue.map((e) => (
            <li key={e.id + e.date}>
              <Link
                to="/organizer/new"
                search={{ game: e.game_id, date: e.date }}
                className={rowLink}
              >
                <AlertTriangle size={16} className="shrink-0 text-warning" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    Sube los resultados: {e.game_name} · {fmtTournamentDate(e.date)}
                  </span>
                  <span className="block text-xs text-foreground-subtle">
                    El torneo de las {e.start_time} ya se jugó y aún no tiene resultados.
                  </span>
                </span>
                <span className={rowAction}>Subir</span>
              </Link>
            </li>
          ))}
          {rejected.map((t) => (
            <li key={t.id}>
              <Link to="/organizer/tournaments/$id" params={{ id: t.id }} className={rowLink}>
                <XCircle size={16} className="shrink-0 text-danger" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    Rechazado: {t.game_name} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-foreground-subtle">
                    Motivo: {t.rejection_reason}. Elimínalo y vuelve a subir el archivo corregido.
                  </span>
                </span>
                <span className={rowAction}>Ver</span>
              </Link>
            </li>
          ))}
          {pendingAppeals > 0 && (
            <li>
              <Link to="/organizer/appeals" className={rowLink}>
                <Scale size={16} className="shrink-0 text-warning" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {pendingAppeals === 1
                      ? "1 apelación pendiente"
                      : `${pendingAppeals} apelaciones pendientes`}
                  </span>
                  <span className="block text-xs text-foreground-subtle">
                    Jugadores que disputan un resultado de tu tienda.
                  </span>
                </span>
                <span className={rowAction}>Resolver</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

// Acción de fila: neutra, nunca cian (se repite en cada fila y competiría con lo urgente).
const rowAction = "shrink-0 text-xs font-semibold text-foreground-secondary";

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
        <p className="px-5 py-6 text-sm text-foreground-secondary">
          No tienes torneos en revisión ni esperando publicación.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {tournaments.data.sent.map((t) => (
            <li key={t.id}>
              <Link
                to="/organizer/tournaments/$id"
                params={{ id: t.id }}
                className={`${rowLink} flex-wrap sm:flex-nowrap`}
              >
                <Clock size={16} className="shrink-0 text-foreground-subtle" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {t.game_name} · {fmtTournamentDate(t.tournament_date)}
                  </span>
                  <span className="block text-xs text-foreground-subtle">
                    {t.status === "APPROVED"
                      ? "Aprobado: entra al ranking con la próxima publicación del circuito."
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
        <p className="px-5 py-6 text-sm text-foreground-secondary">
          No hay más torneos programados esta semana en tu tienda.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {week.data.upcoming.map((e) => (
            <li key={e.id + e.date} className="flex min-h-11 items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{e.game_name}</span>
                {e.league_name && (
                  <span className="block text-xs text-foreground-subtle">{e.league_name}</span>
                )}
              </span>
              <span className="shrink-0 text-right text-xs text-foreground-secondary">
                {e.is_today ? "Hoy" : fmtTournamentDate(e.date)}
                <span className="font-mono-stat block text-foreground-subtle">{e.start_time}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

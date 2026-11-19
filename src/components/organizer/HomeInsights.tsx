import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AreaChart, ResponsiveContainer } from "recharts";
import { getStoreAnalytics } from "@/lib/nexus-organizer-analytics.functions";
import {
  PLAYER_STATUSES,
  PLAYER_STATUS_COLORS,
  PLAYER_STATUS_LABELS,
  type PlayerStatus,
} from "@/lib/player-status";
import { attendanceArea } from "@/components/organizer/attendance-area";
import { LoadError, Loading, Panel } from "@/components/panel/dashboard";
import { errMsg, footerLink, type Section } from "@/components/panel/dashboard-format";

type Insights = {
  summary: Record<PlayerStatus, number>;
  trend: Array<{ week_start: string; players: number }>;
};

const playersText = (n: number) => (n === 1 ? "1 jugador" : `${n} jugadores`);

// Resumen en texto de la gráfica: es lo que lee un lector de pantalla y lo que se ve sin ejes.
function trendSummary(trend: Insights["trend"]) {
  const last = trend.at(-1);
  if (!last) return "Sin asistencia en las últimas semanas";
  const prev = trend.at(-2);
  return prev
    ? `${playersText(last.players)} esta semana · ${prev.players} la anterior`
    : `${playersText(last.players)} esta semana`;
}

// Estado de jugadores + asistencia: reutiliza getStoreAnalytics (rango por defecto).
export function HomeInsights({ enabled }: { enabled: boolean }) {
  const fetchAnalytics = useServerFn(getStoreAnalytics);
  const [s, setS] = useState<Section<Insights>>({ state: "loading" });

  const load = useCallback(() => {
    setS({ state: "loading" });
    fetchAnalytics({ data: {} }).then(
      (res) =>
        setS({
          state: "ok",
          data: {
            summary: res.category_summary as Record<PlayerStatus, number>,
            trend: (res.attendance_trend as Insights["trend"]).slice(-8),
          },
        }),
      (e) => setS({ state: "error", message: errMsg(e) }),
    );
  }, [fetchAnalytics]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const busy = s.state === "loading";
  const body = (empty: string, ok: (d: Insights) => React.ReactNode) =>
    s.state === "loading" ? (
      <Loading />
    ) : s.state === "error" ? (
      <LoadError message={s.message} onRetry={load} />
    ) : PLAYER_STATUSES.every((k) => !s.data.summary[k]) ? (
      <p className="px-5 py-6 text-sm text-foreground-secondary">{empty}</p>
    ) : (
      ok(s.data)
    );
  const footer = (
    <Link to="/organizer/analytics" className={footerLink}>
      Ver estadísticas <ArrowRight size={14} aria-hidden />
    </Link>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Panel id="player-status" title="Estado de jugadores" busy={busy} footer={footer}>
        {body("Aún no hay jugadores registrados.", (d) => (
          <ul className="divide-y divide-border">
            {PLAYER_STATUSES.map((k) => (
              <li key={k} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: PLAYER_STATUS_COLORS[k] }}
                  aria-hidden
                />
                <span className="flex-1 text-sm text-foreground-secondary">
                  {PLAYER_STATUS_LABELS[k]}
                </span>
                <span className="font-mono-stat text-sm font-semibold text-foreground">
                  {d.summary[k] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        ))}
      </Panel>
      <Panel id="attendance" title="Asistencia por semana" busy={busy} footer={footer}>
        {body("Aún no hay asistencia registrada.", (d) => (
          <Link
            to="/organizer/analytics"
            className="block px-5 py-3 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <span className="block text-sm text-foreground-secondary">{trendSummary(d.trend)}</span>
            <span aria-hidden className="mt-2 block">
              <ResponsiveContainer width="100%" height={96}>
                <AreaChart data={d.trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  {attendanceArea({ isAnimationActive: false })}
                </AreaChart>
              </ResponsiveContainer>
            </span>
          </Link>
        ))}
      </Panel>
    </div>
  );
}

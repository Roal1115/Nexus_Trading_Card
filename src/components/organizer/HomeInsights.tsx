import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { getStoreAnalytics } from "@/lib/nexus-organizer-analytics.functions";
import {
  PLAYER_STATUSES,
  PLAYER_STATUS_COLORS,
  PLAYER_STATUS_LABELS,
  type PlayerStatus,
} from "@/lib/player-status";
import { LoadError, Loading, Panel } from "@/components/panel/dashboard";
import { errMsg, footerLink, type Section } from "@/components/panel/dashboard-format";

type Insights = {
  summary: Record<PlayerStatus, number>;
  trend: Array<{ week_start: string; players: number }>;
};

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
  const body = (empty: React.ReactNode, ok: (d: Insights) => React.ReactNode) =>
    s.state === "loading" ? (
      <Loading />
    ) : s.state === "error" ? (
      <LoadError message={s.message} onRetry={load} />
    ) : PLAYER_STATUSES.every((k) => !s.data.summary[k]) ? (
      empty
    ) : (
      ok(s.data)
    );
  const empty = <p className="px-5 py-6 text-sm text-gray-400">Aún no hay jugadores registrados</p>;

  const attendance = (
    <Panel id="attendance" title="Asistencia" busy={busy}>
      {body(empty, (d) => (
        <div aria-hidden className="px-2 py-3">
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={d.trend}>
              <defs>
                <linearGradient id="homeAttendance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="players"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#homeAttendance)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ))}
    </Panel>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Panel
        id="player-status"
        title="Estado de jugadores"
        busy={busy}
        footer={
          <Link to="/organizer/analytics" className={footerLink}>
            Ver estadísticas <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        {body(empty, (d) => (
          <ul className="divide-y divide-white/5">
            {PLAYER_STATUSES.map((k) => (
              <li key={k} className="flex min-h-11 items-center gap-3 px-5 py-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: PLAYER_STATUS_COLORS[k] }}
                  aria-hidden
                />
                <span className="flex-1 text-sm text-white">{PLAYER_STATUS_LABELS[k]}</span>
                <span className="text-sm font-semibold text-white">{d.summary[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        ))}
      </Panel>
      {s.state === "ok" && PLAYER_STATUSES.some((k) => s.data.summary[k]) ? (
        <Link
          to="/organizer/analytics"
          aria-label="Ver estadísticas de asistencia"
          className="block rounded-2xl transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {attendance}
        </Link>
      ) : (
        attendance
      )}
    </div>
  );
}

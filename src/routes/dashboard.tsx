import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Award, Crown, Swords, Target, TrendingUp } from "lucide-react";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { getMyDashboard } from "@/lib/geekarena-player.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Mi Panel — Geek Arena" }] }),
  component: DashboardPage,
});

type DashboardData = Awaited<ReturnType<typeof getMyDashboard>>;

function DashboardPage() {
  const { player: gaPlayer } = useGeekarenaRole();
  const fetchDashboard = useServerFn(getMyDashboard);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gaPlayer) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchDashboard()
      .then((d) => {
        if (mounted) setData(d);
      })
      .catch(() => {
        if (mounted) setData(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaPlayer?.id]);

  if (!gaPlayer) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Debes iniciar sesión</h2>
        <p className="mt-2 text-sm text-gray-400">
          Tu dashboard muestra tu historial competitivo.
        </p>
        <Link
          to="/login"
          className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const tag = gaPlayer.geek_tag;
  const totalPoints = data?.totalPoints ?? 0;
  const tournamentsPlayed = data?.tournamentsPlayed ?? 0;
  const tournamentsWon = data?.tournamentsWon ?? 0;
  const rank = data?.rankPosition ?? 0;
  const storeCity = data?.storeCity ?? null;
  const semesterLabel = data?.semesterLabel ?? "";
  const events = data?.events ?? [];

  const winPct =
    tournamentsPlayed === 0
      ? 0
      : Math.round((tournamentsWon / tournamentsPlayed) * 100);
  const losses = Math.max(0, tournamentsPlayed - tournamentsWon);
  const ratio =
    losses === 0
      ? tournamentsWon
      : (tournamentsWon / losses).toFixed(2);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      {/* Hero */}
      <section className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/60 via-primary/10 to-black/40 p-8 sm:p-12">
        <div className="absolute -right-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Tu Geek Tag
            </p>
            <h1 className="mt-2 break-all text-5xl font-bold text-white sm:text-7xl">
              {tag}
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              {storeCity ?? "Sin ranking"}
            </p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-black/40 px-6 py-4 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-primary">
              <Crown size={12} /> Rank Nacional
            </div>
            <div className="font-mono-stat text-5xl font-bold text-white">
              {loading ? "…" : rank > 0 ? `#${rank}` : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Target className="text-primary" size={18} />}
          label="Puntos Totales"
          value={totalPoints.toLocaleString()}
          sub={semesterLabel || "—"}
        />
        <StatCard
          icon={<Swords className="text-primary" size={18} />}
          label="Victorias / Derrotas"
          value={`${tournamentsWon} – ${losses}`}
          sub={`${winPct}% win rate · ratio ${ratio}`}
        />
        <StatCard
          icon={<Award className="text-primary" size={18} />}
          label="Torneos Ganados"
          value={String(tournamentsWon)}
          sub="Histórico"
        />
      </section>

      {/* Recent */}
      <section className="glass mt-6 overflow-hidden rounded-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary" size={18} />
            <h2 className="text-lg font-semibold text-white">
              Torneos Recientes
            </h2>
          </div>
          <span className="text-xs uppercase tracking-wider text-gray-500">
            Últimos 8 eventos
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Tienda</th>
                <th className="px-4 py-2 text-left">TCG</th>
                <th className="px-4 py-2 text-right">Posición</th>
                <th className="px-4 py-2 text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    Cargando…
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    Aún no has participado en ningún torneo.
                  </td>
                </tr>
              ) : (
                events.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-400 font-mono-stat text-xs">
                      {t.date}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {t.store}{" "}
                      <span className="text-xs text-gray-500">· {t.city}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{t.tcg}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono-stat text-sm font-semibold ${
                          t.placement <= 3 ? "text-primary" : "text-white"
                        }`}
                      >
                        #{t.placement}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-stat font-semibold text-white">
                      +{t.pointsEarned}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
        {icon} {label}
      </div>
      <div className="mt-3 font-mono-stat text-4xl font-bold text-white">
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-500">{sub}</div>
    </div>
  );
}

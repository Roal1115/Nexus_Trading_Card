import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, Crown, Swords, Target, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/mock-store";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";
import { geekarena } from "@/integrations/geekarena/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — Geek Collector" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { currentUser, players, tournaments } = useStore();
  const { player: gaPlayer } = useGeekarenaRole();
  const [storeCity, setStoreCity] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!gaPlayer?.home_store_id) {
      setStoreCity(null);
      return;
    }
    geekarena
      .from("stores")
      .select("city")
      .eq("id", gaPlayer.home_store_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setStoreCity((data?.city as string | null) ?? null);
      });
    return () => {
      mounted = false;
    };
  }, [gaPlayer?.home_store_id]);

  if (!currentUser) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Sign in required</h2>
        <p className="mt-2 text-sm text-gray-400">Your dashboard tracks your private competitive legacy.</p>
        <Link to="/login" className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground">Sign in</Link>
      </main>
    );
  }

  const tag = currentUser.geekTag;
  const sorted = [...players].sort((a, b) => b.semiannualPoints - a.semiannualPoints);
  const rank = sorted.findIndex((p) => p.geekTag.toLowerCase() === tag.toLowerCase()) + 1;
  const player = sorted.find((p) => p.geekTag.toLowerCase() === tag.toLowerCase());
  const myEvents = tournaments.filter((t) => t.geekTag.toLowerCase() === tag.toLowerCase()).slice(0, 8);

  const totalPoints = player?.semiannualPoints ?? 0;
  const wins = player?.wins ?? 0;
  const losses = player?.losses ?? 0;
  const ratio = losses === 0 ? wins : (wins / losses).toFixed(2);
  const winPct = wins + losses === 0 ? 0 : Math.round((wins / (wins + losses)) * 100);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      {/* Hero */}
      <section className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/60 via-primary/10 to-black/40 p-8 sm:p-12">
        <div className="absolute -right-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Your Geek Tag</p>
            <h1 className="mt-2 break-all text-5xl font-bold text-white sm:text-7xl">{tag}</h1>
            <p className="mt-2 text-sm text-gray-400">{player?.tcg ?? "Unranked"} · {storeCity ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-black/40 px-6 py-4 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-primary">
              <Crown size={12} /> National Rank
            </div>
            <div className="font-mono-stat text-5xl font-bold text-white">
              {rank > 0 ? `#${rank}` : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<Target className="text-primary" size={18} />} label="Total Points" value={totalPoints.toLocaleString()} sub="Semiannual H1" />
        <StatCard icon={<Swords className="text-primary" size={18} />} label="Win / Loss" value={`${wins} – ${losses}`} sub={`${winPct}% win rate · ratio ${ratio}`} />
        <StatCard icon={<Award className="text-primary" size={18} />} label="Tournaments Won" value={String(player?.tournamentsWon ?? 0)} sub="Lifetime" />
      </section>

      {/* Recent */}
      <section className="glass mt-6 overflow-hidden rounded-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary" size={18} />
            <h2 className="text-lg font-semibold text-white">Recent Tournaments</h2>
          </div>
          <span className="text-xs uppercase tracking-wider text-gray-500">Last 8 events</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Store</th>
                <th className="px-4 py-2 text-left">TCG</th>
                <th className="px-4 py-2 text-right">Placement</th>
                <th className="px-4 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {myEvents.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No tournaments yet. Get out there.</td></tr>
              ) : myEvents.map((t) => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-gray-400 font-mono-stat text-xs">{t.date}</td>
                  <td className="px-4 py-3 text-white">{t.store} <span className="text-xs text-gray-500">· {t.city}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{t.tcg}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono-stat text-sm font-semibold ${t.placement <= 3 ? "text-primary" : "text-white"}`}>
                      #{t.placement}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-stat font-semibold text-white">+{t.pointsEarned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
        {icon} {label}
      </div>
      <div className="mt-3 font-mono-stat text-4xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{sub}</div>
    </div>
  );
}
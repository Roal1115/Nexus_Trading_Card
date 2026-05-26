import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Medal, Search, Ticket, Trophy } from "lucide-react";
import { useStore, type Player, type TCG } from "@/lib/mock-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ranking del Circuito Nacional — Geek Arena" },
      { name: "description", content: "Rankings competitivos en vivo de One Piece, Magic: The Gathering y Pokémon TCG." },
    ],
  }),
  component: LeaderboardPage,
});

const TCGS: ("Todos" | TCG)[] = ["Todos", "One Piece", "Magic: The Gathering", "Pokémon"];
const MONTHS = ["Mayo 2026", "Abril 2026", "Marzo 2026", "Febrero 2026"];

function LeaderboardPage() {
  const { players } = useStore();
  const [tcg, setTcg] = useState<(typeof TCGS)[number]>("Todos");
  const [city, setCity] = useState("Todas");
  const [month, setMonth] = useState(MONTHS[0]);
  const [search, setSearch] = useState("");

  const cities = useMemo(() => ["Todas", ...Array.from(new Set(players.map((p) => p.city)))], [players]);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (tcg !== "Todos" && p.tcg !== tcg) return false;
      if (city !== "Todas" && p.city !== city) return false;
      if (search && !p.geekTag.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, tcg, city, search]);

  const monthly = useMemo(() => [...filtered].sort((a, b) => b.monthlyPoints - a.monthlyPoints), [filtered]);
  const semi = useMemo(() => [...filtered].sort((a, b) => b.semiannualPoints - a.semiannualPoints), [filtered]);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      {/* Hero */}
      <section className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-primary/20 via-black/40 to-black/20 p-8 sm:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Temporada III · Patrocinado por Bandai · Wizards · TPCI</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-white sm:text-6xl">
          Circuito <span className="text-primary">Nacional</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-gray-400 sm:text-base">
          El sistema oficial de ranking para TCG competitivo. Escala la tabla. Gana tu boleto al Mundial.
        </p>
      </section>

      {/* Filtros fijos */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Select label="TCG" value={tcg} onChange={(v) => setTcg(v as typeof tcg)} options={TCGS as readonly string[]} />
          <Select label="City" value={city} onChange={setCity} options={cities} />
          <Select label="Month" value={month} onChange={setMonth} options={MONTHS} />
          <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Geek Tag…"
              className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeaderboardTable
          title="Monthly Standings"
          subtitle={month}
          icon={<Trophy className="text-primary" size={18} />}
          rows={monthly}
          pointsKey="monthlyPoints"
          variant="monthly"
        />
        <LeaderboardTable
          title="General Semiannual"
          subtitle="H1 2026"
          icon={<Medal className="text-primary" size={18} />}
          rows={semi}
          pointsKey="semiannualPoints"
          variant="semi"
        />
      </div>
    </main>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label className="group inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition focus-within:border-primary">
      <span className="text-gray-500 uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-white outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-black">{o}</option>
        ))}
      </select>
    </label>
  );
}

function LeaderboardTable({
  title, subtitle, icon, rows, pointsKey, variant,
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  rows: Player[]; pointsKey: "monthlyPoints" | "semiannualPoints";
  variant: "monthly" | "semi";
}) {
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        <span className="text-xs uppercase tracking-wider text-gray-500">{subtitle}</span>
      </header>

      <div className="max-h-[640px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/60 backdrop-blur text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Geek Tag</th>
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">W</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">L</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">OMW%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const rank = i + 1;
              const isTopSemi = variant === "semi" && rank <= 3;
              const goldTicket = variant === "monthly" && rank <= 2;
              const silverTicket = variant === "semi" && rank > 3 && rank <= 12;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-white/5 transition ${isTopSemi ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-white/5"}`}
                >
                  <td className="px-3 py-2.5">
                    <span className={`font-mono-stat text-xs ${rank <= 3 ? "text-primary font-bold" : "text-gray-400"}`}>
                      {String(rank).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{p.geekTag}</span>
                      {goldTicket && <TicketBadge tone="gold" />}
                      {silverTicket && <TicketBadge tone="silver" />}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500">{p.tcg}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{p.city}</td>
                  <td className="px-3 py-2.5 text-right font-mono-stat font-semibold text-white">
                    {p[pointsKey].toLocaleString()}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-mono-stat text-xs text-gray-400 sm:table-cell">{p.wins}</td>
                  <td className="hidden px-3 py-2.5 text-right font-mono-stat text-xs text-gray-400 sm:table-cell">{p.losses}</td>
                  <td className="hidden px-3 py-2.5 text-right font-mono-stat text-xs text-gray-400 sm:table-cell">{p.omw}%</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500">No players match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TicketBadge({ tone }: { tone: "gold" | "silver" }) {
  const colors = tone === "gold"
    ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
    : "bg-zinc-300/10 text-zinc-300 border-zinc-300/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${colors}`}>
      <Ticket size={9} /> {tone}
    </span>
  );
}

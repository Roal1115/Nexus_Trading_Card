import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Medal, Search, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  getLeaderboard,
  getLeaderboardOptions,
} from "@/lib/geekarena-leaderboard.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ranking del Circuito Nacional — Geek Arena" },
      {
        name: "description",
        content:
          "Rankings competitivos en vivo de los principales TCG en México.",
      },
    ],
  }),
  component: LeaderboardPage,
});

type Game = { id: string; slug: string; name: string };
type Store = { id: string; name: string; city: string | null };
type Row = {
  player_id: string;
  geek_tag: string;
  city: string;
  points: number;
  tournaments_won: number;
  wins: number;
  losses: number;
};

const ALL = "__all__";

function monthLabel(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  const names = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${names[mm - 1]} ${y}`;
}

function LeaderboardPage() {
  const fetchOptions = useServerFn(getLeaderboardOptions);
  const fetchLeaderboard = useServerFn(getLeaderboard);

  const [games, setGames] = useState<Game[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  const [tcg, setTcg] = useState<string>(ALL);
  const [city, setCity] = useState<string>(ALL);
  const [storeId, setStoreId] = useState<string>(ALL);
  const [month, setMonth] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchOptions();
        if (!mounted) return;
        setGames(opts.games as Game[]);
        setStores(opts.stores as Store[]);
        setMonths(opts.months as string[]);
        if (opts.months.length > 0) setMonth(opts.months[0]);
      } catch (e) {
        toast.error("Error al cargar los filtros. Intenta de nuevo.");
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchLeaderboard({
      data: {
        game_id: tcg === ALL ? null : tcg,
        city: city === ALL ? null : city,
        store_id: storeId === ALL ? null : storeId,
        month: month === ALL ? null : month,
      },
    })
      .then((res) => {
        if (!mounted) return;
        setRows(res.rows as Row[]);
      })
      .catch((e) => {
        toast.error("Error al cargar el ranking. Intenta de nuevo.");
        console.error(e);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tcg, city, storeId, month]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const s of stores) if (s.city) set.add(s.city);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [stores]);

  const visibleStores = useMemo(() => {
    if (city === ALL) return stores;
    return stores.filter((s) => s.city === city);
  }, [stores, city]);

  // Reset store filter when city changes if no longer valid
  useEffect(() => {
    if (storeId !== ALL && !visibleStores.some((s) => s.id === storeId)) {
      setStoreId(ALL);
    }
  }, [visibleStores, storeId]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.geek_tag.toLowerCase().includes(q));
  }, [rows, search]);

  const selectedStore = stores.find((s) => s.id === storeId);
  const omwFor = (r: Row) =>
    r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <section className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-primary/20 via-black/40 to-black/20 p-8 sm:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Temporada III · Patrocinado por Bandai · Wizards · TPCI
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-white sm:text-6xl">
          Circuito <span className="text-primary">Nacional</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-gray-400 sm:text-base">
          El sistema oficial de ranking para TCG competitivo. Escala la tabla. Gana tu boleto al Mundial.
        </p>
      </section>

      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="TCG"
            value={tcg}
            onChange={setTcg}
            options={[{ value: ALL, label: "Todos" }, ...games.map((g) => ({ value: g.id, label: g.name }))]}
          />
          <FilterSelect
            label="Ciudad"
            value={city}
            onChange={(v) => setCity(v)}
            options={[{ value: ALL, label: "Todas" }, ...cities.map((c) => ({ value: c, label: c }))]}
          />
          <FilterSelect
            label="Tienda"
            value={storeId}
            onChange={setStoreId}
            options={[
              { value: ALL, label: "Todas las tiendas" },
              ...visibleStores.map((s) => ({
                value: s.id,
                label: `${s.name}${s.city ? ` — ${s.city}` : ""}`,
              })),
            ]}
          />
          <FilterSelect
            label="Mes"
            value={month}
            onChange={setMonth}
            options={[
              { value: ALL, label: "Histórico" },
              ...months.map((m) => ({ value: m, label: monthLabel(m) })),
            ]}
          />
          <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar Geek Tag…"
              className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {selectedStore && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary-foreground">
          Mostrando resultados de:{" "}
          <strong className="text-white">
            {selectedStore.name}
            {selectedStore.city ? ` — ${selectedStore.city}` : ""}
          </strong>
        </div>
      )}

      <section className="glass overflow-hidden rounded-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-primary" size={18} />
            <h2 className="text-lg font-semibold text-white">Ranking</h2>
          </div>
          <span className="text-xs uppercase tracking-wider text-gray-500">
            {month === ALL ? "Histórico" : monthLabel(month)}
          </span>
        </header>

        <div className="max-h-[720px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/60 text-xs uppercase tracking-wider text-gray-500 backdrop-blur">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Geek Tag</th>
                <th className="hidden px-3 py-2 text-left sm:table-cell">Ciudad</th>
                <th className="px-3 py-2 text-right">Pts</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">Torneos Ganados</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">Victorias</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">OMW%</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-500">
                    Cargando ranking…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-500">
                    No hay resultados para estos filtros todavía.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const rank = i + 1;
                  const podium = rank <= 3;
                  return (
                    <tr
                      key={r.player_id}
                      className={`border-b border-white/5 transition ${podium ? "bg-primary/5" : "hover:bg-white/5"}`}
                    >
                      <td className="px-3 py-2.5">
                        <span className={`font-mono text-xs ${podium ? "font-bold text-primary" : "text-gray-400"}`}>
                          {String(rank).padStart(2, "0")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {rank === 1 && <Medal className="text-amber-300" size={14} />}
                          <span className="font-medium text-white">{r.geek_tag}</span>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 text-xs text-gray-400 sm:table-cell">{r.city}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">
                        {r.points.toLocaleString()}
                      </td>
                      <td className="hidden px-3 py-2.5 text-right font-mono text-xs text-gray-400 sm:table-cell">
                        {r.tournaments_won}
                      </td>
                      <td className="hidden px-3 py-2.5 text-right font-mono text-xs text-gray-400 md:table-cell">
                        {r.wins}
                      </td>
                      <td className="hidden px-3 py-2.5 text-right font-mono text-xs text-gray-400 md:table-cell">
                        {omwFor(r)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="group inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition focus-within:border-primary">
      <span className="uppercase tracking-wider text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-white outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-black">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

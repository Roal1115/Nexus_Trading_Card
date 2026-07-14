import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldQuestion, AlertTriangle, BarChart3, HelpCircle } from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { getMyStats, getMyStatsGames, getMyCasualStats } from "@/lib/nexus-player.functions";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/my-stats")({
  head: () => ({ meta: [{ title: "Mis Stats — Nexus" }] }),
  component: StatsPage,
});

type StatsData = Awaited<ReturnType<typeof getMyStats>>;
type LeaderStat = StatsData["leaders"][0];
type Matchup = LeaderStat["matchups"][0];
type RoundHistory = {
  round_number: number;
  tournament_date: string | null;
  store_name: string;
  opponent_tag: string;
  won_match: boolean;
  turn_order: "first" | "second" | null;
  won_die_roll: boolean | null;
  notes: string | null;
  status: string;
};

const STAT_TOOLTIPS: Record<string, string> = {
  "Wtd Win Rate":
    "Win Rate ponderado: calculado solo con rondas confirmadas por ambos jugadores. Es el número más confiable.",
  "Raw Win Rate":
    "Win Rate crudo: incluye todas las rondas, confirmadas y pendientes. Puede variar cuando se confirmen datos.",
  "Play Rate":
    "Porcentaje de rondas del meta total que jugaste con este leader. Indica qué tan frecuentemente lo usas vs el resto de jugadores.",
  "Total Games": "Total de rondas registradas con este leader (excluye byes).",
  "1st Winrate":
    "Win Rate cuando tú juegas primero (tu turno 1). En One Piece, jugar primero o segundo impacta significativamente la estrategia.",
  "2nd Winrate": "Win Rate cuando juegas segundo (oponente tiene turno 1).",
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const [show, setShow] = useState(false);
  const tooltip = STAT_TOOLTIPS[label];

  return (
    <div className="relative flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-1">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
        {tooltip && (
          <button
            type="button"
            className="text-gray-700 hover:text-gray-400 transition flex-shrink-0"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
          >
            <HelpCircle size={10} />
          </button>
        )}
      </div>
      <p className="font-mono text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}

      {/* Tooltip */}
      {show && tooltip && (
        <div className="animate-in fade-in-0 zoom-in-95 duration-150 absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-primary/30 bg-[#0f1117] p-3 text-xs text-gray-300 leading-relaxed shadow-2xl">
          {tooltip}
          <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-r border-primary/30 bg-[#0f1117]" />
        </div>
      )}
    </div>
  );
}

function UncertainBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
      <AlertTriangle size={10} />
      Datos inciertos
    </span>
  );
}

function WinRateBar({ rate }: { rate: number }) {
  const color = rate >= 55 ? "bg-emerald-500" : rate >= 45 ? "bg-primary" : "bg-red-500";
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  );
}

function LeaderCard({
  stat,
  selected,
  onClick,
}: {
  stat: LeaderStat;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition w-full ${
        selected
          ? "border-primary bg-primary/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/20"
      }`}
    >
      {stat.leader_image ? (
        <img
          src={stat.leader_image}
          alt={stat.leader_name}
          className="h-12 w-8 flex-shrink-0 rounded-md border border-white/10 object-cover"
        />
      ) : (
        <div className="flex h-12 w-8 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
          <ShieldQuestion size={14} className="text-gray-600" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{stat.leader_name}</p>
        <p className="text-xs text-gray-500">
          {stat.total_games} partidas · {stat.raw_win_rate}% WR
        </p>
        {stat.has_uncertain_data && (
          <div className="mt-1">
            <UncertainBadge />
          </div>
        )}
      </div>
    </button>
  );
}

function MatchupRow({ matchup, statsSource }: { matchup: Matchup; statsSource: "official" | "casual" | "all" }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
      >
        {matchup.opponent_leader_image ? (
          <img
            src={matchup.opponent_leader_image}
            alt={matchup.opponent_leader_name}
            className="h-10 w-7 flex-shrink-0 rounded-md border border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-10 w-7 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
            <ShieldQuestion size={12} className="text-gray-600" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">
              {matchup.opponent_leader_name}
            </p>
            {matchup.has_uncertain_data && <UncertainBadge />}
          </div>
          <WinRateBar rate={matchup.overall_win_rate} />
        </div>

        <div className="text-right flex-shrink-0 ml-2">
          <p
            className={`font-mono text-lg font-bold ${
              matchup.overall_win_rate >= 55
                ? "text-emerald-400"
                : matchup.overall_win_rate >= 45
                  ? "text-white"
                  : "text-red-400"
            }`}
          >
            {matchup.overall_win_rate}%
          </p>
          <p className="text-[10px] text-gray-500">{matchup.total} partidas</p>
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden border-t border-white/10 [&>*]:min-h-0">
          {/* Stats 1st / 2nd / Overall */}
          <div className="px-4 py-3 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Overall</p>
              <p className="mt-1 font-mono text-base font-bold text-white">
                {matchup.overall_win_rate}%
              </p>
              <p className="text-[10px] text-gray-600">{matchup.total} partidas</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">1st</p>
              <p className="mt-1 font-mono text-base font-bold text-white">
                {matchup.first_win_rate != null ? `${matchup.first_win_rate}%` : "—"}
              </p>
              <p className="text-[10px] text-gray-600">{matchup.first_total} partidas</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">2nd</p>
              <p className="mt-1 font-mono text-base font-bold text-white">
                {matchup.second_win_rate != null ? `${matchup.second_win_rate}%` : "—"}
              </p>
              <p className="text-[10px] text-gray-600">{matchup.second_total} partidas</p>
            </div>
          </div>

          {/* Historial de rondas */}
          {(matchup as any).round_history?.length > 0 && (
            <div className="border-t border-white/5 px-4 pb-3">
              <p className="py-2 text-[10px] uppercase tracking-widest text-gray-600">
                Historial de partidas
              </p>
              <div className="space-y-1.5">
                {(matchup as any).round_history.map((r: RoundHistory, i: number) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      r.won_match
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold ${r.won_match ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {r.won_match ? "Victoria" : "Derrota"}
                        </span>
                        <span className="text-xs text-gray-400">vs {r.opponent_tag}</span>
                        {r.status !== "confirmed" && statsSource === "official" && (
                          <span className="text-[9px] text-amber-400 border border-amber-400/30 rounded px-1">
                            En proceso de vinculación
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-600 flex-wrap">
                        <span>{r.store_name}</span>
                        {r.tournament_date && (
                          <>
                            <span>·</span>
                            <span>
                              {new Date(r.tournament_date + "T12:00:00").toLocaleDateString(
                                "es-MX",
                                { day: "numeric", month: "short", year: "numeric" },
                              )}
                            </span>
                          </>
                        )}
                        {r.turn_order && (
                          <>
                            <span>·</span>
                            <span>{r.turn_order === "first" ? "Fui primero" : "Fui segundo"}</span>
                          </>
                        )}
                        {r.won_die_roll !== null && (
                          <>
                            <span>·</span>
                            <span>Dado: {r.won_die_roll ? "Yo" : "Oponente"}</span>
                          </>
                        )}
                        <span>· R{r.round_number}</span>
                      </div>
                      {r.notes && (
                        <p className="mt-1 text-[10px] italic text-gray-500 truncate max-w-xs">
                          "{r.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsPage() {
  const { player, loading: authLoading } = useNexusRole();
  const fetchGames = useServerFn(getMyStatsGames);
  const fetchStats = useServerFn(getMyStats);

  const [games, setGames] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [selectedLeaderIdx, setSelectedLeaderIdx] = useState(0);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  // Cargar TCGs disponibles
  useEffect(() => {
    if (authLoading || !player) return;
    fetchGames()
      .then((res) => {
        setGames(res.games);
        if (res.games.length > 0) setSelectedGameId(res.games[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingGames(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, authLoading]);

  // Cargar stats cuando cambia el TCG
  useEffect(() => {
    if (!selectedGameId) return;
    setLoadingStats(true);
    setSelectedLeaderIdx(0);
    fetchStats({ data: { game_id: selectedGameId } })
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameId]);

  if (!authLoading && !player) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-white">Debes iniciar sesión</h2>
        <Link
          to="/login"
          className="mt-6 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const selectedLeader = stats?.leaders[selectedLeaderIdx] ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 pb-20">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-gray-500">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 hover:text-primary transition"
        >
          <ArrowLeft size={12} /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-gray-300">Mis Stats</span>
      </div>

      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Performance</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Mis Stats</h1>
        <p className="mt-1 text-sm text-gray-400">
          Estadísticas calculadas desde tus rondas registradas en el Performance Tracker.
        </p>
      </header>

      {/* TCG Tab switcher */}
      {loadingGames ? (
        <div className="mb-6 flex gap-2">
          {[1, 2].map((i) => (
            <SkeletonLine key={i} width="w-28" height="h-9" className="rounded-lg" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <BarChart3 size={40} className="mx-auto mb-4 text-gray-600" />
          <p className="text-sm font-semibold text-white">Sin datos registrados</p>
          <p className="mt-2 text-xs text-gray-500">
            Registra tus rondas en el Performance Tracker para ver tus stats aquí.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-gray-300 hover:text-white transition"
          >
            <ArrowLeft size={12} /> Volver al dashboard
          </Link>
        </div>
      ) : (
        <>
          {/* Tab switcher por TCG */}
          <div className="mb-6 flex gap-2 overflow-x-auto">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGameId(g.id)}
                className={`flex-shrink-0 rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  selectedGameId === g.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {loadingStats ? (
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <SkeletonBlock key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <div className="space-y-4">
                <SkeletonBlock className="h-48 rounded-2xl" />
                <SkeletonBlock className="h-64 rounded-2xl" />
              </div>
            </div>
          ) : !stats || stats.leaders.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-sm text-gray-500">Sin rondas registradas para este TCG todavía.</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              {/* Sidebar — lista de leaders */}
              <div className="space-y-2">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-gray-500">
                  Tus leaders
                </p>
                {stats.leaders.map((l, i) => (
                  <LeaderCard
                    key={l.leader_id}
                    stat={l}
                    selected={selectedLeaderIdx === i}
                    onClick={() => setSelectedLeaderIdx(i)}
                  />
                ))}
              </div>

              {/* Main — stats del leader seleccionado */}
              {selectedLeader && (
                <div className="space-y-6">
                  {/* Hero del leader */}
                  <div className="glass rounded-2xl p-6">
                    <div className="flex items-start gap-6">
                      {selectedLeader.leader_image ? (
                        <img
                          src={selectedLeader.leader_image}
                          alt={selectedLeader.leader_name}
                          className="h-32 w-auto flex-shrink-0 rounded-xl border border-white/10 object-cover shadow-2xl"
                        />
                      ) : (
                        <div className="flex h-32 w-24 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40">
                          <div className="text-center">
                            <ShieldQuestion size={24} className="mx-auto mb-1 text-gray-600" />
                            <p className="text-[9px] text-gray-600">Imagen próximamente</p>
                          </div>
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h2 className="text-xl font-bold text-white">
                            {selectedLeader.leader_name}
                          </h2>
                          {selectedLeader.has_uncertain_data && <UncertainBadge />}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {stats.game_name} · {selectedLeader.total_games} partidas registradas
                        </p>

                        {selectedLeader.has_uncertain_data && (
                          <p className="mt-2 text-[11px] text-amber-400/80">
                            ⚠ Algunas rondas fueron reportadas por tu oponente y aún no están
                            confirmadas. Los porcentajes pueden variar.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <StatCard
                        label="Wtd Win Rate"
                        value={`${selectedLeader.wtd_win_rate}%`}
                        sub="Solo rondas confirmadas"
                      />
                      <StatCard
                        label="Raw Win Rate"
                        value={`${selectedLeader.raw_win_rate}%`}
                        sub="Todas las rondas"
                      />
                      <StatCard
                        label="Play Rate"
                        value={`${selectedLeader.play_rate}%`}
                        sub="Del total de rondas en el meta"
                      />
                      <StatCard
                        label="Total Games"
                        value={String(selectedLeader.total_games)}
                        sub={`${selectedLeader.wins}W / ${selectedLeader.losses}L`}
                      />
                      <StatCard
                        label="1st Winrate"
                        value={
                          selectedLeader.first_win_rate != null
                            ? `${selectedLeader.first_win_rate}%`
                            : "—"
                        }
                        sub={
                          selectedLeader.first_games > 0
                            ? `${selectedLeader.first_games} partidas`
                            : "Sin datos"
                        }
                      />
                      <StatCard
                        label="2nd Winrate"
                        value={
                          selectedLeader.second_win_rate != null
                            ? `${selectedLeader.second_win_rate}%`
                            : "—"
                        }
                        sub={
                          selectedLeader.second_games > 0
                            ? `${selectedLeader.second_games} partidas`
                            : "Sin datos"
                        }
                      />
                    </div>
                  </div>

                  {/* Matchup Breakdown */}
                  <div className="glass rounded-2xl p-6">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
                      <span className="text-primary">⚔</span> Matchup Breakdown
                    </h3>

                    {selectedLeader.matchups.length === 0 ? (
                      <p className="py-8 text-center text-sm text-gray-500">
                        Aún no tienes matchups registrados con este leader.
                      </p>
                    ) : (
                      <div key={selectedLeaderIdx} className="space-y-2">
                        {selectedLeader.matchups.map((m) => (
                          <MatchupRow key={m.opponent_leader_id} matchup={m} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

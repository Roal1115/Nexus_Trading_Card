import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldQuestion, AlertTriangle, BarChart3, HelpCircle, Search, ChevronRight, X } from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { getMyStats } from "@/lib/nexus-player.functions";
import { myStatsGamesQuery, myStatsSourceQuery } from "@/lib/my-stats-queries";
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
  is_pending?: boolean;
};

type StatsSource = "official" | "casual" | "pending" | "all";
type TimeRange = "30" | "90" | "all";

const round1 = (n: number) => Math.round(n * 10) / 10;

// Recomputa todos los stats desde round_history con un corte de fecha.
// ponytail: client-side sobre datos ya cargados; si el payload crece demasiado, mover el filtro al server
function filterStatsByDate(stats: StatsData, days: number): StatsData {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const leaders = stats.leaders
    .map((l) => {
      const matchups = l.matchups
        .map((m) => {
          const hist: RoundHistory[] = ((m as any).round_history ?? []).filter(
            (r: RoundHistory) => r.tournament_date && r.tournament_date >= cutoff,
          );
          const wins = hist.filter((r) => r.won_match).length;
          const first = hist.filter((r) => r.turn_order === "first");
          const second = hist.filter((r) => r.turn_order === "second");
          const firstWins = first.filter((r) => r.won_match).length;
          const secondWins = second.filter((r) => r.won_match).length;
          return {
            ...m,
            total: hist.length,
            wins,
            overall_win_rate: hist.length ? round1((wins / hist.length) * 100) : 0,
            first_total: first.length,
            first_wins: firstWins,
            first_win_rate: first.length ? round1((firstWins / first.length) * 100) : null,
            second_total: second.length,
            second_wins: secondWins,
            second_win_rate: second.length ? round1((secondWins / second.length) * 100) : null,
            has_uncertain_data: hist.some((r) => r.status !== "confirmed"),
            round_history: hist,
          };
        })
        .filter((m) => m.total > 0)
        .sort((a, b) => b.total - a.total);

      const allHist = matchups.flatMap((m) => (m as any).round_history as RoundHistory[]);
      const total = allHist.length;
      const wins = allHist.filter((r) => r.won_match).length;
      const first = allHist.filter((r) => r.turn_order === "first");
      const second = allHist.filter((r) => r.turn_order === "second");
      const confirmed = allHist.filter((r) => r.status === "confirmed");
      const confirmedWins = confirmed.filter((r) => r.won_match).length;

      return {
        ...l,
        matchups,
        total_games: total,
        wins,
        losses: total - wins,
        raw_win_rate: total ? round1((wins / total) * 100) : 0,
        wtd_win_rate: confirmed.length ? round1((confirmedWins / confirmed.length) * 100) : 0,
        play_rate: 0, // sin meta filtrado por fecha
        first_games: first.length,
        first_win_rate: first.length
          ? round1((first.filter((r) => r.won_match).length / first.length) * 100)
          : null,
        second_games: second.length,
        second_win_rate: second.length
          ? round1((second.filter((r) => r.won_match).length / second.length) * 100)
          : null,
        has_uncertain_data: allHist.some((r) => r.status !== "confirmed"),
      };
    })
    .filter((l) => l.total_games > 0)
    .sort((a, b) => b.total_games - a.total_games);

  return { ...stats, total_rounds_in_meta: 0, leaders };
}

const STAT_TOOLTIPS: Record<string, string> = {
  "WR Confirmado":
    "Calculado solo con rondas confirmadas por ambos jugadores. Es el número más confiable.",
  "WR Total":
    "Incluye todas las rondas, confirmadas y pendientes. Puede variar cuando se confirmen datos.",
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
            className="flex-shrink-0 p-1 -m-1 text-gray-600 hover:text-gray-300 transition"
            aria-label={`Qué significa ${label}`}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onBlur={() => setShow(false)}
            onClick={() => setShow((s) => !s)}
          >
            <HelpCircle size={12} />
          </button>
        )}
      </div>
      <p className="font-mono text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}

      {/* Tooltip */}
      {show && tooltip && (
        <div className="animate-in fade-in-0 zoom-in-95 duration-150 absolute bottom-full left-0 z-50 mb-2 w-56 max-w-[calc(100vw-3rem)] rounded-xl border border-primary/30 bg-[#0f1117] p-3 text-xs text-gray-300 leading-relaxed shadow-2xl">
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

// ponytail: <5 partidas = muestra baja, se atenúa el color para no vender un 100% de 1 partida como dato sólido
const LOW_SAMPLE = 5;

function WinRateBar({ rate, dim }: { rate: number; dim?: boolean }) {
  const color = dim
    ? "bg-gray-500"
    : rate >= 55
      ? "bg-emerald-500"
      : rate >= 45
        ? "bg-primary"
        : "bg-red-500";
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  );
}

const COLOR_DOTS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  black: "#71717a",
  yellow: "#eab308",
};

function ColorDots({ colors }: { colors: string[] }) {
  return (
    <span className="inline-flex gap-1">
      {colors.map((c) => (
        <span
          key={c}
          className="h-2.5 w-2.5 rounded-full border border-white/20"
          style={{ backgroundColor: COLOR_DOTS[c.toLowerCase()] ?? "#71717a" }}
        />
      ))}
    </span>
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
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
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

function MatchupRow({ matchup, onClick }: { matchup: Matchup; onClick: () => void }) {
  const lowSample = matchup.total < LOW_SAMPLE;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition"
      >
        {matchup.opponent_leader_image ? (
          <img
            src={matchup.opponent_leader_image}
            alt={matchup.opponent_leader_name}
            className="h-8 w-6 flex-shrink-0 rounded border border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-8 w-6 flex-shrink-0 items-center justify-center rounded border border-white/10 bg-black/30">
            <ShieldQuestion size={11} className="text-gray-600" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              {matchup.opponent_leader_name}
            </p>
            {matchup.has_uncertain_data && <UncertainBadge />}
          </div>
          <WinRateBar rate={matchup.overall_win_rate} dim={lowSample} />
        </div>

        <div className="text-right flex-shrink-0 ml-2">
          <p
            className={`font-mono text-base font-bold leading-tight ${
              lowSample
                ? "text-gray-400"
                : matchup.overall_win_rate >= 55
                  ? "text-emerald-400"
                  : matchup.overall_win_rate >= 45
                    ? "text-white"
                    : "text-red-400"
            }`}
          >
            {matchup.overall_win_rate}%
          </p>
          <p className="text-[10px] text-gray-500">
            {matchup.total} partidas{lowSample ? " · muestra baja" : ""}
          </p>
        </div>
        <ChevronRight size={14} className="flex-shrink-0 text-gray-600" />
      </button>
    </div>
  );
}

type HistoryRound = RoundHistory & { my_leader_name?: string };

function RoundHistoryList({
  rounds,
  statsSource,
}: {
  rounds: HistoryRound[];
  statsSource: StatsSource;
}) {
  return (
    <div className="space-y-1.5">
      {rounds.map((r, i) => (
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
              {r.my_leader_name && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-gray-400">
                  con {r.my_leader_name}
                </span>
              )}
              {r.is_pending ? (
                <span className="text-[9px] text-amber-400 border border-amber-400/30 rounded px-1">
                  En espera del torneo
                </span>
              ) : (
                r.status !== "confirmed" &&
                statsSource === "official" && (
                  <span className="text-[9px] text-amber-400 border border-amber-400/30 rounded px-1">
                    En proceso de vinculación
                  </span>
                )
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-600 flex-wrap">
              <span>{r.store_name}</span>
              {r.tournament_date && (
                <>
                  <span>·</span>
                  <span>
                    {new Date(r.tournament_date + "T12:00:00").toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
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
  );
}

// Drawer "yo vs Leader X": agrega los matchups contra ese leader a través de TODOS mis leaders
function VsLeaderDrawer({
  opponentId,
  leaders,
  statsSource,
  onClose,
}: {
  opponentId: string;
  leaders: LeaderStat[];
  statsSource: StatsSource;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const entries = leaders
    .map((l) => ({ leader: l, m: l.matchups.find((x) => x.opponent_leader_id === opponentId) }))
    .filter((e): e is { leader: LeaderStat; m: Matchup } => !!e.m);

  const opp = entries[0]?.m;
  if (!opp) return null;

  const total = entries.reduce((s, e) => s + e.m.total, 0);
  const wins = entries.reduce((s, e) => s + e.m.wins, 0);
  const firstTotal = entries.reduce((s, e) => s + e.m.first_total, 0);
  const firstWins = entries.reduce((s, e) => s + e.m.first_wins, 0);
  const secondTotal = entries.reduce((s, e) => s + e.m.second_total, 0);
  const secondWins = entries.reduce((s, e) => s + e.m.second_wins, 0);
  const wr = total ? round1((wins / total) * 100) : 0;

  const history: HistoryRound[] = entries
    .flatMap((e) =>
      (((e.m as any).round_history ?? []) as RoundHistory[]).map((r) => ({
        ...r,
        my_leader_name: entries.length > 1 ? e.leader.leader_name : undefined,
      })),
    )
    .sort((a, b) => (b.tournament_date ?? "").localeCompare(a.tournament_date ?? ""));

  const colors = ((opp as any).opponent_leader_colors as string[] | null) ?? [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`Stats contra ${opp.opponent_leader_name}`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
        className="fixed right-0 top-0 bottom-0 z-[71] flex w-full max-w-lg flex-col overflow-y-auto border-l border-white/10 bg-[#0B1220]/95 backdrop-blur-xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#0B1220]/95 p-4 backdrop-blur-xl">
          {opp.opponent_leader_image ? (
            <img
              src={opp.opponent_leader_image}
              alt={opp.opponent_leader_name}
              className="h-14 w-10 flex-shrink-0 rounded-md border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
              <ShieldQuestion size={16} className="text-gray-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-white">
                vs {opp.opponent_leader_name}
              </h2>
              {colors.length > 0 && <ColorDots colors={colors} />}
            </div>
            <p className="text-xs text-gray-500">
              {total} partidas · {entries.length} de tus leaders
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-5 p-4">
          {/* Global vs este leader */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Overall</p>
              <p
                className={`mt-1 font-mono text-lg font-bold ${
                  wr >= 55 ? "text-emerald-400" : wr >= 45 ? "text-white" : "text-red-400"
                }`}
              >
                {wr}%
              </p>
              <p className="text-[10px] text-gray-600">
                {wins}W — {total - wins}L
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">1st</p>
              <p className="mt-1 font-mono text-lg font-bold text-white">
                {firstTotal ? `${round1((firstWins / firstTotal) * 100)}%` : "—"}
              </p>
              <p className="text-[10px] text-gray-600">{firstTotal} partidas</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">2nd</p>
              <p className="mt-1 font-mono text-lg font-bold text-white">
                {secondTotal ? `${round1((secondWins / secondTotal) * 100)}%` : "—"}
              </p>
              <p className="text-[10px] text-gray-600">{secondTotal} partidas</p>
            </div>
          </div>

          {/* Con cuál de mis leaders me va mejor */}
          {entries.length > 1 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest text-gray-500">
                Con tus leaders
              </p>
              <div className="space-y-1.5">
                {[...entries]
                  .sort((a, b) => b.m.overall_win_rate - a.m.overall_win_rate)
                  .map((e) => {
                    const low = e.m.total < LOW_SAMPLE;
                    return (
                      <div
                        key={e.leader.leader_id}
                        className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                      >
                        {e.leader.leader_image ? (
                          <img
                            src={e.leader.leader_image}
                            alt={e.leader.leader_name}
                            className="h-8 w-6 flex-shrink-0 rounded border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-6 flex-shrink-0 items-center justify-center rounded border border-white/10 bg-black/30">
                            <ShieldQuestion size={11} className="text-gray-600" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {e.leader.leader_name}
                          </p>
                          <WinRateBar rate={e.m.overall_win_rate} dim={low} />
                        </div>
                        <div className="ml-2 flex-shrink-0 text-right">
                          <p
                            className={`font-mono text-sm font-bold ${
                              low
                                ? "text-gray-400"
                                : e.m.overall_win_rate >= 55
                                  ? "text-emerald-400"
                                  : e.m.overall_win_rate >= 45
                                    ? "text-white"
                                    : "text-red-400"
                            }`}
                          >
                            {e.m.overall_win_rate}%
                          </p>
                          <p className="text-[10px] text-gray-500">{e.m.total} partidas</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Historial cronológico completo */}
          {history.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest text-gray-500">
                Historial de partidas
              </p>
              <RoundHistoryList rounds={history} statsSource={statsSource} />
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}

function mergeStats(official: StatsData, casual: any): StatsData {
  type L = LeaderStat;
  const map = new Map<string, L>();

  const add = (src: L[]) => {
    for (const l of src) {
      const existing = map.get(l.leader_id);
      if (!existing) {
        map.set(l.leader_id, { ...l, matchups: l.matchups.map((m) => ({ ...m })) });
        continue;
      }
      existing.total_games += l.total_games;
      existing.wins += l.wins;
      existing.losses += l.losses;
      existing.first_games += l.first_games;
      existing.second_games += l.second_games;
      existing.has_uncertain_data = existing.has_uncertain_data || l.has_uncertain_data;

      // reset accumulators for recompute
      const firstWins = Math.round(((existing.first_win_rate ?? 0) / 100) * (existing.first_games - l.first_games)) +
        Math.round(((l.first_win_rate ?? 0) / 100) * l.first_games);
      const secondWins = Math.round(((existing.second_win_rate ?? 0) / 100) * (existing.second_games - l.second_games)) +
        Math.round(((l.second_win_rate ?? 0) / 100) * l.second_games);

      existing.first_win_rate = existing.first_games > 0 ? Math.round((firstWins / existing.first_games) * 1000) / 10 : null;
      existing.second_win_rate = existing.second_games > 0 ? Math.round((secondWins / existing.second_games) * 1000) / 10 : null;

      // matchups: merge by opponent_leader_id
      const mMap = new Map(existing.matchups.map((m) => [m.opponent_leader_id, m]));
      for (const m of l.matchups) {
        const ex = mMap.get(m.opponent_leader_id);
        if (!ex) {
          mMap.set(m.opponent_leader_id, { ...m });
        } else {
          ex.total += m.total;
          ex.wins += m.wins;
          ex.first_total += m.first_total;
          ex.first_wins += m.first_wins;
          ex.second_total += m.second_total;
          ex.second_wins += m.second_wins;
          ex.overall_win_rate = ex.total > 0 ? Math.round((ex.wins / ex.total) * 1000) / 10 : 0;
          ex.first_win_rate = ex.first_total > 0 ? Math.round((ex.first_wins / ex.first_total) * 1000) / 10 : null;
          ex.second_win_rate = ex.second_total > 0 ? Math.round((ex.second_wins / ex.second_total) * 1000) / 10 : null;
          ex.has_uncertain_data = ex.has_uncertain_data || m.has_uncertain_data;
          (ex as any).round_history = [
            ...((ex as any).round_history ?? []),
            ...(((m as any).round_history) ?? []),
          ];
        }
      }
      existing.matchups = Array.from(mMap.values()).sort((a, b) => b.total - a.total);
    }
  };

  add(official.leaders as L[]);
  add((casual?.leaders ?? []) as L[]);

  const leaders = Array.from(map.values()).map((l) => ({
    ...l,
    raw_win_rate: l.total_games > 0 ? Math.round((l.wins / l.total_games) * 1000) / 10 : 0,
    wtd_win_rate: l.total_games > 0 ? Math.round((l.wins / l.total_games) * 1000) / 10 : 0,
    play_rate: 0,
  })).sort((a, b) => b.total_games - a.total_games);

  return {
    ...official,
    total_rounds_in_meta: 0,
    leaders,
  };
}

function StatsPage() {
  const { player, loading: authLoading } = useNexusRole();

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [statsSource, setStatsSource] = useState<StatsSource>("official");
  const [selectedLeaderIdx, setSelectedLeaderIdx] = useState(0);
  const [matchupSort, setMatchupSort] = useState<"games" | "best" | "worst">("games");
  const [matchupSearch, setMatchupSearch] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [vsLeaderId, setVsLeaderId] = useState<string | null>(null);

  const { data: gamesData, isLoading: loadingGames } = useQuery({
    ...myStatsGamesQuery(),
    enabled: !!player,
  });
  const games = gamesData?.games ?? [];
  useEffect(() => {
    if (games.length > 0 && !selectedGameId) setSelectedGameId(games[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  useEffect(() => {
    setSelectedLeaderIdx(0);
    setVsLeaderId(null);
  }, [selectedGameId, statsSource]);

  const gameId = selectedGameId ?? "";
  const officialQ = useQuery({
    ...myStatsSourceQuery(gameId, "official"),
    enabled: !!selectedGameId && (statsSource === "official" || statsSource === "all"),
  });
  const casualQ = useQuery({
    ...myStatsSourceQuery(gameId, "casual"),
    enabled: !!selectedGameId && (statsSource === "casual" || statsSource === "all"),
  });
  const pendingQ = useQuery({
    ...myStatsSourceQuery(gameId, "pending"),
    enabled: !!selectedGameId && (statsSource === "pending" || statsSource === "all"),
  });

  const stats: StatsData | null =
    statsSource === "official"
      ? (officialQ.data ?? null)
      : statsSource === "casual"
        ? (casualQ.data ?? null)
        : statsSource === "pending"
          ? (pendingQ.data ?? null)
          : officialQ.data && casualQ.data && pendingQ.data
            ? mergeStats(mergeStats(officialQ.data, casualQ.data), pendingQ.data)
            : null;

  const loadingStats =
    statsSource === "all"
      ? officialQ.isLoading || casualQ.isLoading || pendingQ.isLoading
      : statsSource === "official"
        ? officialQ.isLoading
        : statsSource === "casual"
          ? casualQ.isLoading
          : pendingQ.isLoading;

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

  const displayStats =
    stats && timeRange !== "all" ? filterStatsByDate(stats, Number(timeRange)) : stats;
  // clamp: al filtrar por fecha la lista puede encogerse
  const leaderIdx =
    displayStats && selectedLeaderIdx < displayStats.leaders.length ? selectedLeaderIdx : 0;
  const selectedLeader = displayStats?.leaders[leaderIdx] ?? null;

  // Resumen global del dataset actual (todos los leaders)
  const overview = displayStats
    ? displayStats.leaders.reduce(
        (a, l) => ({
          games: a.games + l.total_games,
          wins: a.wins + l.wins,
          losses: a.losses + l.losses,
        }),
        { games: 0, wins: 0, losses: 0 },
      )
    : null;
  const overviewWr =
    overview && overview.games > 0 ? Math.round((overview.wins / overview.games) * 1000) / 10 : null;

  const sortedMatchups = selectedLeader
    ? [...selectedLeader.matchups]
        .filter((m) =>
          m.opponent_leader_name.toLowerCase().includes(matchupSearch.trim().toLowerCase()),
        )
        .sort((a, b) =>
        matchupSort === "best"
          ? b.overall_win_rate - a.overall_win_rate
          : matchupSort === "worst"
            ? a.overall_win_rate - b.overall_win_rate
            : b.total - a.total,
        )
    : [];

  // ponytail: >12 matchups = lista larga, se agrupa por combinación de color; debajo del threshold la lista plana es más rápida de leer
  const GROUP_THRESHOLD = 12;
  const grouped =
    sortedMatchups.length > GROUP_THRESHOLD
      ? Array.from(
          sortedMatchups.reduce((map, m) => {
            const colors = ((m as any).opponent_leader_colors as string[] | null) ?? [];
            const key = colors.length ? colors.join("/") : "Sin color";
            const g = map.get(key) ?? { key, colors, matchups: [] as Matchup[], total: 0, wins: 0 };
            g.matchups.push(m);
            g.total += m.total;
            g.wins += m.wins;
            map.set(key, g);
            return map;
          }, new Map<string, { key: string; colors: string[]; matchups: Matchup[]; total: number; wins: number }>()),
        )
          .map(([, g]) => g)
          .sort((a, b) => b.total - a.total)
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 pb-20">
      {/* Header compacto: back + título + TCG en una fila */}
      <header className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          to="/dashboard"
          aria-label="Volver al dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition"
        >
          <ArrowLeft size={14} />
        </Link>
        <h1 className="text-2xl font-bold text-white">Mis Stats</h1>

        {/* TCG: contexto, no filtro — oculto si solo hay uno */}
        {games.length > 1 && (
          <div className="ml-auto flex gap-1.5 overflow-x-auto">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGameId(g.id)}
                className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                  selectedGameId === g.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Filtros: fuente + rango temporal */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {[
            { key: "official" as const, label: "Oficial" },
            { key: "casual" as const, label: "Casual" },
            { key: "pending" as const, label: "Pendientes" },
            { key: "all" as const, label: "Todo" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatsSource(tab.key)}
              className={`flex-shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                statsSource === tab.key
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {[
            { key: "30" as const, label: "30d" },
            { key: "90" as const, label: "90d" },
            { key: "all" as const, label: "Todo el tiempo" },
          ].map((r) => (
            <button
              key={r.key}
              onClick={() => setTimeRange(r.key)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                timeRange === r.key
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {statsSource !== "official" && (
        <p className="mb-4 text-[11px] text-gray-500">
          {statsSource === "casual" &&
            "Partidas casuales y de práctica. No afectan tu ranking competitivo."}
          {statsSource === "pending" &&
            "Sesiones en espera de que el organizador publique el torneo. Pasarán a Oficial automáticamente."}
          {statsSource === "all" && "Todas tus partidas combinadas (incluye pendientes)."}
        </p>
      )}

      {loadingGames ? (
        <div className="mt-4 flex gap-2">
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
        <div className="mt-4">
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
          ) : !displayStats || displayStats.leaders.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-sm text-gray-500">
                {statsSource === "casual"
                  ? "Sin partidas casuales registradas. Crea una sesión casual para empezar."
                  : statsSource === "pending"
                    ? "No tienes sesiones pendientes de vinculación a un torneo."
                    : timeRange !== "all" && stats && stats.leaders.length > 0
                      ? `Sin partidas en los últimos ${timeRange} días.`
                      : statsSource === "all"
                        ? "Sin partidas registradas."
                        : "Sin rondas registradas para este TCG todavía."}
              </p>
            </div>

          ) : (
            <>
              {/* Resumen global del dataset */}
              {overview && overview.games > 0 && (
                <div className="glass mb-6 grid grid-cols-3 divide-x divide-white/5 rounded-2xl border border-white/10">
                  <div className="px-4 py-3 text-center sm:py-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Récord</p>
                    <p className="mt-1 font-mono text-xl font-bold text-white sm:text-2xl">
                      {overview.wins}W<span className="text-gray-600"> — </span>
                      {overview.losses}L
                    </p>
                  </div>
                  <div className="px-4 py-3 text-center sm:py-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Win Rate</p>
                    <p
                      className={`mt-1 font-mono text-xl font-bold sm:text-2xl ${
                        (overviewWr ?? 0) >= 55
                          ? "text-emerald-400"
                          : (overviewWr ?? 0) >= 45
                            ? "text-white"
                            : "text-red-400"
                      }`}
                    >
                      {overviewWr}%
                    </p>
                  </div>
                  <div className="px-4 py-3 text-center sm:py-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Leaders</p>
                    <p className="mt-1 font-mono text-xl font-bold text-white sm:text-2xl">
                      {displayStats.leaders.length}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                {/* Leaders: select nativo en móvil, sidebar en desktop */}
                <div className="min-w-0">
                  <p className="mb-3 text-[10px] uppercase tracking-widest text-gray-500">
                    Tus leaders
                  </p>
                  <select
                    value={leaderIdx}
                    onChange={(e) => setSelectedLeaderIdx(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-sm font-semibold text-white lg:hidden"
                  >
                    {displayStats.leaders.map((l, i) => (
                      <option key={l.leader_id} value={i}>
                        {l.leader_name} · {l.total_games} partidas · {l.raw_win_rate}% WR
                      </option>
                    ))}
                  </select>
                  <div className="hidden flex-col gap-2 lg:flex">
                    {displayStats.leaders.map((l, i) => (
                      <LeaderCard
                        key={l.leader_id}
                        stat={l}
                        selected={leaderIdx === i}
                        onClick={() => setSelectedLeaderIdx(i)}
                      />
                    ))}
                  </div>
                </div>

              {/* Main — stats del leader seleccionado */}
              {selectedLeader && (
                <div className="min-w-0 space-y-6">
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
                          {displayStats.game_name} · {selectedLeader.total_games} partidas
                          {timeRange !== "all" ? ` · últimos ${timeRange} días` : ""}
                        </p>

                        {/* Dato estrella: el WR de este leader, grande */}
                        <div className="mt-3 flex items-baseline gap-3">
                          <p
                            className={`font-mono text-4xl font-bold ${
                              selectedLeader.raw_win_rate >= 55
                                ? "text-emerald-400"
                                : selectedLeader.raw_win_rate >= 45
                                  ? "text-white"
                                  : "text-red-400"
                            }`}
                          >
                            {selectedLeader.raw_win_rate}%
                          </p>
                          <p className="font-mono text-sm text-gray-400">
                            {selectedLeader.wins}W
                            <span className="text-gray-600"> — </span>
                            {selectedLeader.losses}L
                          </p>
                        </div>

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
                        label="WR Confirmado"
                        value={`${selectedLeader.wtd_win_rate}%`}
                        sub="Solo rondas confirmadas"
                      />
                      <StatCard
                        label="WR Total"
                        value={`${selectedLeader.raw_win_rate}%`}
                        sub="Todas las rondas"
                      />
                      {statsSource === "official" && timeRange === "all" && (
                        <StatCard
                          label="Play Rate"
                          value={`${selectedLeader.play_rate}%`}
                          sub="Del total de rondas en el meta"
                        />
                      )}
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
                  <div className="glass rounded-2xl p-4 sm:p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
                        <span className="text-primary">⚔</span> Matchups
                      </h3>
                      {selectedLeader.matchups.length > 1 && (
                        <div className="inline-flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                          {(
                            [
                              { key: "games", label: "Más jugados" },
                              { key: "best", label: "Mejores" },
                              { key: "worst", label: "Peores" },
                            ] as const
                          ).map((s) => (
                            <button
                              key={s.key}
                              onClick={() => setMatchupSort(s.key)}
                              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                                matchupSort === s.key
                                  ? "bg-primary/20 text-primary"
                                  : "text-gray-500 hover:text-white"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedLeader.matchups.length > 3 && (
                      <div className="relative mb-3">
                        <Search
                          size={14}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
                        />
                        <input
                          type="search"
                          value={matchupSearch}
                          onChange={(e) => setMatchupSearch(e.target.value)}
                          placeholder="Buscar leader oponente…"
                          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-primary/50 focus:outline-none"
                        />
                      </div>
                    )}

                    {selectedLeader.matchups.length === 0 ? (
                      <p className="py-8 text-center text-sm text-gray-500">
                        Aún no tienes matchups registrados con este leader.
                      </p>
                    ) : sortedMatchups.length === 0 ? (
                      <p className="py-8 text-center text-sm text-gray-500">
                        Sin matchups que coincidan con "{matchupSearch}".
                      </p>
                    ) : grouped ? (
                      <div key={`${selectedLeaderIdx}-${matchupSort}-g`} className="space-y-3">
                        {grouped.map((g) => (
                          <details key={g.key} open className="group">
                            <summary className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white [&::-webkit-details-marker]:hidden">
                              <span className="text-[10px] text-gray-600 transition-transform group-open:rotate-90">
                                ▶
                              </span>
                              {g.colors.length > 0 && <ColorDots colors={g.colors} />}
                              {g.key}
                              <span className="ml-auto font-mono text-[11px] normal-case text-gray-500">
                                {g.total > 0 ? Math.round((g.wins / g.total) * 100) : 0}% ·{" "}
                                {g.matchups.length} leaders · {g.total} partidas
                              </span>
                            </summary>
                            <div className="mt-1.5 space-y-2">
                              {g.matchups.map((m) => (
                                <MatchupRow
                                  key={m.opponent_leader_id}
                                  matchup={m}
                                  onClick={() => setVsLeaderId(m.opponent_leader_id)}
                                />
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <div key={`${selectedLeaderIdx}-${matchupSort}`} className="space-y-2">
                        {sortedMatchups.map((m) => (
                          <MatchupRow
                            key={m.opponent_leader_id}
                            matchup={m}
                            onClick={() => setVsLeaderId(m.opponent_leader_id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {vsLeaderId && displayStats && (
          <VsLeaderDrawer
            key={vsLeaderId}
            opponentId={vsLeaderId}
            leaders={displayStats.leaders}
            statsSource={statsSource}
            onClose={() => setVsLeaderId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

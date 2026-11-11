import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ShieldQuestion,
  AlertTriangle,
  BarChart3,
  Search,
  ChevronRight,
  X,
} from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { getMyStats } from "@/lib/nexus-player.functions";
import { myStatsGamesQuery, myStatsSourceQuery } from "@/lib/my-stats-queries";
import { myDashboardQuery } from "@/lib/dashboard-queries";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton-loader";
import { ChipGroup, FOCUS_RING, InlineError, SECTION } from "@/components/stores/store-ui";
import { shortLeaderName, setBadge } from "@/lib/leader-display";
import { LeaderArtPicker } from "@/components/leaders/LeaderArtPicker";
import type { DeckIdentifier } from "@/components/tournament-tracker/round-ui";
import { toast } from "sonner";

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
const dateCutoff = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

// Las respuestas vacías de casual y pendientes no traen la lista.
const noLeaderOf = (s: { no_leader_rounds?: StatsData["no_leader_rounds"] } | null) =>
  s?.no_leader_rounds ?? [];

// Recomputa todos los stats desde round_history con un corte de fecha.
// ponytail: client-side sobre datos ya cargados; si el payload crece demasiado, mover el filtro al server
export function filterStatsByDate(stats: StatsData, days: number): StatsData {
  const cutoff = dateCutoff(days);

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
        tournaments_won: (l.tournament_win_dates ?? []).filter((date) => date >= cutoff).length,
      };
    })
    .filter((l) => l.total_games > 0)
    .sort((a, b) => b.total_games - a.total_games);

  return {
    ...stats,
    total_rounds_in_meta: 0,
    total_tournaments_won: (stats.total_tournament_win_dates ?? []).filter((date) => date >= cutoff)
      .length,
    leaders,
    no_leader_rounds: noLeaderOf(stats).filter((r) => r.date && r.date >= cutoff),
  };
}

const STAT_TOOLTIPS: Record<string, string> = {
  "Win rate": "Porcentaje de rondas ganadas. Todas las rondas de este leader están confirmadas.",
  "Win rate confirmado":
    "Calculado solo con rondas confirmadas por ambos jugadores. Es el número más confiable.",
  "Win rate total":
    "Incluye todas las rondas, confirmadas y pendientes. Puede variar cuando se confirmen datos.",
  "Uso del leader": "Porcentaje de tus partidas que jugaste con este leader.",
  Partidas: "Total de rondas registradas con este leader (excluye byes).",
  "Torneos ganados":
    "Torneos oficiales donde terminaste en 1er lugar jugando principalmente con este leader.",
  "Win rate jugando primero":
    "Tu win rate cuando juegas primero (tienes el turno 1). En One Piece, jugar primero o segundo impacta significativamente la estrategia.",
  "Win rate jugando segundo": "Tu win rate cuando juegas segundo (tu oponente tiene el turno 1).",
  "Win rate ganando dado": "Tu win rate en las partidas donde ganaste la tirada de dado inicial.",
  "Win rate perdiendo dado":
    "Tu win rate en las partidas donde perdiste la tirada de dado inicial.",
  "Mejor puesto":
    "Tu mejor posición final en un torneo, considerando todos tus torneos oficiales de este TCG.",
  "Torneos en Top 8": "Porcentaje de torneos donde terminaste en el top 8.",
};

// Agregados a nivel jugador (no por leader): racha, dado, turno — derivados del round_history
// que cada matchup ya trae cargado, sin pedir datos nuevos al server.
function computePlayerAggregates(stats: StatsData | null) {
  const rounds: RoundHistory[] = stats
    ? stats.leaders.flatMap((l) =>
        l.matchups.flatMap((m) => ((m as any).round_history ?? []) as RoundHistory[]),
      )
    : [];
  if (rounds.length === 0) return null;

  const sorted = [...rounds].sort((a, b) => {
    const ad = a.tournament_date ?? "";
    const bd = b.tournament_date ?? "";
    if (ad !== bd) return ad.localeCompare(bd);
    return a.round_number - b.round_number;
  });

  let bestWinStreak = 0;
  let run = 0;
  for (const r of sorted) {
    run = r.won_match ? run + 1 : 0;
    if (run > bestWinStreak) bestWinStreak = run;
  }

  let currentStreak: { type: "W" | "L" | null; count: number } = { type: null, count: 0 };
  for (let i = sorted.length - 1; i >= 0; i--) {
    const type = sorted[i].won_match ? "W" : "L";
    if (currentStreak.type === null) currentStreak = { type, count: 1 };
    else if (currentStreak.type === type) currentStreak.count++;
    else break;
  }

  const wr = (arr: RoundHistory[]) =>
    arr.length ? round1((arr.filter((r) => r.won_match).length / arr.length) * 100) : null;
  const dieWon = rounds.filter((r) => r.won_die_roll === true);
  const dieLost = rounds.filter((r) => r.won_die_roll === false);
  const first = rounds.filter((r) => r.turn_order === "first");
  const second = rounds.filter((r) => r.turn_order === "second");

  return {
    bestWinStreak,
    currentStreak,
    dieRollWinRate: wr(dieWon),
    dieRollGames: dieWon.length,
    noDieRollWinRate: wr(dieLost),
    noDieRollGames: dieLost.length,
    firstWinRate: wr(first),
    firstGames: first.length,
    secondWinRate: wr(second),
    secondGames: second.length,
  };
}

type DashboardEvent = { game_id: string | null; placement: number | null; date: string };

// Solo torneos oficiales (dashboard events) — puesto/top-cut no aplican a partidas casuales.
export function computeTournamentSummary(events: DashboardEvent[], gameId: string, days?: number) {
  const cutoff = days ? dateCutoff(days) : null;
  const filtered = events.filter(
    (e) => e.game_id === gameId && e.placement != null && (!cutoff || e.date >= cutoff),
  );
  if (filtered.length === 0) return null;
  const placements = filtered.map((e) => e.placement as number);
  const topCut = filtered.filter((e) => (e.placement as number) <= 8).length;
  return {
    played: filtered.length,
    best: Math.min(...placements),
    avg: round1(placements.reduce((a, b) => a + b, 0) / placements.length),
    topCutRate: round1((topCut / filtered.length) * 100),
  };
}

const SOURCE_COPY: Record<StatsSource, { label: string; note: string }> = {
  official: {
    label: "Oficial",
    note: "Solo torneos publicados. Cuentan para tu ranking.",
  },
  casual: { label: "Casual", note: "Partidas casuales y de práctica." },
  pending: {
    label: "Pendientes",
    note: "Partidas en espera de que el organizador publique el torneo. Pasarán a Oficial automáticamente.",
  },
  all: { label: "Todo", note: "Todas tus partidas combinadas (incluye pendientes)." },
};

// Stats que Casual no muestra (puesto, torneos y meta solo existen en torneos oficiales).
const OFFICIAL_ONLY_STATS = new Set([
  "Torneos ganados",
  "Win rate total",
  "Uso del leader",
  "Mejor puesto",
  "Torneos en Top 8",
]);

/** Un solo "Cómo leer" en lugar de un tooltip por cifra: funciona con toque y teclado. */
function StatsGuide({ source }: { source: StatsSource }) {
  const entries = Object.entries(STAT_TOOLTIPS).filter(
    ([term]) => source !== "casual" || !OFFICIAL_ONLY_STATS.has(term),
  );
  return (
    <details className="group mb-4">
      <summary
        className={`inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-foreground-secondary transition hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
      >
        Cómo leer estas stats
        <ChevronRight size={16} aria-hidden="true" className="transition group-open:rotate-90" />
      </summary>
      <dl className="mt-2 grid gap-x-6 gap-y-3 @2xl:grid-cols-2">
        {entries.map(([term, definition]) => (
          <div key={term}>
            <dt className="text-sm font-semibold text-foreground">{term}</dt>
            <dd className="text-sm text-foreground-secondary">{definition}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Fila de dato (Stat Row): label de 12px sobre la cifra en mono, sin tile ni borde. */
function Stat({
  label,
  value,
  sub,
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-foreground-subtle">{label}</dt>
      <dd className={`font-mono-stat text-xl font-bold ${valueClass}`}>{value}</dd>
      {sub && <dd className="text-xs text-foreground-subtle">{sub}</dd>}
    </div>
  );
}

function UncertainBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-medium text-warning">
      <AlertTriangle size={12} />
      Datos inciertos
    </span>
  );
}

// ponytail: <5 partidas = muestra baja, se atenúa el color para no vender un 100% de 1 partida como dato sólido
const LOW_SAMPLE = 5;

// `muted` (Casual): no cuenta para el ranking, así que no se colorea como victoria o derrota.
function wrColorClass(rate: number, lowSample = false, muted = false): string {
  if (lowSample) return "text-foreground-subtle";
  if (muted) return "text-foreground-secondary";
  return rate >= 55 ? "text-success" : rate >= 45 ? "text-foreground" : "text-danger";
}

function WinRateBar({ rate, dim, muted }: { rate: number; dim?: boolean; muted?: boolean }) {
  const color =
    dim || muted
      ? "bg-foreground-subtle"
      : rate >= 55
        ? "bg-success"
        : rate >= 45
          ? "bg-foreground-secondary"
          : "bg-danger";
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
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

function LeaderLabel({
  name,
  setCode,
  colors,
  className = "",
}: {
  name: string;
  setCode?: string | null;
  colors?: string[] | null;
  className?: string;
}) {
  const badge = setBadge(setCode);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="truncate">{shortLeaderName(name)}</span>
      {badge && (
        <span className="flex-shrink-0 rounded border border-border px-1 py-0.5 font-mono text-xs uppercase text-foreground-secondary">
          {badge}
        </span>
      )}
      {colors && colors.length > 0 && <ColorDots colors={colors} />}
    </span>
  );
}

function LeaderCard({
  stat,
  selected,
  imageUrl,
  onClick,
}: {
  stat: LeaderStat;
  selected: boolean;
  imageUrl?: string | null;
  onClick: () => void;
}) {
  const image = imageUrl === undefined ? stat.leader_image : imageUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${FOCUS_RING} ${
        selected ? "border-primary/40 bg-primary/15" : "border-border bg-card hover:bg-white/5"
      }`}
    >
      {image ? (
        <img
          src={image}
          alt={stat.leader_name}
          loading="lazy"
          decoding="async"
          className="h-12 w-8 flex-shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex h-12 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
          <ShieldQuestion size={14} className="text-foreground-subtle" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <LeaderLabel
          name={stat.leader_name}
          setCode={stat.leader_set_code}
          colors={stat.leader_colors}
          className="text-sm font-semibold text-foreground"
        />
        <p className="text-xs text-foreground-subtle">
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

type HistoryRound = RoundHistory & { my_leader_name?: string; my_leader_id: string };

function RoundHistoryList({
  rounds,
  statsSource,
}: {
  rounds: HistoryRound[];
  statsSource: StatsSource;
}) {
  return (
    <div className="divide-y divide-border">
      {rounds.map((r, i) => {
        const prev = rounds[i - 1];
        const leaderChanged = i > 0 && r.my_leader_id !== prev.my_leader_id;
        return (
          <div key={i}>
            {leaderChanged && r.my_leader_name && (
              <p className="pb-1 pt-4 text-xs font-semibold text-foreground-secondary">
                Con {r.my_leader_name}
              </p>
            )}
            <div className="flex items-center justify-between py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-sm font-bold ${r.won_match ? "text-success" : "text-danger"}`}
                  >
                    {r.won_match ? "Victoria" : "Derrota"}
                  </span>
                  <span className="text-sm text-foreground-secondary">vs {r.opponent_tag}</span>
                  {r.is_pending ? (
                    <span className="rounded border border-warning/30 px-1 text-xs text-warning">
                      En espera del torneo
                    </span>
                  ) : (
                    r.status !== "confirmed" &&
                    statsSource === "official" && (
                      <span className="rounded border border-warning/30 px-1 text-xs text-warning">
                        En proceso de vinculación
                      </span>
                    )
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground-subtle flex-wrap">
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
                  <p className="mt-1 text-xs italic text-foreground-subtle truncate max-w-xs">
                    "{r.notes}"
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Drawer "yo vs Leader X": agrega los matchups contra ese leader a través de TODOS mis leaders
function VsLeaderDrawer({
  opponentId,
  leaders,
  statsSource,
  currentLeaderId,
  onClose,
}: {
  opponentId: string;
  leaders: LeaderStat[];
  statsSource: StatsSource;
  currentLeaderId: string | null;
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

  // Agrupamos por leader (el que estás viendo ahora primero) en vez de solo por fecha,
  // así el historial no salta entre leaders partida a partida.
  const orderedEntries = [...entries].sort((a, b) => {
    if (currentLeaderId) {
      if (a.leader.leader_id === currentLeaderId) return -1;
      if (b.leader.leader_id === currentLeaderId) return 1;
    }
    return b.m.total - a.m.total;
  });

  const history: HistoryRound[] = orderedEntries.flatMap((e) =>
    (((e.m as any).round_history ?? []) as RoundHistory[])
      .map((r) => ({
        ...r,
        my_leader_id: e.leader.leader_id,
        my_leader_name: entries.length > 1 ? shortLeaderName(e.leader.leader_name) : undefined,
      }))
      .sort((a, b) => (b.tournament_date ?? "").localeCompare(a.tournament_date ?? "")),
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] bg-black/60"
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
        className="fixed right-0 top-0 bottom-0 z-[71] flex w-full max-w-lg flex-col overflow-y-auto border-l border-border bg-popover shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-popover p-4">
          {opp.opponent_leader_image ? (
            <img
              src={opp.opponent_leader_image}
              alt={opp.opponent_leader_name}
              className="h-14 w-10 flex-shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <ShieldQuestion size={16} className="text-foreground-subtle" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span>vs</span>
              <LeaderLabel
                name={opp.opponent_leader_name}
                setCode={opp.opponent_leader_set_code}
                colors={opp.opponent_leader_colors}
              />
            </h2>
            <p className="text-xs text-foreground-subtle">
              {total} partidas · {entries.length} de tus leaders
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-border text-foreground-secondary transition hover:bg-white/5 hover:text-foreground ${FOCUS_RING}`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 p-4">
          {/* Global vs este leader */}
          <dl className="grid grid-cols-3 gap-x-5">
            <Stat
              label="Total"
              value={`${wr}%`}
              valueClass={wrColorClass(wr, false, statsSource === "casual")}
              sub={`${wins}W — ${total - wins}L`}
            />
            <Stat
              label="Jugando primero"
              value={firstTotal ? `${round1((firstWins / firstTotal) * 100)}%` : "—"}
              sub={`${firstTotal} partidas`}
            />
            <Stat
              label="Jugando segundo"
              value={secondTotal ? `${round1((secondWins / secondTotal) * 100)}%` : "—"}
              sub={`${secondTotal} partidas`}
            />
          </dl>

          {/* Con cuál de mis leaders me va mejor */}
          {entries.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Tu win rate contra {shortLeaderName(opp.opponent_leader_name)}, por leader
              </h3>
              <p className="mb-2 text-xs text-foreground-subtle">
                Cómo te fue contra este oponente cada vez que jugaste con cada uno de tus leaders.
              </p>
              <div className="divide-y divide-border">
                {[...entries]
                  .sort((a, b) => b.m.overall_win_rate - a.m.overall_win_rate)
                  .map((e) => {
                    const low = e.m.total < LOW_SAMPLE;
                    const isCurrent = e.leader.leader_id === currentLeaderId;
                    return (
                      <div
                        key={e.leader.leader_id}
                        className={`flex items-center gap-2.5 px-2 py-2 ${
                          isCurrent ? "bg-primary/10" : ""
                        }`}
                      >
                        {e.leader.leader_image ? (
                          <img
                            src={e.leader.leader_image}
                            alt={e.leader.leader_name}
                            loading="lazy"
                            decoding="async"
                            className="h-8 w-6 flex-shrink-0 rounded border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-muted">
                            <ShieldQuestion size={12} className="text-foreground-subtle" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <LeaderLabel
                              name={e.leader.leader_name}
                              setCode={e.leader.leader_set_code}
                              colors={e.leader.leader_colors}
                              className="text-sm font-semibold text-foreground"
                            />
                            {isCurrent && (
                              <span className="flex-shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">
                                Viendo
                              </span>
                            )}
                          </div>
                          <WinRateBar
                            rate={e.m.overall_win_rate}
                            dim={low}
                            muted={statsSource === "casual"}
                          />
                        </div>
                        <div className="ml-2 flex-shrink-0 text-right">
                          <p
                            className={`font-mono-stat text-sm font-bold ${wrColorClass(e.m.overall_win_rate, low, statsSource === "casual")}`}
                          >
                            {e.m.overall_win_rate}%
                          </p>
                          <p className="text-xs text-foreground-subtle">{e.m.total} partidas</p>
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
              <h3 className="mb-1 text-sm font-semibold text-foreground">Historial de partidas</h3>
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
      const firstWins =
        Math.round(
          ((existing.first_win_rate ?? 0) / 100) * (existing.first_games - l.first_games),
        ) + Math.round(((l.first_win_rate ?? 0) / 100) * l.first_games);
      const secondWins =
        Math.round(
          ((existing.second_win_rate ?? 0) / 100) * (existing.second_games - l.second_games),
        ) + Math.round(((l.second_win_rate ?? 0) / 100) * l.second_games);

      existing.first_win_rate =
        existing.first_games > 0
          ? Math.round((firstWins / existing.first_games) * 1000) / 10
          : null;
      existing.second_win_rate =
        existing.second_games > 0
          ? Math.round((secondWins / existing.second_games) * 1000) / 10
          : null;

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
          ex.first_win_rate =
            ex.first_total > 0 ? Math.round((ex.first_wins / ex.first_total) * 1000) / 10 : null;
          ex.second_win_rate =
            ex.second_total > 0 ? Math.round((ex.second_wins / ex.second_total) * 1000) / 10 : null;
          ex.has_uncertain_data = ex.has_uncertain_data || m.has_uncertain_data;
          (ex as any).round_history = [
            ...((ex as any).round_history ?? []),
            ...((m as any).round_history ?? []),
          ];
        }
      }
      existing.matchups = Array.from(mMap.values()).sort((a, b) => b.total - a.total);
    }
  };

  add(official.leaders as L[]);
  add((casual?.leaders ?? []) as L[]);

  const leaders = Array.from(map.values())
    .map((l) => ({
      ...l,
      raw_win_rate: l.total_games > 0 ? Math.round((l.wins / l.total_games) * 1000) / 10 : 0,
      wtd_win_rate: l.total_games > 0 ? Math.round((l.wins / l.total_games) * 1000) / 10 : 0,
      play_rate: 0,
    }))
    .sort((a, b) => b.total_games - a.total_games);

  return {
    ...official,
    total_rounds_in_meta: 0,
    leaders,
    no_leader_rounds: [...noLeaderOf(official), ...noLeaderOf(casual)],
  };
}

type SingleStatsSource = Exclude<StatsSource, "all">;
type StatsQueryState = { data?: StatsData; isLoading: boolean; isError: boolean };

/** Un error no es un vacío: en Todo combina las fuentes que sí respondieron. */
export function getStatsSourceState(
  statsSource: StatsSource,
  queries: Record<SingleStatsSource, StatsQueryState>,
) {
  const sources: SingleStatsSource[] =
    statsSource === "all" ? ["official", "casual", "pending"] : [statsSource];
  const failedSources = sources.filter((source) => queries[source].isError);
  const loadingStats = sources.some((source) => queries[source].isLoading);
  let stats: StatsData | null = null;

  if (!loadingStats) {
    if (statsSource !== "all") {
      stats = queries[statsSource].data ?? null;
    } else {
      const available = sources
        .map((source) => queries[source].data)
        .filter((data): data is StatsData => Boolean(data));
      stats = available.length > 0 ? available.reduce(mergeStats) : null;
    }
  }

  return { stats, failedSources, loadingStats };
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
  const [leaderArtOverrides, setLeaderArtOverrides] = useState<Record<string, DeckIdentifier>>({});

  useEffect(() => {
    setLeaderArtOverrides({});
    if (!player?.id || !selectedGameId) return;
    try {
      const saved = window.localStorage.getItem(`nexus:leader-art:${player.id}:${selectedGameId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setLeaderArtOverrides(parsed);
        }
      }
    } catch {
      // La personalización no impide consultar estadísticas.
    }
  }, [player?.id, selectedGameId]);

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
  const dashboardQ = useQuery({ ...myDashboardQuery(), enabled: !!player });

  const sourceQueries = { official: officialQ, casual: casualQ, pending: pendingQ };
  const { stats, failedSources, loadingStats } = getStatsSourceState(statsSource, sourceQueries);

  if (!authLoading && !player) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-foreground">Debes iniciar sesión</h2>
        <Link
          to="/login"
          className={`mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground ${FOCUS_RING}`}
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const displayStats =
    stats && timeRange !== "all" ? filterStatsByDate(stats, Number(timeRange)) : stats;
  const statsLoadFailed = failedSources.length > 0 && !loadingStats;
  const hasPartialStats = !!displayStats && displayStats.leaders.length > 0;
  const failedSourceLabels = failedSources
    .map((source) => ({ official: "Oficial", casual: "Casual", pending: "Pendientes" })[source])
    .join(", ");
  const retryFailedSources = () => {
    failedSources.forEach((source) => void sourceQueries[source].refetch());
  };
  // clamp: al filtrar por fecha la lista puede encogerse
  const leaderIdx =
    displayStats && selectedLeaderIdx < displayStats.leaders.length ? selectedLeaderIdx : 0;
  const selectedLeader = displayStats?.leaders[leaderIdx] ?? null;
  const selectedLeaderArt = selectedLeader ? leaderArtOverrides[selectedLeader.leader_id] : null;
  const selectedLeaderImage = selectedLeaderArt
    ? selectedLeaderArt.card_image
    : selectedLeader?.leader_image;
  const handleLeaderArtChange = (art: DeckIdentifier) => {
    if (!player || !selectedGameId || !selectedLeader) return;
    const next = { ...leaderArtOverrides, [selectedLeader.leader_id]: art };
    setLeaderArtOverrides(next);
    try {
      window.localStorage.setItem(
        `nexus:leader-art:${player.id}:${selectedGameId}`,
        JSON.stringify(next),
      );
    } catch {
      toast.error("El arte cambió, pero no pudimos guardarlo en este dispositivo");
    }
  };

  // Resumen global del dataset actual: todos los leaders más las rondas sin leader.
  const noLeaderRounds = noLeaderOf(displayStats);
  const noLeaderWins = noLeaderRounds.filter((r) => r.won).length;
  const overview = displayStats
    ? displayStats.leaders.reduce(
        (a, l) => ({
          games: a.games + l.total_games,
          wins: a.wins + l.wins,
          losses: a.losses + l.losses,
        }),
        {
          games: noLeaderRounds.length,
          wins: noLeaderWins,
          losses: noLeaderRounds.length - noLeaderWins,
        },
      )
    : null;
  const overviewWr =
    overview && overview.games > 0
      ? Math.round((overview.wins / overview.games) * 1000) / 10
      : null;

  const playerAgg = computePlayerAggregates(displayStats);
  const tournamentSummary =
    selectedGameId && statsSource === "official"
      ? computeTournamentSummary(
          dashboardQ.data?.events ?? [],
          selectedGameId,
          timeRange === "all" ? undefined : Number(timeRange),
        )
      : null;

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

  const matchupBuckets = selectedLeader
    ? {
        favored: selectedLeader.matchups.filter((m) => m.overall_win_rate >= 55).length,
        even: selectedLeader.matchups.filter(
          (m) => m.overall_win_rate >= 45 && m.overall_win_rate < 55,
        ).length,
        unfavored: selectedLeader.matchups.filter((m) => m.overall_win_rate < 45).length,
      }
    : null;

  return (
    <div className="@container mx-auto max-w-5xl px-4 py-10 sm:px-6 pb-20">
      {/* Header compacto: back + título + TCG en una fila */}
      <header className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          to="/dashboard"
          aria-label="Volver al inicio"
          className={`flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground-secondary transition hover:bg-white/5 hover:text-foreground sm:h-9 sm:w-9 ${FOCUS_RING}`}
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Mis Stats</h1>

        {!!displayStats?.total_tournaments_won && (
          <span className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground-secondary">
            Torneos ganados: {displayStats.total_tournaments_won}
          </span>
        )}

        {/* TCG: contexto, no filtro — oculto si solo hay uno */}
        {games.length > 1 && (
          <div className="ml-auto max-w-full">
            <ChipGroup
              label="TCG"
              options={games.map((g) => ({ key: g.id, label: g.name }))}
              value={selectedGameId}
              onChange={(key) => key && setSelectedGameId(key)}
            />
          </div>
        )}
      </header>

      {/* Filtros: fuente (nivel principal) + periodo; Pendientes y Todo quedan como vistas secundarias */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <ChipGroup
          label="Fuente de las partidas"
          options={[
            { key: "official", label: SOURCE_COPY.official.label },
            { key: "casual", label: SOURCE_COPY.casual.label },
          ]}
          value={statsSource}
          onChange={(key) => key && setStatsSource(key as StatsSource)}
        />

        <ChipGroup
          label="Periodo"
          options={[
            { key: "30", label: "30 días" },
            { key: "90", label: "90 días" },
            { key: "all", label: "Todo el tiempo" },
          ]}
          value={timeRange}
          onChange={(key) => key && setTimeRange(key as TimeRange)}
        />

        <div role="group" aria-label="Otras vistas" className="flex gap-1">
          {(["pending", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={statsSource === key}
              onClick={() => setStatsSource(key)}
              className={`min-h-11 rounded-md px-3 text-sm font-medium transition sm:min-h-9 ${FOCUS_RING} ${
                statsSource === key
                  ? "bg-primary/15 text-primary"
                  : "text-foreground-secondary hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {SOURCE_COPY[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Qué dataset se está viendo: siempre visible, también en Oficial */}
      <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground-secondary">
        <span>
          <span className="font-semibold text-foreground">{SOURCE_COPY[statsSource].label}</span>
          {" · "}
          {SOURCE_COPY[statsSource].note}
        </span>
        {statsSource === "casual" && (
          <span className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold text-foreground-secondary">
            No cuenta para el ranking
          </span>
        )}
      </p>

      <StatsGuide source={statsSource} />

      {loadingGames ? (
        <div className="mt-4 flex gap-2">
          {[1, 2].map((i) => (
            <SkeletonLine key={i} width="w-28" height="h-9" className="rounded-lg" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className={`${SECTION} p-12 text-center`}>
          <BarChart3 size={40} className="mx-auto mb-4 text-foreground-subtle" />
          <p className="text-sm font-semibold text-foreground">Sin datos registrados</p>
          <p className="mt-2 text-sm text-foreground-secondary">
            Registra tus rondas en Mis Partidas para ver tus stats aquí.
          </p>
          <Link
            to="/sessions"
            className={`mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 sm:min-h-9 ${FOCUS_RING}`}
          >
            Ir a Mis Partidas
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          {statsLoadFailed && (
            <div
              className={`rounded-xl border border-destructive/30 bg-destructive/10 p-4 ${
                hasPartialStats ? "mb-4" : ""
              }`}
            >
              <InlineError onRetry={retryFailedSources}>
                {hasPartialStats
                  ? `No pudimos cargar ${failedSourceLabels}. Ves resultados parciales.`
                  : `No pudimos cargar tus estadísticas: ${failedSourceLabels}.`}
              </InlineError>
            </div>
          )}
          {loadingStats ? (
            <div className="grid gap-6 @4xl:grid-cols-[240px_minmax(0,1fr)]">
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
          ) : statsLoadFailed && !hasPartialStats ? null : !displayStats ||
            displayStats.leaders.length === 0 ? (
            <div className={`${SECTION} p-12 text-center`}>
              <p className="text-sm text-foreground-secondary">
                {noLeaderRounds.length > 0 ? (
                  `Tienes ${noLeaderRounds.length} ${noLeaderRounds.length === 1 ? "ronda" : "rondas"} sin leader (${noLeaderWins}V · ${noLeaderRounds.length - noLeaderWins}D). Agrégalo en Mis Partidas para ver tus stats por leader.`
                ) : statsSource === "casual" ? (
                  <>
                    Sin partidas casuales registradas.{" "}
                    <Link to="/sessions" className="text-primary hover:underline">
                      Crea una partida casual
                    </Link>{" "}
                    para empezar.
                  </>
                ) : statsSource === "pending" ? (
                  "No tienes partidas pendientes de vinculación a un torneo."
                ) : timeRange !== "all" && stats && stats.leaders.length > 0 ? (
                  `Sin partidas en los últimos ${timeRange} días.`
                ) : statsSource === "all" ? (
                  "Sin partidas registradas."
                ) : (
                  "Sin rondas oficiales registradas para este TCG todavía."
                )}
              </p>
            </div>
          ) : (
            <>
              {noLeaderRounds.length > 0 && (
                <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground-secondary">
                  {noLeaderRounds.length === 1
                    ? "1 ronda sin leader cuenta en tu récord, pero no aparece por leader."
                    : `${noLeaderRounds.length} rondas sin leader cuentan en tu récord, pero no aparecen por leader.`}{" "}
                  Agrégalo en{" "}
                  <Link to="/sessions" className="text-primary hover:underline">
                    Mis Partidas
                  </Link>
                  .
                </p>
              )}

              {/* Resumen global del dataset */}
              {overview && overview.games > 0 && (
                <dl className={`${SECTION} mb-6 grid grid-cols-3 divide-x divide-border !p-0`}>
                  <div className="px-4 py-3 text-center sm:py-4">
                    <dt className="text-xs text-foreground-subtle">Récord</dt>
                    <dd className="mt-1 whitespace-nowrap font-mono-stat text-xl font-bold text-foreground sm:text-2xl">
                      {overview.wins}W<span className="text-foreground-subtle"> — </span>
                      {overview.losses}L
                    </dd>
                  </div>
                  <div className="px-4 py-3 text-center sm:py-4">
                    <dt className="text-xs text-foreground-subtle">Win rate</dt>
                    <dd
                      className={`mt-1 font-mono-stat text-xl font-bold sm:text-2xl ${wrColorClass(overviewWr ?? 0, false, statsSource === "casual")}`}
                    >
                      {overviewWr}%
                    </dd>
                  </div>
                  <div className="px-4 py-3 text-center sm:py-4">
                    <dt className="text-xs text-foreground-subtle">Racha actual</dt>
                    <dd
                      className={`mt-1 font-mono-stat text-xl font-bold sm:text-2xl ${
                        !playerAgg || statsSource === "casual"
                          ? "text-foreground-secondary"
                          : playerAgg.currentStreak.type === "W"
                            ? "text-success"
                            : playerAgg.currentStreak.type === "L"
                              ? "text-danger"
                              : "text-foreground"
                      }`}
                    >
                      {playerAgg?.currentStreak.type
                        ? `${playerAgg.currentStreak.count}${playerAgg.currentStreak.type}`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              )}

              {/* Más sobre tu juego — agregados cross-leader, colapsados: son contexto, no la tarea */}
              {(playerAgg || tournamentSummary) && (
                <details className={`group ${SECTION} mb-6`}>
                  <summary
                    className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md text-lg font-semibold text-foreground sm:min-h-9 ${FOCUS_RING}`}
                  >
                    Más sobre tu juego
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className="text-foreground-subtle transition group-open:rotate-90"
                    />
                  </summary>
                  <dl
                    className={`mt-3 grid gap-x-5 gap-y-4 ${
                      statsSource === "casual"
                        ? "grid-cols-1 @md:grid-cols-2"
                        : "grid-cols-2 @md:grid-cols-4"
                    }`}
                  >
                    {playerAgg && (
                      <Stat label="Mejor racha de victorias" value={`${playerAgg.bestWinStreak}`} />
                    )}
                    {playerAgg && (
                      <Stat
                        label="Win rate ganando dado"
                        value={
                          playerAgg.dieRollWinRate != null ? `${playerAgg.dieRollWinRate}%` : "—"
                        }
                        sub={
                          playerAgg.dieRollGames > 0
                            ? `${playerAgg.dieRollGames} partidas`
                            : "Sin datos"
                        }
                      />
                    )}
                    {playerAgg && (
                      <Stat
                        label="Win rate perdiendo dado"
                        value={
                          playerAgg.noDieRollWinRate != null
                            ? `${playerAgg.noDieRollWinRate}%`
                            : "—"
                        }
                        sub={
                          playerAgg.noDieRollGames > 0
                            ? `${playerAgg.noDieRollGames} partidas`
                            : "Sin datos"
                        }
                      />
                    )}
                    {tournamentSummary && (
                      <Stat
                        label="Mejor puesto"
                        value={`#${tournamentSummary.best}`}
                        sub={`${tournamentSummary.played} torneos jugados`}
                      />
                    )}
                    {tournamentSummary && (
                      <Stat
                        label="Torneos en Top 8"
                        value={`${tournamentSummary.topCutRate}%`}
                        sub={`Puesto promedio: #${tournamentSummary.avg}`}
                      />
                    )}
                  </dl>
                </details>
              )}

              <div className="grid gap-6 @4xl:grid-cols-[240px_minmax(0,1fr)]">
                {/* Leaders: select nativo en móvil, sidebar en desktop */}
                <div className="min-w-0">
                  <h2 className="mb-3 text-lg font-semibold text-foreground">
                    Tus leaders{" "}
                    <span className="font-mono-stat text-sm font-normal text-foreground-subtle">
                      {displayStats.leaders.length}
                    </span>
                  </h2>
                  {/* Una sola lista: tira horizontal con scroll en móvil, columna sticky en escritorio */}
                  <div
                    role="group"
                    aria-label="Elegir leader"
                    className="flex gap-2 overflow-x-auto pb-2 @4xl:sticky @4xl:top-24 @4xl:max-h-[calc(100vh-220px)] @4xl:flex-col @4xl:overflow-y-auto @4xl:overflow-x-hidden @4xl:pb-0 @4xl:pr-1"
                  >
                    {displayStats.leaders.map((l, i) => (
                      <div key={l.leader_id} className="w-64 flex-none @4xl:w-full">
                        <LeaderCard
                          stat={l}
                          selected={leaderIdx === i}
                          imageUrl={leaderArtOverrides[l.leader_id]?.card_image}
                          onClick={() => setSelectedLeaderIdx(i)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main — stats del leader seleccionado */}
                {selectedLeader && (
                  <div className="min-w-0 space-y-6">
                    {/* Hero del leader */}
                    <section className={`${SECTION} @2xl:p-6`}>
                      <div className="flex flex-col items-start gap-4 @lg:flex-row @lg:gap-6">
                        {selectedLeaderImage ? (
                          <img
                            src={selectedLeaderImage}
                            alt={selectedLeader.leader_name}
                            className="h-32 w-auto flex-shrink-0 rounded-xl border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-32 w-24 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                            <div className="text-center">
                              <ShieldQuestion
                                size={24}
                                className="mx-auto mb-1 text-foreground-subtle"
                              />
                              <p className="text-xs text-foreground-subtle">Imagen próximamente</p>
                            </div>
                          </div>
                        )}

                        <div className="w-full min-w-0 flex-1">
                          <div className="flex items-start gap-2 flex-wrap">
                            <h2 className="text-xl font-bold text-foreground">
                              <LeaderLabel
                                name={selectedLeader.leader_name}
                                setCode={selectedLeader.leader_set_code}
                                colors={selectedLeader.leader_colors}
                              />
                            </h2>
                            {selectedLeader.has_uncertain_data && <UncertainBadge />}
                          </div>
                          <p className="mt-1 text-xs text-foreground-subtle">
                            {displayStats.game_name} · {SOURCE_COPY[statsSource].label} ·{" "}
                            {selectedLeader.total_games} partidas
                            {timeRange !== "all" ? ` · últimos ${timeRange} días` : ""}
                          </p>
                          {selectedLeader.leader_card_set_id && (
                            <div className="mt-3">
                              <LeaderArtPicker
                                gameId={selectedGameId ?? ""}
                                leaderId={selectedLeader.leader_id}
                                leaderName={selectedLeader.leader_name}
                                cardSetId={selectedLeader.leader_card_set_id}
                                selectedArtId={selectedLeaderArt?.id}
                                onSelect={handleLeaderArtChange}
                              />
                            </div>
                          )}

                          {/* Dato estrella: el WR de este leader, grande */}
                          <div className="mt-3 flex items-baseline gap-3">
                            <p
                              className={`font-mono-stat text-4xl font-bold ${wrColorClass(selectedLeader.raw_win_rate, false, statsSource === "casual")}`}
                            >
                              {selectedLeader.raw_win_rate}%
                            </p>
                            <p className="whitespace-nowrap font-mono-stat text-sm text-foreground-secondary">
                              {selectedLeader.wins}W
                              <span className="text-foreground-subtle"> — </span>
                              {selectedLeader.losses}L
                            </p>
                          </div>

                          {selectedLeader.has_uncertain_data && (
                            <p className="mt-2 text-xs text-warning">
                              Algunas rondas fueron reportadas por tu oponente y aún no están
                              confirmadas. Los porcentajes pueden variar.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stat Row del leader */}
                      <dl
                        className={`mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-border pt-4 ${
                          statsSource === "casual" ? "@md:grid-cols-4" : "@md:grid-cols-3"
                        }`}
                      >
                        <Stat label="Partidas" value={`${selectedLeader.total_games}`} />
                        {statsSource !== "casual" && (
                          <Stat
                            label="Torneos ganados"
                            value={`${selectedLeader.tournaments_won}`}
                            sub={selectedLeader.tournaments_won > 0 ? "Con este leader" : undefined}
                          />
                        )}
                        {/* Si Confirmado y Total coinciden y todo está confirmado, es un solo número */}
                        {selectedLeader.wtd_win_rate === selectedLeader.raw_win_rate &&
                        !selectedLeader.has_uncertain_data ? (
                          <Stat
                            label="Win rate"
                            value={`${selectedLeader.raw_win_rate}%`}
                            sub="Todas las rondas, confirmadas"
                          />
                        ) : (
                          <>
                            <Stat
                              label="Win rate confirmado"
                              value={`${selectedLeader.wtd_win_rate}%`}
                              sub="Solo rondas confirmadas"
                            />
                            {statsSource !== "casual" && (
                              <Stat
                                label="Win rate total"
                                value={`${selectedLeader.raw_win_rate}%`}
                                sub="Todas las rondas"
                              />
                            )}
                          </>
                        )}
                        {statsSource === "official" && overview && overview.games > 0 && (
                          <Stat
                            label="Uso del leader"
                            value={`${round1((selectedLeader.total_games / overview.games) * 100)}%`}
                            sub={`${selectedLeader.total_games} de ${overview.games} partidas`}
                          />
                        )}
                        <Stat
                          label="Win rate jugando primero"
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
                        <Stat
                          label="Win rate jugando segundo"
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
                      </dl>
                    </section>

                    {/* Matchup Breakdown */}
                    <section className={SECTION}>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-foreground">Matchups</h2>
                        {selectedLeader.matchups.length > 1 && (
                          <ChipGroup
                            label="Ordenar matchups"
                            options={[
                              { key: "games", label: "Más jugados" },
                              { key: "best", label: "Mejores" },
                              { key: "worst", label: "Peores" },
                            ]}
                            value={matchupSort}
                            onChange={(key) => key && setMatchupSort(key as typeof matchupSort)}
                          />
                        )}
                      </div>

                      {matchupBuckets && selectedLeader.matchups.length > 0 && (
                        <dl className="mb-4 grid grid-cols-3 gap-x-5">
                          <Stat
                            label="Favorable"
                            value={`${matchupBuckets.favored}`}
                            valueClass={
                              statsSource === "casual"
                                ? "text-foreground-secondary"
                                : "text-success"
                            }
                          />
                          <Stat label="Parejo" value={`${matchupBuckets.even}`} />
                          <Stat
                            label="Desfavorable"
                            value={`${matchupBuckets.unfavored}`}
                            valueClass={
                              statsSource === "casual" ? "text-foreground-secondary" : "text-danger"
                            }
                          />
                        </dl>
                      )}

                      {selectedLeader.matchups.length > 3 && (
                        <div className="relative mb-3">
                          <Search
                            size={16}
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
                          />
                          <input
                            type="search"
                            value={matchupSearch}
                            onChange={(e) => setMatchupSearch(e.target.value)}
                            aria-label="Buscar leader oponente"
                            placeholder="Buscar leader oponente…"
                            className={`min-h-11 w-full rounded-md border border-border bg-transparent py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-subtle sm:min-h-9 ${FOCUS_RING}`}
                          />
                        </div>
                      )}

                      {selectedLeader.matchups.length === 0 ? (
                        <p className="py-8 text-center text-sm text-foreground-secondary">
                          Aún no tienes matchups registrados con este leader.
                        </p>
                      ) : sortedMatchups.length === 0 ? (
                        <p className="py-8 text-center text-sm text-foreground-secondary">
                          Sin matchups que coincidan con "{matchupSearch}".
                        </p>
                      ) : (
                        <div
                          key={`${selectedLeaderIdx}-${matchupSort}`}
                          className="grid gap-2.5"
                          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
                        >
                          {sortedMatchups.map((m) => {
                            const lowOverall = m.total < LOW_SAMPLE;
                            const lowFirst = m.first_total < LOW_SAMPLE;
                            const lowSecond = m.second_total < LOW_SAMPLE;
                            const muted = statsSource === "casual";
                            return (
                              <button
                                type="button"
                                key={m.opponent_leader_id}
                                onClick={() => setVsLeaderId(m.opponent_leader_id)}
                                className={`rounded-lg p-2 text-left transition hover:bg-white/5 ${FOCUS_RING}`}
                              >
                                {m.opponent_leader_image ? (
                                  <img
                                    src={m.opponent_leader_image}
                                    alt={m.opponent_leader_name}
                                    className="mx-auto h-24 w-auto rounded-md border border-border object-cover"
                                  />
                                ) : (
                                  <div className="mx-auto flex h-24 w-16 items-center justify-center rounded-md border border-border bg-muted">
                                    <ShieldQuestion size={18} className="text-foreground-subtle" />
                                  </div>
                                )}
                                <LeaderLabel
                                  name={m.opponent_leader_name}
                                  setCode={m.opponent_leader_set_code}
                                  className="mt-1.5 justify-center text-center text-xs font-semibold text-foreground"
                                />

                                <div className="mt-2 space-y-1 border-t border-border pt-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-foreground-subtle">WR</span>
                                    <span className="font-mono-stat text-xs">
                                      <span
                                        className={`font-bold ${wrColorClass(m.overall_win_rate, lowOverall, muted)}`}
                                      >
                                        {m.overall_win_rate}%
                                      </span>{" "}
                                      <span className="text-foreground-subtle">{m.total}p</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span
                                      className="text-xs text-foreground-subtle"
                                      title="Jugando primero"
                                    >
                                      1º
                                    </span>
                                    <span className="font-mono-stat text-xs">
                                      <span
                                        className={`font-bold ${
                                          m.first_win_rate != null
                                            ? wrColorClass(m.first_win_rate, lowFirst, muted)
                                            : "text-foreground-subtle"
                                        }`}
                                      >
                                        {m.first_win_rate != null ? `${m.first_win_rate}%` : "—"}
                                      </span>{" "}
                                      <span className="text-foreground-subtle">
                                        {m.first_total}p
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span
                                      className="text-xs text-foreground-subtle"
                                      title="Jugando segundo"
                                    >
                                      2º
                                    </span>
                                    <span className="font-mono-stat text-xs">
                                      <span
                                        className={`font-bold ${
                                          m.second_win_rate != null
                                            ? wrColorClass(m.second_win_rate, lowSecond, muted)
                                            : "text-foreground-subtle"
                                        }`}
                                      >
                                        {m.second_win_rate != null ? `${m.second_win_rate}%` : "—"}
                                      </span>{" "}
                                      <span className="text-foreground-subtle">
                                        {m.second_total}p
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
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
            currentLeaderId={selectedLeader?.leader_id ?? null}
            onClose={() => setVsLeaderId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

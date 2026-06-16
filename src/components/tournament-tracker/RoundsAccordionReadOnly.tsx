import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ShieldQuestion, Swords, TrendingDown } from "lucide-react";
import { getTournamentRoundsForPlayer } from "@/lib/geekarena-tournament-tracker.functions";

function WinRateRing({ percent }: { percent: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className="flex items-center gap-2">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span className="text-sm font-bold text-white">{percent}%</span>
    </div>
  );
}

function SummaryCard({
  summary,
  leader,
}: {
  summary: {
    store_name: string | null;
    tournament_date: string;
    wins: number;
    losses: number;
    win_rate: number | null;
    toughest_opponent_tag: string | null;
    toughest_opponent_rank: number | null;
  };
  leader: { base_name: string; card_image: string | null } | null;
}) {
  const dateLabel = new Date(summary.tournament_date + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {summary.store_name ?? "—"} · {dateLabel}
          </p>
          <p className="mt-1 text-[10px] text-gray-500">
            {dateLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          {leader?.card_image ? (
            <img
              src={leader.card_image}
              alt={leader.base_name}
              className="h-16 w-auto rounded-md border border-white/10"
            />
          ) : (
            <div className="flex h-16 w-12 items-center justify-center rounded-md border border-white/10 bg-white/5">
              <ShieldQuestion size={16} className="text-gray-500" />
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Leader</p>
          <p className="text-sm font-semibold text-white">
            {leader?.base_name ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Récord</p>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-white">
              {summary.wins}-{summary.losses}
            </span>
          </div>
        </div>
        {summary.win_rate !== null && <WinRateRing percent={summary.win_rate} />}
      </div>

      {summary.toughest_opponent_tag && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <TrendingDown size={14} className="text-amber-400" />
          Tu oponente más difícil fue{" "}
          <span className="font-semibold text-white">{summary.toughest_opponent_tag}</span>
          {summary.toughest_opponent_rank && (
            <span className="text-gray-500">(terminó #{summary.toughest_opponent_rank})</span>
          )}
        </div>
      )}
    </div>
  );
}

type RoundWithLeaders = {
  id?: string;
  round_number: number;
  is_bye: boolean;
  opponent_player_id: string | null;
  player_leader: { card_name: string; base_name: string; card_image: string | null } | null;
  opponent_leader: { card_name: string; base_name: string; card_image: string | null } | null;
  won_die_roll: boolean | null;
  turn_order: "first" | "second" | null;
  won_match: boolean | null;
  notes: string | null;
};

function RoundAccordionItem({
  round,
  opponentTag,
}: {
  round: RoundWithLeaders;
  opponentTag: string;
}) {
  const [open, setOpen] = useState(false);
  const resultBg =
    round.won_match === true
      ? "bg-gradient-to-r from-emerald-500/15 via-transparent to-transparent border-emerald-500/30"
      : round.won_match === false
      ? "bg-gradient-to-r from-red-500/15 via-transparent to-transparent border-red-500/30"
      : "bg-white/[0.02] border-white/10";

  return (
    <div className={`rounded-xl border ${resultBg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-white">
            R{round.round_number}
          </span>
          <span className="text-sm text-gray-300">
            {round.is_bye ? "Bye" : `vs ${opponentTag}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {round.won_match !== null && (
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                round.won_match
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {round.won_match ? "Victoria" : "Derrota"}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-white/10 px-3 pb-3 pt-3">
          {!round.is_bye ? (
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1.5">
                {round.player_leader?.card_image ? (
                  <img
                    src={round.player_leader.card_image}
                    alt={round.player_leader.card_name}
                    className="h-28 w-auto rounded-md border border-white/10"
                  />
                ) : (
                  <div className="flex h-28 w-20 items-center justify-center rounded-md border border-white/10 bg-white/5">
                    <ShieldQuestion size={20} className="text-gray-500" />
                  </div>
                )}
                <span className="max-w-[84px] truncate text-[11px] text-gray-400">
                  {round.player_leader?.base_name ?? "Sin leader"}
                </span>
              </div>

              <Swords size={18} className="text-gray-500" />

              <div className="flex flex-col items-center gap-1.5">
                {round.opponent_leader?.card_image ? (
                  <img
                    src={round.opponent_leader.card_image}
                    alt={round.opponent_leader.card_name}
                    className="h-28 w-auto rounded-md border border-white/10"
                  />
                ) : (
                  <div className="flex h-28 w-20 items-center justify-center rounded-md border border-white/10 bg-white/5">
                    <ShieldQuestion size={20} className="text-gray-500" />
                  </div>
                )}
                <span className="max-w-[84px] truncate text-[11px] text-gray-400">
                  {round.opponent_leader?.base_name ?? "Sin leader"}
                </span>
              </div>
            </div>
          ) : (
            <p className="py-2 text-center text-sm text-gray-400">Bye — victoria automática</p>
          )}
          {!round.is_bye && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5">
                Dado:{" "}
                <span className="text-white">
                  {round.won_die_roll === null ? "—" : round.won_die_roll ? "Yo" : "Oponente"}
                </span>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5">
                Turno:{" "}
                <span className="text-white">
                  {round.turn_order === "first" ? "Primero" : round.turn_order === "second" ? "Segundo" : "—"}
                </span>
              </div>
            </div>
          )}
          {round.notes && (
            <p className="mt-2 text-xs text-gray-400 italic">{round.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function RoundsAccordionReadOnly({ tournamentId }: { tournamentId: string }) {
  const fetchRounds = useServerFn(getTournamentRoundsForPlayer);
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<RoundWithLeaders[]>([]);
  const [opponentMap, setOpponentMap] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{
    store_name: string | null;
    tournament_date: string;
    wins: number;
    losses: number;
    win_rate: number | null;
    toughest_opponent_tag: string | null;
    toughest_opponent_rank: number | null;
  } | null>(null);
  const [leader, setLeader] = useState<{ base_name: string; card_image: string | null } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchRounds({ data: { tournament_id: tournamentId } })
      .then((res: any) => {
        setRounds(res.rounds ?? []);
        setSummary(res.summary ?? null);
        setLeader(res.my_tournament_leader ?? null);
        const map: Record<string, string> = {};
        for (const o of res.opponents ?? []) map[o.id] = o.geek_tag;
        setOpponentMap(map);
      })
      .catch(() => setRounds([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  if (loading) {
    return <p className="py-6 text-center text-sm text-gray-400">Cargando rondas…</p>;
  }

  if (rounds.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        Aún no has registrado rondas para este torneo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {summary && <SummaryCard summary={summary} leader={leader} />}
      <div className="space-y-2">
        {rounds.map((r) => (
          <RoundAccordionItem
            key={r.id ?? `r-${r.round_number}`}
            round={r}
            opponentTag={r.opponent_player_id ? opponentMap[r.opponent_player_id] ?? "—" : "—"}
          />
        ))}
      </div>
    </div>
  );
}

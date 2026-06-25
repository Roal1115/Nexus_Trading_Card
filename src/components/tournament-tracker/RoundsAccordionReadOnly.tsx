import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ShieldQuestion, Swords, TrendingDown, Scale } from "lucide-react";
import { getTournamentRoundsForPlayer } from "@/lib/geekarena-tournament-tracker.functions";
import { AppealForm } from "@/components/tournament-tracker/AppealForm";
import { AnimatePresence } from "framer-motion";
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
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-bold text-white">{summary.store_name ?? "—"}</p>
      <p className="text-xs text-gray-500">{dateLabel}</p>

      <div className="mt-3 flex items-center gap-3">
        {leader?.card_image ? (
          <img
            src={leader.card_image}
            alt={leader.base_name}
            className="h-14 w-10 flex-shrink-0 rounded-md border border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
            <ShieldQuestion size={16} className="text-gray-600" />
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Leader</p>
          <p className="text-sm font-semibold text-white">{leader?.base_name ?? "—"}</p>
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Récord</p>
        <p className="mt-0.5 text-2xl font-bold text-white">
          {summary.wins}-{summary.losses}
          {summary.win_rate !== null && (
            <span className="ml-2 text-base font-semibold text-emerald-400">
              {summary.win_rate}%
            </span>
          )}
        </p>
      </div>

      {summary.toughest_opponent_tag && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-black/20 px-2.5 py-1.5 text-xs text-gray-300 whitespace-nowrap overflow-x-auto">
          <TrendingDown size={12} className="text-amber-400 flex-shrink-0" />
          <span className="flex-shrink-0">Rival más difícil:</span>
          <span className="font-semibold text-white flex-shrink-0">
            {summary.toughest_opponent_tag}
          </span>
          {summary.toughest_opponent_rank && (
            <span className="text-gray-500 flex-shrink-0">(#{summary.toughest_opponent_rank})</span>
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
  player_leader: {
    id: string;
    card_name: string;
    base_name: string;
    card_image: string | null;
    colors?: string[] | null;
    card_image_id?: string | null;
    set_code?: string | null;
    card_set_id?: string | null;
  } | null;
  opponent_leader: {
    id: string;
    card_name: string;
    base_name: string;
    card_image: string | null;
    colors?: string[] | null;
    card_image_id?: string | null;
    set_code?: string | null;
    card_set_id?: string | null;
  } | null;
  won_die_roll: boolean | null;
  turn_order: "first" | "second" | null;
  won_match: boolean | null;
  notes: string | null;
  is_auto_populated?: boolean;
  status?: string;
};

function RoundAccordionItem({
  round,
  opponentTag,
  gameId,
  onAppealSubmitted,
}: {
  round: RoundWithLeaders;
  opponentTag: string;
  gameId: string;
  onAppealSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const underAppeal = round.status === "under_appeal";

  const resultBg = underAppeal
    ? "bg-gradient-to-r from-amber-500/15 via-transparent to-transparent border-amber-500/30"
    : round.won_match === true
      ? "bg-gradient-to-r from-emerald-500/15 via-transparent to-transparent border-emerald-500/30"
      : round.won_match === false
        ? "bg-gradient-to-r from-red-500/15 via-transparent to-transparent border-red-500/30"
        : "bg-white/[0.02] border-white/10";

  return (
    <div className={`rounded-xl border ${resultBg} overflow-hidden`}>
      {/* Header — toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-white">
            R{round.round_number}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-sm text-gray-300">
              {round.is_bye
                ? "Bye"
                : `vs ${round.opponent_leader?.base_name?.replace(/\s*-\s*[A-Z]{1,4}\d{1,3}-\d{1,3}\s*$/g, "").trim() ?? opponentTag}`}
            </span>
            {!open && !round.is_bye && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="w-full text-[10px] text-gray-500">
                  Oponente:{" "}
                  <span className="text-gray-400">
                    {opponentTag !== "—" ? opponentTag : "Sin registrar"}
                  </span>
                </span>
                {round.won_die_roll !== null && (
                  <span className="text-[10px] text-gray-500">
                    Dado:{" "}
                    <span className="text-gray-400">{round.won_die_roll ? "Yo" : "Oponente"}</span>
                  </span>
                )}
                {round.turn_order !== null && (
                  <span className="text-[10px] text-gray-500">
                    Turno:{" "}
                    <span className="text-gray-400">
                      {round.turn_order === "first" ? "Primero" : "Segundo"}
                    </span>
                  </span>
                )}
                {round.notes && (
                  <span className="text-[10px] italic text-gray-600 truncate max-w-[160px]">
                    "{round.notes}"
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 ml-2">
          {underAppeal ? (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
              En revisión
            </span>
          ) : (
            round.won_match !== null && (
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  round.won_match
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {round.won_match ? "Victoria" : "Derrota"}
              </span>
            )
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Appeal visible cuando está colapsado — FUERA del button */}
      {!open && !round.is_bye && round.is_auto_populated && !underAppeal && (
        <div className="px-3 pb-2.5">
          <button
            type="button"
            onClick={() => setShowAppealForm(true)}
            className="flex items-center gap-1 text-xs text-amber-400 hover:underline"
          >
            <Scale size={12} />
            ¿No estás de acuerdo con el resultado? Apela aquí
          </button>
        </div>
      )}

      {/* Contenido expandido */}
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
                  {round.turn_order === "first"
                    ? "Primero"
                    : round.turn_order === "second"
                      ? "Segundo"
                      : "—"}
                </span>
              </div>
            </div>
          )}
          {round.notes && <p className="mt-2 text-xs text-gray-400 italic">{round.notes}</p>}
          {round.is_auto_populated && !underAppeal && (
            <button
              type="button"
              onClick={() => setShowAppealForm(true)}
              className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:underline"
            >
              <Scale size={12} />
              ¿No estás de acuerdo con el resultado? Apela aquí
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showAppealForm && round.id && (
          <AppealForm
            key="appeal-form"
            roundId={round.id}
            gameId={gameId}
            currentPlayerLeader={round.player_leader}
            currentOpponentLeader={round.opponent_leader}
            currentWonMatch={round.won_match}
            currentWonDieRoll={round.won_die_roll}
            currentTurnOrder={round.turn_order}
            onClose={() => setShowAppealForm(false)}
            onSubmitted={onAppealSubmitted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function RoundsAccordionReadOnly({
  tournamentId,
  gameId,
}: {
  tournamentId: string;
  gameId: string;
}) {
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
  const [leader, setLeader] = useState<{ base_name: string; card_image: string | null } | null>(
    null,
  );

  const reload = () => {
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
  };

  useEffect(() => {
    reload();
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
            opponentTag={r.opponent_player_id ? (opponentMap[r.opponent_player_id] ?? "—") : "—"}
            gameId={gameId}
            onAppealSubmitted={reload}
          />
        ))}
      </div>
    </div>
  );
}

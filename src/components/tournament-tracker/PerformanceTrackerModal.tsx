import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Plus, Trophy, ChevronDown, Trash2, ShieldQuestion } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PerformanceTrackerSkeleton } from "@/components/ui/skeleton-loader";

import { toast } from "sonner";
import {
  getDeckIdentifiers,
  getTournamentRoundsForPlayer,
  saveRoundResult,
  clearTournamentRounds,
  updateMyTournamentLeader,
  deleteRoundResult,
} from "@/lib/nexus-tournament-tracker.functions";
import {
  cleanLeaderName,
  LeaderSearchSelect,
  RoundCardFrame,
  RoundFieldLabel,
  RoundNotesField,
  RoundOutcomeFields,
  RoundSaveButton,
  type DeckIdentifier,
} from "./round-ui";

type RoundRow = {
  id?: string;
  round_number: number;
  is_bye: boolean;
  opponent_player_id: string | null;
  player_leader_id: string | null;
  opponent_leader_id: string | null;
  opponent_leader?: DeckIdentifier | null;
  won_die_roll: boolean | null;
  turn_order: "first" | "second" | null;
  won_match: boolean | null;
  notes: string | null;
  is_auto_populated?: boolean;
  status?: string;
};

function LeaderSelect({
  gameId,
  value,
  onChange,
  placeholder,
}: {
  gameId: string;
  value: DeckIdentifier | null;
  onChange: (d: DeckIdentifier | null) => void;
  placeholder: string;
}) {
  const fetchDeckIdentifiers = useServerFn(getDeckIdentifiers);
  const [artVariants, setArtVariants] = useState<DeckIdentifier[]>([]);

  useEffect(() => {
    if (!value) {
      setArtVariants([]);
      return;
    }
    fetchDeckIdentifiers({
      data: { game_id: gameId, card_set_id: value.card_set_id ?? undefined },
    })
      .then((rows) => setArtVariants(rows as DeckIdentifier[]))
      .catch(() => setArtVariants([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.card_set_id]);

  return (
    <div>
      <LeaderSearchSelect
        gameId={gameId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />

      {value?.card_image && (
        <div className="mt-3 flex items-start gap-3">
          <img
            src={value.card_image}
            alt={value.card_name}
            className="h-32 w-auto rounded-md border border-white/10"
          />
          {artVariants.length > 1 && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-widest text-foreground-subtle">
                Cambiar arte
              </p>
              <div className="flex flex-wrap gap-1.5">
                {artVariants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onChange(v)}
                    className={`h-24 w-16 overflow-hidden rounded-md border-2 transition ${
                      v.id === value.id ? "border-primary" : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {v.card_image && (
                      <img
                        src={v.card_image}
                        alt={v.card_name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground"
      >
        <span className="truncate">
          {selected ? (
            selected.label
          ) : (
            <span className="text-foreground-subtle">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className="text-foreground-subtle flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-white/10 bg-[#0f1117] shadow-xl">
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2.5 text-left text-sm text-foreground bg-transparent hover:bg-white/10 transition"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoundCard({
  round,
  opponents,
  gameId,
  onChange,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  round: RoundRow;
  opponents: Array<{ id: string; geek_tag: string }>;
  gameId: string;
  onChange: (patch: Partial<RoundRow>) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  return (
    <RoundCardFrame
      round={round}
      opponentLabel={
        round.is_bye
          ? "Bye"
          : (opponents.find((o) => o.id === round.opponent_player_id)?.geek_tag ?? "—")
      }
      onDelete={onDelete}
      deleting={deleting}
    >
      {(close) => (
        <>
          <label className="flex items-center gap-2 text-xs text-foreground-secondary">
            <input
              type="checkbox"
              checked={round.is_bye}
              onChange={(e) =>
                onChange({
                  is_bye: e.target.checked,
                  opponent_player_id: null,
                  opponent_leader_id: null,
                  won_die_roll: null,
                  turn_order: null,
                  won_match: e.target.checked ? true : null,
                })
              }
            />
            Bye (ronda libre, sin oponente)
          </label>

          {!round.is_bye && (
            <>
              <div>
                <RoundFieldLabel>Contra quién jugaste</RoundFieldLabel>
                <SimpleSelect
                  value={round.opponent_player_id ?? ""}
                  onChange={(v) => onChange({ opponent_player_id: v || null })}
                  placeholder="Selecciona oponente…"
                  options={opponents.map((o) => ({ value: o.id, label: o.geek_tag }))}
                />
              </div>

              <div>
                <RoundFieldLabel>Leader del oponente</RoundFieldLabel>
                <LeaderSearchSelect
                  gameId={gameId}
                  value={round.opponent_leader ?? null}
                  onChange={(d) => {
                    onChange({ opponent_leader_id: d?.id ?? null, opponent_leader: d });
                  }}
                  placeholder="Selecciona leader…"
                />
              </div>

              <RoundOutcomeFields round={round} onChange={onChange} />
            </>
          )}

          <RoundNotesField value={round.notes} onChange={(notes) => onChange({ notes })} />
          <RoundSaveButton
            saving={saving}
            onClick={async () => {
              await onSave();
              close();
            }}
          />
        </>
      )}
    </RoundCardFrame>
  );
}

export function PerformanceTrackerModal({
  tournamentId,
  gameId,
  onClose,
  embedded = false,
}: {
  tournamentId: string;
  gameId: string;
  onClose: () => void;
  embedded?: boolean;
}) {
  const fetchRounds = useServerFn(getTournamentRoundsForPlayer);
  const saveRound = useServerFn(saveRoundResult);
  const clearRounds = useServerFn(clearTournamentRounds);
  const saveLeader = useServerFn(updateMyTournamentLeader);
  const deleteRound = useServerFn(deleteRoundResult);

  const [loading, setLoading] = useState(true);
  const [maxRounds, setMaxRounds] = useState(0);
  const [opponents, setOpponents] = useState<Array<{ id: string; geek_tag: string }>>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [myLeader, setMyLeader] = useState<DeckIdentifier | null>(null);
  const [savedLeaderId, setSavedLeaderId] = useState<string | null>(null);
  const [savingLeader, setSavingLeader] = useState(false);
  const [savingRound, setSavingRound] = useState<number | null>(null);
  const [deletingRound, setDeletingRound] = useState<number | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearRounds({ data: { tournament_id: tournamentId } });
      setRounds([]);
      setMyLeader(null);
      toast.success("Se eliminó todo el historial de este torneo");
    } catch {
      toast.error("Error al eliminar el historial");
    } finally {
      setClearing(false);
      setConfirmingClear(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchRounds({ data: { tournament_id: tournamentId } })
      .then((res: any) => {
        setMaxRounds(res.max_rounds);
        setOpponents(res.opponents);
        setMyLeader(res.my_tournament_leader ?? null);
        setSavedLeaderId(res.my_tournament_leader?.id ?? null);
        setRounds(
          res.rounds.map((r: any) => ({
            id: r.id,
            round_number: r.round_number,
            is_bye: r.is_bye,
            opponent_player_id: r.opponent_player_id,
            player_leader_id: r.player_leader_id,
            opponent_leader_id: r.opponent_leader_id,
            opponent_leader: r.opponent_leader ?? null,
            won_die_roll: r.won_die_roll,
            turn_order: r.turn_order,
            won_match: r.won_match,
            notes: r.notes,
            is_auto_populated: r.is_auto_populated,
            status: r.status,
          })),
        );
      })
      .catch(() => toast.error("No se pudo cargar la información del torneo"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const usedOpponentIds = useMemo(
    () =>
      new Set(
        rounds.filter((r) => !r.is_bye && r.opponent_player_id).map((r) => r.opponent_player_id),
      ),
    [rounds],
  );

  const wins = rounds.filter((r) => r.won_match === true).length;
  const losses = rounds.filter((r) => r.won_match === false).length;

  const occupiedRoundNumbers = useMemo(() => new Set(rounds.map((r) => r.round_number)), [rounds]);

  const availableRoundNumbers = useMemo(() => {
    const out: number[] = [];
    for (let n = 1; n <= maxRounds; n++) {
      if (!occupiedRoundNumbers.has(n)) out.push(n);
    }
    return out;
  }, [maxRounds, occupiedRoundNumbers]);

  const addRound = (roundNumber: number) => {
    setRounds((prev) =>
      [
        ...prev,
        {
          round_number: roundNumber,
          is_bye: false,
          opponent_player_id: null,
          player_leader_id: null,
          opponent_leader_id: null,
          won_die_roll: null,
          turn_order: null,
          won_match: null,
          notes: null,
        },
      ].sort((a, b) => a.round_number - b.round_number),
    );
  };

  const updateRound = (idx: number, patch: Partial<RoundRow>) => {
    setRounds((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSaveRound = async (idx: number) => {
    const round = rounds[idx];
    if (!round.is_bye && !round.opponent_player_id) {
      toast.error("Selecciona un oponente o marca Bye");
      return;
    }
    setSavingRound(idx);
    try {
      await saveRound({
        data: {
          tournament_id: tournamentId,
          round_number: round.round_number,
          is_bye: round.is_bye,
          opponent_player_id: round.opponent_player_id,
          player_leader_id: round.player_leader_id ?? myLeader?.id ?? null,
          opponent_leader_id: round.opponent_leader_id,
          won_die_roll: round.won_die_roll,
          turn_order: round.turn_order,
          won_match: round.won_match,
          notes: round.notes,
        },
      });
      toast.success(`Ronda ${round.round_number} guardada`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar la ronda");
    } finally {
      setSavingRound(null);
    }
  };

  const savedOwnRounds = rounds.filter((r) => r.id && !r.is_auto_populated && !r.is_bye);
  const leaderChanged = Boolean(myLeader) && myLeader?.id !== savedLeaderId;

  const handleSaveLeader = async () => {
    if (!myLeader) return;
    setSavingLeader(true);
    try {
      await saveLeader({ data: { tournament_id: tournamentId, leader_id: myLeader.id } });
      setSavedLeaderId(myLeader.id);
      setRounds((prev) =>
        prev.map((r) =>
          r.is_auto_populated || r.is_bye ? r : { ...r, player_leader_id: myLeader.id },
        ),
      );
      toast.success("Leader actualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el leader");
    } finally {
      setSavingLeader(false);
    }
  };

  const handleDeleteRound = async (idx: number) => {
    const round = rounds[idx];
    setDeletingRound(idx);
    try {
      if (round.id) {
        await deleteRound({
          data: { tournament_id: tournamentId, round_number: round.round_number },
        });
      }
      setRounds((prev) => prev.filter((_, i) => i !== idx));
      toast.success(`Ronda ${round.round_number} eliminada`);
    } catch {
      toast.error("Error al eliminar la ronda");
    } finally {
      setDeletingRound(null);
    }
  };

  const content = (
    <>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <Trophy className="text-primary mt-1" size={22} />
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Mis Partidas</h2>
            <p className="mt-1 text-xs text-foreground-secondary">
              Registra el detalle de cada ronda: contra quién jugaste, qué leader usaste, y el
              resultado.
            </p>
          </div>
        </div>
        {rounds.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            title="Eliminar todo el historial de este torneo"
            className="rounded-md p-1.5 text-foreground-secondary hover:bg-red-500/15 hover:text-red-400 transition"
          >
            <Trash2 size={18} />
          </button>
        )}
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-foreground-secondary hover:bg-white/10 hover:text-foreground"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {loading ? (
        <PerformanceTrackerSkeleton />
      ) : (
        <div className="space-y-4">
          {/* Hero header — leader image + record, same format as /sessions/$sessionId */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <div className="flex items-end gap-4 p-4">
              <div className="relative flex-shrink-0">
                {myLeader?.card_image ? (
                  <img
                    src={myLeader.card_image}
                    alt={myLeader.base_name}
                    className="h-24 w-16 rounded-xl border border-white/20 object-cover shadow-xl"
                  />
                ) : (
                  <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-white/10 bg-black/40">
                    <ShieldQuestion size={20} className="text-foreground-subtle" />
                  </div>
                )}
                {(wins > 0 || losses > 0) && (
                  <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                    <span className="rounded-full bg-black/80 px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                      <span className="text-emerald-400">{wins}V</span>
                      <span className="text-foreground-subtle"> · </span>
                      <span className="text-red-400">{losses}D</span>
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-lg font-bold text-foreground truncate">
                  {myLeader ? cleanLeaderName(myLeader.base_name) : "Sin leader"}
                </p>
                <p className="text-xs text-foreground-subtle">Tu leader en este torneo</p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-foreground-subtle">
              Cambiar tu leader
            </label>
            <LeaderSelect
              gameId={gameId}
              value={myLeader}
              onChange={setMyLeader}
              placeholder="Selecciona tu leader…"
            />
            {leaderChanged &&
              (savedOwnRounds.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-amber-400">
                    Sin guardar. Se aplicará a {savedOwnRounds.length}{" "}
                    {savedOwnRounds.length === 1 ? "ronda capturada" : "rondas capturadas"}.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveLeader}
                    disabled={savingLeader}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {savingLeader ? "Guardando…" : "Guardar leader"}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-foreground-secondary">
                  Se guardará con tu primera ronda.
                </p>
              ))}
          </div>

          {/* Table header */}
          {rounds.length > 0 && (
            <div className="grid grid-cols-[28px_1fr_40px_40px_28px_28px] gap-2 px-3 pb-1 text-xs uppercase text-foreground-subtle sm:grid-cols-[40px_1fr_52px_52px_52px_36px] sm:tracking-widest">
              <span>
                <span className="sm:hidden">#</span>
                <span className="hidden sm:inline">Round</span>
              </span>
              <span>Rival</span>
              <span className="text-center">Dado</span>
              <span className="text-center">Turno</span>
              <span className="text-center">Res</span>
            </div>
          )}

          <div className="space-y-2">
            {rounds.map((round, idx) =>
              round.is_auto_populated ? (
                <div
                  key={round.id ?? `auto-${idx}`}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">
                      Ronda {round.round_number}{" "}
                      <span className="ml-1 text-xs font-normal uppercase tracking-wider text-amber-400">
                        Reportada por tu oponente
                      </span>
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-foreground-secondary">
                    Este resultado fue registrado por tu rival en esta ronda. Por ahora no se puede
                    editar desde aquí.
                  </p>
                </div>
              ) : (
                <RoundCard
                  key={round.id ?? `new-${idx}`}
                  round={round}
                  opponents={opponents.filter(
                    (o) => o.id === round.opponent_player_id || !usedOpponentIds.has(o.id),
                  )}
                  gameId={gameId}
                  onChange={(patch) => updateRound(idx, patch)}
                  onSave={() => handleSaveRound(idx)}
                  onDelete={() => handleDeleteRound(idx)}
                  saving={savingRound === idx}
                  deleting={deletingRound === idx}
                />
              ),
            )}
          </div>

          {availableRoundNumbers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableRoundNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => addRound(n)}
                  className="flex items-center gap-1.5 rounded-md border border-dashed border-white/20 px-4 py-2 text-sm font-medium text-foreground-secondary hover:border-primary hover:text-primary transition"
                >
                  <Plus size={14} /> Ronda {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  const clearConfirmModal = (
    <>
      {confirmingClear && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0f1117] p-6 text-center shadow-2xl">
            <p className="text-base font-bold text-foreground">
              ¿Eliminar todo el historial de este torneo?
            </p>
            <p className="mt-2 text-sm text-foreground-secondary">
              Se borrarán todas las rondas que registraste para este torneo. Esta acción no se puede
              deshacer.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearing}
                className="rounded-md bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-foreground disabled:opacity-50"
              >
                {clearing ? "Eliminando…" : "Sí, eliminar todo"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                disabled={clearing}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <>
        {content}
        {clearConfirmModal}
      </>
    );
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="tracker-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            key="tracker-content"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="glass relative max-h-[calc(90dvh-4rem)] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-white/10 bg-black/85 p-5 sm:max-h-[90vh] sm:min-h-[500px] sm:rounded-2xl sm:p-8"
          >
            {content}
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {clearConfirmModal}
    </>
  );
}

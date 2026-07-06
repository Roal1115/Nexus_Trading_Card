import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Plus, Trophy, ChevronDown, Trash2, ShieldQuestion } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { toast } from "sonner";
import {
  getDeckIdentifiers,
  getTournamentRoundsForPlayer,
  saveRoundResult,
  clearTournamentRounds,
  deleteRoundResult,
} from "@/lib/geekarena-tournament-tracker.functions";

type DeckIdentifier = {
  id: string;
  card_name: string;
  base_name: string;
  colors: string[] | null;
  card_image: string | null;
  card_image_id: string | null;
  set_code: string | null;
  card_set_id: string | null;
};

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

const COLOR_HEX: Record<string, string> = {
  Red: "#ef4444",
  Blue: "#3b82f6",
  Green: "#22c55e",
  Purple: "#a855f7",
  Black: "#374151",
  Yellow: "#eab308",
};

function cleanDisplayName(name: string): string {
  return name.replace(/\s*-\s*[A-Z]{1,4}\d{1,3}-\d{1,3}\s*$/g, "").trim();
}

function ColorDots({ colors }: { colors: string[] | null }) {
  if (!colors || colors.length === 0) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-0.5">
      {colors.map((c) => (
        <span
          key={c}
          className="h-2 w-2 rounded-full border border-white/20"
          style={{ backgroundColor: COLOR_HEX[c] ?? "#666" }}
        />
      ))}
    </span>
  );
}

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<DeckIdentifier[]>([]);
  const [artVariants, setArtVariants] = useState<DeckIdentifier[]>([]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      fetchDeckIdentifiers({
        data: { game_id: gameId, search: search || undefined, basic_only: true },
      })
        .then((rows) => setOptions(rows as DeckIdentifier[]))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, gameId]);

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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
      >
        <span className="flex items-center truncate">
          {value ? (
            <>
              {cleanDisplayName(value.base_name)}
              <ColorDots colors={value.colors} />
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-white/10 bg-[#0f1117] shadow-xl">
          <div className="relative p-2">
            <Search
              size={13}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar leader…"
              className="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-8 pr-2 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-500">Sin resultados.</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white bg-transparent hover:bg-white/10 transition"
                >
                  <span className="flex-shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    {opt.card_set_id}
                  </span>
                  <span className="flex-1 truncate text-white">
                    {cleanDisplayName(opt.base_name)}
                  </span>
                  <ColorDots colors={opt.colors} />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {value?.card_image && (
        <div className="mt-3 flex items-start gap-3">
          <img
            src={value.card_image}
            alt={value.card_name}
            className="h-32 w-auto rounded-md border border-white/10"
          />
          {artVariants.length > 1 && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">
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

function OpponentLeaderSelect({
  gameId,
  value,
  onChange,
}: {
  gameId: string;
  value: DeckIdentifier | null;
  onChange: (d: DeckIdentifier | null) => void;
}) {
  const fetchDeckIdentifiers = useServerFn(getDeckIdentifiers);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<DeckIdentifier[]>([]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      fetchDeckIdentifiers({
        data: { game_id: gameId, search: search || undefined, basic_only: true },
      })
        .then((rows) => setOptions(rows as DeckIdentifier[]))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, gameId]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
      >
        <span className="flex items-center truncate">
          {value ? (
            <>
              {cleanDisplayName(value.base_name)}
              <ColorDots colors={value.colors} />
            </>
          ) : (
            <span className="text-gray-500">Selecciona leader…</span>
          )}
        </span>
        <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-white/10 bg-[#0f1117] shadow-xl">
          <div className="relative p-2">
            <Search
              size={13}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar leader…"
              className="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-8 pr-2 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-500">Sin resultados.</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white bg-transparent hover:bg-white/10 transition"
                >
                  <span className="flex-shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    {opt.card_set_id}
                  </span>
                  <span className="flex-1 truncate text-white">
                    {cleanDisplayName(opt.base_name)}
                  </span>
                  <ColorDots colors={opt.colors} />
                </button>
              ))
            )}
          </div>
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
        className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
      >
        <span className="truncate">
          {selected ? selected.label : <span className="text-gray-500">{placeholder}</span>}
        </span>
        <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
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
                className="flex w-full items-center px-3 py-2.5 text-left text-sm text-white bg-transparent hover:bg-white/10 transition"
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
  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const resultColor = round.won_match === true
    ? "bg-emerald-500/10 border-l-2 border-l-emerald-500"
    : round.won_match === false
    ? "bg-red-500/10 border-l-2 border-l-red-500"
    : "bg-white/[0.02]";

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors duration-150 ${
        deleteConfirm ? "border-red-500/40" : "border-white/10"
      } ${resultColor}`}
    >
      {/* Collapsed row */}
      <div
        onClick={() => !deleteConfirm && setOpen((o) => !o)}
        className={`relative grid grid-cols-[40px_1fr_52px_52px_52px_36px] items-center gap-2 px-3 py-3 cursor-pointer transition-colors duration-150 ${
          open ? "bg-white/[0.04]" : "hover:bg-white/[0.04] active:bg-white/[0.07]"
        }`}
      >
        {/* Round number */}
        <span
          className={`font-mono text-sm font-bold ${
            round.won_match === true
              ? "text-emerald-400"
              : round.won_match === false
              ? "text-red-400"
              : "text-gray-400"
          }`}
        >
          R{round.round_number}
        </span>

        {/* Opponent */}
        <div className="flex items-center gap-2 min-w-0 text-left">
          {round.opponent_leader?.card_image ? (
            <img
              src={round.opponent_leader.card_image}
              alt={round.opponent_leader.base_name}
              className="h-9 w-6 flex-shrink-0 rounded-md border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-9 w-6 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
              <span className="text-[8px] text-gray-600">?</span>
            </div>
          )}
          <span className="truncate text-xs text-gray-300">
            {round.is_bye
              ? "Bye"
              : opponents.find((o) => o.id === round.opponent_player_id)?.geek_tag ?? "—"}
          </span>
        </div>

        {/* Dice */}
        <span className="text-center text-[11px] text-gray-400">
          {round.won_die_roll === null ? "—" : round.won_die_roll ? "Yo" : "Opp"}
        </span>

        {/* Order */}
        <span className="text-center text-[11px] text-gray-400">
          {round.turn_order === "first" ? "1st" : round.turn_order === "second" ? "2nd" : "—"}
        </span>

        {/* Result */}
        <span
          className={`text-center text-xs font-bold ${
            round.won_match === true
              ? "text-emerald-400"
              : round.won_match === false
              ? "text-red-400"
              : "text-gray-500"
          }`}
        >
          {round.is_bye ? "Bye" : round.won_match === true ? "W" : round.won_match === false ? "L" : "—"}
        </span>

        {/* Delete button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirm(true);
          }}
          className="relative z-10 flex items-center justify-center rounded-md p-1.5 text-gray-600 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={13} />
        </button>

        {/* Delete confirmation — full-row overlay */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className={`absolute inset-0 z-40 flex items-center justify-between gap-3 rounded-t-xl bg-red-950/95 px-4 backdrop-blur-sm ${
                open ? "" : "rounded-b-xl"
              }`}
            >
              <span className="text-xs font-medium text-red-100">
                ¿Eliminar Ronda {round.round_number}?
              </span>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting ? "…" : "Eliminar"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expanded form */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-4 pb-5 pt-4 space-y-5">
              <label className="flex items-center gap-2 text-xs text-gray-300">
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
                  {/* Oponente */}
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-gray-500">
                      Contra quién jugaste
                    </label>
                    <SimpleSelect
                      value={round.opponent_player_id ?? ""}
                      onChange={(v) => onChange({ opponent_player_id: v || null })}
                      placeholder="Selecciona oponente…"
                      options={opponents.map((o) => ({ value: o.id, label: o.geek_tag }))}
                    />
                  </div>

                  {/* Leader del oponente */}
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-gray-500">
                      Leader del oponente
                    </label>
                    <OpponentLeaderSelect
                      gameId={gameId}
                      value={round.opponent_leader ?? null}
                      onChange={(d) => {
                        onChange({ opponent_leader_id: d?.id ?? null, opponent_leader: d });
                      }}
                    />
                  </div>

                  {/* Dado — 2 toggle buttons */}
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-gray-500">
                      Dado
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onChange({ won_die_roll: true })}
                        className={`rounded-xl py-3 text-sm font-semibold transition ${
                          round.won_die_roll === true
                            ? "bg-emerald-500 text-white"
                            : "border border-white/10 bg-white/5 text-gray-400 hover:border-emerald-500/40 hover:text-emerald-400"
                        }`}
                      >
                        Gané
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange({ won_die_roll: false })}
                        className={`rounded-xl py-3 text-sm font-semibold transition ${
                          round.won_die_roll === false
                            ? "bg-red-500 text-white"
                            : "border border-white/10 bg-white/5 text-gray-400 hover:border-red-500/40 hover:text-red-400"
                        }`}
                      >
                        Perdí
                      </button>
                    </div>
                  </div>

                  {/* Turno — 2 toggle buttons */}
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-gray-500">
                      Turno
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onChange({ turn_order: "first" })}
                        className={`rounded-xl py-3 text-sm font-semibold transition ${
                          round.turn_order === "first"
                            ? "bg-primary text-primary-foreground"
                            : "border border-white/10 bg-white/5 text-gray-400 hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        Primero
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange({ turn_order: "second" })}
                        className={`rounded-xl py-3 text-sm font-semibold transition ${
                          round.turn_order === "second"
                            ? "bg-primary text-primary-foreground"
                            : "border border-white/10 bg-white/5 text-gray-400 hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        Segundo
                      </button>
                    </div>
                  </div>

                  {/* Resultado — 2 toggle buttons */}
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-gray-500">
                      Resultado
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onChange({ won_match: true })}
                        className={`rounded-xl py-3 text-sm font-semibold transition ${
                          round.won_match === true
                            ? "bg-emerald-500 text-white"
                            : "border border-white/10 bg-white/5 text-gray-400 hover:border-emerald-500/40 hover:text-emerald-400"
                        }`}
                      >
                        Victoria
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange({ won_match: false })}
                        className={`rounded-xl py-3 text-sm font-semibold transition ${
                          round.won_match === false
                            ? "bg-red-500 text-white"
                            : "border border-white/10 bg-white/5 text-gray-400 hover:border-red-500/40 hover:text-red-400"
                        }`}
                      >
                        Derrota
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Notas */}
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-gray-500">
                  Notas (opcional)
                </label>
                <textarea
                  value={round.notes ?? ""}
                  onChange={(e) => onChange({ notes: e.target.value || null })}
                  rows={2}
                  placeholder="Estrategia, observaciones…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-primary"
                />
              </div>

              {/* Save button — full width */}
              <button
                type="button"
                onClick={async () => {
                  await onSave();
                  setOpen(false);
                }}
                disabled={saving}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50 transition hover:brightness-110"
              >
                {saving ? "Guardando…" : "Guardar Ronda"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const deleteRound = useServerFn(deleteRoundResult);

  const [loading, setLoading] = useState(true);
  const [maxRounds, setMaxRounds] = useState(0);
  const [opponents, setOpponents] = useState<Array<{ id: string; geek_tag: string }>>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [myLeader, setMyLeader] = useState<DeckIdentifier | null>(null);
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
    } catch {
      toast.error("Error al guardar la ronda");
    } finally {
      setSavingRound(null);
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
            <h2 className="text-xl font-extrabold text-white">Performance Tracker</h2>
            <p className="mt-1 text-xs text-gray-400">
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
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-500/15 hover:text-red-400 transition"
          >
            <Trash2 size={18} />
          </button>
        )}
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
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
                    <ShieldQuestion size={20} className="text-gray-600" />
                  </div>
                )}
                {(wins > 0 || losses > 0) && (
                  <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                    <span className="rounded-full bg-black/80 px-2 py-0.5 font-mono text-xs font-bold text-white">
                      <span className="text-emerald-400">{wins}V</span>
                      <span className="text-gray-500"> · </span>
                      <span className="text-red-400">{losses}D</span>
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-lg font-bold text-white truncate">
                  {myLeader ? cleanDisplayName(myLeader.base_name) : "Sin leader"}
                </p>
                <p className="text-xs text-gray-500">Tu leader en este torneo</p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-gray-500">
              Cambiar tu leader
            </label>
            <LeaderSelect
              gameId={gameId}
              value={myLeader}
              onChange={setMyLeader}
              placeholder="Selecciona tu leader…"
            />
          </div>

          {/* Table header */}
          {rounds.length > 0 && (
            <div className="grid grid-cols-[40px_1fr_52px_52px_52px] gap-2 px-3 pb-1">
              <span className="text-[10px] uppercase tracking-widest text-gray-600">Round</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-600">Rival</span>
              <span className="text-center text-[10px] uppercase tracking-widest text-gray-600">
                Dado
              </span>
              <span className="text-center text-[10px] uppercase tracking-widest text-gray-600">
                Turno
              </span>
              <span className="text-center text-[10px] uppercase tracking-widest text-gray-600">
                Res
              </span>
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
                    <p className="text-sm font-bold text-white">
                      Ronda {round.round_number}{" "}
                      <span className="ml-1 text-[10px] font-normal uppercase tracking-wider text-amber-400">
                        Reportada por tu oponente
                      </span>
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
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
                  className="flex items-center gap-1.5 rounded-md border border-dashed border-white/20 px-4 py-2 text-sm font-medium text-gray-300 hover:border-primary hover:text-primary transition"
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
            <p className="text-base font-bold text-white">
              ¿Eliminar todo el historial de este torneo?
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Se borrarán todas las rondas que registraste para este torneo. Esta acción no se puede
              deshacer.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearing}
                className="rounded-md bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {clearing ? "Eliminando…" : "Sí, eliminar todo"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                disabled={clearing}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            key="tracker-content"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="glass relative w-full max-w-3xl max-h-[90vh] min-h-[500px] overflow-y-auto rounded-2xl border border-white/10 bg-black/85 p-6 sm:p-8"
          >
            {content}
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {clearConfirmModal}
    </>
  );
}

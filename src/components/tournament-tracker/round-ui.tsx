import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Search, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getDeckIdentifiers } from "@/lib/nexus-tournament-tracker.functions";
import { ColorDots } from "./color-dots";

// Solo interfaz: cada pantalla sigue guardando con sus propias funciones y tablas.

export type DeckIdentifier = {
  id: string;
  card_name: string;
  base_name: string;
  colors: string[] | null;
  card_image: string | null;
  card_image_id: string | null;
  set_code: string | null;
  card_set_id: string | null;
};

export function cleanLeaderName(name: string): string {
  return name.replace(/\s*-\s*[A-Z]{1,4}\d{1,3}-\d{1,3}\s*$/g, "").trim();
}

export function LeaderSearchSelect({
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
  const fetchLeaders = useServerFn(getDeckIdentifiers);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<DeckIdentifier[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetchLeaders({
        data: { game_id: gameId, search: search || undefined, basic_only: true },
      })
        .then((rows) => setOptions(rows as DeckIdentifier[]))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [open, search, gameId, fetchLeaders]);

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
              {cleanLeaderName(value.base_name)}
              <ColorDots colors={value.colors} />
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 text-gray-500" />
      </button>

      {open && (
        <div className="animate-in fade-in-0 zoom-in-95 duration-150 absolute z-40 mt-1 w-full rounded-md border border-white/10 bg-[#0f1117] shadow-xl">
          <div className="relative p-2">
            <Search
              size={13}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar leader o ID (ej. OP10-010)…"
              className="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-8 pr-2 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
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
                  className="flex w-full items-center gap-2 bg-transparent px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/10"
                >
                  <span className="flex-shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-primary">
                    {opt.card_set_id}
                  </span>
                  <span className="flex-1 truncate">{cleanLeaderName(opt.base_name)}</span>
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

type FrameRound = {
  round_number: number;
  is_bye: boolean;
  won_match: boolean | null;
  won_die_roll: boolean | null;
  turn_order: "first" | "second" | null;
  opponent_leader?: { card_image: string | null; base_name: string } | null;
};

/** Fila plegable de una ronda. Sin `onDelete` es de solo lectura. */
export function RoundCardFrame({
  round,
  opponentLabel,
  onDelete,
  deleting = false,
  children,
}: {
  round: FrameRound;
  opponentLabel: string;
  onDelete?: () => void;
  deleting?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const resultColor =
    round.won_match === true
      ? "bg-emerald-500/10 border-l-2 border-l-emerald-500"
      : round.won_match === false
        ? "bg-red-500/10 border-l-2 border-l-red-500"
        : "bg-white/[0.02]";
  const resultText =
    round.won_match === true
      ? "text-emerald-400"
      : round.won_match === false
        ? "text-red-400"
        : "text-gray-500";

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors duration-150 ${
        deleteConfirm ? "border-red-500/40" : "border-white/10"
      } ${resultColor}`}
    >
      <div
        onClick={() => !deleteConfirm && setOpen((o) => !o)}
        className={`relative grid ${
          onDelete
            ? "grid-cols-[28px_1fr_40px_40px_28px_28px] sm:grid-cols-[40px_1fr_52px_52px_52px_36px]"
            : "grid-cols-[28px_1fr_40px_40px_28px] sm:grid-cols-[40px_1fr_52px_52px_52px]"
        } items-center gap-2 px-3 py-3 cursor-pointer transition-colors duration-150 ${
          open ? "bg-white/[0.04]" : "hover:bg-white/[0.04] active:bg-white/[0.07]"
        }`}
      >
        <span
          className={`font-mono text-sm font-bold ${
            round.won_match === null ? "text-gray-400" : resultText
          }`}
        >
          R{round.round_number}
        </span>

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
          <span className="truncate text-xs text-gray-300">{opponentLabel}</span>
        </div>

        <span className="text-center text-xs text-gray-400">
          {round.won_die_roll === null ? "—" : round.won_die_roll ? "Yo" : "Opp"}
        </span>

        <span className="text-center text-xs text-gray-400">
          {round.turn_order === "first" ? "1st" : round.turn_order === "second" ? "2nd" : "—"}
        </span>

        <span className={`text-center text-xs font-bold ${resultText}`}>
          {round.is_bye
            ? "Bye"
            : round.won_match === true
              ? "W"
              : round.won_match === false
                ? "L"
                : "—"}
        </span>

        {onDelete && (
          <button
            type="button"
            aria-label={`Eliminar ronda ${round.round_number}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirm(true);
            }}
            className="relative z-10 flex items-center justify-center rounded-md p-1.5 text-gray-600 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={13} />
          </button>
        )}

        {/* Cubre toda la fila: el overflow-hidden de la tarjeta no puede recortarla. */}
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
              {children(() => setOpen(false))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RoundFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs uppercase tracking-widest text-gray-500">
      {children}
    </label>
  );
}

const GOOD_ON = "bg-emerald-500 text-white";
const GOOD_OFF = "hover:border-emerald-500/40 hover:text-emerald-400";
const BAD_ON = "bg-red-500 text-white";
const BAD_OFF = "hover:border-red-500/40 hover:text-red-400";
const NEUTRAL_ON = "bg-primary text-primary-foreground";
const NEUTRAL_OFF = "hover:border-primary/40 hover:text-primary";

function ChoiceButton({
  active,
  activeClass,
  idleClass,
  onClick,
  children,
}: {
  active: boolean;
  activeClass: string;
  idleClass: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl py-3 text-sm font-semibold transition ${
        active ? activeClass : `border border-white/10 bg-white/5 text-gray-400 ${idleClass}`
      }`}
    >
      {children}
    </button>
  );
}

/** Dado, turno y resultado. */
export function RoundOutcomeFields({
  round,
  onChange,
}: {
  round: Pick<FrameRound, "won_die_roll" | "turn_order" | "won_match">;
  onChange: (patch: Partial<Pick<FrameRound, "won_die_roll" | "turn_order" | "won_match">>) => void;
}) {
  return (
    <>
      <div>
        <RoundFieldLabel>Dado</RoundFieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <ChoiceButton
            active={round.won_die_roll === true}
            activeClass={GOOD_ON}
            idleClass={GOOD_OFF}
            onClick={() => onChange({ won_die_roll: true })}
          >
            Gané
          </ChoiceButton>
          <ChoiceButton
            active={round.won_die_roll === false}
            activeClass={BAD_ON}
            idleClass={BAD_OFF}
            onClick={() => onChange({ won_die_roll: false })}
          >
            Perdí
          </ChoiceButton>
        </div>
      </div>

      <div>
        <RoundFieldLabel>Turno</RoundFieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <ChoiceButton
            active={round.turn_order === "first"}
            activeClass={NEUTRAL_ON}
            idleClass={NEUTRAL_OFF}
            onClick={() => onChange({ turn_order: "first" })}
          >
            Primero
          </ChoiceButton>
          <ChoiceButton
            active={round.turn_order === "second"}
            activeClass={NEUTRAL_ON}
            idleClass={NEUTRAL_OFF}
            onClick={() => onChange({ turn_order: "second" })}
          >
            Segundo
          </ChoiceButton>
        </div>
      </div>

      <div>
        <RoundFieldLabel>Resultado</RoundFieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <ChoiceButton
            active={round.won_match === true}
            activeClass={GOOD_ON}
            idleClass={GOOD_OFF}
            onClick={() => onChange({ won_match: true })}
          >
            Victoria
          </ChoiceButton>
          <ChoiceButton
            active={round.won_match === false}
            activeClass={BAD_ON}
            idleClass={BAD_OFF}
            onClick={() => onChange({ won_match: false })}
          >
            Derrota
          </ChoiceButton>
        </div>
      </div>
    </>
  );
}

export function RoundNotesField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (notes: string | null) => void;
}) {
  return (
    <div>
      <RoundFieldLabel>Notas (opcional)</RoundFieldLabel>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        rows={2}
        placeholder="Estrategia, observaciones…"
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-primary"
      />
    </div>
  );
}

export function RoundSaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50 transition hover:brightness-110"
    >
      {saving ? "Guardando…" : "Guardar Ronda"}
    </button>
  );
}

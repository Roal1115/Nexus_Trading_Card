import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trophy,
  Swords,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Link2Off,
  ChevronDown,
  ShieldQuestion,
  Plus,
  Save,
  Trash2,
  Search,
  Loader2,
  X,
  StickyNote,
  Dices,
  Rocket,
  ShieldHalf,
  Pencil,
  Check,
  CalendarDays,
  Images,
} from "lucide-react";
import { useNexusRole } from "@/hooks/use-nexus-role";
import {
  getStandaloneSessionDetail,
  undoSessionLink,
  deleteStandaloneSession,
  getTournamentCandidates,
  linkSessionManually,
  saveStandaloneRound,
  deleteStandaloneRound,
  updateStandaloneSessionDetails,
} from "@/lib/nexus-standalone.functions";
import { getDeckIdentifiers } from "@/lib/nexus-tournament-tracker.functions";
import { ColorDots } from "@/components/tournament-tracker/color-dots";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton-loader";
import { AnimatePresence, motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/sessions/$sessionId")({
  head: () => ({ meta: [{ title: "Sesión — Nexus" }] }),
  component: SessionDetailPage,
});

// ============================================================
// Types
// ============================================================
type SessionDetail = Awaited<ReturnType<typeof getStandaloneSessionDetail>>;
type SessionData = SessionDetail["session"];
type RoundData = SessionDetail["rounds"][number];

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

// Rename/delete/link state & handlers, owned by SessionDetailPage and rendered
// inside the merged hero card so both live in the same section.
type SessionHeaderProps = {
  editingDetails: boolean;
  setEditingDetails: (v: boolean) => void;
  nameDraft: string;
  setNameDraft: (v: string) => void;
  dateDraft: string;
  setDateDraft: (v: string) => void;
  savingDetails: boolean;
  onSaveDetails: () => void;
  deleteConfirming: boolean;
  setDeleteConfirming: (v: boolean) => void;
  deleting: boolean;
  onDelete: () => void;
  undoConfirming: boolean;
  setUndoConfirming: (v: boolean) => void;
  undoing: boolean;
  onUndo: () => void;
  onLinkManually: () => void;
};

type Candidate = {
  id: string;
  tournament_date: string;
  tournament_time: string | null;
  store_id: string;
  store_name: string;
  store_city: string;
  store_zone: string | null;
  diff_hours: number;
  is_home_zone: boolean;
};

// ============================================================
// Helpers
// ============================================================
function formatDate(date: string | null): string {
  if (!date) return "Sin fecha";
  try {
    return new Date(date + "T00:00:00").toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function formatTime(time: string | null): string {
  if (!time) return "Sin hora";
  try {
    const [h, m] = time.split(":");
    const d = new Date();
    d.setHours(Number(h), Number(m));
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return time;
  }
}

function cleanName(name: string): string {
  return name.replace(/\s*-\s*[A-Z]{1,4}\d{1,3}-\d{1,3}\s*$/g, "").trim();
}

// ============================================================
// Win-rate trend helpers — chart dot + tooltip
// ============================================================
function ResultDot({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null;
  const color = payload.result === "win" ? "#34d399" : "#f87171";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#0f1117" strokeWidth={1.5} />;
}

function WinRateTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-white/10 bg-[#0f1117] px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-semibold text-white">Ronda {p.round}</p>
      <p className={p.result === "win" ? "text-emerald-400" : "text-red-400"}>
        {p.result === "win" ? "Victoria" : "Derrota"} · {p.rate}% acum.
      </p>
    </div>
  );
}

// ============================================================
// StatusBadge
// ============================================================
function StatusBadge({ status }: { status: string }) {
  if (status === "unlinked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Pendiente
      </span>
    );
  }
  if (status === "matched") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
        <CheckCircle2 size={12} />
        Vinculada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-gray-400">
      <Swords size={12} />
      Casual
    </span>
  );
}

// ============================================================
// LeaderSelect — reutiliza patrón de PerformanceTrackerModal
// ============================================================
// ============================================================
// LeaderArtSwitcher — pick a different art/printing for the same card_set_id
// ============================================================
function LeaderArtSwitcher({
  gameId,
  value,
  onChange,
}: {
  gameId: string;
  value: DeckIdentifier;
  onChange: (d: DeckIdentifier) => void;
}) {
  const fetchLeaders = useServerFn(getDeckIdentifiers);
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<DeckIdentifier[]>([]);

  useEffect(() => {
    if (!open || !value.card_set_id) return;
    fetchLeaders({ data: { game_id: gameId, card_set_id: value.card_set_id } })
      .then((rows) => setVariants(rows as DeckIdentifier[]))
      .catch(() => setVariants([]));
  }, [open, value.card_set_id, gameId, fetchLeaders]);

  return (
    <div className="mt-2">
      <div className="relative inline-block">
        <img
          src={value.card_image ?? undefined}
          alt={value.base_name}
          className="h-20 max-w-full rounded-md border border-white/10 object-contain"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Cambiar arte"
          className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-white backdrop-blur-sm transition hover:bg-black/90"
        >
          <Images size={11} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {variants.length === 0 ? (
                <p className="text-[10px] text-gray-500">Buscando artes…</p>
              ) : (
                variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onChange(v);
                      setOpen(false);
                    }}
                    className={`flex-shrink-0 overflow-hidden rounded-md border transition ${
                      v.id === value.id
                        ? "border-primary ring-1 ring-primary"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {v.card_image ? (
                      <img
                        src={v.card_image}
                        alt={v.card_name}
                        className="h-16 w-11 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-11 items-center justify-center bg-black/30 text-[8px] text-gray-600">
                        ?
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
        <span className="truncate">
          {value ? (
            cleanName(value.base_name)
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
                  <span className="flex-shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    {opt.card_set_id}
                  </span>
                  <span className="flex-1 truncate">{cleanName(opt.base_name)}</span>
                  <ColorDots colors={opt.colors} />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {value?.card_image && (
        <LeaderArtSwitcher gameId={gameId} value={value} onChange={onChange} />
      )}
    </div>
  );
}

// ============================================================
// StandaloneRoundCard
// ============================================================
type RoundState = {
  id?: string;
  round_number: number;
  is_bye: boolean;
  player_leader: DeckIdentifier | null;
  player_leader_id: string | null;
  opponent_leader: DeckIdentifier | null;
  opponent_leader_id: string | null;
  opponent_player_id: string | null;
  won_die_roll: boolean | null;
  turn_order: "first" | "second" | null;
  won_match: boolean | null;
  notes: string | null;
};

function RoundBadge({ active, icon, label }: { active: boolean; icon: ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-white/10 bg-white/5 text-gray-400"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function RoundSummary({ round }: { round: RoundState }) {
  const resultLabel = round.is_bye
    ? "Bye"
    : round.won_match === null
      ? "Pendiente"
      : round.won_match
        ? "Victoria"
        : "Derrota";
  const resultClass = round.is_bye
    ? "text-gray-400"
    : round.won_match === null
      ? "text-gray-500"
      : round.won_match
        ? "text-emerald-400"
        : "text-red-400";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="h-12 w-9 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
        {round.player_leader?.card_image ? (
          <img
            src={round.player_leader.card_image}
            alt={round.player_leader.base_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-600">
            <ShieldQuestion size={16} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 text-sm font-bold text-white">
            Ronda {round.round_number}
          </span>
          <span className={`flex-shrink-0 text-xs font-semibold ${resultClass}`}>
            {resultLabel}
          </span>
        </div>
        {!round.is_bye && (round.won_die_roll !== null || round.turn_order) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {round.won_die_roll !== null && (
              <RoundBadge
                active={round.won_die_roll}
                icon={<Dices size={10} />}
                label={round.won_die_roll ? "Yo" : "Rival"}
              />
            )}
            {round.turn_order && (
              <RoundBadge
                active={round.turn_order === "first"}
                icon={
                  round.turn_order === "first" ? <Rocket size={10} /> : <ShieldHalf size={10} />
                }
                label={round.turn_order === "first" ? "1º" : "2º"}
              />
            )}
          </div>
        )}
      </div>

      {round.notes && (
        <StickyNote size={14} className="flex-shrink-0 text-gray-500" aria-label="Tiene notas" />
      )}
    </div>
  );
}

function StandaloneRoundCard({
  round,
  gameId,
  onChange,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  round: RoundState;
  gameId: string;
  onChange: (patch: Partial<RoundState>) => void;
  onSave: () => Promise<boolean>;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const resultColor =
    round.won_match === true
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

        {/* Opponent deck */}
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
            {round.opponent_leader ? cleanName(round.opponent_leader.base_name) : "—"}
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
          {round.won_match === true ? "W" : round.won_match === false ? "L" : "—"}
        </span>

        {/* Delete button — discrete, far from Save */}
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

        {/* Delete confirmation — full-row overlay, can't be clipped by the card's overflow-hidden */}
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
              {/* Opponent leader */}
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-gray-500">
                  Leader del oponente
                </label>
                <LeaderSelect
                  gameId={gameId}
                  value={round.opponent_leader}
                  onChange={(d) =>
                    onChange({ opponent_leader: d, opponent_leader_id: d?.id ?? null })
                  }
                  placeholder="Selecciona leader oponente…"
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

              {/* Save button — full width, no delete here */}
              <button
                type="button"
                onClick={async () => {
                  const ok = await onSave();
                  if (ok) setOpen(false);
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

// ============================================================
// HeroLeaderPicker — tap the image to open a full-screen (mobile) /
// centered (desktop) sheet: search any leader, or pick another art of
// the same card when the search box is empty. One flow for both.
// ============================================================
function HeroLeaderPicker({
  gameId,
  value,
  onChange,
}: {
  gameId: string;
  value: DeckIdentifier | null;
  onChange: (d: DeckIdentifier) => void;
}) {
  const fetchLeaders = useServerFn(getDeckIdentifiers);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<DeckIdentifier[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const trimmed = search.trim();
    const t = setTimeout(() => {
      const query = trimmed
        ? { game_id: gameId, search: trimmed, basic_only: true }
        : value?.card_set_id
          ? { game_id: gameId, card_set_id: value.card_set_id }
          : { game_id: gameId, basic_only: true };
      fetchLeaders({ data: query })
        .then((rows) => setResults(rows as DeckIdentifier[]))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [open, search, gameId, value?.card_set_id, fetchLeaders]);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Cambiar leader"
        className="relative flex-shrink-0 block"
      >
        {value?.card_image ? (
          <img
            src={value.card_image}
            alt={value.base_name}
            className="h-24 w-16 rounded-xl border border-white/20 object-cover shadow-xl transition active:brightness-90"
          />
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-white/10 bg-black/40 transition active:border-primary/40">
            <ShieldQuestion size={20} className="text-gray-600" />
          </div>
        )}
        <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0b0d12] bg-primary text-primary-foreground shadow">
          <Pencil size={11} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={close}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-white/10 bg-[#0f1117] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[75vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border"
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-bold text-white">Cambiar leader</h2>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md p-1.5 text-gray-500 transition hover:bg-white/5 hover:text-white"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-shrink-0 p-3">
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar leader o ID (ej. OP10-010)…"
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-9 pr-3 text-sm text-white outline-none focus:border-primary"
                  />
                </div>
                {!search.trim() && value && (
                  <p className="mt-3 px-0.5 text-[10px] uppercase tracking-widest text-gray-600">
                    Otras versiones de esta carta
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {searching ? (
                  <p className="py-10 text-center text-xs text-gray-500">Buscando…</p>
                ) : results.length === 0 ? (
                  <p className="py-10 text-center text-xs text-gray-500">Sin resultados.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {results.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onChange(opt);
                          close();
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition active:scale-95 ${
                          opt.id === value?.id
                            ? "border-primary bg-primary/10"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        {opt.card_image ? (
                          <img
                            src={opt.card_image}
                            alt={opt.base_name}
                            className="h-20 w-14 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-14 items-center justify-center rounded-md bg-black/30">
                            <ShieldQuestion size={16} className="text-gray-600" />
                          </div>
                        )}
                        <span className="line-clamp-2 text-[10px] leading-tight text-gray-300">
                          {cleanName(opt.base_name)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================
// StandaloneRoundTracker
// ============================================================
function StandaloneRoundTracker({
  sessionId,
  gameId,
  initialRounds,
  sessionStatus,
  session,
  header,
}: {
  sessionId: string;
  gameId: string;
  initialRounds: RoundData[];
  sessionStatus: string;
  session: any;
  header: SessionHeaderProps;
}) {
  const saveRound = useServerFn(saveStandaloneRound);
  const delRound = useServerFn(deleteStandaloneRound);
  const updateSessionDetails = useServerFn(updateStandaloneSessionDetails);

  const [rounds, setRounds] = useState<RoundState[]>(() =>
    initialRounds.map((r) => ({
      id: r.id,
      round_number: r.round_number,
      is_bye: r.is_bye,
      player_leader: (r.player_leader as DeckIdentifier | null) ?? null,
      player_leader_id: (r.player_leader as any)?.id ?? null,
      opponent_leader: (r.opponent_leader as DeckIdentifier | null) ?? null,
      opponent_leader_id: (r.opponent_leader as any)?.id ?? null,
      opponent_player_id: null,
      won_die_roll: r.won_die_roll,
      turn_order: r.turn_order,
      won_match: r.won_match,
      notes: r.notes,
    })),
  );

  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);

  const isLocked = sessionStatus === "matched";

  const wins = rounds.filter((r) => r.won_match === true).length;
  const losses = rounds.filter((r) => r.won_match === false).length;

  const chartData = useMemo(() => {
    const played = rounds
      .filter((r) => !r.is_bye && r.won_match !== null)
      .sort((a, b) => a.round_number - b.round_number);
    let cumWins = 0;
    return played.map((r, i) => {
      if (r.won_match) cumWins++;
      return {
        round: r.round_number,
        rate: Math.round((cumWins / (i + 1)) * 1000) / 10,
        result: r.won_match ? "win" : "loss",
      };
    });
  }, [rounds]);
  const winRate = chartData.length ? chartData[chartData.length - 1].rate : null;

  // Leader chosen at session creation, falling back to the first round that has one
  const [heroLeaderOverride, setHeroLeaderOverride] = useState<DeckIdentifier | null>(null);
  const heroLeader: DeckIdentifier | null =
    heroLeaderOverride ??
    (session?.player_leader as DeckIdentifier | null) ??
    rounds.find((r) => r.player_leader)?.player_leader ??
    null;

  const handleHeroLeaderChange = async (leader: DeckIdentifier) => {
    setHeroLeaderOverride(leader);
    try {
      await updateSessionDetails({
        data: { session_id: sessionId, player_leader_id: leader.id },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el leader");
    }
  };

  const occupiedNumbers = useMemo(() => new Set(rounds.map((r) => r.round_number)), [rounds]);
  const nextRoundNumber = useMemo(() => {
    let n = 1;
    while (occupiedNumbers.has(n)) n++;
    return n;
  }, [occupiedNumbers]);

  const addRound = () => {
    setRounds((prev) =>
      [
        ...prev,
        {
          round_number: nextRoundNumber,
          is_bye: false,
          player_leader: null,
          player_leader_id: null,
          opponent_leader: null,
          opponent_leader_id: null,
          opponent_player_id: null,
          won_die_roll: null,
          turn_order: null,
          won_match: null,
          notes: null,
        },
      ].sort((a, b) => a.round_number - b.round_number),
    );
  };

  const updateRound = (idx: number, patch: Partial<RoundState>) => {
    setRounds((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSave = async (idx: number): Promise<boolean> => {
    const r = rounds[idx];
    setSavingIdx(idx);
    try {
      await saveRound({
        data: {
          session_id: sessionId,
          round_number: r.round_number,
          is_bye: r.is_bye,
          player_leader_id: r.player_leader_id ?? heroLeader?.id ?? null,
          opponent_leader_id: r.opponent_leader_id,
          opponent_player_id: r.opponent_player_id,
          won_die_roll: r.won_die_roll,
          turn_order: r.turn_order,
          won_match: r.won_match,
          notes: r.notes,
        },
      });
      toast.success(`Ronda ${r.round_number} guardada`);
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
      return false;
    } finally {
      setSavingIdx(null);
    }
  };

  const handleDelete = async (idx: number) => {
    const r = rounds[idx];
    setDeletingIdx(idx);
    try {
      await delRound({ data: { session_id: sessionId, round_number: r.round_number } });
      setRounds((prev) => prev.filter((_, i) => i !== idx));
      toast.success(`Ronda ${r.round_number} eliminada`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar");
    } finally {
      setDeletingIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Merged header — identity/rename, delete/status, leader, record & win-rate trend */}
      <div className="glass relative overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-6">
        {/* Top row — name/rename + meta, status + delete */}
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {session?.session_type === "competitive" ? (
              <Trophy size={20} className="flex-shrink-0 text-primary" />
            ) : (
              <Swords size={20} className="flex-shrink-0 text-gray-400" />
            )}
            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                {header.editingDetails ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-wrap items-center gap-1.5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") header.onSaveDetails();
                      if (e.key === "Escape") header.setEditingDetails(false);
                    }}
                  >
                    <input
                      autoFocus
                      value={header.nameDraft}
                      onChange={(e) => header.setNameDraft(e.target.value)}
                      maxLength={100}
                      placeholder="Nombre de la sesión"
                      className="w-full max-w-[200px] rounded-md border border-primary/40 bg-white/5 px-2 py-1 text-base font-bold text-white outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1">
                      <CalendarDays size={13} className="flex-shrink-0 text-gray-500" />
                      <input
                        type="date"
                        value={header.dateDraft}
                        onChange={(e) => header.setDateDraft(e.target.value)}
                        style={{ colorScheme: "dark" }}
                        className="bg-transparent text-xs text-white outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={header.onSaveDetails}
                      disabled={header.savingDetails || !header.nameDraft.trim()}
                      className="flex-shrink-0 rounded-md p-1.5 text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-40"
                      aria-label="Guardar cambios"
                    >
                      {header.savingDetails ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Check size={15} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => header.setEditingDetails(false)}
                      className="flex-shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-white/5 hover:text-white"
                      aria-label="Cancelar"
                    >
                      <X size={15} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="display"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="group flex min-w-0 items-center gap-1.5"
                  >
                    <h1 className="truncate text-xl font-bold text-white">
                      {session?.name ?? "Sesión"}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        header.setNameDraft(session?.name ?? "");
                        header.setDateDraft(session?.session_date ?? "");
                        header.setEditingDetails(true);
                      }}
                      className="flex-shrink-0 rounded-md p-1 text-gray-600 opacity-100 transition hover:bg-white/5 hover:text-primary sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Editar nombre y fecha"
                    >
                      <Pencil size={13} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                <span>{session?.game_name}</span>
                {!header.editingDetails && session?.session_date && (
                  <>
                    <span>·</span>
                    <span>{formatDate(session.session_date)}</span>
                  </>
                )}
                {session?.session_time && (
                  <>
                    <span>·</span>
                    <span>{formatTime(session.session_time)}</span>
                  </>
                )}
                {session?.store_name && (
                  <>
                    <span>·</span>
                    <span>{session.store_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <StatusBadge status={session?.status} />
            {session?.status !== "matched" && (
              <button
                onClick={() => header.setDeleteConfirming(true)}
                className="rounded-md p-1.5 text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                aria-label="Eliminar sesión"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Delete confirmation — full-row overlay */}
          <AnimatePresence>
            {header.deleteConfirming && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-20 flex items-center justify-between gap-3 rounded-xl bg-red-950/95 px-4 backdrop-blur-sm"
              >
                <span className="truncate text-sm font-medium text-red-100">
                  ¿Eliminar "{session?.name}"?
                </span>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={header.onDelete}
                    disabled={header.deleting}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {header.deleting ? "…" : "Eliminar"}
                  </button>
                  <button
                    onClick={() => header.setDeleteConfirming(false)}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status banners */}
        {session?.status === "matched" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <Link2 size={14} className="flex-shrink-0" />
              <span>
                Vinculada al torneo de{" "}
                <strong>{session.tournament_store_name ?? "—"}</strong>
                {session.tournament_date && <> · {formatDate(session.tournament_date)}</>}
              </span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {header.undoConfirming ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5"
                >
                  <span className="text-[11px] text-gray-300">¿Deshacer?</span>
                  <button
                    onClick={header.onUndo}
                    disabled={header.undoing}
                    className="rounded-md bg-red-500/20 px-2 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                  >
                    {header.undoing ? "…" : "Sí"}
                  </button>
                  <button
                    onClick={() => header.setUndoConfirming(false)}
                    className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300"
                  >
                    No
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="trigger"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => header.setUndoConfirming(true)}
                  className="flex items-center gap-1 text-xs text-red-400 transition hover:underline"
                >
                  <Link2Off size={12} /> Deshacer vínculo
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}

        {session?.status === "unlinked" && session?.session_type === "competitive" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-300">
              <AlertTriangle size={14} className="flex-shrink-0" />
              <span>
                Pendiente de vinculación. Se vinculará automáticamente cuando el organizador
                publique el torneo.
              </span>
            </div>
            <button
              onClick={header.onLinkManually}
              className="text-xs text-primary transition hover:underline"
            >
              Vincular manualmente
            </button>
          </div>
        )}

        {/* Leader, record & win-rate — same card, below a divider */}
        <div className="mt-5 flex items-end gap-4 border-t border-white/10 pt-4">
          <HeroLeaderPicker gameId={gameId} value={heroLeader} onChange={handleHeroLeaderChange} />

          <div className="min-w-0 flex-1 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-600">Récord</p>
            <p className="font-mono text-lg font-bold text-white">
              <span className="text-emerald-400">{wins}V</span>
              <span className="text-gray-600"> · </span>
              <span className="text-red-400">{losses}D</span>
            </p>
          </div>

          {chartData.length >= 2 && (
            <div className="flex-shrink-0 pb-1 text-right">
              <p className="text-[10px] uppercase tracking-widest text-gray-600">Win rate</p>
              <p className="font-mono text-2xl font-bold text-white">{winRate}%</p>
            </div>
          )}
        </div>

        {/* Win-rate trend, same card, below the leader row */}
        {chartData.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3"
          >
            <div className="mb-2 flex items-center justify-end gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Victoria
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400" /> Derrota
              </span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="winRateFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="round"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  tickFormatter={(v) => `R${v}`}
                />
                <YAxis hide domain={[0, 100]} />
                <ReferenceLine y={50} stroke="#374151" strokeDasharray="3 3" />
                <Tooltip content={<WinRateTooltip />} cursor={{ stroke: "#374151", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#winRateFill)"
                  dot={<ResultDot />}
                  activeDot={{ r: 5, stroke: "#0f1117", strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Table header */}
      {rounds.length > 0 && (
        <div className="grid grid-cols-[40px_1fr_52px_52px_52px] gap-2 px-3 pb-1">
          <span className="text-[10px] uppercase tracking-widest text-gray-600">Round</span>
          <span className="text-[10px] uppercase tracking-widest text-gray-600">Deck</span>
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

      {/* Round list */}
      {rounds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
          <p className="text-sm text-gray-500">Sin rondas registradas aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {rounds.map((r, idx) => (
              <motion.div
                key={r.id ?? `new-${r.round_number}`}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <StandaloneRoundCard
                  round={r}
                  gameId={gameId}
                  onChange={(patch) => updateRound(idx, patch)}
                  onSave={() => handleSave(idx)}
                  onDelete={() => handleDelete(idx)}
                  saving={savingIdx === idx}
                  deleting={deletingIdx === idx}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Floating add button — mobile */}
      {!isLocked && (
        <button
          type="button"
          onClick={addRound}
          aria-label="Agregar Ronda"
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition hover:brightness-110 active:scale-95 sm:hidden"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Desktop add button */}
      {!isLocked && (
        <button
          type="button"
          onClick={addRound}
          className="hidden sm:flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-sm font-medium text-gray-400 transition hover:border-primary hover:text-primary"
        >
          <Plus size={15} /> Agregar Ronda
        </button>
      )}
    </div>
  );
}

// ============================================================
// DisambiguationPicker
// ============================================================
function DisambiguationPicker({
  sessionId,
  open,
  onClose,
  onLinked,
}: {
  sessionId: string;
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
}) {
  const fetchCandidates = useServerFn(getTournamentCandidates);
  const linkFn = useServerFn(linkSessionManually);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [homeZone, setHomeZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open) {
      setCandidates([]);
      setShowAll(false);
      setSelectedId(null);
      setConfirming(false);
      return;
    }
    setLoading(true);
    fetchCandidates({ data: { session_id: sessionId } })
      .then((res) => {
        setCandidates(res.candidates as Candidate[]);
        setHomeZone(res.home_zone);
      })
      .catch((e: any) => toast.error(e?.message ?? "Error al buscar candidatos"))
      .finally(() => setLoading(false));
  }, [open, sessionId, fetchCandidates]);

  const homeZoneCandidates = candidates.filter((c) => c.is_home_zone);
  const otherCandidates = candidates.filter((c) => !c.is_home_zone);
  const visibleCandidates = showAll
    ? candidates
    : homeZoneCandidates.length > 0
      ? homeZoneCandidates
      : candidates.slice(0, 3);

  const selectedCandidate = candidates.find((c) => c.id === selectedId) ?? null;

  const handleConfirmLink = async () => {
    if (!selectedId) return;
    setLinking(true);
    try {
      await linkFn({ data: { session_id: sessionId, tournament_id: selectedId } });
      toast.success("Sesión vinculada correctamente");
      onLinked();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al vincular");
    } finally {
      setLinking(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 pointer-events-none">
            <motion.div
              initial={{ y: "100%", opacity: 1 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="pointer-events-auto glass w-full max-w-lg rounded-t-2xl border border-white/10 bg-black/90 shadow-2xl sm:rounded-2xl"
              style={{ maxHeight: "80vh" }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="text-base font-bold text-white">Vincular manualmente</h2>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-gray-500 hover:bg-white/5 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(80vh - 60px)" }}>
                {confirming && selectedCandidate ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-300">
                      ¿Vincular esta sesión al siguiente torneo?
                    </p>
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                      <p className="text-sm font-semibold text-white">
                        {selectedCandidate.store_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {selectedCandidate.store_city} ·{" "}
                        {formatDate(selectedCandidate.tournament_date)} ·{" "}
                        {formatTime(selectedCandidate.tournament_time)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmLink}
                        disabled={linking}
                        className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50 transition hover:brightness-110"
                      >
                        {linking ? "Vinculando…" : "Confirmar"}
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-gray-300 transition hover:text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="space-y-2">
                    <SkeletonBlock className="h-16 rounded-xl" />
                    <SkeletonBlock className="h-16 rounded-xl" />
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-400">
                      No encontramos torneos publicados que coincidan con la fecha de esta sesión.
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      El organizador puede no haber subido los resultados aún.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {homeZone && homeZoneCandidates.length > 0 && (
                      <p className="text-[10px] uppercase tracking-widest text-gray-500">
                        Tu zona · {homeZone}
                      </p>
                    )}

                    {visibleCandidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedId(c.id);
                          setConfirming(true);
                        }}
                        className="flex w-full items-start justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{c.store_name}</p>
                          <p className="text-xs text-gray-400">
                            {c.store_city} · {formatDate(c.tournament_date)} ·{" "}
                            {formatTime(c.tournament_time)}
                          </p>
                        </div>
                        <span className="ml-3 flex-shrink-0 text-[10px] text-gray-500">
                          ~{c.diff_hours.toFixed(1)}h
                        </span>
                      </button>
                    ))}

                    {otherCandidates.length > 0 && !showAll && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="w-full rounded-xl border border-dashed border-white/10 py-2.5 text-xs text-gray-400 transition hover:border-white/20 hover:text-white"
                      >
                        Mostrar más opciones ({otherCandidates.length} en otras zonas)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// SessionDetailPage
// ============================================================
function SessionDetailPage() {
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  const navigate = useNavigate();
  const { player, loading: roleLoading } = useNexusRole();

  const fetchDetail = useServerFn(getStandaloneSessionDetail);
  const undoLink = useServerFn(undoSessionLink);
  const deleteFn = useServerFn(deleteStandaloneSession);
  const updateDetailsFn = useServerFn(updateStandaloneSessionDetails);

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [undoConfirming, setUndoConfirming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const loadDetail = () => {
    setLoading(true);
    fetchDetail({ data: { session_id: sessionId } })
      .then(setDetail)
      .catch((e: any) => toast.error(e?.message ?? "Error al cargar sesión"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (roleLoading || !player) return;
    loadDetail();
  }, [sessionId, player, roleLoading]);

  const handleUndo = async () => {
    setUndoing(true);
    try {
      await undoLink({ data: { session_id: sessionId } });
      toast.success("Vínculo deshecho");
      setUndoConfirming(false);
      loadDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al deshacer");
      setUndoConfirming(false);
    } finally {
      setUndoing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFn({ data: { session_id: sessionId } });
      toast.success("Sesión eliminada");
      navigate({ to: "/sessions" });
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar");
      setDeleteConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleDetailsSave = async () => {
    const trimmedName = nameDraft.trim();
    if (!trimmedName) return;
    setSavingDetails(true);
    try {
      await updateDetailsFn({
        data: {
          session_id: sessionId,
          name: trimmedName,
          session_date: dateDraft || null,
        },
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              session: { ...prev.session, name: trimmedName, session_date: dateDraft || null },
            }
          : prev,
      );
      setEditingDetails(false);
      toast.success("Sesión actualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar la sesión");
    } finally {
      setSavingDetails(false);
    }
  };

  if (!roleLoading && !player) {
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

  const session = detail?.session as
    | (SessionData & {
        game_name: string;
        store_name: string | null;
        store_city: string | null;
      })
    | null;
  const rounds = detail?.rounds ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-28 sm:px-6 sm:pb-10">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-gray-500">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-1 transition hover:text-primary"
        >
          <ArrowLeft size={12} /> Mis Sesiones
        </Link>
        <span>/</span>
        <span className="text-gray-300">{session?.name ?? "…"}</span>
      </div>

      {/* Session overview + round tracker — one merged card, then the rounds */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonBlock className="h-48 rounded-2xl" />
          <SkeletonBlock className="h-24 rounded-xl" />
          <SkeletonBlock className="h-24 rounded-xl" />
        </div>
      ) : session ? (
        <StandaloneRoundTracker
          sessionId={sessionId}
          gameId={session.game_id}
          initialRounds={rounds}
          sessionStatus={session.status}
          session={session}
          header={{
            editingDetails,
            setEditingDetails,
            nameDraft,
            setNameDraft,
            dateDraft,
            setDateDraft,
            savingDetails,
            onSaveDetails: handleDetailsSave,
            deleteConfirming,
            setDeleteConfirming,
            deleting,
            onDelete: handleDelete,
            undoConfirming,
            setUndoConfirming,
            undoing,
            onUndo: handleUndo,
            onLinkManually: () => setPickerOpen(true),
          }}
        />
      ) : null}

      {/* Disambiguation picker */}
      <DisambiguationPicker
        sessionId={sessionId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onLinked={loadDetail}
      />
    </div>
  );
}
